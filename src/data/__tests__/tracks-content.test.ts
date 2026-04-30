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

const EXPECTED_AUTHORED_TOUR_TRACK_IDS = [
  ...EXPECTED_MVP_TRACK_IDS,
  "ember-steppe/redglass-straight",
  "ember-steppe/mesa-coil",
  "ember-steppe/dustbreak-causeway",
  "ember-steppe/cinder-gate",
  "breakwater-isles/tidewire",
  "breakwater-isles/storm-span",
  "breakwater-isles/gull-point",
  "breakwater-isles/sealight-shelf",
];

const EXPECTED_IDS = [
  "breakwater-isles/gull-point",
  "breakwater-isles/sealight-shelf",
  "breakwater-isles/storm-span",
  "breakwater-isles/tidewire",
  "ember-steppe/cinder-gate",
  "ember-steppe/dustbreak-causeway",
  "ember-steppe/mesa-coil",
  "ember-steppe/redglass-straight",
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
  it("registers every expected bundled track id", () => {
    expect([...TRACK_IDS].sort()).toEqual(EXPECTED_IDS);
  });

  it("registers the authored World Tour track set through Breakwater Isles", () => {
    for (const id of EXPECTED_AUTHORED_TOUR_TRACK_IDS) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("does not register benchmark-only tracks in the user-facing catalogue", () => {
    expect(TRACK_IDS.some((id) => id.startsWith("benchmark/"))).toBe(false);
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

describe("§24 Ember Steppe track set", () => {
  const emberTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("ember-steppe/"),
  );

  it("covers all four planned Ember Steppe tracks", () => {
    expect(emberTrackIds).toEqual([
      "ember-steppe/redglass-straight",
      "ember-steppe/mesa-coil",
      "ember-steppe/dustbreak-causeway",
      "ember-steppe/cinder-gate",
    ]);
    for (const id of emberTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Ember Steppe region weather profile and desert hazards", () => {
    const tracks = emberTrackIds.map((id) => TrackSchema.parse(TRACK_RAW[id]));
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("ember-steppe");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["clear", "fog"]);
    expect(hazards.has("gravel_band")).toBe(true);
    expect(hazards.has("traffic_cone")).toBe(true);
  });
});

describe("§24 Breakwater Isles track set", () => {
  const breakwaterTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("breakwater-isles/"),
  );

  it("covers all four planned Breakwater Isles tracks", () => {
    expect(breakwaterTrackIds).toEqual([
      "breakwater-isles/tidewire",
      "breakwater-isles/storm-span",
      "breakwater-isles/gull-point",
      "breakwater-isles/sealight-shelf",
    ]);
    for (const id of breakwaterTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Breakwater Isles region weather profile and wet hazards", () => {
    const tracks = breakwaterTrackIds.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("breakwater-isles");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["heavy_rain", "overcast", "rain"]);
    expect(hazards.has("puddle")).toBe(true);
    expect(hazards.has("slick_paint")).toBe(true);
  });
});
