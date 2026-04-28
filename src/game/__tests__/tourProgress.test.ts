import { describe, expect, it } from "vitest";

import type { Championship, SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import { applyTourRaceResult } from "../tourProgress";
import type { RaceResult } from "../raceResult";

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
    {
      id: "iron-borough",
      requiredStanding: 4,
      tracks: ["iron-borough/freightline-ring"],
    },
  ],
};

function freshSave(): SaveGame {
  return JSON.parse(JSON.stringify(defaultSave())) as SaveGame;
}

function saveWithActiveTour(raceIndex = 0, placement = 1): SaveGame {
  const save = freshSave();
  save.progress.unlockedTours = ["velvet-coast"];
  save.progress.activeTour = {
    tourId: "velvet-coast",
    raceIndex,
    results: CHAMPIONSHIP.tours[0]!.tracks.slice(0, raceIndex).map((trackId) => ({
      trackId,
      placement,
      dnf: false,
      cashEarned: 1000,
    })),
  };
  return save;
}

function result(trackId: string, placement = 1): RaceResult {
  return {
    trackId,
    totalLaps: 1,
    finishingOrder: [
      {
        carId: "player",
        status: "finished",
        raceTimeMs: 60_000,
        bestLapMs: 60_000,
      },
    ],
    playerCarId: "player",
    playerPlacement: placement,
    pointsEarned: 25,
    cashEarned: 1000,
    cashBaseEarned: 1000,
    creditsAwarded: 1000,
    bonuses: [],
    damageTaken: { engine: 0, tires: 0, body: 0 },
    fastestLap: null,
    nextRace: null,
    recordsUpdated: null,
  };
}

describe("applyTourRaceResult", () => {
  it("advances the active tour and annotates the next race", () => {
    const save = saveWithActiveTour(0);
    const applied = applyTourRaceResult({
      save,
      result: result("velvet-coast/harbor-run", 2),
      championship: CHAMPIONSHIP,
    });

    expect(applied.save.progress.activeTour).toEqual({
      tourId: "velvet-coast",
      raceIndex: 1,
      results: [
        {
          trackId: "velvet-coast/harbor-run",
          placement: 2,
          dnf: false,
          cashEarned: 1000,
        },
      ],
    });
    expect(applied.result.tourProgress).toMatchObject({
      tourId: "velvet-coast",
      raceIndex: 0,
      nextRaceIndex: 1,
      completed: false,
    });
  });

  it("clears the active tour and unlocks the next tour after a passing final race", () => {
    const save = saveWithActiveTour(3);
    const applied = applyTourRaceResult({
      save,
      result: result("velvet-coast/lighthouse-fall", 1),
      championship: CHAMPIONSHIP,
    });

    expect(applied.save.progress.activeTour).toBeUndefined();
    expect(applied.save.progress.completedTours).toEqual(["velvet-coast"]);
    expect(applied.save.progress.unlockedTours).toEqual([
      "velvet-coast",
      "iron-borough",
    ]);
    expect(applied.result.tourProgress).toMatchObject({
      tourId: "velvet-coast",
      raceIndex: 3,
      nextRaceIndex: null,
      completed: true,
      passed: true,
      playerStanding: 1,
      unlockedTourId: "iron-borough",
    });
    expect(applied.summary?.bonuses[0]).toMatchObject({
      kind: "tourComplete",
    });
    expect(applied.summary?.bonuses[0]?.cashCredits).toBeGreaterThan(
      result("velvet-coast/lighthouse-fall", 1).cashEarned / 2,
    );
  });

  it("clears the active tour without unlocking on a failed final race", () => {
    const save = saveWithActiveTour(3, 9);
    const applied = applyTourRaceResult({
      save,
      result: result("velvet-coast/lighthouse-fall", 9),
      championship: CHAMPIONSHIP,
    });

    expect(applied.save.progress.activeTour).toBeUndefined();
    expect(applied.save.progress.completedTours).toEqual([]);
    expect(applied.save.progress.unlockedTours).toEqual(["velvet-coast"]);
    expect(applied.result.tourProgress).toMatchObject({
      completed: true,
      passed: false,
      unlockedTourId: null,
    });
  });

  it("does nothing when no active tour is stored", () => {
    const save = freshSave();
    const raceResult = result("test/straight");

    const applied = applyTourRaceResult({
      save,
      result: raceResult,
      championship: CHAMPIONSHIP,
    });

    expect(applied.save).toBe(save);
    expect(applied.result).toBe(raceResult);
    expect(applied.summary).toBeNull();
  });
});
