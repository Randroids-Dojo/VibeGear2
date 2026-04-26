/**
 * Unit tests for the ghost replay recorder and player in
 * `src/game/ghost.ts`.
 *
 * Coverage map (mirrors the dot stress-test items):
 *
 *   - Recorder: per-tick record, neutral-input first tick, no-change
 *     ticks skipped, strictly increasing tick guard, soft-cap
 *     callback, hard-cap rejection + truncation flag.
 *   - Player: bit-exact round-trip, neutral coast after exhaust, finished
 *     latching, mid-recording playback (driver holds inputs steady for
 *     long stretches).
 *   - Determinism: two separately-fed recorders with identical input
 *     sequences produce JSON-stringify-equal replays. The same replay
 *     drives two independent players to identical input streams across
 *     every tick.
 *   - Version mismatch: format version, physics version, fixed-step ms
 *     each cause `mismatchReason` and `null` reads.
 *   - Malformed deltas: out-of-order tick, mask = 0, mask out of range,
 *     values length disagrees with mask popcount, tick beyond
 *     totalTicks, totalTicks not an integer.
 *   - Defensive copy: post-finalize `record` calls do not mutate a
 *     replay the caller already holds.
 *   - Soft-cap callback failure does not break recording.
 *
 * The tests do not exercise the renderer or save integration: those
 * land with their own slices (filed as F-NNN). This module is a pure
 * producer with a JSON-clean output shape, so the test surface is the
 * input-deltas-input round-trip.
 */

import { describe, expect, it, vi } from "vitest";

import {
  INPUT_FIELDS,
  RECORDER_HARD_CAP_TICKS,
  RECORDER_SOFT_CAP_TICKS,
  REPLAY_FORMAT_VERSION,
  createPlayer,
  createRecorder,
  type Replay,
} from "../ghost";
import { NEUTRAL_INPUT, type Input } from "../input";
import { FIXED_STEP_MS } from "../loop";
import { PHYSICS_VERSION } from "../physics";

// Helpers ----------------------------------------------------------------

function input(overrides: Partial<Input> = {}): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function fixedRecorderOpts(overrides: Partial<{ seed: number; carId: string }> = {}) {
  return {
    trackId: "test-track",
    trackVersion: 1,
    carId: overrides.carId ?? "sparrow-gt",
    seed: overrides.seed ?? 0xdeadbeef,
  };
}

// Recorder ---------------------------------------------------------------

describe("createRecorder", () => {
  it("starts with zero recorded ticks and no truncation", () => {
    const rec = createRecorder(fixedRecorderOpts());
    expect(rec.recordedTicks).toBe(0);
    expect(rec.truncated).toBe(false);
  });

  it("records the first non-neutral tick as a full delta of changed fields", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1, steer: 0.5 }), 0);
    const replay = rec.finalize();
    expect(replay.totalTicks).toBe(1);
    expect(replay.deltas).toHaveLength(1);
    const delta = replay.deltas[0]!;
    expect(delta.tick).toBe(0);
    // bits for steer (0) and throttle (1).
    expect(delta.mask).toBe(0b11);
    expect(delta.values).toEqual([0.5, 1]);
  });

  it("does not record a tick that matches the prior input", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    rec.record(input({ throttle: 1 }), 1);
    rec.record(input({ throttle: 1 }), 2);
    const replay = rec.finalize();
    expect(replay.totalTicks).toBe(3);
    // First tick changes throttle from neutral; subsequent ticks are
    // bit-identical so no delta is appended.
    expect(replay.deltas).toHaveLength(1);
    expect(replay.deltas[0]!.tick).toBe(0);
  });

  it("does not record a tick where the driver returns to neutral on tick 0", () => {
    // The first call sees the implicit NEUTRAL prior. A neutral input on
    // tick 0 matches and emits no delta, but the tick still counts toward
    // totalTicks.
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input(), 0);
    const replay = rec.finalize();
    expect(replay.totalTicks).toBe(1);
    expect(replay.deltas).toEqual([]);
  });

  it("rejects non-integer ticks", () => {
    const rec = createRecorder(fixedRecorderOpts());
    expect(() => rec.record(input(), 1.5)).toThrow(TypeError);
    expect(() => rec.record(input(), -1)).toThrow(TypeError);
    expect(() => rec.record(input(), Number.NaN)).toThrow(TypeError);
  });

  it("rejects ticks that do not strictly increase", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input(), 0);
    rec.record(input(), 1);
    expect(() => rec.record(input(), 1)).toThrow(RangeError);
    expect(() => rec.record(input(), 0)).toThrow(RangeError);
  });

  it("stamps physicsVersion, formatVersion, and fixedStepMs on finalize", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    const replay = rec.finalize();
    expect(replay.formatVersion).toBe(REPLAY_FORMAT_VERSION);
    expect(replay.physicsVersion).toBe(PHYSICS_VERSION);
    expect(replay.fixedStepMs).toBe(FIXED_STEP_MS);
  });

  it("normalises seed to u32", () => {
    const rec = createRecorder(fixedRecorderOpts({ seed: -1 }));
    const replay = rec.finalize();
    expect(replay.seed).toBe(0xffffffff);
  });

  it("computes finalTimeMs from totalTicks * fixedStepMs", () => {
    const rec = createRecorder(fixedRecorderOpts());
    for (let i = 0; i < 60; i += 1) {
      rec.record(input({ throttle: 1 }), i);
    }
    const replay = rec.finalize();
    expect(replay.totalTicks).toBe(60);
    expect(replay.finalTimeMs).toBeCloseTo(60 * FIXED_STEP_MS, 10);
  });

  it("finalize is idempotent", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    rec.record(input({ throttle: 0.5 }), 1);
    const a = rec.finalize();
    const b = rec.finalize();
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("recorder caps", () => {
  it("fires onSoftCap exactly once when crossing the soft cap", () => {
    const onSoftCap = vi.fn();
    const rec = createRecorder({ ...fixedRecorderOpts(), onSoftCap });
    // Walk just past the soft cap. The recorder fires onSoftCap when
    // recordedTicks > RECORDER_SOFT_CAP_TICKS.
    for (let i = 0; i <= RECORDER_SOFT_CAP_TICKS; i += 1) {
      // Alternate to keep deltas non-trivial; not load-bearing for the
      // cap test, just exercises the diff path.
      rec.record(input({ throttle: i % 2 === 0 ? 1 : 0 }), i);
    }
    expect(onSoftCap).toHaveBeenCalledTimes(1);
    // Recording another full second past the cap does not fire again.
    for (let i = 0; i < 60; i += 1) {
      rec.record(
        input({ throttle: (i + 1) % 2 === 0 ? 1 : 0 }),
        RECORDER_SOFT_CAP_TICKS + 1 + i,
      );
    }
    expect(onSoftCap).toHaveBeenCalledTimes(1);
  });

  it("survives an onSoftCap callback that throws", () => {
    const onSoftCap = vi.fn(() => {
      throw new Error("HUD blew up");
    });
    const rec = createRecorder({ ...fixedRecorderOpts(), onSoftCap });
    for (let i = 0; i <= RECORDER_SOFT_CAP_TICKS; i += 1) {
      rec.record(input({ throttle: i % 2 === 0 ? 1 : 0 }), i);
    }
    expect(onSoftCap).toHaveBeenCalledTimes(1);
    // Recorder kept going.
    expect(rec.recordedTicks).toBe(RECORDER_SOFT_CAP_TICKS + 1);
    expect(rec.truncated).toBe(false);
  });

  it("rejects record calls past the hard cap and stamps truncated", () => {
    const rec = createRecorder(fixedRecorderOpts());
    for (let i = 0; i < RECORDER_HARD_CAP_TICKS; i += 1) {
      const accepted = rec.record(input({ throttle: i % 2 === 0 ? 1 : 0 }), i);
      expect(accepted).toBe(true);
    }
    expect(rec.recordedTicks).toBe(RECORDER_HARD_CAP_TICKS);
    const rejected = rec.record(input(), RECORDER_HARD_CAP_TICKS);
    expect(rejected).toBe(false);
    expect(rec.truncated).toBe(true);
    const replay = rec.finalize();
    expect(replay.truncated).toBe(true);
    expect(replay.totalTicks).toBe(RECORDER_HARD_CAP_TICKS);
  });
});

describe("recorder defensive copy", () => {
  it("does not mutate a previously-returned replay when recording continues", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    const snapshot = rec.finalize();
    const snapshotJson = JSON.stringify(snapshot);
    rec.record(input({ throttle: 0, brake: 1 }), 1);
    rec.record(input({ throttle: 0.5 }), 2);
    // The earlier snapshot is unchanged.
    expect(JSON.stringify(snapshot)).toBe(snapshotJson);
    const newer = rec.finalize();
    expect(newer.totalTicks).toBe(3);
    // The newer replay has more deltas than the snapshot.
    expect(newer.deltas.length).toBeGreaterThan(snapshot.deltas.length);
  });
});

// Round-trip -------------------------------------------------------------

describe("recorder + player round-trip", () => {
  it("reproduces the recorded input stream tick-by-tick (bit-exact)", () => {
    const sequence: Input[] = [
      input(),
      input({ throttle: 1 }),
      input({ throttle: 1, steer: 0.5 }),
      input({ throttle: 1, steer: 0.5 }),
      input({ throttle: 1, steer: -0.25 }),
      input({ throttle: 0, brake: 1 }),
      input({ throttle: 0, brake: 1, nitro: true }),
      input({ throttle: 1, brake: 0, nitro: true, handbrake: true }),
      input({ throttle: 1, brake: 0, nitro: false, handbrake: false }),
      input({ throttle: 1, brake: 0, shiftUp: true }),
      input({ throttle: 1, brake: 0, shiftUp: false }),
      input(),
    ];
    const rec = createRecorder(fixedRecorderOpts());
    for (let i = 0; i < sequence.length; i += 1) {
      rec.record(sequence[i]!, i);
    }
    const replay = rec.finalize();
    const player = createPlayer(replay);
    for (let i = 0; i < sequence.length; i += 1) {
      const got = player.readNext(i);
      expect(got).toEqual(sequence[i]);
    }
    expect(player.finished).toBe(true);
  });

  it("returns NEUTRAL_INPUT for ticks past the recording", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    rec.record(input({ throttle: 1 }), 1);
    rec.record(input({ throttle: 1 }), 2);
    const replay = rec.finalize();
    const player = createPlayer(replay);
    expect(player.readNext(0)).toEqual(input({ throttle: 1 }));
    expect(player.readNext(1)).toEqual(input({ throttle: 1 }));
    expect(player.readNext(2)).toEqual(input({ throttle: 1 }));
    expect(player.finished).toBe(true);
    expect(player.readNext(3)).toEqual(NEUTRAL_INPUT);
    expect(player.readNext(100)).toEqual(NEUTRAL_INPUT);
  });

  it("flags finished only after the final tick is read", () => {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    rec.record(input({ throttle: 1 }), 1);
    const replay = rec.finalize();
    const player = createPlayer(replay);
    expect(player.finished).toBe(false);
    player.readNext(0);
    expect(player.finished).toBe(false);
    player.readNext(1);
    expect(player.finished).toBe(true);
  });

  it("flags finished immediately for a zero-tick replay", () => {
    const rec = createRecorder(fixedRecorderOpts());
    const replay = rec.finalize();
    const player = createPlayer(replay);
    expect(player.finished).toBe(true);
    expect(player.readNext(0)).toEqual(NEUTRAL_INPUT);
  });

  it("holds inputs steady across long no-change runs", () => {
    // 600 ticks (10 s) of constant throttle. The replay should contain
    // exactly one delta (the initial change from neutral). Playback
    // should still hand out the held input on every queried tick.
    const rec = createRecorder(fixedRecorderOpts());
    for (let i = 0; i < 600; i += 1) {
      rec.record(input({ throttle: 1, steer: 0.25 }), i);
    }
    const replay = rec.finalize();
    expect(replay.deltas).toHaveLength(1);
    const player = createPlayer(replay);
    for (let i = 0; i < 600; i += 1) {
      expect(player.readNext(i)).toEqual(input({ throttle: 1, steer: 0.25 }));
    }
  });
});

// Determinism ------------------------------------------------------------

describe("recorder determinism", () => {
  it("two recorders fed identical sequences produce JSON-equal replays", () => {
    const sequence = makeScriptedSequence();
    const a = createRecorder(fixedRecorderOpts({ seed: 42 }));
    const b = createRecorder(fixedRecorderOpts({ seed: 42 }));
    for (let i = 0; i < sequence.length; i += 1) {
      a.record(sequence[i]!, i);
      b.record(sequence[i]!, i);
    }
    const replayA = a.finalize();
    const replayB = b.finalize();
    expect(JSON.stringify(replayA)).toBe(JSON.stringify(replayB));
  });

  it("two players reading the same replay produce identical streams", () => {
    const sequence = makeScriptedSequence();
    const rec = createRecorder(fixedRecorderOpts({ seed: 42 }));
    for (let i = 0; i < sequence.length; i += 1) rec.record(sequence[i]!, i);
    const replay = rec.finalize();
    const playerA = createPlayer(replay);
    const playerB = createPlayer(replay);
    for (let i = 0; i < sequence.length; i += 1) {
      expect(playerA.readNext(i)).toEqual(playerB.readNext(i));
    }
  });
});

function makeScriptedSequence(): Input[] {
  // A scripted lap-shaped sequence: green-light burst, sustained throttle
  // through curves with steering oscillation, brake into a hairpin, nitro
  // out of it, gear shifts on the straights.
  const out: Input[] = [];
  for (let i = 0; i < 60; i += 1) {
    out.push(input({ throttle: 1 }));
  }
  for (let i = 0; i < 120; i += 1) {
    out.push(input({ throttle: 1, steer: i % 30 < 15 ? 0.5 : -0.5 }));
  }
  for (let i = 0; i < 30; i += 1) {
    out.push(input({ throttle: 0, brake: 1 }));
  }
  out.push(input({ nitro: true, throttle: 1 }));
  for (let i = 0; i < 60; i += 1) {
    out.push(input({ nitro: true, throttle: 1 }));
  }
  out.push(input({ throttle: 1, shiftUp: true }));
  out.push(input({ throttle: 1, shiftUp: false }));
  return out;
}

// Validation -------------------------------------------------------------

describe("createPlayer validation", () => {
  function baseReplay(overrides: Partial<Replay> = {}): Replay {
    const rec = createRecorder(fixedRecorderOpts());
    rec.record(input({ throttle: 1 }), 0);
    rec.record(input({ throttle: 1, steer: 0.25 }), 1);
    return { ...rec.finalize(), ...overrides };
  }

  it("rejects a future format version", () => {
    const replay = baseReplay({ formatVersion: REPLAY_FORMAT_VERSION + 1 });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("format-version-mismatch");
    expect(player.finished).toBe(true);
    expect(player.readNext(0)).toBeNull();
  });

  it("rejects a stale physics version", () => {
    const replay = baseReplay({ physicsVersion: PHYSICS_VERSION + 1 });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("physics-version-mismatch");
    expect(player.readNext(0)).toBeNull();
  });

  it("rejects a fixed-step mismatch", () => {
    const replay = baseReplay({ fixedStepMs: FIXED_STEP_MS / 2 });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("fixed-step-mismatch");
    expect(player.readNext(0)).toBeNull();
  });

  it("rejects a delta with a tick beyond totalTicks", () => {
    const replay = baseReplay({
      deltas: [{ tick: 10, mask: 0b1, values: [0.5] }],
      totalTicks: 2,
    });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects deltas that are not strictly increasing", () => {
    const replay = baseReplay({
      deltas: [
        { tick: 1, mask: 0b1, values: [0.5] },
        { tick: 1, mask: 0b1, values: [0.25] },
      ],
    });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects a delta with mask = 0", () => {
    const replay = baseReplay({
      deltas: [{ tick: 0, mask: 0, values: [] }],
    });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects a delta whose values length disagrees with its mask popcount", () => {
    const replay = baseReplay({
      // Mask has two bits set (steer + throttle) but only one value.
      deltas: [{ tick: 0, mask: 0b11, values: [0.5] }],
    });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects a non-integer totalTicks", () => {
    const replay = baseReplay({ totalTicks: 1.5 });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects a negative totalTicks", () => {
    const replay = baseReplay({ totalTicks: -1 });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects when deltas is not an array", () => {
    const replay = baseReplay({ deltas: undefined as unknown as Replay["deltas"] });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });

  it("rejects a mask out of byte range", () => {
    const replay = baseReplay({
      deltas: [{ tick: 0, mask: 0x100, values: [1] }],
    });
    const player = createPlayer(replay);
    expect(player.mismatchReason).toBe("malformed-replay");
  });
});

// Format constants -------------------------------------------------------

describe("INPUT_FIELDS", () => {
  it("matches the Input shape", () => {
    const sample = NEUTRAL_INPUT;
    for (const key of INPUT_FIELDS) {
      expect(sample).toHaveProperty(key);
    }
    // Reverse: every key in NEUTRAL_INPUT is present in INPUT_FIELDS so
    // the recorder catches every field. A new field added to Input
    // without an INPUT_FIELDS entry would silently be dropped from
    // replays; this assertion is the guard.
    const fieldSet = new Set<string>(INPUT_FIELDS);
    for (const key of Object.keys(sample)) {
      expect(fieldSet.has(key)).toBe(true);
    }
  });

  it("does not exceed the 8-bit mask", () => {
    expect(INPUT_FIELDS.length).toBeLessThanOrEqual(8);
  });
});
