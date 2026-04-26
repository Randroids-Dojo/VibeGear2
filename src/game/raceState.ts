/**
 * Race session state. Owned by the runtime core, advanced by the fixed-step
 * simulation loop. See docs/gdd/21-technical-design-for-web-implementation.md.
 *
 * The full session shape (player car, AI cars, tick counter) lives in
 * `raceSession.ts`. This module owns the small race-lifecycle slice that
 * `raceSession.ts`, the HUD derivation, and the dev pages all read.
 *
 * The §7 race-rules engine extends this state additively in a later slice
 * (DNF, retire, sector splits). Until then this carries:
 * - `phase`: lifecycle gate, drives input gating and HUD overlays.
 * - `elapsed`: simulated seconds since the green light.
 * - `lap`: 1-indexed current lap.
 * - `totalLaps`: snapshot of `Track.laps` at session creation.
 * - `countdownRemainingSec`: lights-out timer. Zero outside the countdown.
 * - `lastLapTimeMs`: most recent completed lap, or `null` before any finish.
 * - `bestLapTimeMs`: fastest completed lap, or `null` before any finish.
 */

export type RacePhase = "countdown" | "racing" | "finished";

export interface RaceState {
  phase: RacePhase;
  /** Simulated time in seconds since session start. */
  elapsed: number;
  /** Current lap, 1-indexed. */
  lap: number;
  totalLaps: number;
  /** Seconds remaining in the lights-out countdown. Zero outside countdown. */
  countdownRemainingSec: number;
  /** Most recent completed lap time in milliseconds, or null before any finish. */
  lastLapTimeMs: number | null;
  /** Fastest completed lap time in milliseconds, or null before any finish. */
  bestLapTimeMs: number | null;
}

export interface CreateRaceStateOptions {
  /**
   * Lights-out countdown in seconds. Defaults to 3 per the dot stress-test;
   * practice / quick-race modes may pass 0 for an instant start.
   */
  countdownSec?: number;
}

/** Default countdown duration in seconds. Pinned by the dot stress-test §2. */
export const DEFAULT_COUNTDOWN_SEC = 3;

export function createRaceState(
  totalLaps: number,
  options: CreateRaceStateOptions = {},
): RaceState {
  if (!Number.isInteger(totalLaps) || totalLaps < 1) {
    throw new RangeError(`totalLaps must be a positive integer, got ${totalLaps}`);
  }
  const countdownSec = options.countdownSec ?? DEFAULT_COUNTDOWN_SEC;
  if (!Number.isFinite(countdownSec) || countdownSec < 0) {
    throw new RangeError(
      `countdownSec must be a non-negative finite number, got ${countdownSec}`,
    );
  }
  return {
    phase: countdownSec > 0 ? "countdown" : "racing",
    elapsed: 0,
    lap: 1,
    totalLaps,
    countdownRemainingSec: countdownSec,
    lastLapTimeMs: null,
    bestLapTimeMs: null,
  };
}
