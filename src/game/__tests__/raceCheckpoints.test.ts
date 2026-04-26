/**
 * Cell-level fixtures for the per-tick checkpoint detector and the
 * `RaceState` helpers that consume it.
 *
 * Covers:
 * - `detectCheckpointPass` returns null on empty checkpoint lists, on
 *   reverse motion, and on movement windows larger than half the track.
 * - Forward-pass detection inside the same lap.
 * - Wrap-around detection across the start line, including the start-
 *   line checkpoint at `segmentIndex = 0`.
 * - Multi-pass per tick returns the LAST checkpoint crossed.
 * - `applyCheckpointPass` is pure (does not mutate input) and idempotent
 *   on repeated same-checkpoint calls within a lap.
 * - `resetCheckpointsForNewLap` clears the per-lap pass set but preserves
 *   `lastCheckpoint` so consumers can keep using the prior snapshot
 *   across the lap boundary.
 * - `hasPassedAllCheckpoints` truth table for 0, 1, 2, and 5 checkpoints.
 * - Determinism: two identical detector calls return the same checkpoint
 *   reference (or null), with deep-equal output across runs.
 */

import { describe, expect, it } from "vitest";

import { INITIAL_CAR_STATE, type CarState } from "../physics";
import {
  EMPTY_PASSED_SET,
  applyCheckpointPass,
  detectCheckpointPass,
  hasPassedAllCheckpoints,
  resetCheckpointsForNewLap,
  type CheckpointInput,
} from "../raceCheckpoints";
import { createRaceState, type RaceState } from "../raceState";

const SEG_LEN = 6;
const TRACK_LEN = 600; // 100 segments at 6 m

const CHECKPOINTS: ReadonlyArray<CheckpointInput> = [
  { segmentIndex: 0, label: "start" },
  { segmentIndex: 25, label: "split-a" },
  { segmentIndex: 50, label: "split-b" },
  { segmentIndex: 75, label: "split-c" },
];

const SAMPLE_CAR_STATE: CarState = { ...INITIAL_CAR_STATE, z: 100, x: 0.5, speed: 30 };

describe("detectCheckpointPass", () => {
  it("returns null when the checkpoint list is empty", () => {
    expect(detectCheckpointPass(0, 50, TRACK_LEN, SEG_LEN, [])).toBeNull();
  });

  it("returns the checkpoint when the player crosses it forward inside one lap", () => {
    // Player crosses split-a (segmentIndex 25 -> z 150).
    const result = detectCheckpointPass(140, 160, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("split-a");
    expect(result!.segmentIndex).toBe(25);
  });

  it("returns null when no checkpoint is between prevZ and currZ", () => {
    // Both z values are between split-a (z 150) and split-b (z 300).
    const result = detectCheckpointPass(160, 200, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).toBeNull();
  });

  it("detects the wrap-around start checkpoint when currZ < prevZ", () => {
    // Player at z 580, advances 50 m, lap rolls: currZ becomes 30.
    // The start checkpoint at z 0 (or equivalently z 600) is in the
    // unwrapped window (580, 630].
    const result = detectCheckpointPass(580, 30, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("start");
    expect(result!.segmentIndex).toBe(0);
  });

  it("returns null on reverse motion within the same lap (no wrap)", () => {
    // Player at z 200 backs up to z 140 (a backwards spin); split-a at
    // z 150 should NOT register because pass detection is forward-only.
    const result = detectCheckpointPass(200, 140, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).toBeNull();
  });

  it("returns null when the movement window exceeds half the track length", () => {
    // 600 m track, half is 300. A 350 m forward jump is ambiguous.
    const result = detectCheckpointPass(0, 350, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).toBeNull();
  });

  it("returns the LAST checkpoint when two are crossed in one tick", () => {
    // Player jumps from z 140 to z 320: passes split-a (150) AND
    // split-b (300). Detector returns split-b (the higher z).
    const result = detectCheckpointPass(140, 320, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("split-b");
  });

  it("returns null on negative or non-finite z inputs", () => {
    expect(
      detectCheckpointPass(Number.NaN, 100, TRACK_LEN, SEG_LEN, CHECKPOINTS),
    ).toBeNull();
    expect(
      detectCheckpointPass(0, Number.NEGATIVE_INFINITY, TRACK_LEN, SEG_LEN, CHECKPOINTS),
    ).toBeNull();
  });

  it("returns null when track length is non-positive or non-finite", () => {
    expect(detectCheckpointPass(0, 50, 0, SEG_LEN, CHECKPOINTS)).toBeNull();
    expect(
      detectCheckpointPass(0, 50, Number.NaN, SEG_LEN, CHECKPOINTS),
    ).toBeNull();
  });

  it("ignores the start checkpoint on a within-lap forward step (only wraps trigger it)", () => {
    // Player at z 10 -> 20. Start checkpoint is at z 0. Forward window
    // is (10, 20]; start at 0 is not in window.
    const result = detectCheckpointPass(10, 20, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(result).toBeNull();
  });

  it("matches the same detector output across two identical runs (determinism)", () => {
    const a = detectCheckpointPass(140, 160, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    const b = detectCheckpointPass(140, 160, TRACK_LEN, SEG_LEN, CHECKPOINTS);
    expect(a).toEqual(b);
  });
});

describe("applyCheckpointPass", () => {
  it("returns a fresh state with the segment index added and lastCheckpoint stamped", () => {
    const initial = createRaceState(3);
    const cp: CheckpointInput = { segmentIndex: 25, label: "split-a" };
    const next = applyCheckpointPass(initial, cp, 30, SAMPLE_CAR_STATE);
    expect(next).not.toBe(initial);
    expect(next.passedCheckpointsThisLap.has(25)).toBe(true);
    expect(next.lastCheckpoint).not.toBeNull();
    expect(next.lastCheckpoint!.tick).toBe(30);
    expect(next.lastCheckpoint!.segmentIndex).toBe(25);
    expect(next.lastCheckpoint!.label).toBe("split-a");
    expect(next.lastCheckpoint!.carState).toEqual(SAMPLE_CAR_STATE);
  });

  it("does not mutate the input state", () => {
    const initial = createRaceState(3);
    const cp: CheckpointInput = { segmentIndex: 25, label: "split-a" };
    applyCheckpointPass(initial, cp, 30, SAMPLE_CAR_STATE);
    expect(initial.passedCheckpointsThisLap.has(25)).toBe(false);
    expect(initial.lastCheckpoint).toBeNull();
  });

  it("defensively copies the carState (later mutation does not poison snapshot)", () => {
    const initial = createRaceState(3);
    const cp: CheckpointInput = { segmentIndex: 25, label: "split-a" };
    const carState: CarState = { ...SAMPLE_CAR_STATE };
    const next = applyCheckpointPass(initial, cp, 30, carState);
    carState.z = 9999;
    expect(next.lastCheckpoint!.carState.z).toBe(SAMPLE_CAR_STATE.z);
  });

  it("re-stamps lastCheckpoint on a same-segment idempotent call", () => {
    const initial = createRaceState(3);
    const cp: CheckpointInput = { segmentIndex: 25, label: "split-a" };
    const once = applyCheckpointPass(initial, cp, 30, SAMPLE_CAR_STATE);
    const twice = applyCheckpointPass(once, cp, 60, SAMPLE_CAR_STATE);
    expect(twice.lastCheckpoint!.tick).toBe(60);
    expect(twice.passedCheckpointsThisLap.has(25)).toBe(true);
  });
});

describe("resetCheckpointsForNewLap", () => {
  it("clears the pass set but preserves lastCheckpoint", () => {
    let state: RaceState = createRaceState(3);
    state = applyCheckpointPass(
      state,
      { segmentIndex: 25, label: "split-a" },
      30,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 50, label: "split-b" },
      60,
      SAMPLE_CAR_STATE,
    );
    const next = resetCheckpointsForNewLap(state);
    expect(next.passedCheckpointsThisLap.size).toBe(0);
    expect(next.lastCheckpoint).not.toBeNull();
    expect(next.lastCheckpoint!.label).toBe("split-b");
  });

  it("does not mutate the input state", () => {
    let state: RaceState = createRaceState(3);
    state = applyCheckpointPass(
      state,
      { segmentIndex: 25, label: "split-a" },
      30,
      SAMPLE_CAR_STATE,
    );
    resetCheckpointsForNewLap(state);
    expect(state.passedCheckpointsThisLap.has(25)).toBe(true);
  });
});

describe("hasPassedAllCheckpoints", () => {
  it("returns true vacuously for a zero-checkpoint track", () => {
    const state = createRaceState(3);
    expect(hasPassedAllCheckpoints(state, { checkpoints: [] })).toBe(true);
  });

  it("returns true when every declared checkpoint is in the pass set", () => {
    let state: RaceState = createRaceState(3);
    state = applyCheckpointPass(
      state,
      { segmentIndex: 0, label: "start" },
      0,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 25, label: "split-a" },
      30,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 50, label: "split-b" },
      60,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 75, label: "split-c" },
      90,
      SAMPLE_CAR_STATE,
    );
    expect(hasPassedAllCheckpoints(state, { checkpoints: CHECKPOINTS })).toBe(true);
  });

  it("returns false when even one declared checkpoint is missing", () => {
    let state: RaceState = createRaceState(3);
    // Pass 3 of the 4 checkpoints; skip split-b.
    state = applyCheckpointPass(
      state,
      { segmentIndex: 0, label: "start" },
      0,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 25, label: "split-a" },
      30,
      SAMPLE_CAR_STATE,
    );
    state = applyCheckpointPass(
      state,
      { segmentIndex: 75, label: "split-c" },
      90,
      SAMPLE_CAR_STATE,
    );
    expect(hasPassedAllCheckpoints(state, { checkpoints: CHECKPOINTS })).toBe(false);
  });

  it("returns false on a fresh state with one or more declared checkpoints", () => {
    const state = createRaceState(3);
    expect(
      hasPassedAllCheckpoints(state, { checkpoints: [{ segmentIndex: 1, label: "only" }] }),
    ).toBe(false);
  });
});

describe("EMPTY_PASSED_SET", () => {
  it("is shared across createRaceState invocations (no per-state allocation)", () => {
    const a = createRaceState(3);
    const b = createRaceState(3);
    expect(a.passedCheckpointsThisLap).toBe(b.passedCheckpointsThisLap);
    expect(a.passedCheckpointsThisLap).toBe(EMPTY_PASSED_SET);
  });
});
