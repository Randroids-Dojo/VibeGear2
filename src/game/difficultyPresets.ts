/**
 * Difficulty preset tuning scalars per
 * `docs/gdd/28-appendices-and-research-references.md` "Example tuning
 * values" and `docs/gdd/15-cpu-opponents-and-ai.md` "Difficulty tiers".
 *
 * The §28 appendix pins three named presets (Beginner, Balanced,
 * Expert) that cover four tuning scalars:
 *
 *   | Setting                  | Beginner | Balanced | Expert |
 *   | ------------------------ | -------- | -------- | ------ |
 *   | Steering assist          | 0.25     | 0.10     | 0.00   |
 *   | Nitro stability penalty  | 0.70     | 1.00     | 1.15   |
 *   | Damage severity          | 0.75     | 1.00     | 1.20   |
 *   | Off-road drag            | 1.20     | 1.00     | 0.95   |
 *
 * The §15 player-facing ladder has four tiers (Easy, Normal, Hard,
 * Master) and is the enum the save-game persists
 * (`PlayerDifficultyPresetSchema` in `src/data/schemas.ts`). Per the
 * iter-30 researcher note on the implement-28-difficulty dot, this
 * module maps:
 *
 *   - Easy  -> Beginner row.
 *   - Normal -> Balanced row.
 *   - Hard  -> Expert row.
 *   - Master -> harsher than Expert along the same trend, since §28
 *     does not pin a fourth row. Steering assist stays at 0 (Expert
 *     already at the floor); nitroStabilityPenalty extrapolates to
 *     1.25, damageSeverity to 1.35, and offRoadDragScale to 0.90. The
 *     extrapolation is documented per row below so a balancing pass
 *     can revisit it without spelunking through git history.
 *
 * Scalar semantics (all positive multipliers):
 *
 *   - `steeringAssistScale`: multiplier on the §10 steering-authority
 *     contribution at lateral handling. 0 means "no assist" (Expert /
 *     Master); 0.25 (Easy) reduces oversteer 25 percent. The physics
 *     consumer reads this as "extra grip-like clamp at the lateral
 *     velocity computation"; the exact wiring lives in physics when
 *     the consumer wires up. Until then this scalar is the binding
 *     §28 owes the runtime.
 *   - `nitroStabilityPenalty`: multiplier on the §13 nitro-while-
 *     unstable handling penalty. > 1 makes nitro punish damaged or
 *     wobbly cars more (Expert, Master); < 1 softens it (Easy).
 *   - `damageSeverity`: multiplier on the §13 contact-damage band
 *     totals. > 1 makes a hit count for more (Expert, Master); < 1
 *     softens it (Easy).
 *   - `offRoadDragScale`: multiplier on the §10
 *     `OFF_ROAD_DRAG_M_PER_S2` constant. > 1 makes off-road slowdown
 *     bite harder (Easy: keeps the player from mis-cornering into a
 *     fast off-road shortcut); < 1 lets the player rejoin faster
 *     (Expert, Master).
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals.
 * `getPreset(presetId)` returns the same frozen object reference every
 * call so callers can lean on identity comparison.
 *
 * The module is intentionally consumer-agnostic in this slice: the
 * physics, damage, and nitro slices wire the scalars in follow-up
 * slices (logged as F-NNN) so the §10 `PHYSICS_VERSION` does not have
 * to bump alongside this binding. Adding a new preset row, renaming a
 * scalar, or moving the §28 numbers requires updating both the table
 * here and the `difficultyPresets.test.ts` unit pin.
 */

import type { PlayerDifficultyPreset } from "@/data/schemas";

/**
 * Tuning scalars from the §28 "Example tuning values" table, one row
 * per `PlayerDifficultyPreset`. All four fields are required so a
 * future scalar consumer never has to defend against `undefined`.
 */
export interface AssistScalars {
  /**
   * Steering-assist authority. 0 means no assist (Expert, Master),
   * 0.25 is Beginner / Easy. Consumed by the lateral-handling slice
   * once it lands; treat as "fraction of oversteer the assist pulls
   * back toward neutral".
   */
  readonly steeringAssistScale: number;
  /**
   * Penalty multiplier on the §13 nitro-while-unstable path.
   * `1.0` is Balanced; > 1.0 punishes the player more (Expert,
   * Master), < 1.0 softens it (Easy).
   */
  readonly nitroStabilityPenalty: number;
  /**
   * Multiplier on the §13 damage band totals from a contact event.
   * `1.0` is Balanced; > 1.0 makes a hit count for more, < 1.0
   * softens it.
   */
  readonly damageSeverity: number;
  /**
   * Multiplier on `OFF_ROAD_DRAG_M_PER_S2` from §10. `1.0` is
   * Balanced; > 1.0 punishes off-road harder (Easy), < 1.0 lets the
   * player rejoin faster (Expert, Master).
   */
  readonly offRoadDragScale: number;
}

/**
 * Default preset id. Matches `defaultSave().settings.difficultyPreset`
 * in `src/persistence/save.ts` so a fresh save and the §28 binding
 * agree on Balanced as the baseline.
 */
export const DEFAULT_PRESET_ID: PlayerDifficultyPreset = "normal";

/**
 * Frozen scalar table. Walking the §15 ladder top-to-bottom:
 *
 * - `easy` (Beginner): assist on, gentle damage, drag-heavy off-road.
 * - `normal` (Balanced): identity row. All scalars at 1.0 except
 *   steeringAssist at 0.10 (the §28 Balanced default is a small
 *   helping-hand assist, not a full-off).
 * - `hard` (Expert): no assist, harsher damage and nitro, eased
 *   off-road drag.
 * - `master`: harsher than Expert along the same trend; not pinned by
 *   §28. Documented as an extrapolation here so a balancing pass can
 *   revisit it.
 */
const PRESETS: Readonly<Record<PlayerDifficultyPreset, AssistScalars>> =
  Object.freeze({
    easy: Object.freeze({
      steeringAssistScale: 0.25,
      nitroStabilityPenalty: 0.7,
      damageSeverity: 0.75,
      offRoadDragScale: 1.2,
    }),
    normal: Object.freeze({
      steeringAssistScale: 0.1,
      nitroStabilityPenalty: 1,
      damageSeverity: 1,
      offRoadDragScale: 1,
    }),
    hard: Object.freeze({
      steeringAssistScale: 0,
      nitroStabilityPenalty: 1.15,
      damageSeverity: 1.2,
      offRoadDragScale: 0.95,
    }),
    // Master extrapolation: §28 floor on steeringAssist (already 0 at
    // Expert), and the same step Hard took past Balanced applied
    // again. Hard moved nitroStabilityPenalty by +0.15 (1.00 -> 1.15);
    // Master adds another +0.10 to land at 1.25. Hard moved
    // damageSeverity by +0.20 (1.00 -> 1.20); Master adds another
    // +0.15 to land at 1.35. Hard moved offRoadDragScale by -0.05
    // (1.00 -> 0.95); Master adds another -0.05 to land at 0.90. The
    // step sizes shrink so the player feels Master as "Hard plus a
    // notch", not as a doubling of the Hard delta. Flag for
    // balancing-pass review per F-NNN.
    master: Object.freeze({
      steeringAssistScale: 0,
      nitroStabilityPenalty: 1.25,
      damageSeverity: 1.35,
      offRoadDragScale: 0.9,
    }),
  });

/**
 * Look up the §28 scalars for the given preset id. Returns the same
 * frozen object reference every call so callers can lean on identity
 * comparison without a deep-clone allocation per tick.
 *
 * The function is total over `PlayerDifficultyPreset` because the
 * type narrows to the four valid ids. Out-of-band ids (e.g. an old v1
 * save with a typo) are not reachable through the schema; if a caller
 * smuggles one in via `as PlayerDifficultyPreset`, the function
 * returns the Balanced row to fail safe.
 */
export function getPreset(
  presetId: PlayerDifficultyPreset,
): AssistScalars {
  return PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET_ID];
}

/**
 * Resolve a save's stored preset id to scalars. Treats `undefined`
 * (older v1 saves before the field landed) as the default preset, so
 * a freshly-loaded save with no `difficultyPreset` key still yields
 * the Balanced row rather than throwing on a missing field.
 */
export function resolvePresetScalars(
  presetId: PlayerDifficultyPreset | undefined,
): AssistScalars {
  if (presetId === undefined) return getPreset(DEFAULT_PRESET_ID);
  return getPreset(presetId);
}

/**
 * Stable iteration order for any UI that wants to render the four
 * presets in §15 ladder order. Frozen so callers cannot mutate it.
 */
export const PRESET_IDS: ReadonlyArray<PlayerDifficultyPreset> = Object.freeze(
  ["easy", "normal", "hard", "master"],
);
