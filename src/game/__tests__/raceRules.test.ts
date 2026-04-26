/**
 * Unit tests for the pure race-rules helpers in `src/game/raceRules.ts`.
 *
 * Coverage map:
 *
 *   - Countdown labels (`labelForCountdown`): cell-level cases at every
 *     boundary plus the "GO" lights-out frame.
 *
 *   - DNF detection (`tickDnfTimers` + `exceedsRaceTimeLimit`): off-track
 *     accumulation, off-track reset, no-progress accumulation,
 *     no-progress reset, threshold trip on exact tick, race-time-limit
 *     edge cases. Mirrors the iter-19 stress-test §8 cell-level
 *     verifications.
 *
 *   - Ranking (`rankCars`): tie-break ladder (lap > z > totalDistance >
 *     carId), status partition (finished > racing > dnf), purity.
 *
 *   - Final state (`buildFinalRaceState`): finishing-order partition,
 *     fastest-lap derivation, per-lap-times shape, all-DNF edge case.
 *
 *   - Determinism: two runs from the same input array produce
 *     deep-equal outputs.
 *
 *   - Frozen invariants: `INITIAL_DNF_TIMERS` and
 *     `COUNTDOWN_TICK_LABELS` are frozen.
 */

import { describe, expect, it } from "vitest";

import {
  COUNTDOWN_TICK_LABELS,
  DEFAULT_COUNTDOWN_SEC,
  DNF_NO_PROGRESS_DELTA_M,
  DNF_NO_PROGRESS_TIMEOUT_SEC,
  DNF_OFF_TRACK_RESET_SPEED_M_PER_S,
  DNF_OFF_TRACK_TIMEOUT_SEC,
  DNF_RACE_TIME_LIMIT_SEC,
  INITIAL_DNF_TIMERS,
  buildFinalRaceState,
  exceedsRaceTimeLimit,
  labelForCountdown,
  rankCars,
  tickDnfTimers,
  type CarRankSnapshot,
  type DnfSample,
  type DnfTimers,
  type FinalCarInput,
} from "../raceRules";

describe("countdown labels", () => {
  it("exports the four canonical labels in display order", () => {
    expect([...COUNTDOWN_TICK_LABELS]).toEqual(["3", "2", "1", "GO"]);
  });

  it("freezes the label list", () => {
    expect(Object.isFrozen(COUNTDOWN_TICK_LABELS)).toBe(true);
  });

  it("re-exports DEFAULT_COUNTDOWN_SEC at the same value as raceState", () => {
    expect(DEFAULT_COUNTDOWN_SEC).toBe(3);
  });

  it.each([
    [3, "3"],
    [2.5, "3"],
    [2.0001, "3"],
    [2, "2"],
    [1.5, "2"],
    [1.0001, "2"],
    [1, "1"],
    [0.5, "1"],
    [0.0001, "1"],
    [0, "GO"],
    [-0.5, "GO"],
    [Number.NaN, "GO"],
    [Number.POSITIVE_INFINITY, "GO"],
  ])("labelForCountdown(%p) is %p", (input, expected) => {
    expect(labelForCountdown(input)).toBe(expected);
  });
});

describe("DNF timers (off-track)", () => {
  const sampleOffTrack: DnfSample = {
    offTrack: true,
    speed: 0,
    totalDistance: 0,
  };

  it("accumulates off-track seconds while off-road and slow", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    for (let i = 0; i < 60; i += 1) {
      const result = tickDnfTimers(timers, sampleOffTrack, 1 / 60);
      timers = result.timers;
      expect(result.dnf).toBe(false);
    }
    expect(timers.offTrackSec).toBeCloseTo(1, 6);
  });

  it("resets off-track seconds the first tick the car is back on road", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    // 10 seconds off.
    for (let i = 0; i < 600; i += 1) {
      timers = tickDnfTimers(timers, sampleOffTrack, 1 / 60).timers;
    }
    expect(timers.offTrackSec).toBeGreaterThan(9.9);
    // One tick on-road.
    const onRoad: DnfSample = { offTrack: false, speed: 50, totalDistance: 100 };
    const result = tickDnfTimers(timers, onRoad, 1 / 60);
    expect(result.timers.offTrackSec).toBe(0);
  });

  it("resets off-track seconds when the car is moving fast through grass", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    timers = tickDnfTimers(timers, sampleOffTrack, 1).timers;
    expect(timers.offTrackSec).toBe(1);
    const fastGrass: DnfSample = {
      offTrack: true,
      speed: DNF_OFF_TRACK_RESET_SPEED_M_PER_S + 1,
      totalDistance: 10,
    };
    const result = tickDnfTimers(timers, fastGrass, 1 / 60);
    expect(result.timers.offTrackSec).toBe(0);
  });

  it("flips to dnf with reason 'off-track' on the exact tick the threshold trips", () => {
    let timers: DnfTimers = {
      offTrackSec: DNF_OFF_TRACK_TIMEOUT_SEC - 0.5,
      noProgressSec: 0,
      lastProgressMark: 0,
    };
    const before = tickDnfTimers(timers, sampleOffTrack, 0.49);
    expect(before.dnf).toBe(false);
    timers = before.timers;
    const trip = tickDnfTimers(timers, sampleOffTrack, 0.02);
    expect(trip.dnf).toBe(true);
    expect(trip.reason).toBe("off-track");
  });

  it("guards against the 'cycled grass / road / grass' replay-of-old-time bug", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    // 25 seconds off.
    for (let i = 0; i < 1500; i += 1) {
      timers = tickDnfTimers(timers, sampleOffTrack, 1 / 60).timers;
    }
    expect(timers.offTrackSec).toBeGreaterThan(24.9);
    // 6 seconds on-road and moving (resets off-track on tick 1).
    const onRoad: DnfSample = { offTrack: false, speed: 30, totalDistance: 200 };
    for (let i = 0; i < 360; i += 1) {
      timers = tickDnfTimers(
        timers,
        { ...onRoad, totalDistance: 200 + i },
        1 / 60,
      ).timers;
    }
    expect(timers.offTrackSec).toBe(0);
    // Off again: starts from zero, not from the prior 25s.
    timers = tickDnfTimers(
      timers,
      { offTrack: true, speed: 0, totalDistance: 560 },
      1 / 60,
    ).timers;
    expect(timers.offTrackSec).toBeLessThan(0.1);
    expect(timers.offTrackSec).toBeGreaterThan(0);
  });
});

describe("DNF timers (no-progress)", () => {
  it("accumulates no-progress seconds when the car is barely moving", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    const stuck: DnfSample = { offTrack: false, speed: 0, totalDistance: 0 };
    for (let i = 0; i < 60; i += 1) {
      timers = tickDnfTimers(timers, stuck, 1 / 60).timers;
    }
    expect(timers.noProgressSec).toBeCloseTo(1, 6);
  });

  it("resets the no-progress window on the first tick the car covers DNF_NO_PROGRESS_DELTA_M", () => {
    let timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    // Build up some no-progress time first.
    for (let i = 0; i < 30; i += 1) {
      timers = tickDnfTimers(
        timers,
        { offTrack: false, speed: 0, totalDistance: 0 },
        1 / 60,
      ).timers;
    }
    expect(timers.noProgressSec).toBeGreaterThan(0.4);
    // Now leap forward by exactly the threshold distance.
    const result = tickDnfTimers(
      timers,
      {
        offTrack: false,
        speed: 100,
        totalDistance: DNF_NO_PROGRESS_DELTA_M,
      },
      1 / 60,
    );
    expect(result.timers.noProgressSec).toBe(0);
    expect(result.timers.lastProgressMark).toBe(DNF_NO_PROGRESS_DELTA_M);
  });

  it("flips to dnf with reason 'no-progress' on the exact tick the threshold trips", () => {
    let timers: DnfTimers = {
      offTrackSec: 0,
      noProgressSec: DNF_NO_PROGRESS_TIMEOUT_SEC - 0.5,
      lastProgressMark: 0,
    };
    const stuck: DnfSample = { offTrack: false, speed: 0, totalDistance: 0 };
    const before = tickDnfTimers(timers, stuck, 0.49);
    expect(before.dnf).toBe(false);
    timers = before.timers;
    const trip = tickDnfTimers(timers, stuck, 0.02);
    expect(trip.dnf).toBe(true);
    expect(trip.reason).toBe("no-progress");
  });

  it("prefers the 'off-track' reason when both timers trip on the same tick", () => {
    const timers: DnfTimers = {
      offTrackSec: DNF_OFF_TRACK_TIMEOUT_SEC,
      noProgressSec: DNF_NO_PROGRESS_TIMEOUT_SEC,
      lastProgressMark: 0,
    };
    const stuck: DnfSample = { offTrack: true, speed: 0, totalDistance: 0 };
    const result = tickDnfTimers(timers, stuck, 1 / 60);
    expect(result.dnf).toBe(true);
    expect(result.reason).toBe("off-track");
  });

  it("never mutates its input timers object", () => {
    const original: DnfTimers = { offTrackSec: 1, noProgressSec: 2, lastProgressMark: 3 };
    const snapshot = { ...original };
    const sample: DnfSample = { offTrack: true, speed: 0, totalDistance: 3 };
    tickDnfTimers(original, sample, 1 / 60);
    expect(original).toEqual(snapshot);
  });

  it("returns a fresh object on every call (replay safety)", () => {
    const timers: DnfTimers = { ...INITIAL_DNF_TIMERS };
    const a = tickDnfTimers(timers, { offTrack: false, speed: 50, totalDistance: 10 }, 1 / 60);
    const b = tickDnfTimers(timers, { offTrack: false, speed: 50, totalDistance: 10 }, 1 / 60);
    expect(a.timers).not.toBe(b.timers);
    expect(a.timers).toEqual(b.timers);
  });

  it("returns a no-op clone when dt is zero or negative", () => {
    const timers: DnfTimers = { offTrackSec: 1, noProgressSec: 2, lastProgressMark: 3 };
    const sample: DnfSample = { offTrack: true, speed: 0, totalDistance: 3 };
    expect(tickDnfTimers(timers, sample, 0).timers).toEqual(timers);
    expect(tickDnfTimers(timers, sample, -0.1).timers).toEqual(timers);
    expect(tickDnfTimers(timers, sample, Number.NaN).timers).toEqual(timers);
  });
});

describe("exceedsRaceTimeLimit", () => {
  it("returns false below the limit", () => {
    expect(exceedsRaceTimeLimit(0)).toBe(false);
    expect(exceedsRaceTimeLimit(DNF_RACE_TIME_LIMIT_SEC - 1)).toBe(false);
  });

  it("returns true at and beyond the limit", () => {
    expect(exceedsRaceTimeLimit(DNF_RACE_TIME_LIMIT_SEC)).toBe(true);
    expect(exceedsRaceTimeLimit(DNF_RACE_TIME_LIMIT_SEC + 0.001)).toBe(true);
  });

  it("returns false for negative or non-finite input", () => {
    expect(exceedsRaceTimeLimit(-1)).toBe(false);
    expect(exceedsRaceTimeLimit(Number.NaN)).toBe(false);
    expect(exceedsRaceTimeLimit(Number.POSITIVE_INFINITY)).toBe(true);
  });
});

describe("INITIAL_DNF_TIMERS invariants", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(INITIAL_DNF_TIMERS)).toBe(true);
  });

  it("has zero accumulators and a zero progress mark", () => {
    expect(INITIAL_DNF_TIMERS.offTrackSec).toBe(0);
    expect(INITIAL_DNF_TIMERS.noProgressSec).toBe(0);
    expect(INITIAL_DNF_TIMERS.lastProgressMark).toBe(0);
  });
});

describe("rankCars", () => {
  function snap(
    carId: string,
    lap: number,
    z: number,
    totalDistance: number,
    status: CarRankSnapshot["status"] = "racing",
  ): CarRankSnapshot {
    return { carId, lap, z, totalDistance, status };
  }

  it("orders by lap descending first", () => {
    const ranked = rankCars([
      snap("a", 1, 1900, 1900),
      snap("b", 2, 50, 2050),
    ]);
    expect(ranked.map((s) => s.carId)).toEqual(["b", "a"]);
  });

  it("orders by z descending within the same lap", () => {
    const ranked = rankCars([
      snap("a", 1, 800, 800),
      snap("b", 1, 1900, 1900),
      snap("c", 1, 1500, 1500),
    ]);
    expect(ranked.map((s) => s.carId)).toEqual(["b", "c", "a"]);
  });

  it("falls through to totalDistance then carId for ties", () => {
    const ranked = rankCars([
      snap("a", 1, 100, 100),
      snap("b", 1, 100, 200),
      snap("c", 1, 100, 100),
    ]);
    expect(ranked.map((s) => s.carId)).toEqual(["b", "a", "c"]);
  });

  it("partitions by status: finished > racing > dnf", () => {
    const ranked = rankCars([
      snap("dnfL", 3, 9999, 9999, "dnf"),
      snap("raceL", 1, 100, 100, "racing"),
      snap("finishedH", 3, 0, 6000, "finished"),
    ]);
    expect(ranked.map((s) => s.carId)).toEqual([
      "finishedH",
      "raceL",
      "dnfL",
    ]);
  });

  it("matches the iter-19 stress-test §8 ranking case", () => {
    const ranked = rankCars([
      snap("carA", 1, 1500, 1500),
      snap("carB", 1, 1900, 1900),
      snap("carC", 2, 10, 2010),
      snap("carD", 1, 800, 800),
    ]);
    expect(ranked.map((s) => s.carId)).toEqual(["carC", "carB", "carA", "carD"]);
  });

  it("does not mutate the input array", () => {
    const input = [snap("a", 1, 50, 50), snap("b", 1, 100, 100)];
    const before = JSON.parse(JSON.stringify(input));
    rankCars(input);
    expect(input).toEqual(before);
  });

  it("returns a deep-equal value for two runs of the same input (determinism)", () => {
    const input = [
      snap("c", 2, 100, 1100),
      snap("a", 1, 800, 800),
      snap("b", 2, 900, 1900),
    ];
    const a = rankCars(input);
    const b = rankCars(input);
    expect(a).toEqual(b);
  });
});

describe("buildFinalRaceState", () => {
  function carInput(
    carId: string,
    lapTimes: number[],
    raceTimeMs: number | null,
    status: FinalCarInput["status"],
  ): FinalCarInput {
    return { carId, lapTimes, raceTimeMs, status };
  }

  it("orders finishers by raceTimeMs ascending then carId", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 3,
      cars: [
        carInput("a", [60_000, 59_000, 60_000], 179_000, "finished"),
        carInput("b", [58_000, 59_000, 60_000], 177_000, "finished"),
        carInput("c", [60_000, 60_000, 60_000], 180_000, "finished"),
      ],
    });
    expect(result.finishingOrder.map((r) => r.carId)).toEqual(["b", "a", "c"]);
  });

  it("places DNF cars after every finisher and orders DNF by laps completed", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 3,
      cars: [
        carInput("a", [60_000], null, "dnf"),
        carInput("b", [60_000, 60_000, 60_000], 180_000, "finished"),
        carInput("c", [60_000, 60_000], null, "dnf"),
        carInput("d", [], null, "dnf"),
      ],
    });
    expect(result.finishingOrder.map((r) => r.carId)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("derives the fastest lap with earliest-lap tie-break", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 3,
      cars: [
        carInput("a", [60_000, 58_000, 58_000], 176_000, "finished"),
        carInput("b", [58_000, 59_000, 60_000], 177_000, "finished"),
      ],
    });
    expect(result.fastestLap).toEqual({
      carId: "b",
      lapMs: 58_000,
      lapNumber: 1,
    });
  });

  it("returns null fastestLap when no car completed a lap", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 3,
      cars: [
        carInput("a", [], null, "dnf"),
        carInput("b", [], null, "dnf"),
      ],
    });
    expect(result.fastestLap).toBeNull();
  });

  it("computes per-car bestLapMs and exposes per-lap times", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 2,
      cars: [
        carInput("a", [62_000, 60_500], 122_500, "finished"),
        carInput("b", [], null, "dnf"),
      ],
    });
    const a = result.finishingOrder.find((r) => r.carId === "a");
    expect(a?.bestLapMs).toBe(60_500);
    expect(a?.raceTimeMs).toBe(122_500);
    expect(result.perLapTimes.a).toEqual([62_000, 60_500]);
    expect(result.perLapTimes.b).toEqual([]);
    const b = result.finishingOrder.find((r) => r.carId === "b");
    expect(b?.bestLapMs).toBeNull();
    expect(b?.raceTimeMs).toBeNull();
  });

  it("preserves trackId and totalLaps on the output", () => {
    const result = buildFinalRaceState({
      trackId: "alpine-pass",
      totalLaps: 4,
      cars: [carInput("a", [60_000, 60_000, 60_000, 60_000], 240_000, "finished")],
    });
    expect(result.trackId).toBe("alpine-pass");
    expect(result.totalLaps).toBe(4);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = {
      trackId: "test-curve",
      totalLaps: 3,
      cars: [
        carInput("c", [60_000, 60_000, 60_000], 180_000, "finished"),
        carInput("a", [], null, "dnf"),
        carInput("b", [59_500, 60_500, 60_000], 180_000, "finished"),
      ],
    };
    expect(buildFinalRaceState(input)).toEqual(buildFinalRaceState(input));
  });

  it("ignores non-positive or non-finite lap entries when computing fastest lap", () => {
    const result = buildFinalRaceState({
      trackId: "test-curve",
      totalLaps: 2,
      cars: [
        carInput("a", [Number.NaN, 60_000], 120_000, "finished"),
        carInput("b", [-1, 59_000], 119_000, "finished"),
      ],
    });
    expect(result.fastestLap).toEqual({
      carId: "b",
      lapMs: 59_000,
      lapNumber: 2,
    });
  });
});
