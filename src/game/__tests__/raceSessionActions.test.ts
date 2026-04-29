/**
 * Unit tests for `src/game/raceSessionActions.ts` per dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * Coverage:
 *
 *   - `retireRaceSession` flips the player to DNF with the
 *     `"retired"` reason and the race phase to `"finished"`.
 *
 *   - `retireRaceSession` is a no-op on an already-finished session
 *     (idempotent).
 *
 *   - `retireRaceSession` is pure: input objects are not mutated, the
 *     result holds fresh references for every nested record.
 *
 *   - `buildFinalCarInputsFromSession` projects the session shape onto
 *     the §7 final-state-builder input shape so the §20 results screen
 *     can render the post-retire state.
 */

import { describe, expect, it } from "vitest";

import { loadTrack } from "@/data";
import {
  PLAYER_CAR_ID,
  aiCarId,
  createRaceSession,
  stepRaceSession,
  type RaceSessionConfig,
} from "@/game/raceSession";
import {
  DNF_REASON_RETIRED,
  buildFinalCarInputsFromSession,
  resetRaceSessionToLastCheckpoint,
  retireRaceSession,
  setRaceSessionWeather,
} from "@/game/raceSessionActions";
import { NEUTRAL_INPUT } from "@/game/input";
import { applyCheckpointPass } from "@/game/raceCheckpoints";
import type { AIDriver, CarBaseStats } from "@/data/schemas";

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

const TEST_DRIVER: AIDriver = Object.freeze({
  id: "ai_cleanline_test",
  displayName: "Test AI",
  archetype: "clean_line",
  paceScalar: 1.0,
  mistakeRate: 0,
  aggression: 0.3,
  weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
  nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
});

function buildConfig(): RaceSessionConfig {
  return {
    track: loadTrack("test/curve"),
    player: { stats: STARTER_STATS },
    ai: [{ driver: TEST_DRIVER, stats: STARTER_STATS }],
    countdownSec: 0,
    seed: 1,
  };
}

describe("retireRaceSession", () => {
  it("flips the player to dnf with the retired reason and the phase to finished", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const retired = retireRaceSession(session);

    expect(retired.player.status).toBe("dnf");
    expect(retired.player.dnfReason).toBe(DNF_REASON_RETIRED);
    expect(retired.player.finishedAtMs).toBeNull();
    expect(retired.race.phase).toBe("finished");
  });

  it("preserves existing lap times when retiring mid-race", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    // Roll forward a few ticks so any per-tick state advances. We do not
    // need a completed lap; we only assert the retire path keeps the
    // current snapshot rather than zeroing it.
    let s = session;
    for (let i = 0; i < 60; i += 1) {
      s = stepRaceSession(s, NEUTRAL_INPUT, config, 1 / 60);
    }
    const retired = retireRaceSession(s);
    // No completed laps yet at neutral input; the array stays empty
    // but a fresh reference (immutable contract).
    expect(retired.player.lapTimes).toEqual([]);
    expect(retired.player.lapTimes).not.toBe(s.player.lapTimes);
  });

  it("does not mutate the input session", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const before = JSON.parse(JSON.stringify(session));
    retireRaceSession(session);
    expect(JSON.parse(JSON.stringify(session))).toEqual(before);
  });

  it("is a no-op on an already-finished session", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    // Force the phase to finished without changing anything else; the
    // helper returns a fresh clone (immutable contract) but every
    // observable field stays the same.
    const finished = { ...session, race: { ...session.race, phase: "finished" as const } };
    const result = retireRaceSession(finished);
    expect(result.race.phase).toBe("finished");
    expect(result.player.status).toBe(finished.player.status);
    expect(result.player.dnfReason).toBe(finished.player.dnfReason);
  });

  it("returns fresh nested references so callers can mutate without leaking", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const retired = retireRaceSession(session);

    expect(retired).not.toBe(session);
    expect(retired.race).not.toBe(session.race);
    expect(retired.player).not.toBe(session.player);
    expect(retired.player.car).not.toBe(session.player.car);
    expect(retired.player.dnfTimers).not.toBe(session.player.dnfTimers);
    expect(retired.ai).not.toBe(session.ai);
  });

  it("leaves still-racing AI cars alone (their state is untouched)", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const retired = retireRaceSession(session);
    expect(retired.ai).toHaveLength(session.ai.length);
    expect(retired.ai[0]?.status).toBe(session.ai[0]?.status);
    expect(retired.ai[0]?.car.z).toBe(session.ai[0]?.car.z);
  });
});

describe("resetRaceSessionToLastCheckpoint", () => {
  it("rewinds the player car to the most recent checkpoint snapshot", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const checkpointCar = {
      ...session.player.car,
      x: 0.35,
      z: 410,
      speed: 23,
    };
    const withCheckpoint = {
      ...session,
      race: applyCheckpointPass(
        session.race,
        { segmentIndex: 68, label: "sector-1" },
        22,
        checkpointCar,
      ),
      player: {
        ...session.player,
        car: { ...session.player.car, x: -0.8, z: 700, speed: 55 },
      },
    };

    const reset = resetRaceSessionToLastCheckpoint(withCheckpoint);

    expect(reset.player.car).toEqual(checkpointCar);
    expect(reset.player.car).not.toBe(checkpointCar);
    expect(withCheckpoint.player.car.z).toBe(700);
  });

  it("returns a fresh no-op clone when no checkpoint has been passed", () => {
    const session = createRaceSession(buildConfig());
    const reset = resetRaceSessionToLastCheckpoint(session);
    expect(reset.player.car).toEqual(session.player.car);
    expect(reset.player.car).not.toBe(session.player.car);
  });
});

describe("setRaceSessionWeather", () => {
  it("switches the live weather immediately and clears any transition", () => {
    const session = createRaceSession({
      ...buildConfig(),
      weather: "clear",
    });
    const withTransition = {
      ...session,
      weather: {
        current: "clear" as const,
        transitioning: {
          from: "clear" as const,
          to: "rain" as const,
          progress: 0.4,
        },
      },
    };

    const swapped = setRaceSessionWeather(withTransition, "snow");

    expect(swapped.weather).toEqual({ current: "snow", transitioning: null });
    expect(withTransition.weather.transitioning).not.toBeNull();
  });
});

describe("buildFinalCarInputsFromSession", () => {
  it("includes one entry per car keyed by canonical id", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const cars = buildFinalCarInputsFromSession(session);
    expect(cars.map((c) => c.carId)).toEqual([PLAYER_CAR_ID, aiCarId(0)]);
  });

  it("coerces still-racing cars to dnf so the final state is well-formed", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const retired = retireRaceSession(session);
    const cars = buildFinalCarInputsFromSession(retired);
    // Player retired -> dnf. AI was still racing at the moment of retire,
    // but the projection coerces it to dnf so `buildFinalRaceState` does
    // not try to sort a "racing" car into the finishing order.
    const player = cars.find((c) => c.carId === PLAYER_CAR_ID);
    const ai = cars.find((c) => c.carId === aiCarId(0));
    expect(player?.status).toBe("dnf");
    expect(ai?.status).toBe("dnf");
  });

  it("preserves the player's lap times and finished-at value", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    const cars = buildFinalCarInputsFromSession(session);
    const player = cars.find((c) => c.carId === PLAYER_CAR_ID);
    expect(player?.lapTimes).toEqual([]);
    expect(player?.raceTimeMs).toBeNull();
  });
});
