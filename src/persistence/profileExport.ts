/**
 * Profile export and import (GDD §20 'Save and load: Manual profile export
 * / import' and 'Versioned save migrations').
 *
 * Pure functions only. The caller owns the file dialog, the
 * `URL.createObjectURL` lifecycle, and any user-confirmation prompts.
 * The component shell in `src/components/options/ProfileSection.tsx`
 * wires those side effects to the buttons.
 *
 * Round-trip contract: a save serialised with `exportProfile` and parsed
 * back through `importProfile` must deep-equal the original. The
 * serialiser strips `undefined`s by virtue of `JSON.stringify`, so
 * callers that hand in optional fields with the value `undefined` will
 * see those keys disappear. The schema marks every such field optional,
 * so the round-trip stays lossless.
 *
 * Versioning: an exported save carries the runtime
 * `CURRENT_SAVE_VERSION` it was produced under. On import we run the
 * existing migration chain so a v1 export still loads cleanly into a v2
 * runtime. A future-version export (file written by a newer build of
 * the game) is rejected; we deliberately do not attempt to downgrade.
 *
 * Failure model: every failure surfaces as a tagged `ImportError` so
 * the UI can render a precise message. Schema-invalid input names the
 * Zod path that broke; parse errors surface a short message; the
 * future-version case carries both the file's version and the runtime
 * version so the player can read the gap.
 */

import { SaveGameSchema, type SaveGame } from "@/data/schemas";

import { CURRENT_SAVE_VERSION, migrate } from "./migrations";

/**
 * Cap on import payload size. Saves should never approach this; the
 * cap protects against pathological copy-paste of large unrelated
 * blobs into the import field. 1 MB is generous (a v2 default save
 * serialises to under 1 KB, a saturated save with hundreds of records
 * still fits well under 100 KB).
 */
export const IMPORT_MAX_BYTES = 1_000_000;

/**
 * Exported file MIME type. Browsers honour this on the download
 * `<a>` element so the file dialog suggests `.json`.
 */
export const EXPORT_MIME_TYPE = "application/json";

export interface ExportProfileResult {
  readonly blob: Blob;
  readonly filename: string;
}

export type ImportError =
  | { kind: "parse"; message: string }
  | { kind: "schema"; path: string; message: string }
  | { kind: "future_version"; saveVersion: number; runtimeVersion: number }
  | { kind: "migration"; message: string }
  | { kind: "too_large"; bytes: number; limit: number };

export type ImportResult =
  | { ok: true; save: SaveGame }
  | { ok: false; error: ImportError };

/**
 * Build the ISO-8601 timestamp slug used in the export filename. Pure
 * helper so the unit test can pin a fake clock and assert the exact
 * filename.
 */
export function exportFilename(now: Date = new Date()): string {
  // YYYYMMDDTHHMMSSZ. Compact, filename-safe, and sorts lexically.
  const iso = now.toISOString();
  const slug = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `vibegear2-profile-${slug}.json`;
}

/**
 * Serialise a SaveGame to a JSON Blob plus the suggested filename.
 * Throws TypeError on a save that fails schema validation; the caller
 * should never hand in an unstructured value, but the guard keeps a
 * stray bug from poisoning a download.
 */
export function exportProfile(
  save: SaveGame,
  options: { now?: Date } = {},
): ExportProfileResult {
  const validated = SaveGameSchema.safeParse(save);
  if (!validated.success) {
    throw new TypeError(
      `exportProfile: save failed schema validation (${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")})`,
    );
  }
  const json = JSON.stringify(validated.data, null, 2);
  const blob = new Blob([json], { type: EXPORT_MIME_TYPE });
  const filename = exportFilename(options.now ?? new Date());
  return { blob, filename };
}

/**
 * Parse an import payload (raw text from a user-uploaded file) and
 * return the validated, migrated SaveGame, or a tagged error. No I/O.
 *
 * Order of checks: byte cap, JSON parse, version probe, migration
 * chain, schema validation. We probe the version *before* migrating so
 * a future-version file gets a precise error rather than a generic
 * migration failure.
 */
export function importProfile(text: string): ImportResult {
  // Use the UTF-8 byte length, not the JS string length, so a file of
  // multi-byte glyphs is sized accurately. TextEncoder is available
  // in modern browsers and Node 18+.
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > IMPORT_MAX_BYTES) {
    return {
      ok: false,
      error: { kind: "too_large", bytes, limit: IMPORT_MAX_BYTES },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "parse",
        message: error instanceof Error ? error.message : "JSON parse failed",
      },
    };
  }

  // Probe the declared version before migration so a future-version
  // file gets the dedicated error instead of a generic migration
  // failure. The migrate() helper also checks this, but it throws a
  // RangeError; converting that to our tagged error needs the version
  // number too, which is easier to read off the parsed value here.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      error: {
        kind: "parse",
        message: "save payload must be a JSON object",
      },
    };
  }
  const versionField = (parsed as { version?: unknown }).version;
  if (
    typeof versionField === "number" &&
    Number.isInteger(versionField) &&
    versionField > CURRENT_SAVE_VERSION
  ) {
    return {
      ok: false,
      error: {
        kind: "future_version",
        saveVersion: versionField,
        runtimeVersion: CURRENT_SAVE_VERSION,
      },
    };
  }

  let migrated: unknown;
  try {
    migrated = migrate(parsed);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "migration",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const validated = SaveGameSchema.safeParse(migrated);
  if (!validated.success) {
    const first = validated.error.issues[0];
    return {
      ok: false,
      error: {
        kind: "schema",
        path: first ? first.path.join(".") : "",
        message: first ? first.message : "schema validation failed",
      },
    };
  }

  return { ok: true, save: validated.data };
}
