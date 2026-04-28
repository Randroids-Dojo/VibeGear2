import { describe, expect, it } from "vitest";

import type { Championship, SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import {
  buildWorldTourView,
  enterWorldTour,
  withFirstTourUnlocked,
} from "../worldTourState";

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
      tracks: [
        "iron-borough/freightline-ring",
        "iron-borough/rivet-tunnel",
        "iron-borough/foundry-mile",
        "iron-borough/outer-exchange",
      ],
    },
  ],
};

function freshSave(): SaveGame {
  return JSON.parse(JSON.stringify(defaultSave())) as SaveGame;
}

describe("buildWorldTourView", () => {
  it("treats the first tour as enterable for a fresh save", () => {
    const view = buildWorldTourView(freshSave(), CHAMPIONSHIP);

    expect(view.unlockedTourIds).toEqual(["velvet-coast"]);
    expect(view.cards[0]).toMatchObject({
      id: "velvet-coast",
      name: "Velvet Coast",
      firstTrackId: "velvet-coast/harbor-run",
      firstTrackName: "Harbor Run",
      state: "available",
      lockedReason: null,
    });
  });

  it("locks later tours with a gating-tour reason", () => {
    const view = buildWorldTourView(freshSave(), CHAMPIONSHIP);

    expect(view.cards[1]).toMatchObject({
      id: "iron-borough",
      state: "locked",
      lockedReason: "Complete Velvet Coast to unlock this tour.",
    });
  });

  it("marks completed tours separately from merely unlocked tours", () => {
    const save = freshSave();
    save.progress.unlockedTours = ["velvet-coast", "iron-borough"];
    save.progress.completedTours = ["velvet-coast"];

    const view = buildWorldTourView(save, CHAMPIONSHIP);

    expect(view.cards[0]?.state).toBe("completed");
    expect(view.cards[1]?.state).toBe("available");
  });
});

describe("enterWorldTour", () => {
  it("persists the first-tour unlock before entering a fresh save", () => {
    const save = freshSave();
    const result = enterWorldTour(save, CHAMPIONSHIP, "velvet-coast");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.progress.unlockedTours).toEqual(["velvet-coast"]);
    expect(result.save.progress.activeTour).toEqual({
      tourId: "velvet-coast",
      raceIndex: 0,
      results: [],
    });
    expect(result.activeTour).toEqual({
      tourId: "velvet-coast",
      raceIndex: 0,
      results: [],
    });
    expect(result.firstTrackId).toBe("velvet-coast/harbor-run");
  });

  it("rejects locked tours without mutating the input save", () => {
    const save = freshSave();
    const before = JSON.parse(JSON.stringify(save));

    const result = enterWorldTour(save, CHAMPIONSHIP, "iron-borough");

    expect(result).toEqual({ ok: false, code: "tour_locked" });
    expect(save).toEqual(before);
  });

  it("rejects a malformed tour with no first track instead of routing to a fallback", () => {
    const save = freshSave();
    const malformed: Championship = {
      ...CHAMPIONSHIP,
      tours: [{ ...CHAMPIONSHIP.tours[0]!, tracks: [] }],
    };

    const result = enterWorldTour(save, malformed, "velvet-coast");

    expect(result).toEqual({ ok: false, code: "unknown_tour" });
  });

  it("does not duplicate the first tour in an already-unlocked save", () => {
    const save = freshSave();
    save.progress.unlockedTours = ["velvet-coast"];

    expect(withFirstTourUnlocked(save, CHAMPIONSHIP).progress.unlockedTours).toEqual([
      "velvet-coast",
    ]);
  });
});
