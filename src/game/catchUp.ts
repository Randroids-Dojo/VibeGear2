/**
 * Catch-up mechanisms per `docs/gdd/12-upgrade-and-economy-system.md`
 * "Catch-up mechanisms". Four anti-grind levers that prevent the §27
 * "AI frustration" risk from compounding into player exit when an
 * unlucky race drops the wallet below upgrade-purchase budget:
 *
 *   1. Tour stipend: a one-shot grant when the wallet is below a
 *      threshold at tour entry. Pure check; the tour-flow caller is
 *      responsible for actually crediting the player and recording
 *      the claim under `save.progress.stipendsClaimed[tourId]`.
 *   2. Repair cap: essential repair cost capped at a fraction of the
 *      last race income. Cosmetic / "full" repairs always cost full
 *      price; the cap is a player-facing safety net for the minimum
 *      repair to keep racing. Disabled on hard / master / extreme
 *      difficulty (those tiers expect the player to manage the risk).
 *   3. Easy-mode tour-clear bonus: a percentage on top of the §12
 *      flat 0.15x tour bonus, granted only when the active save's
 *      `difficultyPreset === "easy"`.
 *   4. Practice-mode weather preview: surfaces the track's
 *      `weatherOptions` array as the deterministic preview list so
 *      pre-race setup choices feel fair, not hidden.
 *
 * All functions in this module are pure: they never mutate the input
 * `save` reference, never call `Date.now`, `Math.random`, or any IO.
 * The §12 narrative names the four levers but does not pin numeric
 * thresholds; those numbers are pinned here as documented placeholder
 * constants and re-exported so the balancing-pass slice can swap them
 * without rewriting the call sites. See `OPEN_QUESTIONS.md` Q-004
 * through Q-007 for the dev-confirmation thread on each constant.
 *
 * Out of scope for this slice (filed as followups):
 * - Wiring `awardCredits` to apply the stipend automatically at tour
 *   entry; the tour-flow slice owns the entry hook (F-034) and will
 *   call `computeStipend` then merge the result into the per-race
 *   credit award.
 * - Wiring `applyRepairCost` to call `cappedRepairCost`; the
 *   repair-flow slice (F-033) owns the call site and the §23
 *   tour-tier scaling that this module deliberately does not freeze.
 * - Wiring the easy-mode bonus into `tourBonus`; the tour-clear
 *   surface (`implement-tour-region-d9ca9a4d`) owns the call site.
 */

import type { SaveGame, Track, WeatherOption } from "@/data/schemas";

// Pinned placeholders -----------------------------------------------------

/**
 * Stipend triggers when the player's wallet is strictly below this
 * threshold at tour entry. §12 names the lever but not the number.
 * Pinned to a value that buys roughly two tier-1 cooling upgrades or
 * one tier-1 chassis upgrade so the player can leave the garage with
 * meaningful progress on the next tour. See OPEN_QUESTIONS.md Q-004.
 */
export const STIPEND_THRESHOLD_CREDITS = 1500;

/**
 * Stipend cash grant. Sized to match a single mid-table finish at
 * baseTrackReward 2000 / 6th place / normal difficulty so the lever
 * does not feel like a free win. See OPEN_QUESTIONS.md Q-004.
 */
export const STIPEND_AMOUNT = 1000;

/**
 * Essential-repair cap as a fraction of the previous race's cash
 * income. §12 says "low percentage"; pinned to 40% per the dot spec
 * so a minimum-repair player keeps the majority of their winnings.
 * See OPEN_QUESTIONS.md Q-005.
 */
export const REPAIR_CAP_FRACTION = 0.4;

/**
 * Easy-mode bonus rate stacked on top of the §12 0.15x tour-clear
 * bonus. Total easy-mode bonus rate is `0.15 + 0.20 = 0.35` of the
 * summed race rewards. The lever is gated on the save's
 * `settings.difficultyPreset === "easy"` so harder presets keep the
 * full §12 risk surface. See OPEN_QUESTIONS.md Q-006.
 */
export const EASY_MODE_TOUR_BONUS_FRACTION = 0.2;

// Stipend ---------------------------------------------------------------

/**
 * Subset of the future Tour shape that this module needs. Defined
 * locally rather than imported from a Tour module that does not yet
 * exist (the tour-region slice owns the full shape). The field set
 * is the minimum needed to apply the §12 first-tour gate plus the
 * one-claim-per-tour record. The tour-flow caller fills these from
 * the championship JSON.
 *
 * `index` is 1-based: the first tour in a championship is `index: 1`
 * so the literal-zero check feels natural at the call site.
 */
export interface StipendTourContext {
  /** Stable id used as the `stipendsClaimed` map key. */
  readonly id: string;
  /** 1-based index of the tour within its championship. */
  readonly index: number;
}

/**
 * Compute the stipend grant for the given save and tour. Returns
 * `STIPEND_AMOUNT` when the lever fires, `0` otherwise. Pure: does
 * not mutate the save and does not record the claim. The tour-flow
 * caller is responsible for crediting the wallet and writing the
 * claim into `save.progress.stipendsClaimed[tour.id]` so a second
 * call returns 0.
 *
 * Lever fires when:
 *   - the tour is not the first tour (index >= 2), AND
 *   - the wallet is strictly below `STIPEND_THRESHOLD_CREDITS`, AND
 *   - the player has not already claimed the stipend for this tour.
 *
 * The first-tour gate exists because the default starter cash is
 * tuned to be sufficient for tour-1 entry; granting a stipend on top
 * of it would let a player double-dip on every fresh save.
 */
export function computeStipend(
  save: SaveGame,
  tour: StipendTourContext,
): number {
  if (tour.index <= 1) return 0;
  if (save.garage.credits >= STIPEND_THRESHOLD_CREDITS) return 0;
  if (getStipendClaimed(save, tour.id)) return 0;
  return STIPEND_AMOUNT;
}

/**
 * Read the `stipendsClaimed` flag for a tour. Returns false when
 * the optional progress field is absent (v1 saves) or the tour key
 * is missing. Exposed so callers can branch on the claim state
 * without re-running the threshold logic.
 */
export function getStipendClaimed(save: SaveGame, tourId: string): boolean {
  const claimed = (save.progress as { stipendsClaimed?: Record<string, true> })
    .stipendsClaimed;
  return claimed?.[tourId] === true;
}

/**
 * Returns a fresh save with the stipend claim recorded for this
 * tour. The progress record's other fields are preserved verbatim;
 * the `stipendsClaimed` map is an additive optional field on the
 * SaveGameProgress schema (default `{}` on load).
 *
 * Idempotent: marking an already-claimed tour returns an equal
 * shape (the value remains `true`).
 */
export function recordStipendClaim(save: SaveGame, tourId: string): SaveGame {
  const claimed =
    (save.progress as { stipendsClaimed?: Record<string, true> })
      .stipendsClaimed ?? {};
  return {
    ...save,
    progress: {
      ...save.progress,
      stipendsClaimed: { ...claimed, [tourId]: true },
    },
  };
}

// Repair cap ------------------------------------------------------------

/**
 * Per-race-income essential-repair cost cap. Returns the lesser of
 * `rawCost` and `raceCashEarned * REPAIR_CAP_FRACTION` when the
 * essential / repair-cap conditions hold, otherwise returns
 * `rawCost` unchanged.
 *
 * Conditions for the cap to apply:
 *   - `repairKind === "essential"` (the §12 "minimum to keep
 *     racing" repair). "full" repairs always cost full price.
 *   - `difficulty` is one of the player-facing easy / normal tiers.
 *     Hard, master, and extreme always pay full price; those tiers
 *     expect the player to manage the cash-versus-damage tradeoff
 *     directly per §15.
 *
 * Returns a non-negative integer credit count. Negative
 * `raceCashEarned` (a future loss-leader race format) clamps to 0
 * and the cap collapses to 0, which is the correct behaviour:
 * a player who earned no cash gets a free essential repair.
 */
export type RepairKind = "essential" | "full";

export function cappedRepairCost(
  rawCost: number,
  raceCashEarned: number,
  repairKind: RepairKind,
  difficulty: string,
): number {
  const safeRaw = Math.max(0, Math.round(rawCost));
  if (repairKind !== "essential") return safeRaw;
  if (!isCapEligibleDifficulty(difficulty)) return safeRaw;
  const ceiling = Math.max(0, Math.round(raceCashEarned * REPAIR_CAP_FRACTION));
  return Math.min(safeRaw, ceiling);
}

/**
 * Difficulty keys the repair-cap respects. The set is the union of
 * the §15 player-facing ladder (easy, normal) and the championship
 * `DifficultyPreset` enum aliases (novice). Hard, master, and
 * extreme are intentionally excluded so the higher tiers keep the
 * full §12 economic risk surface.
 */
function isCapEligibleDifficulty(difficulty: string): boolean {
  return difficulty === "easy" || difficulty === "normal" || difficulty === "novice";
}

// Easy-mode bonus -------------------------------------------------------

/**
 * Easy-mode tour-clear bonus. Returns the rounded
 * `EASY_MODE_TOUR_BONUS_FRACTION * sumRewards` when the save's
 * difficulty preset is `"easy"`; returns 0 otherwise.
 *
 * Stacked with `tourBonus` (15% of summed rewards) at the call
 * site: the canonical easy-mode tour clear pays
 * `tourBonus(rewards) + easyModeBonus(save, rewards)` per §12. The
 * lever is gated on the player-facing preset (not the championship
 * preset) so a player who flipped Easy on the difficulty pane gets
 * the bonus regardless of which championship they entered.
 *
 * Negative entries in `tourComplete` are ignored rather than
 * clawing back the bonus (mirrors `tourBonus`'s policy).
 */
export function easyModeBonus(
  save: SaveGame,
  tourComplete: ReadonlyArray<number>,
): number {
  if (save.settings.difficultyPreset !== "easy") return 0;
  if (tourComplete.length === 0) return 0;
  const total = tourComplete.reduce((acc, n) => acc + Math.max(0, n), 0);
  return Math.round(total * EASY_MODE_TOUR_BONUS_FRACTION);
}

// Practice weather preview ---------------------------------------------

/**
 * Practice / pre-race weather preview. Returns the track's
 * `weatherOptions` array unchanged so the player can see every
 * weather the race might roll and pre-pick tires accordingly per
 * §6 "Practice mode" and §12 catch-up mechanism #4.
 *
 * Returned as `readonly` so callers cannot mutate the underlying
 * track JSON by accident. Pure: no random pick, no time-of-day
 * lookup; the preview is the full deterministic option set.
 */
export function practiceWeatherPreview(track: Track): ReadonlyArray<WeatherOption> {
  return track.weatherOptions;
}
