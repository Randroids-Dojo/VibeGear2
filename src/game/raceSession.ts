/**
 * Race session: pure glue between input, physics, AI, and race lifecycle.
 *
 * Phase 1 vertical slice integration per `docs/IMPLEMENTATION_PLAN.md` §3 and
 * the dot stress-test pinned in
 * `VibeGear2-implement-phase-1-7aef013d`. Owns nothing rendering-related and
 * never touches `requestAnimationFrame`. The `/race` page wires `step` into
 * `startLoop({ simulate, render })` so determinism boundaries stay clean per
 * AGENTS.md RULE 8.
 *
 * Two entry points:
 *
 *   createRaceSession(config) -> RaceSessionState
 *   stepRaceSession(state, playerInput, config, dt) -> RaceSessionState
 *
 * Both pure. `stepRaceSession` returns a fresh state every call (immutable
 * shape) so future ghost / replay slices can record snapshots without
 * worrying about aliasing. The `tick` field on the returned state increments
 * once per simulation step and resets to zero when the lights go green so
 * lap timing starts at the green light, not at session creation.
 *
 * Lifecycle:
 *   countdown -> racing -> finished
 *
 * Lap completion is the integer floor of `player.car.z / track.totalLengthMeters`.
 * On increment we record the lap time (sim-tick-based, FIXED_STEP based on dt
 * supplied by the loop) and bump `race.lap`. When `lap > totalLaps` we flip
 * to `"finished"` and stop integrating physics. Damage / DNF / sector splits
 * are owned by the §7 race-rules slice; this slice ships only the happy path.
 */

import type {
  AIDriver,
  CarBaseStats,
  HazardRegistryEntry,
  PlayerDifficultyPreset,
  TransmissionModePersisted,
  UpgradeCategory,
  WeatherOption,
} from "@/data/schemas";
import { SEGMENT_LENGTH } from "@/road/constants";
import { upcomingCurvature } from "@/road/segmentProjector";
import type { CompiledSegmentBuffer } from "@/road/trackCompiler";
import type { CompiledTrack } from "@/road/types";

import {
  DEFAULT_AI_TRACK_CONTEXT,
  INITIAL_AI_STATE,
  tickAI,
  type AIState,
  type AITrackContext,
} from "./ai";
import {
  resolveCpuModifiers,
  type CpuDifficultyModifiers,
} from "./aiDifficulty";
import {
  applyAssists,
  INITIAL_ASSIST_MEMORY,
  type AssistBadge,
  type AssistMemory,
  type AssistSettingsRuntime,
} from "./assists";
import {
  applyHit,
  applyOffRoadDamage,
  HIT_MAGNITUDE_RANGES,
  isWrecked,
  PRISTINE_DAMAGE_STATE,
  type DamageState,
  type HitEvent,
  type HitKind,
} from "./damage";
import { getDamageBand, getDamageScalars } from "./damageBands";
import type { DamageScalars } from "./damageBands";
import {
  resolvePresetScalars,
  type AssistScalars,
} from "./difficultyPresets";
import {
  computeWakeOffset,
  INITIAL_DRAFT_WINDOW,
  tickDraftWindow,
  type DraftCarSnapshot,
  type DraftWindowState,
} from "./drafting";
import { evaluateHazards } from "./hazards";
import { NEUTRAL_INPUT, type Input } from "./input";
import {
  createNitroForCar,
  getNitroAccelMultiplier,
  tickNitro,
  type NitroState,
} from "./nitro";
import { createRng, deserializeRng, serializeRng, splitRng } from "./rng";
import {
  createTransmissionForCar,
  gearAccelMultiplier,
  maxGearForUpgrades,
  tickTransmission,
  type TransmissionState,
} from "./transmission";
import {
  activeWeatherForState,
  createWeatherState,
  stepWeatherState,
  weatherVisibilityRiskScalar,
  weatherGripScalarForState,
  weatherSkillFor,
  type TireKind,
  type WeatherState,
} from "./weather";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  isOffRoad,
  step,
  type CarState,
  type TrackContext,
} from "./physics";
import { EMPTY_PASSED_SET } from "./raceCheckpoints";
import {
  exceedsRaceTimeLimit,
  INITIAL_DNF_TIMERS,
  tickDnfTimers,
  type DnfReason,
  type DnfTimers,
} from "./raceRules";
import {
  DEFAULT_COUNTDOWN_SEC,
  type RaceState,
} from "./raceState";
import {
  createSectorState,
  splitsForLap,
  tickSectorTimer,
  type SectorState,
} from "./sectorTimer";

/** Per-car upgrade table the session pulls upgrade tiers from. */
export type CarUpgradeTiers = Partial<Record<UpgradeCategory, number>>;

export interface RaceSessionPlayer {
  stats: Readonly<CarBaseStats>;
  initial?: Partial<CarState>;
  /**
   * Installed upgrade tiers for the player's car. Read at session creation
   * to seed per-car race state (currently the §10 nitro charge count via
   * `createNitroForCar`). Defaults to no upgrades (all tier 0) so existing
   * callers keep their stock-car behaviour.
   */
  upgrades?: Readonly<CarUpgradeTiers> | null;
  /**
   * Player-facing transmission mode from `SaveGameSettings.transmissionMode`.
   * Defaults to `"auto"` per the §10 default (and to match the way legacy
   * v1 saves load with the field absent). Manual mode opts the player into
   * the §19 E / Q (RB / LB) sequential shift inputs in exchange for the
   * §10 small-but-not-dominant expert-advantage torque bump at the
   * optimal shift point.
   */
  transmissionMode?: TransmissionModePersisted | null;
  /**
   * Snapshot of the §19 accessibility assists copied from
   * `SaveGameSettings.assists`. The session reads each tick, runs the
   * resolved input through `applyAssists`, and threads `AssistMemory`
   * across ticks. Optional / partial so callers (and v1 saves loaded
   * pre-assists) can omit it; `applyAssists` treats every missing flag
   * as `false`. Mid-race toggles are not supported by the runtime, so
   * the value is sampled once via the config reference held by
   * `stepRaceSession` rather than a per-tick parameter.
   */
  assists?: Readonly<AssistSettingsRuntime> | null;
  /**
   * Player-facing difficulty preset id from
   * `SaveGameSettings.difficultyPreset`. Resolved once at session
   * creation via `resolvePresetScalars`; the cached
   * `AssistScalars` reference is forwarded into every per-tick
   * `step` / damage / nitro call so an Easy preset bites less and a
   * Master preset bites more without per-tick allocation. Defaults
   * to the Balanced (`normal`) row when omitted, which matches the
   * §28 default and the v1 save migration target. Mid-race changes
   * to the preset are not supported by the runtime; pause -> exit
   * to title -> options -> resume to apply a new preset.
   */
  difficultyPreset?: PlayerDifficultyPreset | null;
  /**
   * Persisted active-car damage loaded from the garage repair queue at
   * race start. Defaults to pristine for fresh saves and non-economy
   * sessions.
   */
  initialDamage?: Readonly<DamageState> | null;
}

export interface RaceSessionAI {
  driver: Readonly<AIDriver>;
  stats: Readonly<CarBaseStats>;
  initial?: Partial<CarState>;
  /**
   * PRNG seed for the AI. Defaults derive from grid index so each AI on the
   * grid gets a decorrelated stream when later archetypes consume RNG. The
   * clean_line slice ignores this; it remains in the contract so future
   * archetypes do not need a config-shape change.
   */
  seed?: number;
  /**
   * Installed upgrade tiers for this AI's car. Read at session creation to
   * seed per-car race state (currently the §10 nitro charge count). The
   * clean_line AI never fires nitro in the current slice, but the state is
   * still seeded uniformly with the player so future archetypes can drain
   * charges without a config-shape change. Defaults to no upgrades.
   */
  upgrades?: Readonly<CarUpgradeTiers> | null;
}

export interface RaceSessionImpactAudioEvent {
  readonly kind: "impact";
  readonly carId: string;
  readonly hitKind: HitKind;
  readonly speedFactor: number;
}

export type RaceSessionAudioEvent = RaceSessionImpactAudioEvent;

export interface RaceSessionConfig {
  /** Compiled track to drive on. Frozen output of `compileTrack`. */
  track: CompiledTrack;
  /** Optional physics + AI track context. Defaults derive from `ROAD_WIDTH`. */
  trackContext?: TrackContext;
  aiContext?: AITrackContext;
  player: RaceSessionPlayer;
  ai: ReadonlyArray<RaceSessionAI>;
  /** Optional hazard registry keyed by `TrackSegment.hazards` ids. */
  hazardsById?: ReadonlyMap<string, Readonly<HazardRegistryEntry>>;
  /**
   * Total laps. Defaults to `track.laps` so the data file owns the lap count
   * unless the run mode (e.g. quick-race) overrides it.
   */
  totalLaps?: number;
  /**
   * Lights-out countdown in seconds. Defaults to `DEFAULT_COUNTDOWN_SEC`.
   * Practice / quick-race may pass 0 for an instant start.
   */
  countdownSec?: number;
  /**
   * RNG seed for AI mistakes / shake / spawning. Pinned by the §22 schema.
   * The clean_line slice does not consume this; it is held so future
   * randomised systems start identically across runs.
   */
  seed?: number;
  /**
   * Initial weather option for the session, read by the §19 accessibility
   * assist pipeline (`AssistContext.weather`) so visual-only-weather
   * mode can flag the runtime. Defaults to the first entry in
   * `track.weatherOptions` when the host does not pin one.
   */
  weather?: WeatherOption;
  /**
   * Optional §14 weather-state-machine knobs. The default change chance
   * is 0 so existing races keep a fixed forecast unless a caller opts
   * into mid-race transitions.
   */
  weatherTransitions?: {
    readonly changeChancePerSecond?: number;
    readonly transitionSeconds?: number;
  };
  /**
   * Active player tire channel chosen in the pre-race surface. Defaults
   * to dry so existing direct race links preserve their old behavior.
   * AI cars keep dry tires until an AI setup-selection slice lands.
   */
  playerTire?: TireKind;
}

/**
 * Per-AI mutable view, paired with the AI controller's logical state, the
 * kinematic state the physics step consumes, and the §10 nitro reducer's
 * per-car snapshot. `lastNitroPressed` mirrors the prior tick's input so
 * `tickNitro` can detect a rising edge (a fresh tap vs a held press).
 */
export interface RaceSessionAICar {
  car: CarState;
  state: AIState;
  nitro: NitroState;
  lastNitroPressed: boolean;
  /**
   * Per-car transmission snapshot. AI cars are pinned to `"auto"` because
   * no AI archetype today opts into manual; the field exists on the AI
   * shape for parity with the player so the per-tick reducer code path
   * is identical.
   */
  transmission: TransmissionState;
  /**
   * Edge-detection mirror of the prior tick's `shiftUp` input. AI inputs
   * never raise these (the `clean_line` controller does not emit shift
   * inputs), so the field stays `false` in current builds. Held here so
   * a future shift-aware AI can flip it without a state-shape change.
   */
  lastShiftUpPressed: boolean;
  /** Edge-detection mirror of the prior tick's `shiftDown` input. */
  lastShiftDownPressed: boolean;
  /**
   * Per-car race lifecycle status. Initialised to `"racing"` and flipped
   * by the §7 race-rules wiring once this AI either crosses the final
   * start/finish line (`"finished"`) or trips a DNF threshold
   * (`"dnf"`). A non-racing AI is no longer integrated by the physics
   * step (`step` is skipped, the `car` snapshot is preserved as-is) so a
   * retired AI freezes in place.
   */
  status: RaceCarStatus;
  /**
   * Per-car DNF accumulators (off-track / no-progress windows + last
   * progress mark). Advanced each racing tick by `tickDnfTimers` from
   * the post-step car snapshot. Frozen at the moment the car flips to
   * `"finished"` or `"dnf"` (the tick reducer never advances a non-
   * racing car), so a downstream snapshot can read them safely.
   */
  dnfTimers: DnfTimers;
  /**
   * Reason this car flipped to `"dnf"`, or `null` while the car is
   * still racing or once it has finished cleanly. Mirrors the value
   * returned by `tickDnfTimers` on the trip tick; the §20 results
   * screen renders the string verbatim.
   */
  dnfReason: DnfReason;
  /**
   * 1-indexed current lap. Mirrors the meaning of `RaceState.lap` for
   * the player but lives per-car so multi-AI grids can each track their
   * own lap progress and the §7 finishing-order builder can split the
   * field by `lap` plus `finishedAtMs`. Increments on lap rollover
   * (the same `Math.floor(car.z / trackLength)` reducer the player
   * uses), clamped to `totalLaps`.
   */
  lap: number;
  /**
   * Completed lap times in milliseconds, in lap order. The first entry
   * is lap 1's time; the last entry is the most recently completed
   * lap. Length is `lap - 1` while racing, exactly `totalLaps` for a
   * `"finished"` car. The §7 final-state builder
   * (`buildFinalRaceState`) reads this to derive per-car `bestLapMs`
   * and the field's fastest lap.
   */
  lapTimes: ReadonlyArray<number>;
  /**
   * Sim-time-in-ms at which this AI crossed the final start/finish
   * line, or `null` for cars that have not yet finished (still racing
   * or DNF). The §7 finishing-order builder sorts the `"finished"`
   * partition by ascending `finishedAtMs` so a multi-AI grid resolves
   * its podium deterministically.
   */
  finishedAtMs: number | null;
  /**
   * §13 per-car damage accumulator. Initialised to
   * `PRISTINE_DAMAGE_STATE` at session creation; advanced each racing
   * tick by `applyOffRoadDamage` (when off-road) and by `applyHit` on
   * vehicle-on-vehicle contact. A car that crosses
   * `WRECK_THRESHOLD` flips to `status: "dnf"` with `dnfReason:
   * "wrecked"` and freezes its physics from that tick onward, mirroring
   * the §7 off-track / no-progress paths. Pinned per F-047.
   */
  damage: DamageState;
}

/**
 * Per-player runtime snapshot. `nitro` carries the §10 nitro reducer's
 * state; `lastNitroPressed` mirrors the prior tick's input so `tickNitro`
 * can detect a fresh tap vs a held press across ticks.
 *
 * `transmission` carries the §10 gear-and-RPM snapshot; the per-tick
 * reducer reads `lastShiftUpPressed` / `lastShiftDownPressed` to detect
 * the rising edge of a shift-button press in manual mode so a single
 * tap consumes one shift instead of cascading across every held tick.
 */
export interface RaceSessionPlayerCar {
  car: CarState;
  nitro: NitroState;
  lastNitroPressed: boolean;
  transmission: TransmissionState;
  /**
   * Edge-detection mirror of the prior tick's `shiftUp` input. The
   * raceSession converts a held button into a single per-press shift by
   * passing `shiftUp && !lastShiftUpPressed` into the transmission
   * reducer. Auto mode ignores the value (its reducer branch never
   * reads `shiftUp` / `shiftDown`), but the field is updated uniformly
   * so a mid-race mode toggle would behave correctly.
   */
  lastShiftUpPressed: boolean;
  /** Edge-detection mirror of the prior tick's `shiftDown` input. */
  lastShiftDownPressed: boolean;
  /**
   * Per-session §19 accessibility assist memory, threaded across ticks
   * by `applyAssists`. Initialised at session creation to
   * `INITIAL_ASSIST_MEMORY` and reset back to it the same tick the
   * lights go green so a paused-during-countdown player always starts
   * the race with a clean smoothing buffer / latched-toggle / reduced-
   * input winner.
   */
  assistMemory: AssistMemory;
  /**
   * Snapshot of the most recent assist badge for the §20 HUD. Populated
   * even on idle ticks so the HUD layer never sees a stale `undefined`
   * after the player toggled an assist mid-pause; the badge mirror
   * always reflects the current settings regardless of whether the
   * player produced any input that tick. `null` only on the
   * pre-physics initial snapshot, before the first call to
   * `applyAssists` has run; consumers that need a default before the
   * first tick can read the producer's badge for an empty
   * `AssistSettingsRuntime` value.
   */
  assistBadge: AssistBadge | null;
  /**
   * §19 visual-only-weather flag the player asked for via assists,
   * surfaced through the session so the future weather grip multiplier
   * can read it from the same snapshot. The current physics layer does
   * not yet consume this; the field exists as a producer-side hook so
   * the weather slice (`VibeGear2-implement-weather-38d61fc2`) can
   * flip its grip path without touching the assists pipeline.
   * TODO(F-026/weather): wire into the weather grip multiplier in
   * `physics.ts` once the §14 weather module lands.
   */
  weatherVisualReductionActive: boolean;
  /**
   * Per-car race lifecycle status mirroring `RaceSessionAICar.status`
   * for shape parity. `RaceState.phase` already carries the player's
   * race-wide gating signal (`countdown` / `racing` / `finished`); this
   * field adds the per-car DNF case (`"dnf"`) so the player can be
   * frozen in place mid-race when the §7 off-track or no-progress
   * windows trip. The race phase only flips to `"finished"` once the
   * player either completes the final lap, the hard race time limit
   * trips, or every car has stopped racing.
   */
  status: RaceCarStatus;
  /** §7 DNF accumulators for the player car. See `RaceSessionAICar.dnfTimers`. */
  dnfTimers: DnfTimers;
  /** §7 DNF reason for the player car. See `RaceSessionAICar.dnfReason`. */
  dnfReason: DnfReason;
  /**
   * Per-car completed lap times in milliseconds. Mirrors
   * `RaceState.lastLapTimeMs` / `bestLapTimeMs` (which remain the
   * canonical HUD-facing surface for the player) but laid out as the
   * per-car array the §7 final-state builder consumes. Each entry is
   * the elapsed-since-start ms at which that lap was completed, minus
   * the prior entry (so the array is per-lap durations, not cumulative
   * times). Length is `race.lap - 1` while racing, `totalLaps` for a
   * `"finished"` player.
   */
  lapTimes: ReadonlyArray<number>;
  /**
   * Sim-time-in-ms at which the player crossed the final start/finish
   * line, or `null` while still racing or DNF. Powers the §7 final-
   * state builder's per-car `raceTimeMs` field.
   */
  finishedAtMs: number | null;
  /**
   * §13 per-car damage accumulator. See `RaceSessionAICar.damage` for
   * the semantics; the player path mirrors the AI path so the §13
   * model treats every car uniformly. A wrecked player flips to
   * `status: "dnf"` with `dnfReason: "wrecked"` and freezes; the
   * race-phase finish gate then collapses to `"finished"` once every
   * car has stopped (existing all-stopped branch). Pinned per F-047.
   */
  damage: DamageState;
}

/**
 * Per-car race-lifecycle status.
 *
 *   - `racing`: the car is still on track and integrated each tick.
 *   - `finished`: the car has crossed the final start/finish line.
 *     Physics integration stops; the car snapshot freezes at the post-
 *     finish position so the standings strip and the §20 results screen
 *     can render the same value across the rest of the race.
 *   - `dnf`: the car tripped one of the §7 DNF thresholds (off-track
 *     timeout, no-progress timeout) and retires. Physics integration
 *     stops the same tick the threshold trips so a DNF'd AI freezes
 *     where it sat rather than continuing to roll.
 *
 * Pinned per the iter-19 stress-test on
 * `VibeGear2-implement-race-rules-b30656ae` (the `CarRankSnapshot.status`
 * partition is the same set of strings) so the §7 ranking helper and
 * the per-car runtime field share one vocabulary.
 */
export type RaceCarStatus = "racing" | "finished" | "dnf";

export interface RaceSessionState {
  race: RaceState;
  player: RaceSessionPlayerCar;
  ai: ReadonlyArray<RaceSessionAICar>;
  /**
   * Frame counter. Increments once per simulation step. Resets to 0 the
   * tick the lights go green so a downstream ghost replay can record from
   * the same origin as the lap timer. Pre-countdown ticks count up so the
   * countdown timer reads the same monotonic clock as the rest of the sim.
   */
  tick: number;
  /**
   * Per-tick sector timer for the player. Initialised at session creation
   * from `track.checkpoints`; advanced by `tickSectorTimer` each racing tick
   * and reset on lap rollover. Drives the §20 ghost-delta widget; pure on
   * the runtime side so headless tests can replay it.
   */
  sectorTimer: SectorState;
  /**
   * Splits from the most recently completed lap, in cumulative ms from the
   * lap start. Used as the §20 widget's baseline when no persisted
   * `bestSplitsMs` is available. `null` until the player has finished a
   * full lap with all sectors closed; this is what makes the first-lap
   * delta read `null` until a baseline exists.
   */
  baselineSplitsMs: readonly number[] | null;
  /**
   * Per-pair drafting windows keyed by `<followerId>>>><leaderId>` (see
   * `draftPairKey`). Each pair's `DraftWindowState` accumulates only when
   * that follower picks that leader as its current draft target. Switching
   * leaders preserves the prior pair's window in the map, but the follower
   * stops advancing it (it just sits there inert) until the same pair is
   * picked again by the per-tick scan. Multiple pairs in the field are
   * fully isolated from each other so two parallel tandems do not
   * cross-contaminate, which is what the §10 dot's "pair-isolation"
   * verify item calls for.
   *
   * Stored as a plain object rather than a `Map` so the immutable spread
   * pattern the rest of the session uses applies uniformly. The key set
   * is bounded by `(1 + ai.length) * ai.length` (each car can follow each
   * other car), which is small even for a full 12-car grid.
   */
  draftWindows: Readonly<Record<string, DraftWindowState>>;
  /** Breakable track hazards consumed during this race, keyed by segment and id. */
  brokenHazards: ReadonlyArray<string>;
  /** §14 weather runtime state, constrained to this track's authored options. */
  weather: WeatherState;
  /** Serialized deterministic PRNG state reserved for weather transitions. */
  weatherRngState: number;
  /**
   * Transient per-tick audio cues emitted by the pure race reducer. The
   * runtime may play them once per tick, but replays and tests can ignore
   * them without affecting physics determinism.
   */
  audioEvents: ReadonlyArray<RaceSessionAudioEvent>;
}

/**
 * Default initial AI offset. The dot stress-test §4 pins single AI grid
 * placement at "5 m behind the player, same lateral offset 0". Arrays of
 * AI cars stack each one a further `AI_GRID_SPACING_M` behind so a tiny
 * test field with two AIs still places them deterministically; the full
 * grid pattern (slot, row, stagger) is owned by `implement-ai-grid`.
 */
export const AI_GRID_OFFSET_BEHIND_PLAYER_M = 5;
export const AI_GRID_SPACING_M = 5;

/**
 * §13 vehicle-on-vehicle collision geometry. Pinned per F-047 as the
 * simplest deterministic gate: two cars are considered to be in contact
 * this tick when their longitudinal gap is below `CAR_LENGTH_M` and
 * their lateral offset is below `CAR_WIDTH_M`. Numbers approximate a
 * compact race car (about 4 m long, 1.8 m wide) so a follower closing
 * inside one car-length on the same lane registers as a hit. The full
 * §13 narrative ("hit detection occurs when bounding boxes overlap")
 * does not pin numeric dimensions; these are placeholder values that
 * a balancing pass can revise without touching call sites.
 */
export const CAR_LENGTH_M = 4;
export const CAR_WIDTH_M = 1.8;

/**
 * Reference top speed (m/s) used to normalise the §13 `speedFactor`
 * input to `applyHit`. Picked to match the `STARTER_STATS.topSpeed`
 * value the test harness uses (~61 m/s); a same-tier collision at the
 * starter top speed therefore reads `speedFactor ~= 1.0` and a pair of
 * crawling cars reads `speedFactor ~= 0`. Not pulled from any car's
 * `CarBaseStats.topSpeed` so the field-wide damage scale stays
 * deterministic when cars of mixed tiers race side-by-side.
 */
export const COLLISION_REFERENCE_TOP_SPEED_M_PER_S = 60;

/**
 * §13 deterministic `baseMagnitude` for a car-on-car contact event.
 * Picked as the midpoint of the §23 `HIT_MAGNITUDE_RANGES.carHit`
 * band (`6..12`) so the wiring is reproducible without consuming the
 * seeded RNG. The `splitRng(raceRng, "collision")` pick is filed as
 * F-024 / future damage-RNG work; once that lands the constant
 * collapses to a default and the per-event roll picks from the
 * `[min, max]` band instead. Keeping a single canonical magnitude
 * here means the existing damage / band tests do not have to grow a
 * mock RNG to cover the wiring.
 */
export const COLLISION_CAR_HIT_BASE_MAGNITUDE =
  (HIT_MAGNITUDE_RANGES.carHit.min + HIT_MAGNITUDE_RANGES.carHit.max) / 2;

const DEFAULT_RACE_SESSION_SEED = 1;

/**
 * True iff the two car snapshots are within the §13 contact box
 * (`|dz| < CAR_LENGTH_M && |dx| < CAR_WIDTH_M`). Pure: no allocation,
 * no globals. Symmetric in its arguments so the per-tick pair scan
 * only needs to evaluate the ordered pair once.
 */
export function carsInContact(a: Readonly<CarState>, b: Readonly<CarState>): boolean {
  return (
    Math.abs(a.z - b.z) < CAR_LENGTH_M && Math.abs(a.x - b.x) < CAR_WIDTH_M
  );
}

/**
 * Build a single car-on-car `HitEvent` for the §13 contact between two
 * cars. The §23 magnitude is the pinned `COLLISION_CAR_HIT_BASE_MAGNITUDE`
 * midpoint; `speedFactor` is the average of the two cars' speeds
 * normalised by `COLLISION_REFERENCE_TOP_SPEED_M_PER_S` and clamped to
 * `[0, 1]` inside `applyHit`. The same event applies to both cars in
 * the pair (a head-on bump damages both bumpers); per-car nitro and
 * difficulty scalars are layered on at the `applyHit` call site.
 */
export function buildCarHitEvent(
  a: Readonly<CarState>,
  b: Readonly<CarState>,
): HitEvent {
  const avgSpeed = (a.speed + b.speed) / 2;
  return {
    kind: "carHit" satisfies HitKind,
    baseMagnitude: COLLISION_CAR_HIT_BASE_MAGNITUDE,
    speedFactor: avgSpeed / COLLISION_REFERENCE_TOP_SPEED_M_PER_S,
  };
}

/**
 * Build a fresh session. Does not allocate any references that escape the
 * function (the `ai` array is constructed locally, not the one passed in,
 * so callers cannot mutate the session by mutating their input).
 *
 * Throws when:
 * - `totalLaps` is non-positive or non-integer (defends against bad config).
 * - `countdownSec` is negative or non-finite.
 */
export function createRaceSession(config: RaceSessionConfig): RaceSessionState {
  const totalLaps = config.totalLaps ?? config.track.laps;
  if (!Number.isInteger(totalLaps) || totalLaps < 1) {
    throw new RangeError(`totalLaps must be a positive integer, got ${totalLaps}`);
  }
  const countdownSec = config.countdownSec ?? DEFAULT_COUNTDOWN_SEC;
  if (!Number.isFinite(countdownSec) || countdownSec < 0) {
    throw new RangeError(
      `countdownSec must be a non-negative finite number, got ${countdownSec}`,
    );
  }

  const player: RaceSessionPlayerCar = {
    car: { ...INITIAL_CAR_STATE, ...(config.player.initial ?? {}) },
    nitro: createNitroForCar(config.player.stats, config.player.upgrades ?? null),
    lastNitroPressed: false,
    transmission: createTransmissionForCar(config.player.stats, {
      mode: config.player.transmissionMode ?? "auto",
      upgrades: config.player.upgrades ?? null,
    }),
    lastShiftUpPressed: false,
    lastShiftDownPressed: false,
    assistMemory: { ...INITIAL_ASSIST_MEMORY },
    assistBadge: null,
    weatherVisualReductionActive:
      (config.player.assists?.weatherVisualReduction ?? false) === true,
    status: "racing",
    dnfTimers: { ...INITIAL_DNF_TIMERS },
    dnfReason: null,
    lapTimes: [],
    finishedAtMs: null,
    damage: config.player.initialDamage ?? PRISTINE_DAMAGE_STATE,
  };

  const raceSeed = config.seed ?? DEFAULT_RACE_SESSION_SEED;
  const ai: RaceSessionAICar[] = config.ai.map((entry, index) => {
    const seed = entry.seed ?? seedForAiIndex(raceSeed, index);
    const initialZ =
      -(AI_GRID_OFFSET_BEHIND_PLAYER_M + index * AI_GRID_SPACING_M);
    return {
      car: {
        ...INITIAL_CAR_STATE,
        z: initialZ,
        ...(entry.initial ?? {}),
      },
      state: { ...INITIAL_AI_STATE, seed },
      nitro: createNitroForCar(entry.stats, entry.upgrades ?? null),
      lastNitroPressed: false,
      transmission: createTransmissionForCar(entry.stats, {
        mode: "auto",
        upgrades: entry.upgrades ?? null,
      }),
      lastShiftUpPressed: false,
      lastShiftDownPressed: false,
      status: "racing",
      dnfTimers: { ...INITIAL_DNF_TIMERS },
      dnfReason: null,
      lap: 1,
      lapTimes: [],
      finishedAtMs: null,
      damage: PRISTINE_DAMAGE_STATE,
    };
  });

  const race: RaceState = {
    phase: countdownSec > 0 ? "countdown" : "racing",
    elapsed: 0,
    lap: 1,
    totalLaps,
    countdownRemainingSec: countdownSec,
    lastLapTimeMs: null,
    bestLapTimeMs: null,
    lastCheckpoint: null,
    passedCheckpointsThisLap: EMPTY_PASSED_SET,
  };

  const sectorTimer = createSectorState(config.track.checkpoints);
  const initialWeather = config.weather ?? config.track.weatherOptions[0] ?? "clear";
  const weather = createWeatherState(initialWeather, config.track.weatherOptions);
  const weatherRng = splitRng(createRng(raceSeed), "weather");

  return {
    race,
    player,
    ai,
    tick: 0,
    sectorTimer,
    baselineSplitsMs: null,
    draftWindows: {},
    brokenHazards: [],
    weather,
    weatherRngState: serializeRng(weatherRng),
    audioEvents: [],
  };
}

/**
 * Stable identifier for a car in the session. The player is always
 * `"player"`; AI grid slots are `"ai-<index>"` matching their order in
 * `RaceSessionConfig.ai`. These IDs key into `draftWindows` so a future
 * slice that adds car-pickers / car-name HUD does not need to touch this
 * mapping.
 */
export const PLAYER_CAR_ID = "player";
export function aiCarId(index: number): string {
  return `ai-${index}`;
}

/**
 * Compose the per-pair draft window key. Stable string form so a
 * spread-update on the `draftWindows` record stays cheap. The separator
 * is a sequence that no `aiCarId` / `PLAYER_CAR_ID` can contain so a
 * collision is structurally impossible.
 */
export function draftPairKey(followerId: string, leaderId: string): string {
  return `${followerId}>>><${leaderId}`;
}

/**
 * Local snapshot of every car in the field for the per-tick draft scan.
 * `progress` collapses lap + lap-local z so a leader on the next lap
 * still sits ahead of a follower on the current lap, matching the
 * `totalProgress` ranking helper exported below.
 */
interface DraftScanEntry {
  id: string;
  car: Readonly<CarState>;
  brake: boolean;
  progress: number;
}

function scanEntry(
  id: string,
  car: Readonly<CarState>,
  input: Readonly<Input>,
  lap: number,
  trackLength: number,
): DraftScanEntry {
  return {
    id,
    car,
    brake: input.brake > 0,
    progress: totalProgress(car.z, lap, trackLength),
  };
}

function snapshot(entry: DraftScanEntry): DraftCarSnapshot {
  return { x: entry.car.x, progress: entry.progress };
}

/**
 * For `follower`, pick the closest leader in the field whose wake the
 * follower is currently in. Returns the chosen leader entry plus the
 * geometric snapshot, or `null` when no leader qualifies. The "closest"
 * tiebreak is the smallest `longitudinalGap` (most directly behind the
 * leader the follower is); ties past that are broken by lexical leader
 * id so the result is deterministic across runs.
 */
function pickLeader(
  follower: DraftScanEntry,
  field: ReadonlyArray<DraftScanEntry>,
): { leader: DraftScanEntry; followerSnap: DraftCarSnapshot; leaderSnap: DraftCarSnapshot } | null {
  let best: { leader: DraftScanEntry; gap: number } | null = null;
  const followerSnap = snapshot(follower);
  for (const candidate of field) {
    if (candidate.id === follower.id) continue;
    const wake = computeWakeOffset(snapshot(candidate), followerSnap);
    if (!wake.inWake) continue;
    if (
      best === null ||
      wake.longitudinalGap < best.gap ||
      (wake.longitudinalGap === best.gap && candidate.id < best.leader.id)
    ) {
      best = { leader: candidate, gap: wake.longitudinalGap };
    }
  }
  if (best === null) return null;
  return {
    leader: best.leader,
    followerSnap,
    leaderSnap: snapshot(best.leader),
  };
}

/**
 * Adapter view: `tickAI` is shaped against `CompiledSegmentBuffer` (the dev
 * page's segment-only entry point). The compiled track from `compileTrack`
 * carries the full metadata block but the same `segments` array, so we
 * project it onto the smaller buffer shape without copying.
 */
function bufferView(track: CompiledTrack): CompiledSegmentBuffer {
  return {
    segments: track.segments as CompiledSegmentBuffer["segments"],
    totalLength: track.totalLengthMeters,
  };
}

/**
 * Advance the session by `dt` seconds. Pure: input state unchanged, fresh
 * state returned.
 *
 * Phases:
 * - `countdown`: decrements `countdownRemainingSec` by `dt`. When it falls
 *   to 0 the phase flips to `racing` and `tick` resets so lap timing starts
 *   at the green light. No physics integration runs in countdown so the cars
 *   sit at their grid positions.
 * - `racing`: runs physics for each still-racing car, advances `elapsed`
 *   and `tick`, checks lap completion. On lap rollover records the lap
 *   time and updates best (per car). Per-car DNF tracking runs after
 *   physics: a car off-road and slow long enough trips
 *   `DNF_OFF_TRACK_TIMEOUT_SEC`; a car not advancing trips
 *   `DNF_NO_PROGRESS_TIMEOUT_SEC`. A non-racing car (status `"finished"`
 *   or `"dnf"`) freezes its snapshot and is no longer integrated. The
 *   race phase flips to `"finished"` when (a) the player completes the
 *   final lap, (b) every car has stopped racing, or (c) `elapsed`
 *   exceeds `DNF_RACE_TIME_LIMIT_SEC` as the §7 safety net (10 minutes
 *   per the iter-19 stress-test on dot
 *   `VibeGear2-implement-race-rules-b30656ae`).
 * - `finished`: no-op tick. The session is read-only at this point; the
 *   results overlay reads from the snapshot.
 */
export function stepRaceSession(
  state: Readonly<RaceSessionState>,
  playerInput: Readonly<Input>,
  config: RaceSessionConfig,
  dt: number,
): RaceSessionState {
  if (!Number.isFinite(dt) || dt <= 0) {
    // Defensive copy so the caller treats every result as a fresh value.
    return cloneSessionState(state);
  }

  const trackContext = config.trackContext ?? DEFAULT_TRACK_CONTEXT;
  const aiContext = config.aiContext ?? DEFAULT_AI_TRACK_CONTEXT;

  if (state.race.phase === "finished") {
    return cloneSessionState(state);
  }

  if (state.race.phase === "countdown") {
    const remaining = Math.max(0, state.race.countdownRemainingSec - dt);
    if (remaining > 0) {
      return {
        race: {
          ...state.race,
          phase: "countdown",
          countdownRemainingSec: remaining,
        },
        player: clonePlayerCar(state.player),
        ai: state.ai.map(cloneAiCar),
        tick: state.tick + 1,
        sectorTimer: state.sectorTimer,
        baselineSplitsMs: state.baselineSplitsMs,
        draftWindows: state.draftWindows,
        brokenHazards: state.brokenHazards,
        weather: cloneWeatherState(state.weather),
        weatherRngState: state.weatherRngState,
        audioEvents: [],
      };
    }
    // Lights out. Flip to racing, zero the tick clock, reset the sector
    // timer so its lap-start tick matches the green light, then drop into
    // the racing branch below by recursing with the promoted state.
    const promotedPlayer = clonePlayerCar(state.player);
    // Lights-out resets the §19 assist memory so the smoothing filter,
    // toggle-nitro latch, and reduced-input winner do not carry stale
    // state from the warmup countdown into the race. Mirrors the lap-
    // timer / sector-timer reset on the same tick.
    promotedPlayer.assistMemory = { ...INITIAL_ASSIST_MEMORY };
    const promoted: RaceSessionState = {
      race: {
        ...state.race,
        phase: "racing",
        countdownRemainingSec: 0,
        elapsed: 0,
      },
      player: promotedPlayer,
      ai: state.ai.map(cloneAiCar),
      tick: 0,
      sectorTimer: createSectorState(config.track.checkpoints),
      baselineSplitsMs: state.baselineSplitsMs,
      draftWindows: state.draftWindows,
      brokenHazards: state.brokenHazards,
      weather: cloneWeatherState(state.weather),
      weatherRngState: state.weatherRngState,
      audioEvents: [],
    };
    return stepRaceSession(promoted, playerInput, config, dt);
  }

  // Racing branch.
  const buffer = bufferView(config.track);
  const trackLength = config.track.totalLengthMeters;
  const playerStats = config.player.stats;
  const playerUpgradeTier = config.player.upgrades?.nitro;
  const playerIsRacing = state.player.status === "racing";
  // §28 difficulty preset scalars: resolved each tick from the player's
  // saved preset id. `resolvePresetScalars` returns the same frozen
  // object reference per preset id (`getPreset` lookup is a property
  // access on a frozen table) so this is effectively zero-cost; no
  // per-tick allocation. AI cars deliberately do not consume the
  // player's preset (the §28 narrative is "player-facing difficulty");
  // every AI step receives the identity scalars implicitly via an
  // omitted `assistScalars` parameter, preserving the pre-binding AI
  // behaviour bit-for-bit.
  const playerAssistScalars: Readonly<AssistScalars> = resolvePresetScalars(
    config.player.difficultyPreset ?? undefined,
  );
  // §23 CPU difficulty modifiers: resolved each tick from the same
  // saved preset id and forwarded into every `tickAI` call so the AI
  // tier scalars (`paceScalar`, plus the reserved `recoveryScalar` /
  // `mistakeScalar`) stack on top of the per-driver `AIDriver.paceScalar`
  // from `src/data/ai/*.json`. `resolveCpuModifiers` returns the same
  // frozen object reference per preset id (frozen-table lookup) so this
  // is allocation-free per tick. Unlike `playerAssistScalars` which
  // tunes the player car, this row tunes every AI car uniformly per
  // §23 "CPU difficulty modifiers" (one tier-wide row, per-driver
  // identity stays in the AI JSON). Defaults to the Normal (identity)
  // row when the save has no preset (older v1 saves before the field
  // landed) so existing call sites preserve pre-binding behaviour.
  const cpuModifiers: Readonly<CpuDifficultyModifiers> = resolveCpuModifiers(
    config.player.difficultyPreset ?? undefined,
  );

  // §19 accessibility assists: rewrite the player's resolved input
  // before any downstream reducer (nitro, transmission, drafting,
  // physics) reads it. Auto-accelerate, brake assist, steering
  // smoothing, toggle-nitro, and reduced-input all collapse to no-ops
  // when the player has the matching flag turned off, so opting out is
  // exactly equivalent to the previous wiring (no allocation cost
  // either: the producer returns the same input reference when no
  // rewrite happened). `weatherVisualReductionActive` flows out of the
  // same call so the future weather grip multiplier reads it from a
  // single coherent snapshot per tick. A non-racing player (DNF or
  // post-finish) skips the assist call entirely; the resolved input is
  // forced to neutral so any downstream reducer that still reads it
  // sees zero throttle / brake / nitro.
  const assistSettings = config.player.assists ?? {};
  const weatherRng = deserializeRng(state.weatherRngState);
  const nextWeather = stepWeatherState(state.weather, dt, weatherRng, {
    allowedStates: config.track.weatherOptions,
    changeChancePerSecond:
      config.weatherTransitions?.changeChancePerSecond ?? 0,
    transitionSeconds: config.weatherTransitions?.transitionSeconds,
  });
  const nextWeatherRngState = serializeRng(weatherRng);
  const trackWeather = activeWeatherForState(nextWeather);
  const playerWeatherGripScalar = weatherGripScalarForState(
    playerStats,
    nextWeather,
    config.playerTire ?? "dry",
  );
  const assistResult = playerIsRacing
    ? applyAssists(
        playerInput,
        assistSettings,
        {
          speedMps: state.player.car.speed,
          surface: state.player.car.surface,
          weather: trackWeather,
          upcomingCurvature: upcomingCurvature(
            config.track.segments,
            state.player.car.z,
          ),
          dt,
        },
        state.player.assistMemory,
      )
    : {
        input: NEUTRAL_INPUT,
        memory: state.player.assistMemory,
        // Preserve the prior badge so a HUD that snapshotted it before
        // the DNF flip keeps reading the same value across the rest of
        // the race. `null` is allowed by `RaceSessionPlayerCar.assistBadge`.
        badge: state.player.assistBadge ?? {
          active: false,
          count: 0,
          primary: null,
          active_labels: [],
        },
        weatherVisualReductionActive:
          state.player.weatherVisualReductionActive,
      };
  const effectivePlayerInput = assistResult.input;

  // §10 nitro: advance the reducer for the player using their nitro
  // input, then feed `getNitroAccelMultiplier` into the physics step's
  // `accelMultiplier` slot so an active charge scales acceleration.
  // Reads the post-assist input so toggle-nitro and reduced-input map
  // through the rest of the pipeline cleanly. A non-racing player
  // freezes the nitro / transmission state at its prior value so the
  // §20 results screen reads the same snapshot the moment the car
  // retired (or finished).
  const playerNitroResult = playerIsRacing
    ? tickNitro(
        state.player.nitro,
        {
          nitroPressed: effectivePlayerInput.nitro,
          wasPressed: state.player.lastNitroPressed,
          upgradeTier: playerUpgradeTier,
        },
        dt,
      )
    : { state: state.player.nitro };
  const playerNitroMultiplier = getNitroAccelMultiplier(
    playerNitroResult.state,
    {
      upgradeTier: playerUpgradeTier,
      carNitroEfficiency: playerStats.nitroEfficiency,
    },
  );

  // §10 transmission: advance the per-tick gear/RPM reducer using the
  // player's pre-physics speed and the rising-edge shift inputs. The
  // resulting `gearAccelMultiplier` is composed multiplicatively with
  // the nitro multiplier so a manual driver who taps nitro mid-band
  // still benefits from both. Auto mode ignores `shiftUp`/`shiftDown`,
  // so the edge-gating below has no effect on auto-only players. A
  // non-racing player freezes its transmission snapshot.
  const playerMaxGear = maxGearForUpgrades(config.player.upgrades ?? null);
  const playerShiftUpEdge =
    effectivePlayerInput.shiftUp && !state.player.lastShiftUpPressed;
  const playerShiftDownEdge =
    effectivePlayerInput.shiftDown && !state.player.lastShiftDownPressed;
  const playerTransmission = playerIsRacing
    ? tickTransmission(
        state.player.transmission,
        {
          throttle: effectivePlayerInput.throttle,
          brake: effectivePlayerInput.brake,
          shiftUp: playerShiftUpEdge,
          shiftDown: playerShiftDownEdge,
          speed: state.player.car.speed,
          topSpeed: playerStats.topSpeed,
          maxGear: playerMaxGear,
        },
        dt,
      )
    : { ...state.player.transmission };
  const playerGearMultiplier = gearAccelMultiplier(playerTransmission);
  const playerAccelMultiplier = playerNitroMultiplier * playerGearMultiplier;

  // Pre-compute every AI's tick output so the per-tick draft scan can
  // read brake / position for the whole field before any physics
  // integrates. Drafting (per §10) is decided from this tick's geometric
  // snapshot: we look at where the cars are this tick and where each
  // follower's brake input is this tick, then `physics.step` consumes
  // the resulting multiplier the same tick. `tickAI` is called once per
  // AI per session step; the second physics-step pass below reuses the
  // captured `tick.input` and `tick.nextAiState` rather than re-running.
  const aiTickResults = state.ai.map((entry, index) => {
    const aiConfig = config.ai[index];
    if (!aiConfig) return null;
    const aiWeatherSkill = weatherSkillFor(aiConfig.driver, trackWeather);
    return tickAI(
      aiConfig.driver,
      entry.state,
      entry.car,
      { car: state.player.car },
      buffer,
      state.race,
      aiConfig.stats,
      aiContext,
      dt,
      cpuModifiers,
      aiWeatherSkill,
      weatherVisibilityRiskScalar(trackWeather, aiWeatherSkill),
    );
  });

  // Build the per-tick field snapshot for the draft scan. Each entry
  // carries the car's pre-physics position (matching §10's "this tick's
  // wake" interpretation) and brake-state from the input the same car
  // will integrate. `progress` collapses lap+z so cross-lap tandem pairs
  // (rare in practice, but possible at the lap-rollover tick) still rank
  // correctly.
  const field: DraftScanEntry[] = [];
  field.push(
    scanEntry(
      PLAYER_CAR_ID,
      state.player.car,
      effectivePlayerInput,
      state.race.lap,
      trackLength,
    ),
  );
  state.ai.forEach((entry, index) => {
    const tick = aiTickResults[index];
    // If `aiTickResults[index]` is null (config missing for this slot)
    // the AI is effectively idle; treat it as a brake-held neutral
    // input so a stationary stale slot cannot confer drafting on a
    // follower that happens to be behind it.
    const aiInput: Input = tick?.input ?? { ...NEUTRAL_INPUT, brake: 1 };
    field.push(
      scanEntry(aiCarId(index), entry.car, aiInput, state.race.lap, trackLength),
    );
  });

  // Drafting per follower per leader. We start with a shallow copy of
  // the current map then, for each follower, advance the entry for
  // every (follower, leader) pair that already exists OR that the
  // per-tick scan picks as the current target. Pairs the follower is
  // not currently in-wake with get advanced with `inWake: false` so a
  // side-step / brake / out-of-gap event resets that pair's window the
  // same tick the geometry breaks. This keeps multiple parallel pairs
  // isolated (the §10 "pair-isolation" verify item) while honouring the
  // §10 "Break instantly on side movement or brake input" rule.
  const nextDraftWindows: Record<string, DraftWindowState> = { ...state.draftWindows };
  const draftMultipliers = new Map<string, number>();
  for (const follower of field) {
    const pick = pickLeader(follower, field);
    const followerSnap: DraftCarSnapshot = { x: follower.car.x, progress: follower.progress };
    // Collect every leader id this follower currently has any window
    // entry for, plus the freshly-picked leader so a new pair is seeded
    // at INITIAL on first tick of contact.
    const leaderIds = new Set<string>();
    for (const key of Object.keys(nextDraftWindows)) {
      const prefix = `${follower.id}>>><`;
      if (key.startsWith(prefix)) leaderIds.add(key.slice(prefix.length));
    }
    if (pick) leaderIds.add(pick.leader.id);
    for (const leaderId of leaderIds) {
      const leaderEntry = field.find((entry) => entry.id === leaderId);
      // If the leader has somehow vanished from the field (e.g. a
      // future slice removes a DNF'd car), treat the wake as broken.
      const wake = leaderEntry
        ? computeWakeOffset(
            { x: leaderEntry.car.x, progress: leaderEntry.progress },
            followerSnap,
          )
        : { inWake: false as const, lateralOffset: Number.POSITIVE_INFINITY, longitudinalGap: 0, ageMs: 0 as const };
      const key = draftPairKey(follower.id, leaderId);
      const prior = nextDraftWindows[key] ?? INITIAL_DRAFT_WINDOW;
      const advanced = tickDraftWindow(
        prior,
        wake,
        { brake: follower.brake, followerSpeed: follower.car.speed },
        dt,
      );
      nextDraftWindows[key] = advanced;
      // Only the actively picked pair contributes to the physics bonus
      // this tick. Other windows might be ramping back up from zero
      // toward engagement on a future tick if the follower swings back
      // behind that leader; their multiplier does not stack with the
      // active pick.
      if (pick && leaderId === pick.leader.id) {
        draftMultipliers.set(follower.id, advanced.accelMultiplier);
      }
    }
  }

  const playerDraftBonus = draftMultipliers.get(PLAYER_CAR_ID) ?? 1;
  const hazardsById = config.hazardsById ?? EMPTY_HAZARD_REGISTRY;
  const initialBrokenHazards =
    state.brokenHazards.length > 0
      ? new Set(state.brokenHazards)
      : EMPTY_BROKEN_HAZARDS;
  let nextBrokenHazards = initialBrokenHazards;
  const hazardHitsByCarId = new Map<string, HitEvent[]>();
  const playerHazards = playerIsRacing
    ? evaluateHazards({
        car: state.player.car,
        track: config.track,
        hazardsById,
        brokenHazards: nextBrokenHazards,
      })
    : EMPTY_HAZARD_EFFECT;
  if (playerIsRacing) {
    nextBrokenHazards = playerHazards.brokenHazards;
  }
  const playerHazardHits = hitsFromHazards(playerHazards.events);
  if (playerHazardHits.length > 0) {
    hazardHitsByCarId.set(PLAYER_CAR_ID, playerHazardHits);
  }
  // §13 / F-019: derive the player's per-tick damage scalars from the
  // pre-step damage band. The §10 narrative wants engine damage to clip
  // top speed and tire damage to scrub grip; the band table in
  // `damageBands.ts` already maps `damage.total * 100` to the
  // `topSpeedScalar` / `gripScalar` knobs `step()` consumes. Using the
  // pre-step total keeps the same scalar source for the entire tick:
  // post-step damage updates land in this tick's accumulator below and
  // bite the next physics integration. PRISTINE_SCALARS at zero damage
  // collapses the multipliers to identity, preserving pre-binding
  // behaviour for an undamaged car.
  const playerDamageScalars = withHazardGrip(
    getDamageScalars(state.player.damage.total * 100),
    playerHazards.gripMultiplier,
  );
  // Skip physics integration entirely for non-racing players (DNF or
  // post-finish). Freezing the snapshot is what makes a retired player
  // sit in place across the rest of the race rather than continuing to
  // coast through whatever was already in `car.speed`.
  const nextPlayerCar = playerIsRacing
    ? step(
        state.player.car,
        effectivePlayerInput,
        playerStats,
        trackContext,
        dt,
        {
          accelMultiplier: playerAccelMultiplier,
          draftBonus: playerDraftBonus,
          assistScalars: playerAssistScalars,
          damageScalars: playerDamageScalars,
          weatherGripScalar: playerWeatherGripScalar,
        },
      )
    : { ...state.player.car };

  const nextAi: RaceSessionAICar[] = state.ai.map((entry, index) => {
    const aiConfig = config.ai[index];
    const tick = aiTickResults[index];
    // Non-racing AI (DNF or already-finished) freezes its snapshot so
    // the standings strip and the §20 results screen keep reading the
    // same value. The DNF / lap rollover wiring downstream still gets
    // a chance to update bookkeeping, but the physics-step/nitro/
    // transmission reducers all skip.
    if (!aiConfig || !tick || entry.status !== "racing") {
      return cloneAiCar(entry);
    }
    const aiUpgradeTier = aiConfig.upgrades?.nitro;
    const aiNitroResult = tickNitro(
      entry.nitro,
      {
        nitroPressed: tick.input.nitro,
        wasPressed: entry.lastNitroPressed,
        upgradeTier: aiUpgradeTier,
      },
      dt,
    );
    const aiNitroMultiplier = getNitroAccelMultiplier(
      aiNitroResult.state,
      {
        upgradeTier: aiUpgradeTier,
        carNitroEfficiency: aiConfig.stats.nitroEfficiency,
      },
    );
    // §10 transmission: AI cars run the same gear/RPM reducer as the
    // player using their controller's per-tick `Input`. The current
    // `clean_line` archetype never raises shift inputs, so AI cars
    // ride the auto-shift branch exclusively; the rising-edge gating
    // is included so a future shift-aware archetype can opt in
    // without a session-shape change.
    const aiMaxGear = maxGearForUpgrades(aiConfig.upgrades ?? null);
    const aiShiftUpEdge = tick.input.shiftUp && !entry.lastShiftUpPressed;
    const aiShiftDownEdge =
      tick.input.shiftDown && !entry.lastShiftDownPressed;
    const aiTransmission = tickTransmission(
      entry.transmission,
      {
        throttle: tick.input.throttle,
        brake: tick.input.brake,
        shiftUp: aiShiftUpEdge,
        shiftDown: aiShiftDownEdge,
        speed: entry.car.speed,
        topSpeed: aiConfig.stats.topSpeed,
        maxGear: aiMaxGear,
      },
      dt,
    );
    const aiGearMultiplier = gearAccelMultiplier(aiTransmission);
    const aiAccelMultiplier = aiNitroMultiplier * aiGearMultiplier;
    const aiDraftBonus = draftMultipliers.get(aiCarId(index)) ?? 1;
    // §13 / F-019: AI cars run the same damage-scalars wiring as the
    // player. The §28 / §15 split scopes the player-facing
    // `assistScalars` to the player only; per-car damage is driver-
    // agnostic, so every AI car reads its own pre-step damage band
    // through the same band table. Identity scalars at zero damage keep
    // the unscaled behaviour for an undamaged AI.
    const aiHazards = evaluateHazards({
      car: entry.car,
      track: config.track,
      hazardsById,
      brokenHazards: nextBrokenHazards,
    });
    nextBrokenHazards = aiHazards.brokenHazards;
    const aiHazardHits = hitsFromHazards(aiHazards.events);
    if (aiHazardHits.length > 0) {
      hazardHitsByCarId.set(aiCarId(index), aiHazardHits);
    }
    const aiDamageScalars = withHazardGrip(
      getDamageScalars(entry.damage.total * 100),
      aiHazards.gripMultiplier,
    );
    const aiWeatherGripScalar = weatherGripScalarForState(
      aiConfig.stats,
      nextWeather,
    );
    const nextCar = step(
      entry.car,
      tick.input,
      aiConfig.stats,
      trackContext,
      dt,
      {
        accelMultiplier: aiAccelMultiplier,
        draftBonus: aiDraftBonus,
        damageScalars: aiDamageScalars,
        weatherGripScalar: aiWeatherGripScalar,
      },
    );
    return {
      car: nextCar,
      state: tick.nextAiState,
      nitro: aiNitroResult.state,
      lastNitroPressed: tick.input.nitro,
      transmission: aiTransmission,
      lastShiftUpPressed: tick.input.shiftUp,
      lastShiftDownPressed: tick.input.shiftDown,
      status: entry.status,
      dnfTimers: { ...entry.dnfTimers },
      dnfReason: entry.dnfReason,
      lap: entry.lap,
      lapTimes: entry.lapTimes.slice(),
      finishedAtMs: entry.finishedAtMs,
      damage: entry.damage,
    };
  });

  // §13 damage wiring (F-047). Each still-racing car accumulates
  // off-road persistent damage when its post-step position is off the
  // drivable surface, then takes a `carHit` event for every other
  // still-racing car within the §13 contact box (`carsInContact`). The
  // §23 `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` flag is set when the car
  // has an active nitro burn AND the pre-hit damage band is `severe`
  // or `catastrophic`. Per-event scalars use `playerAssistScalars` for
  // the player and the identity (omitted) for AI cars, mirroring the
  // §28 / §15 split (the player-facing preset tunes only the player).
  // A car whose damage crosses `WRECK_THRESHOLD` flips to
  // `status: "dnf"` with `dnfReason: "wrecked"`; the existing all-stopped
  // race-phase finish gate then collapses to `"finished"` once every
  // car has stopped.
  const roadHalfWidthForDamage = trackContext.roadHalfWidth;
  // Build the per-car snapshot of (id, carState, racing) so the
  // collision pass can iterate ordered pairs without re-deriving the
  // racing predicate per pair. The ordered-pair iteration (i < j)
  // makes the carHit application symmetric: both cars in a contact
  // pair receive one event per pair per tick.
  type DamageEntry = {
    id: string;
    car: Readonly<CarState>;
    nitroActive: boolean;
    racing: boolean;
    isPlayer: boolean;
  };
  const damageEntries: DamageEntry[] = [
    {
      id: PLAYER_CAR_ID,
      car: nextPlayerCar,
      nitroActive: playerNitroResult.state.activeRemainingSec > 0,
      racing: playerIsRacing,
      isPlayer: true,
    },
    ...nextAi.map((entry, index) => ({
      id: aiCarId(index),
      car: entry.car,
      nitroActive: entry.nitro.activeRemainingSec > 0,
      racing: entry.status === "racing",
      isPlayer: false,
    })),
  ];
  // Per-id list of `carHit` events to apply this tick. The pair scan
  // populates both sides of every contact pair so the §13 carHit
  // distribution applies symmetrically.
  const hitsByCarId = new Map(hazardHitsByCarId);
  for (let i = 0; i < damageEntries.length; i += 1) {
    const a = damageEntries[i]!;
    if (!a.racing) continue;
    for (let j = i + 1; j < damageEntries.length; j += 1) {
      const b = damageEntries[j]!;
      if (!b.racing) continue;
      if (!carsInContact(a.car, b.car)) continue;
      const event = buildCarHitEvent(a.car, b.car);
      const aHits = hitsByCarId.get(a.id) ?? [];
      aHits.push(event);
      hitsByCarId.set(a.id, aHits);
      const bHits = hitsByCarId.get(b.id) ?? [];
      bHits.push(event);
      hitsByCarId.set(b.id, bHits);
    }
  }
  const playerImpactEvents = (hitsByCarId.get(PLAYER_CAR_ID) ?? []).map(
    (hit): RaceSessionImpactAudioEvent => ({
      kind: "impact",
      carId: PLAYER_CAR_ID,
      hitKind: hit.kind,
      speedFactor: hit.speedFactor,
    }),
  );
  // Helper: advance one car's damage by the off-road drip + the
  // accumulated `carHit` events. Returns the post-update damage and
  // whether the car wrecked this tick (so the caller can flip status).
  function advanceDamage(
    prior: Readonly<DamageState>,
    car: Readonly<CarState>,
    racing: boolean,
    nitroActive: boolean,
    hits: ReadonlyArray<HitEvent>,
    scalars: Readonly<AssistScalars> | undefined,
  ): { damage: DamageState; wrecked: boolean } {
    if (!racing) return { damage: prior, wrecked: false };
    let next: DamageState = prior;
    if (isOffRoad(car.x, roadHalfWidthForDamage) && car.speed > 0) {
      next = applyOffRoadDamage(next, car.speed, dt, scalars);
    }
    for (const hit of hits) {
      const band = getDamageBand(next.total * 100);
      const nitroOnSevere =
        nitroActive && (band === "severe" || band === "catastrophic");
      next = applyHit(next, hit, scalars, nitroOnSevere);
    }
    return { damage: next, wrecked: isWrecked(next) };
  }

  const playerDamageResult = advanceDamage(
    state.player.damage,
    nextPlayerCar,
    playerIsRacing,
    playerNitroResult.state.activeRemainingSec > 0,
    hitsByCarId.get(PLAYER_CAR_ID) ?? [],
    playerAssistScalars,
  );
  const aiAfterDamage: RaceSessionAICar[] = nextAi.map((entry, index) => {
    const id = aiCarId(index);
    const result = advanceDamage(
      entry.damage,
      entry.car,
      entry.status === "racing",
      entry.nitro.activeRemainingSec > 0,
      hitsByCarId.get(id) ?? [],
      undefined,
    );
    if (result.damage === entry.damage && !result.wrecked) {
      return entry;
    }
    return {
      ...entry,
      damage: result.damage,
      status: result.wrecked ? "dnf" : entry.status,
      dnfReason: result.wrecked ? "wrecked" : entry.dnfReason,
    };
  });

  const nextElapsed = state.race.elapsed + dt;
  const nextElapsedMs = Math.max(1, Math.round(nextElapsed * 1000));
  const nextTick = state.tick + 1;

  // Lap completion. Floor of cumulative track distance.
  let nextLap = state.race.lap;
  let lastLapTimeMs = state.race.lastLapTimeMs;
  let bestLapTimeMs = state.race.bestLapTimeMs;
  let nextPhase: RaceState["phase"] = state.race.phase;
  let nextPlayerLapTimes: ReadonlyArray<number> = state.player.lapTimes;
  // Apply the §13 wreck flip before the lap-completion check so a car
  // that wrecked this tick cannot also pick up a finish (would-be lap
  // crossings on the wrecked tick are ignored, mirroring the §7 DNF
  // gate semantics in `tickDnfTimers`).
  let nextPlayerStatus: RaceCarStatus = playerDamageResult.wrecked
    ? "dnf"
    : state.player.status;
  let nextPlayerFinishedAtMs: number | null = state.player.finishedAtMs;
  // The wrecked-this-tick flag is what gates the lap-completion branch
  // below: a wrecked player cannot also finish on the same tick.
  const playerWreckedThisTick =
    playerDamageResult.wrecked && state.player.status === "racing";

  if (playerIsRacing && !playerWreckedThisTick && trackLength > 0) {
    const lapsCompleted = Math.floor(nextPlayerCar.z / trackLength);
    const intendedLap = lapsCompleted + 1;
    if (intendedLap > state.race.lap) {
      // One or more laps crossed this tick. The MVP records a single lap
      // time for the most recent crossing; multi-lap-per-tick can only
      // happen with absurd dt and is not relevant for 60 Hz.
      const priorTotalMs = state.player.lapTimes.reduce((a, b) => a + b, 0);
      const lapDurationMs = Math.max(1, nextElapsedMs - priorTotalMs);
      lastLapTimeMs = lapDurationMs;
      bestLapTimeMs =
        bestLapTimeMs === null
          ? lapDurationMs
          : Math.min(bestLapTimeMs, lapDurationMs);
      nextLap = intendedLap;
      // §7 per-car lap times: append the per-lap duration (current
      // elapsed minus the cumulative time at the prior lap boundary)
      // for the §20 results screen + reward bonuses. The first lap's
      // duration is `nextElapsedMs` since the lap-1 baseline is the
      // green-light moment (`elapsed = 0`); subsequent laps subtract
      // the cumulative ms baked into the prior `lapTimes` total.
      nextPlayerLapTimes = [...state.player.lapTimes, lapDurationMs];
      if (nextLap > state.race.totalLaps) {
        nextPhase = "finished";
        nextLap = state.race.totalLaps;
        nextPlayerStatus = "finished";
        nextPlayerFinishedAtMs = nextElapsedMs;
      }
    }
  }

  // §7 per-AI lap rollover + finishing. Each AI tracks its own lap
  // counter (the `RaceState.lap` field is player-only) and accumulates
  // a per-lap-times array so the §7 final-state builder can derive the
  // per-car `bestLapMs` and the field's fastest lap. An AI that
  // crosses the final start/finish line on this tick flips to
  // `"finished"`; downstream ticks freeze its physics (the `nextAi`
  // map above already gates on `entry.status !== "racing"`).
  const aiAfterLap: RaceSessionAICar[] = aiAfterDamage.map((entry) => {
    if (entry.status !== "racing" || trackLength <= 0) return entry;
    const aiLapsCompleted = Math.floor(entry.car.z / trackLength);
    const aiIntendedLap = aiLapsCompleted + 1;
    if (aiIntendedLap <= entry.lap) return entry;
    const priorAiTotalMs = entry.lapTimes.reduce((a, b) => a + b, 0);
    const aiLapDurationMs = Math.max(1, nextElapsedMs - priorAiTotalMs);
    const aiLapTimes = [...entry.lapTimes, aiLapDurationMs];
    if (aiIntendedLap > state.race.totalLaps) {
      return {
        ...entry,
        lap: state.race.totalLaps,
        lapTimes: aiLapTimes,
        status: "finished",
        finishedAtMs: nextElapsedMs,
      };
    }
    return { ...entry, lap: aiIntendedLap, lapTimes: aiLapTimes };
  });

  // §7 DNF detection. For each still-racing car, build a `DnfSample`
  // from the post-step car snapshot and advance `tickDnfTimers`. A car
  // that trips a threshold this tick flips to `status: "dnf"` with the
  // reason on the per-car snapshot; downstream ticks freeze its
  // physics (gates above honour `status !== "racing"`).
  const roadHalfWidth = trackContext.roadHalfWidth;
  const playerDnfResult =
    nextPlayerStatus === "racing"
      ? tickDnfTimers(
          state.player.dnfTimers,
          {
            offTrack: isOffRoad(nextPlayerCar.x, roadHalfWidth),
            speed: nextPlayerCar.speed,
            totalDistance: nextPlayerCar.z,
          },
          dt,
        )
      : null;
  const nextPlayerDnfTimers = playerDnfResult
    ? playerDnfResult.timers
    : { ...state.player.dnfTimers };
  let nextPlayerDnfReason: DnfReason = state.player.dnfReason;
  // §13 wreck wins over the §7 windows: a player that wrecked this
  // tick records the `wrecked` reason regardless of whether the
  // off-track / no-progress timer would have tripped on the same tick.
  // (`tickDnfTimers` is gated on `nextPlayerStatus === "racing"` above
  // so it doesn't even run on the wrecked tick.)
  if (playerWreckedThisTick) {
    nextPlayerDnfReason = "wrecked";
  } else if (playerDnfResult?.dnf) {
    nextPlayerStatus = "dnf";
    nextPlayerDnfReason = playerDnfResult.reason;
  }

  const aiAfterDnf: RaceSessionAICar[] = aiAfterLap.map((entry) => {
    if (entry.status !== "racing") return entry;
    const result = tickDnfTimers(
      entry.dnfTimers,
      {
        offTrack: isOffRoad(entry.car.x, roadHalfWidth),
        speed: entry.car.speed,
        totalDistance: entry.car.z,
      },
      dt,
    );
    if (!result.dnf) {
      return { ...entry, dnfTimers: result.timers };
    }
    return {
      ...entry,
      dnfTimers: result.timers,
      status: "dnf",
      dnfReason: result.reason,
    };
  });

  // §7 hard race time limit. The pure helper `exceedsRaceTimeLimit`
  // pins the threshold at `DNF_RACE_TIME_LIMIT_SEC` (10 minutes) per
  // the iter-19 stress-test §4 on dot
  // `VibeGear2-implement-race-rules-b30656ae`. Once the elapsed sim
  // time crosses the cap, the session flips to `"finished"` so a
  // stuck race (a player who parks in the gravel and never moves; an
  // edge case where every car is still racing but no one is making
  // progress) cannot block the results screen forever. The lap-
  // completion branch above already moves to `"finished"` when the
  // player wins; this branch is the safety net that fires when the
  // player did not.
  if (nextPhase !== "finished" && exceedsRaceTimeLimit(nextElapsed)) {
    nextPhase = "finished";
  }

  // §7 multi-car finish gate. Race phase flips to `"finished"` once
  // every car in the field has stopped racing (every entry is either
  // `"finished"` or `"dnf"`). Catches the all-AI-DNF + player-DNF
  // case so a session whose player retired and whose AIs all retired
  // does not leave the results screen blocked indefinitely.
  if (nextPhase !== "finished") {
    const everyoneStopped =
      nextPlayerStatus !== "racing" &&
      aiAfterDnf.every((entry) => entry.status !== "racing");
    if (everyoneStopped) nextPhase = "finished";
  }

  // Sector timer: advance from the player's lap-local z. Lap-rollover within
  // `tickSectorTimer` resets the chain at `nextTick` so the lap-2+ first
  // sector starts at the lap-boundary, not at zero. Capture the previous
  // lap's splits as the baseline for the §20 widget when the lap rolls.
  const lapPos =
    trackLength > 0
      ? ((nextPlayerCar.z % trackLength) + trackLength) % trackLength
      : nextPlayerCar.z;
  let nextBaseline = state.baselineSplitsMs;
  if (nextLap > state.race.lap) {
    // Close the final sector of the just-finished lap so its split lands in
    // `splitsForLap`, then snapshot it as the baseline for the next lap.
    const closing = onCheckpointPass_close(state.sectorTimer, nextTick);
    nextBaseline = splitsForLap(closing, dt);
  }
  const nextSectorTimer = tickSectorTimer(
    state.sectorTimer,
    state.race.lap,
    nextLap,
    lapPos,
    config.track.checkpoints,
    SEGMENT_LENGTH,
    nextTick,
  );

  return {
    race: {
      ...state.race,
      phase: nextPhase,
      elapsed: nextElapsed,
      lap: nextLap,
      lastLapTimeMs,
      bestLapTimeMs,
    },
    player: {
      car: nextPlayerCar,
      nitro: playerNitroResult.state,
      // Mirror the post-assist nitro value so the next tick's
      // rising-edge detection in `tickNitro` matches the input the
      // physics step actually consumed. This matters under
      // toggle-nitro: the producer collapses the held key into a
      // latched bool, so the session must remember what it forwarded
      // (not what the player physically pressed) to keep the same
      // tap from re-firing the nitro reducer next tick.
      lastNitroPressed: effectivePlayerInput.nitro,
      transmission: playerTransmission,
      lastShiftUpPressed: effectivePlayerInput.shiftUp,
      lastShiftDownPressed: effectivePlayerInput.shiftDown,
      assistMemory: assistResult.memory,
      assistBadge: assistResult.badge,
      weatherVisualReductionActive: assistResult.weatherVisualReductionActive,
      status: nextPlayerStatus,
      dnfTimers: nextPlayerDnfTimers,
      dnfReason: nextPlayerDnfReason,
      lapTimes: nextPlayerLapTimes,
      finishedAtMs: nextPlayerFinishedAtMs,
      damage: playerDamageResult.damage,
    },
    ai: aiAfterDnf,
    tick: nextTick,
    sectorTimer: nextSectorTimer,
    baselineSplitsMs: nextBaseline,
    draftWindows: nextDraftWindows,
    brokenHazards:
      nextBrokenHazards === initialBrokenHazards
        ? state.brokenHazards
        : Array.from(nextBrokenHazards),
    weather: nextWeather,
    weatherRngState: nextWeatherRngState,
    audioEvents: playerImpactEvents,
  };
}

/**
 * Close the final sector of the current lap by stamping its `tickExited`
 * with the lap-rollover tick. Returns a fresh state without altering
 * `currentSectorIdx` (the tickSectorTimer's `startNewLap` call resets that
 * for the new lap). Local helper kept here so the lap-baseline capture
 * stays adjacent to its only caller.
 */
function onCheckpointPass_close(
  state: SectorState,
  tick: number,
): SectorState {
  const sectors = state.sectors.map((s, i) =>
    i === state.currentSectorIdx && s.tickExited === null
      ? { ...s, tickExited: tick }
      : s,
  );
  return { sectors, currentSectorIdx: state.currentSectorIdx };
}

/**
 * Total forward progress for ranking. Combines lap count with current `z`
 * so a leader on lap 3 outranks a follower on lap 2 even with a smaller
 * raw z. Used by the HUD position derivation in the `/race` page.
 */
export function totalProgress(carZ: number, lap: number, trackLengthMeters: number): number {
  return (lap - 1) * trackLengthMeters + carZ;
}

function cloneSessionState(state: Readonly<RaceSessionState>): RaceSessionState {
  return {
    race: { ...state.race },
    player: clonePlayerCar(state.player),
    ai: state.ai.map(cloneAiCar),
    tick: state.tick,
    sectorTimer: state.sectorTimer,
    baselineSplitsMs: state.baselineSplitsMs,
    draftWindows: state.draftWindows,
    brokenHazards: state.brokenHazards.slice(),
    weather: cloneWeatherState(state.weather),
    weatherRngState: state.weatherRngState,
    audioEvents: state.audioEvents.slice(),
  };
}

const EMPTY_HAZARD_REGISTRY: ReadonlyMap<
  string,
  Readonly<HazardRegistryEntry>
> = new Map();

const EMPTY_BROKEN_HAZARDS: ReadonlySet<string> = new Set<string>();

const EMPTY_HAZARD_EFFECT = Object.freeze({
  events: Object.freeze([]),
  gripMultiplier: 1,
  brokenHazards: EMPTY_BROKEN_HAZARDS,
});

function hitsFromHazards(
  events: readonly { readonly hit: HitEvent | null }[],
): HitEvent[] {
  return events.flatMap((event) => (event.hit === null ? [] : [event.hit]));
}

function withHazardGrip(
  scalars: Readonly<DamageScalars>,
  gripMultiplier: number,
): DamageScalars {
  if (!Number.isFinite(gripMultiplier) || gripMultiplier === 1) {
    return scalars;
  }
  return {
    ...scalars,
    gripScalar: scalars.gripScalar * Math.max(0, gripMultiplier),
  };
}

function seedForAiIndex(raceSeed: number, index: number): number {
  return serializeRng(splitRng(createRng(raceSeed), `ai:${index}`));
}

function cloneWeatherState(state: Readonly<WeatherState>): WeatherState {
  return {
    current: state.current,
    transitioning: state.transitioning
      ? {
          from: state.transitioning.from,
          to: state.transitioning.to,
          progress: state.transitioning.progress,
        }
      : null,
  };
}

function clonePlayerCar(
  player: Readonly<RaceSessionPlayerCar>,
): RaceSessionPlayerCar {
  return {
    car: { ...player.car },
    nitro: { ...player.nitro },
    lastNitroPressed: player.lastNitroPressed,
    transmission: { ...player.transmission },
    lastShiftUpPressed: player.lastShiftUpPressed,
    lastShiftDownPressed: player.lastShiftDownPressed,
    assistMemory: { ...player.assistMemory },
    assistBadge: player.assistBadge,
    weatherVisualReductionActive: player.weatherVisualReductionActive,
    status: player.status,
    dnfTimers: { ...player.dnfTimers },
    dnfReason: player.dnfReason,
    lapTimes: player.lapTimes.slice(),
    finishedAtMs: player.finishedAtMs,
    damage: player.damage,
  };
}

function cloneAiCar(entry: Readonly<RaceSessionAICar>): RaceSessionAICar {
  return {
    car: { ...entry.car },
    state: { ...entry.state },
    nitro: { ...entry.nitro },
    lastNitroPressed: entry.lastNitroPressed,
    transmission: { ...entry.transmission },
    lastShiftUpPressed: entry.lastShiftUpPressed,
    lastShiftDownPressed: entry.lastShiftDownPressed,
    status: entry.status,
    dnfTimers: { ...entry.dnfTimers },
    dnfReason: entry.dnfReason,
    lap: entry.lap,
    lapTimes: entry.lapTimes.slice(),
    finishedAtMs: entry.finishedAtMs,
    damage: entry.damage,
  };
}
