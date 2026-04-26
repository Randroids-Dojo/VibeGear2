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
