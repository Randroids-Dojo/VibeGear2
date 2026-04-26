/**
 * Unit tests for the §6 Time Trial recorder lifecycle orchestrator
 * in `src/game/timeTrial.ts`.
 *
 * Coverage map (mirrors the F-023 dot stress-test):
 *
 *   - `observe` is a no-op during the countdown phase. The recorder
 *     does not spawn until the first racing tick lands so the inner
 *     recorder's tick clock lines up with the race-session `tick`
 *     clock (which resets to 0 on the green-light tick).
 *   - The first racing tick spawns the recorder and records the input.
 *   - Every subsequent racing tick records its input.
 *   - The phase flip to `finished` finalises the recorder and exposes
 *     the replay via `getReplay`. The `onFinalize` callback fires
 *     exactly once with the same replay.
 *   - Ticks observed after `finished` are no-ops (no error, no
 *     mutation).
 *   - `reset()` returns the orchestrator to `idle` and lets a
 *     subsequent race spawn a fresh recorder + replay.
 *   - `applyTimeTrialResult` defers to `bestGhostFor`: a strictly
 *     faster replay overwrites the stored PB; an equal-or-slower
 *     replay does not; a missing stored PB accepts the candidate; a
 *     missing candidate keeps the stored PB.
 *   - Defensive guards: a duplicate-tick observe is a no-op rather
 *     than a thrown error from the inner recorder; an `onFinalize`
 *     that throws does not crash the simulation tick.
 *
 * The tests do not stand up a `RaceSessionState` or a track. The
 * orchestrator reads only `phase`, `tick`, and `input` from the
 * tick context; a synthetic transition table covers every path.
 */

import { describe, expect, it, vi } from "vitest";

import { NEUTRAL_INPUT, type Input } from "../input";
import {
  applyTimeTrialResult,
  createTimeTrialRecorder,
  type TimeTrialRecorderOptions,
  type TimeTrialTickContext,
} from "../timeTrial";
import { type Replay } from "../ghost";
import type { RacePhase } from "../raceState";

// Helpers ----------------------------------------------------------------

function input(overrides: Partial<Input> = {}): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function tick(
  phase: RacePhase,
  tickIndex: number,
  inputOverrides: Partial<Input> = {},
): TimeTrialTickContext {
  return { phase, tick: tickIndex, input: input(inputOverrides) };
}

function fixedOptions(
  overrides: Partial<TimeTrialRecorderOptions> = {},
): TimeTrialRecorderOptions {
  return {
    trackId: overrides.trackId ?? "test-track",
    trackVersion: overrides.trackVersion ?? 1,
    carId: overrides.carId ?? "sparrow-gt",
    seed: overrides.seed ?? 0xdeadbeef,
    onSoftCap: overrides.onSoftCap,
    onFinalize: overrides.onFinalize,
  };
}

// Lifecycle --------------------------------------------------------------

describe("createTimeTrialRecorder", () => {
  it("starts in the idle phase with no recorded ticks and no replay", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    expect(orch.phase).toBe("idle");
    expect(orch.recordedTicks).toBe(0);
    expect(orch.truncated).toBe(false);
    expect(orch.getReplay()).toBeNull();
  });

  it("ignores countdown ticks and stays idle", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    expect(orch.observe(tick("countdown", 0))).toBe(false);
    expect(orch.observe(tick("countdown", 1))).toBe(false);
    expect(orch.observe(tick("countdown", 2))).toBe(false);
    expect(orch.phase).toBe("idle");
    expect(orch.recordedTicks).toBe(0);
    expect(orch.getReplay()).toBeNull();
  });

  it("spawns the recorder on the first racing tick and records the input", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    expect(orch.observe(tick("racing", 0, { throttle: 1 }))).toBe(true);
    expect(orch.phase).toBe("recording");
    expect(orch.recordedTicks).toBe(1);
    // Replay is not exposed until finalise; mid-race reads return null.
    expect(orch.getReplay()).toBeNull();
  });

  it("records every subsequent racing tick in tick order", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("racing", 1, { throttle: 1, steer: 0.5 }));
    orch.observe(tick("racing", 2, { throttle: 1, steer: 0.5 }));
    orch.observe(tick("racing", 3, { throttle: 0.5, steer: 0.25 }));
    expect(orch.recordedTicks).toBe(4);
  });

  it("finalises the recorder when the race phase flips to finished", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("racing", 1, { throttle: 1, steer: 0.5 }));
    orch.observe(tick("racing", 2, { throttle: 1, steer: 0.5 }));
    expect(orch.observe(tick("finished", 3))).toBe(true);
    expect(orch.phase).toBe("finished");
    const replay = orch.getReplay();
    expect(replay).not.toBeNull();
    expect(replay!.totalTicks).toBe(3);
    // Two distinct deltas (the steady-input second and third ticks
    // collapse into the prior delta).
    expect(replay!.deltas).toHaveLength(2);
    expect(replay!.trackId).toBe("test-track");
    expect(replay!.carId).toBe("sparrow-gt");
  });

  it("fires onFinalize exactly once with the finalised replay", () => {
    const onFinalize = vi.fn();
    const orch = createTimeTrialRecorder(fixedOptions({ onFinalize }));
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("racing", 1, { throttle: 1 }));
    orch.observe(tick("finished", 2));
    expect(onFinalize).toHaveBeenCalledTimes(1);
    const passedReplay = onFinalize.mock.calls[0]![0] as Replay;
    expect(passedReplay).toBe(orch.getReplay());
    expect(passedReplay.totalTicks).toBe(2);
  });

  it("ignores observes after finished without throwing", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("finished", 1));
    const replayBefore = orch.getReplay();
    expect(orch.observe(tick("racing", 2, { throttle: 1 }))).toBe(false);
    expect(orch.observe(tick("finished", 3))).toBe(false);
    expect(orch.observe(tick("countdown", 4))).toBe(false);
    expect(orch.phase).toBe("finished");
    expect(orch.getReplay()).toBe(replayBefore);
  });

  it("does not finalise twice on a duplicate finished observe", () => {
    const onFinalize = vi.fn();
    const orch = createTimeTrialRecorder(fixedOptions({ onFinalize }));
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("finished", 1));
    orch.observe(tick("finished", 2));
    orch.observe(tick("finished", 3));
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate or non-increasing tick during recording", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("racing", 1, { throttle: 1, steer: 0.25 }));
    // Duplicate tick 1: orchestrator swallows it without throwing.
    expect(orch.observe(tick("racing", 1, { throttle: 1, steer: 0.5 }))).toBe(
      false,
    );
    // Backwards tick: same.
    expect(orch.observe(tick("racing", 0, { throttle: 1 }))).toBe(false);
    expect(orch.recordedTicks).toBe(2);
  });

  it("swallows onFinalize callback errors so the simulation tick does not crash", () => {
    const onFinalize = vi.fn(() => {
      throw new Error("save backend exploded");
    });
    const orch = createTimeTrialRecorder(fixedOptions({ onFinalize }));
    orch.observe(tick("racing", 0, { throttle: 1 }));
    expect(() => orch.observe(tick("finished", 1))).not.toThrow();
    expect(orch.phase).toBe("finished");
    // The replay is still readable; the failed callback did not destroy it.
    expect(orch.getReplay()).not.toBeNull();
  });

  it("reset returns the orchestrator to idle and lets a new race record afresh", () => {
    const orch = createTimeTrialRecorder(fixedOptions());
    orch.observe(tick("racing", 0, { throttle: 1 }));
    orch.observe(tick("racing", 1, { throttle: 1 }));
    orch.observe(tick("finished", 2));
    expect(orch.phase).toBe("finished");
    orch.reset();
    expect(orch.phase).toBe("idle");
    expect(orch.getReplay()).toBeNull();
    expect(orch.recordedTicks).toBe(0);
    // Subsequent race records cleanly.
    orch.observe(tick("racing", 0, { throttle: 1 }));
    expect(orch.phase).toBe("recording");
    expect(orch.recordedTicks).toBe(1);
    orch.observe(tick("finished", 1));
    expect(orch.phase).toBe("finished");
    expect(orch.getReplay()!.totalTicks).toBe(1);
  });

  it("a finished event without any prior racing ticks stays in idle", () => {
    // Defensive: the race-session reducer never flips countdown -> finished
    // without an intervening racing phase, but the orchestrator must not
    // throw if a future caller wires it that way.
    const orch = createTimeTrialRecorder(fixedOptions());
    expect(orch.observe(tick("countdown", 0))).toBe(false);
    // The orchestrator's `finished` branch returns `true` (it ran the
    // finalise path) but the inner recorder is null so nothing is
    // produced; phase stays idle.
    orch.observe(tick("finished", 1));
    expect(orch.phase).toBe("idle");
    expect(orch.getReplay()).toBeNull();
  });
});

// PB selection -----------------------------------------------------------

describe("applyTimeTrialResult", () => {
  function makeReplay(finalTimeMs: number): Replay {
    // The selector reads `finalTimeMs` only; the rest of the fields can
    // be stub values for these tests.
    return {
      formatVersion: 1,
      physicsVersion: 1,
      fixedStepMs: 1000 / 60,
      trackId: "test-track",
      trackVersion: 1,
      carId: "sparrow-gt",
      seed: 0,
      totalTicks: Math.round(finalTimeMs * 60 / 1000),
      finalTimeMs,
      truncated: false,
      deltas: [],
    };
  }

  it("returns the candidate when no PB is stored", () => {
    const candidate = makeReplay(60_000);
    expect(applyTimeTrialResult(null, candidate)).toBe(candidate);
    expect(applyTimeTrialResult(undefined, candidate)).toBe(candidate);
  });

  it("returns the candidate when it is strictly faster than the stored PB", () => {
    const stored = makeReplay(60_000);
    const candidate = makeReplay(59_000);
    expect(applyTimeTrialResult(stored, candidate)).toBe(candidate);
  });

  it("keeps the stored PB when the candidate is slower", () => {
    const stored = makeReplay(59_000);
    const candidate = makeReplay(60_000);
    expect(applyTimeTrialResult(stored, candidate)).toBe(stored);
  });

  it("keeps the stored PB on a tie so the cross-tab storage event does not churn", () => {
    const stored = makeReplay(60_000);
    const candidate = makeReplay(60_000);
    expect(applyTimeTrialResult(stored, candidate)).toBe(stored);
  });

  it("keeps the stored PB when the candidate is null or undefined", () => {
    const stored = makeReplay(60_000);
    expect(applyTimeTrialResult(stored, null)).toBe(stored);
    expect(applyTimeTrialResult(stored, undefined)).toBe(stored);
  });

  it("returns null when both arguments are null", () => {
    expect(applyTimeTrialResult(null, null)).toBeNull();
  });
});

// Integration: orchestrator + applyTimeTrialResult ----------------------

describe("orchestrator + applyTimeTrialResult", () => {
  it("a faster lap replaces the stored PB; a subsequent slower lap does not", () => {
    // First race: no stored PB, the orchestrator's replay becomes the PB.
    const fast = createTimeTrialRecorder(fixedOptions());
    fast.observe(tick("racing", 0, { throttle: 1 }));
    fast.observe(tick("racing", 1, { throttle: 1 }));
    fast.observe(tick("racing", 2, { throttle: 1 }));
    fast.observe(tick("finished", 3));
    const fastReplay = fast.getReplay()!;
    let storedPb: Replay | null = applyTimeTrialResult(null, fastReplay);
    expect(storedPb).toBe(fastReplay);

    // Second race: a longer recording so the candidate is strictly slower
    // than the stored PB. The orchestrator's `finalTimeMs` derives from
    // `totalTicks * FIXED_STEP_MS`, so a longer tick stream is a slower
    // race time.
    const slow = createTimeTrialRecorder(fixedOptions());
    slow.observe(tick("racing", 0, { throttle: 1 }));
    slow.observe(tick("racing", 1, { throttle: 1 }));
    slow.observe(tick("racing", 2, { throttle: 1 }));
    slow.observe(tick("racing", 3, { throttle: 1 }));
    slow.observe(tick("racing", 4, { throttle: 1 }));
    slow.observe(tick("finished", 5));
    const slowReplay = slow.getReplay()!;
    expect(slowReplay.finalTimeMs).toBeGreaterThan(fastReplay.finalTimeMs);
    storedPb = applyTimeTrialResult(storedPb, slowReplay);
    expect(storedPb).toBe(fastReplay);

    // Third race: a shorter recording is strictly faster, replaces the PB.
    const faster = createTimeTrialRecorder(fixedOptions());
    faster.observe(tick("racing", 0, { throttle: 1 }));
    faster.observe(tick("racing", 1, { throttle: 1 }));
    faster.observe(tick("finished", 2));
    const fasterReplay = faster.getReplay()!;
    expect(fasterReplay.finalTimeMs).toBeLessThan(fastReplay.finalTimeMs);
    storedPb = applyTimeTrialResult(storedPb, fasterReplay);
    expect(storedPb).toBe(fasterReplay);
  });
});
