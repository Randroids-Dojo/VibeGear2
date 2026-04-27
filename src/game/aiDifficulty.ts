/**
 * §23 "CPU difficulty modifiers" lookup per
 * `docs/gdd/23-balancing-tables.md`. Pins a frozen per-tier table of
 * `paceScalar / recoveryScalar / mistakeScalar` keyed by the §15
 * four-tier `PlayerDifficultyPreset` ladder (Easy / Normal / Hard /
 * Master).
 *
 * This module is the authoritative consumer of the §23 row that the
 * balancing-pass slice pinned in `src/data/__tests__/balancing.test.ts`.
 * Once it lands, the balancing test imports `CPU_DIFFICULTY_MODIFIERS`
 * and asserts each cell so a §23 retune has exactly one place to edit.
 *
 * Scalar semantics (positive multipliers, multiplicatively composed
 * with per-driver `AIDriver.paceScalar` from `src/data/ai/*.json`):
 *
 *   - `paceScalar`: tier-level multiplier on the AI's target speed.
 *     Stacks on top of the per-driver scalar so a clean_line driver
 *     with `paceScalar = 1.02` running at Hard sees an effective
 *     `1.02 * 1.05 = 1.071` target speed, while at Easy the same
 *     driver runs at `1.02 * 0.92 = 0.9384`. The per-driver scalar
 *     captures archetype identity (rocket > clean_line > cautious);
 *     the tier scalar captures player-facing difficulty.
 *
 *   - `recoveryScalar`: tier-level multiplier on the light AI catch-up
 *     rate. > 1 makes the AI close gaps faster (Hard, Master); < 1
 *     lets the player extend a lead (Easy). The shared consumer lives
 *     in `tickAI`; full rubber-banding policy is still a deferred §15
 *     slice.
 *
 *   - `mistakeScalar`: tier-level multiplier on per-driver
 *     `AIDriver.mistakeRate`. > 1 makes the AI fumble more (Easy:
 *     a `mistakeRate = 0.08` driver effectively runs at
 *     `0.08 * 1.4 = 0.112`); < 1 cleans them up (Master: same
 *     driver at `0.08 * 0.45 = 0.036`). The shared deterministic
 *     lane-target mistake hook lives in `tickAI`; archetype-specific
 *     mistake shapes remain a deferred §15 slice.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals.
 * `getCpuModifiers(presetId)` returns the same frozen object reference
 * every call so callers can lean on identity comparison.
 *
 * The AI controller consumes all three scalars. Adding a new tier row,
 * renaming a scalar, or moving the §23 numbers requires updating both
 * the table here and the `aiDifficulty.test.ts` unit pin (and the §23
 * cross-check in `src/data/__tests__/balancing.test.ts`).
 *
 * Distinct from `src/game/difficultyPresets.ts`. That module owns the
 * §28 "Example tuning values" table (player-side assist scalars: steer
 * assist, nitro stability penalty, damage severity, off-road drag).
 * This module owns the §23 "CPU difficulty modifiers" row (AI-side
 * scalars: pace, recovery, mistake). Both keys map onto the same
 * `PlayerDifficultyPreset` enum so the save's single difficulty pick
 * resolves both sides of the tier.
 */

import type { PlayerDifficultyPreset } from "@/data/schemas";

/**
 * Tier-level CPU modifiers from §23 "CPU difficulty modifiers", one
 * row per `PlayerDifficultyPreset`. All three fields are required so
 * a future scalar consumer never has to defend against `undefined`.
 */
export interface CpuDifficultyModifiers {
  /**
   * Multiplier on the AI's target speed, stacked on top of the
   * per-driver `AIDriver.paceScalar`. `1.0` is Normal; > 1.0 raises
   * the bar (Hard, Master); < 1.0 lowers it (Easy).
   */
  readonly paceScalar: number;
  /**
   * Multiplier on rubber-banding catch-up rate. `1.0` is Normal;
   * > 1.0 makes the AI close gaps faster (Hard, Master); < 1.0
   * lets the player extend a lead (Easy).
   */
  readonly recoveryScalar: number;
  /**
   * Multiplier on per-driver `AIDriver.mistakeRate`. `1.0` is
   * Normal; > 1.0 makes the AI fumble more (Easy); < 1.0 cleans
   * them up (Hard, Master).
   */
  readonly mistakeScalar: number;
}

/**
 * Default tier id. Matches `DEFAULT_PRESET_ID` from
 * `src/game/difficultyPresets.ts` and `defaultSave().settings
 * .difficultyPreset` in `src/persistence/save.ts` so a fresh save
 * and the §23 binding agree on Normal as the baseline.
 */
export const DEFAULT_CPU_TIER_ID: PlayerDifficultyPreset = "normal";

/**
 * Frozen scalar table, copied verbatim from §23 "CPU difficulty
 * modifiers" in `docs/gdd/23-balancing-tables.md`:
 *
 *     | Difficulty | Pace scalar | Recovery scalar | Mistake scalar |
 *     | ---------- | ----------- | --------------- | -------------- |
 *     | Easy       | 0.92        | 0.95            | 1.40           |
 *     | Normal     | 1.00        | 1.00            | 1.00           |
 *     | Hard       | 1.05        | 1.03            | 0.70           |
 *     | Master     | 1.09        | 1.05            | 0.45           |
 *
 * Walking the §15 ladder top-to-bottom: pace and recovery scale
 * monotonically up, mistake scales monotonically down. Normal sits
 * at identity for every column so a per-driver scalar at Normal is
 * the unmultiplied authored value.
 */
export const CPU_DIFFICULTY_MODIFIERS: Readonly<
  Record<PlayerDifficultyPreset, CpuDifficultyModifiers>
> = Object.freeze({
  easy: Object.freeze({
    paceScalar: 0.92,
    recoveryScalar: 0.95,
    mistakeScalar: 1.4,
  }),
  normal: Object.freeze({
    paceScalar: 1,
    recoveryScalar: 1,
    mistakeScalar: 1,
  }),
  hard: Object.freeze({
    paceScalar: 1.05,
    recoveryScalar: 1.03,
    mistakeScalar: 0.7,
  }),
  master: Object.freeze({
    paceScalar: 1.09,
    recoveryScalar: 1.05,
    mistakeScalar: 0.45,
  }),
});

/**
 * Look up the §23 modifiers for the given tier id. Returns the same
 * frozen object reference every call so callers can lean on identity
 * comparison without a deep-clone allocation per tick.
 *
 * The function is total over `PlayerDifficultyPreset` because the
 * type narrows to the four valid ids. Out-of-band ids (e.g. an old
 * v1 save with a typo) are not reachable through the schema; if a
 * caller smuggles one in via `as PlayerDifficultyPreset`, the
 * function returns the Normal row to fail safe.
 */
export function getCpuModifiers(
  tierId: PlayerDifficultyPreset,
): CpuDifficultyModifiers {
  return (
    CPU_DIFFICULTY_MODIFIERS[tierId] ??
    CPU_DIFFICULTY_MODIFIERS[DEFAULT_CPU_TIER_ID]
  );
}

/**
 * Resolve a save's stored tier id to CPU modifiers. Treats
 * `undefined` (older v1 saves before the field landed) as the
 * default tier, so a freshly-loaded save with no `difficultyPreset`
 * key still yields the Normal row rather than throwing on a missing
 * field. Mirrors `resolvePresetScalars` in `src/game/difficultyPresets.ts`.
 */
export function resolveCpuModifiers(
  tierId: PlayerDifficultyPreset | undefined,
): CpuDifficultyModifiers {
  if (tierId === undefined) return getCpuModifiers(DEFAULT_CPU_TIER_ID);
  return getCpuModifiers(tierId);
}

/**
 * Stable iteration order for any UI that wants to render the four
 * tiers in §15 ladder order. Frozen so callers cannot mutate it.
 * Matches `PRESET_IDS` from `src/game/difficultyPresets.ts`.
 */
export const CPU_TIER_IDS: ReadonlyArray<PlayerDifficultyPreset> = Object.freeze([
  "easy",
  "normal",
  "hard",
  "master",
]);
