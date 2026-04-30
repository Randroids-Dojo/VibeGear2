import type { CarClass, WeatherOption } from "@/data/schemas";
import { CarClassSchema, WeatherOptionSchema } from "@/data/schemas";
import { createRng } from "@/game/rng";

export interface DailyChallengeTrack {
  readonly id: string;
  readonly weatherOptions: readonly WeatherOption[];
}

export interface DailyChallengeSelection {
  readonly dateKey: string;
  readonly seed: number;
  readonly trackId: string;
  readonly weather: WeatherOption;
  readonly carClass: CarClass;
}

export const DEFAULT_DAILY_CAR_CLASSES: readonly CarClass[] =
  CarClassSchema.options;

export function dailyDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailySeed(date: Date): number {
  return hashString32(`vibegear2-daily:${dailyDateKey(date)}`);
}

export function selectDailyChallenge(
  date: Date,
  tracks: readonly DailyChallengeTrack[],
  carClasses: readonly CarClass[] = DEFAULT_DAILY_CAR_CLASSES,
): DailyChallengeSelection {
  const eligibleTracks = [...tracks]
    .filter((track) => track.weatherOptions.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (eligibleTracks.length === 0) {
    throw new Error("selectDailyChallenge requires at least one eligible track");
  }

  const eligibleClasses = uniqueCarClasses(carClasses);
  if (eligibleClasses.length === 0) {
    throw new Error("selectDailyChallenge requires at least one car class");
  }

  const seed = dailySeed(date);
  const rng = createRng(seed);
  const track = eligibleTracks[rng.nextInt(0, eligibleTracks.length)];
  if (track === undefined) {
    throw new Error("selectDailyChallenge failed to choose a track");
  }
  const weatherOptions = uniqueWeatherOptions(track.weatherOptions);
  const weather = weatherOptions[rng.nextInt(0, weatherOptions.length)];
  if (weather === undefined) {
    throw new Error("selectDailyChallenge failed to choose weather");
  }
  const carClass = eligibleClasses[rng.nextInt(0, eligibleClasses.length)];
  if (carClass === undefined) {
    throw new Error("selectDailyChallenge failed to choose a car class");
  }

  return {
    dateKey: dailyDateKey(date),
    seed,
    trackId: track.id,
    weather,
    carClass,
  };
}

export function dailyChallengeRaceHref(
  challenge: DailyChallengeSelection,
): string {
  const params = new URLSearchParams({
    mode: "timeTrial",
    track: challenge.trackId,
    weather: challenge.weather,
    daily: challenge.dateKey,
    dailySeed: `${challenge.seed}`,
    carClass: challenge.carClass,
  });
  return `/race?${params.toString()}`;
}

export function formatDailyChallengeShareText(
  challenge: DailyChallengeSelection,
  bestMs?: number | null,
): string {
  const time = Number.isFinite(bestMs ?? Number.NaN)
    ? formatResultTime(bestMs as number)
    : "no result";
  return [
    "VibeGear2 Daily",
    challenge.dateKey,
    time,
    challenge.trackId,
    challenge.weather,
    challenge.carClass,
  ].join(" ");
}

function uniqueCarClasses(carClasses: readonly CarClass[]): CarClass[] {
  const allowed = new Set<CarClass>(carClasses);
  return CarClassSchema.options.filter((carClass) => allowed.has(carClass));
}

function uniqueWeatherOptions(
  weatherOptions: readonly WeatherOption[],
): WeatherOption[] {
  const allowed = new Set<WeatherOption>(weatherOptions);
  return WeatherOptionSchema.options.filter((weather) => allowed.has(weather));
}

function formatResultTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}.${`${millis}`.padStart(
    3,
    "0",
  )}`;
}

function hashString32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
