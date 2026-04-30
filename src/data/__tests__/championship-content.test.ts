/**
 * Content tests for the canonical championship JSON.
 *
 * `world-tour-standard.json` must:
 * - validate against `ChampionshipSchema` from `docs/gdd/22-data-schemas.md`,
 * - declare exactly 8 tours of 4 tracks each per `docs/gdd/24-content-plan.md`
 *   "Suggested region and track list",
 * - hold monotonic non-increasing `requiredStanding` values across tours
 *   (later tours never raise the bar above an earlier tour),
 * - reference only track ids that resolve in `TRACK_RAW` once the full
 *   32-track content set lands. During the MVP window, the cross-reference
 *   test runs in permissive mode by default (since the track set is being
 *   authored across sibling slices). Set
 *   `STRICT_CHAMPIONSHIP_TRACKS=1` to fail on any unresolved id; remove
 *   the permissive branch entirely once §24 ships.
 *
 * Adding a championship: drop a JSON in `src/data/championships/`,
 * register it in `src/data/championships/index.ts`, and add an
 * `it("exposes ...")` block below if it should be present in the catalogue
 * by default.
 */

import { describe, expect, it } from "vitest";

import {
  CHAMPIONSHIPS,
  CHAMPIONSHIPS_BY_ID,
  getChampionship,
} from "@/data/championships";
import { AI_DRIVERS_BY_ID } from "@/data/ai";
import { ChampionshipSchema } from "@/data/schemas";
import { SPONSOR_OBJECTIVES_BY_ID } from "@/data/sponsors";
import { TRACK_RAW } from "@/data/tracks";

const WORLD_TOUR_ID = "world-tour-standard";

// MVP phase guard: full track set ships across sibling slices. Default to
// permissive so the suite is green during the content build-out window.
// Flip via `STRICT_CHAMPIONSHIP_TRACKS=1` to enforce full resolution; the
// permissive branch goes away once §24 content fully ships.
const STRICT_TRACK_RESOLUTION =
  process.env.STRICT_CHAMPIONSHIP_TRACKS === "1";

describe("championship catalogue", () => {
  it("exposes the canonical World Tour championship", () => {
    expect(CHAMPIONSHIPS.length).toBeGreaterThanOrEqual(1);
    expect(CHAMPIONSHIPS_BY_ID.has(WORLD_TOUR_ID)).toBe(true);
  });

  it("indexes every championship uniquely", () => {
    expect(CHAMPIONSHIPS_BY_ID.size).toBe(CHAMPIONSHIPS.length);
    for (const c of CHAMPIONSHIPS) {
      expect(CHAMPIONSHIPS_BY_ID.get(c.id)).toBe(c);
    }
  });

  it("returns the parsed championship via getChampionship", () => {
    const parsed = getChampionship(WORLD_TOUR_ID);
    expect(parsed.id).toBe(WORLD_TOUR_ID);
    expect(parsed.name).toBe("World Tour");
    expect(parsed.difficultyPreset).toBe("normal");
  });

  it("throws on unknown championship id", () => {
    expect(() => getChampionship("nonexistent-tour")).toThrow(
      /unknown championship id/,
    );
  });
});

describe.each(CHAMPIONSHIPS.map((c) => [c.id, c] as const))(
  "championship JSON: %s",
  (_id, championship) => {
    it("validates against ChampionshipSchema", () => {
      const result = ChampionshipSchema.safeParse(championship);
      if (!result.success) {
        throw new Error(
          `ChampionshipSchema rejected ${championship.id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });
  },
);

describe("world-tour-standard structure", () => {
  const wt = getChampionship(WORLD_TOUR_ID);

  it("has 8 tours per §24 'Suggested region and track list'", () => {
    expect(wt.tours.length).toBe(8);
  });

  it("has exactly 4 tracks in every tour per §24", () => {
    for (const tour of wt.tours) {
      expect(tour.tracks.length).toBe(4);
    }
  });

  it("has 32 tracks total per §24 'Full v1.0 content'", () => {
    const total = wt.tours.reduce((sum, t) => sum + t.tracks.length, 0);
    expect(total).toBe(32);
  });

  it("uses unique tour ids", () => {
    const ids = wt.tours.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses unique track ids across the championship", () => {
    const all = wt.tours.flatMap((t) => t.tracks);
    expect(new Set(all).size).toBe(all.length);
  });

  it("nests every track id under its tour id", () => {
    for (const tour of wt.tours) {
      for (const trackId of tour.tracks) {
        expect(trackId.startsWith(`${tour.id}/`)).toBe(true);
      }
    }
  });

  it("has monotonic non-increasing requiredStanding tour-by-tour", () => {
    for (let i = 1; i < wt.tours.length; i += 1) {
      const prev = wt.tours[i - 1];
      const curr = wt.tours[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (!prev || !curr) continue;
      expect(curr.requiredStanding).toBeLessThanOrEqual(prev.requiredStanding);
    }
  });
});

describe("world-tour-standard track id cross-references", () => {
  const wt = getChampionship(WORLD_TOUR_ID);
  const allTrackIds = wt.tours.flatMap((t) => t.tracks);
  const mvpTrackIds = wt.tours.slice(0, 2).flatMap((t) => t.tracks);
  const hasBundledTrack = (id: string) =>
    Object.prototype.hasOwnProperty.call(TRACK_RAW, id);
  const unresolved = allTrackIds.filter((id) => !hasBundledTrack(id));

  if (STRICT_TRACK_RESOLUTION) {
    it("resolves every referenced track id in TRACK_RAW (strict mode)", () => {
      expect(unresolved).toEqual([]);
    });
  } else {
    it("resolves every authored §24 track id through Glass Ridge", () => {
      const authoredTrackIds = wt.tours.slice(0, 5).flatMap((t) => t.tracks);
      expect(authoredTrackIds.filter((id) => !hasBundledTrack(id))).toEqual([]);
    });

    it("permits unresolved track ids during the MVP content window", () => {
      // Phase guard: full 32-track set is authored in sibling slices.
      // The presence of unresolved ids is expected; this assertion still
      // runs to catch regressions that drop already-authored tracks.
      const resolvedCount = allTrackIds.length - unresolved.length;
      expect(resolvedCount).toBeGreaterThanOrEqual(mvpTrackIds.length);
      expect(allTrackIds.length).toBe(32);
    });
  }
});

describe("world-tour-standard sponsor roster cross-references", () => {
  const wt = getChampionship(WORLD_TOUR_ID);

  it("declares a non-empty sponsor roster on every tour per F-040", () => {
    for (const tour of wt.tours) {
      expect(tour.sponsors).toBeDefined();
      expect((tour.sponsors ?? []).length).toBeGreaterThan(0);
    }
  });

  it("resolves every referenced sponsor id in SPONSOR_OBJECTIVES_BY_ID", () => {
    for (const tour of wt.tours) {
      for (const sponsorId of tour.sponsors ?? []) {
        expect(SPONSOR_OBJECTIVES_BY_ID.has(sponsorId)).toBe(true);
      }
    }
  });
});

describe("world-tour-standard AI roster cross-references", () => {
  const wt = getChampionship(WORLD_TOUR_ID);

  it("resolves every referenced AI driver id", () => {
    for (const tour of wt.tours) {
      for (const driverId of tour.aiDrivers ?? []) {
        expect(AI_DRIVERS_BY_ID.has(driverId)).toBe(true);
      }
    }
  });

  it("declares 11 AI drivers for each authored MVP tour", () => {
    for (const tour of wt.tours.slice(0, 2)) {
      expect(tour.aiDrivers ?? []).toHaveLength(11);
    }
  });
});
