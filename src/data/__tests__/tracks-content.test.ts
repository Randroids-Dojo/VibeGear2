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

const EXPECTED_IDS = ["test/curve", "test/elevation", "test/straight"];

describe("track catalogue", () => {
  it("registers every expected MVP track id", () => {
    expect([...TRACK_IDS].sort()).toEqual(EXPECTED_IDS);
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
