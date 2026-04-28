import { describe, expect, it } from "vitest";

import { HAZARDS, HAZARDS_BY_ID, TRACK_RAW } from "@/data";
import { HazardRegistryEntrySchema, TrackSchema } from "@/data/schemas";

describe("hazard registry", () => {
  it("validates every bundled hazard entry", () => {
    for (const hazard of HAZARDS) {
      expect(HazardRegistryEntrySchema.safeParse(hazard).success).toBe(true);
    }
  });

  it("indexes hazard ids uniquely", () => {
    expect(HAZARDS_BY_ID.size).toBe(HAZARDS.length);
  });

  it("resolves every hazard id referenced by bundled tracks", () => {
    const missing: string[] = [];
    for (const [trackId, raw] of Object.entries(TRACK_RAW)) {
      const track = TrackSchema.parse(raw);
      for (const [segmentIndex, segment] of track.segments.entries()) {
        for (const hazardId of segment.hazards) {
          if (!HAZARDS_BY_ID.has(hazardId)) {
            missing.push(`${trackId}:${segmentIndex}:${hazardId}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
