import { describe, expect, it } from "vitest";

import v1Fixture from "@/persistence/migrations/__fixtures__/v1-default-save.json" with { type: "json" };
import {
  CURRENT_SAVE_VERSION,
  EXPORT_MIME_TYPE,
  IMPORT_MAX_BYTES,
  defaultSave,
  exportFilename,
  exportProfile,
  importProfile,
} from "@/persistence";
import type { SaveGame } from "@/data/schemas";

/**
 * Pure-function tests for the profile export / import contract (GDD §20
 * Save and load: 'Manual profile export / import' and 'Versioned save
 * migrations'). The component shell in `ProfileSection.tsx` and the
 * full file-dialog round-trip are exercised in the matching Playwright
 * spec.
 */

describe("exportFilename", () => {
  it("formats the timestamp as compact ISO and prefixes the product slug", () => {
    const fixed = new Date("2026-04-26T13:45:07.123Z");
    expect(exportFilename(fixed)).toBe("vibegear2-profile-20260426T134507Z.json");
  });

  it("uses a stable lexically-sortable slug", () => {
    const a = exportFilename(new Date("2026-01-01T00:00:00Z"));
    const b = exportFilename(new Date("2026-12-31T23:59:59Z"));
    expect(a < b).toBe(true);
  });
});

describe("exportProfile", () => {
  it("returns a JSON Blob with the documented MIME type", () => {
    const result = exportProfile(defaultSave());
    expect(result.blob.type).toBe(EXPORT_MIME_TYPE);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("emits a filename matching the vibegear2-profile pattern", () => {
    const result = exportProfile(defaultSave(), {
      now: new Date("2026-04-26T08:30:00Z"),
    });
    expect(result.filename).toBe("vibegear2-profile-20260426T083000Z.json");
  });

  it("throws on a save that fails schema validation", () => {
    const broken = {
      ...defaultSave(),
      profileName: "",
    } as SaveGame;
    expect(() => exportProfile(broken)).toThrow(TypeError);
  });
});

describe("importProfile", () => {
  it("round-trips a default save unchanged", async () => {
    const save = defaultSave();
    const exported = exportProfile(save);
    const text = await exported.blob.text();
    const result = importProfile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save).toEqual(save);
    }
  });

  it("rejects malformed JSON with a parse error", () => {
    const result = importProfile("{not-json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });

  it("rejects an empty string with a parse error", () => {
    const result = importProfile("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });

  it("rejects a non-object payload (array)", () => {
    const result = importProfile("[1, 2, 3]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });

  it("rejects a non-object payload (number)", () => {
    const result = importProfile("42");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });

  it("rejects a future-version save with kind=future_version", () => {
    const future = { ...defaultSave(), version: CURRENT_SAVE_VERSION + 1 };
    const text = JSON.stringify(future);
    const result = importProfile(text);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "future_version") {
      expect(result.error.saveVersion).toBe(CURRENT_SAVE_VERSION + 1);
      expect(result.error.runtimeVersion).toBe(CURRENT_SAVE_VERSION);
    } else {
      throw new Error("expected future_version error");
    }
  });

  it("rejects a schema-invalid payload with kind=schema and the offending path", () => {
    const broken = { ...defaultSave(), profileName: "" };
    const result = importProfile(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "schema") {
      expect(result.error.path).toBe("profileName");
      expect(result.error.message.length).toBeGreaterThan(0);
    } else {
      throw new Error("expected schema error");
    }
  });

  it("rejects a payload over the 1MB cap with kind=too_large", () => {
    // Build a payload that is structurally a valid JSON object but
    // padded with a long string field so the byte length exceeds the
    // cap. The bytes check runs before parse so the inner shape is
    // irrelevant.
    const padding = "x".repeat(IMPORT_MAX_BYTES + 100);
    const payload = JSON.stringify({ version: 2, padding });
    const result = importProfile(payload);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "too_large") {
      expect(result.error.bytes).toBeGreaterThan(IMPORT_MAX_BYTES);
      expect(result.error.limit).toBe(IMPORT_MAX_BYTES);
    } else {
      throw new Error("expected too_large error");
    }
  });

  it("accepts a v1 fixture and migrates it to the current version", () => {
    const text = JSON.stringify(v1Fixture);
    const result = importProfile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
      // v1 -> v2 migration fills the new audio bundle with documented
      // defaults; pin one field to confirm the chain ran.
      expect(result.save.settings.audio?.master).toBe(1);
    }
  });

  it("preserves every garage field across a round-trip", async () => {
    const save = defaultSave();
    const customised: SaveGame = {
      ...save,
      garage: {
        credits: 42_000,
        ownedCars: ["sparrow-gt"],
        activeCarId: "sparrow-gt",
        installedUpgrades: {
          "sparrow-gt": {
            engine: 3,
            gearbox: 2,
            dryTires: 4,
            wetTires: 1,
            nitro: 2,
            armor: 0,
            cooling: 0,
            aero: 1,
          },
        },
      },
    };
    const exported = exportProfile(customised);
    const text = await exported.blob.text();
    const result = importProfile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.garage).toEqual(customised.garage);
    }
  });

  it("never includes an em-dash in any error message (project rule)", () => {
    // Exercise each error path and assert the message stays clean.
    const cases: ReadonlyArray<string> = [
      "{not-json",
      "[1,2,3]",
      JSON.stringify({ version: 99, profileName: "" }),
      JSON.stringify({ ...defaultSave(), profileName: "" }),
    ];
    for (const text of cases) {
      const result = importProfile(text);
      if (!result.ok) {
        const error = result.error;
        const message =
          "message" in error
            ? error.message
            : "path" in error
              ? error.path
              : String(error.kind);
        expect(message).not.toMatch(/[–—]/u);
      }
    }
  });
});
