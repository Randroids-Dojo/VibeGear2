/**
 * Race bonus computation per `docs/gdd/05-core-gameplay-loop.md` Rewards
 * and `docs/gdd/12-upgrade-and-economy-system.md` Currency rewards.
 *
 * This module owns the §5 bonus list that layers on top of the §12
 * placement payout: podium, fastest lap, clean race, underdog, tour
 * completion, and sponsor objective. The §12 economy module owns the
 * placement multiplier table and the credit accounting; this module
 * owns the per-bonus predicates and the credit values each bonus pays.
 *
 * Boundary with sibling modules:
 *
 *   - `raceRules.ts` owns the `FinalRaceState` shape (finishing order,
 *     lap times, fastest lap). Bonus predicates read from it.
 *   - `economy.ts` owns the per-place credit formula and the wallet
 *     mutation. `awardCredits` accepts a `bonuses` array and sums each
 *     bonus's `cashCredits` into the credited delta. The accounting and
 *     receipt boundary mirrors the iter-19 stress-test §5 split:
 *     "compute" (this module) vs "commit" (`economy.ts`).
 *   - `raceResult.ts` is the §20 results-screen builder; it consumes
 *     this module's output verbatim so the player sees the same chips
 *     the wallet credit was derived from. The rendering pipeline is in
 *     `src/components/results/BonusChip.tsx`.
 *   - `src/data/sponsors.ts` is the catalogue source for sponsor
 *     objectives; this module is the evaluator. The schema lives in
 *     `src/data/schemas.ts` `SponsorObjectiveSchema`.
 *
 * Bonus credit values are derived from the per-race `baseTrackReward`
 * via the rate constants pinned by the iter-19 stress-test §5 split
 * (dot `VibeGear2-implement-race-reward-3eb9b609`). Each rate is a
 * dimensionless multiplier of `baseTrackReward`, rounded once to an
 * integer credit value at the chip boundary so the §20 chip strip and
 * the wallet credit stay in lockstep. The §23 base-reward table
 * (`BASE_REWARDS_BY_TRACK_DIFFICULTY`) sets the per-track scale; this
 * module sets the per-bonus shape.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals. Every
 * exported function returns a fresh value and never mutates its input
 * (AGENTS.md RULE 8). DNF cars receive no bonuses; sponsor predicates
 * silently fail rather than awarding negative credits (per dot edge
 * case).
 */

import type {
  SponsorObjective,
  SponsorObjectiveKind,
  WeatherOption,
} from "@/data/schemas";

import type { FinalRaceState } from "./raceRules";

// Bonus shape -------------------------------------------------------------

/**
 * Identifier for a bonus chip. The §20 results screen renders these as
 * pills via `BonusChip.tsx`; the `data-kind` attribute is one of these
 * values. Adding a new kind is a UI-coordinated change because the chip
 * test suite asserts presence by kind. Existing kinds stay camelCase to
 * keep the chip selector stable.
 */
export type RaceBonusKind =
  | "podium"
  | "fastestLap"
  | "cleanRace"
  | "underdog"
  | "tourComplete"
  | "sponsor";

/**
 * A single awarded bonus. `cashCredits` is the integer credit delta the
 * §12 economy adds to the wallet for this bonus. `label` is the
 * human-readable string the chip renders; English-only per §20 (no L10N
 * in MVP).
 */
export interface RaceBonus {
  kind: RaceBonusKind;
  label: string;
  cashCredits: number;
}

// Pinned bonus rates -----------------------------------------------------

/**
 * Podium-bonus rates as a fraction of `baseTrackReward`. Index 0 unused
 * so the placement read is naturally 1-indexed; entries beyond P3 are
 * `0` so the lookup never awards podium for non-podium places. Matches
 * the iter-19 stress-test §5 pin: 0.10 / 0.05 / 0.02 for P1 / P2 / P3.
 */
export const PODIUM_BONUS_RATES: ReadonlyArray<number> = Object.freeze([
  0, 0.1, 0.05, 0.02,
]);

/** Fastest-lap bonus rate (8% of `baseTrackReward`). */
export const FASTEST_LAP_BONUS_RATE = 0.08;

/**
 * Clean-race bonus rate (5% of `baseTrackReward`). The §13 design
 * pillar "damage is strategic, not fiddly" rewards a clean race; the
 * bonus is intentionally smaller than the P1 podium so it stacks rather
 * than dominates.
 */
export const CLEAN_RACE_BONUS_RATE = 0.05;

/**
 * Underdog bonus rate (10% of `baseTrackReward`) per grid-rank
 * improvement. Paid once per race; the awarded credit value scales
 * linearly with how many positions the player gained from grid to
 * finish. Requires a valid grid position; modes without a grid
 * (Practice) skip the bonus.
 */
export const UNDERDOG_BONUS_RATE_PER_RANK = 0.1;

/**
 * Cash bonus for completing a tour. §12 names the rate as 15% of the
 * sum of per-race rewards; the value here is computed by
 * `tourCompletionBonus` rather than as a flat constant. The constant is
 * the rate the helper uses (mirrors `economy.TOUR_BONUS_RATE`).
 */
export const TOUR_COMPLETION_BONUS_RATE = 0.15;

// Bonus computation -------------------------------------------------------

/**
 * Inputs to `computeBonuses`. The race-finish wiring assembles these
 * from the live `RaceState` plus the §22 SaveGame plus the §13 damage
 * tracker. Sponsor and tour-completion bonuses are computed by their
 * own helpers because they need different inputs (active sponsor
 * catalogue, tour-clear lifecycle) that the per-race pipeline does not
 * carry.
 *
 * `playerStartPosition` is the 1-indexed grid spot. Pass `null` when
 * the mode does not have a grid (Practice / Time Trial) so the underdog
 * bonus is silently skipped instead of awarding spuriously.
 *
 * `damageBefore` and `damageAfter` are the per-zone scalars. Both
 * default to all-zero so callers in modes without damage tracking can
 * omit them; the clean-race predicate will then trivially pass.
 *
 * `playerNitroFired` is read by sponsor predicates only; it carries
 * through this module's input as a convenience for the per-race bundle.
 * `null` when the runtime has no nitro telemetry yet (the sponsor
 * predicate that needs it will silently fail).
 */
export interface ComputeBonusesInput {
  finalState: FinalRaceState;
  playerCarId: string;
  playerStartPosition: number | null;
  /**
   * Per-race base reward in credits. Every per-race bonus value is a
   * fraction of this (rates pinned by `PODIUM_BONUS_RATES`,
   * `FASTEST_LAP_BONUS_RATE`, `CLEAN_RACE_BONUS_RATE`,
   * `UNDERDOG_BONUS_RATE_PER_RANK`). The race-finish wiring resolves it
   * via `economy.baseRewardForTrackDifficulty(track.difficulty)` (or a
   * caller override) and threads the same value into both this module
   * and `computeRaceReward` so chips and wallet stay numerically
   * consistent.
   */
  baseTrackReward: number;
  damageBefore?: Readonly<DamageScalars>;
  damageAfter?: Readonly<DamageScalars>;
}

/** Per-zone damage scalars; mirrors the shape used in `raceResult.ts`. */
export interface DamageScalars {
  engine: number;
  tires: number;
  body: number;
}

const ZERO_DAMAGE: DamageScalars = Object.freeze({ engine: 0, tires: 0, body: 0 });

/** Tight epsilon for the clean-race comparison; matches `raceResult.ts`. */
const EPSILON = 1e-6;

/**
 * Compute the §5 per-race bonus list (podium, fastest lap, clean race,
 * underdog) for the player. Pure: same inputs always produce a
 * deep-equal output across runs; the input is never mutated.
 *
 * DNF policy: a player whose finishing record is `dnf` receives no
 * bonuses, including no podium even if the placement would otherwise
 * qualify. This matches the §5 rewards intent (bonuses are a celebratory
 * layer, not a participation prize) and the dot's edge-case pin.
 *
 * Order: podium, fastestLap, cleanRace, underdog. Stable per test
 * fixtures; the §20 results screen renders the chips in input order.
 */
export function computeBonuses(input: ComputeBonusesInput): ReadonlyArray<RaceBonus> {
  const playerIndex = input.finalState.finishingOrder.findIndex(
    (r) => r.carId === input.playerCarId,
  );
  const playerRecord =
    playerIndex >= 0 ? (input.finalState.finishingOrder[playerIndex] ?? null) : null;
  const playerPlacement = playerIndex >= 0 ? playerIndex + 1 : null;

  if (!playerRecord || playerRecord.status !== "finished") {
    return Object.freeze([]);
  }

  const damageBefore = input.damageBefore ?? ZERO_DAMAGE;
  const damageAfter = input.damageAfter ?? ZERO_DAMAGE;
  const fastestLapCarId = input.finalState.fastestLap?.carId ?? null;
  // Negative or non-finite base rewards collapse to zero so a malformed
  // caller cannot produce negative chip values; the §20 chip pipeline
  // would otherwise render `+-N` text. The wallet sum guard in
  // `sumBonusCredits` already clamps, but the chip itself still uses
  // the raw `cashCredits`, so we clamp here at the source.
  const safeBase =
    Number.isFinite(input.baseTrackReward) && input.baseTrackReward > 0
      ? input.baseTrackReward
      : 0;

  const bonuses: RaceBonus[] = [];

  // Podium: top 3 finishers only. DNF cars are filtered above. Rate
  // per place comes from `PODIUM_BONUS_RATES`; rounded once to an
  // integer credit value.
  if (playerPlacement !== null && playerPlacement >= 1 && playerPlacement <= 3) {
    const rate = PODIUM_BONUS_RATES[playerPlacement] ?? 0;
    bonuses.push({
      kind: "podium",
      label: "Podium finish",
      cashCredits: Math.round(safeBase * rate),
    });
  }

  // Fastest lap: player car set the field's fastest lap. AI fastest
  // laps do not award the bonus (player-only per the dot edge case).
  if (fastestLapCarId === input.playerCarId) {
    bonuses.push({
      kind: "fastestLap",
      label: "Fastest lap",
      cashCredits: Math.round(safeBase * FASTEST_LAP_BONUS_RATE),
    });
  }

  // Clean race: per-zone damage delta is non-positive within epsilon.
  // §13 "rubs and brushes do count" -> tight equality, no rub-floor
  // forgiveness. The §13 rub-event floor is owned by the damage module
  // and is already applied before the per-zone scalars reach this
  // module; if an event was filtered as a rub there, it never moved
  // the scalar here, so the player keeps the bonus.
  if (isClean(damageBefore, damageAfter)) {
    bonuses.push({
      kind: "cleanRace",
      label: "Clean race",
      cashCredits: Math.round(safeBase * CLEAN_RACE_BONUS_RATE),
    });
  }

  // Underdog: improved on grid. Requires a valid start position; modes
  // without a grid (Practice / Time Trial) pass `null` and skip. The
  // payout scales with how many positions were gained: rate is per
  // grid-rank improved, then rounded once.
  if (
    playerPlacement !== null &&
    input.playerStartPosition !== null &&
    input.playerStartPosition > 0 &&
    playerPlacement < input.playerStartPosition
  ) {
    const ranksImproved = input.playerStartPosition - playerPlacement;
    bonuses.push({
      kind: "underdog",
      label: "Underdog finish",
      cashCredits: Math.round(safeBase * UNDERDOG_BONUS_RATE_PER_RANK * ranksImproved),
    });
  }

  return bonuses;
}

function isClean(
  before: Readonly<DamageScalars>,
  after: Readonly<DamageScalars>,
): boolean {
  return (
    after.engine <= before.engine + EPSILON &&
    after.tires <= before.tires + EPSILON &&
    after.body <= before.body + EPSILON
  );
}

// Tour-completion bonus ---------------------------------------------------

/**
 * Inputs to `tourCompletionBonus`. The tour-clear surface
 * (`tour-region-d9ca9a4d`) calls this once at the end of race 4 of a
 * passed tour. The race rewards are the per-race amounts the player saw
 * on each results screen (sum of base placement cash + bonuses); rounding
 * is done once at the end so the bonus is a single integer credit value.
 */
export interface TourCompletionBonusInput {
  raceRewards: ReadonlyArray<number>;
  tourPassed: boolean;
}

/**
 * Compute the §12 tour-clear bonus as a `RaceBonus` for the §20 chip
 * pipeline. Returns `null` when the tour failed (no bonus paid) or when
 * the rewards array is empty (no races to scale against).
 *
 * The credit value is `Math.round(sum(rewards) * TOUR_COMPLETION_BONUS_RATE)`.
 * Negative reward entries are clamped to zero so a partial-credit failure
 * cannot drag the bonus below zero.
 */
export function tourCompletionBonus(input: TourCompletionBonusInput): RaceBonus | null {
  if (!input.tourPassed) return null;
  if (input.raceRewards.length === 0) return null;

  const total = input.raceRewards.reduce((acc, n) => acc + Math.max(0, n), 0);
  if (total <= 0) return null;

  const cashCredits = Math.round(total * TOUR_COMPLETION_BONUS_RATE);
  return {
    kind: "tourComplete",
    label: "Tour completion",
    cashCredits,
  };
}

// Sponsor objective bonus -------------------------------------------------

/**
 * Per-race telemetry bundle the sponsor evaluator reads. The race
 * session builds this once at finish time and passes it into
 * `sponsorBonus`. Fields beyond `RaceState` are surfaced here because the
 * sponsor predicates need them and the broader pipeline does not.
 *
 * - `playerTopSpeed`: race-best top speed in m/s for the player car.
 *   `0` when the runtime has no telemetry; the corresponding sponsor
 *   predicate will fail.
 * - `playerNitroFired`: true if the player fired nitro at least once.
 *   `null` when the runtime has no nitro telemetry; the sponsor
 *   predicate that needs it will silently fail.
 * - `weatherAtFinish`: the active weather option at race finish. `null`
 *   when no weather state machine is wired; the corresponding sponsor
 *   predicate will fail.
 */
export interface SponsorEvaluationContext {
  playerTopSpeed: number;
  playerNitroFired: boolean | null;
  weatherAtFinish: WeatherOption | null;
}

export interface SponsorBonusInput {
  finalState: FinalRaceState;
  playerCarId: string;
  damageBefore?: Readonly<DamageScalars>;
  damageAfter?: Readonly<DamageScalars>;
  context: SponsorEvaluationContext;
  /**
   * Active sponsor objective for the race, or `null` when no sponsor is
   * active. Modes that do not surface sponsors (Practice) pass `null`.
   */
  sponsor: SponsorObjective | null;
}

/**
 * Compute the §5 sponsor objective bonus as a `RaceBonus`. Returns
 * `null` when no sponsor is active, when the predicate fails, or when
 * the player DNF'd. Silent failure on predicate miss matches the dot's
 * edge case ("Sponsor objective failure: silent; no negative credits").
 */
export function sponsorBonus(input: SponsorBonusInput): RaceBonus | null {
  if (input.sponsor === null) return null;

  const playerRecord = input.finalState.finishingOrder.find(
    (r) => r.carId === input.playerCarId,
  );
  if (!playerRecord || playerRecord.status !== "finished") return null;

  const placement = input.finalState.finishingOrder.findIndex(
    (r) => r.carId === input.playerCarId,
  ) + 1;

  const passed = evaluateSponsorObjective({
    objective: input.sponsor,
    placement,
    damageBefore: input.damageBefore ?? ZERO_DAMAGE,
    damageAfter: input.damageAfter ?? ZERO_DAMAGE,
    context: input.context,
  });

  if (!passed) return null;

  return {
    kind: "sponsor",
    label: input.sponsor.sponsorName,
    cashCredits: input.sponsor.cashCredits,
  };
}

interface EvaluateSponsorObjectiveInput {
  objective: SponsorObjective;
  placement: number;
  damageBefore: Readonly<DamageScalars>;
  damageAfter: Readonly<DamageScalars>;
  context: SponsorEvaluationContext;
}

/**
 * Pure predicate evaluator for a sponsor objective. Exported for the
 * sponsors-content test (every shipped objective must be evaluable
 * without throwing). Unknown kinds return `false` so an out-of-date
 * runtime cannot accidentally credit a sponsor it does not understand.
 */
export function evaluateSponsorObjective(
  input: EvaluateSponsorObjectiveInput,
): boolean {
  const kind: SponsorObjectiveKind = input.objective.kind;

  switch (kind) {
    case "top_speed_at_least": {
      const target = input.objective.value ?? Number.POSITIVE_INFINITY;
      return input.context.playerTopSpeed >= target;
    }
    case "finish_at_or_above": {
      const target = input.objective.value ?? 0;
      return input.placement > 0 && input.placement <= target;
    }
    case "clean_race": {
      return isClean(input.damageBefore, input.damageAfter);
    }
    case "no_nitro": {
      // `null` (no telemetry) treated as "did fire" so the predicate
      // fails closed; the runtime must wire telemetry to award the bonus.
      if (input.context.playerNitroFired === null) return false;
      return input.context.playerNitroFired === false;
    }
    case "weather_finish_top_n": {
      const target = input.objective.value ?? 0;
      const weatherList = input.objective.weather ?? [];
      if (input.context.weatherAtFinish === null) return false;
      if (!weatherList.includes(input.context.weatherAtFinish)) return false;
      return input.placement > 0 && input.placement <= target;
    }
    default: {
      // Exhaustiveness sentinel; future SponsorObjectiveKind additions
      // surface here at compile time.
      const exhaustive: never = kind;
      void exhaustive;
      return false;
    }
  }
}

// Receipt helper ----------------------------------------------------------

/**
 * Sum the `cashCredits` of every bonus in a list. Convenience for callers
 * that want the total without iterating manually; `economy.awardCredits`
 * uses this internally so the wallet delta and the chip sum stay in
 * lockstep.
 */
export function sumBonusCredits(bonuses: ReadonlyArray<RaceBonus>): number {
  return bonuses.reduce((acc, b) => acc + Math.max(0, b.cashCredits), 0);
}

/**
 * Convenience pass-through used by the per-race bundle so the bonus
 * record on `RaceResult` and the bonus list passed into `awardCredits`
 * are guaranteed to be the same array. Mirrors the iter-19 stress-test
 * §4 receipt contract: one source for both the screen and the wallet.
 */
export function buildBonusReceipt(bonuses: ReadonlyArray<RaceBonus>): {
  bonuses: ReadonlyArray<RaceBonus>;
  total: number;
} {
  return { bonuses, total: sumBonusCredits(bonuses) };
}

// Re-export the default damage row for consumers that want a typed
// "no damage" baseline without re-defining the shape locally.
export { ZERO_DAMAGE };
