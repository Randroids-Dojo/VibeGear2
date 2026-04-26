/**
 * Ghost replay recorder and player.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * "Ghost replay" and §15 "Replay tests" under the testing approach.
 * Implementation plan: `docs/IMPLEMENTATION_PLAN.md` Phase 5.
 *
 * What this module ships:
 *
 *   - `createRecorder(opts)` returns a stateful recorder that captures one
 *     `Input` per fixed-step tick. Inputs are stored as deltas: only the
 *     fields that changed since the prior tick are kept. Typical Time
 *     Trial laps hold most input axes constant for many ticks, so delta
 *     encoding cuts the in-memory footprint by an order of magnitude vs
 *     a per-tick snapshot.
 *   - `createPlayer(replay)` returns a stateful playback that walks the
 *     deltas back into a per-tick `Input` stream. Once the recording is
 *     exhausted, the player returns `NEUTRAL_INPUT` so the ghost car
 *     coasts to a stop under the same physics step that drives the live
 *     car instead of mashing throttle off the end of the recording.
 *   - `Replay` is the on-the-wire shape. The shape is JSON-serialisable
 *     (no `Uint8Array`, no functions) so the future save-integration
 *     slice (F-NNN below) can persist it without inventing an encoder
 *     in the same PR.
 *
 * Why a stateful recorder rather than a pure `record(prior, input) ->
 * priorPlusInput` reducer? The mainline race session already owns a
 * mutable recorder reference (one per session). Forcing the caller to
 * thread the prior recording through every tick would either churn
 * thousands of objects per lap or push the call site to mutate anyway.
 * The recorder is internally pure: every call advances state in a way
 * that is testable and replayable, just behind a smaller public API.
 *
 * Determinism contract:
 *
 *   - The same sequence of `(input, tick)` calls into the recorder
 *     produces a `Replay` whose JSON serialisation is byte-stable. Tests
 *     pin this with `JSON.stringify` round-trip equality, not an `eql`
 *     deep-compare, so a future struct-field reorder shows up as a test
 *     failure.
 *   - `createPlayer(replay).readNext(tick)` returns the exact same `Input`
 *     the recorder saw on the same tick number. Bit-exact, not "within
 *     tolerance": per AGENTS.md RULE 8 the simulation is deterministic
 *     end-to-end, so any wobble here is a bug in the recorder, not a
 *     tolerance window.
 *   - The replay carries a `physicsVersion` stamp from
 *     `src/game/physics.ts`. A player constructed with a stamp that does
 *     not match the runtime's `PHYSICS_VERSION` returns `null` from
 *     `readNext` and reports `mismatchReason` so the caller can fall
 *     back gracefully (typically by hiding the ghost and logging once).
 *
 * Storage caps (per the dot stress-test, item 5):
 *
 *   - Soft cap at `RECORDER_SOFT_CAP_TICKS` (5 minutes at 60 Hz). The
 *     recorder calls the supplied `onSoftCap` callback once when the cap
 *     is crossed so a HUD slice can warn the driver. Recording continues.
 *   - Hard cap at `RECORDER_HARD_CAP_TICKS` (15 minutes at 60 Hz). The
 *     recorder rejects further `record` calls and `finalize` returns the
 *     replay truncated at the cap with `truncated: true`. Endurance
 *     modes (post v1.0) need a streaming recorder; that work is filed
 *     as a followup, not done here.
 *
 * Out of scope for this slice (filed as followups):
 *
 *   - Save schema integration (`src/data/schemas.ts` `SaveGameSchema`
 *     gains a `ghosts` field, plus a v2 -> v3 migration). This landed
 *     after the recorder producer slice, so the remaining consumer work
 *     is Time Trial route wiring rather than schema allocation.
 *   - Renderer integration (`src/render/pseudoRoadCanvas.ts` accepts a
 *     translucent ghost car). Drawing a ghost requires the ghost car
 *     sprite atlas frames, which arrive with the visual-polish slice.
 *   - Time Trial UI wiring ("save as PB ghost" button). Filed alongside
 *     the time-trial dot.
 *   - Track / car / upgrades validation. The replay carries a `trackId`,
 *     `carId`, and `seed`, but the player does not enforce that the
 *     consumer's runtime matches; the consumer (race session) is in a
 *     better position to decide whether a track / car mismatch should
 *     reject the replay or render it under the wrong skin.
 */

import { FIXED_STEP_MS } from "./loop";
import { PHYSICS_VERSION } from "./physics";
import { NEUTRAL_INPUT, type Input } from "./input";

// Format & cap constants -------------------------------------------------

/**
 * On-the-wire format version. Increment when the `Replay` struct shape
 * changes (new fields, renamed fields, removed fields). Separate from
 * `physicsVersion`: a format change does not necessarily imply a physics
 * change, and vice versa.
 */
export const REPLAY_FORMAT_VERSION = 1;

/** Five minutes at 60 Hz. Soft cap; recorder warns and keeps recording. */
export const RECORDER_SOFT_CAP_TICKS = 60 * 60 * 5;

/** Fifteen minutes at 60 Hz. Hard cap; recorder rejects further input. */
export const RECORDER_HARD_CAP_TICKS = 60 * 60 * 15;

// Replay shape -----------------------------------------------------------

/**
 * Input fields the recorder watches. Each entry is one bit in the per
 * tick `changedMask` so the recorder can record "throttle changed,
 * nothing else did" in a single number rather than copying the full
 * eight-field record.
 *
 * The order is load-bearing for the on-the-wire format: shifting an
 * entry in this list changes the bit positions, which changes the
 * meaning of every recorded delta. A reorder must bump
 * `REPLAY_FORMAT_VERSION`.
 */
export const INPUT_FIELDS = [
  "steer",
  "throttle",
  "brake",
  "nitro",
  "handbrake",
  "pause",
  "shiftUp",
  "shiftDown",
] as const satisfies readonly (keyof Input)[];

/**
 * One entry per recorded tick at which at least one input field
 * changed. Ticks where every field matched the prior tick are not
 * stored at all; the player fills those in by repeating the last
 * delta.
 *
 * Layout:
 *   - `tick`: u32 tick index since `record` started. Always strictly
 *     greater than the prior delta's `tick`.
 *   - `mask`: u8 bitmask. Bit `i` set means `INPUT_FIELDS[i]` is in the
 *     `values` array. Mask `0` is illegal (a no-change tick is not
 *     stored at all).
 *   - `values`: parallel array. One entry per set bit in `mask`, in the
 *     bit order defined by `INPUT_FIELDS`. Number for numeric fields,
 *     boolean for boolean fields.
 */
export interface ReplayDelta {
  tick: number;
  mask: number;
  values: Array<number | boolean>;
}

/**
 * Self-describing replay payload. JSON-serialisable: no typed arrays,
 * no functions. The future save-integration slice can `JSON.stringify`
 * this directly into a save slot.
 *
 * Fields:
 *
 *   - `formatVersion`: bumped when this struct's shape changes.
 *   - `physicsVersion`: bumped when the physics math changes. The
 *     player rejects on mismatch.
 *   - `fixedStepMs`: pinned at recording time. The player rejects on
 *     mismatch so a future loop-rate change cannot silently make old
 *     ghosts run at the wrong speed.
 *   - `trackId`, `trackVersion`, `carId`: descriptive only. The player
 *     does not enforce these; the race session decides whether a
 *     track / car mismatch is a hard reject (typical) or a "render
 *     anyway under the wrong skin" (debug only).
 *   - `seed`: u32 race seed. Carried so the consumer can re-seed its
 *     PRNG and reproduce the AI / weather / damage rolls that the
 *     recorded run experienced.
 *   - `totalTicks`: number of fixed-step ticks the recorder accepted.
 *     Authoritative; the player uses this rather than scanning
 *     `deltas` so an empty-deltas replay (driver held neutral the
 *     whole way) still has a defined finish.
 *   - `finalTimeMs`: race time at finalize, derived from `totalTicks
 *     * fixedStepMs`. HUD reads this for the "PB" comparison without
 *     re-walking the replay.
 *   - `truncated`: `true` if the recorder hit the hard cap before
 *     `finalize` was called. The replay is still valid, just clipped.
 *   - `deltas`: per-tick changes. Empty for "driver held neutral the
 *     whole way"; one entry per tick that differed from the prior tick
 *     otherwise.
 */
export interface Replay {
  formatVersion: number;
  physicsVersion: number;
  fixedStepMs: number;
  trackId: string;
  trackVersion: number;
  carId: string;
  seed: number;
  totalTicks: number;
  finalTimeMs: number;
  truncated: boolean;
  deltas: ReplayDelta[];
}

// Recorder ---------------------------------------------------------------

/**
 * Construction options for `createRecorder`. The recorder needs the
 * descriptive context (track, car, seed) up front so `finalize` can
 * stamp it without the caller passing the same fields twice.
 */
export interface RecorderOptions {
  trackId: string;
  trackVersion: number;
  carId: string;
  seed: number;
  /**
   * Optional notification when the recorder crosses the soft cap. Fires
   * exactly once per recorder, on the tick that takes
   * `recordedTicks > RECORDER_SOFT_CAP_TICKS` true. The HUD slice will
   * use this to surface a "you've been recording for 5 minutes" warning.
   */
  onSoftCap?: () => void;
}

/**
 * Live recorder. Holds the prior `Input` and the running list of deltas.
 *
 * Methods:
 *
 *   - `record(input, tick)`: append a delta if anything differs from the
 *     prior input. Returns `true` when accepted, `false` when the hard
 *     cap rejected the call. The first call always records (there is no
 *     prior input to compare against; the recorder uses `NEUTRAL_INPUT`
 *     as the implicit zero).
 *   - `finalize()`: snapshots the recorder into a `Replay`. Idempotent:
 *     calling `finalize` twice returns equivalent replays. The recorder
 *     stays usable after `finalize`; the `record` accept-or-reject
 *     contract is unchanged.
 *   - `recordedTicks`: number of `record` calls accepted so far. Read
 *     by the soft-cap warning UI.
 *   - `truncated`: whether the hard cap has been crossed.
 */
export interface Recorder {
  record(input: Input, tick: number): boolean;
  finalize(): Replay;
  readonly recordedTicks: number;
  readonly truncated: boolean;
}

/**
 * Build a fresh recorder. The recorder starts with an implicit
 * `NEUTRAL_INPUT` prior so the first `record` call writes a delta
 * containing every non-neutral field. This is correct: a Time Trial
 * starts on the line with throttle off, brakes off, steering centered,
 * and the recorder should not assume the first tick mirrors that.
 *
 * Tick numbering: the caller chooses. The recorder requires only that
 * ticks strictly increase across `record` calls. The race session uses
 * `0`-based tick indices off the green-light tick; tests use whatever
 * is convenient.
 */
export function createRecorder(options: RecorderOptions): Recorder {
  const trackId = options.trackId;
  const trackVersion = options.trackVersion;
  const carId = options.carId;
  const seed = options.seed >>> 0;
  const onSoftCap = options.onSoftCap;

  let prior: Input = { ...NEUTRAL_INPUT };
  let lastTick = -1;
  let acceptedTicks = 0;
  let softCapFired = false;
  let truncated = false;
  const deltas: ReplayDelta[] = [];

  function record(input: Input, tick: number): boolean {
    if (!Number.isInteger(tick) || tick < 0) {
      throw new TypeError(`tick must be a non-negative integer, got ${String(tick)}`);
    }
    if (tick <= lastTick) {
      throw new RangeError(
        `tick must strictly increase: got ${tick}, prior was ${lastTick}`,
      );
    }
    if (acceptedTicks >= RECORDER_HARD_CAP_TICKS) {
      truncated = true;
      return false;
    }

    const delta = diffInputs(prior, input);
    if (delta !== null) {
      deltas.push({ tick, mask: delta.mask, values: delta.values });
    }
    prior = { ...input };
    lastTick = tick;
    acceptedTicks += 1;

    if (!softCapFired && acceptedTicks > RECORDER_SOFT_CAP_TICKS) {
      softCapFired = true;
      try {
        onSoftCap?.();
      } catch {
        // Soft-cap callback failures must never break recording.
      }
    }

    return true;
  }

  function finalize(): Replay {
    return {
      formatVersion: REPLAY_FORMAT_VERSION,
      physicsVersion: PHYSICS_VERSION,
      fixedStepMs: FIXED_STEP_MS,
      trackId,
      trackVersion,
      carId,
      seed,
      totalTicks: acceptedTicks,
      finalTimeMs: acceptedTicks * FIXED_STEP_MS,
      truncated,
      // Defensive copy so a post-finalize `record` cannot mutate a replay
      // a caller already holds.
      deltas: deltas.map(cloneDelta),
    };
  }

  return {
    record,
    finalize,
    get recordedTicks() {
      return acceptedTicks;
    },
    get truncated() {
      return truncated;
    },
  };
}

// Player -----------------------------------------------------------------

/** Reasons a `Player` can refuse to play a `Replay`. */
export type ReplayRejectReason =
  | "format-version-mismatch"
  | "physics-version-mismatch"
  | "fixed-step-mismatch"
  | "malformed-replay";

/**
 * Player-side handle. Reads inputs out by tick number rather than as an
 * iterator so the caller can drive the player from the same fixed-step
 * loop that drives the live car: pass `tick`, get the input the recorder
 * saw on that tick.
 *
 * Methods:
 *
 *   - `readNext(tick)`: return the input the recorder saw on this
 *     tick. Returns `NEUTRAL_INPUT` once the recording is exhausted so
 *     the ghost coasts to a stop under physics. Returns `null` if the
 *     replay was rejected at construction time (see `mismatchReason`).
 *     Callers that want a hard "stop drawing the ghost" signal should
 *     check `finished` instead of comparing inputs.
 *   - `finished`: `true` once the player has handed out the last
 *     recorded tick (i.e. `tick >= replay.totalTicks`). Latches; never
 *     flips back to false.
 *   - `mismatchReason`: non-null when the replay was rejected. The
 *     player still returns `null` from every `readNext` call so the
 *     consumer's "ghost car" branch becomes a no-op without a separate
 *     guard.
 */
export interface Player {
  readNext(tick: number): Input | null;
  readonly finished: boolean;
  readonly mismatchReason: ReplayRejectReason | null;
}

/**
 * Build a player from a recorded replay. Validates the replay's stamps
 * against the runtime's expectations up front so the consumer can
 * decide whether to skip ghost rendering for the whole race rather
 * than tick-by-tick.
 *
 * Validation:
 *
 *   - Format version must equal `REPLAY_FORMAT_VERSION`.
 *   - Physics version must equal `PHYSICS_VERSION`.
 *   - Fixed step must equal `FIXED_STEP_MS`.
 *   - `totalTicks` must be a non-negative integer.
 *   - `deltas` must be an array of well-shaped entries with strictly
 *     increasing `tick` indices, all within `[0, totalTicks)`. Bad
 *     deltas reject the whole replay rather than skipping the offender:
 *     a replay we cannot trust to be deterministic is worse than no
 *     replay at all.
 *
 * The validation step is the one place where this module reads more
 * than it writes. Everything else is straight-line state machine.
 */
export function createPlayer(replay: Replay): Player {
  const reason = validateReplay(replay);
  if (reason !== null) {
    return {
      readNext: () => null,
      get finished() {
        return true;
      },
      mismatchReason: reason,
    };
  }

  let nextDeltaIndex = 0;
  let current: Input = { ...NEUTRAL_INPUT };
  let finishedFlag = replay.totalTicks === 0;

  function readNext(tick: number): Input {
    if (tick >= replay.totalTicks) {
      finishedFlag = true;
      return { ...NEUTRAL_INPUT };
    }
    while (
      nextDeltaIndex < replay.deltas.length
      && replay.deltas[nextDeltaIndex]!.tick <= tick
    ) {
      const delta = replay.deltas[nextDeltaIndex]!;
      current = applyDelta(current, delta);
      nextDeltaIndex += 1;
    }
    if (tick === replay.totalTicks - 1) {
      finishedFlag = true;
    }
    return { ...current };
  }

  return {
    readNext,
    get finished() {
      return finishedFlag;
    },
    mismatchReason: null,
  };
}

// Internals --------------------------------------------------------------

interface BuiltDelta {
  mask: number;
  values: Array<number | boolean>;
}

/**
 * Diff two inputs. Returns `null` when every field matches (so the
 * recorder skips the tick entirely) or a `{ mask, values }` pair
 * otherwise. The mask bit order is `INPUT_FIELDS`; values are pushed
 * in the same order so the player can walk them in lockstep.
 */
function diffInputs(prior: Input, next: Input): BuiltDelta | null {
  let mask = 0;
  const values: Array<number | boolean> = [];
  for (let i = 0; i < INPUT_FIELDS.length; i += 1) {
    const key = INPUT_FIELDS[i]!;
    const a = prior[key];
    const b = next[key];
    if (a !== b) {
      mask |= 1 << i;
      values.push(b as number | boolean);
    }
  }
  if (mask === 0) return null;
  return { mask, values };
}

/**
 * Apply one delta to the running input. Returns a new object; never
 * mutates the input. The bit walk is deliberately the inverse of
 * `diffInputs` so a recorder / player round-trip cannot drift.
 */
function applyDelta(current: Input, delta: ReplayDelta): Input {
  const next: Input = { ...current };
  let valueIndex = 0;
  for (let i = 0; i < INPUT_FIELDS.length; i += 1) {
    if ((delta.mask & (1 << i)) === 0) continue;
    const key = INPUT_FIELDS[i]!;
    const raw = delta.values[valueIndex];
    valueIndex += 1;
    // The cast is safe because `diffInputs` only ever writes the
    // matching type per field. A malformed replay is filtered out by
    // `validateReplay` before we get here.
    (next as unknown as Record<string, number | boolean>)[key] = raw as
      | number
      | boolean;
  }
  return next;
}

function cloneDelta(delta: ReplayDelta): ReplayDelta {
  return { tick: delta.tick, mask: delta.mask, values: delta.values.slice() };
}

/**
 * Reject a replay if any of the load-bearing invariants fail. Returns
 * `null` when the replay is acceptable. The list of checks here is the
 * companion to the dot stress-test items 6 (physics version), 1
 * (format version), and 12 (malformed deltas).
 */
function validateReplay(replay: Replay): ReplayRejectReason | null {
  if (replay.formatVersion !== REPLAY_FORMAT_VERSION) {
    return "format-version-mismatch";
  }
  if (replay.physicsVersion !== PHYSICS_VERSION) {
    return "physics-version-mismatch";
  }
  if (replay.fixedStepMs !== FIXED_STEP_MS) {
    return "fixed-step-mismatch";
  }
  if (
    !Number.isInteger(replay.totalTicks)
    || replay.totalTicks < 0
    || !Array.isArray(replay.deltas)
  ) {
    return "malformed-replay";
  }
  let priorTick = -1;
  for (const delta of replay.deltas) {
    if (
      delta === null
      || typeof delta !== "object"
      || !Number.isInteger(delta.tick)
      || delta.tick < 0
      || delta.tick >= replay.totalTicks
      || delta.tick <= priorTick
    ) {
      return "malformed-replay";
    }
    if (
      typeof delta.mask !== "number"
      || delta.mask <= 0
      || delta.mask > 0xff
      || !Array.isArray(delta.values)
    ) {
      return "malformed-replay";
    }
    const expectedValueCount = popcount8(delta.mask);
    if (delta.values.length !== expectedValueCount) {
      return "malformed-replay";
    }
    priorTick = delta.tick;
  }
  return null;
}

/**
 * Population count for an 8-bit mask. Used to validate that a delta's
 * `values` length matches the number of set bits in its `mask`.
 */
function popcount8(mask: number): number {
  let count = 0;
  let m = mask & 0xff;
  while (m !== 0) {
    count += m & 1;
    m >>>= 1;
  }
  return count;
}

// PB selection -----------------------------------------------------------

/**
 * Pick which of two replays to keep as the §6 Time Trial PB ghost for
 * one track. Pure function: takes the currently stored replay (may be
 * `null` / `undefined` when no PB exists yet) and a freshly recorded
 * candidate, and returns whichever should sit in the save.
 *
 * Selection rule (per the F-021 dot stress-test item 8):
 *
 *   - When no current ghost exists, the candidate becomes the PB.
 *   - When a current ghost exists, the candidate replaces it iff the
 *     candidate's `finalTimeMs` is *strictly* less. Equal times keep
 *     the older ghost so a player who runs the same exact lap on
 *     repeated attempts does not churn the save (and the cross-tab
 *     storage event) on every neutral-result attempt.
 *   - When the candidate is `null` / `undefined`, the current ghost is
 *     kept verbatim. This lets the call site funnel "did the run
 *     finish at all?" through the same selector without an extra guard.
 *
 * The function never mutates either input. The returned reference is
 * either the current ghost or the candidate (one of the input objects)
 * so a `===` identity check on the caller side reveals whether the
 * candidate won.
 */
export function bestGhostFor(
  current: Replay | null | undefined,
  candidate: Replay | null | undefined,
): Replay | null {
  if (!candidate) {
    return current ?? null;
  }
  if (!current) {
    return candidate;
  }
  return candidate.finalTimeMs < current.finalTimeMs ? candidate : current;
}
