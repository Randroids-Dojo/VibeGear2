/**
 * Save-game migration registry.
 *
 * `migrate(raw)` upgrades a stored save to the current schema major. The
 * registry is keyed by the source version and returns the input shaped for
 * the next version up; `migrate` walks the chain to `CURRENT_SAVE_VERSION`.
 *
 * v1 was the initial schema. v2 expanded `SaveGameSettings` with audio,
 * accessibility, and key-bindings bundles per
 * `docs/gdd/22-data-schemas.md` and the
 * `implement-savegamesettings-b948015a` dot.
 *
 * docs/WORKING_AGREEMENT.md §11 requires dev confirmation before dropping
 * or renaming persisted save fields. New migrations must be additive or
 * re-mapped, never destructive without a logged decision.
 */

import { migrateV1ToV2 } from "./v1ToV2";

export const CURRENT_SAVE_VERSION = 2 as const;

export type Migration = (input: unknown) => unknown;

export const migrations: Record<number, Migration> = {
  // Each entry maps from-version to a function that returns the from+1 shape.
  1: migrateV1ToV2,
};

/**
 * Run the migration chain from the input's declared version up to the
 * current version. Throws on:
 * - non-object input,
 * - missing or non-numeric `version`,
 * - a future-major save (input version > current; refuse to downgrade),
 * - a missing migration step (gap in the chain).
 */
export function migrate(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("save payload must be an object");
  }

  const versionField = (input as { version?: unknown }).version;
  if (typeof versionField !== "number" || !Number.isInteger(versionField) || versionField < 1) {
    throw new TypeError(`save payload has invalid version: ${String(versionField)}`);
  }

  if (versionField > CURRENT_SAVE_VERSION) {
    throw new RangeError(
      `save was written by a newer version (v${versionField} > current v${CURRENT_SAVE_VERSION}); refusing to downgrade`,
    );
  }

  let current: unknown = input;
  for (let v = versionField; v < CURRENT_SAVE_VERSION; v += 1) {
    const step = migrations[v];
    if (!step) {
      throw new Error(`no migration registered from v${v} to v${v + 1}`);
    }
    current = step(current);
  }

  return current;
}
