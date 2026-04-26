/**
 * Race session state. Owned by the runtime core, advanced by the fixed-step
 * simulation loop. See docs/gdd/21-technical-design-for-web-implementation.md.
 *
 * Phase 0: types and a constructor only. Subsequent slices fill in tick,
 * lap accounting, and rule integration.
 */

export type RacePhase = "countdown" | "racing" | "finished";

export interface RaceState {
  phase: RacePhase;
  /** Simulated time in seconds since session start. */
  elapsed: number;
  /** Current lap, 1-indexed. */
  lap: number;
  totalLaps: number;
}

export function createRaceState(totalLaps: number): RaceState {
  if (!Number.isInteger(totalLaps) || totalLaps < 1) {
    throw new RangeError(`totalLaps must be a positive integer, got ${totalLaps}`);
  }
  return {
    phase: "countdown",
    elapsed: 0,
    lap: 1,
    totalLaps,
  };
}
