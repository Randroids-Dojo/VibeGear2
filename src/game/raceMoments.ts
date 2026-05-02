import { rankPosition, type RankedCar } from "./hudState";

export type RaceStoryMomentKind =
  | "clean-pass"
  | "rival-pressure"
  | "lost-position";

export interface RaceStoryMoment {
  readonly kind: RaceStoryMomentKind;
  readonly title: string;
  readonly detail: string;
}

export interface RaceStoryMomentInput {
  readonly playerId: string;
  readonly previousCars: readonly RankedCar[] | null;
  readonly currentCars: readonly RankedCar[];
  readonly threatDistanceMeters: number;
}

function nearestTrailingGap(input: {
  readonly playerId: string;
  readonly cars: readonly RankedCar[];
}): number | null {
  const player = input.cars.find((car) => car.id === input.playerId);
  if (player === undefined) return null;

  let closestGap = Number.POSITIVE_INFINITY;
  for (const car of input.cars) {
    if (car.id === input.playerId) continue;
    const gap = player.totalProgress - car.totalProgress;
    if (gap > 0.5 && gap < closestGap) {
      closestGap = gap;
    }
  }

  return Number.isFinite(closestGap) ? closestGap : null;
}

export function deriveRaceStoryMoment(
  input: RaceStoryMomentInput,
): RaceStoryMoment | null {
  const currentHasPlayer = input.currentCars.some(
    (car) => car.id === input.playerId,
  );
  if (!currentHasPlayer) return null;

  const currentPosition = rankPosition(input.playerId, input.currentCars);
  if (input.previousCars !== null) {
    const previousHasPlayer = input.previousCars.some(
      (car) => car.id === input.playerId,
    );
    if (previousHasPlayer) {
      const previousPosition = rankPosition(input.playerId, input.previousCars);
      if (currentPosition < previousPosition) {
        return {
          kind: "clean-pass",
          title: "Pass",
          detail: `P${currentPosition}`,
        };
      }
      if (currentPosition > previousPosition) {
        return {
          kind: "lost-position",
          title: "Position lost",
          detail: `P${currentPosition}`,
        };
      }
    }
  }

  const trailingGap = nearestTrailingGap({
    playerId: input.playerId,
    cars: input.currentCars,
  });
  if (
    trailingGap !== null &&
    trailingGap <= Math.max(1, input.threatDistanceMeters)
  ) {
    return {
      kind: "rival-pressure",
      title: "Rival close",
      detail: `${Math.round(trailingGap)} m back`,
    };
  }

  return null;
}
