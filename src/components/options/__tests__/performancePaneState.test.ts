import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";
import { DEFAULT_GRAPHICS_SETTINGS } from "@/render/graphicsSettings";

import {
  applyGraphicsSettings,
  readGraphicsSettings,
  resetGraphicsSettings,
} from "../performancePaneState";

describe("performancePaneState", () => {
  it("reads default graphics settings from a fresh save", () => {
    expect(readGraphicsSettings(defaultSave())).toEqual(DEFAULT_GRAPHICS_SETTINGS);
  });

  it("applies manual graphics settings without mutating the input", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);

    const result = applyGraphicsSettings(save, {
      mode: "manual",
      drawDistance: "medium",
      spriteDensity: 0.5,
      pixelRatioCap: 1,
    });

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.graphics).toEqual({
        mode: "manual",
        drawDistance: "medium",
        spriteDensity: 0.5,
        pixelRatioCap: 1,
      });
    }
    expect(JSON.stringify(save)).toBe(before);
  });

  it("returns noop for same settings", () => {
    expect(applyGraphicsSettings(defaultSave(), DEFAULT_GRAPHICS_SETTINGS)).toEqual({
      kind: "noop",
      reason: "same-value",
    });
  });

  it("resets graphics settings to defaults", () => {
    const changed = applyGraphicsSettings(defaultSave(), {
      mode: "manual",
      drawDistance: "low",
    });
    expect(changed.kind).toBe("applied");
    if (changed.kind !== "applied") return;

    expect(resetGraphicsSettings(changed.save).settings.graphics).toEqual(
      DEFAULT_GRAPHICS_SETTINGS,
    );
  });
});
