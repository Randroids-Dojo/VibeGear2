/**
 * Pure model for the F-099 title-page glance card.
 *
 * Reads a `SaveGame` plus a `Championship` and produces a one-shot
 * snapshot the title page renders without any further logic. Pure
 * means same inputs always produce deep-equal outputs, no globals,
 * no `Date.now()`, no localStorage. The page-side wrapper
 * (`TitleGlance.tsx`) handles the `loadSave()` effect.
 *
 * The glance answers four "where am I in the season?" questions:
 *
 *   1. Cash on hand. Anchors how close the next upgrade is.
 *   2. Tours completed (X of 8). Surfaces overall progression at
 *      a glance without the player having to open World Tour.
 *   3. Cars owned. A small reminder that the garage has unlockables.
 *   4. Continue affordance. If `progress.activeTour` is set, name
 *      the active tour and the next track id so the page can render
 *      a deep-link button that resumes mid-tour.
 *
 * Returns `null` from `buildTitleGlance` only when the save is so
 * malformed it cannot be summarized; in practice the loader rejects
 * such saves before reaching the page, so the page treats `null`
 * as a soft "no glance to show" and renders nothing in its place.
 */

import type { Championship, SaveGame } from "@/data/schemas";

export interface ContinueTourAffordance {
  readonly tourId: string;
  readonly tourName: string;
  readonly nextTrackId: string;
  readonly nextRaceIndex: number;
}

export interface TitleGlance {
  readonly credits: number;
  readonly ownedCarCount: number;
  readonly toursCompleted: number;
  readonly toursTotal: number;
  readonly continueTour: ContinueTourAffordance | null;
}

export function buildTitleGlance(
  save: SaveGame,
  championship: Championship,
): TitleGlance | null {
  if (!save.progress) return null;
  const ownedCarCount = save.garage?.ownedCars?.length ?? 0;
  const credits = save.garage?.credits ?? 0;
  const toursCompleted = save.progress.completedTours?.length ?? 0;
  const toursTotal = championship.tours.length;
  const continueTour = resolveContinueTour(save, championship);
  return {
    credits,
    ownedCarCount,
    toursCompleted,
    toursTotal,
    continueTour,
  };
}

function resolveContinueTour(
  save: SaveGame,
  championship: Championship,
): ContinueTourAffordance | null {
  const active = save.progress.activeTour;
  if (!active) return null;
  const tour = championship.tours.find(
    (candidate) => candidate.id === active.tourId,
  );
  if (!tour) return null;
  const nextTrackId = tour.tracks[active.raceIndex];
  if (typeof nextTrackId !== "string") return null;
  return {
    tourId: tour.id,
    tourName: titleCaseTourId(tour.id),
    nextTrackId,
    nextRaceIndex: active.raceIndex,
  };
}

function titleCaseTourId(tourId: string): string {
  return tourId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
