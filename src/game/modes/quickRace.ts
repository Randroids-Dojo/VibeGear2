import type {
  Car,
  Championship,
  SaveGame,
  Track,
  WeatherOption,
} from "@/data/schemas";

import { unlockedChampionshipTrackIds } from "./unlockedTracks";

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
  const unlockedTrackIds = unlockedChampionshipTrackIds(
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
