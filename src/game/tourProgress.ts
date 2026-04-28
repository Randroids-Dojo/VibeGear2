import type { Championship, SaveGame } from "@/data/schemas";

import {
  recordResult,
  tourComplete,
  unlockNextTour,
  type TourCompletionSummary,
} from "./championship";
import type { RaceResult, TourResultProgress } from "./raceResult";

export interface ApplyTourRaceResultResult {
  readonly save: SaveGame;
  readonly result: RaceResult;
  readonly summary: TourCompletionSummary | null;
}

/**
 * Persist one race result into `save.progress.activeTour`.
 *
 * The results screen owns the inter-race handoff, but this helper keeps
 * the save mutation pure and deterministic. It advances the active
 * cursor after races one through three. After the fourth race it clears
 * the cursor, records the completed tour, and unlocks the next tour when
 * the aggregate standing passes the tour gate.
 */
export function applyTourRaceResult(input: {
  save: SaveGame;
  result: RaceResult;
  championship: Championship;
  playerCarId?: string;
}): ApplyTourRaceResultResult {
  const activeTour = input.save.progress.activeTour;
  if (!activeTour) {
    return { save: input.save, result: input.result, summary: null };
  }

  const tour = input.championship.tours.find((candidate) => {
    return candidate.id === activeTour.tourId;
  });
  if (!tour) {
    return { save: input.save, result: input.result, summary: null };
  }

  const plannedTrackId = tour.tracks[activeTour.raceIndex] ?? input.result.trackId;
  const playerRecord =
    input.result.finishingOrder.find((record) => {
      return record.carId === input.result.playerCarId;
    }) ?? null;
  const nextTour = recordResult(activeTour, {
    trackId: plannedTrackId,
    placement: input.result.playerPlacement ?? 0,
    dnf: playerRecord?.status !== "finished",
    cashEarned: input.result.cashEarned,
  });

  if (nextTour.raceIndex < tour.tracks.length) {
    const save = {
      ...input.save,
      progress: {
        ...input.save.progress,
        activeTour: {
          ...nextTour,
          results: [...nextTour.results],
        },
      },
    };
    return {
      save,
      result: withTourProgress(input.result, {
        tourId: nextTour.tourId,
        raceIndex: activeTour.raceIndex,
        nextRaceIndex: nextTour.raceIndex,
        completed: false,
        passed: null,
        playerStanding: null,
        unlockedTourId: null,
      }),
      summary: null,
    };
  }

  const playerCarId = input.playerCarId ?? input.save.garage.activeCarId;
  const raceRewards = nextTour.results.map((race) => race.cashEarned ?? 0);
  const summary = tourComplete(
    nextTour,
    input.championship,
    playerCarId,
    raceRewards,
    input.save,
  );
  const clearedSave = withoutActiveTour(input.save);
  const unlockedSave = summary.passed
    ? unlockNextTour(clearedSave, nextTour.tourId, input.championship)
    : clearedSave;
  const unlockedTourId = firstNewTourId(
    input.save.progress.unlockedTours,
    unlockedSave.progress.unlockedTours,
  );

  return {
    save: unlockedSave,
    result: withTourProgress(input.result, {
      tourId: nextTour.tourId,
      raceIndex: activeTour.raceIndex,
      nextRaceIndex: null,
      completed: true,
      passed: summary.passed,
      playerStanding: summary.playerStanding,
      unlockedTourId,
    }),
    summary,
  };
}

function withTourProgress(
  result: RaceResult,
  tourProgress: TourResultProgress,
): RaceResult {
  return {
    ...result,
    tourProgress,
  };
}

function withoutActiveTour(save: SaveGame): SaveGame {
  const { activeTour: _activeTour, ...progress } = save.progress;
  return {
    ...save,
    progress,
  };
}

function firstNewTourId(
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>,
): string | null {
  return after.find((tourId) => !before.includes(tourId)) ?? null;
}
