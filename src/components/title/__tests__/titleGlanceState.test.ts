import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence/save";
import { getChampionship } from "@/data";
import type { SaveGame } from "@/data/schemas";

import { buildTitleGlance } from "../titleGlanceState";

const CHAMPIONSHIP = getChampionship("world-tour-standard");

describe("buildTitleGlance", () => {
  it("returns credits, owned cars, tour totals, and no continue card on a fresh save", () => {
    const save = defaultSave();
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance).not.toBeNull();
    if (!glance) return;
    expect(glance.credits).toBe(0);
    expect(glance.ownedCarCount).toBe(1);
    expect(glance.toursCompleted).toBe(0);
    expect(glance.toursTotal).toBe(CHAMPIONSHIP.tours.length);
    expect(glance.continueTour).toBeNull();
  });

  it("counts completed tours from the progress ledger", () => {
    const base = defaultSave();
    const save: SaveGame = {
      ...base,
      progress: {
        ...base.progress,
        completedTours: ["velvet-coast", "iron-borough"],
      },
    };
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance?.toursCompleted).toBe(2);
  });

  it("surfaces a continue-tour affordance when activeTour is set", () => {
    const base = defaultSave();
    const tour = CHAMPIONSHIP.tours[0]!;
    const save: SaveGame = {
      ...base,
      progress: {
        ...base.progress,
        unlockedTours: [tour.id],
        activeTour: {
          tourId: tour.id,
          raceIndex: 1,
          results: [],
        },
      },
    };
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance?.continueTour).toEqual({
      tourId: tour.id,
      tourName: expect.any(String),
      nextTrackId: tour.tracks[1]!,
      nextRaceIndex: 1,
    });
  });

  it("returns null continueTour when the activeTour points outside the track list", () => {
    const base = defaultSave();
    const tour = CHAMPIONSHIP.tours[0]!;
    const save: SaveGame = {
      ...base,
      progress: {
        ...base.progress,
        unlockedTours: [tour.id],
        activeTour: {
          tourId: tour.id,
          raceIndex: 99,
          results: [],
        },
      },
    };
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance?.continueTour).toBeNull();
  });

  it("returns null continueTour when activeTour names an unknown tour id", () => {
    const base = defaultSave();
    const save: SaveGame = {
      ...base,
      progress: {
        ...base.progress,
        activeTour: {
          tourId: "ghost-tour",
          raceIndex: 0,
          results: [],
        },
      },
    };
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance?.continueTour).toBeNull();
  });

  it("title-cases the tour id for display", () => {
    const base = defaultSave();
    const tour = CHAMPIONSHIP.tours.find((t) => t.id === "iron-borough");
    expect(tour).toBeDefined();
    if (!tour) return;
    const save: SaveGame = {
      ...base,
      progress: {
        ...base.progress,
        unlockedTours: [tour.id],
        activeTour: { tourId: tour.id, raceIndex: 0, results: [] },
      },
    };
    const glance = buildTitleGlance(save, CHAMPIONSHIP);
    expect(glance?.continueTour?.tourName).toBe("Iron Borough");
  });
});
