/**
 * Unit tests for the catch-up mechanisms in `src/game/catchUp.ts`.
 *
 * Coverage targets the dot-spec verify list cell-by-cell: stipend
 * threshold, first-tour gate, double-pay guard, repair cap on every
 * difficulty / kind cell, easy-mode bonus gating, and the practice
 * weather preview's identity behaviour. Every test asserts purity
 * (input never mutated, deep-equal post-call) and determinism
 * where applicable.
 */

import { describe, expect, it } from "vitest";

import type { SaveGame, Track } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";

import {
  cappedRepairCost,
  computeStipend,
  easyModeBonus,
  EASY_MODE_TOUR_BONUS_FRACTION,
  getStipendClaimed,
  practiceWeatherPreview,
  recordStipendClaim,
  REPAIR_CAP_FRACTION,
  STIPEND_AMOUNT,
  STIPEND_THRESHOLD_CREDITS,
  type StipendTourContext,
} from "../catchUp";

function freshSave(): SaveGame {
  // Deep clone so a stray mutation cannot leak through the
  // module-level `defaultSave()` reference shared across tests.
  return JSON.parse(JSON.stringify(defaultSave())) as SaveGame;
}

const TOUR_1: StipendTourContext = { id: "velvet-coast", index: 1 };
const TOUR_2: StipendTourContext = { id: "glass-ridge", index: 2 };

describe("computeStipend", () => {
  it("returns STIPEND_AMOUNT when wallet is below threshold on a non-first tour", () => {
    const save = freshSave();
    save.garage.credits = STIPEND_THRESHOLD_CREDITS - 1;
    expect(computeStipend(save, TOUR_2)).toBe(STIPEND_AMOUNT);
  });

  it("returns 0 when wallet is exactly at the threshold (strict less-than)", () => {
    const save = freshSave();
    save.garage.credits = STIPEND_THRESHOLD_CREDITS;
    expect(computeStipend(save, TOUR_2)).toBe(0);
  });

  it("returns 0 when wallet is above the threshold", () => {
    const save = freshSave();
    save.garage.credits = STIPEND_THRESHOLD_CREDITS + 5000;
    expect(computeStipend(save, TOUR_2)).toBe(0);
  });

  it("returns 0 on the first tour even at zero credits (first-tour gate)", () => {
    const save = freshSave();
    save.garage.credits = 0;
    expect(computeStipend(save, TOUR_1)).toBe(0);
  });

  it("returns 0 when the stipend has already been claimed for the same tour", () => {
    const before = freshSave();
    before.garage.credits = 0;
    const after = recordStipendClaim(before, TOUR_2.id);
    expect(computeStipend(after, TOUR_2)).toBe(0);
  });

  it("granted stipend on tour-2 does not block stipend on a different tour-3", () => {
    const before = freshSave();
    before.garage.credits = 0;
    const after2 = recordStipendClaim(before, TOUR_2.id);
    const tour3: StipendTourContext = { id: "iron-summit", index: 3 };
    expect(computeStipend(after2, tour3)).toBe(STIPEND_AMOUNT);
  });

  it("never mutates the input save", () => {
    const before = freshSave();
    before.garage.credits = 0;
    const snapshot = JSON.parse(JSON.stringify(before));
    computeStipend(before, TOUR_2);
    expect(before).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const save = freshSave();
    save.garage.credits = 100;
    expect(computeStipend(save, TOUR_2)).toBe(computeStipend(save, TOUR_2));
  });
});

describe("recordStipendClaim", () => {
  it("returns a fresh save with the claim recorded under the tour id", () => {
    const before = freshSave();
    const after = recordStipendClaim(before, TOUR_2.id);
    expect(getStipendClaimed(after, TOUR_2.id)).toBe(true);
  });

  it("preserves prior claims when a second tour is recorded", () => {
    const before = freshSave();
    const afterFirst = recordStipendClaim(before, TOUR_2.id);
    const afterSecond = recordStipendClaim(afterFirst, "alpine-pass");
    expect(getStipendClaimed(afterSecond, TOUR_2.id)).toBe(true);
    expect(getStipendClaimed(afterSecond, "alpine-pass")).toBe(true);
  });

  it("never mutates the input save", () => {
    const before = freshSave();
    const snapshot = JSON.parse(JSON.stringify(before));
    recordStipendClaim(before, TOUR_2.id);
    expect(before).toEqual(snapshot);
  });

  it("is idempotent: re-recording the same tour yields equal-shape saves", () => {
    const before = freshSave();
    const once = recordStipendClaim(before, TOUR_2.id);
    const twice = recordStipendClaim(once, TOUR_2.id);
    expect(twice).toEqual(once);
  });

  it("getStipendClaimed returns false when the optional field is absent", () => {
    const save = freshSave();
    expect(getStipendClaimed(save, TOUR_2.id)).toBe(false);
  });
});

describe("cappedRepairCost", () => {
  it("caps an essential repair to REPAIR_CAP_FRACTION of race income on normal", () => {
    const result = cappedRepairCost(2000, 4000, "essential", "normal");
    const expected = Math.min(2000, Math.round(4000 * REPAIR_CAP_FRACTION));
    expect(result).toBe(expected);
    expect(result).toBe(1600);
  });

  it("returns rawCost when the cap ceiling is higher than rawCost (no-op cap)", () => {
    // 0.40 * 10000 = 4000 ceiling; raw 1500 is already below. Cap is a no-op.
    expect(cappedRepairCost(1500, 10000, "essential", "normal")).toBe(1500);
  });

  it("applies the cap on easy difficulty", () => {
    const result = cappedRepairCost(5000, 4000, "essential", "easy");
    expect(result).toBe(Math.round(4000 * REPAIR_CAP_FRACTION));
  });

  it("applies the cap on novice (championship-side alias)", () => {
    const result = cappedRepairCost(5000, 4000, "essential", "novice");
    expect(result).toBe(Math.round(4000 * REPAIR_CAP_FRACTION));
  });

  it("does NOT apply the cap on hard difficulty", () => {
    expect(cappedRepairCost(5000, 4000, "essential", "hard")).toBe(5000);
  });

  it("does NOT apply the cap on master difficulty", () => {
    expect(cappedRepairCost(5000, 4000, "essential", "master")).toBe(5000);
  });

  it("does NOT apply the cap on extreme difficulty", () => {
    expect(cappedRepairCost(5000, 4000, "essential", "extreme")).toBe(5000);
  });

  it("does NOT apply the cap on a 'full' repair (any difficulty)", () => {
    expect(cappedRepairCost(2000, 4000, "full", "normal")).toBe(2000);
    expect(cappedRepairCost(2000, 4000, "full", "easy")).toBe(2000);
  });

  it("returns 0 when raceCashEarned is 0 (no income, no cost on essential)", () => {
    expect(cappedRepairCost(2000, 0, "essential", "normal")).toBe(0);
  });

  it("clamps a negative raceCashEarned to a 0 ceiling on essential repair", () => {
    expect(cappedRepairCost(2000, -500, "essential", "normal")).toBe(0);
  });

  it("clamps a negative rawCost to 0", () => {
    expect(cappedRepairCost(-100, 4000, "full", "normal")).toBe(0);
  });

  it("rounds the cap ceiling so an odd-cents income does not produce a fractional cost", () => {
    // 0.40 * 1233 = 493.2 -> rounds to 493
    expect(cappedRepairCost(2000, 1233, "essential", "normal")).toBe(493);
  });

  it("is deterministic across repeated calls", () => {
    const a = cappedRepairCost(2000, 4000, "essential", "normal");
    const b = cappedRepairCost(2000, 4000, "essential", "normal");
    expect(a).toBe(b);
  });
});

describe("easyModeBonus", () => {
  it("returns the rounded fraction when difficulty preset is 'easy'", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "easy";
    const rewards = [1000, 800, 600, 400];
    const sum = rewards.reduce((a, b) => a + b, 0);
    expect(easyModeBonus(save, rewards)).toBe(
      Math.round(sum * EASY_MODE_TOUR_BONUS_FRACTION),
    );
  });

  it("returns 0 when difficulty preset is 'normal'", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "normal";
    expect(easyModeBonus(save, [1000, 800])).toBe(0);
  });

  it("returns 0 when difficulty preset is 'hard'", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "hard";
    expect(easyModeBonus(save, [1000, 800])).toBe(0);
  });

  it("returns 0 when difficulty preset is 'master'", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "master";
    expect(easyModeBonus(save, [1000, 800])).toBe(0);
  });

  it("returns 0 when difficulty preset is undefined (legacy v1 save)", () => {
    const save = freshSave();
    save.settings.difficultyPreset = undefined;
    expect(easyModeBonus(save, [1000, 800])).toBe(0);
  });

  it("returns 0 for an empty rewards list even on easy", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "easy";
    expect(easyModeBonus(save, [])).toBe(0);
  });

  it("ignores negative rewards rather than clawing back the bonus", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "easy";
    expect(easyModeBonus(save, [1000, -500, 800])).toBe(
      Math.round((1000 + 800) * EASY_MODE_TOUR_BONUS_FRACTION),
    );
  });

  it("never mutates the input save", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "easy";
    const snapshot = JSON.parse(JSON.stringify(save));
    easyModeBonus(save, [1000, 800]);
    expect(save).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const save = freshSave();
    save.settings.difficultyPreset = "easy";
    const a = easyModeBonus(save, [1234, 567]);
    const b = easyModeBonus(save, [1234, 567]);
    expect(a).toBe(b);
  });
});

describe("practiceWeatherPreview", () => {
  function fakeTrack(weatherOptions: Track["weatherOptions"]): Track {
    return {
      id: "practice-test",
      name: "Practice Test",
      tourId: "test",
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
          roadsideLeft: "guardrail",
          roadsideRight: "guardrail",
          hazards: [],
        },
      ],
      checkpoints: [],
      spawn: { gridSlots: 1 },
    };
  }

  it("returns the track's weatherOptions array unchanged", () => {
    const track = fakeTrack(["clear", "rain", "fog"]);
    expect(practiceWeatherPreview(track)).toEqual(["clear", "rain", "fog"]);
  });

  it("preserves single-option tracks", () => {
    const track = fakeTrack(["clear"]);
    expect(practiceWeatherPreview(track)).toEqual(["clear"]);
  });

  it("returns a reference equal to the underlying array (no defensive copy)", () => {
    // Documented behaviour: the readonly type prevents mutation; the
    // function does not allocate. If a caller needs a copy they spread.
    const track = fakeTrack(["clear", "rain"]);
    expect(practiceWeatherPreview(track)).toBe(track.weatherOptions);
  });

  it("is deterministic across repeated calls", () => {
    const track = fakeTrack(["clear", "snow", "fog"]);
    const a = practiceWeatherPreview(track);
    const b = practiceWeatherPreview(track);
    expect(a).toEqual(b);
  });
});
