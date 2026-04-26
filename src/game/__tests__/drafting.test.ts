/**
 * Unit tests for `src/game/drafting.ts`.
 *
 * Covers the §10 "Drafting" rules and the dot's verify items:
 * - In-wake / out-of-wake geometric checks.
 * - Speed-threshold gate (no draft below `DRAFT_MIN_SPEED_M_PER_S`).
 * - Brake-input break (resets the window instantly).
 * - Side-step break (lateral offset past `DRAFT_LATERAL_BREAK_M`).
 * - 0.6 s engagement window before any bonus is applied.
 * - Determinism: identical inputs produce deep-equal outputs.
 *
 * Plus a small integration check that confirms the physics step honours
 * `options.draftBonus` so the producer / consumer wiring is exercised
 * end to end.
 */

import { describe, expect, it } from "vitest";

import type { CarBaseStats } from "@/data/schemas";
import {
  DRAFT_BONUS_MAX,
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
} from "@/game/physics";
import { NEUTRAL_INPUT } from "@/game/input";

import {
  DRAFT_ENGAGE_MS,
  DRAFT_LATERAL_BREAK_M,
  DRAFT_LATERAL_TOLERANCE_M,
  DRAFT_LONGITUDINAL_GAP_M,
  DRAFT_MAX_ACCEL_MULTIPLIER,
  DRAFT_MIN_SPEED_M_PER_S,
  DRAFT_RAMP_MS,
  INITIAL_DRAFT_WINDOW,
  computeWakeOffset,
  multiplierForEngagedMs,
  tickDraftWindow,
  type DraftCarSnapshot,
  type DraftTickInputs,
  type DraftWindowState,
} from "../drafting";

const DT = 1 / 60;
const FAST_SPEED = 60;
const SLOW_SPEED = DRAFT_MIN_SPEED_M_PER_S - 1;

const STARTER_STATS: CarBaseStats = Object.freeze({
  topSpeed: 200,
  accel: 16,
  brake: 28,
  gripDry: 1.0,
  gripWet: 0.82,
  stability: 1.0,
  durability: 0.95,
  nitroEfficiency: 1.0,
});

function leader(over: Partial<DraftCarSnapshot> = {}): DraftCarSnapshot {
  return { x: 0, progress: 100, ...over };
}

function follower(over: Partial<DraftCarSnapshot> = {}): DraftCarSnapshot {
  return { x: 0, progress: 99, ...over };
}

function inputs(over: Partial<DraftTickInputs> = {}): DraftTickInputs {
  return { brake: false, followerSpeed: FAST_SPEED, ...over };
}

function rollWindow(
  initial: DraftWindowState,
  ticks: number,
  cfg: { wakeInWake?: boolean; brake?: boolean; followerSpeed?: number; dt?: number } = {},
): DraftWindowState {
  let s: DraftWindowState = initial;
  const wake = cfg.wakeInWake === false
    ? computeWakeOffset(leader(), follower({ x: DRAFT_LATERAL_BREAK_M + 1 }))
    : computeWakeOffset(leader(), follower());
  const i = inputs({
    brake: cfg.brake ?? false,
    followerSpeed: cfg.followerSpeed ?? FAST_SPEED,
  });
  for (let n = 0; n < ticks; n += 1) s = tickDraftWindow(s, wake, i, cfg.dt ?? DT);
  return s;
}

// computeWakeOffset ---------------------------------------------------------

describe("computeWakeOffset", () => {
  it("returns inWake true and ageMs 0 for the dot's pinned example", () => {
    // Verify item 1: computeWakeOffset({ x: 0, progress: 100 },
    // { x: 0.1, progress: 99 }) returns { inWake: true, ageMs: 0 }.
    const result = computeWakeOffset(leader({ x: 0, progress: 100 }), follower({ x: 0.1, progress: 99 }));
    expect(result.inWake).toBe(true);
    expect(result.ageMs).toBe(0);
  });

  it("returns inWake true at zero lateral offset directly behind", () => {
    const r = computeWakeOffset(leader(), follower({ x: 0, progress: 90 }));
    expect(r.inWake).toBe(true);
    expect(r.lateralOffset).toBe(0);
    expect(r.longitudinalGap).toBe(10);
  });

  it("returns inWake true when lateral offset is within tolerance", () => {
    const r = computeWakeOffset(leader(), follower({ x: DRAFT_LATERAL_TOLERANCE_M, progress: 95 }));
    expect(r.inWake).toBe(true);
  });

  it("returns inWake false when lateral offset exceeds break threshold", () => {
    const r = computeWakeOffset(leader(), follower({ x: DRAFT_LATERAL_BREAK_M + 0.01, progress: 95 }));
    expect(r.inWake).toBe(false);
  });

  it("returns inWake false when follower is ahead of leader", () => {
    const r = computeWakeOffset(leader(), follower({ x: 0, progress: 110 }));
    expect(r.inWake).toBe(false);
    expect(r.longitudinalGap).toBe(-10);
  });

  it("returns inWake false when follower equals leader on progress (no wake yet)", () => {
    const r = computeWakeOffset(leader(), follower({ x: 0, progress: 100 }));
    expect(r.inWake).toBe(false);
  });

  it("returns inWake false beyond the longitudinal gap", () => {
    const r = computeWakeOffset(
      leader(),
      follower({ x: 0, progress: 100 - (DRAFT_LONGITUDINAL_GAP_M + 0.1) }),
    );
    expect(r.inWake).toBe(false);
  });

  it("treats the longitudinal gap edge as in-wake (inclusive)", () => {
    const r = computeWakeOffset(
      leader(),
      follower({ x: 0, progress: 100 - DRAFT_LONGITUDINAL_GAP_M }),
    );
    expect(r.inWake).toBe(true);
  });

  it("computes lateralOffset as absolute regardless of side", () => {
    const left = computeWakeOffset(leader(), follower({ x: -0.5, progress: 95 }));
    const right = computeWakeOffset(leader(), follower({ x: 0.5, progress: 95 }));
    expect(left.lateralOffset).toBe(0.5);
    expect(right.lateralOffset).toBe(0.5);
  });
});

// tickDraftWindow -----------------------------------------------------------

describe("tickDraftWindow (engagement window)", () => {
  it("starts with multiplier 1.0 and engagedMs 0", () => {
    expect(INITIAL_DRAFT_WINDOW.engagedMs).toBe(0);
    expect(INITIAL_DRAFT_WINDOW.accelMultiplier).toBe(1);
  });

  it("multiplier stays at 1.0 until engagedMs reaches DRAFT_ENGAGE_MS", () => {
    // 0.6 s = 36 ticks at 60 Hz. At 35 ticks we are still under the threshold.
    const s = rollWindow(INITIAL_DRAFT_WINDOW, 35);
    expect(s.engagedMs).toBeLessThan(DRAFT_ENGAGE_MS);
    expect(s.accelMultiplier).toBe(1);
  });

  it("multiplier > 1.0 after 600 ms continuous in-wake (verify item 2)", () => {
    // 37 ticks * 1/60 s = 616.6 ms, just past the 600 ms engagement
    // threshold. The ramp has begun, so multiplier > 1.
    const s = rollWindow(INITIAL_DRAFT_WINDOW, 37);
    expect(s.engagedMs).toBeGreaterThan(DRAFT_ENGAGE_MS);
    expect(s.accelMultiplier).toBeGreaterThan(1);
  });

  it("multiplier saturates at DRAFT_MAX_ACCEL_MULTIPLIER after the full ramp", () => {
    // engagedMs at end-of-ramp = DRAFT_ENGAGE_MS + DRAFT_RAMP_MS = 1000 ms.
    const ticks = Math.ceil(((DRAFT_ENGAGE_MS + DRAFT_RAMP_MS) / 1000) / DT) + 5;
    const s = rollWindow(INITIAL_DRAFT_WINDOW, ticks);
    expect(s.accelMultiplier).toBe(DRAFT_MAX_ACCEL_MULTIPLIER);
  });

  it("multiplier ramps linearly between engage and full thresholds", () => {
    const halfRampMs = DRAFT_ENGAGE_MS + DRAFT_RAMP_MS / 2;
    const expected = 1 + 0.5 * (DRAFT_MAX_ACCEL_MULTIPLIER - 1);
    expect(multiplierForEngagedMs(halfRampMs)).toBeCloseTo(expected, 6);
  });

  it("multiplierForEngagedMs returns 1.0 below the engage threshold", () => {
    expect(multiplierForEngagedMs(0)).toBe(1);
    expect(multiplierForEngagedMs(DRAFT_ENGAGE_MS - 0.001)).toBe(1);
  });

  it("multiplierForEngagedMs returns max past the end of the ramp", () => {
    expect(multiplierForEngagedMs(DRAFT_ENGAGE_MS + DRAFT_RAMP_MS + 1000)).toBe(
      DRAFT_MAX_ACCEL_MULTIPLIER,
    );
  });

  it("multiplierForEngagedMs handles non-finite gracefully", () => {
    expect(multiplierForEngagedMs(Number.NaN)).toBe(1);
  });
});

describe("tickDraftWindow (break conditions)", () => {
  it("resets when the wake geometric check returns false", () => {
    const engaged = rollWindow(INITIAL_DRAFT_WINDOW, 60);
    expect(engaged.accelMultiplier).toBeGreaterThan(1);
    const reset = rollWindow(engaged, 1, { wakeInWake: false });
    expect(reset.engagedMs).toBe(0);
    expect(reset.accelMultiplier).toBe(1);
  });

  it("brake input resets the window instantly (verify item 3)", () => {
    const engaged = rollWindow(INITIAL_DRAFT_WINDOW, 60);
    expect(engaged.engagedMs).toBeGreaterThan(0);
    const after = tickDraftWindow(
      engaged,
      computeWakeOffset(leader(), follower()),
      inputs({ brake: true }),
      DT,
    );
    expect(after.engagedMs).toBe(0);
    expect(after.accelMultiplier).toBe(1);
  });

  it("lateral offset > DRAFT_LATERAL_BREAK_M breaks the window (verify item 4)", () => {
    const engaged = rollWindow(INITIAL_DRAFT_WINDOW, 60);
    const wake = computeWakeOffset(leader(), follower({ x: DRAFT_LATERAL_BREAK_M + 0.01 }));
    const after = tickDraftWindow(engaged, wake, inputs(), DT);
    expect(after.engagedMs).toBe(0);
    expect(after.accelMultiplier).toBe(1);
  });

  it("speed below threshold returns multiplier 1.0 (verify item 5)", () => {
    // SLOW_SPEED < DRAFT_MIN_SPEED_M_PER_S, so even with perfect geometry
    // the window cannot accumulate.
    const s = rollWindow(INITIAL_DRAFT_WINDOW, 60, { followerSpeed: SLOW_SPEED });
    expect(s.engagedMs).toBe(0);
    expect(s.accelMultiplier).toBe(1);
  });

  it("intermittent wake never accumulates past the engage threshold", () => {
    // Pulse: in-wake one tick, out the next. After many cycles the window
    // never sees the 36 consecutive ticks needed for engagement.
    let s: DraftWindowState = INITIAL_DRAFT_WINDOW;
    const onWake = computeWakeOffset(leader(), follower());
    const offWake = computeWakeOffset(leader(), follower({ x: DRAFT_LATERAL_BREAK_M + 1 }));
    for (let i = 0; i < 200; i += 1) {
      s = tickDraftWindow(s, i % 2 === 0 ? onWake : offWake, inputs(), DT);
    }
    expect(s.accelMultiplier).toBe(1);
  });

  it("re-engagement requires a fresh full window (no carry-over after break)", () => {
    const engaged = rollWindow(INITIAL_DRAFT_WINDOW, 80);
    const broken = rollWindow(engaged, 1, { brake: true });
    expect(broken.engagedMs).toBe(0);
    // 5 ticks back in-wake should not be enough; multiplier is still 1.
    const partial = rollWindow(broken, 5);
    expect(partial.accelMultiplier).toBe(1);
  });
});

describe("tickDraftWindow (dt edge cases)", () => {
  it("dt = 0 leaves state unchanged", () => {
    const start: DraftWindowState = { engagedMs: 200, accelMultiplier: 1 };
    const r = tickDraftWindow(start, computeWakeOffset(leader(), follower()), inputs(), 0);
    expect(r).toEqual(start);
  });

  it("negative dt leaves state unchanged", () => {
    const start: DraftWindowState = { engagedMs: 200, accelMultiplier: 1 };
    const r = tickDraftWindow(start, computeWakeOffset(leader(), follower()), inputs(), -1);
    expect(r).toEqual(start);
  });

  it("non-finite dt leaves state unchanged", () => {
    const start: DraftWindowState = { engagedMs: 200, accelMultiplier: 1 };
    const r = tickDraftWindow(start, computeWakeOffset(leader(), follower()), inputs(), Number.NaN);
    expect(r).toEqual(start);
  });
});

describe("tickDraftWindow (purity and determinism)", () => {
  it("does not mutate the input state", () => {
    const start: DraftWindowState = { engagedMs: 100, accelMultiplier: 1 };
    const snapshot = { ...start };
    tickDraftWindow(start, computeWakeOffset(leader(), follower()), inputs(), DT);
    expect(start).toEqual(snapshot);
  });

  it("returns identical outputs across 1000 identical runs (determinism)", () => {
    const wake = computeWakeOffset(leader(), follower());
    const i = inputs();
    const start: DraftWindowState = { engagedMs: 250, accelMultiplier: 1 };
    const reference = tickDraftWindow(start, wake, i, DT);
    for (let n = 0; n < 1000; n += 1) {
      const r = tickDraftWindow(start, wake, i, DT);
      expect(r).toEqual(reference);
    }
  });

  it("integrating a 100-tick trajectory produces the same trajectory twice", () => {
    const a = rollWindow(INITIAL_DRAFT_WINDOW, 100);
    const b = rollWindow(INITIAL_DRAFT_WINDOW, 100);
    expect(a).toEqual(b);
  });
});

// physics.step integration (draftBonus producer / consumer wiring) ---------

describe("physics.step (draftBonus integration)", () => {
  const ROAD = DEFAULT_TRACK_CONTEXT;

  it("default draftBonus = 1 produces unchanged acceleration", () => {
    const start = { ...INITIAL_CAR_STATE, speed: 30 };
    const baseline = step(start, { ...NEUTRAL_INPUT, throttle: 1 }, STARTER_STATS, ROAD, DT);
    const explicitOne = step(
      start,
      { ...NEUTRAL_INPUT, throttle: 1 },
      STARTER_STATS,
      ROAD,
      DT,
      { draftBonus: 1 },
    );
    expect(explicitOne.speed).toBe(baseline.speed);
  });

  it("draftBonus > 1 increases per-tick acceleration", () => {
    const start = { ...INITIAL_CAR_STATE, speed: 30 };
    const baseline = step(start, { ...NEUTRAL_INPUT, throttle: 1 }, STARTER_STATS, ROAD, DT);
    const drafted = step(
      start,
      { ...NEUTRAL_INPUT, throttle: 1 },
      STARTER_STATS,
      ROAD,
      DT,
      { draftBonus: DRAFT_MAX_ACCEL_MULTIPLIER },
    );
    expect(drafted.speed).toBeGreaterThan(baseline.speed);
    expect(drafted.speed - 30).toBeCloseTo((baseline.speed - 30) * DRAFT_MAX_ACCEL_MULTIPLIER, 6);
  });

  it("draftBonus is clamped to [1, DRAFT_BONUS_MAX]", () => {
    const start = { ...INITIAL_CAR_STATE, speed: 30 };
    const lowBound = step(
      start,
      { ...NEUTRAL_INPUT, throttle: 1 },
      STARTER_STATS,
      ROAD,
      DT,
      { draftBonus: 0.1 },
    );
    const baseline = step(start, { ...NEUTRAL_INPUT, throttle: 1 }, STARTER_STATS, ROAD, DT);
    expect(lowBound.speed).toBe(baseline.speed);

    const highBound = step(
      start,
      { ...NEUTRAL_INPUT, throttle: 1 },
      STARTER_STATS,
      ROAD,
      DT,
      { draftBonus: 10 },
    );
    const capped = step(
      start,
      { ...NEUTRAL_INPUT, throttle: 1 },
      STARTER_STATS,
      ROAD,
      DT,
      { draftBonus: DRAFT_BONUS_MAX },
    );
    expect(highBound.speed).toBe(capped.speed);
  });

  it("draftBonus does not affect coasting (throttle = 0)", () => {
    const start = { ...INITIAL_CAR_STATE, speed: 30 };
    const drafted = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT, {
      draftBonus: DRAFT_MAX_ACCEL_MULTIPLIER,
    });
    const baseline = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(drafted.speed).toBe(baseline.speed);
  });
});
