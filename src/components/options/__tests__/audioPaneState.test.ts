import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";

import {
  AUDIO_CONTROLS,
  AUDIO_SETTINGS_DEFAULTS,
  applyAudioLevel,
  formatAudioPercent,
  readAudioSettings,
} from "../audioPaneState";

describe("audioPaneState", () => {
  it("lists the persisted audio controls in §20 order", () => {
    expect(AUDIO_CONTROLS.map((control) => control.key)).toEqual([
      "master",
      "music",
      "sfx",
    ]);
  });

  it("reads existing audio settings", () => {
    const save = {
      ...defaultSave(),
      settings: {
        ...defaultSave().settings,
        audio: { master: 0.4, music: 0.6, sfx: 0.8 },
      },
    };

    expect(readAudioSettings(save)).toEqual({
      master: 0.4,
      music: 0.6,
      sfx: 0.8,
    });
  });

  it("falls back to documented defaults when a migrated save lacks audio", () => {
    const save = {
      ...defaultSave(),
      settings: {
        ...defaultSave().settings,
        audio: undefined,
      },
    };

    expect(readAudioSettings(save)).toEqual(AUDIO_SETTINGS_DEFAULTS);
  });

  it("applies a clamped audio level without mutating other buses", () => {
    const save = defaultSave();
    const result = applyAudioLevel(save, "music", 2);

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.audio).toEqual({
        master: 1,
        music: 1,
        sfx: 0.9,
      });
      expect(save.settings.audio?.music).toBe(0.8);
    }
  });

  it("returns noop when the value is unchanged", () => {
    expect(applyAudioLevel(defaultSave(), "master", 1)).toEqual({
      kind: "noop",
      reason: "same-value",
    });
  });

  it("formats clamped percentages", () => {
    expect(formatAudioPercent(0.75)).toBe("75%");
    expect(formatAudioPercent(2)).toBe("100%");
    expect(formatAudioPercent(Number.NaN)).toBe("0%");
  });
});
