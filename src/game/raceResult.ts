/**
 * Race results builder per `docs/gdd/20-hud-and-ui-ux.md` "Results screen"
 * and `docs/gdd/07-race-rules-and-structure.md` "Qualification and
 * advancement" + "Finish rewards".
 *
 * This module owns the pure transform from a finished `FinalRaceState` (the
 * raw race outcome owned by `raceRules.ts`) and a `SaveGame` snapshot to a
 * `RaceResult` value the §20 results screen renders. No I/O, no globals,
 * no `Math.random` or `Date.now`. Inputs are never mutated.
 *
 * Boundary with sibling modules:
 *
 *   - `raceRules.ts` owns finishing order, lap times, fastest lap, and
 *     the FinalRaceState shape. `buildRaceResult` consumes it.
 *
 *   - `economy.ts` owns the per-place credit formula
 *     (`computeRaceReward`). `buildRaceResult` calls it once per car so
 *     the cash row on the results screen matches what `awardCredits`
 *     would credit on commit. The receipt-style breakdown surfaced here
 *     mirrors the iter-19 stress-test §5 split between "compute" and
 *     "commit": the page component is responsible for wiring
 *     `awardCredits` (or skipping it for non-economy modes like Quick
 *     Race / Practice / Time Trial) using the same numbers the player
 *     just saw on the results screen.
 *
 *   - `damage.ts` owns the per-zone damage scalar. The "damage taken"
 *     line on the results screen is derived from a caller-supplied
 *     before/after pair so the screen can show the delta, not just the
 *     post-race total.
 *
 *   - The §22 SaveGame schema owns `records[trackId].bestLapMs`. The
 *     builder reports a `recordsUpdated` patch when the player's
 *     fastest lap beats the prior best; the page component is
 *     responsible for merging the patch and calling `saveGame`. The
 *     module itself does not touch persistence.
 *
 * Bonus catalogue pinned by §5 ("Bonuses layer on top for: Podium,
 * Fastest lap, Clean race, Underdog finish, Tour completion, Sponsor
 * objective"). This slice ships the four bonuses the results screen
 * can compute from a single race (podium, fastest lap, clean race,
 * underdog). Tour-completion and sponsor bonuses are layered by other
 * surfaces (`tour-region-d9ca9a4d` and the post-MVP sponsor system) and
 * are intentionally out of scope here.
 *
 * Bonus values are pinned placeholders. §23 has no bonus column; the
 * balancing pass (`balancing-pass-71a57fd5`) will swap the constants
 * without rewriting call sites.
 */

import type { SaveGame, Track } from "@/data/schemas";

import { computeRaceReward, DNF_PARTICIPATION_CREDITS } from "./economy";
import type { FinalCarRecord, FinalRaceState } from "./raceRules";

/**
 * §7 "Top 8 finishers score points" pinned to a F1-style points table.
 * Index 0 unused; index N is the points awarded to the Nth finisher
 * (1-indexed). Places 9 and below score zero. Placeholder per the
 * iter-26 pin; balancing pass owns the final values.
 */
export const PLACEMENT_POINTS: ReadonlyArray<number> = Object.freeze([
  0, 25, 18, 15, 12, 10, 8, 6, 4,
]);

/** Per-track base reward fallback when the caller does not pass one. */
export const DEFAULT_BASE_TRACK_REWARD = 1000;

/** Cash bonus for finishing on the podium (1st, 2nd, or 3rd). */
export const PODIUM_BONUS_CREDITS = 250;

/** Cash bonus for setting the race's fastest lap. */
export const FASTEST_LAP_BONUS_CREDITS = 200;

/**
 * Cash bonus for finishing without taking damage (per-zone scalar all
 * zero). The §13 design pillar "damage is strategic, not fiddly" rewards
 * a clean race; the bonus is intentionally smaller than podium so it
 * stacks rather than dominates.
 */
export const CLEAN_RACE_BONUS_CREDITS = 150;

/**
 * Cash bonus for an "underdog finish": placing above the player's
 * pre-race grid position. The grid position is supplied by the caller
 * (the race session knows it from the §7 grid-rule). Bonus paid once
 * per race regardless of how many positions gained.
 */
export const UNDERDOG_BONUS_CREDITS = 200;

/**
 * Bonus identifier carried on every `RaceBonus` entry. The §20 results
 * screen renders these as chips. New bonuses extend this enum; the
 * results screen renders unknown bonus ids with their `label` field as
 * a fallback.
 */
export type RaceBonusKind =
  | "podium"
  | "fastestLap"
  | "cleanRace"
  | "underdog";

export interface RaceBonus {
  kind: RaceBonusKind;
  /** Human-readable label for the chip. English; no L10N in MVP per §20. */
  label: string;
  /** Cash awarded for this bonus, in credits. Always non-negative. */
  cashCredits: number;
}

/**
 * Per-zone damage delta surfaced on the results screen. Each scalar is
 * the post-race minus pre-race value clamped to `[0, 1]`. Absent fields
 * mean "no change" so the §20 damage bar can elide a zero row.
 */
export interface DamageDelta {
  engine: number;
  tires: number;
  body: number;
}

/** Card that previews the next race in the active tour, if any. */
export interface NextRaceCard {
  trackId: string;
  /** 1-indexed lap target on the next track. */
  laps: number;
}

/**
 * Records patch the page component is responsible for merging into the
 * save before calling `saveGame`. The mode (Practice, Time Trial, Quick
 * Race, Championship) decides whether to apply the patch; this module
 * only computes whether a PB was set.
 */
export interface RecordsUpdatePatch {
  trackId: string;
  /** New best lap in milliseconds. Always strictly less than the prior best. */
  bestLapMs: number;
}

/**
 * The shape consumed by `src/app/race/results/page.tsx`. Pure data; the
 * builder always returns a fresh value and never mutates its inputs.
 *
 * Field-by-field rationale:
 *
 *   - `finishingOrder`: cloned from `FinalRaceState.finishingOrder`. The
 *     page renders one row per car. Position is the array index + 1.
 *
 *   - `playerCarId`: convenience handle so the page can highlight the
 *     player row without re-deriving it from the save.
 *
 *   - `playerPlacement`: 1-indexed position of the player car in
 *     `finishingOrder`. `null` when the player is not present in the
 *     finishing order (defensive; should never happen at runtime).
 *
 *   - `pointsEarned`: from the §7 table. `0` for DNF and for places
 *     outside the top 8.
 *
 *   - `cashEarned`: total cash from the per-place formula plus all
 *     bonuses. Matches what `awardCredits` would credit if the page
 *     calls it.
 *
 *   - `cashBaseEarned`: the per-place portion of `cashEarned`; the
 *     §20 results screen renders this on a separate line so the player
 *     sees "Place cash" + bonuses chips that sum to the total.
 *
 *   - `bonuses`: ordered list of awarded bonuses. Empty when none apply.
 *
 *   - `damageTaken`: per-zone delta from pre-race to post-race. The §20
 *     "damage taken" line renders the largest delta with a one-line
 *     "Engine -12%" style label; the page can read all three for the
 *     full bar.
 *
 *   - `fastestLap`: cloned from `FinalRaceState.fastestLap`. The §20
 *     "fastest lap" line shows the carId, lap number, and time.
 *
 *   - `nextRace`: optional card describing the next race in the tour,
 *     or `null` when this was the final race / when not in a tour.
 *
 *   - `recordsUpdated`: optional patch the caller applies if the mode
 *     records PBs. `null` when no PB was set or when the player did not
 *     complete a single timed lap.
 */
export interface RaceResult {
  trackId: string;
  totalLaps: number;
  finishingOrder: ReadonlyArray<FinalCarRecord>;
  playerCarId: string;
  playerPlacement: number | null;
  pointsEarned: number;
  cashEarned: number;
  cashBaseEarned: number;
  bonuses: ReadonlyArray<RaceBonus>;
  damageTaken: DamageDelta;
  fastestLap: FinalRaceState["fastestLap"];
  nextRace: NextRaceCard | null;
  recordsUpdated: RecordsUpdatePatch | null;
}

/**
 * Inputs to `buildRaceResult`. The page component assembles these from
 * the race-finish wiring; the builder is intentionally side-effect-free
 * so unit tests can drive it with literal fixtures.
 *
 * `playerStartPosition` is the 1-indexed grid spot the player took in
 * the §7 starting grid. Required for the underdog bonus. Pass `null`
 * when the mode does not have a grid (Practice).
 *
 * `damageBefore` and `damageAfter` are the per-zone scalars from
 * `DamageState.zones`. Both default to all-zero so callers in modes
 * without damage tracking (Practice) can omit them.
 *
 * `recordPBs` controls whether the result reports a `recordsUpdated`
 * patch. Practice leaves PBs unchanged (per §6); other modes record.
 *
 * `track` is the source of `totalLaps` for sanity-checking and the
 * fallback for `baseTrackReward` if the caller does not supply one.
 *
 * `championship` and `tourId` together let the builder compute the
 * `nextRace` card. When either is absent, `nextRace` is `null`.
 *
 * `currentTrackIndex` is the 0-indexed position of the just-finished
 * track inside `tour.tracks`; the next-race card reads
 * `tour.tracks[currentTrackIndex + 1]`. When omitted the builder falls
 * back to looking up `track.id` inside the tour and adding 1.
 */
export interface BuildRaceResultInput {
  finalState: FinalRaceState;
  save: SaveGame;
  track: Track;
  playerCarId: string;
  playerStartPosition: number | null;
  damageBefore?: Readonly<DamageDelta>;
  damageAfter?: Readonly<DamageDelta>;
  baseTrackReward?: number;
  recordPBs: boolean;
  /** Difficulty key for the credit formula; defaults to the save's preset. */
  difficulty?: string;
  /** Championship currently in play, or null for non-tour modes. */
  championship?: { tours: ReadonlyArray<{ id: string; tracks: ReadonlyArray<string> }> };
  /** Tour id within the championship; required when `championship` is set. */
  tourId?: string;
  /** 0-indexed position of `track.id` inside the tour's tracks list. */
  currentTrackIndex?: number;
}

const ZERO_DAMAGE: DamageDelta = Object.freeze({ engine: 0, tires: 0, body: 0 });

/**
 * Build the `RaceResult` for a finished race. Pure: same inputs always
 * produce a deep-equal output across runs. Inputs are never mutated.
 *
 * Algorithm:
 *
 *   1. Find the player's finishing record (and 1-indexed placement) by
 *      `playerCarId`. DNF and out-of-finishing-order players surface as
 *      `playerPlacement = null`.
 *
 *   2. Compute `pointsEarned` from `PLACEMENT_POINTS`. DNF -> 0.
 *
 *   3. Compute `cashBaseEarned` via `computeRaceReward` so the results
 *      screen and `awardCredits` stay consistent.
 *
 *   4. Build the bonus list:
 *      - Podium: placement <= 3 and finished.
 *      - Fastest lap: player owns `fastestLap.carId`.
 *      - Clean race: every `damageAfter` zone equals `damageBefore` zone
 *        within an epsilon (default zero).
 *      - Underdog: placement < playerStartPosition (improved on grid).
 *
 *   5. Sum the bonuses into `cashEarned = cashBaseEarned + sum(bonuses)`.
 *
 *   6. Damage delta: per-zone clamp of `(after - before)` to `[0, 1]`.
 *
 *   7. Next race card: look up `tour.tracks[index + 1]` and the lap
 *      target from the matching Track JSON if available; `null` when
 *      this was the final race or the championship is absent.
 *
 *   8. Records patch: when `recordPBs` is true and the player set a
 *      lap faster than `save.records[track.id]?.bestLapMs`, emit a
 *      patch. The builder never inspects nor writes to localStorage.
 */
export function buildRaceResult(input: BuildRaceResultInput): RaceResult {
  const {
    finalState,
    save,
    track,
    playerCarId,
    playerStartPosition,
    damageBefore = ZERO_DAMAGE,
    damageAfter = ZERO_DAMAGE,
    baseTrackReward = DEFAULT_BASE_TRACK_REWARD,
    recordPBs,
    difficulty = save.settings.difficultyPreset ?? "normal",
    championship,
    tourId,
    currentTrackIndex,
  } = input;

  // 1. Find the player record + placement (1-indexed).
  const playerIndex = finalState.finishingOrder.findIndex(
    (r) => r.carId === playerCarId,
  );
  const playerRecord =
    playerIndex >= 0 ? (finalState.finishingOrder[playerIndex] ?? null) : null;
  const playerPlacement = playerIndex >= 0 ? playerIndex + 1 : null;

  // 2. Points (§7 top-8 ladder; DNF = 0).
  const pointsEarned = computePoints(playerRecord, playerPlacement);

  // 3. Cash from the per-place formula. DNF cars get participation cash;
  //    finished cars use the §12 finish-multiplier table via
  //    `computeRaceReward` so the results-screen number matches what
  //    `awardCredits` would credit on commit.
  const cashBaseEarned = playerRecord
    ? computeRaceReward({
        place: playerPlacement ?? 99,
        status: playerRecord.status,
        baseTrackReward,
        difficulty,
      })
    : DNF_PARTICIPATION_CREDITS;

  // 4. Bonuses.
  const bonuses = buildBonuses({
    playerRecord,
    playerPlacement,
    playerStartPosition,
    fastestLapCarId: finalState.fastestLap?.carId ?? null,
    damageBefore,
    damageAfter,
    playerCarId,
  });

  // 5. Sum.
  const bonusCash = bonuses.reduce((acc, b) => acc + b.cashCredits, 0);
  const cashEarned = cashBaseEarned + bonusCash;

  // 6. Damage delta (clamped per zone).
  const damageTaken: DamageDelta = {
    engine: clamp01(damageAfter.engine - damageBefore.engine),
    tires: clamp01(damageAfter.tires - damageBefore.tires),
    body: clamp01(damageAfter.body - damageBefore.body),
  };

  // 7. Next race card.
  const nextRace = computeNextRaceCard({
    championship,
    tourId,
    currentTrackId: track.id,
    currentTrackIndex,
  });

  // 8. Records patch.
  const recordsUpdated = recordPBs
    ? computeRecordsPatch({
        trackId: track.id,
        playerCarId,
        finalState,
        priorBestMs: save.records[track.id]?.bestLapMs ?? null,
      })
    : null;

  return {
    trackId: track.id,
    totalLaps: finalState.totalLaps,
    finishingOrder: finalState.finishingOrder.slice(),
    playerCarId,
    playerPlacement,
    pointsEarned,
    cashEarned,
    cashBaseEarned,
    bonuses,
    damageTaken,
    fastestLap: finalState.fastestLap,
    nextRace,
    recordsUpdated,
  };
}

function computePoints(
  record: FinalCarRecord | null,
  placement: number | null,
): number {
  if (!record || record.status !== "finished") return 0;
  if (placement === null || placement <= 0) return 0;
  if (placement >= PLACEMENT_POINTS.length) return 0;
  return PLACEMENT_POINTS[placement] ?? 0;
}

interface BuildBonusesInput {
  playerRecord: FinalCarRecord | null;
  playerPlacement: number | null;
  playerStartPosition: number | null;
  fastestLapCarId: string | null;
  damageBefore: Readonly<DamageDelta>;
  damageAfter: Readonly<DamageDelta>;
  playerCarId: string;
}

function buildBonuses(input: BuildBonusesInput): ReadonlyArray<RaceBonus> {
  const bonuses: RaceBonus[] = [];
  const finished = input.playerRecord?.status === "finished";

  // Podium: top 3 finishers only.
  if (
    finished &&
    input.playerPlacement !== null &&
    input.playerPlacement >= 1 &&
    input.playerPlacement <= 3
  ) {
    bonuses.push({
      kind: "podium",
      label: "Podium finish",
      cashCredits: PODIUM_BONUS_CREDITS,
    });
  }

  // Fastest lap: player car set the field's fastest lap.
  if (finished && input.fastestLapCarId === input.playerCarId) {
    bonuses.push({
      kind: "fastestLap",
      label: "Fastest lap",
      cashCredits: FASTEST_LAP_BONUS_CREDITS,
    });
  }

  // Clean race: no damage delta in any zone (epsilon-tight; a fully
  // pristine post-race compares against a fully pristine pre-race).
  if (
    finished &&
    isClean(input.damageBefore, input.damageAfter)
  ) {
    bonuses.push({
      kind: "cleanRace",
      label: "Clean race",
      cashCredits: CLEAN_RACE_BONUS_CREDITS,
    });
  }

  // Underdog: improved on grid position. Requires a valid start
  // position (Practice / Time Trial pass null).
  if (
    finished &&
    input.playerPlacement !== null &&
    input.playerStartPosition !== null &&
    input.playerStartPosition > 0 &&
    input.playerPlacement < input.playerStartPosition
  ) {
    bonuses.push({
      kind: "underdog",
      label: "Underdog finish",
      cashCredits: UNDERDOG_BONUS_CREDITS,
    });
  }

  return bonuses;
}

function isClean(
  before: Readonly<DamageDelta>,
  after: Readonly<DamageDelta>,
): boolean {
  // Tight equality; any positive delta breaks the bonus. The §13 design
  // intent ("rubs and brushes do count") favours strict accounting.
  return (
    after.engine <= before.engine + EPSILON &&
    after.tires <= before.tires + EPSILON &&
    after.body <= before.body + EPSILON
  );
}

const EPSILON = 1e-6;

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

interface NextRaceCardInput {
  championship?: { tours: ReadonlyArray<{ id: string; tracks: ReadonlyArray<string> }> };
  tourId?: string;
  currentTrackId: string;
  currentTrackIndex?: number;
}

function computeNextRaceCard(input: NextRaceCardInput): NextRaceCard | null {
  if (!input.championship || !input.tourId) return null;

  const tour = input.championship.tours.find((t) => t.id === input.tourId);
  if (!tour) return null;

  const idx =
    input.currentTrackIndex !== undefined
      ? input.currentTrackIndex
      : tour.tracks.findIndex((id) => id === input.currentTrackId);
  if (idx < 0) return null;

  const nextId = tour.tracks[idx + 1];
  if (!nextId) return null;

  // Lap count derivation requires a Track lookup. The page supplies the
  // championship object only; loading the next Track is a downstream
  // concern. Pin a sensible default of 3 laps (the §7 "Standard
  // circuit" target) so the card has a value to render even before the
  // page resolves the Track JSON. Page can override if it has the data.
  return { trackId: nextId, laps: 3 };
}

interface RecordsPatchInput {
  trackId: string;
  playerCarId: string;
  finalState: FinalRaceState;
  priorBestMs: number | null;
}

function computeRecordsPatch(input: RecordsPatchInput): RecordsUpdatePatch | null {
  const lapTimes = input.finalState.perLapTimes[input.playerCarId] ?? [];
  if (lapTimes.length === 0) return null;

  // Smallest of the player's completed lap times.
  let best: number | null = null;
  for (const ms of lapTimes) {
    if (!Number.isFinite(ms) || ms <= 0) continue;
    if (best === null || ms < best) best = ms;
  }
  if (best === null) return null;

  if (input.priorBestMs !== null && best >= input.priorBestMs) {
    return null;
  }

  return { trackId: input.trackId, bestLapMs: best };
}
