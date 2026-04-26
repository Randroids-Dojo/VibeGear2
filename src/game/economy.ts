/**
 * Economy primitives. Pure functions on `SaveGame` per
 * `docs/gdd/12-upgrade-and-economy-system.md`.
 *
 * Surface:
 * - `awardCredits(save, raceResult, opts)`: credit the player for a
 *   finishing position using the §12 finish-multiplier table.
 * - `getUpgradePrice(upgradeId)`: catalogue lookup, throws on unknown id.
 * - `purchaseUpgrade(save, upgradeId, carId)`: deduct credits and grant
 *   the upgrade as "owned" against the active save's installed-upgrade
 *   counter for that car. Tier rules apply: sequential install (§12), at
 *   most `car.upgradeCaps[category]` per category.
 * - `installUpgrade(save, upgradeId, carId)`: explicit install step.
 *   Currently a no-op alias for purchase since the MVP folds purchase
 *   and install together; reserved for the future labor-fee mechanic
 *   (iter-19 stress-test §5 split).
 * - `purchaseAndInstall(save, upgradeId, carId)`: convenience wrapper
 *   calling purchase then install in sequence; the canonical garage call.
 *
 * All functions are pure: they never mutate the input `save` reference,
 * never call `Date.now`, `Math.random`, or any IO. Every returns an
 * `EconomyResult` discriminated union so callers branch on the failure
 * code without re-deriving validity from the next state.
 *
 * Out of scope for this slice (filed as followups):
 * - `applyRepairCost`: §12 names a `tourTierScale` factor that has no
 *   §23 column yet. Deferred until the balancing pass lands the table.
 * - `tourBonus`: the 0.15x tour clear bonus is computed by the
 *   tour/region slice (`implement-tour-region-d9ca9a4d`) which owns the
 *   tour-clear lifecycle; this module supplies the per-race award only.
 * - The `EconomyReceipt` ledger surface from the iter-19 stress-test.
 *   The §20 results-screen breakdown will land alongside the results
 *   slice; the receipt would currently have no consumer.
 */

import {
  UpgradeCategorySchema,
  type SaveGame,
  type Upgrade,
  type UpgradeCategory,
} from "@/data/schemas";
import { CARS_BY_ID } from "@/data/cars";
import { UPGRADES_BY_ID } from "@/data/upgrades";

import { sumBonusCredits, type RaceBonus } from "./raceBonuses";
import type { FinalCarRecord } from "./raceRules";

/**
 * §12 finish-multiplier table. Index 0 is unused so placement reads the
 * one-indexed value naturally (`MULTIPLIERS[1]` for 1st place). Places 9
 * through 12 share the trailing 0.14 multiplier per the GDD.
 */
const FINISH_MULTIPLIERS: ReadonlyArray<number> = Object.freeze([
  0,
  1.0,
  0.82,
  0.7,
  0.58,
  0.48,
  0.4,
  0.32,
  0.24,
  0.14,
  0.14,
  0.14,
  0.14,
]);

/**
 * Player-difficulty multiplier table. §12 names a `difficultyMultiplier`
 * but neither §12 nor §23 ships the column today. The values here are a
 * documented placeholder pin (Q-NNN tracks the dev decision). They match
 * the §15 four-tier player-facing ladder shape used elsewhere in the
 * runtime; the championship-level `DifficultyPreset` enum (novice..extreme)
 * uses the same names for two of the tiers (easy, normal, hard) so the
 * caller can pass either value here and get a sensible scalar.
 *
 * Linear from 0.9x at easy/novice to 1.20x at extreme. Master mirrors the
 * §15 unlock tier and pays the same as Hard until the §23 column lands.
 */
const DIFFICULTY_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  novice: 0.9,
  easy: 0.95,
  normal: 1.0,
  hard: 1.1,
  master: 1.1,
  extreme: 1.2,
});

/** DNF participation cash so a wrecked car is not stranded with zero. */
export const DNF_PARTICIPATION_CREDITS = 200;

/** §12 tour bonus rate (15% of summed race rewards on a successful clear). */
export const TOUR_BONUS_RATE = 0.15;

// Result types -------------------------------------------------------------

export type EconomyFailure =
  | { code: "insufficient_credits"; required: number; available: number }
  | { code: "upgrade_at_cap"; category: UpgradeCategory; cap: number }
  | { code: "tier_skip"; category: UpgradeCategory; required: number; attempted: number }
  | { code: "unknown_car"; carId: string }
  | { code: "unknown_upgrade"; upgradeId: string }
  | { code: "car_not_owned"; carId: string };

export type EconomyResult<S = SaveGame> =
  | { ok: true; state: S; cashEarned?: number; cashBaseEarned?: number; bonuses?: ReadonlyArray<RaceBonus> }
  | { ok: false; failure: EconomyFailure };

// Credit awards ------------------------------------------------------------

/**
 * Per-race award input. Passed by the caller (the race-finish wiring
 * slice) at the moment the race ends. The shape is the minimum the §12
 * formula needs; richer fields can be added without breaking callers.
 *
 * `placement` is 1-indexed and resolved by the caller from the
 * `FinalRaceState.finishingOrder` array index (`index + 1`). DNF cars
 * pay the participation flat rate regardless of `placement`.
 */
export interface AwardCreditsInput {
  /** 1-indexed placement in the finishing order. */
  placement: number;
  /** Final car status from the race session. */
  status: FinalCarRecord["status"];
  /**
   * Per-track base reward in credits. Passed by the caller because the
   * §12 `baseTrackReward` is a track property that has no schema field
   * yet; the championship slice will eventually fold this into the track
   * JSON. For now the caller looks it up from a per-tour table.
   */
  baseTrackReward: number;
  /**
   * Player-difficulty multiplier key. One of the keys in
   * `DIFFICULTY_MULTIPLIERS`. The caller passes either the championship's
   * `difficultyPreset` (when racing in a tour) or the save's
   * `settings.difficultyPreset` (quick race / time trial).
   */
  difficulty: string;
  /** Optional override for the participation cash on DNF (defaults to `DNF_PARTICIPATION_CREDITS`). */
  dnfParticipation?: number;
  /**
   * §5 bonus list to credit on top of the placement payout. Each entry's
   * `cashCredits` is summed and added to the wallet delta. Defaults to
   * an empty list so existing callers that have not yet wired the bonus
   * pipeline (`raceBonuses.ts`) keep their previous behaviour. DNF cars
   * still receive the participation cash but no bonuses; the per-bonus
   * predicate in `computeBonuses` filters DNF before this layer sees
   * the list, so callers do not need to pre-filter.
   */
  bonuses?: ReadonlyArray<RaceBonus>;
}

/**
 * Compute and credit the per-race reward to the player's wallet. Returns
 * a fresh `SaveGame` with `garage.credits` incremented; the input is
 * never mutated.
 *
 * Reward formula:
 *
 *     finished:  Math.round(baseTrackReward * finishMultiplier(place) * difficultyMultiplier(difficulty))
 *     dnf:       DNF_PARTICIPATION_CREDITS  (no scaling)
 *
 * Rounding follows §12 / iter-19 stress-test §4: round each award to an
 * integer credit count after multiplying. The result's `cashEarned`
 * field carries the rounded delta so callers can render the §20
 * "Cash earned" line without re-deriving it.
 *
 * Out-of-table placements (place <= 0 or place > 12) fall back to the
 * trailing 0.14 multiplier rather than a zero award; see §12 "Places
 * 9-12" floor.
 */
export function awardCredits(save: SaveGame, input: AwardCreditsInput): EconomyResult {
  const cashBaseEarned = computeRaceReward({
    place: input.placement,
    status: input.status,
    baseTrackReward: input.baseTrackReward,
    difficulty: input.difficulty,
    dnfParticipation: input.dnfParticipation,
  });

  // Bonuses do not accumulate for DNF cars: a DNF car receives the flat
  // participation cash and nothing else. The §5 bonus pipeline already
  // filters DNF inside `computeBonuses`, so any list reaching this layer
  // for a DNF car would be empty in practice; the explicit check keeps
  // the contract tight even if a caller bypasses the pipeline.
  const bonuses: ReadonlyArray<RaceBonus> =
    input.status === "dnf" ? [] : (input.bonuses ?? []);
  const bonusCash = sumBonusCredits(bonuses);

  const cashEarned = cashBaseEarned + bonusCash;

  const next: SaveGame = {
    ...save,
    garage: {
      ...save.garage,
      credits: save.garage.credits + cashEarned,
    },
  };

  return { ok: true, state: next, cashEarned, cashBaseEarned, bonuses };
}

/**
 * Pure helper exposed for the tour-bonus computation (tour-region slice)
 * and unit tests that want to spot-check a placement without touching a
 * SaveGame. Returns the integer credit value for the given inputs.
 */
export function computeRaceReward(args: {
  place: number;
  status: FinalCarRecord["status"];
  baseTrackReward: number;
  difficulty: string;
  dnfParticipation?: number;
}): number {
  if (args.status === "dnf") {
    const dnf = args.dnfParticipation ?? DNF_PARTICIPATION_CREDITS;
    return Math.max(0, Math.round(dnf));
  }
  const finishMul = finishMultiplier(args.place);
  const diffMul = difficultyMultiplier(args.difficulty);
  const base = Math.max(0, args.baseTrackReward);
  return Math.round(base * finishMul * diffMul);
}

/**
 * §12 tour-clear bonus. Sums the per-race rewards (passed by the caller
 * so the rounding decision matches what the player saw on each race
 * results screen) and rounds the 15% bonus once at the end.
 */
export function tourBonus(raceRewards: ReadonlyArray<number>): number {
  if (raceRewards.length === 0) return 0;
  const total = raceRewards.reduce((acc, n) => acc + Math.max(0, n), 0);
  return Math.round(total * TOUR_BONUS_RATE);
}

function finishMultiplier(place: number): number {
  if (!Number.isFinite(place) || place <= 0) {
    return FINISH_MULTIPLIERS[FINISH_MULTIPLIERS.length - 1] ?? 0.14;
  }
  if (place < FINISH_MULTIPLIERS.length) {
    return FINISH_MULTIPLIERS[place] ?? 0.14;
  }
  return FINISH_MULTIPLIERS[FINISH_MULTIPLIERS.length - 1] ?? 0.14;
}

function difficultyMultiplier(difficulty: string): number {
  return DIFFICULTY_MULTIPLIERS[difficulty] ?? 1.0;
}

// Upgrades ----------------------------------------------------------------

/** Catalogue lookup. Throws on unknown id so callers fail-fast at the call site. */
export function getUpgradePrice(upgradeId: string): number {
  const upgrade = UPGRADES_BY_ID.get(upgradeId);
  if (upgrade === undefined) {
    throw new Error(
      `getUpgradePrice: unknown upgrade id "${upgradeId}". Known ids: ${[...UPGRADES_BY_ID.keys()].sort().join(", ")}`,
    );
  }
  return upgrade.cost;
}

/**
 * Purchase an upgrade for the given car. Returns a fresh `SaveGame`
 * with `garage.credits` decreased by the upgrade cost and
 * `garage.installedUpgrades[carId][category]` advanced to the upgrade's
 * tier. Pure: input save is not mutated.
 *
 * Rejection paths:
 * - `unknown_upgrade`: the upgrade id is not in the catalogue.
 * - `unknown_car`: the carId is not in the static catalogue (modder
 *   typo, deleted save reference).
 * - `car_not_owned`: the car id is not in `save.garage.ownedCars`.
 *   Players cannot upgrade a car they do not own.
 * - `insufficient_credits`: the player's wallet is below the upgrade
 *   cost. The failure carries `required` and `available` so the UI can
 *   render a "you need N more credits" hint without recomputing.
 * - `tier_skip`: the player is attempting to install a tier higher than
 *   `currentInstalled + 1`. §12 mandates sequential install
 *   (Stock -> Street -> Sport -> Factory -> Extreme).
 * - `upgrade_at_cap`: the car's `upgradeCaps[category]` would be
 *   exceeded by the install. The failure carries the cap so the UI can
 *   show a "this car maxes out at tier N" indicator.
 *
 * Note: this MVP fold purchases and installs together. The
 * stress-test calls for a future split where a player can buy an
 * upgrade and not install it; that lands with the labor-fee mechanic
 * and changes the function signature additively.
 */
export function purchaseUpgrade(
  save: SaveGame,
  upgradeId: string,
  carId: string,
): EconomyResult {
  const upgrade = UPGRADES_BY_ID.get(upgradeId);
  if (upgrade === undefined) {
    return { ok: false, failure: { code: "unknown_upgrade", upgradeId } };
  }

  const car = CARS_BY_ID.get(carId);
  if (car === undefined) {
    return { ok: false, failure: { code: "unknown_car", carId } };
  }

  if (!save.garage.ownedCars.includes(carId)) {
    return { ok: false, failure: { code: "car_not_owned", carId } };
  }

  const cap = car.upgradeCaps[upgrade.category];
  const installedForCar = save.garage.installedUpgrades[carId];
  const currentInstalled = installedForCar?.[upgrade.category] ?? 0;

  // §12 sequential install rule: tier N requires currentInstalled === N - 1.
  if (upgrade.tier !== currentInstalled + 1) {
    return {
      ok: false,
      failure: {
        code: "tier_skip",
        category: upgrade.category,
        required: currentInstalled + 1,
        attempted: upgrade.tier,
      },
    };
  }

  if (upgrade.tier > cap) {
    return {
      ok: false,
      failure: {
        code: "upgrade_at_cap",
        category: upgrade.category,
        cap,
      },
    };
  }

  if (save.garage.credits < upgrade.cost) {
    return {
      ok: false,
      failure: {
        code: "insufficient_credits",
        required: upgrade.cost,
        available: save.garage.credits,
      },
    };
  }

  const nextInstalledForCar: Record<UpgradeCategory, number> = {
    ...emptyInstalledRow(),
    ...(installedForCar ?? {}),
    [upgrade.category]: upgrade.tier,
  };

  const next: SaveGame = {
    ...save,
    garage: {
      ...save.garage,
      credits: save.garage.credits - upgrade.cost,
      installedUpgrades: {
        ...save.garage.installedUpgrades,
        [carId]: nextInstalledForCar,
      },
    },
  };

  return { ok: true, state: next };
}

/**
 * Explicit install step. Currently an alias for `purchaseUpgrade`
 * because the MVP folds purchase and install together. Reserved for
 * a future labor-fee mechanic per the iter-19 stress-test §5 split.
 *
 * Documented here so callers (UI layer) can switch from
 * `purchaseUpgrade` to `purchaseAndInstall` (the canonical surface)
 * without rewriting their logic when the split lands.
 */
export function installUpgrade(
  save: SaveGame,
  upgradeId: string,
  carId: string,
): EconomyResult {
  return purchaseUpgrade(save, upgradeId, carId);
}

/** Canonical garage call: purchase then install in sequence. */
export function purchaseAndInstall(
  save: SaveGame,
  upgradeId: string,
  carId: string,
): EconomyResult {
  return purchaseUpgrade(save, upgradeId, carId);
}

/** Returns a zero-filled installed-upgrade row matching the schema. */
function emptyInstalledRow(): Record<UpgradeCategory, number> {
  const row = {} as Record<UpgradeCategory, number>;
  for (const cat of UpgradeCategorySchema.options) {
    row[cat] = 0;
  }
  return row;
}

// Re-exports for tests / callers ------------------------------------------

export { FINISH_MULTIPLIERS, DIFFICULTY_MULTIPLIERS };
export type { Upgrade };
