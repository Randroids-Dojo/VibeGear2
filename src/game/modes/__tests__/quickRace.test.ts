import { describe, expect, it } from "vitest";

import type { Car, Championship, Track } from "@/data/schemas";
import { defaultSave } from "@/persistence";

import { buildQuickRaceView, quickRaceHref } from "../quickRace";

const CHAMPIONSHIP: Championship = {
  id: "world-tour-standard",
  name: "World Tour",
  difficultyPreset: "normal",
  tours: [
    {
      id: "velvet-coast",
      requiredStanding: 4,
      tracks: ["velvet-coast/harbor-run", "velvet-coast/sunpier-loop"],
    },
    {
      id: "iron-borough",
      requiredStanding: 4,
      tracks: ["iron-borough/freightline-ring"],
    },
  ],
};

const TRACKS = new Map<string, Track>(
  [
    track("velvet-coast/harbor-run", "Harbor Run", ["clear", "rain"]),
    track("velvet-coast/sunpier-loop", "Sunpier Loop", ["clear"]),
    track("iron-borough/freightline-ring", "Freightline Ring", ["fog"]),
  ].map((entry) => [entry.id, entry]),
);

const CARS = new Map<string, Car>([
  [
    "sparrow-gt",
    {
      id: "sparrow-gt",
      name: "Sparrow GT",
      class: "balance",
      purchasePrice: 0,
      repairFactor: 1,
      baseStats: {
        topSpeed: 61,
        accel: 16,
        brake: 28,
        gripDry: 1,
        gripWet: 0.82,
        stability: 1,
        durability: 0.95,
        nitroEfficiency: 1,
      },
      upgradeCaps: {
        engine: 4,
        gearbox: 4,
        dryTires: 4,
        wetTires: 4,
        nitro: 4,
        armor: 4,
        cooling: 4,
        aero: 3,
      },
      visualProfile: {
        spriteSet: "sparrow_gt",
        paletteSet: "starter_a",
      },
    },
  ],
]);

describe("buildQuickRaceView", () => {
  it("lists the first tour tracks for a fresh save", () => {
    const view = buildQuickRaceView({
      save: defaultSave(),
      championship: CHAMPIONSHIP,
      tracksById: TRACKS,
      carsById: CARS,
    });

    expect(view.tracks.map((option) => option.id)).toEqual([
      "velvet-coast/harbor-run",
      "velvet-coast/sunpier-loop",
    ]);
    expect(view.cars.map((option) => option.id)).toEqual(["sparrow-gt"]);
  });

  it("includes tracks from later unlocked tours without duplicates", () => {
    const save = defaultSave();
    const unlocked = {
      ...save,
      progress: {
        ...save.progress,
        unlockedTours: ["velvet-coast", "iron-borough"],
      },
    };

    const view = buildQuickRaceView({
      save: unlocked,
      championship: CHAMPIONSHIP,
      tracksById: TRACKS,
      carsById: CARS,
    });

    expect(view.tracks.map((option) => option.id)).toEqual([
      "velvet-coast/harbor-run",
      "velvet-coast/sunpier-loop",
      "iron-borough/freightline-ring",
    ]);
  });
});

describe("quickRaceHref", () => {
  it("builds the race URL with mode, track, weather, and car", () => {
    expect(
      quickRaceHref({
        trackId: "velvet-coast/harbor-run",
        weather: "rain",
        carId: "sparrow-gt",
      }),
    ).toBe(
      "/race?mode=quickRace&track=velvet-coast%2Fharbor-run&weather=rain&car=sparrow-gt",
    );
  });
});

function track(
  id: string,
  name: string,
  weatherOptions: Track["weatherOptions"],
): Track {
  return {
    id,
    name,
    tourId: id.split("/")[0] ?? "test",
    author: "test",
    version: 1,
    lengthMeters: 1000,
    laps: 1,
    laneCount: 2,
    weatherOptions,
    difficulty: 1,
    segments: [
      {
        len: 100,
        curve: 0,
        grade: 0,
        roadsideLeft: "none",
        roadsideRight: "none",
        hazards: [],
      },
    ],
    checkpoints: [],
    spawn: { gridSlots: 2 },
  };
}
