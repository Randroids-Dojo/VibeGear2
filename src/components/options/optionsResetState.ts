/**
 * Pure reset helper for the /options footer. It resets only settings owned
 * by shipped panes so placeholder tabs do not silently clobber fields they
 * have not exposed yet.
 */

import type { SaveGame } from "@/data/schemas";

export type OptionsResetResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "already-default" };

export function resetShippedOptionsToDefaults(
  save: SaveGame,
  defaults: SaveGame,
): OptionsResetResult {
  const next: SaveGame = {
    ...save,
    settings: {
      ...save.settings,
      assists: { ...defaults.settings.assists },
      difficultyPreset: defaults.settings.difficultyPreset,
    },
  };

  if (
    JSON.stringify(next.settings.assists) ===
      JSON.stringify(save.settings.assists) &&
    next.settings.difficultyPreset === save.settings.difficultyPreset
  ) {
    return { kind: "noop", reason: "already-default" };
  }

  return { kind: "applied", save: next };
}
