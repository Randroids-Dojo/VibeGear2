/**
 * Unit tests for the pure race-session glue.
 *
 * Phase 1 vertical slice. The harness builds a session against the bundled
 * `test/curve` track and rolls it forward through the lifecycle to assert:
 * - Countdown decrements without integrating physics.
 * - Lights-out promotes to `racing` and resets the tick counter.
 * - Lap completion increments `lap`, records `lastLapTimeMs`, updates best.
 * - Final lap completion flips `phase` to `finished` and freezes physics.
 * - The session is deterministic under identical inputs (AGENTS.md RULE 8).
 *
 * Float comparisons use `toBeCloseTo` per AGENTS.md RULE 8.
 */

import { describe, expect, it } from "vitest";

import { loadTrack } from "@/data";
import {
  AI_GRID_OFFSET_BEHIND_PLAYER_M,
  createRaceSession,
  stepRaceSession,
  totalProgress,
  type RaceSessionConfig,
  type RaceSessionState,
} from "@/game/raceSession";
import { NEUTRAL_INPUT, type Input } from "@/game/input";
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

const DT = 1 / 60;

function fullThrottle(): Input {
  return { ...NEUTRAL_INPUT, throttle: 1 };
}

function buildConfig(overrides: Partial<RaceSessionConfig> = {}): RaceSessionConfig {
  return {
    track: loadTrack("test/curve"),
    player: { stats: STARTER_STATS },
    ai: [{ driver: TEST_DRIVER, stats: STARTER_STATS }],
    countdownSec: 1,
    seed: 42,
    ...overrides,
  };
}

function rollForward(
  initial: RaceSessionState,
  input: Input,
  config: RaceSessionConfig,
  steps: number,
  dt: number = DT,
): RaceSessionState {
  let s = initial;
  for (let i = 0; i < steps; i += 1) s = stepRaceSession(s, input, config, dt);
  return s;
}

describe("createRaceSession", () => {
  it("starts in countdown phase with player at z=0 and AI behind", () => {
    const config = buildConfig();
    const session = createRaceSession(config);
    expect(session.race.phase).toBe("countdown");
    expect(session.race.lap).toBe(1);
    expect(session.race.totalLaps).toBe(config.track.laps);
    expect(session.race.countdownRemainingSec).toBeCloseTo(1, 6);
    expect(session.player.car.z).toBe(0);
    expect(session.ai).toHaveLength(1);
    expect(session.ai[0]?.car.z).toBe(-AI_GRID_OFFSET_BEHIND_PLAYER_M);
    expect(session.tick).toBe(0);
  });

  it("starts in racing phase when countdownSec is 0", () => {
    const session = createRaceSession(buildConfig({ countdownSec: 0 }));
    expect(session.race.phase).toBe("racing");
    expect(session.race.countdownRemainingSec).toBe(0);
  });

  it("honours overridden totalLaps", () => {
    const session = createRaceSession(buildConfig({ totalLaps: 5 }));
    expect(session.race.totalLaps).toBe(5);
  });

  it("rejects bad totalLaps and bad countdownSec", () => {
    expect(() => createRaceSession(buildConfig({ totalLaps: 0 }))).toThrow(RangeError);
    expect(() => createRaceSession(buildConfig({ totalLaps: 2.5 }))).toThrow(RangeError);
    expect(() => createRaceSession(buildConfig({ countdownSec: -1 }))).toThrow(RangeError);
  });
});

describe("stepRaceSession (countdown)", () => {
  it("decrements the countdown without integrating physics", () => {
    const config = buildConfig({ countdownSec: 1 });
    const session = createRaceSession(config);
    const next = stepRaceSession(session, fullThrottle(), config, 0.5);
    expect(next.race.phase).toBe("countdown");
    expect(next.race.countdownRemainingSec).toBeCloseTo(0.5, 6);
    // Player did not move during countdown, full throttle ignored.
    expect(next.player.car.speed).toBe(0);
    expect(next.player.car.z).toBe(0);
  });

  it("flips to racing and resets tick when the countdown expires", () => {
    const config = buildConfig({ countdownSec: 0.25 });
    let session = createRaceSession(config);
    session = stepRaceSession(session, NEUTRAL_INPUT, config, 0.25);
    expect(session.race.phase).toBe("racing");
    expect(session.race.countdownRemainingSec).toBe(0);
    // The promotion tick still integrated the racing physics with the
    // residual dt the same way subsequent ticks would; for a NEUTRAL_INPUT
    // step at rest that means no movement but a non-negative tick counter.
    expect(session.tick).toBe(1);
    expect(session.race.elapsed).toBeCloseTo(0.25, 6);
  });
});

describe("stepRaceSession (racing)", () => {
  it("integrates physics for the player and the AI", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    session = rollForward(session, fullThrottle(), config, 60);
    expect(session.player.car.speed).toBeGreaterThan(0);
    expect(session.player.car.z).toBeGreaterThan(0);
    // AI should also accelerate from rest under its clean_line controller.
    const ai = session.ai[0];
    expect(ai?.car.speed).toBeGreaterThan(0);
  });

  it("is deterministic under identical inputs", () => {
    const config = buildConfig({ countdownSec: 0 });
    const a = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    const b = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    expect(a.player.car.z).toBe(b.player.car.z);
    expect(a.player.car.speed).toBe(b.player.car.speed);
    expect(a.ai[0]?.car.z).toBe(b.ai[0]?.car.z);
    expect(a.tick).toBe(b.tick);
  });

  it("returns a fresh state object each call (no input aliasing)", () => {
    const config = buildConfig({ countdownSec: 0 });
    const first = createRaceSession(config);
    const second = stepRaceSession(first, NEUTRAL_INPUT, config, DT);
    expect(second).not.toBe(first);
    expect(second.player).not.toBe(first.player);
    expect(second.player.car).not.toBe(first.player.car);
  });
});

describe("stepRaceSession (lap completion)", () => {
  it("increments lap and records timing when crossing the finish line", () => {
    const track = loadTrack("test/straight");
    const config: RaceSessionConfig = {
      track,
      player: { stats: STARTER_STATS },
      ai: [],
      countdownSec: 0,
      totalLaps: 3,
    };
    let session = createRaceSession(config);
    // Snap the player just before the finish line so a single tick crosses.
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: track.totalLengthMeters - 0.1, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.lap).toBe(2);
    expect(session.race.lastLapTimeMs).not.toBeNull();
    expect(session.race.bestLapTimeMs).toBe(session.race.lastLapTimeMs);
    expect(session.race.phase).toBe("racing");
  });

  it("flips to finished when the final lap completes and freezes physics", () => {
    const track = loadTrack("test/straight");
    const config: RaceSessionConfig = {
      track,
      player: { stats: STARTER_STATS },
      ai: [],
      countdownSec: 0,
      totalLaps: 1,
    };
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: track.totalLengthMeters - 0.1, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.phase).toBe("finished");
    // Lap clamped to totalLaps.
    expect(session.race.lap).toBe(1);
    const finishedZ = session.player.car.z;
    // Subsequent ticks are no-ops.
    const next = stepRaceSession(session, fullThrottle(), config, DT);
    expect(next.player.car.z).toBe(finishedZ);
    expect(next.race.phase).toBe("finished");
  });
});

describe("totalProgress", () => {
  it("ranks a leader on lap 2 ahead of a follower on lap 1", () => {
    const trackLen = 1200;
    const leader = totalProgress(50, 2, trackLen);
    const follower = totalProgress(1100, 1, trackLen);
    expect(leader).toBeGreaterThan(follower);
  });
});

describe("stepRaceSession (sector timer)", () => {
  it("initialises sector state from track checkpoints at session creation", () => {
    const config = buildConfig({ countdownSec: 0 });
    const session = createRaceSession(config);
    // test/curve has two checkpoints (start + sector-1).
    expect(session.sectorTimer.sectors.map((s) => s.label)).toEqual([
      "start",
      "sector-1",
    ]);
    expect(session.sectorTimer.currentSectorIdx).toBe(0);
    expect(session.baselineSplitsMs).toBeNull();
  });

  it("advances the sector timer as the player crosses checkpoints", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    // Snap the player just past the second checkpoint. test/curve checkpoint
    // sector-1 is at compiled segment index 68 (segmentIndex 2 of authored;
    // ceil(200/6) = 34 compiled segments per 200 m, so 34 + 34 = 68 -> z = 408 m).
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: 410, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.sectorTimer.currentSectorIdx).toBe(1);
    expect(session.sectorTimer.sectors[1]!.tickEntered).toBe(session.tick);
  });

  it("captures the previous lap as the baseline for the next lap", () => {
    const track = loadTrack("test/curve");
    const config: RaceSessionConfig = {
      track,
      player: { stats: STARTER_STATS },
      ai: [],
      countdownSec: 0,
      totalLaps: 3,
    };
    let session = createRaceSession(config);
    // First, cross sector-1 mid-lap so the lap closes with both sectors timed.
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: 410, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.sectorTimer.currentSectorIdx).toBe(1);
    expect(session.baselineSplitsMs).toBeNull();
    // Snap to just before the finish line and step once to roll the lap.
    session = {
      ...session,
      player: {
        ...session.player,
        car: {
          ...session.player.car,
          z: track.totalLengthMeters - 0.1,
          speed: 60,
        },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.lap).toBe(2);
    expect(session.baselineSplitsMs).not.toBeNull();
    expect(session.baselineSplitsMs?.length).toBe(2);
    // First sector of the new lap is open with `tickEntered` at the
    // lap-rollover tick.
    expect(session.sectorTimer.currentSectorIdx).toBe(0);
    expect(session.sectorTimer.sectors[0]!.tickEntered).toBe(session.tick);
  });

  it("keeps the sector timer deterministic under identical inputs", () => {
    const config = buildConfig({ countdownSec: 0 });
    const a = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    const b = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    expect(a.sectorTimer.currentSectorIdx).toBe(b.sectorTimer.currentSectorIdx);
    expect(a.sectorTimer.sectors).toEqual(b.sectorTimer.sectors);
    expect(a.baselineSplitsMs).toEqual(b.baselineSplitsMs);
  });
});

describe("stepRaceSession (nitro)", () => {
  function nitroTap(): Input {
    return { ...NEUTRAL_INPUT, throttle: 1, nitro: true };
  }

  it("seeds nitro state on every car at race start (player and AI)", () => {
    const config = buildConfig({ countdownSec: 0 });
    const session = createRaceSession(config);
    expect(session.player.nitro.charges).toBe(3);
    expect(session.player.nitro.activeRemainingSec).toBe(0);
    expect(session.player.lastNitroPressed).toBe(false);
    expect(session.ai).toHaveLength(1);
    expect(session.ai[0]?.nitro.charges).toBe(3);
    expect(session.ai[0]?.nitro.activeRemainingSec).toBe(0);
    expect(session.ai[0]?.lastNitroPressed).toBe(false);
  });

  it("honours the player's nitro upgrade tier when seeding charges", () => {
    // Extreme tier (4) grants +1 charge, so the player starts with 4.
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, upgrades: { nitro: 4 } },
    });
    const session = createRaceSession(config);
    expect(session.player.nitro.charges).toBe(4);
  });

  it("drains a charge on a fresh nitro tap and starts a burn", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    // First tick with nitro held -> rising edge, one charge consumed.
    session = stepRaceSession(session, nitroTap(), config, DT);
    expect(session.player.nitro.charges).toBe(2);
    expect(session.player.nitro.activeRemainingSec).toBeGreaterThan(0);
    expect(session.player.lastNitroPressed).toBe(true);
  });

  it("does not double-spend charges when nitro is held across ticks", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    // Tap once, then keep holding for several ticks. Only the first tick
    // is a rising edge; subsequent ticks must not consume more charges.
    session = stepRaceSession(session, nitroTap(), config, DT);
    expect(session.player.nitro.charges).toBe(2);
    session = stepRaceSession(session, nitroTap(), config, DT);
    session = stepRaceSession(session, nitroTap(), config, DT);
    expect(session.player.nitro.charges).toBe(2);
  });

  it("releases the held flag so a re-tap consumes the next charge", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    session = stepRaceSession(session, nitroTap(), config, DT);
    expect(session.player.nitro.charges).toBe(2);
    // Release: lastNitroPressed becomes false so the next held press is
    // again a rising edge.
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.player.lastNitroPressed).toBe(false);
    // Wait for the active burn to expire so the next tap is allowed to
    // start a new charge (no stacking while a burn is active).
    for (let i = 0; i < 120; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
      if (session.player.nitro.activeRemainingSec <= 0) break;
    }
    expect(session.player.nitro.activeRemainingSec).toBe(0);
    session = stepRaceSession(session, nitroTap(), config, DT);
    expect(session.player.nitro.charges).toBe(1);
  });

  it("keeps a full race tick deterministic with nitro inputs", () => {
    const config = buildConfig({ countdownSec: 0 });
    const a = rollForward(createRaceSession(config), nitroTap(), config, 600);
    const b = rollForward(createRaceSession(config), nitroTap(), config, 600);
    expect(a.player.car.z).toBe(b.player.car.z);
    expect(a.player.car.speed).toBe(b.player.car.speed);
    expect(a.player.nitro.charges).toBe(b.player.nitro.charges);
    expect(a.player.nitro.activeRemainingSec).toBe(b.player.nitro.activeRemainingSec);
    expect(a.tick).toBe(b.tick);
  });

  it("makes the player faster while a nitro charge is burning", () => {
    const config = buildConfig({ countdownSec: 0 });
    // Two parallel sessions: one taps nitro on tick 1, the other does not.
    const baseline = rollForward(createRaceSession(config), fullThrottle(), config, 30);
    let boosted = createRaceSession(config);
    boosted = stepRaceSession(boosted, nitroTap(), config, DT);
    // Continue holding so the burn keeps running for the rest of the window.
    for (let i = 0; i < 29; i += 1) {
      boosted = stepRaceSession(boosted, nitroTap(), config, DT);
    }
    expect(boosted.player.car.speed).toBeGreaterThan(baseline.player.car.speed);
    expect(boosted.player.car.z).toBeGreaterThan(baseline.player.car.z);
  });
});
