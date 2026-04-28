import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";
import type { SaveGame } from "@/data/schemas";

import {
  ALL_ASSIST_FIELDS,
  ASSISTS,
  PANE_HEADLINE,
  PANE_SUBTITLE,
  VISIBLE_ASSIST_KEYS,
  WEATHER_ACCESSIBILITY_DEFAULTS,
  WEATHER_PARTICLE_INTENSITY_LABEL,
  WEATHER_SETTINGS_HEADLINE,
  WEATHER_SETTINGS_SUBTITLE,
  applyFogReadabilityClamp,
  applyAssistToggle,
  applyWeatherAccessibilityToggle,
  applyWeatherParticleIntensity,
  isAssistActive,
  readAssists,
  readWeatherAccessibility,
} from "../accessibilityPaneState";

/**
 * Pure model tests for the Accessibility pane (GDD §19, §20). These
 * cover the §19 assist catalogue, the read helpers, and the toggle
 * mutation without React, jsdom, or RTL. The thin React shell in
 * `AccessibilityPane.tsx` binds straight to these helpers.
 */

describe("ASSISTS catalogue (§19)", () => {
  it("declares the six §19 accessibility assists in canonical order", () => {
    expect(ASSISTS.map((a) => a.key)).toEqual([
      "autoAccelerate",
      "brakeAssist",
      "steeringSmoothing",
      "nitroToggleMode",
      "reducedSimultaneousInput",
      "weatherVisualReduction",
    ]);
  });

  it("ships a non-empty label and description for every assist", () => {
    for (const assist of ASSISTS) {
      expect(assist.label.length).toBeGreaterThan(0);
      expect(assist.description.length).toBeGreaterThan(0);
    }
  });

  it("never uses an em-dash in any catalogue copy (project rule)", () => {
    for (const assist of ASSISTS) {
      expect(assist.label).not.toMatch(/[\u2013\u2014]/u);
      expect(assist.description).not.toMatch(/[\u2013\u2014]/u);
    }
    expect(PANE_HEADLINE).not.toMatch(/[\u2013\u2014]/u);
    expect(PANE_SUBTITLE).not.toMatch(/[\u2013\u2014]/u);
    expect(WEATHER_SETTINGS_HEADLINE).not.toMatch(/[\u2013\u2014]/u);
    expect(WEATHER_SETTINGS_SUBTITLE).not.toMatch(/[\u2013\u2014]/u);
    expect(WEATHER_PARTICLE_INTENSITY_LABEL).not.toMatch(/[\u2013\u2014]/u);
  });

  it("the visible row keys are the §19 six (legacy schema fields excluded)", () => {
    expect(VISIBLE_ASSIST_KEYS).toEqual([
      "autoAccelerate",
      "brakeAssist",
      "steeringSmoothing",
      "nitroToggleMode",
      "reducedSimultaneousInput",
      "weatherVisualReduction",
    ]);
  });

  it("the schema's full assist field list still includes the legacy trio", () => {
    expect(ALL_ASSIST_FIELDS).toContain("steeringAssist");
    expect(ALL_ASSIST_FIELDS).toContain("autoNitro");
  });
});

describe("readWeatherAccessibility", () => {
  it("returns weather defaults on a fresh save", () => {
    expect(readWeatherAccessibility(defaultSave())).toEqual({
      ...WEATHER_ACCESSIBILITY_DEFAULTS,
    });
  });

  it("falls back to defaults when an old save has no accessibility bundle", () => {
    const save = defaultSave();
    const stripped: SaveGame = {
      ...save,
      settings: {
        ...save.settings,
        accessibility: undefined,
      },
    };
    expect(readWeatherAccessibility(stripped)).toEqual({
      ...WEATHER_ACCESSIBILITY_DEFAULTS,
    });
  });

  it("clamps persisted weather slider values when reading", () => {
    const save = defaultSave();
    const customised: SaveGame = {
      ...save,
      settings: {
        ...save.settings,
        accessibility: {
          ...save.settings.accessibility!,
          weatherParticleIntensity: 2,
          fogReadabilityClamp: -1,
        },
      },
    };
    expect(readWeatherAccessibility(customised).weatherParticleIntensity).toBe(1);
    expect(readWeatherAccessibility(customised).fogReadabilityClamp).toBe(0);
  });
});

describe("weather accessibility mutations", () => {
  it("applies the weather particle slider without mutating input", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);
    const result = applyWeatherParticleIntensity(save, 0.45);
    expect(JSON.stringify(save)).toBe(before);
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(
        result.save.settings.accessibility?.weatherParticleIntensity,
      ).toBeCloseTo(0.45, 6);
    }
  });

  it("clamps the fog readability slider before persisting", () => {
    const save = defaultSave();
    const result = applyFogReadabilityClamp(save, 2);
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.accessibility?.fogReadabilityClamp).toBe(1);
    }
  });

  it("returns a same-value noop for unchanged slider values", () => {
    const save = defaultSave();
    const result = applyWeatherParticleIntensity(save, 1);
    expect(result.kind).toBe("noop");
  });

  it("applies reduced glare and flash reduction independently", () => {
    let save = defaultSave();
    const glare = applyWeatherAccessibilityToggle(
      save,
      "reducedWeatherGlare",
      true,
    );
    if (glare.kind !== "applied") throw new Error("expected applied");
    save = glare.save;

    const flash = applyWeatherAccessibilityToggle(
      save,
      "weatherFlashReduction",
      true,
    );
    if (flash.kind !== "applied") throw new Error("expected applied");

    expect(flash.save.settings.accessibility?.reducedWeatherGlare).toBe(true);
    expect(flash.save.settings.accessibility?.weatherFlashReduction).toBe(true);
  });
});

describe("readAssists", () => {
  it("returns all six flags as false on a fresh save", () => {
    expect(readAssists(defaultSave())).toEqual({
      autoAccelerate: false,
      brakeAssist: false,
      steeringSmoothing: false,
      nitroToggleMode: false,
      reducedSimultaneousInput: false,
      weatherVisualReduction: false,
    });
  });

  it("treats undefined v1 fields as false (backwards-compatible default)", () => {
    const save = defaultSave();
    const stripped: SaveGame = {
      ...save,
      settings: {
        ...save.settings,
        assists: {
          steeringAssist: false,
          autoNitro: false,
          weatherVisualReduction: false,
        },
      },
    };
    expect(readAssists(stripped).autoAccelerate).toBe(false);
    expect(readAssists(stripped).brakeAssist).toBe(false);
    expect(readAssists(stripped).weatherVisualReduction).toBe(false);
  });

  it("surfaces persisted true values verbatim", () => {
    const save = defaultSave();
    const enabled: SaveGame = {
      ...save,
      settings: {
        ...save.settings,
        assists: {
          ...save.settings.assists,
          autoAccelerate: true,
          steeringSmoothing: true,
        },
      },
    };
    expect(readAssists(enabled).autoAccelerate).toBe(true);
    expect(readAssists(enabled).steeringSmoothing).toBe(true);
  });
});

describe("applyAssistToggle", () => {
  it("returns the next save with the toggle applied", () => {
    const save = defaultSave();
    const result = applyAssistToggle(save, "autoAccelerate", true);
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.assists.autoAccelerate).toBe(true);
    }
  });

  it("does not mutate the input save", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);
    applyAssistToggle(save, "brakeAssist", true);
    expect(JSON.stringify(save)).toBe(before);
  });

  it("returns a same-value noop when the value is already set", () => {
    const save = defaultSave();
    const result = applyAssistToggle(save, "autoAccelerate", false);
    expect(result.kind).toBe("noop");
    if (result.kind === "noop") {
      expect(result.reason).toBe("same-value");
    }
  });

  it("flips the toggle on and back off across two calls", () => {
    let save = defaultSave();
    const enable = applyAssistToggle(save, "nitroToggleMode", true);
    if (enable.kind !== "applied") throw new Error("expected applied");
    save = enable.save;
    expect(isAssistActive(save, "nitroToggleMode")).toBe(true);

    const disable = applyAssistToggle(save, "nitroToggleMode", false);
    if (disable.kind !== "applied") throw new Error("expected applied");
    expect(isAssistActive(disable.save, "nitroToggleMode")).toBe(false);
  });

  it("preserves the rest of the save when applying", () => {
    const save = defaultSave();
    const result = applyAssistToggle(save, "weatherVisualReduction", true);
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.save.profileName).toBe(save.profileName);
    expect(result.save.garage).toEqual(save.garage);
    expect(result.save.progress).toEqual(save.progress);
    expect(result.save.records).toEqual(save.records);
    expect(result.save.settings.displaySpeedUnit).toBe(
      save.settings.displaySpeedUnit,
    );
    expect(result.save.settings.difficultyPreset).toBe(
      save.settings.difficultyPreset,
    );
    expect(result.save.settings.assists.steeringAssist).toBe(
      save.settings.assists.steeringAssist,
    );
  });

  it("preserves untouched assist fields when toggling another", () => {
    let save = defaultSave();
    const a = applyAssistToggle(save, "autoAccelerate", true);
    if (a.kind !== "applied") throw new Error("expected applied");
    save = a.save;

    const b = applyAssistToggle(save, "brakeAssist", true);
    if (b.kind !== "applied") throw new Error("expected applied");
    expect(b.save.settings.assists.autoAccelerate).toBe(true);
    expect(b.save.settings.assists.brakeAssist).toBe(true);
  });
});

describe("isAssistActive", () => {
  it("reads false on a fresh save for every assist", () => {
    const save = defaultSave();
    for (const key of VISIBLE_ASSIST_KEYS) {
      expect(isAssistActive(save, key)).toBe(false);
    }
  });

  it("reads true after applyAssistToggle flips a field on", () => {
    const save = defaultSave();
    const result = applyAssistToggle(save, "reducedSimultaneousInput", true);
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(isAssistActive(result.save, "reducedSimultaneousInput")).toBe(true);
  });
});
