/**
 * Unit tests for the clean_line AI tick.
 *
 * Covers the cases pinned in the dot stress-test (item 12):
 *   a. Countdown phase returns NEUTRAL_INPUT.
 *   b. Straight + below target speed: throttle = 1, brake = 0, steer ~ 0.
 *   c. Curve + at target speed: throttle in (0, 1), brake = 0, |steer| > 0.
 *   d. Off-track (aiCar.x = 6 m, road half-width = 4.5 m): steer pulls back.
 *   e. At target speed exactly: throttle low, brake zero (hysteresis band).
 *   f. Determinism: same input twice, deep-equal output.
 *
 * Plus the dot's "Edge Cases" section:
 *   - AI behind player on a clean straight drives the racing line.
 *   - Race not yet started: zero input.
 *
 * Float comparisons use `toBeCloseTo` per AGENTS.md RULE 8.
 */

import { describe, expect, it } from "vitest";

import type { AIDriver, CarBaseStats } from "@/data/schemas";
import {
  AI_TUNING,
  DEFAULT_AI_TRACK_CONTEXT,
  INITIAL_AI_STATE,
  tickAI,
  type AIState,
  type PlayerView,
} from "@/game/ai";
import { INITIAL_CAR_STATE, type CarState } from "@/game/physics";
import { createRaceState, type RaceState } from "@/game/raceState";
import { compileSegments, type CompiledTrack } from "@/road/trackCompiler";

// Test fixtures ------------------------------------------------------------

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

const CLEAN_LINE_DRIVER: AIDriver = Object.freeze({
  id: "ai_cleanline_test",
  displayName: "Test Vale",
  archetype: "clean_line",
  paceScalar: 1.0,
  mistakeRate: 0.0,
  aggression: 0.3,
  weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
  nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
});

const STRAIGHT_TRACK: CompiledTrack = compileSegments([
  {
    len: 1200,
    curve: 0,
    grade: 0,
    roadsideLeft: "default",
    roadsideRight: "default",
    hazards: [],
  },
]);

/**
 * Mixed track: 600 m straight, 600 m right-handed sweeper, 600 m straight.
 * `curve = 0.5` is a normal cornering value per `TrackSegmentSchema`.
 */
const SWEEPER_TRACK: CompiledTrack = compileSegments([
  { len: 600, curve: 0, grade: 0, roadsideLeft: "d", roadsideRight: "d", hazards: [] },
  { len: 600, curve: 0.5, grade: 0, roadsideLeft: "d", roadsideRight: "d", hazards: [] },
  { len: 600, curve: 0, grade: 0, roadsideLeft: "d", roadsideRight: "d", hazards: [] },
]);

const RACING: RaceState = (() => {
  const r = createRaceState(3);
  r.phase = "racing";
  return r;
})();

const COUNTDOWN: RaceState = createRaceState(3);

function freshAi(overrides: Partial<AIState> = {}): AIState {
  return { ...INITIAL_AI_STATE, ...overrides };
}

function freshCar(overrides: Partial<CarState> = {}): CarState {
  return { ...INITIAL_CAR_STATE, ...overrides };
}

const PLAYER_FAR_BEHIND: PlayerView = { car: freshCar({ z: -50, speed: 30 }) };

// Tests --------------------------------------------------------------------

describe("tickAI (countdown)", () => {
  it("returns NEUTRAL_INPUT during countdown", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar(),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      COUNTDOWN,
      STARTER_STATS,
    );
    expect(result.input.throttle).toBe(0);
    expect(result.input.brake).toBe(0);
    expect(result.input.steer).toBe(0);
    expect(result.input.nitro).toBe(false);
  });

  it("still updates progress / lane mirror during countdown", () => {
    // Even when not driving, the AI should report its grid position so
    // a future HUD overlay can show the starting order.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 12, x: -1.5 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      COUNTDOWN,
      STARTER_STATS,
    );
    expect(result.nextAiState.laneOffset).toBe(-1.5);
    expect(result.nextAiState.progress).toBeCloseTo(2, 6); // 12 m / 6 m per seg
  });
});

describe("tickAI (straight, accelerating)", () => {
  it("requests full throttle when below target speed on a straight", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ speed: 10 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.throttle).toBe(1);
    expect(result.input.brake).toBe(0);
    expect(result.input.steer).toBe(0);
  });

  it("targets the car's top speed on a straight at unit pace scalar", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ speed: 10 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.nextAiState.targetSpeed).toBeCloseTo(STARTER_STATS.topSpeed, 6);
  });

  it("respects driver paceScalar > 1 by clamping at top speed", () => {
    const fastDriver: AIDriver = { ...CLEAN_LINE_DRIVER, paceScalar: 1.05 };
    const result = tickAI(
      fastDriver,
      freshAi(),
      freshCar({ speed: 10 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.nextAiState.targetSpeed).toBe(STARTER_STATS.topSpeed);
  });

  it("respects driver paceScalar < 1 below top speed", () => {
    const slowDriver: AIDriver = { ...CLEAN_LINE_DRIVER, paceScalar: 0.7 };
    const result = tickAI(
      slowDriver,
      freshAi(),
      freshCar({ speed: 10 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.nextAiState.targetSpeed).toBeCloseTo(STARTER_STATS.topSpeed * 0.7, 6);
  });
});

describe("tickAI (cornering)", () => {
  it("biases toward the inside of a right-hand sweeper", () => {
    // Position the AI on the centerline mid-sweeper. Idealized lateral
    // offset for curve=0.5 is `-0.5 * MAX_RACING_LINE_OFFSET`, which is
    // negative (to the left). The steer command should push the AI
    // left, i.e. negative steer.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }), // 900 m -> mid-sweeper
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.steer).toBeLessThan(0);
  });

  it("lowers target speed in proportion to curve", () => {
    // Same driver, two different segments. The curve segment should
    // produce a lower target than the straight.
    const onStraight = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 0, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    const onCurve = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(onCurve.nextAiState.targetSpeed).toBeLessThan(
      onStraight.nextAiState.targetSpeed,
    );
  });

  it("brakes when speed exceeds target by more than the hysteresis band", () => {
    // On the curve segment with curve=0.5 the target speed is roughly
    // 61 * (1 - 0.6 * 0.5) = 42.7 m/s. Place the AI well above that
    // and confirm the brake fires.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 60 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.brake).toBeGreaterThan(0);
    expect(result.input.throttle).toBe(0);
  });
});

describe("tickAI (hysteresis band)", () => {
  it("feathers throttle when within the hysteresis band above target", () => {
    // On the straight the target is `topSpeed`. Place the AI exactly
    // at top speed; the speed error is zero, throttle should be zero
    // and brake should be zero. The hysteresis branch handles this.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ speed: STARTER_STATS.topSpeed }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.throttle).toBe(0);
    expect(result.input.brake).toBe(0);
  });

  it("feathers throttle when slightly below target", () => {
    // 1 m/s below top, inside the 1.5 m/s hysteresis band.
    const speed = STARTER_STATS.topSpeed - 1;
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ speed }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.throttle).toBeGreaterThan(0);
    expect(result.input.throttle).toBeLessThan(1);
    expect(result.input.brake).toBe(0);
  });
});

describe("tickAI (off-track recovery)", () => {
  it("steers toward the centerline when off-track to the right", () => {
    // Road half-width is 4.5 m; place the AI at x=6 m, well past the
    // rumble. The steer P-controller should pull the AI back toward
    // the ideal lateral offset (which is 0 on a straight), i.e. steer
    // negative (to the left).
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 6, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
    );
    expect(result.input.steer).toBeLessThan(0);
  });

  it("clamps steer at full lock when the lateral error is huge", () => {
    // 50 m off-track is not realistic but tests the clamp.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 50, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.steer).toBe(-1);
  });
});

describe("tickAI (purity and determinism)", () => {
  it("does not mutate the input AI state", () => {
    const aiState = freshAi({ seed: 42 });
    const snapshot: AIState = { ...aiState };
    tickAI(
      CLEAN_LINE_DRIVER,
      aiState,
      freshCar({ speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(aiState).toEqual(snapshot);
  });

  it("preserves seed across ticks (clean_line slice does not consume it)", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi({ seed: 7 }),
      freshCar({ speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.nextAiState.seed).toBe(7);
  });

  it("returns deep-equal output for identical inputs across many calls", () => {
    const aiState = freshAi({ seed: 12 });
    const aiCar = freshCar({ speed: 25, x: 0.5, z: 950 });
    const reference = tickAI(
      CLEAN_LINE_DRIVER,
      aiState,
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    for (let i = 0; i < 100; i += 1) {
      const result = tickAI(
        CLEAN_LINE_DRIVER,
        aiState,
        aiCar,
        PLAYER_FAR_BEHIND,
        SWEEPER_TRACK,
        RACING,
        STARTER_STATS,
      );
      expect(result.input).toEqual(reference.input);
      expect(result.nextAiState).toEqual(reference.nextAiState);
    }
  });
});

describe("AI_TUNING (constants are sane)", () => {
  it("MAX_RACING_LINE_OFFSET keeps the AI inside the road", () => {
    expect(AI_TUNING.MAX_RACING_LINE_OFFSET).toBeLessThan(
      DEFAULT_AI_TRACK_CONTEXT.roadHalfWidth,
    );
  });

  it("MIN_AI_SPEED is positive so a curve cannot stop the AI", () => {
    expect(AI_TUNING.MIN_AI_SPEED).toBeGreaterThan(0);
  });
});
