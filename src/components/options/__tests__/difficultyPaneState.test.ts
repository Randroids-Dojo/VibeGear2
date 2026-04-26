import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";
import type { SaveGame } from "@/data/schemas";

import {
  MASTER_UNLOCK_HINT,
  MID_TOUR_NOTE,
  PRESETS,
  applyPresetSelection,
  getPresetSpec,
  isMasterUnlocked,
  readPreset,
} from "../difficultyPaneState";

/**
 * Pure model tests for the Difficulty pane (GDD §15, §20). These exercise
 * the §15 preset table, the unlock predicate, and the selection mutation
 * without React, jsdom, or RTL. The thin React shell in
 * `DifficultyPane.tsx` binds straight to these helpers.
 */

function withCompletedTour(save: SaveGame): SaveGame {
  return {
    ...save,
    progress: {
      ...save.progress,
      completedTours: ["velvet-coast"],
    },
  };
}

describe("PRESETS table (§15)", () => {
  it("declares the four §15 tiers in order", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["easy", "normal", "hard", "master"]);
  });

  it("uses the verbatim §15 AI pace values", () => {
    expect(getPresetSpec("easy").aiPace).toBe("-8%");
    expect(getPresetSpec("normal").aiPace).toBe("Baseline");
    expect(getPresetSpec("hard").aiPace).toBe("+5%");
    expect(getPresetSpec("master").aiPace).toBe("+9%");
  });

  it("uses the verbatim §15 rubber-banding labels", () => {
    expect(getPresetSpec("easy").rubberBanding).toBe("Medium assist");
    expect(getPresetSpec("normal").rubberBanding).toBe("Mild");
    expect(getPresetSpec("hard").rubberBanding).toBe("Minimal");
    expect(getPresetSpec("master").rubberBanding).toBe("None");
  });

  it("uses the verbatim §15 mistake frequencies", () => {
    expect(getPresetSpec("easy").mistakes).toBe("Frequent");
    expect(getPresetSpec("normal").mistakes).toBe("Occasional");
    expect(getPresetSpec("hard").mistakes).toBe("Rare");
    expect(getPresetSpec("master").mistakes).toBe("Very rare");
  });

  it("uses the verbatim §15 economy-pressure labels", () => {
    expect(getPresetSpec("easy").economyPressure).toBe("Low");
    expect(getPresetSpec("normal").economyPressure).toBe("Moderate");
    expect(getPresetSpec("hard").economyPressure).toBe("High");
    expect(getPresetSpec("master").economyPressure).toBe("High");
  });

  it("ships a non-empty player-facing summary per preset", () => {
    for (const preset of PRESETS) {
      expect(preset.summary.length).toBeGreaterThan(0);
    }
  });

  it("never uses an em-dash in the table copy (project rule)", () => {
    for (const preset of PRESETS) {
      expect(preset.summary).not.toMatch(/[–—]/u);
      expect(preset.aiPace).not.toMatch(/[–—]/u);
      expect(preset.rubberBanding).not.toMatch(/[–—]/u);
      expect(preset.mistakes).not.toMatch(/[–—]/u);
      expect(preset.economyPressure).not.toMatch(/[–—]/u);
    }
  });
});

describe("string constants", () => {
  it("MASTER_UNLOCK_HINT names the §15 unlock condition", () => {
    expect(MASTER_UNLOCK_HINT).toMatch(/championship/i);
    expect(MASTER_UNLOCK_HINT).toMatch(/Hard/);
    expect(MASTER_UNLOCK_HINT).not.toMatch(/[–—]/u);
  });

  it("MID_TOUR_NOTE explains the active-championship freeze", () => {
    expect(MID_TOUR_NOTE).toMatch(/championship/i);
    expect(MID_TOUR_NOTE).toMatch(/future tours/i);
    expect(MID_TOUR_NOTE).not.toMatch(/[–—]/u);
  });
});

describe("getPresetSpec", () => {
  it("returns the matching spec by id", () => {
    expect(getPresetSpec("hard").label).toBe("Hard");
  });
});

describe("readPreset", () => {
  it("returns 'normal' when the save has no difficulty preset (v1 backfill)", () => {
    const save = defaultSave();
    const stripped: SaveGame = {
      ...save,
      settings: { ...save.settings, difficultyPreset: undefined },
    };
    expect(readPreset(stripped)).toBe("normal");
  });

  it("returns the persisted preset when set", () => {
    const save = defaultSave();
    const next: SaveGame = {
      ...save,
      settings: { ...save.settings, difficultyPreset: "hard" },
    };
    expect(readPreset(next)).toBe("hard");
  });

  it("default save reads as Normal per §28 default", () => {
    expect(readPreset(defaultSave())).toBe("normal");
  });
});

describe("isMasterUnlocked", () => {
  it("locks Master on a fresh save (no completed tours)", () => {
    expect(isMasterUnlocked(defaultSave())).toBe(false);
  });

  it("unlocks Master after at least one completed tour", () => {
    expect(isMasterUnlocked(withCompletedTour(defaultSave()))).toBe(true);
  });
});

describe("applyPresetSelection", () => {
  it("returns the next save with the new preset", () => {
    const save = defaultSave();
    const result = applyPresetSelection(save, "hard");
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.difficultyPreset).toBe("hard");
    }
  });

  it("does not mutate the input save", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);
    applyPresetSelection(save, "hard");
    expect(JSON.stringify(save)).toBe(before);
  });

  it("returns a same-preset noop when the preset is already active", () => {
    const save = defaultSave();
    const result = applyPresetSelection(save, "normal");
    expect(result.kind).toBe("noop");
    if (result.kind === "noop") {
      expect(result.reason).toBe("same-preset");
    }
  });

  it("returns a locked noop when selecting Master without the unlock", () => {
    const save = defaultSave();
    const result = applyPresetSelection(save, "master");
    expect(result.kind).toBe("noop");
    if (result.kind === "noop") {
      expect(result.reason).toBe("locked");
    }
  });

  it("allows Master once the unlock condition is met", () => {
    const save = withCompletedTour(defaultSave());
    const result = applyPresetSelection(save, "master");
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.difficultyPreset).toBe("master");
    }
  });

  it("preserves the rest of the save when applying", () => {
    const save = defaultSave();
    const result = applyPresetSelection(save, "easy");
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.save.profileName).toBe(save.profileName);
    expect(result.save.garage).toEqual(save.garage);
    expect(result.save.progress).toEqual(save.progress);
    expect(result.save.records).toEqual(save.records);
    expect(result.save.settings.assists).toEqual(save.settings.assists);
    expect(result.save.settings.displaySpeedUnit).toBe(
      save.settings.displaySpeedUnit,
    );
  });
});
