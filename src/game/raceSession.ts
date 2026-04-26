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
  TransmissionModePersisted,
  UpgradeCategory,
} from "@/data/schemas";
import { SEGMENT_LENGTH } from "@/road/constants";
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
  computeWakeOffset,
  INITIAL_DRAFT_WINDOW,
  tickDraftWindow,
  type DraftCarSnapshot,
  type DraftWindowState,
} from "./drafting";
import { NEUTRAL_INPUT, type Input } from "./input";
import {
  createNitroForCar,
  getNitroAccelMultiplier,
  tickNitro,
  type NitroState,
} from "./nitro";
import {
  createTransmissionForCar,
  gearAccelMultiplier,
  maxGearForUpgrades,
  tickTransmission,
  type TransmissionState,
} from "./transmission";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
  type CarState,
  type TrackContext,
} from "./physics";
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

export interface RaceSessionConfig {
  /** Compiled track to drive on. Frozen output of `compileTrack`. */
  track: CompiledTrack;
  /** Optional physics + AI track context. Defaults derive from `ROAD_WIDTH`. */
  trackContext?: TrackContext;
  aiContext?: AITrackContext;
  player: RaceSessionPlayer;
  ai: ReadonlyArray<RaceSessionAI>;
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
}

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
  };

  const ai: RaceSessionAICar[] = config.ai.map((entry, index) => {
    const seed = entry.seed ?? INITIAL_AI_STATE.seed + index + 1;
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
  };

  const sectorTimer = createSectorState(config.track.checkpoints);

  return {
    race,
    player,
    ai,
    tick: 0,
    sectorTimer,
    baselineSplitsMs: null,
    draftWindows: {},
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
 * - `racing`: runs physics for the player and each AI, advances `elapsed` and
 *   `tick`, checks lap completion. On lap rollover records the lap time and
 *   updates best. When the player finishes the final lap the phase flips to
 *   `finished` and we stop integrating physics.
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
        player: {
          car: { ...state.player.car },
          nitro: { ...state.player.nitro },
          lastNitroPressed: state.player.lastNitroPressed,
          transmission: { ...state.player.transmission },
          lastShiftUpPressed: state.player.lastShiftUpPressed,
          lastShiftDownPressed: state.player.lastShiftDownPressed,
        },
        ai: state.ai.map((entry) => ({
          car: { ...entry.car },
          state: { ...entry.state },
          nitro: { ...entry.nitro },
          lastNitroPressed: entry.lastNitroPressed,
          transmission: { ...entry.transmission },
          lastShiftUpPressed: entry.lastShiftUpPressed,
          lastShiftDownPressed: entry.lastShiftDownPressed,
        })),
        tick: state.tick + 1,
        sectorTimer: state.sectorTimer,
        baselineSplitsMs: state.baselineSplitsMs,
        draftWindows: state.draftWindows,
      };
    }
    // Lights out. Flip to racing, zero the tick clock, reset the sector
    // timer so its lap-start tick matches the green light, then drop into
    // the racing branch below by recursing with the promoted state.
    const promoted: RaceSessionState = {
      race: {
        ...state.race,
        phase: "racing",
        countdownRemainingSec: 0,
        elapsed: 0,
      },
      player: {
        car: { ...state.player.car },
        nitro: { ...state.player.nitro },
        lastNitroPressed: state.player.lastNitroPressed,
        transmission: { ...state.player.transmission },
        lastShiftUpPressed: state.player.lastShiftUpPressed,
        lastShiftDownPressed: state.player.lastShiftDownPressed,
      },
      ai: state.ai.map((entry) => ({
        car: { ...entry.car },
        state: { ...entry.state },
        nitro: { ...entry.nitro },
        lastNitroPressed: entry.lastNitroPressed,
        transmission: { ...entry.transmission },
        lastShiftUpPressed: entry.lastShiftUpPressed,
        lastShiftDownPressed: entry.lastShiftDownPressed,
      })),
      tick: 0,
      sectorTimer: createSectorState(config.track.checkpoints),
      baselineSplitsMs: state.baselineSplitsMs,
      draftWindows: state.draftWindows,
    };
    return stepRaceSession(promoted, playerInput, config, dt);
  }

  // Racing branch.
  const buffer = bufferView(config.track);
  const trackLength = config.track.totalLengthMeters;
  const playerStats = config.player.stats;
  const playerUpgradeTier = config.player.upgrades?.nitro;

  // §10 nitro: advance the reducer for the player using their nitro
  // input, then feed `getNitroAccelMultiplier` into the physics step's
  // `accelMultiplier` slot so an active charge scales acceleration.
  const playerNitroResult = tickNitro(
    state.player.nitro,
    {
      nitroPressed: playerInput.nitro,
      wasPressed: state.player.lastNitroPressed,
      upgradeTier: playerUpgradeTier,
    },
    dt,
  );
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
  // so the edge-gating below has no effect on auto-only players.
  const playerMaxGear = maxGearForUpgrades(config.player.upgrades ?? null);
  const playerShiftUpEdge =
    playerInput.shiftUp && !state.player.lastShiftUpPressed;
  const playerShiftDownEdge =
    playerInput.shiftDown && !state.player.lastShiftDownPressed;
  const playerTransmission = tickTransmission(
    state.player.transmission,
    {
      throttle: playerInput.throttle,
      brake: playerInput.brake,
      shiftUp: playerShiftUpEdge,
      shiftDown: playerShiftDownEdge,
      speed: state.player.car.speed,
      topSpeed: playerStats.topSpeed,
      maxGear: playerMaxGear,
    },
    dt,
  );
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
    scanEntry(PLAYER_CAR_ID, state.player.car, playerInput, state.race.lap, trackLength),
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
  const nextPlayerCar = step(
    state.player.car,
    playerInput,
    playerStats,
    trackContext,
    dt,
    { accelMultiplier: playerAccelMultiplier, draftBonus: playerDraftBonus },
  );

  const nextAi: RaceSessionAICar[] = state.ai.map((entry, index) => {
    const aiConfig = config.ai[index];
    const tick = aiTickResults[index];
    if (!aiConfig || !tick) {
      return {
        car: { ...entry.car },
        state: { ...entry.state },
        nitro: { ...entry.nitro },
        lastNitroPressed: entry.lastNitroPressed,
        transmission: { ...entry.transmission },
        lastShiftUpPressed: entry.lastShiftUpPressed,
        lastShiftDownPressed: entry.lastShiftDownPressed,
      };
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
    const nextCar = step(
      entry.car,
      tick.input,
      aiConfig.stats,
      trackContext,
      dt,
      { accelMultiplier: aiAccelMultiplier, draftBonus: aiDraftBonus },
    );
    return {
      car: nextCar,
      state: tick.nextAiState,
      nitro: aiNitroResult.state,
      lastNitroPressed: tick.input.nitro,
      transmission: aiTransmission,
      lastShiftUpPressed: tick.input.shiftUp,
      lastShiftDownPressed: tick.input.shiftDown,
    };
  });

  const nextElapsed = state.race.elapsed + dt;
  const nextTick = state.tick + 1;

  // Lap completion. Floor of cumulative track distance.
  let nextLap = state.race.lap;
  let lastLapTimeMs = state.race.lastLapTimeMs;
  let bestLapTimeMs = state.race.bestLapTimeMs;
  let nextPhase: RaceState["phase"] = state.race.phase;

  if (trackLength > 0) {
    const lapsCompleted = Math.floor(nextPlayerCar.z / trackLength);
    const intendedLap = lapsCompleted + 1;
    if (intendedLap > state.race.lap) {
      // One or more laps crossed this tick. The MVP records a single lap
      // time for the most recent crossing; multi-lap-per-tick can only
      // happen with absurd dt and is not relevant for 60 Hz.
      const elapsedMs = Math.max(1, Math.round(nextElapsed * 1000));
      lastLapTimeMs = elapsedMs;
      bestLapTimeMs =
        bestLapTimeMs === null
          ? elapsedMs
          : Math.min(bestLapTimeMs, elapsedMs);
      nextLap = intendedLap;
      if (nextLap > state.race.totalLaps) {
        nextPhase = "finished";
        nextLap = state.race.totalLaps;
      }
    }
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
      lastNitroPressed: playerInput.nitro,
      transmission: playerTransmission,
      lastShiftUpPressed: playerInput.shiftUp,
      lastShiftDownPressed: playerInput.shiftDown,
    },
    ai: nextAi,
    tick: nextTick,
    sectorTimer: nextSectorTimer,
    baselineSplitsMs: nextBaseline,
    draftWindows: nextDraftWindows,
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
    player: {
      car: { ...state.player.car },
      nitro: { ...state.player.nitro },
      lastNitroPressed: state.player.lastNitroPressed,
      transmission: { ...state.player.transmission },
      lastShiftUpPressed: state.player.lastShiftUpPressed,
      lastShiftDownPressed: state.player.lastShiftDownPressed,
    },
    ai: state.ai.map((entry) => ({
      car: { ...entry.car },
      state: { ...entry.state },
      nitro: { ...entry.nitro },
      lastNitroPressed: entry.lastNitroPressed,
      transmission: { ...entry.transmission },
      lastShiftUpPressed: entry.lastShiftUpPressed,
      lastShiftDownPressed: entry.lastShiftDownPressed,
    })),
    tick: state.tick,
    sectorTimer: state.sectorTimer,
    baselineSplitsMs: state.baselineSplitsMs,
    draftWindows: state.draftWindows,
  };
}
