import type {
  Car,
  Championship,
  SaveGame,
  Track,
  WeatherOption,
} from "@/data/schemas";

export interface QuickRaceTrackOption {
  readonly id: string;
  readonly name: string;
  readonly weatherOptions: readonly WeatherOption[];
}

export interface QuickRaceCarOption {
  readonly id: string;
  readonly name: string;
}

export interface QuickRaceView {
  readonly tracks: readonly QuickRaceTrackOption[];
  readonly cars: readonly QuickRaceCarOption[];
}

export interface QuickRaceHrefInput {
  readonly trackId: string;
  readonly weather: WeatherOption;
  readonly carId: string;
}

export function buildQuickRaceView(input: {
  readonly save: SaveGame;
  readonly championship: Championship;
  readonly tracksById: ReadonlyMap<string, Track>;
  readonly carsById: ReadonlyMap<string, Car>;
}): QuickRaceView {
  const unlockedTrackIds = unlockedQuickRaceTrackIds(
    input.save,
    input.championship,
  );
  return {
    tracks: unlockedTrackIds.flatMap((trackId) => {
      const track = input.tracksById.get(trackId);
      if (!track) return [];
      return [
        {
          id: track.id,
          name: track.name,
          weatherOptions: track.weatherOptions,
        },
      ];
    }),
    cars: input.save.garage.ownedCars.flatMap((carId) => {
      const car = input.carsById.get(carId);
      if (!car) return [];
      return [{ id: car.id, name: car.name }];
    }),
  };
}

export function quickRaceHref(input: QuickRaceHrefInput): string {
  const params = new URLSearchParams({
    mode: "quickRace",
    track: input.trackId,
    weather: input.weather,
    car: input.carId,
  });
  return `/race?${params.toString()}`;
}

function unlockedQuickRaceTrackIds(
  save: SaveGame,
  championship: Championship,
): readonly string[] {
  const firstTourId = championship.tours[0]?.id;
  const unlocked = new Set(save.progress.unlockedTours);
  if (firstTourId) unlocked.add(firstTourId);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const tour of championship.tours) {
    if (!unlocked.has(tour.id)) continue;
    for (const trackId of tour.tracks) {
      if (seen.has(trackId)) continue;
      seen.add(trackId);
      ids.push(trackId);
    }
  }
  return ids;
}
