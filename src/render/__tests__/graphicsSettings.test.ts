import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRAPHICS_SETTINGS,
  clampDevicePixelRatio,
  detectAutoTier,
  resolveGraphicsSettings,
} from "../graphicsSettings";

describe("graphicsSettings", () => {
  it("detects low tier for very small CPU budgets or high-DPI screens", () => {
    expect(detectAutoTier({ hardwareConcurrency: 2, devicePixelRatio: 1 })).toBe("low");
    expect(detectAutoTier({ hardwareConcurrency: 8, devicePixelRatio: 3 })).toBe("low");
  });

  it("detects medium, high, and ultra tiers from deterministic hints", () => {
    expect(detectAutoTier({ hardwareConcurrency: 4, devicePixelRatio: 1 })).toBe("medium");
    expect(detectAutoTier({ hardwareConcurrency: 8, devicePixelRatio: 1 })).toBe("high");
    expect(detectAutoTier({ hardwareConcurrency: 12, devicePixelRatio: 1 })).toBe("ultra");
  });

  it("honours manual overrides", () => {
    const resolved = resolveGraphicsSettings({
      mode: "manual",
      drawDistance: "low",
      spriteDensity: 0.25,
      pixelRatioCap: 1,
    });

    expect(resolved).toEqual({
      mode: "manual",
      drawDistanceSegments: 90,
      spriteDensityFactor: 0.25,
      pixelRatioCap: 1,
    });
  });

  it("uses defaults when settings are missing", () => {
    expect(resolveGraphicsSettings(undefined).mode).toBe(DEFAULT_GRAPHICS_SETTINGS.mode);
  });

  it("clamps backing-store DPR to the selected cap", () => {
    expect(clampDevicePixelRatio(3, 1.5)).toBe(1.5);
    expect(clampDevicePixelRatio(0.5, 2)).toBe(1);
  });
});
