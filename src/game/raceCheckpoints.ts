/**
 * Per-tick checkpoint-pass detection and lap-credit guard helpers.
 *
 * Source of truth: `docs/gdd/07-race-rules-and-structure.md` (lap counting,
 * anti-shortcut), `docs/gdd/22-data-schemas.md` (Track.checkpoints schema).
 *
 * The §22 Track schema declares `checkpoints: [{segmentIndex, label}]` but
 * the runtime had no consumer for them outside the §20 sector-splits widget.
 * This module is the producer of per-tick checkpoint-pass events that the
 * §7 lap-credit guard, §6 practice resetToCheckpoint, §15 AI recover-spawn,
 * and §22 sector-splits all consume. Pinned by the iter-19 stress-test on
 * the parent dot `VibeGear2-implement-race-rules-b30656ae` as a small
 * upstream dependency that several downstream slices share.
 *
 * Pure functions only: no `Math.random`, no `Date.now`. Detection runs off
 * the player car's pre/post-tick `z` and the immutable compiled-track
 * checkpoint list; consumers (`raceState`) hold the resulting `lastCheckpoint`
 * snapshot in their own pure shape so a replay can reconstruct the same
 * pass set tick-for-tick.
 *
 * Forward-only detection: a pass registers only when the player crosses a
 * checkpoint travelling forward. Reversing through a checkpoint does not
 * register a pass per the iter-19 stress-test on the dot, so a player who
 * spins and rolls backward does not bank a fake pass. The §6 practice
 * `resetToCheckpoint` consumer relies on this directionality to know that
 * `lastCheckpoint` is always the most recently forward-crossed checkpoint.
 *
 * Wrap-around: lap rollover is detected as `currZ < prevZ` (the player's
 * `z` field resets to near-zero after the start line). The detector
 * synthesises a "from `prevZ` to `currZ + L`" pass window so a checkpoint
 * placed near the start line on the FAR side of the wrap (the common case
 * for `segmentIndex = 0`) is correctly detected as crossed.
 *
 * Multi-pass per tick: at 60 Hz the player advances at most ~1 m per tick,
 * so two checkpoints in one tick implies misconfigured authoring. The
 * detector returns only the LAST checkpoint crossed in that case, with a
 * stable lex-on-label tie-break so two checkpoints at the same z still
 * order deterministically. Consumers only ever see the most-recent
 * checkpoint, which keeps the API one event per tick.
 *
 * Hard skip guard: the `loop` clamps the simulation accumulator at
 * `MAX_ACCUMULATOR_MS = 250 ms` (15 ticks at 60 Hz) so a `dt` that exceeds
 * roughly half the track between two ticks is structurally impossible in
 * practice. The detector still defends against it: a movement window
 * exceeding half the track length is treated as a no-op (returns null)
 * because the direction of crossing is ambiguous. This matches the iter-19
 * stress-test §"Edge Cases" guidance "treat as no-op rather than asserting
 * all crossed checkpoints".
 */

import type { CarState } from "./physics";
import type { RaceState } from "./raceState";

/**
 * Minimal track shape consumed by `hasPassedAllCheckpoints`. Accepts both
 * the authored `Track` and the compiled-track shapes since callers in
 * `raceSession` typically have the compiled form while unit tests
 * construct minimal authored fixtures. Only the `checkpoints` array is
 * consulted.
 */
export interface CheckpointBearingTrack {
  checkpoints: ReadonlyArray<{ readonly segmentIndex: number; readonly label: string }>;
}

/**
 * Minimal checkpoint shape the detector accepts. The `segmentIndex` is
 * the segment number whose start the checkpoint sits at; multiplied by
 * `segmentLengthMeters` it gives the lap-local z position of the
 * checkpoint. Authored `TrackCheckpoint` carries this directly; compiled
 * `CompiledCheckpoint` carries the same number under `compiledStart`,
 * which `raceSession` projects onto `segmentIndex` before calling the
 * detector. Keeping the runtime-facing shape narrow lets the detector
 * stay agnostic of the road-compilation layer.
 */
export interface CheckpointInput {
  readonly segmentIndex: number;
  readonly label: string;
}

/**
 * Per-checkpoint snapshot the runtime carries on `RaceState.lastCheckpoint`.
 * Captured at the moment of forward crossing; immutable from the consumer's
 * perspective. The `carState` field is a defensive shallow copy of the
 * player's `CarState` at the crossing tick so a `practice.resetToCheckpoint`
 * call can rewind to exactly the snapshot without aliasing on the live
 * mutable car.
 */
export interface LastCheckpointSnapshot {
  /** Sim tick at which the crossing was detected. */
  tick: number;
  /** Track segment index of the crossed checkpoint. */
  segmentIndex: number;
  /** Stable label of the crossed checkpoint. */
  label: string;
  /** Defensive copy of the player car's state at the crossing tick. */
  carState: CarState;
}

/**
 * Detect a forward checkpoint crossing this tick.
 *
 * Returns the latest checkpoint the player crossed between `prevZ` and
 * `currZ`, or `null` when no checkpoint was crossed. Pure: same arguments
 * always return the same checkpoint reference (or null).
 *
 * Inputs:
 *
 *   - `prevZ`, `currZ`: lap-local z positions at the start and end of
 *     this tick. Both must be in `[0, trackLengthMeters)`. Callers compute
 *     this as `((car.z mod L) + L) mod L`.
 *   - `trackLengthMeters`: total compiled track length, used to detect
 *     and unwrap lap-rollover.
 *   - `segmentLengthMeters`: per-segment length used to convert a
 *     checkpoint's `segmentIndex` to a z position. Always `SEGMENT_LENGTH`
 *     in production (`src/road/constants.ts`).
 *   - `checkpoints`: ordered checkpoint list.
 *
 * Behaviour:
 *
 *   - Empty `checkpoints` always returns `null`.
 *   - Forward crossing within the same lap: returns the highest-z
 *     checkpoint in the (`prevZ`, `currZ`] window.
 *   - Wrap-around (`currZ < prevZ`): synthesises a window
 *     `(prevZ, currZ + trackLengthMeters]` and tests every checkpoint at
 *     `cpZ` AND at `cpZ + trackLengthMeters` against that window. A
 *     checkpoint placed at `segmentIndex = 0` (start line) is detected on
 *     the wrap, not on the way up to `prevZ`.
 *   - Reverse motion (`currZ < prevZ` AND not a wrap): returns `null`.
 *     The detector treats a backwards spin as no-op since pass direction
 *     is unidirectional.
 *   - Negative or non-finite inputs return `null` (defensive guard for
 *     pre-countdown ticks where car z may be 0).
 *   - Multi-pass per tick: returns the LAST crossed checkpoint. With the
 *     `loop`'s 250 ms accumulator cap and the 60 Hz step, this can only
 *     happen with adjacent checkpoints in misconfigured authoring; the
 *     "last" rule keeps the API simple (one event per tick) and
 *     deterministic (stable order via the loop below).
 *   - Movement window > half the track length: returns `null`. The
 *     direction of crossing is ambiguous past that point; the loop's
 *     accumulator cap makes this structurally impossible at 60 Hz.
 */
export function detectCheckpointPass(
  prevZ: number,
  currZ: number,
  trackLengthMeters: number,
  segmentLengthMeters: number,
  checkpoints: ReadonlyArray<CheckpointInput>,
): CheckpointInput | null {
  if (checkpoints.length === 0) return null;
  if (!Number.isFinite(prevZ) || !Number.isFinite(currZ)) return null;
  if (!Number.isFinite(trackLengthMeters) || trackLengthMeters <= 0) return null;
  if (!Number.isFinite(segmentLengthMeters) || segmentLengthMeters <= 0) {
    return null;
  }

  // Decide whether this is a wrap (currZ jumped backward across the
  // start line) or a reverse (the player physically backed up). Anything
  // larger than half the track is treated as a wrap; anything within
  // half the track in the negative direction is a reverse spin.
  const halfTrack = trackLengthMeters / 2;
  const delta = currZ - prevZ;
  let windowEnd: number;
  if (delta >= 0) {
    // Forward motion within the same lap.
    if (delta > halfTrack) return null;
    windowEnd = currZ;
  } else if (delta <= -halfTrack) {
    // Wrap: the lap rolled. Unwrap by adding one track length.
    windowEnd = currZ + trackLengthMeters;
    // Defensive cap: if even the unwrapped delta exceeds half the track
    // (very large dt), treat as ambiguous and bail.
    if (windowEnd - prevZ > halfTrack) return null;
  } else {
    // Reverse spin within the same lap.
    return null;
  }

  // Walk every checkpoint and pick the LAST one whose z falls in the
  // window (prevZ, windowEnd]. We test both `cpZ` (within the same lap)
  // and `cpZ + trackLengthMeters` (within the wrapped window) so the
  // detector is symmetric across lap boundaries.
  let best: { cp: CheckpointInput; z: number } | null = null;
  for (const cp of checkpoints) {
    const cpZBase = cp.segmentIndex * segmentLengthMeters;
    // Two candidate positions: lap-local z and wrapped z.
    const candidates = [cpZBase, cpZBase + trackLengthMeters];
    for (const candidateZ of candidates) {
      if (candidateZ > prevZ && candidateZ <= windowEnd) {
        if (best === null || candidateZ > best.z) {
          best = { cp, z: candidateZ };
        } else if (
          candidateZ === best.z &&
          stableCheckpointTieBreak(cp, best.cp) < 0
        ) {
          best = { cp, z: candidateZ };
        }
      }
    }
  }
  return best?.cp ?? null;
}

/**
 * Stable tie-break for two checkpoints that share the same z. Lex on the
 * label so two checkpoints at the same segment-index still order
 * deterministically across runs. Returns negative when `a` should win
 * the tie, positive when `b` wins, zero when both are identical.
 */
function stableCheckpointTieBreak(
  a: CheckpointInput,
  b: CheckpointInput,
): number {
  if (a.label < b.label) return -1;
  if (a.label > b.label) return 1;
  return 0;
}

/**
 * Apply a forward checkpoint pass to the race state. Pure: returns a
 * fresh `RaceState` value, never mutates the input.
 *
 * Adds the checkpoint's `segmentIndex` to `passedCheckpointsThisLap` and
 * stamps `lastCheckpoint` with the tick, segment index, label, and a
 * defensive shallow copy of the player car's state.
 *
 * Idempotent on a same-checkpoint replay: if the segment index is already
 * present in `passedCheckpointsThisLap`, the set is reused (no allocation)
 * but `lastCheckpoint` is still re-stamped because a checkpoint can be
 * legitimately re-crossed after the lap rolls over and the set was
 * cleared. The set is not cleared until `resetCheckpointsForNewLap`
 * runs at the lap-boundary tick.
 */
export function applyCheckpointPass(
  state: Readonly<RaceState>,
  checkpoint: CheckpointInput,
  tick: number,
  carState: Readonly<CarState>,
): RaceState {
  const next = state.passedCheckpointsThisLap.has(checkpoint.segmentIndex)
    ? state.passedCheckpointsThisLap
    : addToFrozenSet(state.passedCheckpointsThisLap, checkpoint.segmentIndex);
  return {
    ...state,
    lastCheckpoint: {
      tick,
      segmentIndex: checkpoint.segmentIndex,
      label: checkpoint.label,
      carState: { ...carState },
    },
    passedCheckpointsThisLap: next,
  };
}

/**
 * Reset the per-lap pass set on a lap rollover. Pure: returns a fresh
 * state value with `passedCheckpointsThisLap` reset to an empty frozen
 * set and `lastCheckpoint` preserved (the most recently passed
 * checkpoint stays meaningful across lap boundaries for the §6
 * practice resetToCheckpoint consumer).
 */
export function resetCheckpointsForNewLap(state: Readonly<RaceState>): RaceState {
  return {
    ...state,
    passedCheckpointsThisLap: EMPTY_PASSED_SET,
  };
}

/**
 * §7 anti-shortcut guard: true iff every checkpoint declared on the
 * track has been passed since the last `resetCheckpointsForNewLap`.
 *
 * Vacuously true when the track has zero checkpoints (so a track with
 * no anti-shortcut authoring does not deadlock the lap counter).
 *
 * Pure: same inputs always return the same boolean.
 */
export function hasPassedAllCheckpoints(
  state: Readonly<RaceState>,
  track: Readonly<CheckpointBearingTrack>,
): boolean {
  if (track.checkpoints.length === 0) return true;
  for (const cp of track.checkpoints) {
    if (!state.passedCheckpointsThisLap.has(cp.segmentIndex)) {
      return false;
    }
  }
  return true;
}

/**
 * Frozen empty set reused as the initial value of
 * `passedCheckpointsThisLap` so a fresh `RaceState` does not allocate a
 * new set per session. The set is read-only at the type level
 * (`ReadonlySet<number>`); the `Object.freeze` call makes the prototype
 * surface read-only at runtime so a misbehaving consumer cannot mutate
 * the shared instance.
 */
export const EMPTY_PASSED_SET: ReadonlySet<number> = Object.freeze(new Set<number>());

/**
 * Build a fresh frozen set with `value` added to `prev`. Pure: input is
 * not mutated. The returned set is also frozen so a consumer that
 * accidentally narrows the type to `Set<number>` cannot mutate the
 * snapshot held by the immutable `RaceState`.
 */
function addToFrozenSet(
  prev: ReadonlySet<number>,
  value: number,
): ReadonlySet<number> {
  const next = new Set<number>(prev);
  next.add(value);
  return Object.freeze(next);
}
