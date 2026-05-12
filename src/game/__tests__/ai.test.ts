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
  IDENTITY_CPU_MODIFIERS,
  INITIAL_AI_STATE,
  tickAI,
  type AIState,
  type PlayerView,
} from "@/game/ai";
import {
  AI_ARCHETYPE_BEHAVIOURS,
  AI_ARCHETYPE_ORDER,
} from "@/game/aiArchetypes";
import {
  getCpuModifiers,
  type CpuDifficultyModifiers,
} from "@/game/aiDifficulty";
import { INITIAL_CAR_STATE, type CarState } from "@/game/physics";
import { createRaceState, type RaceState } from "@/game/raceState";
import { compileSegments, type CompiledSegmentBuffer } from "@/road/trackCompiler";

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

const STRAIGHT_TRACK: CompiledSegmentBuffer = compileSegments([
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
const SWEEPER_TRACK: CompiledSegmentBuffer = compileSegments([
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

function archetypeDriver(
  archetype: AIDriver["archetype"],
  overrides: Partial<AIDriver> = {},
): AIDriver {
  return {
    ...CLEAN_LINE_DRIVER,
    id: `ai_${archetype}_test`,
    displayName: `${archetype} test`,
    archetype,
    ...overrides,
  };
}

// Tests --------------------------------------------------------------------

describe("AI_ARCHETYPE_BEHAVIOURS", () => {
  it("covers every §15 archetype slot in stable order", () => {
    expect(AI_ARCHETYPE_ORDER).toEqual([
      "nitro_burst",
      "clean_line",
      "aggressive",
      "defender",
      "wet_specialist",
      "endurance",
    ]);
    expect(
      AI_ARCHETYPE_ORDER.map((id) => AI_ARCHETYPE_BEHAVIOURS[id].gddName),
    ).toEqual([
      "Rocket starter",
      "Clean line",
      "Bully",
      "Cautious",
      "Chaotic",
      "Enduro",
    ]);
  });

  it("keeps each behaviour entry frozen", () => {
    expect(Object.isFrozen(AI_ARCHETYPE_BEHAVIOURS)).toBe(true);
    for (const id of AI_ARCHETYPE_ORDER) {
      expect(Object.isFrozen(AI_ARCHETYPE_BEHAVIOURS[id])).toBe(true);
    }
  });
});

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

describe("tickAI (launch-phase lane hold)", () => {
  // At z=0 on a straight, the AI must hold its current lane instead of
  // converging on the centerline-anchored racing line — otherwise the
  // §7 grid pile-ups itself before the field can spread.
  it("does not pull off-center cars toward x=0 at race start", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 3, z: 0, speed: 0 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    // Lateral error is zero, so steer is zero. Without the launch hold
    // the AI would target x=0 and produce a strongly negative steer.
    expect(result.input.steer).toBeCloseTo(0, 6);
  });

  it("returns to racing-line targeting after the launch hold distance", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 3, z: 400, speed: 30 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    // Past the blend window, the racing-line target on a straight is 0,
    // so an off-center car steers back toward the centerline.
    expect(result.input.steer).toBeLessThan(0);
  });

  // Overtake offset must stay active during launch so trailing cars can
  // step out of lane to pass a slower leader. Without this, same-lane
  // cars rear-end each other in the launch window.
  it("keeps overtake offset active during the launch hold", () => {
    // Player sits as a slow leader 10 m ahead, in the same lane as the AI.
    const playerLeader: PlayerView = {
      car: freshCar({ x: 0, z: 10, speed: 5 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 0, speed: 20 }),
      playerLeader,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    // With overtake active, the steer command should be non-zero
    // (the AI is biased toward one side to pass).
    expect(Math.abs(result.input.steer)).toBeGreaterThan(0);
  });
});

describe("tickAI (follow-distance throttle)", () => {
  // A leader 8 m ahead in the same lane should cap the trailer's target
  // at the leader's speed - buffer, so the trailer lifts off instead of
  // creeping into the contact band.
  it("caps target speed when a same-lane car sits close ahead", () => {
    const leader: PlayerView = {
      car: freshCar({ x: 0, z: 8, speed: 20 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 0, speed: 30 }),
      leader,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    // Capped below the leader's 20 m/s. The exact cap is 20 - buffer.
    expect(result.nextAiState.targetSpeed).toBeLessThan(20);
  });

  it("ignores leaders outside the follow window", () => {
    // Leader 30 m ahead is outside FOLLOW_DISTANCE_METERS (14).
    const distantLeader: PlayerView = {
      car: freshCar({ x: 0, z: 30, speed: 10 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 0, speed: 30 }),
      distantLeader,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    // No cap applied; the AI targets its own top speed.
    expect(result.nextAiState.targetSpeed).toBeCloseTo(
      STARTER_STATS.topSpeed,
      6,
    );
  });

  it("ignores leaders in a different lane", () => {
    // Leader 8 m ahead but offset laterally by 3 m (well past 2.4 m).
    const adjacentLeader: PlayerView = {
      car: freshCar({ x: 3, z: 8, speed: 10 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 0, speed: 30 }),
      adjacentLeader,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.nextAiState.targetSpeed).toBeCloseTo(
      STARTER_STATS.topSpeed,
      6,
    );
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

describe("tickAI (§15 archetype behaviours)", () => {
  it("rocket starter launches faster early and fades late", () => {
    const clean = archetypeDriver("clean_line", { paceScalar: 0.75 });
    const rocket = archetypeDriver("nitro_burst", { paceScalar: 0.75 });
    const earlyClean = tickAI(
      clean,
      freshAi(),
      freshCar({ z: 60, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const earlyRocket = tickAI(
      rocket,
      freshAi(),
      freshCar({ z: 60, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const lateClean = tickAI(
      clean,
      freshAi(),
      freshCar({ z: 1000, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const lateRocket = tickAI(
      rocket,
      freshAi(),
      freshCar({ z: 1000, speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(earlyRocket.nextAiState.targetSpeed).toBeGreaterThan(
      earlyClean.nextAiState.targetSpeed,
    );
    expect(lateRocket.nextAiState.targetSpeed).toBeLessThan(
      lateClean.nextAiState.targetSpeed,
    );
    expect(earlyRocket.nextAiState.readabilityCue).toBe("rocket-launch");
    expect(lateRocket.nextAiState.readabilityCue).toBe("rocket-fade");
  });

  it("bully drivers pressure toward nearby traffic", () => {
    const clean = archetypeDriver("clean_line");
    const bully = archetypeDriver("aggressive", { aggression: 1 });
    const aiCar = freshCar({ x: 0, z: 300, speed: 30 });
    const playerNearbyRight: PlayerView = {
      car: freshCar({ x: 3, z: 300, speed: 30 }),
    };
    const cleanTick = tickAI(
      clean,
      freshAi(),
      aiCar,
      playerNearbyRight,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const bullyTick = tickAI(
      bully,
      freshAi(),
      aiCar,
      playerNearbyRight,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(bullyTick.input.steer).toBeGreaterThan(cleanTick.input.steer);
    expect(bullyTick.nextAiState.readabilityCue).toBe("bully-pressure");
  });

  it("bully pressure uses the player's position relative to the AI", () => {
    const clean = archetypeDriver("clean_line");
    const bully = archetypeDriver("aggressive", { aggression: 1 });
    const aiCar = freshCar({ x: 1, z: 300, speed: 30 });
    const playerNearbyLeft: PlayerView = {
      car: freshCar({ x: 0.5, z: 300, speed: 30 }),
    };
    const cleanTick = tickAI(
      clean,
      freshAi(),
      aiCar,
      playerNearbyLeft,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const bullyTick = tickAI(
      bully,
      freshAi(),
      aiCar,
      playerNearbyLeft,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(bullyTick.input.steer).toBeLessThan(cleanTick.input.steer);
  });

  it("cautious drivers brake earlier for the same sweeper", () => {
    const clean = archetypeDriver("clean_line");
    const cautious = archetypeDriver("defender");
    const aiCar = freshCar({ z: 900, speed: 45 });
    const cleanTick = tickAI(
      clean,
      freshAi(),
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    const cautiousTick = tickAI(
      cautious,
      freshAi(),
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(cautiousTick.nextAiState.targetSpeed).toBeLessThan(
      cleanTick.nextAiState.targetSpeed,
    );
    expect(cautiousTick.input.brake).toBeGreaterThan(cleanTick.input.brake);
  });

  it("cautious drivers brake earlier on low-visibility curves", () => {
    const cautious = archetypeDriver("defender");
    const aiCar = freshCar({ z: 900, speed: 40 });
    const clearTick = tickAI(
      cautious,
      freshAi(),
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
    );
    const fogTick = tickAI(
      cautious,
      freshAi(),
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1.5,
    );

    expect(fogTick.nextAiState.targetSpeed).toBeLessThan(
      clearTick.nextAiState.targetSpeed,
    );
    expect(fogTick.input.brake).toBeGreaterThan(clearTick.input.brake);
    expect(fogTick.nextAiState.readabilityCue).toBe(
      "cautious-low-visibility",
    );
  });

  it("chaotic drivers produce more seeded lane mistakes than enduro drivers", () => {
    const chaotic = archetypeDriver("wet_specialist", { mistakeRate: 0.2 });
    const enduro = archetypeDriver("endurance", { mistakeRate: 0.2 });
    const countSteeringMistakes = (driver: AIDriver): number => {
      let count = 0;
      for (let seed = 1; seed <= 160; seed += 1) {
        const result = tickAI(
          driver,
          freshAi({ seed }),
          freshCar({ speed: 20, z: seed * 6 }),
          PLAYER_FAR_BEHIND,
          STRAIGHT_TRACK,
          RACING,
          STARTER_STATS,
        );
        if (result.input.steer !== 0) count += 1;
      }
      return count;
    };

    expect(countSteeringMistakes(chaotic)).toBeGreaterThan(
      countSteeringMistakes(enduro),
    );
    const chaoticMistakeCue = Array.from({ length: 160 }, (_, index) => index + 1)
      .map((seed) =>
        tickAI(
          chaotic,
          freshAi({ seed }),
          freshCar({ speed: 20, z: seed * 6 }),
          PLAYER_FAR_BEHIND,
          STRAIGHT_TRACK,
          RACING,
          STARTER_STATS,
        ).nextAiState.readabilityCue,
      )
      .find((cue) => cue === "chaotic-missed-apex");
    expect(chaoticMistakeCue).toBe("chaotic-missed-apex");
    expect(
      tickAI(
        enduro,
        freshAi(),
        freshCar({ speed: 20 }),
        PLAYER_FAR_BEHIND,
        STRAIGHT_TRACK,
        RACING,
        STARTER_STATS,
      ).nextAiState.readabilityCue,
    ).toBe("enduro-consistent");
  });
});

describe("tickAI (field compression)", () => {
  // Helper: drive the same AI under two different peer-field setups
  // and read the requested target speed via the throttle / brake
  // proxy. The first call has no peers (baseline), the second has
  // peers ahead so the compression term should lift the pace.
  function targetSpeedWithPeers(
    peers: ReadonlyArray<{ x: number; z: number; speed: number }>,
  ): number {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: STARTER_STATS.topSpeed * 0.5 }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      peers,
    );
    return result.input.throttle;
  }

  it("returns identity throttle when no peers are around (no compression)", () => {
    expect(targetSpeedWithPeers([])).toBeCloseTo(1, 5);
  });

  it("a trailing AI with a peer ahead targets a higher speed than the same AI alone", () => {
    const baseline = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: STARTER_STATS.topSpeed * 0.99 }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
    );
    const compressed = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: STARTER_STATS.topSpeed * 0.99 }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      // Peer 200 m ahead: 200 * 0.0003 = 0.06, capped at 0.05.
      [{ x: 1, z: 300, speed: STARTER_STATS.topSpeed }],
    );
    // The trailing AI now targets a higher speed, so throttle stays
    // pinned where the baseline already reached the hysteresis band.
    expect(compressed.input.throttle).toBeGreaterThanOrEqual(
      baseline.input.throttle,
    );
    // The behind-only ai state's compression bonus is positive, so
    // intent / cue stay benign (no overtake target inside window).
    expect(compressed.nextAiState.intent).not.toBe("overtake");
  });

  it("a leading AI with peers behind takes a pace penalty", () => {
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 1000, speed: STARTER_STATS.topSpeed }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      // Two peers behind, the closest 200 m back. The leader gets a
      // -5 % cap on the compression term.
      [
        { x: 1, z: 800, speed: STARTER_STATS.topSpeed },
        { x: -1, z: 600, speed: STARTER_STATS.topSpeed },
      ],
    );
    // At top speed with a -5 % target, the AI should not be at full
    // throttle: hysteresis band kicks in below the target.
    expect(result.input.throttle).toBeLessThan(1);
  });

  it("Master tier (recoveryScalar = 0) flattens the compression entirely", () => {
    const masterModifiers = {
      paceScalar: 1.09,
      recoveryScalar: 0,
      mistakeScalar: 0.45,
    } as const;
    const withPeers = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: STARTER_STATS.topSpeed * 0.5 }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      masterModifiers,
      1,
      1,
      undefined,
      null,
      [{ x: 1, z: 300, speed: STARTER_STATS.topSpeed }],
    );
    const noPeers = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: STARTER_STATS.topSpeed * 0.5 }),
      { car: freshCar({ x: 0, z: -50, speed: STARTER_STATS.topSpeed }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      masterModifiers,
      1,
      1,
    );
    // Master forces recoveryScalar = 0, so the field-compression
    // bonus collapses to 0 and both calls produce identical outputs.
    expect(withPeers.input.throttle).toBeCloseTo(noPeers.input.throttle, 5);
    expect(withPeers.input.brake).toBeCloseTo(noPeers.input.brake, 5);
  });
});

describe("tickAI (AI-vs-AI overtake awareness)", () => {
  it("targets a slower AI ahead when no player is in range", () => {
    const playerOffField: PlayerView = {
      car: freshCar({ x: 0, z: -200, speed: 30 }),
    };
    const slowerAiAhead = { x: 0, z: 110, speed: 24 };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      playerOffField,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [slowerAiAhead],
    );
    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.nextAiState.readabilityCue).toBe("overtake");
    expect(Math.abs(result.input.steer)).toBeGreaterThan(0);
  });

  it("picks the closest threat ahead when both player and another AI are in range", () => {
    const playerNearAhead: PlayerView = {
      car: freshCar({ x: -2, z: 130, speed: 30 }),
    };
    const closerAiAhead = { x: 1, z: 108, speed: 28 };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      playerNearAhead,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [closerAiAhead],
    );
    expect(result.nextAiState.intent).toBe("overtake");
    // The closer AI is on the right (x = 1); the AI should pass on the
    // left, i.e. steer negative.
    expect(result.input.steer).toBeLessThan(0);
  });

  it("ignores AI threats behind the ego car", () => {
    const playerFarAhead: PlayerView = {
      car: freshCar({ x: 0, z: 1000, speed: 30 }),
    };
    const aiBehind = { x: 0, z: 80, speed: 30 };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      playerFarAhead,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [aiBehind],
    );
    expect(result.nextAiState.intent).not.toBe("overtake");
  });

  it("ignores AI threats the ego car cannot match speed against", () => {
    const playerFarAhead: PlayerView = {
      car: freshCar({ x: 0, z: 1000, speed: 30 }),
    };
    const fasterAiAhead = { x: 0, z: 110, speed: 40 };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      playerFarAhead,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [fasterAiAhead],
    );
    expect(result.nextAiState.intent).not.toBe("overtake");
  });
});

describe("tickAI (context-aware pass side)", () => {
  const SWEEPER_RIGHT: CompiledSegmentBuffer = compileSegments([
    { len: 1200, curve: 0.2, grade: 0, roadsideLeft: "d", roadsideRight: "d", hazards: [] },
  ]);
  const TIGHT_LEFT: CompiledSegmentBuffer = compileSegments([
    { len: 1200, curve: -0.5, grade: 0, roadsideLeft: "d", roadsideRight: "d", hazards: [] },
  ]);

  function tickWith(driver: AIDriver, track: CompiledSegmentBuffer) {
    return tickAI(
      driver,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      { car: freshCar({ x: 0, z: -200, speed: 30 }) },
      track,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [{ x: 0, z: 110, speed: 28 }],
    );
  }

  it("clean line passes outside on a right-handed sweeper", () => {
    const result = tickWith(archetypeDriver("clean_line"), SWEEPER_RIGHT);
    // Outside of a right-handed sweeper is the left side (negative
    // x). The combined racing-line bias (also pulls left) and the
    // outside-pass offset both push steer negative; the overtake
    // intent flips the readability cue and sets the intent.
    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.input.steer).toBeLessThan(0);
  });

  it("bully passes on the easier side regardless of curve direction", () => {
    const cleanLine = tickWith(archetypeDriver("clean_line"), SWEEPER_RIGHT);
    const bully = tickWith(
      archetypeDriver("aggressive", { aggression: 1 }),
      SWEEPER_RIGHT,
    );
    // Both archetypes fire overtake intent against the same target.
    expect(cleanLine.nextAiState.intent).toBe("overtake");
    expect(bully.nextAiState.intent).toBe("overtake");
    // Clean line follows the §15 outside-pass rule (negative steer).
    // Bully ignores convention and reads the easier-pass rule from
    // `target.x <= 0 -> +1`, so its overtake-offset contribution
    // pulls right while clean line pulls left. Expect a strict
    // ordering: bully's steer is greater (less negative or
    // positive) than clean line's on the same geometry.
    expect(bully.input.steer).toBeGreaterThan(cleanLine.input.steer);
  });

  it("clean line passes inside on a tight left-hander (under-braking line)", () => {
    const result = tickWith(archetypeDriver("clean_line"), TIGHT_LEFT);
    // Inside of a tight left curve is the left side. The racing-
    // line bias also pulls left, so steer should be strongly
    // negative.
    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.input.steer).toBeLessThan(0);
  });

  it("falls back to the easier-pass rule on a straight track", () => {
    const playerLeft = { x: -1, z: 110, speed: 28 };
    const result = tickAI(
      archetypeDriver("clean_line"),
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      { car: freshCar({ x: 0, z: -200, speed: 30 }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [playerLeft],
    );
    // Target is to the left of the AI; the easier-pass rule selects
    // the right side, so steer goes positive.
    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.input.steer).toBeGreaterThan(0);
  });
});

describe("tickAI (bully pass-margin override)", () => {
  // Place the AI directly behind a target on the centerline so the
  // pass-side branch (target.x <= 0) picks side = +1 and the lateral
  // target equals `margin`. The bully reads the same field with a
  // 0.6 margin scalar (so the lateral target is 1.2 m vs the polite
  // 2.0 m), and the AI's resulting steer is correspondingly less
  // aggressive on the same input geometry. We assert the relative
  // ordering rather than absolute steer values to stay robust to
  // upstream tuning of `STEER_GAIN`.
  const aheadOnCenter = { x: 0, z: 110, speed: 28 };

  function tickWithArchetype(driver: AIDriver) {
    return tickAI(
      driver,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      { car: freshCar({ x: 0, z: -200, speed: 30 }) },
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      undefined,
      null,
      [aheadOnCenter],
    );
  }

  it("renders a smaller steer commit for the bully than the clean line on the same geometry", () => {
    const clean = tickWithArchetype(archetypeDriver("clean_line"));
    const bully = tickWithArchetype(archetypeDriver("aggressive", { aggression: 1 }));
    expect(clean.nextAiState.intent).toBe("overtake");
    expect(bully.nextAiState.intent).toBe("overtake");
    // Clean line aims for the +2 m lateral target; bully aims for
    // +1.2 m. The lateral error pulls the steer P-controller harder
    // for the polite driver, so clean's steer is at least as large
    // as bully's. (At full saturation both clamp to 1; we use
    // greater-or-equal to stay robust under STEER_GAIN tuning.)
    expect(clean.input.steer).toBeGreaterThanOrEqual(bully.input.steer);
  });

  it("renders a larger steer commit for the cautious archetype than the clean line", () => {
    const clean = tickWithArchetype(archetypeDriver("clean_line"));
    const cautious = tickWithArchetype(archetypeDriver("defender"));
    // Cautious aims further from target.x (passMarginScalar 1.25 -> 2.5 m)
    // so its lateral commit is no smaller than clean line's.
    expect(cautious.input.steer).toBeGreaterThanOrEqual(clean.input.steer);
  });
});

describe("tickAI (visible overtake intent)", () => {
  it("moves laterally when a trailing AI reaches the player", () => {
    const playerAhead: PlayerView = {
      car: freshCar({ x: 0, z: 112, speed: 28 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: 0, z: 100, speed: 30 }),
      playerAhead,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.nextAiState.readabilityCue).toBe("overtake");
    expect(result.input.steer).toBeGreaterThan(0);
  });

  it("keeps a 2 m target margin from the player line during a pass", () => {
    const playerAheadLeft: PlayerView = {
      car: freshCar({ x: -1, z: 112, speed: 28 }),
    };
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ x: -1, z: 100, speed: 30 }),
      playerAheadLeft,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(result.nextAiState.intent).toBe("overtake");
    expect(result.input.steer).toBe(1);
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

describe("tickAI (§23 CPU difficulty tier paceScalar)", () => {
  // §23 "CPU difficulty modifiers" stacks the player-facing tier
  // `paceScalar` on top of the per-driver `AIDriver.paceScalar`. These
  // tests pin the runtime side of F-048: a clean_line driver under
  // identical inputs targets a higher speed at Hard than at Easy, and
  // omitted `cpuModifiers` keep the legacy all-ones default separate
  // from the §23 Normal row.

  it("Hard tier yields a higher targetSpeed than Easy under matched inputs", () => {
    // Mid-sweeper at curve=0.5: rawTarget = 61 * (1 - 0.6 * 0.5) * 1.0
    // * tier paceScalar. All four tiers stay below `topSpeed` here so
    // the clamp does not flatten the comparison.
    const easy = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("easy"),
    );
    const hard = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("hard"),
    );
    expect(hard.nextAiState.targetSpeed).toBeGreaterThan(
      easy.nextAiState.targetSpeed,
    );
  });

  it("Normal tier pace path matches omitted modifiers without a recovery gap", () => {
    // The default-arg path resolves to `IDENTITY_CPU_MODIFIERS`. Normal
    // is not identity anymore because §23 gives it mild recovery, but
    // without a trailing gap its pace and mistake scalars still match
    // the legacy default.
    const omitted = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    const explicitNormal = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("normal"),
    );
    expect(explicitNormal.input).toEqual(omitted.input);
    expect(explicitNormal.nextAiState).toEqual(omitted.nextAiState);
  });

  it("Normal tier recovery differs from the legacy omitted default", () => {
    const aiCar = freshCar({ z: 900, speed: 30 });
    const playerAhead: PlayerView = {
      car: freshCar({ z: aiCar.z + 240, speed: 30 }),
    };
    const omitted = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      playerAhead,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
    );
    const explicitNormal = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      playerAhead,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("normal"),
    );
    expect(omitted.nextAiState.targetSpeed).toBeGreaterThan(
      explicitNormal.nextAiState.targetSpeed,
    );
  });

  it("composes per-driver paceScalar with the tier paceScalar", () => {
    // §23 spec: a clean_line driver with `paceScalar = 1.02` running at
    // Hard sees an effective `1.02 * 1.05` composed pace; at Easy the
    // same driver sees `1.02 * 0.92`. The mid-sweeper segment keeps
    // both targets below `topSpeed` so the multiplicative composition
    // is observable without the chassis ceiling clamp.
    const driver: AIDriver = { ...CLEAN_LINE_DRIVER, paceScalar: 1.02 };
    const easy = tickAI(
      driver,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("easy"),
    );
    const hard = tickAI(
      driver,
      freshAi(),
      freshCar({ z: 900, speed: 30 }),
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("hard"),
    );
    // Mid-sweeper curvePenalty: 1 - 0.6 * 0.5 = 0.7. raw = 61 * 0.7 *
    // 1.02 * tier paceScalar. Both stay below `topSpeed = 61`.
    const baseRaw = STARTER_STATS.topSpeed * 0.7 * 1.02;
    expect(easy.nextAiState.targetSpeed).toBeCloseTo(baseRaw * 0.92, 6);
    expect(hard.nextAiState.targetSpeed).toBeCloseTo(baseRaw * 1.05, 6);
  });

  it("re-clamps composed target at topSpeed so Master cannot exceed the chassis ceiling", () => {
    // Straight with `paceScalar = 1.0` and Master tier
    // (`paceScalar = 1.09`) composes to `1.09 * topSpeed`; the clamp
    // brings it back to `topSpeed` so a Master-tier driver cannot
    // physically out-run the chassis. Mirrors the existing per-driver
    // `paceScalar > 1` clamp test on the straight.
    const result = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      freshCar({ speed: 10 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      getCpuModifiers("master"),
    );
    expect(result.nextAiState.targetSpeed).toBe(STARTER_STATS.topSpeed);
  });

  it("IDENTITY_CPU_MODIFIERS is the legacy all-ones default row", () => {
    expect(IDENTITY_CPU_MODIFIERS).toEqual<CpuDifficultyModifiers>({
      paceScalar: 1,
      recoveryScalar: 1,
      mistakeScalar: 1,
    });
    expect(Object.isFrozen(IDENTITY_CPU_MODIFIERS)).toBe(true);
  });
});

describe("tickAI (§23 CPU difficulty mistakeScalar and recoveryScalar)", () => {
  it("Easy tier produces more deterministic lane-target mistakes than Hard", () => {
    const mistakeDriver: AIDriver = {
      ...CLEAN_LINE_DRIVER,
      mistakeRate: 0.5,
    };
    const countMistakes = (
      modifiers: ReturnType<typeof getCpuModifiers>,
    ): number => {
      let aiState = freshAi({ seed: 123 });
      let count = 0;
      for (let i = 0; i < 300; i += 1) {
        const result = tickAI(
          mistakeDriver,
          aiState,
          freshCar({ speed: 20, z: i * 6 }),
          PLAYER_FAR_BEHIND,
          STRAIGHT_TRACK,
          RACING,
          STARTER_STATS,
          DEFAULT_AI_TRACK_CONTEXT,
          0,
          modifiers,
        );
        if (result.input.steer !== 0) count += 1;
        aiState = result.nextAiState;
      }
      return count;
    };

    expect(countMistakes(getCpuModifiers("easy"))).toBeGreaterThan(
      countMistakes(getCpuModifiers("hard")),
    );
  });

  it("advances the AI seed only when a positive mistake rate is consumed", () => {
    const noMistake = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi({ seed: 7 }),
      freshCar({ speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    const mistakeDriver: AIDriver = {
      ...CLEAN_LINE_DRIVER,
      mistakeRate: 0.5,
    };
    const withMistakeRate = tickAI(
      mistakeDriver,
      freshAi({ seed: 7 }),
      freshCar({ speed: 20 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );

    expect(noMistake.nextAiState.seed).toBe(7);
    expect(withMistakeRate.nextAiState.seed).not.toBe(7);
  });

  it("low visibility produces more deterministic lane-target mistakes", () => {
    const mistakeDriver: AIDriver = {
      ...CLEAN_LINE_DRIVER,
      mistakeRate: 0.2,
    };
    const countMistakes = (visibilityRiskScalar: number): number => {
      let count = 0;
      for (let seed = 1; seed <= 120; seed += 1) {
        const result = tickAI(
          mistakeDriver,
          freshAi({ seed }),
          freshCar({ speed: 20, z: seed * 6 }),
          PLAYER_FAR_BEHIND,
          STRAIGHT_TRACK,
          RACING,
          STARTER_STATS,
          DEFAULT_AI_TRACK_CONTEXT,
          0,
          IDENTITY_CPU_MODIFIERS,
          1,
          visibilityRiskScalar,
        );
        if (result.input.steer !== 0) count += 1;
      }
      return count;
    };

    expect(countMistakes(2)).toBeGreaterThan(countMistakes(1));
  });

  it("Easy recovery term is larger than Master under matched trailing gap", () => {
    const easyRecoveryOnly = {
      ...getCpuModifiers("easy"),
      paceScalar: 1,
      mistakeScalar: 1,
    };
    const masterRecoveryOnly = {
      ...getCpuModifiers("master"),
      paceScalar: 1,
      mistakeScalar: 1,
    };
    const aiCar = freshCar({ z: 900, speed: 30 });
    const playerAhead: PlayerView = {
      car: freshCar({ z: aiCar.z + 240, speed: 30 }),
    };
    const easy = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      playerAhead,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      easyRecoveryOnly,
    );
    const master = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      playerAhead,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      masterRecoveryOnly,
    );

    expect(easy.nextAiState.targetSpeed).toBeGreaterThan(
      master.nextAiState.targetSpeed,
    );
  });

  it("Master disables the light catch-up term", () => {
    const masterRecoveryOnly = {
      ...getCpuModifiers("master"),
      paceScalar: 1,
      mistakeScalar: 1,
    };
    const aiCar = freshCar({ z: 900, speed: 30 });
    const playerAhead: PlayerView = {
      car: freshCar({ z: aiCar.z + 240, speed: 30 }),
    };
    const withoutGap = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      PLAYER_FAR_BEHIND,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      masterRecoveryOnly,
    );
    const withGap = tickAI(
      CLEAN_LINE_DRIVER,
      freshAi(),
      aiCar,
      playerAhead,
      SWEEPER_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      masterRecoveryOnly,
    );

    expect(withGap.nextAiState.targetSpeed).toBe(
      withoutGap.nextAiState.targetSpeed,
    );
  });
});

describe("tickAI (F-091 nitro firing)", () => {
  // Closes F-091. Pre-fix, `tickAI` always set `input.nitro = false`.
  // Post-fix, the canonical clean_line driver fires the bias 1 launch
  // window on a clean lap-1 straight; switching the §22 nitroUsage to
  // all-zero collapses the firing back to false even on the same
  // surface so the wiring is observably bias-driven.

  function withBias(
    bias: { launchBias: number; straightBias: number; panicBias: number },
  ): AIDriver {
    return { ...CLEAN_LINE_DRIVER, nitroUsage: bias };
  }

  it("fires on a lap-1 launch straight with bias 1", () => {
    const result = tickAI(
      withBias({ launchBias: 1, straightBias: 0, panicBias: 0 }),
      freshAi(),
      freshCar({ z: 12, speed: 40 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.nitro).toBe(true);
  });

  it("does not fire on a lap-1 launch straight with bias 0", () => {
    const result = tickAI(
      withBias({ launchBias: 0, straightBias: 0, panicBias: 0 }),
      freshAi(),
      freshCar({ z: 12, speed: 40 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
    );
    expect(result.input.nitro).toBe(false);
  });

  it("does not fire during countdown even when bias is 1", () => {
    const result = tickAI(
      withBias({ launchBias: 1, straightBias: 1, panicBias: 1 }),
      freshAi(),
      freshCar({ z: 0, speed: 0 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      COUNTDOWN,
      STARTER_STATS,
    );
    expect(result.input.nitro).toBe(false);
  });

  it("does not fire when the AI has zero charges left", () => {
    const result = tickAI(
      withBias({ launchBias: 1, straightBias: 1, panicBias: 1 }),
      freshAi(),
      freshCar({ z: 12, speed: 40 }),
      PLAYER_FAR_BEHIND,
      STRAIGHT_TRACK,
      RACING,
      STARTER_STATS,
      DEFAULT_AI_TRACK_CONTEXT,
      0,
      IDENTITY_CPU_MODIFIERS,
      1,
      1,
      { charges: 0, activeRemainingSec: 0 },
      "clear",
    );
    expect(result.input.nitro).toBe(false);
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

  it("MAX_MISTAKE_OFFSET stays within the recoverable road width", () => {
    expect(AI_TUNING.MAX_MISTAKE_OFFSET).toBeLessThan(
      DEFAULT_AI_TRACK_CONTEXT.roadHalfWidth,
    );
  });
});
