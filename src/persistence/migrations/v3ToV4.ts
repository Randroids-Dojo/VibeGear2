import { DEFAULT_GRAPHICS_SETTINGS } from "@/render/graphicsSettings";

/**
 * v3 -> v4 save migration.
 *
 * v4 adds §27 graphics settings for draw distance, sprite density, and
 * pixel-ratio caps. The migration is additive and preserves any existing
 * hand-authored graphics object when present.
 */
export function migrateV3ToV4(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("v3 -> v4 migration: input must be an object");
  }

  const source = input as Record<string, unknown>;
  if (source.version !== 3) {
    throw new TypeError(
      `v3 -> v4 migration: expected version 3, got ${String(source.version)}`,
    );
  }

  const settings =
    source.settings !== null
    && typeof source.settings === "object"
    && !Array.isArray(source.settings)
      ? source.settings as Record<string, unknown>
      : {};

  return {
    ...source,
    version: 4,
    settings: {
      ...settings,
      graphics:
        settings.graphics !== null
        && typeof settings.graphics === "object"
        && !Array.isArray(settings.graphics)
          ? settings.graphics
          : { ...DEFAULT_GRAPHICS_SETTINGS },
    },
  };
}
