import { describe, expect, it } from "vitest";

import type { Championship, SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import { buildTourPressureSummary, estimateFullRepair } from "../tourPressure";

const CHAMPIONSHIP: Championship = {
  id: "world-tour-standard",
  name: "World Tour",
  difficultyPreset: "normal",
  tours: [
    {
      id: "velvet-coast",
      requiredStanding: 4,
      tracks: [
        "velvet-coast/harbor-run",
        "velvet-coast/sunpier-loop",
        "velvet-coast/cliffline-arc",
        "velvet-coast/lighthouse-fall",
      ],
    },
  ],
};

function saveWithTour(overrides: Partial<SaveGame> = {}): SaveGame {
  const base = defaultSave();
  return {
    ...base,
    ...overrides,
    garage: {
      ...base.garage,
      credits: 1_500,
      pendingDamage: {
        "sparrow-gt": {
          zones: { engine: 0.1, tires: 0.2, body: 0.05 },
          total: 0.115,
          offRoadAccumSeconds: 0,
        },
      },
      ...overrides.garage,
    },
    progress: {
      ...base.progress,
      unlockedTours: ["velvet-coast"],
      activeTour: {
        tourId: "velvet-coast",
        raceIndex: 1,
        results: [
          {
            trackId: "velvet-coast/harbor-run",
            placement: 6,
            dnf: false,
            cashEarned: 700,
          },
        ],
      },
      ...overrides.progress,
    },
  };
}

describe("buildTourPressureSummary", () => {
  it("summarises standings, gate, repair room, and upgrade gap", () => {
    const save = saveWithTour();
    const summary = buildTourPressureSummary({
      save,
      championship: CHAMPIONSHIP,
    });

    expect(summary).toMatchObject({
      tourId: "velvet-coast",
      progressLabel: "Race 2 of 4, 1 complete",
      nextRaceId: "velvet-coast/sunpier-loop",
      nextRaceLabel: "Sunpier Loop",
      gateLabel: "Need 4th or better to advance",
      playerStanding: 6,
      requiredStanding: 4,
      playerPoints: 8,
      nextUpgradeLabel: "Street Cooling",
      nextUpgradeCost: 1000,
    });
    expect(summary?.repairEstimate).toBeGreaterThan(0);
    expect(summary?.cashAfterRepair).toBeLessThan(save.garage.credits);
    expect(summary?.upgradeShortfall).toBeGreaterThanOrEqual(0);
    expect(summary?.pressureLabel).toContain("Chase");
  });

  it("returns null when no active tour is stored", () => {
    const save = defaultSave();

    expect(
      buildTourPressureSummary({ save, championship: CHAMPIONSHIP }),
    ).toBeNull();
  });

  it("handles the opening race without inventing completed standings pressure", () => {
    const save = saveWithTour({
      progress: {
        ...defaultSave().progress,
        unlockedTours: ["velvet-coast"],
        activeTour: {
          tourId: "velvet-coast",
          raceIndex: 0,
          results: [],
        },
      },
    });

    const summary = buildTourPressureSummary({
      save,
      championship: CHAMPIONSHIP,
    });

    expect(summary?.progressLabel).toBe("Race 1 of 4, 0 complete");
    expect(summary?.pressureLabel).toBe(
      "Opening race: bank points for the top 4 gate",
    );
  });
});

describe("estimateFullRepair", () => {
  it("uses pending garage damage instead of trusting the stored total", () => {
    const save = saveWithTour({
      garage: {
        ...defaultSave().garage,
        credits: 1_500,
        pendingDamage: {
          "sparrow-gt": {
            zones: { engine: 0.5, tires: 0, body: 0 },
            total: 0,
            offRoadAccumSeconds: 0,
          },
        },
      },
    });

    expect(estimateFullRepair(save)).toBeGreaterThan(0);
  });
});
