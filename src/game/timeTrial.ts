/**
 * Time Trial recorder lifecycle orchestrator.
 *
 * Wraps the §6 Time Trial mode's ghost-recorder lifecycle around the pure
 * race-session reducer in `src/game/raceSession.ts`. The orchestrator is
 * the seam between the per-tick simulation (which knows about `phase` /
 * `tick` / `Input`) and the producer module in `src/game/ghost.ts`
 * (which knows how to encode an input stream into a `Replay`).
 *
 * Source of truth:
 *   - `docs/gdd/06-game-modes-and-progression.md` (§6 Time Trial mode).
 *   - `docs/gdd/22-data-schemas.md` (`SaveGameSchema.ghosts`).
 *   - `docs/FOLLOWUPS.md` F-023 (this slice).
 *
 * Why a separate orchestrator instead of folding the recorder into
 * `raceSession.ts`:
 *
 *   - The pure race-session reducer is mode-agnostic. Practice, quick
 *     race, championship, and time trial all share the same per-tick
 *     reducer. Only Time Trial records a ghost, and only Time Trial
 *     reads a previously-stored PB. Folding the recorder in would
 *     either pay for it on every mode (waste) or branch on a `mode`
 *     flag inside the reducer (mixes concerns and forces every other
 *     mode test to grow a ghost-disabled fixture).
 *   - The orchestrator owns its own state machine: `idle` -> `recording`
 *     -> `finished`. It observes phase transitions on the race session
 *     state rather than driving them. The race-session reducer does not
 *     gain a recorder reference and does not change at all.
 *   - Composition stays testable: feeding the orchestrator a synthetic
 *     `(phase, tick, input)` sequence covers every transition without
 *     spinning up a track, AI grid, or physics step.
 *
 * Public surface:
 *
 *   - `createTimeTrialRecorder(options)` returns a stateful orchestrator
 *     keyed by the recording session.
 *   - `applyTimeTrialResult(currentGhost, replay)` is a thin wrapper
 *     around `bestGhostFor` so the call site can funnel the candidate
 *     replay through one PB-decision helper rather than re-importing
 *     `bestGhostFor` and re-stating the "skip if null" guard.
 *
 * Out of scope for this slice (filed in FOLLOWUPS):
 *
 *   - The Next.js Time Trial route under `src/app/`. The route needs a
 *     compiled track + UI surface; both land with the time-trial mode
 *     dot. This module is the producer the route will wire on top of.
 *   - Persisting the resulting `Replay` into `SaveGameSchema.ghosts`.
 *     The schema slot already exists (F-021) and `applyTimeTrialResult`
 *     returns the right replay; the actual `saveSave` call is owned by
 *     the route slice.
 *   - HUD soft-cap warning. The recorder fires `onSoftCap` to whatever
 *     callback the orchestrator was constructed with; surfacing that to
 *     the player is the HUD slice's job.
 */

import type { Input } from "./input";
import {
  bestGhostFor,
  createRecorder,
  type Recorder,
  type RecorderOptions,
  type Replay,
} from "./ghost";
import type { RacePhase } from "./raceState";

/**
 * Construction options for `createTimeTrialRecorder`. Mirrors
 * `RecorderOptions` from `src/game/ghost.ts` so the orchestrator can
 * forward fields verbatim, plus the lifecycle phases the orchestrator
 * needs but the inner recorder does not.
 */
export interface TimeTrialRecorderOptions extends RecorderOptions {
  /**
   * Optional notification when the orchestrator finalises a replay.
   * Fires exactly once per recording, on the tick the race session
   * flips to `finished`. The argument is the freshly-finalised
   * `Replay`; the call site can route this into `applyTimeTrialResult`
   * + `saveSave` without holding a reference to the orchestrator.
   *
   * Errors thrown by the callback are swallowed: a failure in the
   * persistence pipeline must not crash the simulation tick that
   * triggered the finalise. The replay is still available via
   * `getReplay()` after a failed callback so the caller can retry.
   */
  onFinalize?: (replay: Replay) => void;
}

/**
 * Snapshot of the orchestrator's lifecycle phase. The four states are
 * load-bearing: a UI surface can read this to decide whether to render
 * a "recording" badge, whether to enable the "save as PB" button, and
 * whether the replay is ready to persist.
 */
export type TimeTrialRecorderPhase =
  /** No recording in progress. The race is in countdown or has not started. */
  | "idle"
  /** A recorder has been spawned and is consuming ticks. */
  | "recording"
  /** The race finished; the replay is finalised and ready to read. */
  | "finished";

/**
 * Per-tick input the orchestrator needs from the race session. The
 * orchestrator deliberately reads only the small subset of state it
 * cares about (phase + tick) rather than holding a reference to the
 * whole `RaceSessionState`, so the unit tests can drive it from a
 * synthetic transition table without standing up a session.
 */
export interface TimeTrialTickContext {
  /** Race phase **after** the simulation step ran for this tick. */
  phase: RacePhase;
  /**
   * Race-session tick counter **after** the step ran. The race-session
   * reducer resets `tick` to 0 the moment the lights go green and
   * increments by 1 each subsequent racing tick, so this is the same
   * tick number a `bestGhostFor` consumer would compare against.
   *
   * The orchestrator records ticks in order and rejects a non-strictly
   * increasing tick (the same guard `Recorder.record` enforces). The
   * race-session reducer never replays a tick number, so this guard is
   * defence in depth rather than the load-bearing path.
   */
  tick: number;
  /** Player input the simulation step consumed for this tick. */
  input: Input;
}

/**
 * Live time-trial recorder. Internally pure: the only mutation is the
 * inner `Recorder` plus a small phase + replay slot. The same
 * orchestrator instance is reusable across multiple races by calling
 * `reset()`; without reset it remains in `finished` after the race
 * ends and ignores further ticks.
 */
export interface TimeTrialRecorder {
  /**
   * Observe one simulation tick. The orchestrator decides whether to
   * spawn a recorder (transition into `recording`), record the tick,
   * finalise (transition into `finished`), or do nothing.
   *
   * Returns `true` when the tick advanced internal state in any way
   * (spawn, record, finalise). Returns `false` when the tick was
   * ignored (orchestrator is `finished`, or the tick happened during
   * the countdown). Tests use the return value as a cheap "did
   * anything happen?" probe; production callers can ignore it.
   */
  observe(context: TimeTrialTickContext): boolean;
  /**
   * Current orchestrator phase. See `TimeTrialRecorderPhase`.
   */
  readonly phase: TimeTrialRecorderPhase;
  /**
   * The finalised replay, or `null` while the orchestrator has not
   * reached `finished`. Reading this in `recording` returns `null`,
   * not a partial replay; callers that want a mid-race snapshot
   * should call `recorderTicks` instead.
   */
  getReplay(): Replay | null;
  /**
   * Number of ticks the inner recorder has accepted so far. Reads
   * zero until the first `observe` lands a racing tick. Useful for
   * the HUD soft-cap warning surface (the recorder also fires
   * `onSoftCap` when configured; this read is for HUD without
   * forcing the call site to route a callback).
   */
  readonly recordedTicks: number;
  /**
   * `true` once the inner recorder hit the hard cap. Latches; never
   * flips back to `false`. Read by the HUD to swap the soft-cap
   * warning for a "recording stopped" indicator.
   */
  readonly truncated: boolean;
  /**
   * Reset the orchestrator back to `idle`. Drops the existing
   * recorder + replay reference. Intended for "race again" flows
   * where the same orchestrator instance survives across races.
   */
  reset(): void;
}

/**
 * Build a fresh time-trial orchestrator. The orchestrator does not
 * spawn a recorder eagerly; it waits for the first `observe` call
 * with `phase === "racing"` so the recorder's internal tick clock
 * lines up with the race-session tick clock (which resets to 0 on
 * the lights-out tick).
 *
 * The `RecorderOptions` fields are captured by closure and reused
 * for every recorder spawn (including the post-`reset` recorder).
 * A consumer that wants to record a different track / car / seed
 * after `reset` should construct a new orchestrator instead.
 */
export function createTimeTrialRecorder(
  options: TimeTrialRecorderOptions,
): TimeTrialRecorder {
  const { onFinalize, ...recorderOptions } = options;

  let recorder: Recorder | null = null;
  let phase: TimeTrialRecorderPhase = "idle";
  let replay: Replay | null = null;
  let lastObservedTick = -1;

  function spawnRecorder(): void {
    recorder = createRecorder(recorderOptions);
    phase = "recording";
    replay = null;
    lastObservedTick = -1;
  }

  function finalize(): void {
    if (recorder === null) {
      // Defensive: the racing -> finished transition cannot fire
      // without a prior racing tick spawning a recorder, but if a
      // future caller wires the orchestrator to a custom phase
      // sequence (skipping the recording phase) the finalise has
      // nothing to do. Stay in the prior phase so the caller can
      // tell something went wrong.
      return;
    }
    replay = recorder.finalize();
    phase = "finished";
    if (onFinalize !== undefined) {
      try {
        onFinalize(replay);
      } catch {
        // Persistence callbacks must never crash the simulation tick.
      }
    }
  }

  function observe(context: TimeTrialTickContext): boolean {
    if (phase === "finished") {
      // Already done; the orchestrator ignores subsequent ticks.
      // A consumer that wants to record a new race must call
      // `reset()` first.
      return false;
    }

    if (context.phase === "countdown") {
      // Countdown ticks are deliberately ignored. The recorder lifecycle
      // starts the first tick the lights are out so the recorded tick
      // numbers line up with the race-session `tick` clock (which the
      // race-session reducer resets to 0 on the green-light tick).
      return false;
    }

    if (context.phase === "racing") {
      if (recorder === null) {
        spawnRecorder();
      }
      // The recorder's `record` enforces strictly increasing ticks. The
      // orchestrator mirrors that guard so a duplicate observe (e.g. a
      // misbehaving caller calling `observe` twice for the same tick)
      // is a no-op rather than a thrown error from inside the recorder.
      if (context.tick <= lastObservedTick) {
        return false;
      }
      // `spawnRecorder` always assigns; the local narrowing TS does
      // here is not strong enough to see it, so re-snapshot here.
      const live = recorder!;
      const accepted = live.record(context.input, context.tick);
      if (accepted) {
        lastObservedTick = context.tick;
      }
      return accepted;
    }

    if (context.phase === "finished") {
      finalize();
      return true;
    }

    return false;
  }

  function reset(): void {
    recorder = null;
    phase = "idle";
    replay = null;
    lastObservedTick = -1;
  }

  return {
    observe,
    get phase() {
      return phase;
    },
    getReplay() {
      return replay;
    },
    get recordedTicks() {
      return recorder?.recordedTicks ?? 0;
    },
    get truncated() {
      return recorder?.truncated ?? false;
    },
    reset,
  };
}

/**
 * Decide whether to overwrite the stored PB ghost for one track. Thin
 * wrapper around `bestGhostFor` from `src/game/ghost.ts`: forwards
 * arguments verbatim, returns whichever replay should sit in the save
 * slot. Existence purely so the Time Trial route slice can call one
 * helper named for its intent ("apply the time-trial result") rather
 * than reaching across modules for the lower-level selector.
 *
 * Use this on the same tick the orchestrator's `phase` flips to
 * `finished` (or in the `onFinalize` callback). The returned reference
 * is either `currentGhost` or `replay`; an `===` identity check on the
 * return value reveals whether the new replay won.
 */
export function applyTimeTrialResult(
  currentGhost: Replay | null | undefined,
  replay: Replay | null | undefined,
): Replay | null {
  return bestGhostFor(currentGhost, replay);
}
