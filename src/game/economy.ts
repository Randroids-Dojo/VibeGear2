/**
 * Economy primitives. Pure functions on `SaveGame` per
 * `docs/gdd/12-upgrade-and-economy-system.md`.
 *
 * Surface:
 * - `awardCredits(save, raceResult, opts)`: credit the player for a
 *   finishing position using the §12 finish-multiplier table.
 * - `applyRepairCost(save, input)`: debit the wallet for a per-zone
 *   repair using the §12 formula
 *   `repairCost = damagePercent * carRepairFactor * tourTierScale`
 *   and return a fresh `SaveGame` plus the post-repair `DamageState`
 *   with the repaired zones zeroed.
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

import { cappedRepairCost, type RepairKind } from "./catchUp";
import {
  REPAIR_BASE_COST_CREDITS,
  createDamageState,
  type DamageState,
  type DamageZone,
} from "./damage";
import { sumBonusCredits, type RaceBonus } from "./raceBonuses";
import type { FinalCarRecord } from "./raceRules";

/** Damage-zone identifiers re-exported so callers can build a `zones` list without importing damage.ts directly. */
const DAMAGE_ZONE_KEYS: ReadonlyArray<DamageZone> = ["engine", "tires", "body"];

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

/**
 * §23 "Reward formula targets" base track reward keyed by track
 * difficulty rating (`1..5`). The track schema field that owns this
 * value (`baseTrackReward` per §22) is not yet pinned on every track
 * JSON; the caller resolves the value either from the per-tour table
 * the championship slice ships, or from this lookup when only the
 * difficulty rating is known.
 *
 * The §23 column reads:
 *
 *     | difficulty | base reward |
 *     | ---------- | ----------- |
 *     |     1      |       1,000 |
 *     |     2      |       1,350 |
 *     |     3      |       1,750 |
 *     |     4      |       2,250 |
 *     |     5      |       2,900 |
 *
 * Pinned as a frozen lookup so a future tweak stays in lockstep with
 * §23 (the `balancing.test.ts` content test asserts each cell matches).
 *
 * Out-of-range difficulties (NaN, < 1, > 5) collapse to the closest
 * in-range bucket so a buggy track JSON cannot strand a race with a
 * zero reward; the §23 design intent is "every race pays something".
 */
export const BASE_REWARDS_BY_TRACK_DIFFICULTY: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> =
  Object.freeze({
    1: 1000,
    2: 1350,
    3: 1750,
    4: 2250,
    5: 2900,
  });

/**
 * Resolve the §23 base reward for a track difficulty rating. Out-of-range
 * inputs clamp into `[1, 5]` so a malformed track value still pays a
 * reasonable amount. The race-finish wiring slice will route the
 * resolved value into `awardCredits.input.baseTrackReward`.
 */
export function baseRewardForTrackDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return BASE_REWARDS_BY_TRACK_DIFFICULTY[1];
  const rounded = Math.round(difficulty);
  const clamped = Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
  return BASE_REWARDS_BY_TRACK_DIFFICULTY[clamped];
}

/**
 * §23 "Repair cost tour tier scale" lookup keyed by 1-based tour index.
 * Resolves the `tourTierScale` factor in §12's repair-cost formula
 * (`repairCost = damagePercent * carRepairFactor * tourTierScale`) so
 * late tours pressure armor upgrades. Frozen so a stray write cannot
 * drift §23.
 *
 * Tour 1 sits at `1.00x` (no scale-up on the first tour); each later
 * tour adds a geometric-ish ramp ending near `2.80x` at tour 8. Tours
 * past 8 reuse the tour-8 value via `tourTierScale(tour)` until a
 * future content slice extends the championship.
 *
 * Pinned per Q-010 option (a). The `balancing.test.ts` content test
 * asserts each cell against the §23 markdown table.
 */
export const TOUR_TIER_SCALE: Readonly<
  Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, number>
> = Object.freeze({
  1: 1.0,
  2: 1.15,
  3: 1.3,
  4: 1.5,
  5: 1.75,
  6: 2.05,
  7: 2.4,
  8: 2.8,
});

/**
 * Resolve the §23 `tourTierScale` factor for a 1-based tour index.
 * Out-of-range inputs (NaN, < 1, > 8) clamp into the pinned table so a
 * malformed save cannot strand a repair quote with a zero or undefined
 * scale; the §12 design intent is "every tour pays at least the tour-1
 * factor and never more than the tour-8 factor until §23 extends".
 *
 * Fractional inputs round to the nearest tour so a caller passing a
 * 0-based index by mistake (e.g. `tour.index` instead of `tour.index + 1`)
 * still resolves into the table rather than throwing.
 */
export function tourTierScale(tour: number): number {
  if (!Number.isFinite(tour)) return TOUR_TIER_SCALE[1];
  const rounded = Math.round(tour);
  const clamped = Math.max(1, Math.min(8, rounded)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  return TOUR_TIER_SCALE[clamped];
}

// Result types -------------------------------------------------------------

export type EconomyFailure =
  | { code: "insufficient_credits"; required: number; available: number }
  | { code: "upgrade_at_cap"; category: UpgradeCategory; cap: number }
  | { code: "tier_skip"; category: UpgradeCategory; required: number; attempted: number }
  | { code: "unknown_car"; carId: string }
  | { code: "unknown_upgrade"; upgradeId: string }
  | { code: "car_not_owned"; carId: string }
  | { code: "unknown_zone"; zone: string };

export type EconomyResult<S = SaveGame> =
  | {
      ok: true;
      state: S;
      cashEarned?: number;
      cashBaseEarned?: number;
      bonuses?: ReadonlyArray<RaceBonus>;
      /** Credits debited from the wallet for this operation (repair flow). */
      cashSpent?: number;
      /**
       * Credits saved by the §12 essential-repair cap (repair flow). Always
       * the difference `rawTotal - cashSpent` so callers can render
       * "Discount applied: -N" without recomputing the raw cost. Zero when
       * the cap did not engage (full repair, ineligible difficulty, or
       * raw total already at or below the cap). The receipt UI can surface
       * the saving as a separate line and the §20 results screen can show
       * a "Catch-up cap" badge whenever this field is positive.
       */
      cashSaved?: number;
      /** Post-operation `DamageState` with the repaired zones zeroed (repair flow). */
      damage?: DamageState;
      /**
       * Per-zone repair cost breakdown in the order the caller passed them
       * (repair flow). Line items always sum exactly to `cashSpent`. When
       * the §12 essential-repair cap engages the per-zone values are scaled
       * proportionally (largest-remainder rounding) so the receipt rows
       * still reconcile with the wallet debit.
       */
      repairBreakdown?: ReadonlyArray<{ zone: DamageZone; credits: number }>;
    }
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

  // Result bonuses do not accumulate for DNF cars, but cash pickups are
  // a race-collected delta rather than a finish-quality bonus. Keep those
  // in the receipt so collected track cash is still paid with the result.
  const bonuses: ReadonlyArray<RaceBonus> =
    input.status === "dnf"
      ? (input.bonuses ?? []).filter((bonus) => bonus.kind === "pickupCash")
      : (input.bonuses ?? []);
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

// Repair cost ------------------------------------------------------------

/**
 * Per-call input to `applyRepairCost`. The caller is the §20 results
 * screen "Repair" button (and a future garage repair surface); both
 * supply the in-flight `DamageState` along with the active car id and
 * the championship tour index so the §12 / §23 formula resolves.
 *
 * Field semantics:
 *
 * - `carId`: which catalogue car the repair applies to. The car's
 *   `repairFactor` (per `src/data/cars/*.json`) feeds the §12
 *   `carRepairFactor` slot; an unknown id rejects with `unknown_car`.
 * - `damage`: the in-flight `DamageState` for the active car. The
 *   function reads `state.zones[zone]` for each requested zone and
 *   uses `repairCostFor` (from `damage.ts`) for the per-zone base
 *   cost. The damage state is not stored on `SaveGame` (it is a
 *   per-race runtime value owned by `RaceSession`); the caller is
 *   responsible for feeding the latest snapshot.
 * - `tourTier`: 1-based championship tour index. Passes through to
 *   `tourTierScale` so the §23 lookup applies. Out-of-range / NaN
 *   inputs collapse to the in-table extremes per `tourTierScale`.
 *   Quick-race / Practice / Time Trial use tour 1 (no scale-up).
 * - `zones`: optional list of zones to repair. Defaults to all three
 *   (`engine`, `tires`, `body`) for a "repair everything" call. A
 *   garage UI offering per-zone toggles passes a subset; an unknown
 *   string rejects with `unknown_zone`. Order is preserved in the
 *   `repairBreakdown` field of the result so the UI can render the
 *   line items in the order the player clicked.
 */
export interface ApplyRepairCostInput {
  /** Catalogue car id; the car's `repairFactor` feeds the §12 formula. */
  carId: string;
  /** In-flight per-car damage snapshot. */
  damage: Readonly<DamageState>;
  /** 1-based tour index passed to `tourTierScale`. */
  tourTier: number;
  /** Optional subset; omitted means "repair all three zones". */
  zones?: ReadonlyArray<DamageZone>;
  /**
   * §12 catch-up #2 repair kind. The garage UI's repair button picks
   * `"essential"` (the minimum-to-keep-racing repair, eligible for the
   * cap) or `"full"` (cosmetic / total repair, never capped). Defaults
   * to `"full"` so existing callers that have not yet wired the
   * essential / full toggle keep their previous behaviour and pay the
   * raw §12 cost. The cap is applied after the per-zone breakdown is
   * computed so the formula and the rounding policy stay identical to
   * the uncapped path.
   */
  repairKind?: RepairKind;
  /**
   * Player's last race cash income in credits, used as the cap basis
   * by `cappedRepairCost`. Required for the cap to engage; absent or
   * zero means the cap collapses to 0 (a player who earned no cash
   * from the previous race gets a free essential repair, mirroring
   * the §12 catch-up intent). Quick-race / Time Trial / Practice can
   * pass the runtime payout that landed on the §20 results screen;
   * the championship slice will eventually thread this through from
   * the per-tour ledger. Save-resident persistence of the value is
   * deliberately not modelled here so the per-race lifecycle stays
   * the caller's responsibility.
   */
  lastRaceCashEarned?: number;
  /**
   * Player-difficulty key for the §12 cap eligibility check. One of
   * the keys in `DIFFICULTY_MULTIPLIERS`; unknown values pass through
   * to `cappedRepairCost` which excludes them from the cap. Defaults
   * to `save.settings.difficultyPreset` (or `"normal"` when the v1
   * save predates the field) so the common case (garage surface
   * reading the active save) does not have to thread the value
   * explicitly. An explicit override is supported for the
   * championship case where the active tour's `difficultyPreset`
   * differs from the save's.
   */
  difficulty?: string;
}

/**
 * Apply the §12 repair-cost formula and return a fresh save plus the
 * post-repair `DamageState`.
 *
 * Per-zone cost formula:
 *
 *     zoneCost = damagePercent * carRepairFactor * tourTierScale * REPAIR_BASE_COST_CREDITS[zone]
 *
 * `damagePercent` is the in-flight `damage.zones[zone]` (already on
 * `[0, 1]`). `carRepairFactor` is the catalogue car's `repairFactor`.
 * `tourTierScale` is the §23 lookup for the 1-based tour index. The
 * per-zone base cost (`REPAIR_BASE_COST_CREDITS`) is reused from
 * `damage.ts` (`repairCostFor` does the `damagePercent * base` step
 * for us; we then scale by `repairFactor * tourTierScale`).
 *
 * Each zone is rounded individually before summing so the §20 receipt
 * can show line items that add up exactly to the deducted total.
 *
 * §12 catch-up #2 essential-repair cap: when `repairKind === "essential"`
 * and the player-difficulty key is one of the cap-eligible tiers (easy,
 * normal, novice; hard / master / extreme always pay full price), the
 * summed raw cost is clamped to `lastRaceCashEarned * REPAIR_CAP_FRACTION`
 * via `cappedRepairCost`. The clamp targets the total (not each zone) so
 * the §20 receipt's "Discount applied" line matches the wallet debit.
 * Per-zone breakdown rows are scaled with largest-remainder rounding so
 * the line items still sum exactly to `cashSpent`. The result's
 * `cashSaved` field carries the discount (`rawTotal - cashSpent`); zero
 * when the cap did not engage. Defaults preserve the pre-F-036 behaviour:
 * callers that omit `repairKind` get full price and zero saving.
 *
 * Rejection paths:
 *
 * - `unknown_car`: the carId is not in the catalogue.
 * - `unknown_zone`: the zones list contains a value that is not a
 *   valid `DamageZone`.
 * - `insufficient_credits`: the wallet is below the summed cost. The
 *   failure carries `required` and `available` so the UI can render a
 *   "you need N more credits" hint without recomputing.
 *
 * Idempotency: a zone with zero damage costs zero credits and the
 * post-repair state for that zone is unchanged (`repairCostFor`
 * already returns 0 for `damage <= 0`). A "repair an undamaged car"
 * call therefore returns the same save back, with `cashSpent === 0`
 * and the damage state byte-equivalent to the input. Callers can
 * skip the post-race repair UI when the total comes back as 0.
 *
 * Pure: input save and damage are never mutated. No `Date.now`,
 * `Math.random`, or any IO.
 */
export function applyRepairCost(
  save: SaveGame,
  input: ApplyRepairCostInput,
): EconomyResult {
  const car = CARS_BY_ID.get(input.carId);
  if (car === undefined) {
    return { ok: false, failure: { code: "unknown_car", carId: input.carId } };
  }

  const requestedZones: ReadonlyArray<DamageZone> =
    input.zones ?? DAMAGE_ZONE_KEYS;

  for (const zone of requestedZones) {
    if (!isDamageZone(zone)) {
      return { ok: false, failure: { code: "unknown_zone", zone: String(zone) } };
    }
  }

  // Deduplicate while preserving order so a caller passing
  // ["engine", "engine"] is not double-billed but the breakdown still
  // honours the first occurrence's slot.
  const uniqueZones: DamageZone[] = [];
  const seen = new Set<DamageZone>();
  for (const zone of requestedZones) {
    if (!seen.has(zone)) {
      uniqueZones.push(zone);
      seen.add(zone);
    }
  }

  const scale = tourTierScale(input.tourTier);
  const repairFactor = car.repairFactor;

  const rawBreakdown: Array<{ zone: DamageZone; credits: number }> = [];
  let rawTotal = 0;
  for (const zone of uniqueZones) {
    const damagePct = clampUnit(input.damage.zones[zone] ?? 0);
    const baseCredits = damagePct * REPAIR_BASE_COST_CREDITS[zone];
    const zoneCost = Math.max(0, Math.round(baseCredits * repairFactor * scale));
    rawBreakdown.push({ zone, credits: zoneCost });
    rawTotal += zoneCost;
  }

  // §12 catch-up #2: an essential repair on a cap-eligible difficulty is
  // capped at a fraction of the previous race's cash income. The cap
  // applies to the summed per-zone cost (not per-zone individually) so
  // the receipt's "Discount applied" line lines up with what the player
  // saw on the §20 results screen. `cappedRepairCost` defaults to a
  // pass-through when `repairKind === "full"` or the difficulty is not
  // eligible (hard, master, extreme); see `src/game/catchUp.ts` for the
  // gate set. Defaults preserve the pre-F-036 behaviour: callers that do
  // not pass `repairKind`/`lastRaceCashEarned`/`difficulty` get full
  // price and zero saving.
  const repairKind: RepairKind = input.repairKind ?? "full";
  const raceCashEarned = Math.max(0, input.lastRaceCashEarned ?? 0);
  // `save.settings.difficultyPreset` is optional on the v1 schema (the
  // field landed in the v2 settings expansion); the loader / `defaultSave`
  // always populate it but a v1 save in flight may still be `undefined`.
  // Fall back to `"normal"` per the schema's documented compatibility
  // contract so the cap eligibility check has a stable key.
  const difficulty =
    input.difficulty ?? save.settings.difficultyPreset ?? "normal";
  const totalCost = cappedRepairCost(
    rawTotal,
    raceCashEarned,
    repairKind,
    difficulty,
  );
  const cashSaved = Math.max(0, rawTotal - totalCost);

  // Re-distribute the cap across the per-zone breakdown so line items
  // still sum exactly to `totalCost`. Largest-remainder rounding keeps
  // each zone close to its proportional share of the raw cost while
  // guaranteeing the integer sum is honoured. When the cap did not
  // engage (`totalCost === rawTotal`) the breakdown is the raw values
  // unchanged so the existing F-033 unit tests stay green byte-for-byte.
  const breakdown =
    totalCost === rawTotal
      ? rawBreakdown
      : redistributeBreakdown(rawBreakdown, rawTotal, totalCost);

  if (totalCost > save.garage.credits) {
    return {
      ok: false,
      failure: {
        code: "insufficient_credits",
        required: totalCost,
        available: save.garage.credits,
      },
    };
  }

  const nextZones: Record<DamageZone, number> = {
    engine: input.damage.zones.engine,
    tires: input.damage.zones.tires,
    body: input.damage.zones.body,
  };
  for (const zone of uniqueZones) {
    nextZones[zone] = 0;
  }

  // `createDamageState` recomputes the weighted total from the new
  // zone values so the §13 wreck check stays coherent across a repair.
  // The off-road accumulator is preserved separately so a repair does
  // not reset the per-race "time spent off-road" counter.
  const nextDamage: DamageState = {
    ...createDamageState(nextZones),
    offRoadAccumSeconds: input.damage.offRoadAccumSeconds,
  };

  const next: SaveGame = {
    ...save,
    garage: {
      ...save.garage,
      credits: save.garage.credits - totalCost,
    },
  };

  return {
    ok: true,
    state: next,
    cashSpent: totalCost,
    cashSaved,
    damage: nextDamage,
    repairBreakdown: breakdown,
  };
}

/**
 * Largest-remainder allocation of `targetTotal` across `breakdown`,
 * weighted by each entry's share of `rawTotal`. Used by `applyRepairCost`
 * when the §12 essential-repair cap collapses the raw cost: the receipt
 * still has to render line items that sum exactly to the deducted total
 * and stay non-negative integers.
 *
 * Algorithm (Hamilton / largest-remainder method):
 *   1. For each entry, compute the floor of `targetTotal * (raw / rawTotal)`.
 *   2. Track the fractional remainder per entry.
 *   3. Distribute the leftover credits one at a time to the entries with
 *      the largest remainders (ties broken by original index for stability).
 *
 * Edge cases:
 *   - `rawTotal === 0`: every entry was already zero; return the breakdown
 *     unchanged with credits zeroed (defensive; callers should never reach
 *     this with `targetTotal > 0`).
 *   - `targetTotal === 0`: every line collapses to zero (free essential
 *     repair when the player earned no cash).
 *   - Single-entry breakdown: the entire `targetTotal` lands on that entry.
 */
function redistributeBreakdown(
  rawBreakdown: ReadonlyArray<{ zone: DamageZone; credits: number }>,
  rawTotal: number,
  targetTotal: number,
): Array<{ zone: DamageZone; credits: number }> {
  if (rawTotal <= 0 || targetTotal <= 0) {
    return rawBreakdown.map((entry) => ({ zone: entry.zone, credits: 0 }));
  }

  type Slot = {
    index: number;
    zone: DamageZone;
    floorCredits: number;
    remainder: number;
  };

  const slots: Slot[] = rawBreakdown.map((entry, index) => {
    const exact = (targetTotal * entry.credits) / rawTotal;
    const floor = Math.floor(exact);
    return {
      index,
      zone: entry.zone,
      floorCredits: floor,
      remainder: exact - floor,
    };
  });

  const allocated = slots.reduce((acc, slot) => acc + slot.floorCredits, 0);
  let leftover = targetTotal - allocated;

  // Distribute leftover credits one at a time to the slots with the
  // largest remainder. A stable sort (by remainder descending, then by
  // original index ascending) makes the allocation deterministic so two
  // calls with identical inputs produce identical breakdowns.
  const order = [...slots].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.index - b.index;
  });

  for (const slot of order) {
    if (leftover <= 0) break;
    slot.floorCredits += 1;
    leftover -= 1;
  }

  // Rebuild in original order so the receipt rows stay in the order the
  // caller passed them.
  const restored = [...slots].sort((a, b) => a.index - b.index);
  return restored.map((slot) => ({ zone: slot.zone, credits: slot.floorCredits }));
}

function isDamageZone(value: unknown): value is DamageZone {
  return value === "engine" || value === "tires" || value === "body";
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
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
