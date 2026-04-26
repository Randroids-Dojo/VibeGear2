/**
 * Cell-level fixtures for the sector-split timer.
 *
 * Covers:
 * - Initial state shape for empty / one / N checkpoint tracks.
 * - `onCheckpointPass` advances `currentSectorIdx` and stamps boundary ticks.
 * - Out-of-order / unknown labels are no-ops (the §7 anti-shortcut layer
 *   owns correctness; the widget never decides).
 * - `splitsForLap` returns cumulative ms for completed sectors only.
 * - `sectorDeltaMs` matches the pinned sign convention.
 * - `bestSplitsForTrack` returns null for fresh saves.
 * - `shouldWriteBestSplits` only fires when overall `bestLapMs` improves.
 * - Pure: no Math.random, no Date.now (snapshot equality across replays).
 */

import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence/save";

import {
  bestSplitsForTrack,
  createSectorState,
  onCheckpointPass,
  sectorDeltaMs,
  shouldWriteBestSplits,
  splitsForLap,
  startNewLap,
  ticksToMs,
} from "../sectorTimer";

const DT = 1 / 60;

const CHECKPOINTS = [
  { label: "start", segmentIndex: 0 },
  { label: "split-a", segmentIndex: 4 },
  { label: "split-b", segmentIndex: 8 },
];

describe("createSectorState", () => {
  it("builds one whole-lap sector for a zero-checkpoint track", () => {
    const state = createSectorState([]);
    expect(state.sectors).toHaveLength(1);
    expect(state.sectors[0]!.label).toBe("lap");
    expect(state.sectors[0]!.tickEntered).toBe(0);
    expect(state.sectors[0]!.tickExited).toBeNull();
    expect(state.currentSectorIdx).toBe(0);
  });

  it("builds one whole-lap sector for a one-checkpoint (start-only) track", () => {
    const state = createSectorState([{ label: "start", segmentIndex: 0 }]);
    expect(state.sectors).toHaveLength(1);
    expect(state.sectors[0]!.label).toBe("start");
    expect(state.currentSectorIdx).toBe(0);
  });

  it("builds N sectors for an N-checkpoint track", () => {
    const state = createSectorState(CHECKPOINTS);
    expect(state.sectors).toHaveLength(3);
    expect(state.sectors.map((s) => s.label)).toEqual([
      "start",
      "split-a",
      "split-b",
    ]);
    expect(state.sectors[0]!.tickEntered).toBe(0);
    expect(state.sectors[1]!.tickEntered).toBe(-1);
    expect(state.sectors[2]!.tickEntered).toBe(-1);
  });
});

describe("onCheckpointPass", () => {
  it("advances currentSectorIdx and stamps the boundary tick on both sides", () => {
    const initial = createSectorState(CHECKPOINTS);
    const next = onCheckpointPass(initial, { label: "split-a" }, 30);
    expect(next.currentSectorIdx).toBe(1);
    expect(next.sectors[0]!.tickExited).toBe(30);
    expect(next.sectors[1]!.tickEntered).toBe(30);
    expect(next.sectors[2]!.tickEntered).toBe(-1);
  });

  it("walks all sectors in order over multiple passes", () => {
    let state = createSectorState(CHECKPOINTS);
    state = onCheckpointPass(state, { label: "split-a" }, 30);
    state = onCheckpointPass(state, { label: "split-b" }, 75);
    expect(state.currentSectorIdx).toBe(2);
    expect(state.sectors[1]!.tickExited).toBe(75);
    expect(state.sectors[2]!.tickEntered).toBe(75);
    expect(state.sectors[2]!.tickExited).toBeNull();
  });

  it("is a no-op when the checkpoint label does not match the next sector", () => {
    const initial = createSectorState(CHECKPOINTS);
    const next = onCheckpointPass(initial, { label: "split-b" }, 30);
    expect(next).toBe(initial);
  });

  it("is a no-op when the player would advance past the final sector", () => {
    let state = createSectorState(CHECKPOINTS);
    state = onCheckpointPass(state, { label: "split-a" }, 30);
    state = onCheckpointPass(state, { label: "split-b" }, 75);
    const after = onCheckpointPass(state, { label: "start" }, 120);
    expect(after).toBe(state);
  });

  it("is a no-op for one-sector tracks", () => {
    const state = createSectorState([]);
    const next = onCheckpointPass(state, { label: "lap" }, 50);
    expect(next).toBe(state);
  });
});

describe("startNewLap", () => {
  it("re-opens the first sector at the lap-boundary tick and resets the rest", () => {
    let state = createSectorState(CHECKPOINTS);
    state = onCheckpointPass(state, { label: "split-a" }, 30);
    state = onCheckpointPass(state, { label: "split-b" }, 75);
    const reset = startNewLap(state, 120);
    expect(reset.currentSectorIdx).toBe(0);
    expect(reset.sectors[0]!.tickEntered).toBe(120);
    expect(reset.sectors[0]!.tickExited).toBeNull();
    expect(reset.sectors[1]!.tickEntered).toBe(-1);
    expect(reset.sectors[2]!.tickEntered).toBe(-1);
  });
});

describe("ticksToMs", () => {
  it("converts ticks to ms at the fixed step", () => {
    expect(ticksToMs(60, 1 / 60)).toBe(1000);
    expect(ticksToMs(30, 1 / 60)).toBe(500);
    expect(ticksToMs(0, 1 / 60)).toBe(0);
  });

  it("returns 0 for non-finite input", () => {
    expect(ticksToMs(Number.NaN, DT)).toBe(0);
    expect(ticksToMs(60, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("splitsForLap", () => {
  it("returns one cumulative ms entry per completed sector", () => {
    let state = createSectorState(CHECKPOINTS);
    state = onCheckpointPass(state, { label: "split-a" }, 60);
    state = onCheckpointPass(state, { label: "split-b" }, 180);
    expect(splitsForLap(state, DT)).toEqual([1000, 3000]);
  });

  it("returns an empty array when no sectors have been completed", () => {
    const state = createSectorState(CHECKPOINTS);
    expect(splitsForLap(state, DT)).toEqual([]);
  });

  it("uses the lap-start tick as the cumulative origin (handles non-zero lap-2 start)", () => {
    let state = createSectorState(CHECKPOINTS);
    state = onCheckpointPass(state, { label: "split-a" }, 60);
    state = onCheckpointPass(state, { label: "split-b" }, 180);
    state = startNewLap(state, 240);
    state = onCheckpointPass(state, { label: "split-a" }, 300);
    expect(splitsForLap(state, DT)).toEqual([1000]);
  });
});

describe("sectorDeltaMs", () => {
  it("matches the pinned sign convention (positive = current slower)", () => {
    expect(sectorDeltaMs([10000, 20000, 30000], [9800, 19500, 29000])).toEqual([
      200,
      500,
      1000,
    ]);
  });

  it("returns negative entries when the current run is faster", () => {
    expect(sectorDeltaMs([9000, 18000], [10000, 20000])).toEqual([-1000, -2000]);
  });

  it("returns the prefix shared by both arrays", () => {
    expect(sectorDeltaMs([1000], [1000, 2000, 3000])).toEqual([0]);
    expect(sectorDeltaMs([], [1000])).toEqual([]);
  });
});

describe("bestSplitsForTrack", () => {
  it("returns null when the track has no record", () => {
    const save = defaultSave();
    expect(bestSplitsForTrack(save, "velvet-coast/harbor-run")).toBeNull();
  });

  it("returns null when the record predates the bestSplitsMs field", () => {
    const save = defaultSave();
    save.records["velvet-coast/harbor-run"] = {
      bestLapMs: 60000,
      bestRaceMs: 180000,
    };
    expect(bestSplitsForTrack(save, "velvet-coast/harbor-run")).toBeNull();
  });

  it("returns the stored splits when present", () => {
    const save = defaultSave();
    save.records["velvet-coast/harbor-run"] = {
      bestLapMs: 60000,
      bestRaceMs: 180000,
      bestSplitsMs: [20000, 40000, 60000],
    };
    expect(bestSplitsForTrack(save, "velvet-coast/harbor-run")).toEqual([
      20000,
      40000,
      60000,
    ]);
  });
});

describe("shouldWriteBestSplits", () => {
  it("writes when there is no previous best", () => {
    expect(shouldWriteBestSplits(60000, null)).toBe(true);
  });

  it("writes when the new lap improves the overall best", () => {
    expect(shouldWriteBestSplits(59000, 60000)).toBe(true);
  });

  it("does not write when the new lap is slower than the previous best", () => {
    expect(shouldWriteBestSplits(61000, 60000)).toBe(false);
  });

  it("does not write for non-finite or non-positive lap times", () => {
    expect(shouldWriteBestSplits(Number.NaN, 60000)).toBe(false);
    expect(shouldWriteBestSplits(0, 60000)).toBe(false);
    expect(shouldWriteBestSplits(-1, 60000)).toBe(false);
  });
});

describe("determinism", () => {
  it("two replays of the same event sequence produce identical state", () => {
    const replay = (): unknown => {
      let state = createSectorState(CHECKPOINTS);
      state = onCheckpointPass(state, { label: "split-a" }, 30);
      state = onCheckpointPass(state, { label: "split-b" }, 75);
      return splitsForLap(state, DT);
    };
    expect(replay()).toEqual(replay());
  });
});
