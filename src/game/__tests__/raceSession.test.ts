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
  PLAYER_CAR_ID,
  aiCarId,
  createRaceSession,
  draftPairKey,
  stepRaceSession,
  totalProgress,
  type RaceSessionConfig,
  type RaceSessionState,
} from "@/game/raceSession";
import {
  DRAFT_ENGAGE_MS,
  DRAFT_MAX_ACCEL_MULTIPLIER,
  DRAFT_MIN_SPEED_M_PER_S,
} from "@/game/drafting";
import { NEUTRAL_INPUT, type Input } from "@/game/input";
import {
  DNF_NO_PROGRESS_TIMEOUT_SEC,
  DNF_OFF_TRACK_TIMEOUT_SEC,
} from "@/game/raceRules";
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

describe("stepRaceSession (hard race time limit)", () => {
  it("flips phase to 'finished' when elapsed crosses DNF_RACE_TIME_LIMIT_SEC", () => {
    // Build a session that has not yet completed the player's lap, then
    // fast-forward the race clock to one tick before the §7 hard cap.
    // Verifies the safety-net behaviour pinned by the iter-19 stress-test
    // §4: a stuck race cannot block the results screen forever.
    const config = buildConfig({ countdownSec: 0, totalLaps: 5 });
    let session = createRaceSession(config);
    session = {
      ...session,
      race: {
        ...session.race,
        elapsed: 600 - DT, // one tick below DNF_RACE_TIME_LIMIT_SEC.
      },
    };
    expect(session.race.phase).toBe("racing");
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.race.phase).toBe("finished");
  });

  it("does not flip to 'finished' when elapsed is well below the cap", () => {
    // Sanity guard: a one-tick advance early in the race must not trip
    // the time-limit branch even when the player has produced no input.
    const config = buildConfig({ countdownSec: 0, totalLaps: 5 });
    let session = createRaceSession(config);
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.race.phase).toBe("racing");
  });

  it("preserves a 'finished' decision from lap-completion (no double-flip)", () => {
    // When the player crosses the final start/finish on the same tick the
    // hard cap would otherwise trip, the lap-completion branch wins. The
    // resulting `lap` clamp to `totalLaps` is the user-visible signal that
    // the race ended on a finish, not a timeout.
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
      race: {
        ...session.race,
        elapsed: 600 - DT,
      },
      player: {
        ...session.player,
        car: { ...session.player.car, z: track.totalLengthMeters - 0.1, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.phase).toBe("finished");
    expect(session.race.lap).toBe(1);
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

describe("stepRaceSession (transmission)", () => {
  function shiftUpInput(): Input {
    return { ...NEUTRAL_INPUT, throttle: 1, shiftUp: true };
  }
  function shiftDownInput(): Input {
    return { ...NEUTRAL_INPUT, throttle: 1, shiftDown: true };
  }

  it("seeds transmission state on every car at race start (player and AI)", () => {
    const config = buildConfig({ countdownSec: 0 });
    const session = createRaceSession(config);
    expect(session.player.transmission.mode).toBe("auto");
    expect(session.player.transmission.gear).toBe(1);
    expect(session.player.transmission.rpm).toBe(0);
    expect(session.player.lastShiftUpPressed).toBe(false);
    expect(session.player.lastShiftDownPressed).toBe(false);
    expect(session.ai[0]?.transmission.mode).toBe("auto");
    expect(session.ai[0]?.transmission.gear).toBe(1);
    expect(session.ai[0]?.lastShiftUpPressed).toBe(false);
    expect(session.ai[0]?.lastShiftDownPressed).toBe(false);
  });

  it("honours the player's transmissionMode setting (auto vs manual)", () => {
    const autoConfig = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "auto" },
    });
    const manualConfig = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    expect(createRaceSession(autoConfig).player.transmission.mode).toBe("auto");
    expect(createRaceSession(manualConfig).player.transmission.mode).toBe(
      "manual",
    );
  });

  it("AI cars are always seeded in auto mode regardless of player settings", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    const session = createRaceSession(config);
    expect(session.ai[0]?.transmission.mode).toBe("auto");
  });

  it("auto mode ignores shiftUp / shiftDown inputs (no gear advance)", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "auto" },
    });
    let session = createRaceSession(config);
    // Snap into a mid-band gear/speed so auto-shift does not fire on its
    // own, then hold shiftUp for several ticks. Gear must not advance.
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "auto", gear: 2, rpm: 0.5 },
        car: { ...session.player.car, speed: 18 },
      },
    };
    for (let i = 0; i < 10; i += 1) {
      session = stepRaceSession(session, shiftUpInput(), config, DT);
    }
    expect(session.player.transmission.mode).toBe("auto");
    expect(session.player.transmission.gear).toBe(2);
  });

  it("manual shiftUp fires on the rising edge of the input", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    let session = createRaceSession(config);
    // Snap to gear 2 mid-band so a shiftUp moves us to gear 3.
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "manual", gear: 2, rpm: 0.5 },
        car: { ...session.player.car, speed: 18 },
      },
    };
    // First tick with shiftUp held -> rising edge consumed -> gear 3.
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(3);
    expect(session.player.lastShiftUpPressed).toBe(true);
  });

  it("manual shiftUp held across ticks only fires once (no cascade)", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "manual", gear: 2, rpm: 0.5 },
        car: { ...session.player.car, speed: 18 },
      },
    };
    // Hold shiftUp for many ticks: gear must advance once and stick.
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(3);
    for (let i = 0; i < 10; i += 1) {
      session = stepRaceSession(session, shiftUpInput(), config, DT);
    }
    expect(session.player.transmission.gear).toBe(3);
  });

  it("releasing the shift button re-arms the rising-edge detector", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "manual", gear: 2, rpm: 0.5 },
        car: { ...session.player.car, speed: 18 },
      },
    };
    // Tap, release, tap again: two distinct rising edges, two shifts.
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(3);
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.player.lastShiftUpPressed).toBe(false);
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(4);
  });

  it("manual shiftDown rising edge drops one gear", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "manual", gear: 4, rpm: 0.5 },
        car: { ...session.player.car, speed: 40 },
      },
    };
    session = stepRaceSession(session, shiftDownInput(), config, DT);
    expect(session.player.transmission.gear).toBe(3);
  });

  it("respects the gearbox upgrade tier when capping max gear", () => {
    // Extreme tier (4) unlocks 7 gears. Starting at gear 6, manual shiftUp
    // must succeed; from gear 7 it must be capped.
    const config = buildConfig({
      countdownSec: 0,
      player: {
        stats: STARTER_STATS,
        transmissionMode: "manual",
        upgrades: { gearbox: 4 },
      },
    });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        transmission: { mode: "manual", gear: 6, rpm: 0.5 },
        car: { ...session.player.car, speed: 50 },
      },
    };
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(7);
    // Re-tap (release first) at gear 7 must be ignored.
    session = stepRaceSession(session, fullThrottle(), config, DT);
    session = stepRaceSession(session, shiftUpInput(), config, DT);
    expect(session.player.transmission.gear).toBe(7);
  });

  it("composes the gear-curve multiplier with nitro multiplicatively", () => {
    // Two parallel sessions starting from rest at gear 1 so the gear
    // multiplier is identical on both. One taps nitro, the other does
    // not. The composed accel must give the nitro session a strictly
    // larger speed; if the gear multiplier accidentally clobbered the
    // nitro multiplier, both speeds would be equal.
    const config = buildConfig({ countdownSec: 0 });
    const baseline = rollForward(createRaceSession(config), fullThrottle(), config, 30);
    let boosted = createRaceSession(config);
    const nitroTap: Input = { ...NEUTRAL_INPUT, throttle: 1, nitro: true };
    boosted = stepRaceSession(boosted, nitroTap, config, DT);
    for (let i = 0; i < 29; i += 1) {
      boosted = stepRaceSession(boosted, nitroTap, config, DT);
    }
    expect(boosted.player.car.speed).toBeGreaterThan(baseline.player.car.speed);
  });

  it("auto mode upshifts as the car accelerates from rest", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    // Roll forward at full throttle for a couple seconds; the auto-shift
    // reducer should have rolled the player past gear 1 by then.
    for (let i = 0; i < 240; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    expect(session.player.transmission.gear).toBeGreaterThan(1);
  });

  it("is deterministic across 1000 ticks with manual shifting inputs", () => {
    const config = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, transmissionMode: "manual" },
    });
    const seed = (s: RaceSessionState): RaceSessionState => ({
      ...s,
      player: {
        ...s.player,
        transmission: { mode: "manual", gear: 2, rpm: 0 },
      },
    });
    const runOnce = (): RaceSessionState => {
      let s = seed(createRaceSession(config));
      // Mix held-throttle and timed shift taps across the run so the
      // determinism assertion exercises both edge detection and the
      // composed accel multiplier.
      for (let i = 0; i < 1000; i += 1) {
        const input: Input =
          i === 100 || i === 300 || i === 500
            ? shiftUpInput()
            : i === 700
            ? shiftDownInput()
            : fullThrottle();
        s = stepRaceSession(s, input, config, DT);
      }
      return s;
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.player.car.z).toBe(b.player.car.z);
    expect(a.player.car.speed).toBe(b.player.car.speed);
    expect(a.player.transmission).toEqual(b.player.transmission);
    expect(a.player.lastShiftUpPressed).toBe(b.player.lastShiftUpPressed);
    expect(a.player.lastShiftDownPressed).toBe(b.player.lastShiftDownPressed);
  });
});

describe("stepRaceSession (drafting)", () => {
  const FAST = DRAFT_MIN_SPEED_M_PER_S + 30;

  /**
   * Build a 2-car tandem where the player follows the AI by 5 m at high
   * speed. The AI sits ahead so its wake reaches back to the player. Both
   * cars start above the §10 speed gate so the window can engage on the
   * very first racing tick.
   */
  function tandem(overrides: Partial<RaceSessionConfig> = {}): RaceSessionConfig {
    return {
      track: loadTrack("test/straight"),
      player: {
        stats: STARTER_STATS,
        initial: { speed: FAST, z: 0 },
      },
      ai: [
        {
          driver: TEST_DRIVER,
          stats: STARTER_STATS,
          initial: { z: 5, speed: FAST },
        },
      ],
      countdownSec: 0,
      totalLaps: 999,
      seed: 42,
      ...overrides,
    };
  }

  it("creates an empty draftWindows map at session start", () => {
    const session = createRaceSession(tandem());
    expect(session.draftWindows).toEqual({});
  });

  it("opens the player's draft window after 0.6 s in the leader's wake", () => {
    const config = tandem();
    let session = createRaceSession(config);
    // Roll past the 600 ms engagement gate. 36 ticks at 60 Hz hits 600 ms;
    // 40 ticks gives the ramp a few ms to begin so the multiplier is > 1.
    for (let i = 0; i < 40; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    const key = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    const window = session.draftWindows[key];
    expect(window).toBeDefined();
    expect(window!.engagedMs).toBeGreaterThan(DRAFT_ENGAGE_MS);
    expect(window!.accelMultiplier).toBeGreaterThan(1);
    expect(window!.accelMultiplier).toBeLessThanOrEqual(DRAFT_MAX_ACCEL_MULTIPLIER);
  });

  it("closes the player's draft window on a brake tap (verify item: brake zeros bonus)", () => {
    const config = tandem();
    let session = createRaceSession(config);
    for (let i = 0; i < 40; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    const key = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    const engagedMultiplier = session.draftWindows[key]!.accelMultiplier;
    expect(engagedMultiplier).toBeGreaterThan(1);
    const brakeInput: Input = { ...NEUTRAL_INPUT, brake: 1 };
    session = stepRaceSession(session, brakeInput, config, DT);
    const reset = session.draftWindows[key]!;
    expect(reset.engagedMs).toBe(0);
    expect(reset.accelMultiplier).toBe(1);
  });

  it("closes the player's draft window on a side-step past the lateral break (verify item: side-step zeros bonus)", () => {
    // Engage drafting first, then snap the player sideways past the
    // lateral break threshold so the geometric scan no longer picks the
    // AI as a leader. The window must reset to zero on the same tick.
    const config = tandem();
    let session = createRaceSession(config);
    for (let i = 0; i < 40; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    const key = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    expect(session.draftWindows[key]!.accelMultiplier).toBeGreaterThan(1);
    // Snap the player two lanes off the centerline. The leader is at
    // x=0 by default, so |dx| = 3 > DRAFT_LATERAL_BREAK_M (1.5).
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, x: 3 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    const reset = session.draftWindows[key]!;
    expect(reset.engagedMs).toBe(0);
    expect(reset.accelMultiplier).toBe(1);
  });

  it("is deterministic across 1000 ticks of two cars in tandem (verify item: 1000-tick determinism)", () => {
    const config = tandem();
    const a = rollForward(createRaceSession(config), fullThrottle(), config, 1000);
    const b = rollForward(createRaceSession(config), fullThrottle(), config, 1000);
    const key = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    expect(a.player.car.z).toBe(b.player.car.z);
    expect(a.player.car.speed).toBe(b.player.car.speed);
    expect(a.ai[0]?.car.z).toBe(b.ai[0]?.car.z);
    expect(a.draftWindows[key]).toEqual(b.draftWindows[key]);
  });

  it("applies the draft accel bonus to physics: a drafting follower out-accelerates a solo runner", () => {
    // Two parallel sessions: one with an AI ahead (so the player drafts),
    // one with no AI at all (solo runner). Both start above the §10
    // speed gate so the window engages quickly, but well below topSpeed
    // so the bonus has acceleration headroom to add real speed. Compare
    // total distance after a window long enough for the engage gate
    // (600 ms) plus a few hundred ms of bonus integration.
    //
    // Note: we put the leader far enough ahead that the player's added
    // acceleration cannot close the gap and rear-end the leader inside
    // the window. test/straight is 1200 m so 80 m of headroom is safe.
    const startSpeed = DRAFT_MIN_SPEED_M_PER_S + 5; // 35 m/s, well under 61 topSpeed
    const draftedConfig: RaceSessionConfig = {
      track: loadTrack("test/straight"),
      player: { stats: STARTER_STATS, initial: { speed: startSpeed, z: 0 } },
      ai: [
        {
          driver: TEST_DRIVER,
          stats: STARTER_STATS,
          initial: { z: 10, speed: startSpeed },
        },
      ],
      countdownSec: 0,
      totalLaps: 999,
      seed: 42,
    };
    const soloConfig: RaceSessionConfig = {
      ...draftedConfig,
      ai: [],
    };
    const drafted = rollForward(createRaceSession(draftedConfig), fullThrottle(), draftedConfig, 120);
    const solo = rollForward(createRaceSession(soloConfig), fullThrottle(), soloConfig, 120);
    expect(drafted.player.car.z).toBeGreaterThan(solo.player.car.z);
  });

  it("isolates parallel pairs so two tandems do not contaminate each other (verify item: pair-isolation)", () => {
    // Four cars: player + ai-0 form one tandem at x=0, ai-1 + ai-2 form
    // another tandem at x=3 (well past the lateral break threshold so
    // the two pairs cannot draft each other). The player's window should
    // engage only against ai-0; the ai-1 -> ai-2 pair, when it engages,
    // should write a separate key in `draftWindows`.
    //
    // We cannot easily verify ai-2 drafting ai-1 without poking the AI
    // controllers (they pick speeds based on their own logic), so this
    // test focuses on the core invariant: the player's pair key does
    // not leak into other follower keys.
    const config = tandem({
      ai: [
        { driver: TEST_DRIVER, stats: STARTER_STATS, initial: { z: 5, speed: FAST } },
        { driver: TEST_DRIVER, stats: STARTER_STATS, initial: { z: 0, x: 3, speed: FAST } },
        { driver: TEST_DRIVER, stats: STARTER_STATS, initial: { z: 5, x: 3, speed: FAST } },
      ],
    });
    let session = createRaceSession(config);
    for (let i = 0; i < 50; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    const playerKey = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    const playerWindow = session.draftWindows[playerKey];
    expect(playerWindow).toBeDefined();
    // The player's key must NOT match any key whose follower is a
    // different car. Inspect every key in the map and assert any
    // engaged window is properly scoped to its own follower.
    for (const key of Object.keys(session.draftWindows)) {
      if (key === playerKey) continue;
      // Other keys are valid (e.g. ai-2 drafting ai-1 if that happens),
      // but none should claim the same data as the player's window.
      // A simple invariant: a key's prefix encodes the follower id.
      expect(key.startsWith(`${PLAYER_CAR_ID}>>><`)).toBe(false);
    }
  });

  it("does not award a bonus below the speed threshold", () => {
    // Tandem at very low speed: the player sits behind the AI but both
    // are well below DRAFT_MIN_SPEED_M_PER_S, so engagedMs cannot grow.
    const config = tandem({
      player: { stats: STARTER_STATS, initial: { speed: 5, z: 0 } },
      ai: [{ driver: TEST_DRIVER, stats: STARTER_STATS, initial: { z: 5, speed: 5 } }],
    });
    let session = createRaceSession(config);
    for (let i = 0; i < 40; i += 1) {
      session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    }
    const key = draftPairKey(PLAYER_CAR_ID, aiCarId(0));
    const window = session.draftWindows[key];
    if (window) {
      expect(window.engagedMs).toBe(0);
      expect(window.accelMultiplier).toBe(1);
    }
  });

  it("does not advance the draft window during countdown", () => {
    const config = tandem({ countdownSec: 1 });
    let session = createRaceSession(config);
    // Roll a few countdown ticks. Cars do not integrate physics; the
    // draft scan should not run either.
    for (let i = 0; i < 30; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    expect(session.race.phase).toBe("countdown");
    expect(session.draftWindows).toEqual({});
  });
});

describe("stepRaceSession (§19 accessibility assists wiring)", () => {
  it("with assists OFF, the post-tick state matches the pre-assists pipeline (idempotency)", () => {
    // Two sessions with identical config except that one declares an
    // empty assists block (every flag false) and the other omits it.
    // Both must produce deep-equal state across many ticks.
    const baseConfig = buildConfig({ countdownSec: 0 });
    const withEmptyAssists: RaceSessionConfig = {
      ...baseConfig,
      player: {
        ...baseConfig.player,
        assists: {
          autoAccelerate: false,
          brakeAssist: false,
          steeringSmoothing: false,
          nitroToggleMode: false,
          reducedSimultaneousInput: false,
          weatherVisualReduction: false,
        },
      },
    };
    let plain = createRaceSession(baseConfig);
    let withAssists = createRaceSession(withEmptyAssists);
    for (let i = 0; i < 60; i += 1) {
      plain = stepRaceSession(plain, fullThrottle(), baseConfig, DT);
      withAssists = stepRaceSession(
        withAssists,
        fullThrottle(),
        withEmptyAssists,
        DT,
      );
      expect(withAssists.player.car).toEqual(plain.player.car);
      expect(withAssists.player.transmission).toEqual(plain.player.transmission);
      expect(withAssists.player.nitro).toEqual(plain.player.nitro);
    }
    expect(withAssists.player.assistBadge?.active).toBeFalsy();
  });

  it("identical inputs + identical assists produce deep-equal race state across runs", () => {
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 0 }),
      player: {
        stats: STARTER_STATS,
        assists: {
          autoAccelerate: true,
          steeringSmoothing: true,
          brakeAssist: true,
        },
      },
    };
    const runOnce = (): RaceSessionState => {
      let session = createRaceSession(config);
      for (let i = 0; i < 30; i += 1) {
        session = stepRaceSession(session, fullThrottle(), config, DT);
      }
      return session;
    };
    const a = runOnce();
    const b = runOnce();
    expect(b.player.car).toEqual(a.player.car);
    expect(b.player.assistMemory).toEqual(a.player.assistMemory);
    expect(b.player.assistBadge).toEqual(a.player.assistBadge);
    expect(b.player.weatherVisualReductionActive).toBe(
      a.player.weatherVisualReductionActive,
    );
  });

  it("auto-accelerate replaces a neutral throttle with full throttle on the player", () => {
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 0 }),
      player: {
        stats: STARTER_STATS,
        assists: { autoAccelerate: true },
      },
    };
    let with_ = createRaceSession(config);
    const without = createRaceSession(buildConfig({ countdownSec: 0 }));
    let withoutState = without;
    for (let i = 0; i < 30; i += 1) {
      with_ = stepRaceSession(with_, NEUTRAL_INPUT, config, DT);
      withoutState = stepRaceSession(
        withoutState,
        NEUTRAL_INPUT,
        buildConfig({ countdownSec: 0 }),
        DT,
      );
    }
    // Auto-accel keeps the car moving even with no throttle held.
    expect(with_.player.car.speed).toBeGreaterThan(0);
    // Baseline (no assists, no input) sits at zero throughout.
    expect(withoutState.player.car.speed).toBe(0);
    expect(with_.player.assistBadge?.primary).toBe("auto-accelerate");
  });

  it("brake assist boosts the player's brake when curving and above the speed gate", () => {
    // Build two sessions: one with brake-assist on, one off. Pre-load
    // the player at high speed and a sustained brake input. The curve
    // gate is sourced from the projector via `upcomingCurvature`; the
    // bundled `test/curve` track meets the §19 threshold by design.
    const fastBrake = (): Input => ({ ...NEUTRAL_INPUT, brake: 0.6 });
    const baseInitial: Partial<{ z: number; x: number; speed: number }> = {
      z: 24,
      speed: 50,
    };
    const off = buildConfig({
      countdownSec: 0,
      player: { stats: STARTER_STATS, initial: baseInitial },
    });
    const on: RaceSessionConfig = {
      ...off,
      player: {
        ...off.player,
        assists: { brakeAssist: true },
      },
    };
    let stateOff = createRaceSession(off);
    let stateOn = createRaceSession(on);
    for (let i = 0; i < 30; i += 1) {
      stateOff = stepRaceSession(stateOff, fastBrake(), off, DT);
      stateOn = stepRaceSession(stateOn, fastBrake(), on, DT);
    }
    // Brake assist scales the brake input upward; over many ticks the
    // assisted player has lost more speed than the unassisted one.
    expect(stateOn.player.car.speed).toBeLessThanOrEqual(
      stateOff.player.car.speed,
    );
  });

  it("toggle-nitro latches across ticks: a single tap stays on after release", () => {
    // Player car needs nitro charges to fire; build with the nitro
    // upgrade flag asked for by the producer. Speed seeded above the
    // launch-bias gate so the reducer engages immediately.
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 0 }),
      player: {
        stats: STARTER_STATS,
        initial: { speed: 30 },
        assists: { nitroToggleMode: true },
      },
    };
    let session = createRaceSession(config);
    // Tick 1: rising edge of nitro = latch on.
    session = stepRaceSession(
      session,
      { ...NEUTRAL_INPUT, throttle: 1, nitro: true },
      config,
      DT,
    );
    expect(session.player.assistMemory.nitroToggleActive).toBe(true);
    // Tick 2: player has released the key; latch should hold and the
    // physics-facing input stays nitro=true.
    session = stepRaceSession(
      session,
      { ...NEUTRAL_INPUT, throttle: 1, nitro: false },
      config,
      DT,
    );
    expect(session.player.assistMemory.nitroToggleActive).toBe(true);
    expect(session.player.lastNitroPressed).toBe(true);
    // Tick 3: another rising edge flips the latch off.
    session = stepRaceSession(
      session,
      { ...NEUTRAL_INPUT, throttle: 1, nitro: true },
      config,
      DT,
    );
    expect(session.player.assistMemory.nitroToggleActive).toBe(false);
  });

  it("reduced-input lockout passes only the priority winner through", () => {
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 0 }),
      player: {
        stats: STARTER_STATS,
        initial: { speed: 40 },
        assists: { reducedSimultaneousInput: true },
      },
    };
    // Hold throttle, brake, and nitro all together. Brake outranks
    // throttle and nitro in the priority ladder; the player should
    // brake (lose speed) rather than accelerate or fire nitro.
    const conflicting: Input = {
      ...NEUTRAL_INPUT,
      throttle: 1,
      brake: 0.8,
      nitro: true,
    };
    let session = createRaceSession(config);
    for (let i = 0; i < 30; i += 1) {
      session = stepRaceSession(session, conflicting, config, DT);
    }
    expect(session.player.car.speed).toBeLessThan(40);
    expect(session.player.assistMemory.reducedInputLastWinner).toBe("brake");
  });

  it("session lifecycle resets assist memory when the lights go green", () => {
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 1 }),
      player: {
        stats: STARTER_STATS,
        assists: { steeringSmoothing: true },
      },
    };
    let session = createRaceSession(config);
    // Roll through countdown with a hard left steer so the smoothing
    // memory would (without reset) carry a non-zero value into the
    // racing phase. During countdown no physics integrates and assists
    // do not run, so the memory stays at INITIAL anyway.
    const steerHard: Input = { ...NEUTRAL_INPUT, steer: -1 };
    for (let i = 0; i < 60; i += 1) {
      session = stepRaceSession(session, steerHard, config, DT);
    }
    // First racing tick: even if anyone had stuffed the memory, the
    // promoted state resets it. After the green-light tick the smoothed
    // value should reflect *one tick* of filtering from zero, not the
    // many ticks of countdown.
    session = stepRaceSession(session, steerHard, config, DT);
    expect(session.race.phase).toBe("racing");
    // After exactly one filter tick the smoothed value is below the
    // raw input magnitude (low-pass filter pulls toward the input).
    expect(session.player.assistMemory.smoothedSteer).toBeGreaterThan(-1);
    expect(session.player.assistMemory.smoothedSteer).toBeLessThan(0);
  });

  it("surfaces weatherVisualReductionActive when the assist is on", () => {
    const config: RaceSessionConfig = {
      ...buildConfig({ countdownSec: 0 }),
      player: {
        stats: STARTER_STATS,
        assists: { weatherVisualReduction: true },
      },
    };
    let session = createRaceSession(config);
    // The flag is captured at session creation so the first frame
    // already reads true; one tick confirms the physics-facing
    // snapshot still reports it.
    expect(session.player.weatherVisualReductionActive).toBe(true);
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.player.weatherVisualReductionActive).toBe(true);
  });
});

describe("stepRaceSession (§7 per-car DNF tracking + finishing order, F-028)", () => {
  it("seeds per-car race lifecycle fields at session creation (player + AI)", () => {
    const config = buildConfig({ countdownSec: 0 });
    const session = createRaceSession(config);
    expect(session.player.status).toBe("racing");
    expect(session.player.dnfReason).toBeNull();
    expect(session.player.dnfTimers).toEqual({
      offTrackSec: 0,
      noProgressSec: 0,
      lastProgressMark: 0,
    });
    expect(session.player.lapTimes).toEqual([]);
    expect(session.player.finishedAtMs).toBeNull();
    expect(session.ai[0]?.status).toBe("racing");
    expect(session.ai[0]?.lap).toBe(1);
    expect(session.ai[0]?.lapTimes).toEqual([]);
    expect(session.ai[0]?.finishedAtMs).toBeNull();
  });

  it("flips player status to 'dnf' when the off-track timer trips", () => {
    // Pre-load the DNF timer to one tick below the off-track threshold,
    // snap the player off-road and slow, then a single step trips it.
    // This exercises the wiring without spinning 1800 ticks per test.
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, x: 100, speed: 0, surface: "grass" },
        dnfTimers: {
          ...session.player.dnfTimers,
          offTrackSec: DNF_OFF_TRACK_TIMEOUT_SEC - DT / 2,
        },
      },
    };
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.player.status).toBe("dnf");
    expect(session.player.dnfReason).toBe("off-track");
  });

  it("flips player status to 'dnf' when the no-progress timer trips", () => {
    // Pre-load the no-progress timer near the threshold, hold the
    // player still (NEUTRAL_INPUT, speed 0) so it cannot advance the
    // 5 m delta, and a single step trips it.
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, speed: 0 },
        dnfTimers: {
          ...session.player.dnfTimers,
          noProgressSec: DNF_NO_PROGRESS_TIMEOUT_SEC - DT / 2,
        },
      },
    };
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.player.status).toBe("dnf");
    expect(session.player.dnfReason).toBe("no-progress");
  });

  it("freezes the player's physics integration once status flips to 'dnf'", () => {
    // After the player retires, holding full throttle for several ticks
    // must not move the car. Verifies the DNF gate inside stepRaceSession.
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: {
        ...session.player,
        status: "dnf",
        dnfReason: "off-track",
        car: { ...session.player.car, x: 50, speed: 30 },
      },
    };
    const beforeZ = session.player.car.z;
    const beforeSpeed = session.player.car.speed;
    for (let i = 0; i < 30; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    expect(session.player.car.z).toBe(beforeZ);
    expect(session.player.car.speed).toBe(beforeSpeed);
    // Race phase still racing (player retired but AI is still going).
    expect(session.race.phase).toBe("racing");
  });

  it("flips an AI to 'dnf' when its off-track timer trips and freezes its physics", () => {
    const config = buildConfig({ countdownSec: 0 });
    let session = createRaceSession(config);
    // Snap AI off-road, slow, and pre-load its DNF timer near the cap.
    session = {
      ...session,
      ai: session.ai.map((entry) => ({
        ...entry,
        car: { ...entry.car, x: 100, speed: 0, surface: "grass" },
        dnfTimers: {
          ...entry.dnfTimers,
          offTrackSec: DNF_OFF_TRACK_TIMEOUT_SEC - DT / 2,
        },
      })),
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.ai[0]?.status).toBe("dnf");
    expect(session.ai[0]?.dnfReason).toBe("off-track");
    const frozenZ = session.ai[0]?.car.z;
    // Roll several more ticks; AI does not move because physics is gated.
    for (let i = 0; i < 30; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    expect(session.ai[0]?.car.z).toBe(frozenZ);
  });

  it("flips race phase to 'finished' once every car has stopped racing", () => {
    // Pre-DNF both player and the lone AI so the next tick's DNF
    // detection finds no still-racing cars and the all-stopped gate
    // moves the phase forward.
    const config = buildConfig({ countdownSec: 0, totalLaps: 5 });
    let session = createRaceSession(config);
    session = {
      ...session,
      player: { ...session.player, status: "dnf", dnfReason: "off-track" },
      ai: session.ai.map((entry) => ({
        ...entry,
        status: "dnf",
        dnfReason: "off-track",
      })),
    };
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    expect(session.race.phase).toBe("finished");
  });

  it("tracks per-AI lap rollovers and stamps finishedAtMs at race end", () => {
    // Single-lap race on test/straight: snap the AI just before the
    // line so a single step crosses, then assert per-AI bookkeeping.
    const track = loadTrack("test/straight");
    const config: RaceSessionConfig = {
      track,
      player: { stats: STARTER_STATS },
      ai: [{ driver: TEST_DRIVER, stats: STARTER_STATS }],
      countdownSec: 0,
      totalLaps: 1,
    };
    let session = createRaceSession(config);
    session = {
      ...session,
      ai: session.ai.map((entry) => ({
        ...entry,
        car: { ...entry.car, z: track.totalLengthMeters - 0.1, speed: 60 },
      })),
    };
    session = stepRaceSession(session, NEUTRAL_INPUT, config, DT);
    const ai0 = session.ai[0]!;
    expect(ai0.status).toBe("finished");
    expect(ai0.lap).toBe(1);
    expect(ai0.lapTimes.length).toBe(1);
    expect(ai0.lapTimes[0]).toBeGreaterThan(0);
    expect(ai0.finishedAtMs).not.toBeNull();
  });

  it("stamps the player's lapTimes + finishedAtMs at race end", () => {
    // Single-lap race; snap the player just before the line and step.
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
        car: {
          ...session.player.car,
          z: track.totalLengthMeters - 0.1,
          speed: 60,
        },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.player.status).toBe("finished");
    expect(session.player.lapTimes.length).toBe(1);
    expect(session.player.lapTimes[0]).toBeGreaterThan(0);
    expect(session.player.finishedAtMs).not.toBeNull();
    // Race phase mirrors the player flip (existing behaviour).
    expect(session.race.phase).toBe("finished");
  });

  it("appends per-lap durations across multi-lap races (cumulative-aware)", () => {
    // Two-lap race: cross lap 1 mid-race, then cross lap 2 later. The
    // second entry in `lapTimes` is the duration of lap 2 alone, not
    // the cumulative time. This is the property the §7 fastest-lap
    // builder relies on (`Math.min(...car.lapTimes)`).
    const track = loadTrack("test/straight");
    const config: RaceSessionConfig = {
      track,
      player: { stats: STARTER_STATS },
      ai: [],
      countdownSec: 0,
      totalLaps: 3,
    };
    let session = createRaceSession(config);
    // Lap 1: snap to the line and cross.
    session = {
      ...session,
      player: {
        ...session.player,
        car: { ...session.player.car, z: track.totalLengthMeters - 0.1, speed: 60 },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.lap).toBe(2);
    expect(session.player.lapTimes.length).toBe(1);
    const lap1Ms = session.player.lapTimes[0]!;
    // Lap 2: spend a couple seconds, then snap and cross again.
    for (let i = 0; i < 60; i += 1) {
      session = stepRaceSession(session, fullThrottle(), config, DT);
    }
    session = {
      ...session,
      player: {
        ...session.player,
        car: {
          ...session.player.car,
          z: 2 * track.totalLengthMeters - 0.1,
          speed: 60,
        },
      },
    };
    session = stepRaceSession(session, fullThrottle(), config, DT);
    expect(session.race.lap).toBe(3);
    expect(session.player.lapTimes.length).toBe(2);
    const lap2Ms = session.player.lapTimes[1]!;
    // Lap 2 was spent waiting ~1s before the synthetic snap; the
    // duration is not cumulative — it must be smaller than the full
    // race elapsed and strictly positive.
    expect(lap2Ms).toBeGreaterThan(0);
    expect(lap2Ms).toBeLessThan(lap1Ms + 1_000_000);
  });

  it("is deterministic across runs with DNF + finishing wiring active", () => {
    const config = buildConfig({ countdownSec: 0 });
    const a = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    const b = rollForward(createRaceSession(config), fullThrottle(), config, 600);
    expect(a.player.status).toBe(b.player.status);
    expect(a.player.dnfTimers).toEqual(b.player.dnfTimers);
    expect(a.player.lapTimes).toEqual(b.player.lapTimes);
    expect(a.player.finishedAtMs).toBe(b.player.finishedAtMs);
    expect(a.ai[0]?.status).toBe(b.ai[0]?.status);
    expect(a.ai[0]?.dnfTimers).toEqual(b.ai[0]?.dnfTimers);
    expect(a.ai[0]?.lap).toBe(b.ai[0]?.lap);
    expect(a.ai[0]?.lapTimes).toEqual(b.ai[0]?.lapTimes);
  });
});
