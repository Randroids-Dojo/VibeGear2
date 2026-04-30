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
  "glass-ridge/whitepass",
  "glass-ridge/frostrelay",
  "glass-ridge/hollow-crest",
  "glass-ridge/summit-echo",
  "neon-meridian/arc-boulevard",
  "neon-meridian/prism-cut",
  "neon-meridian/skyline-drain",
  "neon-meridian/afterglow-run",
  "moss-frontier/pine-switchback",
  "moss-frontier/millstream",
  "moss-frontier/wetroot-drive",
  "moss-frontier/mistbarrow",
  "crown-circuit/embassy-loop",
  "crown-circuit/victory-causeway",
  "crown-circuit/grand-meridian",
  "crown-circuit/final-horizon",
];

const EXPECTED_IDS = [
  "breakwater-isles/gull-point",
  "breakwater-isles/sealight-shelf",
  "breakwater-isles/storm-span",
  "breakwater-isles/tidewire",
  "crown-circuit/embassy-loop",
  "crown-circuit/final-horizon",
  "crown-circuit/grand-meridian",
  "crown-circuit/victory-causeway",
  "ember-steppe/cinder-gate",
  "ember-steppe/dustbreak-causeway",
  "ember-steppe/mesa-coil",
  "ember-steppe/redglass-straight",
  "glass-ridge/frostrelay",
  "glass-ridge/hollow-crest",
  "glass-ridge/summit-echo",
  "glass-ridge/whitepass",
  "iron-borough/foundry-mile",
  "iron-borough/freightline-ring",
  "iron-borough/outer-exchange",
  "iron-borough/rivet-tunnel",
  "moss-frontier/millstream",
  "moss-frontier/mistbarrow",
  "moss-frontier/pine-switchback",
  "moss-frontier/wetroot-drive",
  "neon-meridian/afterglow-run",
  "neon-meridian/arc-boulevard",
  "neon-meridian/prism-cut",
  "neon-meridian/skyline-drain",
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

  it("registers the full authored World Tour track set", () => {
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

describe("§24 Glass Ridge track set", () => {
  const glassRidgeTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("glass-ridge/"),
  );

  it("covers all four planned Glass Ridge tracks", () => {
    expect(glassRidgeTrackIds).toEqual([
      "glass-ridge/whitepass",
      "glass-ridge/frostrelay",
      "glass-ridge/hollow-crest",
      "glass-ridge/summit-echo",
    ]);
    for (const id of glassRidgeTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Glass Ridge region weather profile and alpine hazards", () => {
    const tracks = glassRidgeTrackIds.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("glass-ridge");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["dusk", "fog", "snow"]);
    expect(hazards.has("snow_buildup")).toBe(true);
    expect(hazards.has("tunnel")).toBe(true);
  });
});

describe("§24 Neon Meridian track set", () => {
  const neonMeridianTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("neon-meridian/"),
  );

  it("covers all four planned Neon Meridian tracks", () => {
    expect(neonMeridianTrackIds).toEqual([
      "neon-meridian/arc-boulevard",
      "neon-meridian/prism-cut",
      "neon-meridian/skyline-drain",
      "neon-meridian/afterglow-run",
    ]);
    for (const id of neonMeridianTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Neon Meridian region weather profile and urban hazards", () => {
    const tracks = neonMeridianTrackIds.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("neon-meridian");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["dusk", "night", "rain"]);
    expect(hazards.has("slick_paint")).toBe(true);
    expect(hazards.has("puddle")).toBe(true);
    expect(hazards.has("tunnel")).toBe(true);
  });
});

describe("§24 Moss Frontier track set", () => {
  const mossFrontierTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("moss-frontier/"),
  );

  it("covers all four planned Moss Frontier tracks", () => {
    expect(mossFrontierTrackIds).toEqual([
      "moss-frontier/pine-switchback",
      "moss-frontier/millstream",
      "moss-frontier/wetroot-drive",
      "moss-frontier/mistbarrow",
    ]);
    for (const id of mossFrontierTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Moss Frontier region weather profile and wet forest hazards", () => {
    const tracks = mossFrontierTrackIds.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("moss-frontier");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["fog", "heavy_rain", "rain"]);
    expect(hazards.has("puddle")).toBe(true);
    expect(hazards.has("gravel_band")).toBe(true);
    expect(hazards.has("slick_paint")).toBe(true);
  });
});

describe("§24 Crown Circuit track set", () => {
  const crownCircuitTrackIds = EXPECTED_AUTHORED_TOUR_TRACK_IDS.filter((id) =>
    id.startsWith("crown-circuit/"),
  );

  it("covers all four planned Crown Circuit tracks", () => {
    expect(crownCircuitTrackIds).toEqual([
      "crown-circuit/embassy-loop",
      "crown-circuit/victory-causeway",
      "crown-circuit/grand-meridian",
      "crown-circuit/final-horizon",
    ]);
    for (const id of crownCircuitTrackIds) {
      expect(TRACK_IDS).toContain(id);
    }
  });

  it("uses the Crown Circuit region weather profile and finale hazards", () => {
    const tracks = crownCircuitTrackIds.map((id) =>
      TrackSchema.parse(TRACK_RAW[id]),
    );
    const weather = new Set<string>();
    const hazards = new Set<string>();
    for (const track of tracks) {
      expect(track.tourId).toBe("crown-circuit");
      expect(track.laps).toBe(1);
      expect(track.laneCount).toBe(3);
      for (const option of track.weatherOptions) weather.add(option);
      for (const segment of track.segments) {
        for (const hazard of segment.hazards) hazards.add(hazard);
      }
    }
    expect([...weather].sort()).toEqual(["clear", "fog", "rain", "snow"]);
    expect(hazards.has("slick_paint")).toBe(true);
    expect(hazards.has("puddle")).toBe(true);
    expect(hazards.has("snow_buildup")).toBe(true);
  });
});
