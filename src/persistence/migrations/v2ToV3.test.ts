import { describe, expect, it } from "vitest";

import { SaveGameSchema } from "@/data/schemas";

import v2Default from "./__fixtures__/v2-default-save.json" with { type: "json" };
import { migrateV2ToV3 } from "./v2ToV3";

interface V3Save {
  version: number;
  ghosts?: unknown;
  settings?: unknown;
}

describe("migrateV2ToV3", () => {
  it("migrates the v2 default fixture into a v3-shaped object", () => {
    const migrated = migrateV2ToV3(v2Default) as V3Save;
    expect(migrated.version).toBe(3);
    // v2 fields are preserved untouched.
    expect(migrated.settings).toEqual(v2Default.settings);
  });

  it("seeds an empty ghosts map on a v2 save without one", () => {
    const migrated = migrateV2ToV3(v2Default) as V3Save;
    expect(migrated.ghosts).toEqual({});
  });

  it("preserves an existing ghosts bundle if a v2 save somehow already has one", () => {
    // Forward-compat guard: if a future agent (or the dev) hand-edits a v2
    // save to include the new bundle, the migration must not clobber it.
    const customised = {
      ...v2Default,
      ghosts: {
        "velvet-coast/harbor-run": {
          formatVersion: 1,
          physicsVersion: 1,
          fixedStepMs: 16.6667,
          trackId: "velvet-coast/harbor-run",
          trackVersion: 1,
          carId: "sparrow-gt",
          seed: 0,
          totalTicks: 0,
          finalTimeMs: 0,
          truncated: false,
          deltas: [],
        },
      },
    };
    const migrated = migrateV2ToV3(customised) as V3Save;
    expect(migrated.ghosts).toEqual(customised.ghosts);
  });

  it("replaces a non-object ghosts value with an empty map", () => {
    // Defensive: a corrupt v2 save with `ghosts: "nope"` or `ghosts: []` must
    // still come out as a parseable v3 object so loadSave's downstream
    // schema validation can decide whether to fall back to default.
    for (const broken of ["nope", 42, true, null, [1, 2]]) {
      const migrated = migrateV2ToV3({
        ...v2Default,
        ghosts: broken,
      }) as V3Save;
      expect(migrated.ghosts).toEqual({});
    }
  });

  it("migrated output validates against SaveGameSchema", () => {
    const migrated = migrateV2ToV3(v2Default);
    const result = SaveGameSchema.safeParse(migrated);
    if (!result.success) {
      throw new Error(
        `migrated v3 save failed schema validation: ${result.error.message}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects a non-object input", () => {
    expect(() => migrateV2ToV3(null)).toThrow(TypeError);
    expect(() => migrateV2ToV3("nope")).toThrow(TypeError);
    expect(() => migrateV2ToV3(42)).toThrow(TypeError);
    expect(() => migrateV2ToV3([1, 2])).toThrow(TypeError);
  });

  it("rejects a payload whose declared version is not 2", () => {
    expect(() => migrateV2ToV3({ ...v2Default, version: 1 })).toThrow(
      TypeError,
    );
    expect(() => migrateV2ToV3({ ...v2Default, version: 3 })).toThrow(
      TypeError,
    );
  });
});
