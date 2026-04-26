/**
 * Unit tests for the tour and championship primitives in
 * `src/game/championship.ts`.
 *
 * Coverage targets the dot-spec verify list cell-by-cell:
 * - `enterTour` returns activeTour seeded at raceIndex 0; rejects
 *   unknown_tour and tour_locked without mutating the save.
 * - `recordResult` appends and increments raceIndex; never mutates.
 * - `tourComplete` aggregates standings per the §7 PLACEMENT_POINTS
 *   table; honours `tour.requiredStanding` boundary; DNF contributes 0.
 * - `unlockNextTour` appends the next tour and the completed tour;
 *   final tour unlocks no successor; idempotent on re-run.
 *
 * Every test asserts purity: deep-clone the save before the call and
 * deep-equal compare it after the call. Same input shape across runs
 * produces deep-equal output (determinism).
 */

import { describe, expect, it } from "vitest";

import type { Championship, SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import {
  enterTour,
  recordResult,
  tourComplete,
  unlockNextTour,
  type ActiveTour,
  type TourRaceResult,
} from "../championship";
import { PLACEMENT_POINTS } from "../raceResult";

function freshSave(): SaveGame {
  return JSON.parse(JSON.stringify(defaultSave())) as SaveGame;
}

const FIXTURE_CHAMPIONSHIP: Championship = {
  id: "test-championship",
  name: "Test Championship",
  difficultyPreset: "normal",
  tours: [
    {
      id: "first-tour",
      requiredStanding: 4,
      tracks: ["first/a", "first/b", "first/c", "first/d"],
    },
    {
      id: "second-tour",
      requiredStanding: 3,
      tracks: ["second/a", "second/b", "second/c", "second/d"],
    },
    {
      id: "third-tour",
      requiredStanding: 2,
      tracks: ["third/a", "third/b", "third/c", "third/d"],
    },
  ],
};

function unlockedSave(...tourIds: ReadonlyArray<string>): SaveGame {
  const save = freshSave();
  save.progress.unlockedTours = [...tourIds];
  return save;
}

function makeResult(trackId: string, placement: number, dnf = false): TourRaceResult {
  return { trackId, placement, dnf };
}

describe("enterTour", () => {
  it("seeds activeTour at raceIndex 0 with empty results when the tour is unlocked", () => {
    const save = unlockedSave("first-tour");
    const result = enterTour(save, FIXTURE_CHAMPIONSHIP, "first-tour");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activeTour).toEqual({
      tourId: "first-tour",
      raceIndex: 0,
      results: [],
    });
  });

  it("rejects with unknown_tour when the id is not in the championship", () => {
    const save = unlockedSave("first-tour");
    const result = enterTour(save, FIXTURE_CHAMPIONSHIP, "ghost-tour");
    expect(result).toEqual({ ok: false, code: "unknown_tour" });
  });

  it("rejects with tour_locked when the tour exists but is not unlocked", () => {
    const save = freshSave();
    save.progress.unlockedTours = [];
    const result = enterTour(save, FIXTURE_CHAMPIONSHIP, "first-tour");
    expect(result).toEqual({ ok: false, code: "tour_locked" });
  });

  it("does not mutate the input save on any branch", () => {
    const save = unlockedSave("first-tour");
    const before = JSON.parse(JSON.stringify(save));
    enterTour(save, FIXTURE_CHAMPIONSHIP, "first-tour");
    enterTour(save, FIXTURE_CHAMPIONSHIP, "ghost-tour");
    enterTour(save, FIXTURE_CHAMPIONSHIP, "second-tour");
    expect(save).toEqual(before);
  });
});

describe("recordResult", () => {
  it("appends the result and increments raceIndex", () => {
    const start: ActiveTour = { tourId: "first-tour", raceIndex: 0, results: [] };
    const after = recordResult(start, makeResult("first/a", 3));
    expect(after).toEqual({
      tourId: "first-tour",
      raceIndex: 1,
      results: [{ trackId: "first/a", placement: 3, dnf: false }],
    });
  });

  it("accumulates four results without mutating the previous cursor", () => {
    let cursor: ActiveTour = { tourId: "first-tour", raceIndex: 0, results: [] };
    const placements = [4, 2, 5, 1];
    placements.forEach((p, i) => {
      cursor = recordResult(cursor, makeResult(`first/${i}`, p));
    });
    expect(cursor.raceIndex).toBe(4);
    expect(cursor.results.map((r) => r.placement)).toEqual(placements);
  });

  it("does not mutate the input cursor", () => {
    const start: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 1,
      results: [makeResult("first/a", 5)],
    };
    const before = JSON.parse(JSON.stringify(start));
    recordResult(start, makeResult("first/b", 3));
    expect(start).toEqual(before);
  });
});

describe("tourComplete", () => {
  it("returns passed=true when player aggregate standing is below requiredStanding", () => {
    // First tour requiredStanding = 4. P1 finishes drive points up.
    const cursor: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 4,
      results: [
        makeResult("first/a", 1),
        makeResult("first/b", 1),
        makeResult("first/c", 1),
        makeResult("first/d", 1),
      ],
    };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(summary.passed).toBe(true);
    expect(summary.playerStanding).toBe(1);
  });

  it("returns passed=true at the boundary (player standing == requiredStanding)", () => {
    // Second tour requiredStanding = 3. Construct results so player finishes 3rd in standings.
    const cursor: ActiveTour = {
      tourId: "second-tour",
      raceIndex: 4,
      results: [
        makeResult("second/a", 3),
        makeResult("second/b", 3),
        makeResult("second/c", 3),
        makeResult("second/d", 3),
      ],
    };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(summary.passed).toBe(true);
    expect(summary.playerStanding).toBe(3);
  });

  it("returns passed=false when player standing exceeds requiredStanding", () => {
    // Third tour requiredStanding = 2. Player finishes 6th in every race.
    const cursor: ActiveTour = {
      tourId: "third-tour",
      raceIndex: 4,
      results: [
        makeResult("third/a", 6),
        makeResult("third/b", 6),
        makeResult("third/c", 6),
        makeResult("third/d", 6),
      ],
    };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(summary.passed).toBe(false);
    // Five AI cars rank ahead of the player at placement 1 through 5.
    expect(summary.playerStanding).toBe(6);
  });

  it("aggregates points using the §7 PLACEMENT_POINTS table; DNF contributes 0", () => {
    const cursor: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 4,
      results: [
        makeResult("first/a", 2), // 18
        makeResult("first/b", 4), // 12
        makeResult("first/c", 0, true), // dnf -> 0
        makeResult("first/d", 1), // 25
      ],
    };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    const player = summary.standings.find((e) => e.carId === "player");
    expect(player).toBeDefined();
    expect(player?.points).toBe(
      (PLACEMENT_POINTS[2] ?? 0) +
        (PLACEMENT_POINTS[4] ?? 0) +
        (PLACEMENT_POINTS[1] ?? 0),
    );
    expect(player?.placements).toEqual([2, 4, 0, 1]);
  });

  it("returns empty standings when the tour id is unknown to the championship", () => {
    const cursor: ActiveTour = { tourId: "ghost", raceIndex: 0, results: [] };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(summary).toEqual({ passed: false, playerStanding: null, standings: [] });
  });

  it("uses the supplied playerCarId in the standings", () => {
    const cursor: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 1,
      results: [makeResult("first/a", 2)],
    };
    const summary = tourComplete(cursor, FIXTURE_CHAMPIONSHIP, "sparrow-gt");
    expect(summary.standings.some((e) => e.carId === "sparrow-gt")).toBe(true);
    expect(summary.standings.every((e) => e.carId !== "player")).toBe(true);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const cursor: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 4,
      results: [
        makeResult("first/a", 1),
        makeResult("first/b", 3),
        makeResult("first/c", 2),
        makeResult("first/d", 5),
      ],
    };
    const a = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    const b = tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(a).toEqual(b);
  });

  it("does not mutate the input cursor or championship", () => {
    const cursor: ActiveTour = {
      tourId: "first-tour",
      raceIndex: 4,
      results: [
        makeResult("first/a", 1),
        makeResult("first/b", 2),
        makeResult("first/c", 3),
        makeResult("first/d", 4),
      ],
    };
    const cursorBefore = JSON.parse(JSON.stringify(cursor));
    const championshipBefore = JSON.parse(JSON.stringify(FIXTURE_CHAMPIONSHIP));
    tourComplete(cursor, FIXTURE_CHAMPIONSHIP);
    expect(cursor).toEqual(cursorBefore);
    expect(FIXTURE_CHAMPIONSHIP).toEqual(championshipBefore);
  });
});

describe("unlockNextTour", () => {
  it("appends the next tour id to unlockedTours and the completed id to completedTours", () => {
    const save = unlockedSave("first-tour");
    const after = unlockNextTour(save, "first-tour", FIXTURE_CHAMPIONSHIP);
    expect(after.progress.unlockedTours).toEqual(["first-tour", "second-tour"]);
    expect(after.progress.completedTours).toEqual(["first-tour"]);
  });

  it("the final tour records completion but unlocks no successor", () => {
    const save = unlockedSave("first-tour", "second-tour", "third-tour");
    save.progress.completedTours = ["first-tour", "second-tour"];
    const after = unlockNextTour(save, "third-tour", FIXTURE_CHAMPIONSHIP);
    expect(after.progress.unlockedTours).toEqual([
      "first-tour",
      "second-tour",
      "third-tour",
    ]);
    expect(after.progress.completedTours).toEqual([
      "first-tour",
      "second-tour",
      "third-tour",
    ]);
  });

  it("is idempotent on re-run: repeated calls do not duplicate ids", () => {
    const save = unlockedSave("first-tour");
    const once = unlockNextTour(save, "first-tour", FIXTURE_CHAMPIONSHIP);
    const twice = unlockNextTour(once, "first-tour", FIXTURE_CHAMPIONSHIP);
    expect(twice.progress.unlockedTours).toEqual(["first-tour", "second-tour"]);
    expect(twice.progress.completedTours).toEqual(["first-tour"]);
    // Idempotent runs return the same reference (unchanged save).
    expect(twice).toBe(once);
  });

  it("returns the original save unchanged when the completed tour id is unknown", () => {
    const save = unlockedSave("first-tour");
    const after = unlockNextTour(save, "ghost-tour", FIXTURE_CHAMPIONSHIP);
    expect(after).toBe(save);
  });

  it("does not mutate the input save", () => {
    const save = unlockedSave("first-tour");
    const before = JSON.parse(JSON.stringify(save));
    unlockNextTour(save, "first-tour", FIXTURE_CHAMPIONSHIP);
    expect(save).toEqual(before);
  });
});
