import type { Championship, ChampionshipTour, SaveGame } from "@/data/schemas";
import { enterTour, type EnterTourResult } from "@/game/championship";

export type WorldTourCardState = "available" | "locked" | "completed";

export interface WorldTourCard {
  readonly id: string;
  readonly name: string;
  readonly index: number;
  readonly requiredStanding: number;
  readonly trackCount: number;
  readonly firstTrackId: string;
  readonly firstTrackName: string;
  readonly state: WorldTourCardState;
  readonly lockedReason: string | null;
}

export interface WorldTourView {
  readonly championshipId: string;
  readonly championshipName: string;
  readonly unlockedTourIds: ReadonlyArray<string>;
  readonly completedTourIds: ReadonlyArray<string>;
  readonly cards: ReadonlyArray<WorldTourCard>;
}

export type EnterWorldTourResult =
  | (Extract<EnterTourResult, { ok: true }> & {
      readonly firstTrackId: string;
      readonly firstTrackName: string;
    })
  | Extract<EnterTourResult, { ok: false }>;

export function buildWorldTourView(
  save: SaveGame,
  championship: Championship,
): WorldTourView {
  const unlocked = effectiveUnlockedTourIds(save, championship);
  const completed = new Set(save.progress.completedTours);

  return {
    championshipId: championship.id,
    championshipName: championship.name,
    unlockedTourIds: unlocked,
    completedTourIds: save.progress.completedTours,
    cards: championship.tours.map((tour, index) =>
      buildTourCard(tour, index, unlocked, completed, championship),
    ),
  };
}

export function enterWorldTour(
  save: SaveGame,
  championship: Championship,
  tourId: string,
): EnterWorldTourResult {
  const normalized = withFirstTourUnlocked(save, championship);
  const result = enterTour(normalized, championship, tourId);
  if (!result.ok) return result;
  const tour = championship.tours.find((candidate) => candidate.id === tourId);
  if (!tour) return { ok: false, code: "unknown_tour" };
  const firstTrackId = tour.tracks[0];
  if (!firstTrackId) return { ok: false, code: "unknown_tour" };
  return {
    ...result,
    save: withFirstTourUnlocked(result.save, championship),
    firstTrackId,
    firstTrackName: formatTrackName(firstTrackId),
  };
}

export function withFirstTourUnlocked(
  save: SaveGame,
  championship: Championship,
): SaveGame {
  const firstTourId = championship.tours[0]?.id;
  if (!firstTourId || save.progress.unlockedTours.includes(firstTourId)) {
    return save;
  }
  return {
    ...save,
    progress: {
      ...save.progress,
      unlockedTours: [firstTourId, ...save.progress.unlockedTours],
    },
  };
}

function buildTourCard(
  tour: ChampionshipTour,
  index: number,
  unlocked: ReadonlyArray<string>,
  completed: ReadonlySet<string>,
  championship: Championship,
): WorldTourCard {
  const firstTrackId = tour.tracks[0] ?? "";
  const isCompleted = completed.has(tour.id);
  const isUnlocked = unlocked.includes(tour.id);
  return {
    id: tour.id,
    name: formatTourName(tour.id),
    index,
    requiredStanding: tour.requiredStanding,
    trackCount: tour.tracks.length,
    firstTrackId,
    firstTrackName: formatTrackName(firstTrackId),
    state: isCompleted ? "completed" : isUnlocked ? "available" : "locked",
    lockedReason: isUnlocked
      ? null
      : lockedReasonForTour(championship, index),
  };
}

function effectiveUnlockedTourIds(
  save: SaveGame,
  championship: Championship,
): ReadonlyArray<string> {
  return withFirstTourUnlocked(save, championship).progress.unlockedTours;
}

function lockedReasonForTour(
  championship: Championship,
  index: number,
): string {
  const previousTour = championship.tours[index - 1];
  if (!previousTour) return "Complete the previous tour to unlock this tour.";
  return `Complete ${formatTourName(previousTour.id)} to unlock this tour.`;
}

function formatTourName(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTrackName(id: string): string {
  const leaf = id.split("/").at(-1) ?? id;
  return formatTourName(leaf);
}
