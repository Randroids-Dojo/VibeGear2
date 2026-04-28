import { getCar } from "@/data/cars";
import type {
  Car,
  Championship,
  ChampionshipTour,
  SaveGame,
  Track,
  WeatherOption,
} from "@/data/schemas";

import { applyRepairCost, baseRewardForTrackDifficulty } from "./economy";
import { createDamageState, type DamageState } from "./damage";
import {
  visibilityForWeather,
  weatherGripScalar,
  type TireKind,
} from "./weather";

const REPAIR_ZONES = ["engine", "tires", "body"] as const;

type PendingGarageDamage = NonNullable<SaveGame["garage"]["pendingDamage"]>[string];

export interface PreRaceCard {
  readonly trackName: string;
  readonly tourName: string;
  readonly weather: WeatherOption;
  readonly allowedWeather: readonly WeatherOption[];
  readonly laps: number;
  readonly difficulty: {
    readonly value: number;
    readonly label: string;
  };
  readonly recommendedTire: TireKind;
  readonly selectedTire: TireKind;
  readonly selectedTireWarning: string;
  readonly forecast: {
    readonly condition: string;
    readonly surfaceTemperatureBand: string;
    readonly gripRating: string;
    readonly visibilityRating: string;
  };
  readonly standings: string;
  readonly cashOnHand: number;
  readonly repairEstimate: number;
  readonly baseReward: number;
  readonly carSummary: {
    readonly id: string;
    readonly name: string;
    readonly className: string;
    readonly topSpeed: number;
    readonly gripDry: number;
    readonly gripWet: number;
  };
  readonly setupSummary: string;
}

export interface BuildPreRaceCardInput {
  readonly track: Track;
  readonly save: SaveGame;
  readonly championship?: Championship | null;
  readonly tourId?: string | null;
  readonly raceIndex?: number | null;
  readonly weatherSelection?: WeatherOption | null;
  readonly selectedTire?: TireKind | null;
}

export function buildPreRaceCard(input: BuildPreRaceCardInput): PreRaceCard {
  const {
    track,
    save,
    championship = null,
    tourId = track.tourId,
    raceIndex = null,
  } = input;
  const weather = resolveWeatherSelection(track, input.weatherSelection);
  const car = getCar(save.garage.activeCarId);
  const selectedTire = input.selectedTire ?? recommendTire(weather);
  const recommendedTire = recommendTire(weather);
  const activeTour = championship
    ? championship.tours.find((tour) => tour.id === tourId) ?? null
    : null;

  return {
    trackName: track.name,
    tourName: activeTour ? displayTourName(activeTour.id) : "Quick Race",
    weather,
    allowedWeather: track.weatherOptions,
    laps: track.laps,
    difficulty: {
      value: track.difficulty,
      label: difficultyLabel(track.difficulty),
    },
    recommendedTire,
    selectedTire,
    selectedTireWarning: tireWarning(selectedTire, recommendedTire, weather),
    forecast: {
      condition: weatherLabel(weather),
      surfaceTemperatureBand: surfaceTemperatureBand(weather),
      gripRating: gripRating(car, weather, selectedTire),
      visibilityRating: visibilityRating(weather),
    },
    standings: standingsSummary(save, activeTour, raceIndex),
    cashOnHand: save.garage.credits,
    repairEstimate: repairEstimate(save),
    baseReward: baseRewardForTrackDifficulty(track.difficulty),
    carSummary: carSummary(save.garage.activeCarId, car),
    setupSummary: setupSummary(save.garage.activeCarId, save),
  };
}

export function resolveWeatherSelection(
  track: Track,
  requested: WeatherOption | null | undefined,
): WeatherOption {
  if (requested && track.weatherOptions.includes(requested)) return requested;
  return track.weatherOptions[0] ?? "clear";
}

export function recommendTire(weather: WeatherOption): TireKind {
  switch (weather) {
    case "light_rain":
    case "rain":
    case "heavy_rain":
    case "snow":
      return "wet";
    case "clear":
    case "overcast":
    case "fog":
    case "dusk":
    case "night":
      return "dry";
  }
}

export function difficultyLabel(difficulty: number): string {
  if (difficulty <= 1) return "Easy";
  if (difficulty === 2) return "Moderate";
  if (difficulty === 3) return "Hard";
  if (difficulty === 4) return "Expert";
  return "Master";
}

export function weatherLabel(weather: WeatherOption): string {
  switch (weather) {
    case "clear":
      return "Clear";
    case "overcast":
      return "Overcast";
    case "light_rain":
      return "Light rain";
    case "rain":
      return "Rain";
    case "heavy_rain":
      return "Heavy rain";
    case "fog":
      return "Fog";
    case "snow":
      return "Snow";
    case "dusk":
      return "Dusk";
    case "night":
      return "Night";
  }
}

function tireWarning(
  selected: TireKind,
  recommended: TireKind,
  weather: WeatherOption,
): string {
  if (selected === recommended) return "";
  return `Forecast favors ${recommended} tires for ${weatherLabel(weather).toLowerCase()}.`;
}

function surfaceTemperatureBand(weather: WeatherOption): string {
  switch (weather) {
    case "snow":
      return "Cold";
    case "night":
    case "dusk":
    case "fog":
      return "Cool";
    case "clear":
    case "overcast":
      return "Warm";
    case "light_rain":
    case "rain":
    case "heavy_rain":
      return "Wet";
  }
}

function visibilityRating(weather: WeatherOption): string {
  const scalar = visibilityForWeather(weather);
  if (scalar >= 0.9) return "High";
  if (scalar >= 0.75) return "Medium";
  if (scalar >= 0.6) return "Low";
  return "Very low";
}

function gripRating(
  car: Car | undefined,
  weather: WeatherOption,
  tire: TireKind,
): string {
  if (!car) return "Unknown";
  const scalar = weatherGripScalar(car.baseStats, weather, tire);
  if (scalar >= 1.05) return "Excellent";
  if (scalar >= 0.95) return "Good";
  if (scalar >= 0.85) return "Reduced";
  return "Poor";
}

function standingsSummary(
  save: SaveGame,
  tour: ChampionshipTour | null,
  raceIndex: number | null,
): string {
  const activeTour = save.progress.activeTour;
  if (!tour || !activeTour || activeTour.tourId !== tour.id) return "No tour standings yet";
  const completed = activeTour.results.length;
  const total = tour.tracks.length;
  const next = raceIndex === null ? activeTour.raceIndex : raceIndex;
  return `Race ${Math.min(total, next + 1)} of ${total}, ${completed} complete`;
}

function repairEstimate(save: SaveGame): number {
  const carId = save.garage.activeCarId;
  const pending = save.garage.pendingDamage?.[carId];
  const damage = damageFromPending(pending);
  const quoteSave: SaveGame = {
    ...save,
    garage: {
      ...save.garage,
      credits: Number.MAX_SAFE_INTEGER,
    },
  };
  const result = applyRepairCost(quoteSave, {
    carId,
    damage,
    tourTier: 1,
    zones: REPAIR_ZONES,
    repairKind: "full",
    lastRaceCashEarned: save.garage.lastRaceCashEarned ?? 0,
  });
  return result.ok ? result.cashSpent ?? 0 : 0;
}

function damageFromPending(
  pending: PendingGarageDamage | undefined,
): DamageState {
  if (!pending) return createDamageState({});
  return {
    ...createDamageState({
      engine: pending.zones.engine,
      tires: pending.zones.tires,
      body: pending.zones.body,
    }),
    offRoadAccumSeconds: pending.offRoadAccumSeconds,
  };
}

function carSummary(activeCarId: string, car: Car | undefined): PreRaceCard["carSummary"] {
  if (!car) {
    return {
      id: activeCarId,
      name: activeCarId,
      className: "Unknown",
      topSpeed: 0,
      gripDry: 0,
      gripWet: 0,
    };
  }
  return {
    id: car.id,
    name: car.name,
    className: car.class,
    topSpeed: car.baseStats.topSpeed,
    gripDry: car.baseStats.gripDry,
    gripWet: car.baseStats.gripWet,
  };
}

function setupSummary(activeCarId: string, save: SaveGame): string {
  const upgrades = save.garage.installedUpgrades?.[activeCarId];
  if (!upgrades) return "Stock setup";
  const totalTiers = Object.values(upgrades).reduce((sum, tier) => sum + tier, 0);
  return totalTiers === 0 ? "Stock setup" : `${totalTiers} upgrade tiers installed`;
}

function displayTourName(tourId: string): string {
  return tourId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
