/**
 * Unit tests for the F-102 car-bump lateral kick. The §13 contact
 * pair scan in `stepRaceSession` accumulates equal-and-opposite
 * lateral kicks on contact so cars in pack racing visibly jostle
 * apart instead of clipping through each other.
 *
 * Pin the symmetric separation, the deterministic bias when two
 * cars overlap at the same `x`, and the speed-factor scaling so a
 * future tune of `BUMP_KICK_BASE_MPS` cannot silently regress the
 * intent.
 */

import { describe, expect, it } from "vitest";

import { loadTrack } from "@/data";
import { NEUTRAL_INPUT } from "@/game/input";
import {
  BUMP_KICK_BASE_MPS,
  PLAYER_CAR_ID,
  aiCarId,
  createRaceSession,
  stepRaceSession,
  type RaceSessionConfig,
} from "@/game/raceSession";
import type { AIDriver, CarBaseStats } from "@/data/schemas";

const STATS: CarBaseStats = Object.freeze({
  topSpeed: 61,
  accel: 16,
  brake: 28,
  gripDry: 1,
  gripWet: 0.82,
  stability: 1,
  durability: 1,
  nitroEfficiency: 1,
});

const DRIVER: AIDriver = Object.freeze({
  id: "ai_cleanline_test",
  displayName: "Test AI",
  archetype: "clean_line",
  paceScalar: 1,
  mistakeRate: 0,
  aggression: 0,
  weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
  nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 0 },
});

const DT = 1 / 60;

function buildConfig(): RaceSessionConfig {
  return {
    track: loadTrack("test/curve"),
    player: { stats: STATS },
    ai: [{ driver: DRIVER, stats: STATS }],
    countdownSec: 0,
    seed: 42,
  };
}

describe("F-102 car-bump lateral kick", () => {
  it("separates two stationary overlapping cars in opposite directions", () => {
    const config = buildConfig();
    let session = createRaceSession(config);
    // Snap both cars to the same z and x so `carsInContact` fires
    // and the same-x branch picks the deterministic +1 bias.
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: 10, x: 0, speed: 0 },
      },
      ai: [
        {
          ...session.ai[0]!,
          car: { ...session.ai[0]!.car, z: 10, x: 0, speed: 0 },
        },
      ],
    };
    const next = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(next.player.car.x).toBeGreaterThan(0);
    expect(next.ai[0]!.car.x).toBeLessThan(0);
  });

  it("scales the kick magnitude with the pair speed factor", () => {
    const config = buildConfig();
    const baseSession = createRaceSession(config);
    function snapAt(speed: number) {
      return {
        ...baseSession,
        player: {
          ...baseSession.player,
          car: { ...baseSession.player.car, z: 10, x: 0, speed },
        },
        ai: [
          {
            ...baseSession.ai[0]!,
            car: { ...baseSession.ai[0]!.car, z: 10, x: 0, speed },
          },
        ],
      };
    }
    const slow = stepRaceSession(snapAt(0), NEUTRAL_INPUT, config, DT);
    const fast = stepRaceSession(snapAt(60), NEUTRAL_INPUT, config, DT);
    // The high-speed bump must produce a strictly larger lateral
    // separation than the stationary-grid bump (clamped by the
    // speed factor floor / ceiling).
    expect(fast.player.car.x).toBeGreaterThan(slow.player.car.x);
    expect(fast.ai[0]!.car.x).toBeLessThan(slow.ai[0]!.car.x);
  });

  it("preserves contact symmetry: the player kick equals minus the AI kick", () => {
    const config = buildConfig();
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: 10, x: 0, speed: 30 },
      },
      ai: [
        {
          ...session.ai[0]!,
          car: { ...session.ai[0]!.car, z: 10, x: 0, speed: 30 },
        },
      ],
    };
    const next = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    // Equal-and-opposite by construction; allow a tiny tolerance for
    // any independent integration drift between the two cars on the
    // same tick.
    expect(next.player.car.x + next.ai[0]!.car.x).toBeCloseTo(0, 4);
  });

  it("does not move two cars that are not in contact", () => {
    const config = buildConfig();
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: 10, x: 0, speed: 0 },
      },
      ai: [
        {
          ...session.ai[0]!,
          // 50 m behind the player so `carsInContact` is false.
          car: { ...session.ai[0]!.car, z: -50, x: 0, speed: 0 },
        },
      ],
    };
    const next = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(next.player.car.x).toBeCloseTo(0, 6);
    expect(next.ai[0]!.car.x).toBeCloseTo(0, 6);
  });

  it("exposes the BUMP_KICK_BASE_MPS constant for downstream tuning", () => {
    expect(BUMP_KICK_BASE_MPS).toBeGreaterThan(0);
    expect(Number.isFinite(BUMP_KICK_BASE_MPS)).toBe(true);
  });

  it("uses PLAYER_CAR_ID and aiCarId for the contact-pair lookup", () => {
    expect(PLAYER_CAR_ID).toBeTruthy();
    expect(aiCarId(0)).toBe("ai-0");
  });
});
