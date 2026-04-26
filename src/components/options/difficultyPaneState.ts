/**
 * Pure state helpers for the Difficulty pane (GDD §15, §20).
 *
 * Lives outside `DifficultyPane.tsx` so the §15 preset table and the
 * selection / unlock / persistence logic can be unit-tested under the
 * default node Vitest environment without RTL or jsdom. The component
 * binds to these exports; production behaviour is contracted here.
 */

import type {
  PlayerDifficultyPreset,
  SaveGame,
} from "@/data/schemas";

export interface PresetSpec {
  readonly id: PlayerDifficultyPreset;
  readonly label: string;
  readonly aiPace: string;
  readonly rubberBanding: string;
  readonly mistakes: string;
  readonly economyPressure: string;
  readonly summary: string;
}

/**
 * Verbatim from `docs/gdd/15-cpu-opponents-and-ai.md` 'Difficulty tiers'
 * table. Order matches §15: Easy, Normal, Hard, Master.
 */
export const PRESETS: ReadonlyArray<PresetSpec> = [
  {
    id: "easy",
    label: "Easy",
    aiPace: "-8%",
    rubberBanding: "Medium assist",
    mistakes: "Frequent",
    economyPressure: "Low",
    summary:
      "Lower-pace field with active catch-up assist; AI makes frequent mistakes and the credit economy is forgiving.",
  },
  {
    id: "normal",
    label: "Normal",
    aiPace: "Baseline",
    rubberBanding: "Mild",
    mistakes: "Occasional",
    economyPressure: "Moderate",
    summary:
      "The §15 baseline. Mild rubber banding keeps the midfield relevant; occasional AI mistakes; balanced economy.",
  },
  {
    id: "hard",
    label: "Hard",
    aiPace: "+5%",
    rubberBanding: "Minimal",
    mistakes: "Rare",
    economyPressure: "High",
    summary:
      "Faster AI, minimal catch-up help, rare mistakes. Higher economy pressure means tighter upgrade choices.",
  },
  {
    id: "master",
    label: "Master",
    aiPace: "+9%",
    rubberBanding: "None",
    mistakes: "Very rare",
    economyPressure: "High",
    summary:
      "Top-tier pace with no rubber banding. AI almost never makes mistakes. Unlocks after one championship at Hard.",
  },
];

/**
 * Canonical wording of the §15 unlock condition, surfaced in the locked
 * Master tile's tooltip. Lifting the string into a constant keeps the
 * wording assertable in tests and reusable in any future tour-summary
 * UI that needs the same line.
 */
export const MASTER_UNLOCK_HINT =
  "Complete one championship at Hard to unlock Master.";

/**
 * Documented mid-tour caveat from the dot edge cases. The active
 * championship's preset is captured at tour-enter time, so changing the
 * UI preset only affects future tours.
 */
export const MID_TOUR_NOTE =
  "Difficulty applies to future tours and quick-race sessions; an active championship keeps its difficulty until it ends.";

/** Treat undefined (older v1 saves) as Normal per §15 compatibility. */
export function readPreset(save: SaveGame): PlayerDifficultyPreset {
  return save.settings.difficultyPreset ?? "normal";
}

/**
 * Approximate the §15 Master unlock until championship-completion-at-
 * difficulty tracking ships. Conservative: any completed tour unlocks.
 *
 * The exact §15 condition is "complete one championship at Hard"; the
 * locked tile's tooltip surfaces that wording so the player still sees
 * the canonical statement even while the gating predicate is broader.
 */
export function isMasterUnlocked(save: SaveGame): boolean {
  return save.progress.completedTours.length >= 1;
}

/**
 * Look up a preset by id. Returns the Normal fallback if the id is not
 * recognised, so callers (notably the React detail panel) never have to
 * narrow on `undefined`.
 */
export function getPresetSpec(
  preset: PlayerDifficultyPreset,
): PresetSpec {
  return PRESETS.find((p) => p.id === preset) ?? PRESETS[1]!;
}

export type ApplyResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-preset" | "locked" };

/**
 * Pure save-mutation helper. Returns the next save with the new preset
 * applied, or a no-op tag explaining why nothing changed. The component
 * persists the returned save via `saveSave()`.
 */
export function applyPresetSelection(
  save: SaveGame,
  preset: PlayerDifficultyPreset,
): ApplyResult {
  if (preset === "master" && !isMasterUnlocked(save)) {
    return { kind: "noop", reason: "locked" };
  }
  if (readPreset(save) === preset) {
    return { kind: "noop", reason: "same-preset" };
  }
  const next: SaveGame = {
    ...save,
    settings: { ...save.settings, difficultyPreset: preset },
  };
  return { kind: "applied", save: next };
}
