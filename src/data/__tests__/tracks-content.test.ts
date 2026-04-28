/**
 * Content tests for the bundled MVP track set.
 *
 * Each track JSON under `src/data/tracks/` must:
 * - validate against `TrackSchema` from `docs/gdd/22-data-schemas.md`,
 * - compile via `loadTrack(id)` without throwing,
 * - produce a renderable compiled track (>= MIN_COMPILED_SEGMENTS),
 * - resolve to the same id once loaded.
 *
 * Adding a track: drop a JSON in `src/data/tracks/`, register it in
 * `src/data/tracks/index.ts`, then add the id to `EXPECTED_IDS` below.
 */

import { describe, expect, it } from "vitest";

import { TRACK_IDS, TRACK_RAW, loadTrack } from "@/data";
import { TrackSchema } from "@/data/schemas";

const EXPECTED_MVP_TRACK_IDS = [
  "velvet-coast/harbor-run",
  "velvet-coast/sunpier-loop",
  "velvet-coast/cliffline-arc",
  "velvet-coast/lighthouse-fall",
  "iron-borough/freightline-ring",
  "iron-borough/rivet-tunnel",
  "iron-borough/foundry-mile",
  "iron-borough/outer-exchange",
];

const EXPECTED_IDS = [
  "iron-borough/foundry-mile",
  "iron-borough/freightline-ring",
  "iron-borough/outer-exchange",
  "iron-borough/rivet-tunnel",
  "test/curve",
  "test/elevation",
  "test/straight",
  "velvet-coast/cliffline-arc",
  "velvet-coast/harbor-run",
  "velvet-coast/lighthouse-fall",
  "velvet-coast/sunpier-loop",
];

describe("track catalogue", () => {
  it("registers every expected MVP track id", () => {
    expect([...TRACK_IDS].sort()).toEqual(EXPECTED_IDS);
  });

  it("registers the two-tour §24 MVP track set", () => {
    for (const id of EXPECTED_MVP_TRACK_IDS) {
      expect(TRACK_IDS).toContain(id);
    }
  });
});

describe.each(EXPECTED_IDS.map((id) => [id] as const))(
  "track JSON: %s",
  (id) => {
    it("validates against TrackSchema", () => {
      const raw = TRACK_RAW[id];
      expect(raw).toBeDefined();
      const result = TrackSchema.safeParse(raw);
      if (!result.success) {
        throw new Error(
          `TrackSchema rejected ${id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });

    it("compiles via loadTrack without throwing", () => {
      const compiled = loadTrack(id);
      expect(compiled.trackId).toBe(id);
      expect(compiled.totalCompiledSegments).toBeGreaterThan(0);
      expect(compiled.totalLengthMeters).toBeGreaterThan(0);
      expect(compiled.segments.length).toBe(compiled.totalCompiledSegments);
    });
  },
);

describe("test/elevation track", () => {
  it("contains non-zero authored grade so the live smoke path exercises hills", () => {
    const parsed = TrackSchema.parse(TRACK_RAW["test/elevation"]);
    expect(parsed.segments.some((segment) => segment.grade !== 0)).toBe(true);
  });

  it("compiles grade-bearing segments into the renderer segment buffer", () => {
    const compiled = loadTrack("test/elevation");
    expect(compiled.segments.some((segment) => segment.grade !== 0)).toBe(true);
  });
});

describe("§24 MVP track set", () => {
  it("covers the first two World Tour regions with clear, rain, and fog support", () => {
    const weather = new Set<string>();
    for (const id of EXPECTED_MVP_TRACK_IDS) {
      const parsed = TrackSchema.parse(TRACK_RAW[id]);
      expect(parsed.tourId).toBe(id.split("/")[0]);
      expect(parsed.laps).toBe(1);
      expect(parsed.laneCount).toBe(3);
      for (const option of parsed.weatherOptions) weather.add(option);
    }
    expect(weather.has("clear")).toBe(true);
    expect(weather.has("rain")).toBe(true);
    expect(weather.has("fog")).toBe(true);
  });

  it("includes authored curves and elevation across the bundled MVP tracks", () => {
    const tracks = EXPECTED_MVP_TRACK_IDS.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    expect(
      tracks.some((track) =>
        track.segments.some((segment) => segment.curve !== 0),
      ),
    ).toBe(true);
    expect(
      tracks.some((track) =>
        track.segments.some((segment) => segment.grade !== 0),
      ),
    ).toBe(true);
  });
});
