import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";

import { resetShippedOptionsToDefaults } from "../optionsResetState";

describe("resetShippedOptionsToDefaults", () => {
  it("resets assists, audio, and difficulty to defaults", () => {
    const save = defaultSave();
    const customised = {
      ...save,
      settings: {
        ...save.settings,
        assists: {
          ...save.settings.assists,
          autoAccelerate: true,
          brakeAssist: true,
        },
        audio: { master: 0.25, music: 0.35, sfx: 0.45 },
        difficultyPreset: "hard" as const,
      },
    };

    const result = resetShippedOptionsToDefaults(customised, defaultSave());

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.assists).toEqual(defaultSave().settings.assists);
      expect(result.save.settings.audio).toEqual(defaultSave().settings.audio);
      expect(result.save.settings.difficultyPreset).toBe("normal");
    }
  });

  it("preserves placeholder-owned settings and profile data", () => {
    const save = defaultSave();
    const customised = {
      ...save,
      profileName: "Reset Proof",
      settings: {
        ...save.settings,
        displaySpeedUnit: "mph" as const,
        transmissionMode: "manual" as const,
        audio: { master: 0.2, music: 0.3, sfx: 0.4 },
        accessibility: {
          colorBlindMode: "protanopia" as const,
          reducedMotion: true,
          largeUiText: true,
          screenShakeScale: 0.25,
        },
        keyBindings: {
          throttle: ["KeyI"],
          brake: ["KeyK"],
        },
        assists: {
          ...save.settings.assists,
          nitroToggleMode: true,
        },
        difficultyPreset: "easy" as const,
      },
      garage: {
        ...save.garage,
        credits: 1234,
      },
    };

    const result = resetShippedOptionsToDefaults(customised, defaultSave());

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.profileName).toBe("Reset Proof");
      expect(result.save.garage.credits).toBe(1234);
      expect(result.save.settings.displaySpeedUnit).toBe("mph");
      expect(result.save.settings.transmissionMode).toBe("manual");
      expect(result.save.settings.audio).toEqual(defaultSave().settings.audio);
      expect(result.save.settings.accessibility).toEqual(
        customised.settings.accessibility,
      );
      expect(result.save.settings.keyBindings).toEqual(
        defaultSave().settings.keyBindings,
      );
    }
  });

  it("returns noop when shipped options already match defaults", () => {
    const save = defaultSave();

    expect(resetShippedOptionsToDefaults(save, defaultSave())).toEqual({
      kind: "noop",
      reason: "already-default",
    });
  });

  it("does not mutate the input save", () => {
    const save = defaultSave();
    const customised = {
      ...save,
      settings: {
        ...save.settings,
        assists: {
          ...save.settings.assists,
          steeringSmoothing: true,
        },
        difficultyPreset: "hard" as const,
      },
    };
    const before = JSON.stringify(customised);

    resetShippedOptionsToDefaults(customised, defaultSave());

    expect(JSON.stringify(customised)).toBe(before);
  });
});
