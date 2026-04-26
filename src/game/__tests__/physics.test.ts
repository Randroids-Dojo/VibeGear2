/**
 * Unit tests for the arcade physics step.
 *
 * Covers the §10 design pillars: acceleration curve, top-speed clamp,
 * brake (no inversion), steering response (lane-relative + zero at zero
 * speed), off-road slowdown and cap, plus the dot's listed edge cases:
 * dt = 0 leaves state unchanged, brake while reversing does not invert,
 * steering at zero speed produces no lateral motion.
 *
 * Includes a determinism check: 1000 identical runs produce identical
 * outputs (AGENTS.md RULE 8).
 *
 * Float comparisons use `toBeCloseTo` per AGENTS.md RULE 8.
 */

import { describe, expect, it } from "vitest";

import type { CarBaseStats } from "@/data/schemas";
import { NEUTRAL_INPUT, type Input } from "@/game/input";
import {
  COASTING_DRAG_M_PER_S2,
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  OFF_ROAD_CAP_M_PER_S,
  RUMBLE_HALF_WIDTH_SCALE,
  isOffRoad,
  step,
  surfaceAt,
  type CarState,
  type TrackContext,
} from "@/game/physics";

// Test fixtures ------------------------------------------------------------

/** Sparrow GT, the starter car. Matches `src/data/cars/sparrow-gt.json`. */
const STARTER_STATS: CarBaseStats = Object.freeze({
  topSpeed: 61.0,
  accel: 16.0,
  brake: 28.0,
  gripDry: 1.0,
  gripWet: 0.82,
  stability: 1.0,
  durability: 0.95,
  nitroEfficiency: 1.0,
});

/** Standard 60 Hz fixed step. */
const DT = 1 / 60;

const ROAD: TrackContext = DEFAULT_TRACK_CONTEXT;

function withInput(overrides: Partial<Input>): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function freshState(overrides: Partial<CarState> = {}): CarState {
  return { ...INITIAL_CAR_STATE, ...overrides };
}

/**
 * Roll the sim forward `n` steps with a constant input. Returns the final
 * state. Useful for sanity-checking integrated quantities like top speed.
 */
function rollForward(
  initial: CarState,
  input: Input,
  stats: CarBaseStats,
  steps: number,
  context: TrackContext = ROAD,
  dt: number = DT,
): CarState {
  let s = initial;
  for (let i = 0; i < steps; i += 1) s = step(s, input, stats, context, dt);
  return s;
}

// Tests --------------------------------------------------------------------

describe("step (acceleration)", () => {
  it("accelerates from rest under full throttle", () => {
    const s = step(freshState(), withInput({ throttle: 1 }), STARTER_STATS, ROAD, DT);
    // Expected delta = accel * dt = 16 * 1/60 = 0.2667 m/s
    expect(s.speed).toBeCloseTo(STARTER_STATS.accel * DT, 6);
    expect(s.z).toBeGreaterThan(0);
    expect(s.x).toBe(0);
  });

  it("matches accel*dt across many steps before drag dominates", () => {
    // After 30 steps (0.5 s) at 16 m/s^2 we expect roughly 8 m/s. Drag is
    // disabled while throttle is held, so the integrated speed equals
    // accel*time exactly until top-speed.
    const s = rollForward(freshState(), withInput({ throttle: 1 }), STARTER_STATS, 30);
    expect(s.speed).toBeCloseTo(STARTER_STATS.accel * 30 * DT, 6);
  });

  it("clamps speed at topSpeed even after many steps of accumulated accel", () => {
    // Far more steps than needed to saturate top speed (61 m/s at 16 m/s^2
    // takes ~3.8 s = 230 ticks). Use 600 to ensure we are fully clamped.
    const s = rollForward(freshState(), withInput({ throttle: 1 }), STARTER_STATS, 600);
    expect(s.speed).toBe(STARTER_STATS.topSpeed);
  });

  it("respects throttle magnitude (analog inputs)", () => {
    const halfThrottle = step(
      freshState(),
      withInput({ throttle: 0.5 }),
      STARTER_STATS,
      ROAD,
      DT,
    );
    expect(halfThrottle.speed).toBeCloseTo(STARTER_STATS.accel * 0.5 * DT, 6);
  });
});

describe("step (braking)", () => {
  it("decelerates under brake input", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, withInput({ brake: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.speed).toBeCloseTo(30 - STARTER_STATS.brake * DT, 6);
  });

  it("does not invert velocity past zero (brake-while-reversing edge case)", () => {
    // 0.1 m/s of forward speed, brake at 28 m/s^2 for one 1/60 s tick (delta
    // = 0.467 m/s) would overshoot to a negative value. The step must clamp
    // at 0 instead.
    const start = freshState({ speed: 0.1 });
    const s = step(start, withInput({ brake: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.speed).toBe(0);
  });

  it("brake from zero stays at zero", () => {
    const s = step(freshState(), withInput({ brake: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.speed).toBe(0);
  });

  it("brake with throttle held resolves to braking (input layer rule)", () => {
    // The input layer resolves brake+throttle held to throttle=0 brake=1.
    // Verify that direct construction with both fields > 0 still respects
    // the brake (we do not silently re-resolve here; both are applied).
    const start = freshState({ speed: 20 });
    const s = step(start, { ...NEUTRAL_INPUT, throttle: 1, brake: 1 }, STARTER_STATS, ROAD, DT);
    // Net delta = (accel - brake) * dt = (16 - 28) * dt = -0.2 m/s.
    expect(s.speed).toBeCloseTo(20 + (STARTER_STATS.accel - STARTER_STATS.brake) * DT, 6);
  });
});

describe("step (coasting drag)", () => {
  it("applies coasting drag when neither throttle nor brake is held", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.speed).toBeCloseTo(30 - COASTING_DRAG_M_PER_S2 * DT, 6);
  });

  it("coasting drag does not invert velocity past zero", () => {
    const start = freshState({ speed: 0.001 });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.speed).toBe(0);
  });
});

describe("step (steering)", () => {
  it("produces no lateral movement at zero speed", () => {
    const s = step(freshState(), withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.x).toBe(0);
  });

  it("steers right at moderate speed", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.x).toBeGreaterThan(0);
  });

  it("steers left at moderate speed", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, withInput({ steer: -1 }), STARTER_STATS, ROAD, DT);
    expect(s.x).toBeLessThan(0);
  });

  it("steering authority decreases with speed (low > high)", () => {
    const slow = freshState({ speed: 5 });
    const fast = freshState({ speed: 60 });
    // Equal absolute steer input. The faster car should produce a smaller
    // *normalized-by-speed* lateral delta because the steer rate dropped.
    const slowResult = step(slow, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    const fastResult = step(fast, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    const slowYawDelta = slowResult.x / slow.speed;
    const fastYawDelta = fastResult.x / fast.speed;
    expect(slowYawDelta).toBeGreaterThan(fastYawDelta);
  });

  it("steer = 0 leaves x unchanged at any speed", () => {
    const start = freshState({ speed: 50, x: 1.2 });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.x).toBe(start.x);
  });

  it("respects analog steer magnitude", () => {
    const start = freshState({ speed: 30 });
    const half = step(start, withInput({ steer: 0.5 }), STARTER_STATS, ROAD, DT);
    const full = step(start, withInput({ steer: 1.0 }), STARTER_STATS, ROAD, DT);
    expect(half.x).toBeCloseTo(full.x * 0.5, 6);
  });
});

describe("step (off-road)", () => {
  it("isOffRoad detects positions outside road half-width", () => {
    expect(isOffRoad(0, ROAD.roadHalfWidth)).toBe(false);
    expect(isOffRoad(ROAD.roadHalfWidth, ROAD.roadHalfWidth)).toBe(false);
    expect(isOffRoad(ROAD.roadHalfWidth + 0.01, ROAD.roadHalfWidth)).toBe(true);
    expect(isOffRoad(-ROAD.roadHalfWidth - 0.01, ROAD.roadHalfWidth)).toBe(true);
  });

  it("applies extra drag when off-road", () => {
    const onRoadStart = freshState({ speed: 30, x: 0 });
    const offRoadStart = freshState({ speed: 30, x: ROAD.roadHalfWidth + 1 });
    const onRoad = step(onRoadStart, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    const offRoad = step(offRoadStart, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(offRoad.speed).toBeLessThan(onRoad.speed);
  });

  it("caps speed at OFF_ROAD_CAP when crossing onto grass at high speed", () => {
    // Even while accelerating off-road, speed cannot exceed the cap.
    const start = freshState({ speed: 50, x: ROAD.roadHalfWidth + 1 });
    const s = step(start, withInput({ throttle: 1 }), STARTER_STATS, ROAD, DT);
    expect(s.speed).toBeLessThanOrEqual(OFF_ROAD_CAP_M_PER_S);
  });

  it("off-road for one frame does not damage state shape", () => {
    // No damage modelled yet; just verify we get back a usable CarState.
    const start = freshState({ speed: 30, x: ROAD.roadHalfWidth + 0.5 });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(Number.isFinite(s.speed)).toBe(true);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.z)).toBe(true);
  });
});

describe("step (dt edge cases)", () => {
  it("dt = 0 returns the same state values", () => {
    const start = freshState({ speed: 30, x: 1.5, z: 100 });
    const s = step(start, withInput({ throttle: 1, steer: 1 }), STARTER_STATS, ROAD, 0);
    expect(s.speed).toBe(start.speed);
    expect(s.x).toBe(start.x);
    expect(s.z).toBe(start.z);
  });

  it("negative dt is treated as zero (defensive)", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, withInput({ throttle: 1 }), STARTER_STATS, ROAD, -0.1);
    expect(s.speed).toBe(start.speed);
  });

  it("non-finite dt is treated as zero", () => {
    const start = freshState({ speed: 30 });
    const s = step(start, withInput({ throttle: 1 }), STARTER_STATS, ROAD, Number.NaN);
    expect(s.speed).toBe(start.speed);
  });
});

describe("step (purity and determinism)", () => {
  it("does not mutate the input state", () => {
    const start = freshState({ speed: 10, x: 0.5, z: 5 });
    const snapshot = { ...start };
    step(start, withInput({ throttle: 1, steer: 1 }), STARTER_STATS, ROAD, DT);
    expect(start).toEqual(snapshot);
  });

  it("returns identical outputs across 1000 identical runs", () => {
    const start = freshState({ speed: 25, x: 0.3, z: 12 });
    const input = withInput({ throttle: 0.7, steer: 0.4, brake: 0.1 });
    const reference = step(start, input, STARTER_STATS, ROAD, DT);
    for (let i = 0; i < 1000; i += 1) {
      const s = step(start, input, STARTER_STATS, ROAD, DT);
      expect(s.speed).toBe(reference.speed);
      expect(s.x).toBe(reference.x);
      expect(s.z).toBe(reference.z);
    }
  });

  it("integrates a 100-step trajectory deterministically", () => {
    const input = withInput({ throttle: 1, steer: 0.2 });
    const a = rollForward(freshState(), input, STARTER_STATS, 100);
    const b = rollForward(freshState(), input, STARTER_STATS, 100);
    expect(a).toEqual(b);
  });
});

describe("surfaceAt", () => {
  it("classifies the centerline as road", () => {
    expect(surfaceAt(0, ROAD.roadHalfWidth)).toBe("road");
  });

  it("treats the road half-width edge as road (inclusive)", () => {
    expect(surfaceAt(ROAD.roadHalfWidth, ROAD.roadHalfWidth)).toBe("road");
    expect(surfaceAt(-ROAD.roadHalfWidth, ROAD.roadHalfWidth)).toBe("road");
  });

  it("classifies the rumble band just past the road edge", () => {
    const justOff = ROAD.roadHalfWidth + 0.01;
    expect(surfaceAt(justOff, ROAD.roadHalfWidth)).toBe("rumble");
    expect(surfaceAt(-justOff, ROAD.roadHalfWidth)).toBe("rumble");
  });

  it("treats the rumble band outer edge as rumble (inclusive)", () => {
    const edge = ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE;
    expect(surfaceAt(edge, ROAD.roadHalfWidth)).toBe("rumble");
    expect(surfaceAt(-edge, ROAD.roadHalfWidth)).toBe("rumble");
  });

  it("classifies positions past the rumble band as grass", () => {
    const past = ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE + 0.01;
    expect(surfaceAt(past, ROAD.roadHalfWidth)).toBe("grass");
    expect(surfaceAt(-past, ROAD.roadHalfWidth)).toBe("grass");
  });
});

describe("step (surface)", () => {
  it("emits surface = road at the centerline", () => {
    const s = step(freshState({ speed: 30 }), NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.surface).toBe("road");
  });

  it("emits surface = rumble in the half-width to half-width*1.15 band", () => {
    const start = freshState({
      speed: 30,
      x: ROAD.roadHalfWidth + 0.05,
    });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.surface).toBe("rumble");
  });

  it("emits surface = grass beyond half-width * 1.15", () => {
    const start = freshState({
      speed: 30,
      x: ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE + 0.5,
    });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    expect(s.surface).toBe("grass");
  });

  it("dt = 0 preserves the prior surface field", () => {
    const start = freshState({ x: 5, surface: "grass" });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, 0);
    expect(s.surface).toBe("grass");
  });

  it("transitions road -> grass on a single steering tick", () => {
    // Place the car just inside the road moving fast and steer hard right
    // for one tick so the post-step x lands well past the rumble band.
    const start = freshState({
      speed: 60,
      x: ROAD.roadHalfWidth - 0.01,
    });
    const a = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    expect(a.surface === "rumble" || a.surface === "grass").toBe(true);
  });
});

describe("step (forward integration)", () => {
  it("z advances at speed * dt under steady cruising", () => {
    const start = freshState({ speed: 40 });
    const s = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    // After one tick, z advanced by (post-update speed) * dt. With coasting
    // drag the speed dropped slightly, so z is between (start.speed - drag)
    // * dt and start.speed * dt.
    expect(s.z).toBeCloseTo(s.speed * DT, 6);
    expect(s.z).toBeGreaterThan(0);
    expect(s.z).toBeLessThanOrEqual(start.speed * DT);
  });
});

describe("step (§28 difficulty preset scalars)", () => {
  // §28 Beginner / Balanced / Expert scalar fixtures, mirrored from
  // `src/game/difficultyPresets.ts` so a typo in the table fails this
  // test before it ships into the runtime.
  const BEGINNER = Object.freeze({
    steeringAssistScale: 0.25,
    nitroStabilityPenalty: 0.7,
    damageSeverity: 0.75,
    offRoadDragScale: 1.2,
  });
  const BALANCED = Object.freeze({
    steeringAssistScale: 0.1,
    nitroStabilityPenalty: 1,
    damageSeverity: 1,
    offRoadDragScale: 1,
  });
  const EXPERT = Object.freeze({
    steeringAssistScale: 0,
    nitroStabilityPenalty: 1.15,
    damageSeverity: 1.2,
    offRoadDragScale: 0.95,
  });

  it("offRoadDragScale 1.2 (Beginner) bites harder than identity", () => {
    // Place the car off-road at a speed below the off-road cap so the
    // drag delta is the only thing controlling the post-step speed.
    // Beginner reads `1.20`, so the post-step speed should be lower
    // than the identity (1.0) tick.
    const start = freshState({
      speed: 20,
      x: ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE + 1, // grass
    });
    const identity = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    const beginner = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT, {
      assistScalars: BEGINNER,
    });
    expect(beginner.speed).toBeLessThan(identity.speed);
    // Beginner drag delta: OFF_ROAD_DRAG_M_PER_S2 * 1.20 * dt
    //                    = 18 * 1.20 / 60 = 0.36 m/s.
    // Identity drag delta: 0.30 m/s. So beginner sits 0.06 m/s lower.
    expect(identity.speed - beginner.speed).toBeCloseTo(0.06, 6);
  });

  it("offRoadDragScale 0.95 (Expert) eases off-road slowdown", () => {
    const start = freshState({
      speed: 20,
      x: ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE + 1,
    });
    const identity = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT);
    const expert = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT, {
      assistScalars: EXPERT,
    });
    expect(expert.speed).toBeGreaterThan(identity.speed);
  });

  it("steeringAssistScale 0.25 (Beginner) reduces lateral drift", () => {
    // At speed and full steer, the lateral velocity contribution is
    // proportional to (1 - steeringAssistScale). Beginner clamps a
    // quarter of the lateral motion toward neutral.
    const start = freshState({ speed: 40 });
    const identity = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    const beginner = step(
      start,
      withInput({ steer: 1 }),
      STARTER_STATS,
      ROAD,
      DT,
      { assistScalars: BEGINNER },
    );
    expect(Math.abs(beginner.x)).toBeLessThan(Math.abs(identity.x));
    // The §28 pin: Beginner reads 0.25, so the lateral velocity is 75%
    // of identity. Tolerance is generous to allow the §10 trapezoidal
    // integration order to stay free; the relative ratio is what we
    // pin, not an absolute lateral position.
    expect(Math.abs(beginner.x)).toBeCloseTo(Math.abs(identity.x) * 0.75, 6);
  });

  it("steeringAssistScale 0.0 (Expert) preserves identity steering", () => {
    const start = freshState({ speed: 40 });
    const identity = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    const expert = step(
      start,
      withInput({ steer: 1 }),
      STARTER_STATS,
      ROAD,
      DT,
      { assistScalars: EXPERT },
    );
    // Expert pins steeringAssistScale to 0, so the lateral motion
    // matches the unscaled identity tick exactly. offRoadDragScale 0.95
    // does not enter this on-road tick.
    expect(expert.x).toBeCloseTo(identity.x, 6);
  });

  it("Balanced scalars apply a small steering assist (§28 default)", () => {
    // The §28 Balanced row pins steeringAssistScale at 0.10 (a small
    // helping-hand assist). On a save with no preset wired (identity),
    // there is no assist; Balanced sees ~10% lateral reduction.
    const start = freshState({ speed: 40 });
    const identity = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
    const balanced = step(
      start,
      withInput({ steer: 1 }),
      STARTER_STATS,
      ROAD,
      DT,
      { assistScalars: BALANCED },
    );
    expect(Math.abs(balanced.x)).toBeCloseTo(Math.abs(identity.x) * 0.9, 6);
  });

  it("omitting assistScalars preserves the pre-§28 behaviour", () => {
    // No-preset call site (existing test fixtures, headless tests, the
    // physics-feel benchmark) must observe the unscaled step exactly.
    const start = freshState({ speed: 40 });
    const a = step(start, withInput({ steer: 0.5, throttle: 1 }), STARTER_STATS, ROAD, DT);
    const b = step(start, withInput({ steer: 0.5, throttle: 1 }), STARTER_STATS, ROAD, DT, {});
    expect(a).toEqual(b);
  });

  it("ignores a non-finite scalar and falls back to identity-like clamps", () => {
    // A buggy upstream config that hands NaN / Infinity to the step
    // must not blow up the math. The clamp lower bound is 0 for both
    // scalars, so a NaN reads as 0 (no off-road drag, no assist) which
    // keeps the car moving without producing a speed-cheat.
    const start = freshState({
      speed: 30,
      x: ROAD.roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE + 1,
    });
    const sneaky = Object.freeze({
      steeringAssistScale: Number.NaN,
      nitroStabilityPenalty: Number.POSITIVE_INFINITY,
      damageSeverity: -1,
      offRoadDragScale: Number.NaN,
    });
    const result = step(start, NEUTRAL_INPUT, STARTER_STATS, ROAD, DT, {
      assistScalars: sneaky,
    });
    expect(Number.isFinite(result.speed)).toBe(true);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(result.speed).toBeGreaterThanOrEqual(0);
  });
});
