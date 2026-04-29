import type { Track, TrackSegment, WeatherOption } from "@/data/schemas";
import { WeatherOptionSchema } from "@/data/schemas";
import { createDefaultSegment } from "./defaultTrack";

export const WEATHER_OPTIONS: readonly WeatherOption[] = WeatherOptionSchema.options;

export function replaceMeta(
  track: Track,
  patch: Partial<Omit<Track, "segments" | "checkpoints" | "weatherOptions" | "spawn">>,
): Track {
  return { ...track, ...patch };
}

export function setWeather(track: Track, weather: WeatherOption, enabled: boolean): Track {
  const current = new Set(track.weatherOptions);
  if (enabled) current.add(weather);
  else current.delete(weather);
  const next = WEATHER_OPTIONS.filter((option) => current.has(option));
  return { ...track, weatherOptions: next.length > 0 ? next : ["clear"] };
}

export function updateSpawnGridSlots(track: Track, gridSlots: number): Track {
  return { ...track, spawn: { gridSlots } };
}

export function updateSegment(
  track: Track,
  index: number,
  patch: Partial<TrackSegment>,
): Track {
  if (index < 0 || index >= track.segments.length) return track;
  return {
    ...track,
    segments: track.segments.map((segment, i) =>
      i === index ? { ...segment, ...patch } : segment,
    ),
  };
}

export function addSegment(track: Track): Track {
  const segment = createDefaultSegment();
  return {
    ...track,
    lengthMeters: track.lengthMeters + segment.len,
    segments: [...track.segments, segment],
  };
}

export function removeSegment(track: Track, index: number): Track {
  if (track.segments.length <= 4 || index < 0 || index >= track.segments.length) {
    return track;
  }
  const removedSegment = track.segments[index]!;
  const segments = track.segments.filter((_, i) => i !== index);
  return {
    ...track,
    lengthMeters: Math.max(1, track.lengthMeters - removedSegment.len),
    segments,
    checkpoints: track.checkpoints
      .filter((checkpoint) => checkpoint.segmentIndex !== index || checkpoint.label === "start")
      .map((checkpoint) => ({
        ...checkpoint,
        segmentIndex:
          checkpoint.segmentIndex > index
            ? checkpoint.segmentIndex - 1
            : checkpoint.segmentIndex,
      })),
  };
}

export function addCheckpoint(track: Track): Track {
  return {
    ...track,
    checkpoints: [
      ...track.checkpoints,
      { segmentIndex: Math.max(0, track.segments.length - 1), label: `split-${track.checkpoints.length}` },
    ],
  };
}

export function updateCheckpoint(
  track: Track,
  index: number,
  patch: { segmentIndex?: number; label?: string },
): Track {
  if (index < 0 || index >= track.checkpoints.length) return track;
  return {
    ...track,
    checkpoints: track.checkpoints.map((checkpoint, i) => {
      if (i !== index) return checkpoint;
      if (checkpoint.label === "start") {
        return { ...checkpoint, segmentIndex: 0, label: "start" };
      }
      return { ...checkpoint, ...patch };
    }),
  };
}

export function removeCheckpoint(track: Track, index: number): Track {
  const checkpoint = track.checkpoints[index];
  if (!checkpoint || checkpoint.label === "start") return track;
  return {
    ...track,
    checkpoints: track.checkpoints.filter((_, i) => i !== index),
  };
}

export function hazardsToText(hazards: readonly string[]): string {
  return hazards.join(", ");
}

export function textToHazards(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
