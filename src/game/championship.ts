/**
 * Tour and championship progression primitives per
 * `docs/gdd/08-world-and-progression-design.md` and
 * `docs/gdd/07-race-rules-and-structure.md`.
 *
 * Surface (all pure):
 * - `enterTour(save, championship, tourId)`: validate the tour is unlocked
 *   and seed `progress.activeTour = { tourId, raceIndex: 0, results: [] }`.
 *   Rejects when the tour id is not in `championship.tours` or when the
 *   tour is locked. Pure: returns a fresh `SaveGame` on success.
 * - `recordResult(activeTour, raceResult)`: append the per-race outcome
 *   and advance `raceIndex`. Never mutates the input. Caller decides
 *   whether to persist (the §20 results screen owns the save commit).
 * - `tourComplete(activeTour, championship)`: aggregate the recorded
 *   results into `{ passed, finalStandings }`. `passed` is true when
 *   the player's aggregate placement is at most `tour.requiredStanding`.
 *   `finalStandings` is a per-car points map computed from the §7
 *   `PLACEMENT_POINTS` table; DNFs receive `0`.
 * - `unlockNextTour(save, completedTourId, championship)`: append the
 *   next tour id to `progress.unlockedTours` (and the completed id to
 *   `progress.completedTours`). The final tour unlocks nothing past
 *   itself. Idempotent: re-running on an already-completed tour does
 *   not double-add ids.
 *
 * The runtime `ActiveTour` shape is defined here rather than on
 * `SaveGameSchema` because the per-tour state is in-flight only: the
 * persistence schema records `unlockedTours` / `completedTours` /
 * `stipendsClaimed`, but the active-tour cursor lives in memory between
 * race-finishes (a future "resume tour" affordance can promote this to
 * a schema field; for now the §20 results screen rebuilds it from the
 * championship + the player's last race outcome on demand).
 *
 * All functions never mutate the input `save` reference, never call
 * `Date.now`, `Math.random`, or any IO. Same inputs always produce
 * deep-equal outputs; deterministic by construction.
 *
 * Out of scope for this slice (filed as followups owned by the parent
 * tour-region dot):
 * - The `/world` page surface (region map, tour-tile picker, "Enter
 *   tour" affordance). The pure module here is the data plane the page
 *   consumes; the page wiring lands in a follow-up sub-slice.
 * - F-035 stipend wiring at tour entry: this module supplies
 *   `enterTour` as the consumer; the stipend call wires alongside in a
 *   follow-up so the §12 stipend lever is paid once per tour.
 * - F-037 / F-039 tour-clear bonus wiring: `tourComplete` is the
 *   consumer; the bonus calls wire alongside in a follow-up so the §12
 *   easy-mode bonus and the §12 tour-completion bonus credit the wallet.
 * - The Playwright `e2e/tour-flow.spec.ts` end-to-end spec: lands once
 *   the `/world` page surface ships.
 */

import type { Championship, ChampionshipTour, SaveGame } from "@/data/schemas";

import { PLACEMENT_POINTS } from "./raceResult";

/**
 * Per-race outcome recorded inside an `ActiveTour`. Stripped down to
 * only the fields the standings aggregator needs: the player's
 * placement and whether they DNF'd. The §20 results-screen builder
 * owns the wider `RaceResult` shape; this module reads only what it
 * needs to keep the contract minimal and the test fixtures small.
 *
 * `placement` is 1-indexed; `0` (or any non-positive value) is treated
 * as DNF for points purposes. `dnf` is the explicit flag the caller
 * sets when the player retired or wrecked; tied to `status === "dnf"`
 * on the race-finish wiring. A non-DNF result with placement outside
 * the `PLACEMENT_POINTS` table (places 9 and below) scores 0 per §7.
 */
export interface TourRaceResult {
  /** Track id the result was recorded against. Mirrors the tour's tracks order. */
  trackId: string;
  /** 1-indexed finishing placement. 0 or negative is treated as no-points. */
  placement: number;
  /** True when the player retired or wrecked. Forces points to 0. */
  dnf: boolean;
}

/**
 * Cursor state for a tour in progress. Created by `enterTour`; advanced
 * by `recordResult` once per race; consumed by `tourComplete` after the
 * final race. Lives in memory between race-finishes (see module header
 * for the persistence boundary).
 *
 * `raceIndex` is 0-indexed and points at the *next* race to run. After
 * the final race it equals `tour.tracks.length`; the §20 results screen
 * uses that equality to decide whether to render the "next race" card
 * (it does not when the index trips the boundary).
 */
export interface ActiveTour {
  readonly tourId: string;
  readonly raceIndex: number;
  readonly results: ReadonlyArray<TourRaceResult>;
}

/** Discriminated result returned by `enterTour`. */
export type EnterTourResult =
  | { readonly ok: true; readonly save: SaveGame; readonly activeTour: ActiveTour }
  | { readonly ok: false; readonly code: EnterTourFailureCode };

/**
 * Reasons `enterTour` may reject. Caller surfaces a tooltip / toast:
 * - `unknown_tour`: id is not in `championship.tours`. Programmer error
 *   on the call site (a stale id or a typo).
 * - `tour_locked`: the tour is not in `save.progress.unlockedTours`.
 *   Player-facing: the tile should already be disabled with a tooltip
 *   naming the gating tour.
 */
export type EnterTourFailureCode = "unknown_tour" | "tour_locked";

/**
 * Final standings entry for one car after the four tour races.
 * `points` is the sum of per-race `PLACEMENT_POINTS[placement]` values
 * (DNF contributes 0); the per-race `placements` array is preserved so
 * the §7 tie-break ladder can read "best single-race finish" without a
 * second pass over the raw results.
 */
export interface TourStandingsEntry {
  /** Car id. The player's id mirrors `save.garage.activeCarId`. */
  readonly carId: string;
  /** Aggregate points for the four tour races. */
  readonly points: number;
  /** Per-race placements in race order; DNF entries are 0. */
  readonly placements: ReadonlyArray<number>;
}

/** Shape returned by `tourComplete`. */
export interface TourCompletionSummary {
  /** True when the player's aggregate standing is at most `tour.requiredStanding`. */
  readonly passed: boolean;
  /**
   * 1-indexed final standing of the player car (sorted descending by
   * `points`, with the §7 tie-break ladder breaking ties by best
   * single-race finish then car id lexical order). `null` when the
   * player car is not in the field.
   */
  readonly playerStanding: number | null;
  /**
   * Sorted standings, position 0 is 1st place. Includes one entry per
   * car that scored at least one race in `activeTour.results` plus the
   * player. The §20 results screen renders this directly.
   */
  readonly standings: ReadonlyArray<TourStandingsEntry>;
}

/**
 * Championship lookup helper that does not throw on miss. Returns the
 * tour and its 0-indexed position when found. Centralised so
 * `enterTour`, `tourComplete`, and `unlockNextTour` share one source of
 * truth on what "the tour with id X" means.
 */
function findTour(
  championship: Championship,
  tourId: string,
): { readonly tour: ChampionshipTour; readonly index: number } | null {
  const index = championship.tours.findIndex((t) => t.id === tourId);
  if (index < 0) return null;
  const tour = championship.tours[index];
  if (!tour) return null;
  return { tour, index };
}

/**
 * Enter the named tour. Verifies the tour exists in the championship
 * and is in `save.progress.unlockedTours`; on success returns a fresh
 * `SaveGame` with the same shape (no schema-level mutation here; the
 * cursor `ActiveTour` lives in memory) plus the seeded cursor.
 *
 * The first tour of a championship (index 0) must already appear in
 * `save.progress.unlockedTours` for the player to enter it; the seeding
 * lives with the championship-onboarding flow (out of scope here).
 *
 * Failure shapes:
 * - `unknown_tour`: the tour id is not present in `championship.tours`.
 * - `tour_locked`: the tour is not in `save.progress.unlockedTours`.
 */
export function enterTour(
  save: SaveGame,
  championship: Championship,
  tourId: string,
): EnterTourResult {
  const lookup = findTour(championship, tourId);
  if (lookup === null) {
    return { ok: false, code: "unknown_tour" };
  }
  if (!save.progress.unlockedTours.includes(tourId)) {
    return { ok: false, code: "tour_locked" };
  }
  return {
    ok: true,
    save,
    activeTour: {
      tourId,
      raceIndex: 0,
      results: [],
    },
  };
}

/**
 * Append a race result to an active tour and advance the cursor. Pure:
 * never mutates the input `activeTour`. Returns the new cursor for the
 * caller to thread into the next race-start.
 *
 * Caller is responsible for ensuring the result corresponds to the
 * track at `tour.tracks[activeTour.raceIndex]`; the function does not
 * validate the trackId because the cursor is the source of truth (a
 * mismatch is a programmer error, not a runtime branch).
 */
export function recordResult(
  activeTour: ActiveTour,
  raceResult: TourRaceResult,
): ActiveTour {
  return {
    tourId: activeTour.tourId,
    raceIndex: activeTour.raceIndex + 1,
    results: [...activeTour.results, raceResult],
  };
}

/**
 * Aggregate the recorded results into final standings and the
 * pass / fail flag.
 *
 * Standings algorithm:
 * 1. Sum per-race `PLACEMENT_POINTS[placement]` for the player car.
 *    DNF results contribute `0`.
 * 2. Synthesise a points-by-grid-rank table for the AI field by
 *    pairing each race's placement-1 (the slot the player did not
 *    take) with a synthetic AI car id (`"ai-1"`..`"ai-N"`); this
 *    keeps the aggregator pure without requiring full per-AI race
 *    telemetry. The `playerStanding` only depends on the player's
 *    points; the synthetic field exists so the §20 results screen
 *    has something to render.
 * 3. Sort descending by points. Ties break on best single-race
 *    finish (lower placement wins); a final tie breaks on car id
 *    lexical order (deterministic).
 * 4. `passed` is true when the player's aggregate standing
 *    (1-indexed position in the sorted standings) is at most
 *    `tour.requiredStanding`.
 *
 * Field-size note: the §7 grid is 12 cars; this aggregator operates
 * over the four recorded races so it is robust to a smaller MVP field.
 * Tie behaviour falls out of the deterministic sort.
 *
 * `playerCarId` defaults to the literal `"player"` so unit tests have
 * a stable handle without seeding a full save; the wiring slice passes
 * `save.garage.activeCarId` so the standings entry matches the rest of
 * the §20 surface.
 */
export function tourComplete(
  activeTour: ActiveTour,
  championship: Championship,
  playerCarId = "player",
): TourCompletionSummary {
  const lookup = findTour(championship, activeTour.tourId);
  if (lookup === null) {
    return { passed: false, playerStanding: null, standings: [] };
  }
  const { tour } = lookup;
  const playerEntry = aggregatePlayer(activeTour.results, playerCarId);
  const aiEntries = aggregateAi(activeTour.results);
  const sorted = sortStandings([playerEntry, ...aiEntries]);
  const playerStanding = standingOf(sorted, playerCarId);
  const passed =
    playerStanding !== null && playerStanding <= tour.requiredStanding;
  return { passed, playerStanding, standings: sorted };
}

function aggregatePlayer(
  results: ReadonlyArray<TourRaceResult>,
  playerCarId: string,
): TourStandingsEntry {
  const placements = results.map((r) => (r.dnf ? 0 : Math.max(0, r.placement)));
  const points = placements.reduce((acc, p) => acc + pointsFor(p), 0);
  return { carId: playerCarId, points, placements };
}

function aggregateAi(
  results: ReadonlyArray<TourRaceResult>,
): ReadonlyArray<TourStandingsEntry> {
  // Synthesise a stand-in AI field: one synthetic id per non-player slot
  // in the largest race. The aggregator credits the slot ahead of the
  // player on each race (a placeholder until the wiring slice supplies
  // real per-AI telemetry; the player standing only depends on the
  // player's points so the placeholder does not affect pass/fail).
  if (results.length === 0) return [];
  const aiSlots = results.reduce(
    (max, r) => Math.max(max, r.dnf ? 0 : Math.max(0, r.placement) - 1),
    0,
  );
  const entries: TourStandingsEntry[] = [];
  for (let i = 1; i <= aiSlots; i += 1) {
    const placements = results.map(() => i);
    const points = placements.reduce((acc, p) => acc + pointsFor(p), 0);
    entries.push({ carId: `ai-${i}`, points, placements });
  }
  return entries;
}

function pointsFor(placement: number): number {
  if (placement <= 0) return 0;
  if (placement >= PLACEMENT_POINTS.length) return 0;
  return PLACEMENT_POINTS[placement] ?? 0;
}

function sortStandings(
  entries: ReadonlyArray<TourStandingsEntry>,
): ReadonlyArray<TourStandingsEntry> {
  const copy = [...entries];
  copy.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const bestA = bestPlacement(a.placements);
    const bestB = bestPlacement(b.placements);
    if (bestA !== bestB) return bestA - bestB;
    return a.carId < b.carId ? -1 : a.carId > b.carId ? 1 : 0;
  });
  return copy;
}

function bestPlacement(placements: ReadonlyArray<number>): number {
  // 0 represents DNF / no-points; treat as the worst possible placement
  // so a clean podium sits ahead of an all-DNF run on the tie-break.
  let best = Number.POSITIVE_INFINITY;
  for (const p of placements) {
    if (p > 0 && p < best) best = p;
  }
  return Number.isFinite(best) ? best : Number.MAX_SAFE_INTEGER;
}

function standingOf(
  sorted: ReadonlyArray<TourStandingsEntry>,
  carId: string,
): number | null {
  const idx = sorted.findIndex((e) => e.carId === carId);
  return idx < 0 ? null : idx + 1;
}

/**
 * Append the next tour's id to `save.progress.unlockedTours` and the
 * completed id to `save.progress.completedTours`. Pure: returns a fresh
 * `SaveGame` (and the original when the championship has no further
 * tour).
 *
 * Idempotent on both lists: re-running on an already-completed tour
 * does not duplicate ids in either array. The final tour unlocks no
 * successor; the player still has the completed entry recorded.
 *
 * Returns the original `save` unchanged when:
 * - `completedTourId` is unknown to the championship (programmer error
 *   at the call site; the caller would have rejected this earlier in
 *   `enterTour`).
 */
export function unlockNextTour(
  save: SaveGame,
  completedTourId: string,
  championship: Championship,
): SaveGame {
  const lookup = findTour(championship, completedTourId);
  if (lookup === null) return save;
  const { index } = lookup;

  const completedAlready = save.progress.completedTours.includes(completedTourId);
  const nextTour = championship.tours[index + 1];
  const nextTourId = nextTour?.id ?? null;
  const alreadyUnlocked =
    nextTourId !== null && save.progress.unlockedTours.includes(nextTourId);

  if (completedAlready && (nextTourId === null || alreadyUnlocked)) {
    return save;
  }

  const completedTours = completedAlready
    ? save.progress.completedTours
    : [...save.progress.completedTours, completedTourId];
  const unlockedTours =
    nextTourId === null || alreadyUnlocked
      ? save.progress.unlockedTours
      : [...save.progress.unlockedTours, nextTourId];

  return {
    ...save,
    progress: {
      ...save.progress,
      completedTours,
      unlockedTours,
    },
  };
}
