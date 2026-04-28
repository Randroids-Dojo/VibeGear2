import { describe, expect, it } from "vitest";

import { SaveGameSchema } from "@/data/schemas";
import { DEFAULT_KEY_BINDINGS } from "@/game/input";

import v1Default from "./__fixtures__/v1-default-save.json" with { type: "json" };
import {
  V2_ACCESSIBILITY_DEFAULTS,
  V2_AUDIO_DEFAULTS,
  migrateV1ToV2,
} from "./v1ToV2";

interface V2Save {
  version: number;
  settings: {
    displaySpeedUnit?: unknown;
    assists?: unknown;
    difficultyPreset?: unknown;
    transmissionMode?: unknown;
    audio?: unknown;
    accessibility?: unknown;
    keyBindings?: unknown;
  };
}

describe("migrateV1ToV2", () => {
  it("migrates the v1 default fixture into a v2-shaped object", () => {
    const migrated = migrateV1ToV2(v1Default) as V2Save;

    expect(migrated.version).toBe(2);
    // v1 fields are preserved untouched.
    expect(migrated.settings.displaySpeedUnit).toBe("kph");
    expect(migrated.settings.assists).toEqual(v1Default.settings.assists);
    expect(migrated.settings.difficultyPreset).toBe("normal");
    expect(migrated.settings.transmissionMode).toBe("auto");
  });

  it("fills audio defaults to {master:1, music:0.8, sfx:0.9}", () => {
    const migrated = migrateV1ToV2(v1Default) as V2Save;
    expect(migrated.settings.audio).toEqual({
      master: 1,
      music: 0.8,
      sfx: 0.9,
    });
    // Document the canonical default constant matches the migration output
    // so the runtime defaultSave() and the migrator can never drift.
    expect(migrated.settings.audio).toEqual({ ...V2_AUDIO_DEFAULTS });
  });

  it("fills accessibility defaults documented in §20", () => {
    const migrated = migrateV1ToV2(v1Default) as V2Save;
    expect(migrated.settings.accessibility).toEqual({
      colorBlindMode: "off",
      reducedMotion: false,
      largeUiText: false,
      screenShakeScale: 1,
      weatherParticleIntensity: 1,
      reducedWeatherGlare: false,
      highContrastRoadsideSigns: false,
      fogReadabilityClamp: 0,
      weatherFlashReduction: false,
    });
    expect(migrated.settings.accessibility).toEqual({
      ...V2_ACCESSIBILITY_DEFAULTS,
    });
  });

  it("fills keyBindings from DEFAULT_KEY_BINDINGS in src/game/input.ts", () => {
    const migrated = migrateV1ToV2(v1Default) as V2Save;
    const bindings = migrated.settings.keyBindings as Record<string, string[]>;
    for (const [action, keys] of Object.entries(DEFAULT_KEY_BINDINGS)) {
      expect(bindings[action]).toEqual([...keys]);
    }
  });

  it("does not alias the runtime DEFAULT_KEY_BINDINGS (mutating output is safe)", () => {
    const migrated = migrateV1ToV2(v1Default) as V2Save;
    const bindings = migrated.settings.keyBindings as Record<string, string[]>;
    const accelerate = bindings.accelerate;
    if (!accelerate) {
      throw new Error("expected accelerate binding to be present after migration");
    }
    accelerate.push("KeyZ");
    expect(DEFAULT_KEY_BINDINGS.accelerate).not.toContain("KeyZ");
  });

  it("preserves an existing audio bundle if the v1 save somehow already has one", () => {
    // Forward-compat guard: if a future agent (or the dev) hand-edits a
    // v1 save to include the new bundle, the migration must not clobber it.
    const customised = {
      ...v1Default,
      settings: {
        ...v1Default.settings,
        audio: { master: 0.5, music: 0.5, sfx: 0.5 },
      },
    };
    const migrated = migrateV1ToV2(customised) as V2Save;
    expect(migrated.settings.audio).toEqual({
      master: 0.5,
      music: 0.5,
      sfx: 0.5,
    });
  });

  it("migrated output validates against SaveGameSchema", () => {
    const migrated = migrateV1ToV2(v1Default);
    const result = SaveGameSchema.safeParse(migrated);
    if (!result.success) {
      throw new Error(
        `migrated v2 save failed schema validation: ${result.error.message}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects a non-object input", () => {
    expect(() => migrateV1ToV2(null)).toThrow(TypeError);
    expect(() => migrateV1ToV2("nope")).toThrow(TypeError);
    expect(() => migrateV1ToV2(42)).toThrow(TypeError);
    expect(() => migrateV1ToV2([1, 2])).toThrow(TypeError);
  });

  it("rejects a payload whose declared version is not 1", () => {
    expect(() => migrateV1ToV2({ ...v1Default, version: 2 })).toThrow(
      TypeError,
    );
    expect(() => migrateV1ToV2({ ...v1Default, version: 0 })).toThrow(
      TypeError,
    );
  });

  it("treats a missing settings bundle as an empty object", () => {
    // Defensive: a corrupt v1 save without settings must still come out the
    // other side as a parseable v2 object so loadSave's downstream
    // validation can decide whether to fall back to default. The migration
    // here only fills settings; the schema check rejects the rest.
    const stripped = { version: 1, profileName: "x" };
    const migrated = migrateV1ToV2(stripped) as V2Save;
    expect(migrated.version).toBe(2);
    expect(migrated.settings.audio).toEqual({ ...V2_AUDIO_DEFAULTS });
    expect(migrated.settings.accessibility).toEqual({
      ...V2_ACCESSIBILITY_DEFAULTS,
    });
    expect(migrated.settings.keyBindings).toBeDefined();
  });

  it("seeds the cross-tab writeCounter at 0 on a v1 save without one", () => {
    // v1 saves predate the §21 cross-tab last-write-wins counter. The
    // migration must seed it to 0 so the first post-migration `saveSave`
    // ticks it to 1 deterministically.
    const migrated = migrateV1ToV2(v1Default) as V2Save & {
      writeCounter?: unknown;
    };
    expect(migrated.writeCounter).toBe(0);
  });

  it("preserves an existing non-negative integer writeCounter on the source", () => {
    // Forward-compat: a hand-edited v1 save (or a v1 save written by some
    // future tooling) might already carry a writeCounter. The migrator
    // must not clobber a valid one.
    const customised = { ...v1Default, writeCounter: 7 } as typeof v1Default & {
      writeCounter: number;
    };
    const migrated = migrateV1ToV2(customised) as V2Save & {
      writeCounter?: unknown;
    };
    expect(migrated.writeCounter).toBe(7);
  });

  it("falls back to 0 when the source writeCounter is invalid", () => {
    const cases: unknown[] = [-1, 1.5, "3", null, true];
    for (const value of cases) {
      const migrated = migrateV1ToV2({
        ...v1Default,
        writeCounter: value,
      }) as V2Save & { writeCounter?: unknown };
      expect(migrated.writeCounter).toBe(0);
    }
  });
});
