import { describe, expect, it } from "vitest";

import {
  AccessibilitySettingsSchema,
  AudioSettingsSchema,
  KeyBindingsSchema,
  SaveGameSettingsSchema,
} from "@/data/schemas";

describe("AudioSettingsSchema", () => {
  it("accepts a happy-path mix at the §20 defaults", () => {
    const result = AudioSettingsSchema.safeParse({
      master: 1,
      music: 0.8,
      sfx: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("accepts the zero-volume edge", () => {
    expect(
      AudioSettingsSchema.safeParse({ master: 0, music: 0, sfx: 0 }).success,
    ).toBe(true);
  });

  it("rejects a level above 1", () => {
    expect(
      AudioSettingsSchema.safeParse({ master: 1.1, music: 0.5, sfx: 0.5 })
        .success,
    ).toBe(false);
  });

  it("rejects a negative level", () => {
    expect(
      AudioSettingsSchema.safeParse({ master: -0.1, music: 0.5, sfx: 0.5 })
        .success,
    ).toBe(false);
  });

  it("rejects a missing channel", () => {
    expect(
      AudioSettingsSchema.safeParse({ master: 1, music: 0.8 }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric level", () => {
    expect(
      AudioSettingsSchema.safeParse({ master: "loud", music: 0.5, sfx: 0.5 })
        .success,
    ).toBe(false);
  });
});

describe("AccessibilitySettingsSchema", () => {
  const happy = {
    colorBlindMode: "off" as const,
    reducedMotion: false,
    largeUiText: false,
    screenShakeScale: 1,
  };

  it("accepts the §20 documented defaults", () => {
    expect(AccessibilitySettingsSchema.safeParse(happy).success).toBe(true);
  });

  it("accepts the §14 weather accessibility defaults", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        weatherParticleIntensity: 1,
        reducedWeatherGlare: false,
        highContrastRoadsideSigns: false,
        fogReadabilityClamp: 0,
        weatherFlashReduction: false,
      }).success,
    ).toBe(true);
  });

  it("accepts each colourblind mode", () => {
    for (const mode of ["off", "protanopia", "deuteranopia", "tritanopia"]) {
      expect(
        AccessibilitySettingsSchema.safeParse({
          ...happy,
          colorBlindMode: mode,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown colourblind mode", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        colorBlindMode: "rainbow",
      }).success,
    ).toBe(false);
  });

  it("accepts screenShakeScale 0 (disable shake entirely)", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        screenShakeScale: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects screenShakeScale above 1", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        screenShakeScale: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-boolean reducedMotion", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        reducedMotion: "yes",
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range weather accessibility sliders", () => {
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        weatherParticleIntensity: 1.5,
      }).success,
    ).toBe(false);
    expect(
      AccessibilitySettingsSchema.safeParse({
        ...happy,
        fogReadabilityClamp: -0.1,
      }).success,
    ).toBe(false);
  });
});

describe("KeyBindingsSchema", () => {
  it("accepts a populated bindings map", () => {
    expect(
      KeyBindingsSchema.safeParse({
        accelerate: ["ArrowUp", "KeyW"],
        brake: ["ArrowDown"],
      }).success,
    ).toBe(true);
  });

  it("accepts an empty bindings map", () => {
    // The runtime input layer falls back to DEFAULT_KEY_BINDINGS when an
    // action is missing; an empty map is a degenerate but valid persistence.
    expect(KeyBindingsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an empty key list for an action", () => {
    expect(
      KeyBindingsSchema.safeParse({ accelerate: [] }).success,
    ).toBe(false);
  });

  it("caps a key list at four entries", () => {
    expect(
      KeyBindingsSchema.safeParse({
        accelerate: ["A", "B", "C", "D", "E"],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-string key token", () => {
    expect(
      KeyBindingsSchema.safeParse({ accelerate: [42] }).success,
    ).toBe(false);
  });

  it("rejects an empty action key", () => {
    expect(
      KeyBindingsSchema.safeParse({ "": ["KeyA"] }).success,
    ).toBe(false);
  });
});

describe("SaveGameSettingsSchema (v2 expansion)", () => {
  const minimumV1Compat = {
    displaySpeedUnit: "kph",
    assists: {
      steeringAssist: false,
      autoNitro: false,
      weatherVisualReduction: false,
    },
  };

  it("still accepts a v1-shaped settings object (backward-compat)", () => {
    expect(SaveGameSettingsSchema.safeParse(minimumV1Compat).success).toBe(
      true,
    );
  });

  it("accepts a fully populated v2 settings object", () => {
    expect(
      SaveGameSettingsSchema.safeParse({
        ...minimumV1Compat,
        difficultyPreset: "normal",
        transmissionMode: "auto",
        audio: { master: 1, music: 0.8, sfx: 0.9 },
        accessibility: {
          colorBlindMode: "off",
          reducedMotion: false,
          largeUiText: false,
          screenShakeScale: 1,
          weatherParticleIntensity: 1,
          reducedWeatherGlare: false,
          highContrastRoadsideSigns: false,
          fogReadabilityClamp: 0,
          weatherFlashReduction: false,
        },
        keyBindings: { accelerate: ["ArrowUp"] },
      }).success,
    ).toBe(true);
  });

  it("rejects an out-of-range audio level inside the bundle", () => {
    expect(
      SaveGameSettingsSchema.safeParse({
        ...minimumV1Compat,
        audio: { master: 2, music: 1, sfx: 1 },
      }).success,
    ).toBe(false);
  });
});
