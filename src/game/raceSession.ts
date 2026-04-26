/**
 * Race session: pure glue between input, physics, AI, and race lifecycle.
 *
 * Phase 1 vertical slice integration per `docs/IMPLEMENTATION_PLAN.md` §3 and
 * the dot stress-test pinned in
 * `VibeGear2-implement-phase-1-7aef013d`. Owns nothing rendering-related and
 * never touches `requestAnimationFrame`. The `/race` page wires `step` into
 * `startLoop({ simulate, render })` so determinism boundaries stay clean per
 * AGENTS.md RULE 8.
 *
 * Two entry points:
 *
 *   createRaceSession(config) -> RaceSessionState
 *   stepRaceSession(state, playerInput, config, dt) -> RaceSessionState
 *
 * Both pure. `stepRaceSession` returns a fresh state every call (immutable
 * shape) so future ghost / replay slices can record snapshots without
 * worrying about aliasing. The `tick` field on the returned state increments
 * once per simulation step and resets to zero when the lights go green so
 * lap timing starts at the green light, not at session creation.
 *
 * Lifecycle:
 *   countdown -> racing -> finished
 *
 * Lap completion is the integer floor of `player.car.z / track.totalLengthMeters`.
 * On increment we record the lap time (sim-tick-based, FIXED_STEP based on dt
 * supplied by the loop) and bump `race.lap`. When `lap > totalLaps` we flip
 * to `"finished"` and stop integrating physics. Damage / DNF / sector splits
 * are owned by the §7 race-rules slice; this slice ships only the happy path.
 */

import type { AIDriver, CarBaseStats } from "@/data/schemas";
import type { CompiledSegmentBuffer } from "@/road/trackCompiler";
import type { CompiledTrack } from "@/road/types";

import {
  DEFAULT_AI_TRACK_CONTEXT,
  INITIAL_AI_STATE,
  tickAI,
  type AIState,
  type AITrackContext,
} from "./ai";
import { type Input } from "./input";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
  type CarState,
  type TrackContext,
} from "./physics";
import {
  DEFAULT_COUNTDOWN_SEC,
  type RaceState,
} from "./raceState";

export interface RaceSessionPlayer {
  stats: Readonly<CarBaseStats>;
  initial?: Partial<CarState>;
}

export interface RaceSessionAI {
  driver: Readonly<AIDriver>;
  stats: Readonly<CarBaseStats>;
  initial?: Partial<CarState>;
  /**
   * PRNG seed for the AI. Defaults derive from grid index so each AI on the
   * grid gets a decorrelated stream when later archetypes consume RNG. The
   * clean_line slice ignores this; it remains in the contract so future
   * archetypes do not need a config-shape change.
   */
  seed?: number;
}

export interface RaceSessionConfig {
  /** Compiled track to drive on. Frozen output of `compileTrack`. */
  track: CompiledTrack;
  /** Optional physics + AI track context. Defaults derive from `ROAD_WIDTH`. */
  trackContext?: TrackContext;
  aiContext?: AITrackContext;
  player: RaceSessionPlayer;
  ai: ReadonlyArray<RaceSessionAI>;
  /**
   * Total laps. Defaults to `track.laps` so the data file owns the lap count
   * unless the run mode (e.g. quick-race) overrides it.
   */
  totalLaps?: number;
  /**
   * Lights-out countdown in seconds. Defaults to `DEFAULT_COUNTDOWN_SEC`.
   * Practice / quick-race may pass 0 for an instant start.
   */
  countdownSec?: number;
  /**
   * RNG seed for AI mistakes / shake / spawning. Pinned by the §22 schema.
   * The clean_line slice does not consume this; it is held so future
   * randomised systems start identically across runs.
   */
  seed?: number;
}

/**
 * Per-AI mutable view, paired with the AI controller's logical state and
 * the kinematic state the physics step consumes.
 */
export interface RaceSessionAICar {
  car: CarState;
  state: AIState;
}

export interface RaceSessionState {
  race: RaceState;
  player: { car: CarState };
  ai: ReadonlyArray<RaceSessionAICar>;
  /**
   * Frame counter. Increments once per simulation step. Resets to 0 the
   * tick the lights go green so a downstream ghost replay can record from
   * the same origin as the lap timer. Pre-countdown ticks count up so the
   * countdown timer reads the same monotonic clock as the rest of the sim.
   */
  tick: number;
}

/**
 * Default initial AI offset. The dot stress-test §4 pins single AI grid
 * placement at "5 m behind the player, same lateral offset 0". Arrays of
 * AI cars stack each one a further `AI_GRID_SPACING_M` behind so a tiny
 * test field with two AIs still places them deterministically; the full
 * grid pattern (slot, row, stagger) is owned by `implement-ai-grid`.
 */
export const AI_GRID_OFFSET_BEHIND_PLAYER_M = 5;
export const AI_GRID_SPACING_M = 5;

/**
 * Build a fresh session. Does not allocate any references that escape the
 * function (the `ai` array is constructed locally, not the one passed in,
 * so callers cannot mutate the session by mutating their input).
 *
 * Throws when:
 * - `totalLaps` is non-positive or non-integer (defends against bad config).
 * - `countdownSec` is negative or non-finite.
 */
export function createRaceSession(config: RaceSessionConfig): RaceSessionState {
  const totalLaps = config.totalLaps ?? config.track.laps;
  if (!Number.isInteger(totalLaps) || totalLaps < 1) {
    throw new RangeError(`totalLaps must be a positive integer, got ${totalLaps}`);
  }
  const countdownSec = config.countdownSec ?? DEFAULT_COUNTDOWN_SEC;
  if (!Number.isFinite(countdownSec) || countdownSec < 0) {
    throw new RangeError(
      `countdownSec must be a non-negative finite number, got ${countdownSec}`,
    );
  }

  const player: { car: CarState } = {
    car: { ...INITIAL_CAR_STATE, ...(config.player.initial ?? {}) },
  };

  const ai: RaceSessionAICar[] = config.ai.map((entry, index) => {
    const seed = entry.seed ?? INITIAL_AI_STATE.seed + index + 1;
    const initialZ =
      -(AI_GRID_OFFSET_BEHIND_PLAYER_M + index * AI_GRID_SPACING_M);
    return {
      car: {
        ...INITIAL_CAR_STATE,
        z: initialZ,
        ...(entry.initial ?? {}),
      },
      state: { ...INITIAL_AI_STATE, seed },
    };
  });

  const race: RaceState = {
    phase: countdownSec > 0 ? "countdown" : "racing",
    elapsed: 0,
    lap: 1,
    totalLaps,
    countdownRemainingSec: countdownSec,
    lastLapTimeMs: null,
    bestLapTimeMs: null,
  };

  return { race, player, ai, tick: 0 };
}

/**
 * Adapter view: `tickAI` is shaped against `CompiledSegmentBuffer` (the dev
 * page's segment-only entry point). The compiled track from `compileTrack`
 * carries the full metadata block but the same `segments` array, so we
 * project it onto the smaller buffer shape without copying.
 */
function bufferView(track: CompiledTrack): CompiledSegmentBuffer {
  return {
    segments: track.segments as CompiledSegmentBuffer["segments"],
    totalLength: track.totalLengthMeters,
  };
}

/**
 * Advance the session by `dt` seconds. Pure: input state unchanged, fresh
 * state returned.
 *
 * Phases:
 * - `countdown`: decrements `countdownRemainingSec` by `dt`. When it falls
 *   to 0 the phase flips to `racing` and `tick` resets so lap timing starts
 *   at the green light. No physics integration runs in countdown so the cars
 *   sit at their grid positions.
 * - `racing`: runs physics for the player and each AI, advances `elapsed` and
 *   `tick`, checks lap completion. On lap rollover records the lap time and
 *   updates best. When the player finishes the final lap the phase flips to
 *   `finished` and we stop integrating physics.
 * - `finished`: no-op tick. The session is read-only at this point; the
 *   results overlay reads from the snapshot.
 */
export function stepRaceSession(
  state: Readonly<RaceSessionState>,
  playerInput: Readonly<Input>,
  config: RaceSessionConfig,
  dt: number,
): RaceSessionState {
  if (!Number.isFinite(dt) || dt <= 0) {
    // Defensive copy so the caller treats every result as a fresh value.
    return cloneSessionState(state);
  }

  const trackContext = config.trackContext ?? DEFAULT_TRACK_CONTEXT;
  const aiContext = config.aiContext ?? DEFAULT_AI_TRACK_CONTEXT;

  if (state.race.phase === "finished") {
    return cloneSessionState(state);
  }

  if (state.race.phase === "countdown") {
    const remaining = Math.max(0, state.race.countdownRemainingSec - dt);
    if (remaining > 0) {
      return {
        race: {
          ...state.race,
          phase: "countdown",
          countdownRemainingSec: remaining,
        },
        player: { car: { ...state.player.car } },
        ai: state.ai.map((entry) => ({
          car: { ...entry.car },
          state: { ...entry.state },
        })),
        tick: state.tick + 1,
      };
    }
    // Lights out. Flip to racing, zero the tick clock, drop into the racing
    // branch below by recursing with a reset state. The recursion is bounded
    // (one extra step) and keeps the racing path single-source.
    const promoted: RaceSessionState = {
      race: {
        ...state.race,
        phase: "racing",
        countdownRemainingSec: 0,
        elapsed: 0,
      },
      player: { car: { ...state.player.car } },
      ai: state.ai.map((entry) => ({
        car: { ...entry.car },
        state: { ...entry.state },
      })),
      tick: 0,
    };
    return stepRaceSession(promoted, playerInput, config, dt);
  }

  // Racing branch.
  const buffer = bufferView(config.track);
  const trackLength = config.track.totalLengthMeters;
  const playerStats = config.player.stats;

  const nextPlayerCar = step(
    state.player.car,
    playerInput,
    playerStats,
    trackContext,
    dt,
  );

  const nextAi: RaceSessionAICar[] = state.ai.map((entry, index) => {
    const aiConfig = config.ai[index];
    if (!aiConfig) return { car: { ...entry.car }, state: { ...entry.state } };
    const tick = tickAI(
      aiConfig.driver,
      entry.state,
      entry.car,
      { car: state.player.car },
      buffer,
      state.race,
      aiConfig.stats,
      aiContext,
      dt,
    );
    const nextCar = step(entry.car, tick.input, aiConfig.stats, trackContext, dt);
    return { car: nextCar, state: tick.nextAiState };
  });

  const nextElapsed = state.race.elapsed + dt;
  const nextTick = state.tick + 1;

  // Lap completion. Floor of cumulative track distance.
  let nextLap = state.race.lap;
  let lastLapTimeMs = state.race.lastLapTimeMs;
  let bestLapTimeMs = state.race.bestLapTimeMs;
  let nextPhase: RaceState["phase"] = state.race.phase;

  if (trackLength > 0) {
    const lapsCompleted = Math.floor(nextPlayerCar.z / trackLength);
    const intendedLap = lapsCompleted + 1;
    if (intendedLap > state.race.lap) {
      // One or more laps crossed this tick. The MVP records a single lap
      // time for the most recent crossing; multi-lap-per-tick can only
      // happen with absurd dt and is not relevant for 60 Hz.
      const elapsedMs = Math.max(1, Math.round(nextElapsed * 1000));
      lastLapTimeMs = elapsedMs;
      bestLapTimeMs =
        bestLapTimeMs === null
          ? elapsedMs
          : Math.min(bestLapTimeMs, elapsedMs);
      nextLap = intendedLap;
      if (nextLap > state.race.totalLaps) {
        nextPhase = "finished";
        nextLap = state.race.totalLaps;
      }
    }
  }

  return {
    race: {
      ...state.race,
      phase: nextPhase,
      elapsed: nextElapsed,
      lap: nextLap,
      lastLapTimeMs,
      bestLapTimeMs,
    },
    player: { car: nextPlayerCar },
    ai: nextAi,
    tick: nextTick,
  };
}

/**
 * Total forward progress for ranking. Combines lap count with current `z`
 * so a leader on lap 3 outranks a follower on lap 2 even with a smaller
 * raw z. Used by the HUD position derivation in the `/race` page.
 */
export function totalProgress(carZ: number, lap: number, trackLengthMeters: number): number {
  return (lap - 1) * trackLengthMeters + carZ;
}

function cloneSessionState(state: Readonly<RaceSessionState>): RaceSessionState {
  return {
    race: { ...state.race },
    player: { car: { ...state.player.car } },
    ai: state.ai.map((entry) => ({
      car: { ...entry.car },
      state: { ...entry.state },
    })),
    tick: state.tick,
  };
}
