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

export interface RivalNamingRef {
  /** In-race car id that maps to the named rival (e.g. `"ai-3"`). */
  readonly carId: string;
  /** Player-facing short name (`"D. Korsak"`). */
  readonly displayName: string;
}

export interface RaceStoryMomentInput {
  readonly playerId: string;
  readonly previousCars: readonly RankedCar[] | null;
  readonly currentCars: readonly RankedCar[];
  readonly threatDistanceMeters: number;
  /**
   * F-092 slice 1. Optional rival ref. When present and the trailing
   * pressure is the rival, the rival-pressure moment surfaces their
   * name in the detail string. Absent for non-tour or practice runs.
   */
  readonly rival?: RivalNamingRef | null;
}

interface TrailingCar {
  readonly id: string;
  readonly gap: number;
}

function nearestTrailingCar(input: {
  readonly playerId: string;
  readonly cars: readonly RankedCar[];
}): TrailingCar | null {
  const player = input.cars.find((car) => car.id === input.playerId);
  if (player === undefined) return null;

  let closest: TrailingCar | null = null;
  for (const car of input.cars) {
    if (car.id === input.playerId) continue;
    const gap = player.totalProgress - car.totalProgress;
    if (gap <= 0.5) continue;
    if (closest === null || gap < closest.gap) {
      closest = { id: car.id, gap };
    }
  }

  return closest;
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

  const trailing = nearestTrailingCar({
    playerId: input.playerId,
    cars: input.currentCars,
  });
  if (
    trailing !== null &&
    trailing.gap <= Math.max(1, input.threatDistanceMeters)
  ) {
    const meters = Math.round(trailing.gap);
    const rival = input.rival ?? null;
    const isRival = rival !== null && rival.carId === trailing.id;
    return {
      kind: "rival-pressure",
      title: isRival ? rival.displayName : "Rival close",
      detail: `${meters} m back`,
    };
  }

  return null;
}
