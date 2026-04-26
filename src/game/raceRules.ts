/**
 * Race rules helpers per `docs/gdd/07-race-rules-and-structure.md` and the
 * iter-19 stress-test on dot `VibeGear2-implement-race-rules-b30656ae`.
 *
 * This module is the pure-helpers half of the §7 race rules engine: a
 * side-effect-free module of constants and reducers that the race session
 * (in `raceSession.ts`) consumes from a wiring slice. The split mirrors the
 * pattern already established by `nitro.ts`, `damage.ts`, and `drafting.ts`
 * across the codebase: pure module first, race-session wiring second.
 *
 * What this module owns:
 *
 *   - Countdown labels for the HUD ("3", "2", "1", "GO"). The duration
 *     constant is re-exported from `raceState.ts` so `DEFAULT_COUNTDOWN_SEC`
 *     is the single source of truth.
 *
 *   - DNF (did-not-finish) detection. The §7 spec lists DNF as a fail
 *     state but is silent on the timeout values; the iter-19 stress-test
 *     pinned three thresholds (off-track, no-progress, and a hard race
 *     time limit). `tickDnfTimers` accumulates the per-car windows and
 *     reports the first threshold that trips.
 *
 *   - Per-tick placement ranking. The tie-break ladder is pinned to the
 *     iter-19 stress-test (lap then lap-local z then total distance then
 *     stable lex carId). Finished cars sort ahead of racing cars; DNF
 *     cars sort to the back so the standings strip reads correctly even
 *     mid-tick when a car has just retired.
 *
 *   - The `FinalRaceState` shape and its builder. Reward computation
 *     (cash, points, podium bonuses) is owned by
 *     `economy-upgrade-ff73b279` and consumes this output; the boundary
 *     mirrors the iter-19 stress-test §5 split.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals. Every
 * exported reducer returns a fresh value and never mutates its input
 * (AGENTS.md RULE 8). Frozen initial-state objects are explicitly frozen
 * with `Object.freeze` so a stray spread cannot scribble on the literal
 * the tests assert against.
 */

import { DEFAULT_COUNTDOWN_SEC } from "./raceState";

/**
 * Countdown duration in seconds. Re-exported from `raceState.ts` so the
 * race-session reducer and the HUD label helper read the same constant
 * without a module-graph cycle.
 */
export { DEFAULT_COUNTDOWN_SEC } from "./raceState";

/**
 * Labels the HUD shows during the lights-out countdown. The order is
 * read top-to-bottom: with `DEFAULT_COUNTDOWN_SEC = 3`, the player sees
 * "3" for the first second, "2" for the second, "1" for the third, then
 * "GO" the moment the phase flips to racing.
 *
 * The "GO" label is a transient one-tick frame at the green light and is
 * not part of the countdown's seconds budget; it exists so the HUD can
 * render a single visible frame of "GO" before the racing-phase HUD
 * takes over. The race session consumes this label window via the
 * `phase` field rather than a separate timer; this constant is the
 * source of truth for the strings the HUD renders.
 */
export const COUNTDOWN_TICK_LABELS: ReadonlyArray<string> = Object.freeze([
  "3",
  "2",
  "1",
  "GO",
]);

/**
 * Pick the right countdown label for the HUD at `remainingSec` seconds
 * left in the lights-out countdown. Pure: same input always returns the
 * same string.
 *
 * Behaviour pinned by the iter-19 stress-test §1:
 *
 *   - `remainingSec > 2` reads "3" (we are in the third-to-last second).
 *   - `remainingSec > 1` reads "2".
 *   - `remainingSec > 0` reads "1".
 *   - `remainingSec === 0` reads "GO" (the lights-out frame).
 *
 * Negative or non-finite inputs return "GO" rather than throwing so a
 * caller that subtracts past zero before checking phase still renders
 * a sensible label.
 */
export function labelForCountdown(remainingSec: number): string {
  if (!Number.isFinite(remainingSec) || remainingSec <= 0) return "GO";
  if (remainingSec > 2) return "3";
  if (remainingSec > 1) return "2";
  return "1";
}

// DNF (did-not-finish) detection ------------------------------------------

/**
 * Continuous off-track time (s) before a car is flagged DNF. The §7 spec
 * names DNF as a fail state but does not pin a threshold; the iter-19
 * stress-test §4 pinned 30 s. Long enough that a brief grass excursion
 * after a missed apex is forgiven; short enough that a car parked in the
 * grass eventually retires so the standings can finalise.
 */
export const DNF_OFF_TRACK_TIMEOUT_SEC = 30;

/**
 * Continuous no-progress time (s) before a car is flagged DNF. A car
 * that sits still on-road or that drives in tiny circles will eventually
 * trip this even if it never leaves the track. Threshold pinned by the
 * iter-19 stress-test §4 at 60 s.
 */
export const DNF_NO_PROGRESS_TIMEOUT_SEC = 60;

/**
 * Hard race time limit (s). The race-rules engine flips every still-racing
 * car to DNF and the race phase to "finished" once the elapsed sim time
 * exceeds this cap, so a stuck race cannot block the player forever.
 * Pinned by the iter-19 stress-test §4 at 10 minutes.
 */
export const DNF_RACE_TIME_LIMIT_SEC = 600;

/**
 * Per-window distance (m) a car must cover to count as making progress.
 * The no-progress timer accumulates while `totalDistance - lastProgressMark`
 * stays below this threshold. Pinned at 5 m so a car crawling across the
 * line still resets the window every few seconds and avoids the timeout.
 */
export const DNF_NO_PROGRESS_DELTA_M = 5;

/**
 * Per-car DNF accumulator. Pure data; `tickDnfTimers` returns a fresh
 * value each call.
 *
 * Fields:
 *
 *   - `offTrackSec`: continuous seconds the car has been off the racing
 *     surface. Resets to 0 on the first tick the car is back on-road.
 *   - `noProgressSec`: continuous seconds the car has not advanced by
 *     `DNF_NO_PROGRESS_DELTA_M`. Resets to 0 on the first tick the
 *     advance threshold is crossed.
 *   - `lastProgressMark`: the `totalDistance` value at which the
 *     no-progress window last reset. The next reset trips when
 *     `totalDistance - lastProgressMark >= DNF_NO_PROGRESS_DELTA_M`.
 */
export interface DnfTimers {
  offTrackSec: number;
  noProgressSec: number;
  lastProgressMark: number;
}

/** Frozen initial value for a fresh car. */
export const INITIAL_DNF_TIMERS: Readonly<DnfTimers> = Object.freeze({
  offTrackSec: 0,
  noProgressSec: 0,
  lastProgressMark: 0,
});

/**
 * Per-tick sample the DNF reducer reads from each car. The race session
 * builds these once per tick from the physics output (`offTrack`,
 * `speed`) and the rolling cumulative distance (`totalDistance`).
 *
 * `totalDistance` is the monotonic forward distance for ranking
 * purposes; it is the same field `rankCars` reads. Using one source for
 * both keeps the no-progress window consistent with what the standings
 * strip displays.
 */
export interface DnfSample {
  offTrack: boolean;
  speed: number;
  totalDistance: number;
}

/**
 * Reason a car was flipped to DNF this tick, or `null` if the car is
 * still racing. The string is rendered verbatim by the §20 results-screen
 * widget; pinning the literal here keeps the HUD copy consistent.
 *
 * `retired` is the user-initiated DNF: the player chose Retire from the
 * §20 pause menu. The `tickDnfTimers` reducer never produces this value;
 * it is set by the pure session helper `retireRaceSession` instead so
 * the §7 DNF cell on the results screen can distinguish "ran out of
 * track" from "gave up". Pinned per the dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * `wrecked` is the §13 catastrophic-damage DNF: the per-car
 * `DamageState.total` crossed `WRECK_THRESHOLD` (0.95) so the §13
 * "limp mode or retire" decision flips the car out of the race. The
 * `tickDnfTimers` reducer never produces this value; it is set by the
 * race-session damage-wiring reducer in `stepRaceSession` after
 * `applyHit` / `applyOffRoadDamage` returns a state for which
 * `isWrecked` reads true. Pinned per F-047.
 */
export type DnfReason =
  | "off-track"
  | "no-progress"
  | "retired"
  | "wrecked"
  | null;

export interface DnfTickResult {
  timers: DnfTimers;
  /** True iff the car crossed a DNF threshold this tick. */
  dnf: boolean;
  reason: DnfReason;
}

/**
 * Advance the DNF timers for one car by `dt` seconds. Returns a fresh
 * `DnfTickResult` describing the new timer state plus a `dnf` flag the
 * race-session reducer reads to flip the car's status.
 *
 * Reset rules pinned by the iter-19 stress-test §4:
 *
 *   - `offTrackSec` accumulates while `sample.offTrack && sample.speed`
 *     is below `DNF_OFF_TRACK_RESET_SPEED_M_PER_S` (a parked-in-the-grass
 *     car). It resets to 0 the first tick the car is back on-road OR the
 *     first tick the car is moving at speed (a car blasting through the
 *     gravel trap at full speed is racing, not retired). The two-condition
 *     reset is what the stress-test calls out as the "drove through grass
 *     for 28s, came back for one tick, drove off again" guard.
 *
 *   - `noProgressSec` accumulates while
 *     `sample.totalDistance - timers.lastProgressMark < DNF_NO_PROGRESS_DELTA_M`.
 *     It resets to 0 (and `lastProgressMark` advances) the first tick the
 *     car has covered at least `DNF_NO_PROGRESS_DELTA_M` since the last
 *     reset.
 *
 *   - The hard race time limit (`DNF_RACE_TIME_LIMIT_SEC`) is checked
 *     separately by `exceedsRaceTimeLimit`; this reducer only owns the
 *     per-car windows.
 *
 * The reducer never mutates `prev`. Returning a fresh `timers` object
 * every call keeps replay-safety: a downstream snapshot can hold a
 * reference to any past `timers` and trust it never changes.
 */
export function tickDnfTimers(
  prev: Readonly<DnfTimers>,
  sample: Readonly<DnfSample>,
  dt: number,
): DnfTickResult {
  if (!Number.isFinite(dt) || dt <= 0) {
    return {
      timers: { ...prev },
      dnf: false,
      reason: null,
    };
  }

  // Off-track window. The "and slow" guard means a high-speed grass
  // excursion does not count toward the timeout; only a car that has
  // genuinely stopped or is crawling is on the path to DNF.
  const slow = sample.speed < DNF_OFF_TRACK_RESET_SPEED_M_PER_S;
  const offTrackSec =
    sample.offTrack && slow ? prev.offTrackSec + dt : 0;

  // No-progress window. The travelled-since-last-mark distance gates
  // both the reset and the new mark so the window does not slide
  // inadvertently when the car loops back across the same z.
  const travelled = sample.totalDistance - prev.lastProgressMark;
  let noProgressSec = prev.noProgressSec;
  let lastProgressMark = prev.lastProgressMark;
  if (travelled >= DNF_NO_PROGRESS_DELTA_M) {
    noProgressSec = 0;
    lastProgressMark = sample.totalDistance;
  } else {
    noProgressSec = prev.noProgressSec + dt;
  }

  // Threshold check. Off-track wins ties because the player is more
  // likely to recover from a no-progress stall (e.g. nudged off the
  // grid) than from being stuck off-road; flagging the off-track
  // reason is the more informative outcome for the §20 results screen.
  let dnf = false;
  let reason: DnfReason = null;
  if (offTrackSec >= DNF_OFF_TRACK_TIMEOUT_SEC) {
    dnf = true;
    reason = "off-track";
  } else if (noProgressSec >= DNF_NO_PROGRESS_TIMEOUT_SEC) {
    dnf = true;
    reason = "no-progress";
  }

  return {
    timers: { offTrackSec, noProgressSec, lastProgressMark },
    dnf,
    reason,
  };
}

/**
 * Speed (m/s) under which the off-track window can accumulate. Above
 * this speed, an off-track sample is treated as a high-speed excursion
 * that does not count toward the DNF timeout. The 5 m/s threshold is
 * about 18 km/h, low enough that a car genuinely parked is well below
 * it but a car still rallying through the grass is comfortably above.
 */
export const DNF_OFF_TRACK_RESET_SPEED_M_PER_S = 5;

/**
 * True iff the elapsed sim time has exceeded the hard race time limit.
 * The race-session reducer reads this once per tick and, when it returns
 * true, flips every still-racing car to DNF and the race phase to
 * "finished".
 *
 * Negative inputs return `false` so a caller that ticks before the
 * green light does not accidentally trip the limit. NaN returns
 * `false`; positive infinity returns `true` because a clock reading
 * past every finite limit is past this one.
 */
export function exceedsRaceTimeLimit(elapsedSec: number): boolean {
  if (Number.isNaN(elapsedSec)) return false;
  if (elapsedSec < 0) return false;
  return elapsedSec >= DNF_RACE_TIME_LIMIT_SEC;
}

// Per-tick placement ranking ---------------------------------------------

/**
 * Per-car snapshot the ranking helper reads. The race session builds one
 * of these per car per tick; the resulting list feeds both the §20
 * standings strip and the per-frame ghost / position calculations.
 *
 * Why three forward-progress fields? The tie-break ladder in §3 of the
 * iter-19 stress-test:
 *
 *   1. `lap` (higher wins): a leader on lap 3 outranks a follower on lap
 *      2 even if the follower has a larger raw `z`.
 *
 *   2. `z` (higher wins, within the same lap): the lap-local forward
 *      distance is what the §20 widget shows for "distance to leader".
 *
 *   3. `totalDistance` (higher wins): unambiguous when two cars are
 *      split across a lap boundary on the same physics tick. Belt-and-
 *      braces against rare lap-rollover corner cases.
 *
 *   4. `carId` lex order (smaller wins): deterministic floor so two cars
 *      with otherwise identical progress always rank in the same order
 *      across runs.
 *
 * Status sorting (independent of progress):
 *
 *   - `finished` cars rank ahead of `racing` cars (the race is over for
 *     them; their finishing order is fixed).
 *   - `dnf` cars rank behind everyone (they cannot recover; the standings
 *     strip should show them at the back so a watching player sees the
 *     "live" race at the top).
 *
 * The status partition is applied first; tie-breaks within a partition
 * use the lap / z / totalDistance / carId ladder above. Inside the
 * `finished` partition, the iter-19 stress-test pinned `finishedAtTick`
 * as the tie-break (earliest finish wins). The pure-helpers slice does
 * not yet carry that field on `CarRankSnapshot` to keep the surface
 * minimal; the wiring slice extends the snapshot when it lands. Until
 * then, finished cars are tie-broken by carId lex order, which is
 * deterministic and matches the rest of the ladder.
 */
export interface CarRankSnapshot {
  carId: string;
  lap: number;
  z: number;
  totalDistance: number;
  status: "racing" | "finished" | "dnf";
}

/**
 * Sort `snapshots` into descending placement order: 1st first, last last.
 * Pure: returns a fresh array, does not mutate the input.
 *
 * The result is a `readonly` array because the standings strip and the
 * results-screen builder both treat the order as immutable; if a caller
 * needs a mutable copy they can spread it themselves.
 */
export function rankCars(
  snapshots: ReadonlyArray<CarRankSnapshot>,
): ReadonlyArray<CarRankSnapshot> {
  const copy = snapshots.map((s) => ({ ...s }));
  copy.sort((a, b) => {
    // Status partition first: finished > racing > dnf.
    const ra = STATUS_RANK[a.status];
    const rb = STATUS_RANK[b.status];
    if (ra !== rb) return ra - rb;
    // Within a partition, apply the lap / z / totalDistance / carId ladder.
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.z !== b.z) return b.z - a.z;
    if (a.totalDistance !== b.totalDistance) {
      return b.totalDistance - a.totalDistance;
    }
    if (a.carId < b.carId) return -1;
    if (a.carId > b.carId) return 1;
    return 0;
  });
  return copy;
}

/**
 * Sort key for the status partition. Lower number sorts ahead. Frozen so
 * a future field rename does not silently break the partition order; if
 * a new status is added, this map must be extended in the same change.
 */
const STATUS_RANK: Readonly<Record<CarRankSnapshot["status"], number>> =
  Object.freeze({
    finished: 0,
    racing: 1,
    dnf: 2,
  });

// Final-state builder ----------------------------------------------------

/**
 * Status of a car at the end of the race. `dnf` is the catch-all for any
 * car that retired (wreck, off-track timeout, no-progress timeout, hard
 * race time limit). The reason string is lost at the final-state level;
 * the per-car DNF reason is kept on the in-flight `RaceState` for the
 * §20 results screen widget to render.
 */
export type FinalCarStatus = "finished" | "dnf";

/**
 * Final per-car finishing record. `raceTimeMs` is `null` for DNF cars
 * because they never crossed the finish; `bestLapMs` is `null` if the
 * car never completed a single timed lap.
 */
export interface FinalCarRecord {
  carId: string;
  status: FinalCarStatus;
  raceTimeMs: number | null;
  bestLapMs: number | null;
}

/**
 * Fastest lap across the field. `null` when no car completed a timed
 * lap (e.g. all cars DNF'd inside lap 1). The §20 results screen reads
 * this to render the "Fastest lap" line; the §12 reward dot reads it
 * to credit the fastest-lap bonus.
 */
export interface FastestLap {
  carId: string;
  lapMs: number;
  /** 1-indexed lap number on which the fastest lap was set. */
  lapNumber: number;
}

/**
 * Final shape consumed by `race-results-7b0abfaa` (results screen) and
 * `economy-upgrade-ff73b279` (cash / points / bonuses). The boundary
 * mirrors the iter-19 stress-test §5 split: this dot owns the raw race
 * outcome (positions, lap times, fastest lap); the economy dot consumes
 * it to compute rewards.
 */
export interface FinalRaceState {
  trackId: string;
  totalLaps: number;
  finishingOrder: ReadonlyArray<FinalCarRecord>;
  /**
   * Per-car lap times in ms, indexed by car id. Each value is the
   * ordered list of completed-lap durations. A finished car has
   * `length === totalLaps`; a DNF'd car has `length < totalLaps`. An
   * empty array means the car never completed a lap.
   */
  perLapTimes: Readonly<Record<string, ReadonlyArray<number>>>;
  fastestLap: FastestLap | null;
}

/**
 * Per-car input to `buildFinalRaceState`. The race session builds one of
 * these per car at race-finish from the in-flight `RaceState` (which the
 * wiring slice owns); the builder sorts the records, derives the
 * fastest lap, and returns the immutable final shape.
 *
 * `raceTimeMs` is the elapsed sim time at the moment the car crossed
 * the final start/finish line; for DNF cars it is `null`. `lapTimes` is
 * the same array that lands on `FinalRaceState.perLapTimes`.
 */
export interface FinalCarInput {
  carId: string;
  status: FinalCarStatus;
  raceTimeMs: number | null;
  lapTimes: ReadonlyArray<number>;
}

export interface BuildFinalRaceStateInput {
  trackId: string;
  totalLaps: number;
  cars: ReadonlyArray<FinalCarInput>;
}

/**
 * Build the `FinalRaceState` for a finished race. Pure: same inputs
 * produce a deep-equal output across runs.
 *
 * Finishing order:
 *
 *   - `finished` cars sort ahead of `dnf` cars.
 *   - Within the `finished` partition, ascending `raceTimeMs` (earliest
 *     finish wins). Ties (equal time, rare) break on carId lex order so
 *     the result is deterministic.
 *   - Within the `dnf` partition, descending lap count then descending
 *     last-lap time then carId lex (a car that DNF'd on lap 3 ranks
 *     ahead of a car that DNF'd on lap 1; a car with no laps sorts to
 *     the back).
 *
 * Fastest lap: scan every car's `lapTimes`, pick the smallest value.
 * Ties prefer the lower `lapNumber` (earlier lap), then carId lex
 * order. `null` when no car completed a single lap.
 */
export function buildFinalRaceState(
  input: BuildFinalRaceStateInput,
): FinalRaceState {
  const records: FinalCarRecord[] = input.cars.map((car) => ({
    carId: car.carId,
    status: car.status,
    raceTimeMs: car.raceTimeMs,
    bestLapMs:
      car.lapTimes.length === 0
        ? null
        : Math.min(...car.lapTimes),
  }));

  // Sort the finishing order. The comparator handles the status
  // partition and the within-partition tie-breaks pinned in the
  // function comment.
  records.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "finished" ? -1 : 1;
    }
    if (a.status === "finished") {
      const at = a.raceTimeMs ?? Number.POSITIVE_INFINITY;
      const bt = b.raceTimeMs ?? Number.POSITIVE_INFINITY;
      if (at !== bt) return at - bt;
      return a.carId < b.carId ? -1 : a.carId > b.carId ? 1 : 0;
    }
    // Both DNF.
    const aCar = input.cars.find((c) => c.carId === a.carId);
    const bCar = input.cars.find((c) => c.carId === b.carId);
    const aLaps = aCar?.lapTimes.length ?? 0;
    const bLaps = bCar?.lapTimes.length ?? 0;
    if (aLaps !== bLaps) return bLaps - aLaps;
    const aLast = aCar?.lapTimes[aLaps - 1] ?? Number.POSITIVE_INFINITY;
    const bLast = bCar?.lapTimes[bLaps - 1] ?? Number.POSITIVE_INFINITY;
    if (aLast !== bLast) return aLast - bLast;
    return a.carId < b.carId ? -1 : a.carId > b.carId ? 1 : 0;
  });

  const perLapTimes: Record<string, ReadonlyArray<number>> = {};
  for (const car of input.cars) {
    perLapTimes[car.carId] = car.lapTimes.slice();
  }

  // Fastest lap derivation. Scan once across every (carId, lapIndex)
  // pair so ties prefer the earlier lap as documented.
  let fastestLap: FastestLap | null = null;
  for (const car of input.cars) {
    for (let i = 0; i < car.lapTimes.length; i += 1) {
      const ms = car.lapTimes[i];
      if (ms === undefined) continue;
      if (!Number.isFinite(ms) || ms <= 0) continue;
      const lapNumber = i + 1;
      if (
        fastestLap === null ||
        ms < fastestLap.lapMs ||
        (ms === fastestLap.lapMs && lapNumber < fastestLap.lapNumber) ||
        (ms === fastestLap.lapMs &&
          lapNumber === fastestLap.lapNumber &&
          car.carId < fastestLap.carId)
      ) {
        fastestLap = { carId: car.carId, lapMs: ms, lapNumber };
      }
    }
  }

  return {
    trackId: input.trackId,
    totalLaps: input.totalLaps,
    finishingOrder: records,
    perLapTimes,
    fastestLap,
  };
}

// Sanity: keep the unused-import lint happy by ensuring the re-export of
// `DEFAULT_COUNTDOWN_SEC` above is what the rest of the file consumes.
// The constant is referenced inline so a future refactor that swaps the
// value also bumps any test that hard-codes it.
void DEFAULT_COUNTDOWN_SEC;
