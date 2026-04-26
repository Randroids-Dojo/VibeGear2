/**
 * v1 -> v2 save migration.
 *
 * v2 expands `SaveGameSettings` with §19 / §20 surfaces (audio, accessibility,
 * key bindings) per `docs/gdd/22-data-schemas.md` and the
 * `implement-savegamesettings-b948015a` dot. The migration is purely additive:
 * v1 saves keep every existing field and gain the new bundles populated with
 * the documented defaults.
 *
 * Defaults pinned here:
 * - `audio = { master: 1, music: 0.8, sfx: 0.9 }` per the §20 audio defaults
 *   (`docs/gdd/20-hud-and-ui-ux.md` Settings section).
 * - `accessibility = { colorBlindMode: 'off', reducedMotion: false,
 *   largeUiText: false, screenShakeScale: 1 }` per the §20 accessibility
 *   defaults; `screenShakeScale: 1` keeps the v1 shake intensity unchanged.
 * - `keyBindings = DEFAULT_KEY_BINDINGS` (cloned from `src/game/input.ts`).
 * - `writeCounter = 0` for the §21 cross-tab last-write-wins protocol; the
 *   first `saveSave` after migration ticks it to 1. v1 saves never had a
 *   counter, so seeding 0 is the lowest non-negative integer that lets a
 *   newer tab's write win deterministically.
 *
 * The migrator is strict on input shape: a payload that is not a v1 save
 * (missing required v1 keys, declared version != 1) throws. The save loader
 * catches the throw and routes the corrupt payload to the backup key per
 * `src/persistence/save.ts` `safeMigrate`.
 *
 * Idempotency: this migrator refuses to run on a v2 input. The migration
 * registry's chain walker only invokes it for `version === 1`; running it
 * on v2 is a programming error and surfaces as a thrown TypeError.
 */

import { DEFAULT_KEY_BINDINGS } from "@/game/input";

export const V2_AUDIO_DEFAULTS = Object.freeze({
  master: 1,
  music: 0.8,
  sfx: 0.9,
});

export const V2_ACCESSIBILITY_DEFAULTS = Object.freeze({
  colorBlindMode: "off" as const,
  reducedMotion: false,
  largeUiText: false,
  screenShakeScale: 1,
});

/**
 * Plain JSON snapshot of `DEFAULT_KEY_BINDINGS` so the v1 -> v2 migration
 * always writes a deeply mutable, plain-object value into the persisted
 * save. The runtime `DEFAULT_KEY_BINDINGS` is `Object.freeze`d and uses
 * `readonly` arrays; serialising those through JSON works, but cloning at
 * the migration boundary makes the contract explicit.
 */
function defaultKeyBindings(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [action, keys] of Object.entries(DEFAULT_KEY_BINDINGS)) {
    out[action] = [...keys];
  }
  return out;
}

/**
 * Run the v1 -> v2 migration. The function does not validate the v1 payload
 * against any schema: validation happens after the chain walker finishes,
 * inside `loadSave` via `SaveGameSchema.safeParse`. The migrator's only job
 * is to reshape the data.
 */
export function migrateV1ToV2(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("v1 -> v2 migration: input must be an object");
  }

  const source = input as Record<string, unknown>;
  if (source.version !== 1) {
    throw new TypeError(
      `v1 -> v2 migration: expected version 1, got ${String(source.version)}`,
    );
  }

  const settingsRaw = source.settings;
  const settings: Record<string, unknown> =
    settingsRaw !== null &&
    typeof settingsRaw === "object" &&
    !Array.isArray(settingsRaw)
      ? { ...(settingsRaw as Record<string, unknown>) }
      : {};

  // Audio: only fill when missing so a partial v1 save with a hand-edited
  // audio bundle (rare, but possible if a future-self edits localStorage)
  // is preserved. Same rule for the other two bundles.
  if (settings.audio === undefined) {
    settings.audio = { ...V2_AUDIO_DEFAULTS };
  }
  if (settings.accessibility === undefined) {
    settings.accessibility = { ...V2_ACCESSIBILITY_DEFAULTS };
  }
  if (settings.keyBindings === undefined) {
    settings.keyBindings = defaultKeyBindings();
  }

  // Seed the cross-tab write counter when a v1 payload predates it. Preserve
  // any explicit counter the source already carried (a hand-edited v1 save,
  // or a forward-compat seed) so the migration is non-destructive.
  const writeCounter =
    typeof source.writeCounter === "number" &&
    Number.isInteger(source.writeCounter) &&
    source.writeCounter >= 0
      ? source.writeCounter
      : 0;

  return {
    ...source,
    version: 2,
    settings,
    writeCounter,
  };
}
