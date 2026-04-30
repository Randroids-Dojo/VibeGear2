import type {
  Championship,
  GhostReplay,
  SaveGame,
  Track,
  WeatherOption,
} from "@/data/schemas";

import { unlockedChampionshipTrackIds } from "./unlockedTracks";

export interface TimeTrialTrackOption {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly weatherOptions: readonly WeatherOption[];
  readonly personalBestLapMs: number | null;
  readonly personalBestRaceMs: number | null;
  readonly developerBenchmarkMs: number | null;
  readonly downloadedGhostTimeMs: number | null;
  readonly startHref: string;
  readonly startDownloadedGhostHref: string | null;
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
  const unlockedTrackIds = unlockedChampionshipTrackIds(
    input.save,
    input.championship,
  );
  return {
    tracks: unlockedTrackIds.flatMap((trackId) => {
      const track = input.tracksById.get(trackId);
      if (!track) return [];
      const record = input.save.records[track.id] ?? null;
      const downloadedGhost = input.save.downloadedGhosts?.[track.id] ?? null;
      return [
        {
          id: track.id,
          name: track.name,
          version: track.version,
          weatherOptions: track.weatherOptions,
          personalBestLapMs: record?.bestLapMs ?? null,
          personalBestRaceMs: record?.bestRaceMs ?? null,
          developerBenchmarkMs: developerBenchmarkMs(track.id),
          downloadedGhostTimeMs: downloadedGhost?.finalTimeMs ?? null,
          startHref: timeTrialRaceHref({
            trackId: track.id,
            weather: track.weatherOptions[0],
          }),
          startDownloadedGhostHref:
            downloadedGhost === null
              ? null
              : timeTrialRaceHref({
                  trackId: track.id,
                  weather: track.weatherOptions[0],
                  ghost: "downloaded",
                }),
        },
      ];
    }),
  };
}

export function timeTrialRaceHref(input: {
  readonly trackId: string;
  readonly weather?: WeatherOption;
  readonly ghost?: "downloaded";
}): string {
  const params = new URLSearchParams({
    mode: "timeTrial",
    track: input.trackId,
  });
  if (input.weather !== undefined) {
    params.set("weather", input.weather);
  }
  if (input.ghost !== undefined) {
    params.set("ghost", input.ghost);
  }
  return `/race?${params.toString()}`;
}

export function developerBenchmarkMs(trackId: string): number | null {
  return DEVELOPER_BENCHMARKS_MS[trackId] ?? null;
}

export function acceptDownloadedGhost(input: {
  readonly trackId: string;
  readonly trackVersion: number;
  readonly ghost: GhostReplay;
}): boolean {
  return (
    input.ghost.trackId === input.trackId &&
    input.ghost.trackVersion === input.trackVersion
  );
}
