/**
 * v2 -> v3 save migration.
 *
 * v3 adds the §6 Time Trial PB ghost replay slot to `SaveGame` per
 * `docs/gdd/22-data-schemas.md` and the F-021 follow-up dot. The
 * migration is purely additive: v2 saves keep every existing field and
 * gain an empty `ghosts: {}` map ready to receive the player's first
 * Time Trial PB.
 *
 * Defaults pinned here:
 * - `ghosts = {}` so loaders can fall back to `save.ghosts ?? {}` without
 *   re-checking the version field. The first ghost write happens via
 *   `bestGhostFor` in `src/game/ghost.ts`; this migration only allocates
 *   the slot.
 *
 * The migrator is strict on input shape: a payload that is not a v2 save
 * (declared version != 2) throws a TypeError. The save loader catches the
 * throw and routes the corrupt payload to the backup key per
 * `src/persistence/save.ts` `safeMigrate`.
 *
 * Idempotency: this migrator refuses to run on a non-v2 input. The
 * migration registry's chain walker only invokes it for `version === 2`;
 * running it on v1 or v3 is a programming error and surfaces as a thrown
 * TypeError.
 */

export function migrateV2ToV3(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("v2 -> v3 migration: input must be an object");
  }

  const source = input as Record<string, unknown>;
  if (source.version !== 2) {
    throw new TypeError(
      `v2 -> v3 migration: expected version 2, got ${String(source.version)}`,
    );
  }

  // Preserve any pre-existing ghosts bundle. A hand-edited v2 save (or a
  // v2 save written by a future-self tool) might already carry the slot;
  // do not clobber it. Any value that is not a plain object is replaced
  // with `{}` so the schema validator downstream sees a parseable shape.
  const existingGhosts = source.ghosts;
  const ghosts =
    existingGhosts !== null
    && typeof existingGhosts === "object"
    && !Array.isArray(existingGhosts)
      ? existingGhosts
      : {};

  return {
    ...source,
    version: 3,
    ghosts,
  };
}
