import type { Championship, SaveGame, Track, WeatherOption } from "@/data/schemas";

export interface TimeTrialTrackOption {
  readonly id: string;
  readonly name: string;
  readonly weatherOptions: readonly WeatherOption[];
  readonly personalBestLapMs: number | null;
  readonly personalBestRaceMs: number | null;
  readonly developerBenchmarkMs: number | null;
  readonly startHref: string;
}

export interface TimeTrialView {
  readonly tracks: readonly TimeTrialTrackOption[];
}

const DEVELOPER_BENCHMARKS_MS: Readonly<Record<string, number>> = Object.freeze({
  "velvet-coast/harbor-run": 31_500,
  "velvet-coast/sunpier-loop": 32_200,
  "velvet-coast/cliffline-arc": 38_800,
  "velvet-coast/lighthouse-fall": 40_400,
  "iron-borough/freightline-ring": 41_700,
  "iron-borough/rivet-tunnel": 43_200,
  "iron-borough/foundry-mile": 46_500,
  "iron-borough/outer-exchange": 48_600,
});

export function buildTimeTrialView(input: {
  readonly save: SaveGame;
  readonly championship: Championship;
  readonly tracksById: ReadonlyMap<string, Track>;
}): TimeTrialView {
  const unlockedTrackIds = unlockedTimeTrialTrackIds(
    input.save,
    input.championship,
  );
  return {
    tracks: unlockedTrackIds.flatMap((trackId) => {
      const track = input.tracksById.get(trackId);
      if (!track) return [];
      const record = input.save.records[track.id] ?? null;
      return [
        {
          id: track.id,
          name: track.name,
          weatherOptions: track.weatherOptions,
          personalBestLapMs: record?.bestLapMs ?? null,
          personalBestRaceMs: record?.bestRaceMs ?? null,
          developerBenchmarkMs: developerBenchmarkMs(track.id),
          startHref: timeTrialRaceHref({
            trackId: track.id,
            weather: track.weatherOptions[0],
          }),
        },
      ];
    }),
  };
}

export function timeTrialRaceHref(input: {
  readonly trackId: string;
  readonly weather?: WeatherOption;
}): string {
  const params = new URLSearchParams({
    mode: "timeTrial",
    track: input.trackId,
  });
  if (input.weather !== undefined) {
    params.set("weather", input.weather);
  }
  return `/race?${params.toString()}`;
}

export function developerBenchmarkMs(trackId: string): number | null {
  return DEVELOPER_BENCHMARKS_MS[trackId] ?? null;
}

function unlockedTimeTrialTrackIds(
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
