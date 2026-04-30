import { describe, expect, it } from "vitest";

import { SaveGameSchema } from "@/data/schemas";
import { DEFAULT_GRAPHICS_SETTINGS } from "@/render/graphicsSettings";

import { migrateV2ToV3 } from "./v2ToV3";
import { migrateV3ToV4 } from "./v3ToV4";
import v2Default from "./__fixtures__/v2-default-save.json";

describe("migrateV3ToV4", () => {
  it("adds default graphics settings to a v3 save", () => {
    const v3 = migrateV2ToV3(v2Default);
    const migrated = migrateV3ToV4(v3);

    expect((migrated as { version: number }).version).toBe(4);
    expect(
      (migrated as { settings: { graphics: unknown } }).settings.graphics,
    ).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    const result = SaveGameSchema.safeParse(migrated);
    expect(result.success).toBe(true);
  });

  it("preserves an existing graphics bundle", () => {
    const v3 = migrateV2ToV3(v2Default) as Record<string, unknown>;
    const settings = v3.settings as Record<string, unknown>;
    const migrated = migrateV3ToV4({
      ...v3,
      settings: {
        ...settings,
        graphics: {
          mode: "manual",
          drawDistance: "low",
          spriteDensity: 0.25,
          pixelRatioCap: 1,
        },
      },
    });

    expect(
      (migrated as { settings: { graphics: unknown } }).settings.graphics,
    ).toEqual({
      mode: "manual",
      drawDistance: "low",
      spriteDensity: 0.25,
      pixelRatioCap: 1,
    });
  });

  it("rejects non-v3 input", () => {
    expect(() => migrateV3ToV4({ version: 2 })).toThrow(
      /expected version 3/u,
    );
  });
});
