import { describe, expect, it } from "vitest";

import { getChampionship } from "@/data/championships";
import { TRACK_RAW } from "@/data/tracks";
import { TrackSchema, type SaveGame, type WeatherOption } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import {
  buildPreRaceCard,
  difficultyLabel,
  recommendTire,
  resolveWeatherSelection,
} from "../preRaceCard";

describe("pre-race card", () => {
  const track = TrackSchema.parse(TRACK_RAW["velvet-coast/harbor-run"]);
  const championship = getChampionship("world-tour-standard");

  it("populates the required §20 and §14 fields", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        credits: 1250,
        pendingDamage: {
          "sparrow-gt": {
            zones: { engine: 0.1, tires: 0.2, body: 0.05 },
            total: 0.115,
            offRoadAccumSeconds: 0,
          },
        },
      },
      progress: {
        ...defaultSave().progress,
        activeTour: {
          tourId: "velvet-coast",
          raceIndex: 1,
          results: [{ trackId: "velvet-coast/harbor-run", placement: 2, dnf: false }],
        },
      },
    };

    const card = buildPreRaceCard({
      track,
      save,
      championship,
      tourId: "velvet-coast",
      raceIndex: 1,
      weatherSelection: "rain",
      selectedTire: "wet",
    });

    expect(card.trackName).toBe("Harbor Run");
    expect(card.tourName).toBe("Velvet Coast");
    expect(card.weather).toBe("rain");
    expect(card.laps).toBe(1);
    expect(card.difficulty).toEqual({ value: 1, label: "Easy" });
    expect(card.recommendedTire).toBe("wet");
    expect(card.forecast.condition).toBe("Rain");
    expect(card.forecast.surfaceTemperatureBand).toBe("Wet");
    expect(card.forecast.visibilityRating).toBe("Medium");
    expect(card.standings).toBe("Race 2 of 4, 1 complete");
    expect(card.cashOnHand).toBe(1250);
    expect(card.repairEstimate).toBeGreaterThan(0);
    expect(card.baseReward).toBe(1000);
    expect(card.carSummary.name).toBe("Sparrow GT");
    expect(card.setupSummary).toBe("Stock setup");
  });

  it.each([
    ["clear", "dry"],
    ["overcast", "dry"],
    ["light_rain", "wet"],
    ["rain", "wet"],
    ["heavy_rain", "wet"],
    ["fog", "dry"],
    ["snow", "wet"],
    ["dusk", "dry"],
    ["night", "dry"],
  ] satisfies ReadonlyArray<readonly [WeatherOption, "dry" | "wet"]>)(
    "recommends %s tires for %s",
    (weather, expected) => {
      expect(recommendTire(weather)).toBe(expected);
    },
  );

  it("falls back to the track default when the requested weather is not allowed", () => {
    expect(resolveWeatherSelection(track, "snow")).toBe("clear");
    expect(resolveWeatherSelection(track, "fog")).toBe("fog");
  });

  it("warns when the selected tire does not match the forecast", () => {
    const card = buildPreRaceCard({
      track,
      save: defaultSave(),
      championship,
      tourId: "velvet-coast",
      weatherSelection: "rain",
      selectedTire: "dry",
    });

    expect(card.recommendedTire).toBe("wet");
    expect(card.selectedTireWarning).toContain("wet tires");
  });

  it("surfaces overcast as a clear-adjacent forecast", () => {
    const rawTrack = TRACK_RAW["velvet-coast/harbor-run"];
    if (!rawTrack) throw new Error("expected Harbor Run fixture");
    const overcastTrack = TrackSchema.parse({
      ...rawTrack,
      weatherOptions: ["clear", "overcast"],
    });
    const card = buildPreRaceCard({
      track: overcastTrack,
      save: defaultSave(),
      weatherSelection: "overcast",
    });

    expect(card.forecast.condition).toBe("Overcast");
    expect(card.forecast.surfaceTemperatureBand).toBe("Warm");
    expect(card.forecast.visibilityRating).toBe("High");
    expect(card.recommendedTire).toBe("dry");
  });

  it.each([
    [1, "Easy"],
    [2, "Moderate"],
    [3, "Hard"],
    [4, "Expert"],
    [5, "Master"],
  ])("labels difficulty %i as %s", (value, expected) => {
    expect(difficultyLabel(value)).toBe(expected);
  });
});
