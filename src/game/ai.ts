/**
 * AI driver tick for the §15 "CPU opponents and AI" archetypes.
 * The controller stays in progress space and dispatches through
 * `aiArchetypes.ts` for rocket starter, clean line, bully, cautious,
 * chaotic, and enduro behaviour.
 *
 * Source of truth: `docs/gdd/15-cpu-opponents-and-ai.md`. The "AI is
 * simulated in track-progress space, not free-driving 3D rigid bodies"
 * directive is followed here: the AI consumes its own `CarState` (the
 * same kinematic shape the §10 physics step produces) and a compiled
 * track to derive an ideal lateral offset and a target speed per
 * segment, then maps both onto the canonical `Input` shape that the
 * physics step accepts. This keeps the AI decoupled from rendering and
 * lets the same loop drive the player car or any AI car interchangeably.
 *
 * The function is pure:
 *
 *   tickAI(
 *     driver,
 *     aiState,
 *     aiCar,
 *     player,
 *     track,
 *     race,
 *     stats,
 *     context,
 *     dt,
 *     cpuModifiers,
 *     weatherSkillScalar,
 *     visibilityRiskScalar,
 *   )
 *     -> { input, nextAiState }
 *
 * No globals or time source. Same arguments, including `AIState.seed`,
 * produce identical outputs across runs, satisfying the §21
 * replay/ghost determinism requirement (AGENTS.md RULE 8 "Determinism
 * is mandatory"). The `seed` field on `AIState` is the dedicated
 * deterministic PRNG channel for the shared AI mistake hook.
 *
 * §23 "CPU difficulty modifiers" wiring: `tickAI` accepts an optional
 * `cpuModifiers` parameter (the §15-tier scalars from
 * `aiDifficulty.getCpuModifiers`) and stacks all three scalar columns
 * on top of per-driver AI data. `paceScalar` raises or lowers target
 * speed, `recoveryScalar` scales the light catch-up term when an AI
 * trails the player, and `mistakeScalar` scales the per-driver
 * `mistakeRate` for deterministic lane-target mistakes. Defaults to a
 * legacy identity row so existing callers keep behavior unchanged.
 *
 * Weather skill wiring: callers may pass `weatherSkillScalar` as the
 * compact §15 weather-skill row resolved for the active weather. It is
 * a number rather than an adjusted modifiers object so the 60 Hz race
 * loop does not allocate one object per AI per tick.
 *
 * Visibility-risk wiring: callers may pass a §14 low-visibility risk
 * scalar resolved from active weather. It multiplies deterministic
 * lane-target mistake odds so heavy weather and fog raise collision
 * risk through poorer read distance without changing hit geometry.
 *
 * Out of scope for this slice (deferred to follow-up AI dots):
 * - Overtake / lane-shift behaviour. §15 lists it; an AI may still
 *   collide with the player. Collision avoidance lands with the
 *   full grid slice.
 * - AI nitro firing. Not implemented in this slice.
 * - Full passing logic with inside / outside pass preferences.
 * - Damage-aware rub avoidance and contact fairness scoring.
 */

import type { AIDriver, CarBaseStats } from "@/data/schemas";
import { CURVATURE_SCALE, ROAD_WIDTH, SEGMENT_LENGTH } from "@/road/constants";
import type { CompiledSegmentBuffer } from "@/road/trackCompiler";
import type { CpuDifficultyModifiers } from "./aiDifficulty";
import { getAIBehaviour } from "./aiArchetypes";
import { NEUTRAL_INPUT, type Input } from "./input";
import type { CarState } from "./physics";
import type { RaceState } from "./raceState";
import { deserializeRng } from "./rng";
import { WEATHER_VISIBILITY_RISK_MAX_SCALAR } from "./weather";

/**
 * Legacy identity CPU modifier row used as the default when a caller
 * does not supply tier-resolved §23 scalars. Each scalar is `1.0` so
 * the per-driver `paceScalar`, `mistakeRate`, and light recovery term
 * pass through unchanged for any caller that has not yet adopted the
 * tier wiring.
 */
export const IDENTITY_CPU_MODIFIERS: CpuDifficultyModifiers = Object.freeze({
  paceScalar: 1,
  recoveryScalar: 1,
  mistakeScalar: 1,
});

/**
 * Per-AI runtime state. Pinned by the dot stress-test:
 *
 * - `progress`: scalar position along the lap spline (compiled-segment
 *   index, fractional). Derived from `aiCar.z / SEGMENT_LENGTH` each
 *   tick; carried in state so future archetypes can detect lap
 *   transitions (intent changes, defensive lane swaps) without re
 *   computing across calls.
 * - `laneOffset`: signed lateral position in meters, mirroring `aiCar.x`.
 *   Carried so future overtake logic can reference last-tick offset
 *   without poking into the physics state.
 * - `speed`: current speed in m/s, mirroring `aiCar.speed`.
 * - `intent`: high-level driving mode per §15. The clean_line slice
 *   never leaves "conserve" but the field exists so other archetypes
 *   can flip without a schema change.
 * - `targetSpeed`: the requested speed for this tick, useful for
 *   telemetry overlays and for the throttle/brake controller.
 * - `seed`: per-AI PRNG channel for archetypes that randomise mistakes
 *   or nitro decisions. clean_line ignores this field but it must be
 *   present so adding it later does not break any caller.
 */
export interface AIState {
  progress: number;
  laneOffset: number;
  speed: number;
  intent: "defend" | "overtake" | "recover" | "conserve";
  targetSpeed: number;
  seed: number;
}

/**
 * Initial AI state convenience: stationary at the start of the track
 * with `conserve` intent and a fresh seed. Callers building a grid
 * should override `seed` per slot so future PRNG-driven archetypes
 * decorrelate.
 */
export const INITIAL_AI_STATE: Readonly<AIState> = Object.freeze({
  progress: 0,
  laneOffset: 0,
  speed: 0,
  intent: "conserve",
  targetSpeed: 0,
  seed: 1,
});

/**
 * Tunable constants for the clean_line archetype. Pinned in the dot
 * stress-test (items 4 through 7) so the controller is fully specified
 * without re-reading the GDD. Future archetypes will fork their own
 * constants object; this one stays the clean_line baseline.
 */
export const AI_TUNING = Object.freeze({
  /**
   * Maximum lateral offset for the racing-line approximation, in meters.
   * The AI biases toward the inside of curves up to this distance from
   * centerline. Capped at 70 percent of the road half-width so the AI
   * keeps a small margin to the rumble.
   */
  MAX_RACING_LINE_OFFSET: ROAD_WIDTH * 0.7,
  /**
   * Curve-driven deceleration coefficient. A unit-curvature turn cuts
   * target speed by this fraction before the per-driver `paceScalar`.
   * Tuned so a typical |curve|=0.5 segment trims ~30 percent off top.
   */
  CLEAN_LINE_CURVE_DECEL: 0.6,
  /**
   * Floor on AI target speed in m/s. Prevents pathological corners from
   * forcing the AI to a complete stop, which would visually look broken.
   */
  MIN_AI_SPEED: 8,
  /**
   * Speed-error band around the target where the AI cruises. Inside
   * this band the AI feathers the throttle proportional to the error
   * sign, eliminating high-frequency bang-bang oscillation.
   */
  SPEED_HYSTERESIS: 1.5,
  /**
   * Speed overshoot at which the AI applies full brake. Below this the
   * brake input ramps linearly with the overshoot.
   */
  BRAKE_RAMP: 6,
  /**
   * Lateral error at which the AI applies full steer. Inside this band
   * the steer input ramps linearly with the lateral error. A P
   * controller is sufficient for clean_line; later archetypes may add
   * a damping term.
   */
  STEER_GAIN: 1.5,
  /**
   * Maximum lane-target offset injected by a deterministic mistake, in
   * meters. Kept below the road half-width so a mistake nudges the AI
   * toward a worse line without teleporting it off the road.
   */
  MAX_MISTAKE_OFFSET: ROAD_WIDTH * 0.35,
  /**
   * Maximum pace lift from the light catch-up term before the §23
   * `recoveryScalar` row is applied. The term only applies while the AI
   * trails the player and remains below the chassis top-speed clamp.
   */
  MAX_RECOVERY_PACE_BONUS: 0.05,
  /** Player gap, in meters, that reaches the maximum recovery term. */
  RECOVERY_GAP_FOR_MAX_BONUS: 240,
  /** Lap fraction where rocket starter launch boost stops applying. */
  ROCKET_LAUNCH_FRACTION: 0.18,
  /** Lap fraction where rocket starter late fade starts applying. */
  ROCKET_FADE_FRACTION: 0.72,
  /** Player gap where archetype lane pressure can engage. */
  TRAFFIC_PRESSURE_WINDOW_METERS: 36,
});

/**
 * Track context the AI needs from the renderer, mirroring physics's
 * `TrackContext`. Kept narrow so tests do not need to construct a
 * full `Track` to exercise the AI.
 */
export interface AITrackContext {
  roadHalfWidth: number;
}

/** Default context using the renderer's `ROAD_WIDTH` constant. */
export const DEFAULT_AI_TRACK_CONTEXT: Readonly<AITrackContext> = Object.freeze({
  roadHalfWidth: ROAD_WIDTH,
});

/**
 * Minimal player view the AI consumes. Kept to one nested object now so
 * later overtake / collision-avoidance work can extend it without a
 * cascade of signature changes across all archetypes. The clean_line
 * slice does not actually read the player but takes the field so the
 * shape is stable.
 */
export interface PlayerView {
  car: Readonly<CarState>;
}

/** Output of one AI tick. */
export interface AITickResult {
  input: Input;
  nextAiState: AIState;
}

/**
 * Single AI tick. Pure: never mutates inputs; returns a fresh state and
 * a fresh `Input`. The result is the AI's contribution to the next
 * physics step.
 *
 * Edge cases handled here (per the dot's "Edge Cases" section):
 * - `race.phase !== "racing"`: returns `NEUTRAL_INPUT` and an updated
 *   state that still mirrors the AI's car position, so telemetry
 *   overlays can show the grid before the lights go green.
 * - AI off-track: the steer P-controller naturally pulls the AI back
 *   toward `idealLateralOffset = 0` once it crosses the rumble (because
 *   the curve sign at that local segment is small relative to the
 *   lateral error). No separate recovery state is required for the
 *   clean_line slice.
 * - Empty compiled track: fall through to a straight-line target with
 *   curve = 0. Defends against a degenerate compile result; the dot's
 *   spec keeps tests from constructing one but the guard is cheap.
 */
export function tickAI(
  driver: Readonly<AIDriver>,
  aiState: Readonly<AIState>,
  aiCar: Readonly<CarState>,
  player: Readonly<PlayerView>,
  track: Readonly<CompiledSegmentBuffer>,
  race: Readonly<RaceState>,
  stats: Readonly<CarBaseStats>,
  context: Readonly<AITrackContext> = DEFAULT_AI_TRACK_CONTEXT,
  _dt: number = 0,
  cpuModifiers: Readonly<CpuDifficultyModifiers> = IDENTITY_CPU_MODIFIERS,
  weatherSkillScalar: number = 1,
  visibilityRiskScalar: number = 1,
): AITickResult {
  const behaviour = getAIBehaviour(driver.archetype);
  const segment = currentSegment(track, aiCar.z);
  // `segment.curve` is the per-compiled-segment dx contribution, already
  // divided by `CURVATURE_SCALE` by the track compiler. The AI reasons
  // about the authored curvature instead (range -1..1 per the
  // `TrackSegmentSchema`) so the `MAX_RACING_LINE_OFFSET` and
  // `CLEAN_LINE_CURVE_DECEL` constants read against the same magnitude
  // a track author would type.
  const authoredCurve = segment ? segment.curve * CURVATURE_SCALE : 0;

  // Racing line: bias toward the inside of the curve. §15 "Track defines
  // a center path and suggested racing line bias curves" is approximated
  // here from the segment curve directly because no per-segment racing
  // line bias field exists in the data schema yet. When that schema
  // lands, replace this with `segment.racingLineBias`. The leading `0 +`
  // converts a `-0` from the multiplication on a perfectly straight
  // segment back to `+0` so call-sites can `expect(steer).toBe(0)`.
  const rawIdealOffset =
    -authoredCurve *
    AI_TUNING.MAX_RACING_LINE_OFFSET *
    behaviour.racingLineScalar;
  const trafficLaneOffset = trafficPressureOffset(
    behaviour.trafficLanePressure,
    driver.aggression,
    aiCar,
    player.car,
    context.roadHalfWidth,
  );
  const idealOffsetWithTraffic = rawIdealOffset + trafficLaneOffset;
  const baseIdealLateralOffset = clamp(
    idealOffsetWithTraffic === 0 ? 0 : idealOffsetWithTraffic,
    -context.roadHalfWidth,
    context.roadHalfWidth,
  );
  const effectiveMistakeRate = clamp(
    driver.mistakeRate *
      behaviour.mistakeScalar *
      cpuModifiers.mistakeScalar *
      clamp(visibilityRiskScalar, 1, WEATHER_VISIBILITY_RISK_MAX_SCALAR),
    0,
    1,
  );
  let nextSeed = aiState.seed;
  let mistakeOffset = 0;
  let brilliantPaceBonus = 0;
  if (
    race.phase === "racing" &&
    (effectiveMistakeRate > 0 || behaviour.brilliantChance > 0)
  ) {
    const mistakeRng = deserializeRng(aiState.seed);
    const mistakeActive = mistakeRng.nextBool(effectiveMistakeRate);
    const mistakeDirection = mistakeRng.next() < 0.5 ? -1 : 1;
    mistakeOffset = mistakeActive
      ? mistakeDirection * AI_TUNING.MAX_MISTAKE_OFFSET
      : 0;
    if (mistakeRng.nextBool(behaviour.brilliantChance)) {
      brilliantPaceBonus = behaviour.brilliantPaceBonus;
    }
    nextSeed = mistakeRng.state;
  }
  const idealLateralOffset = clamp(
    baseIdealLateralOffset + mistakeOffset,
    -context.roadHalfWidth,
    context.roadHalfWidth,
  );

  const playerLeadMeters = Math.max(0, player.car.z - aiCar.z);
  const recoveryPaceBonus =
    clamp(
      playerLeadMeters / AI_TUNING.RECOVERY_GAP_FOR_MAX_BONUS,
      0,
      1,
    ) *
    AI_TUNING.MAX_RECOVERY_PACE_BONUS *
    cpuModifiers.recoveryScalar *
    behaviour.recoveryScalar;

  // Target speed per segment. §15 "AI chooses a lane offset target" plus
  // a per-driver `paceScalar` from §22 maps onto a curve-aware target
  // speed. The MIN_AI_SPEED floor keeps pathological corners drivable.
  // §23 "CPU difficulty modifiers" stacks the player-facing tier
  // `paceScalar` on top of the per-driver scalar so a clean_line driver
  // at Hard targets ~5% above the same driver at Normal, while at Easy
  // the same driver targets ~8% below. Identity modifiers (the default
  // when a caller has not threaded the resolved tier) preserve
  // pre-binding behaviour bit-for-bit. `weatherSkillScalar` stacks the
  // compact §15 weather-skill row without allocating adjusted modifier
  // objects per AI tick. The composed target is then re-clamped at
  // `stats.topSpeed` so a Master-tier driver with an authored
  // `paceScalar > 1` still cannot exceed the chassis ceiling.
  const curvePenalty =
    1 -
    AI_TUNING.CLEAN_LINE_CURVE_DECEL *
      behaviour.curveBrakeScalar *
      Math.abs(authoredCurve);
  const lapProgressFraction = lapFraction(track.totalLength, aiCar.z);
  const launchPaceBonus =
    lapProgressFraction < AI_TUNING.ROCKET_LAUNCH_FRACTION
      ? behaviour.launchPaceBonus
      : 0;
  const fadePacePenalty =
    lapProgressFraction > AI_TUNING.ROCKET_FADE_FRACTION
      ? behaviour.fadePacePenalty
      : 0;
  const composedPaceScalar =
    driver.paceScalar *
    behaviour.targetSpeedScalar *
    cpuModifiers.paceScalar *
    clamp(weatherSkillScalar, 0, 2) *
    (1 + launchPaceBonus + brilliantPaceBonus - fadePacePenalty);
  const rawTarget =
    stats.topSpeed *
    Math.max(0, curvePenalty) *
    composedPaceScalar *
    (1 + recoveryPaceBonus);
  const targetSpeed = clamp(rawTarget, AI_TUNING.MIN_AI_SPEED, stats.topSpeed);

  // The state we will return regardless of phase. Mirrors the car so
  // other systems can read AI position without poking the physics state.
  const nextAiState: AIState = {
    progress: aiCar.z / SEGMENT_LENGTH,
    laneOffset: aiCar.x,
    speed: aiCar.speed,
    intent: aiState.intent,
    targetSpeed,
    seed: nextSeed,
  };

  // Countdown: do not integrate inputs. Per the dot stress-test item 10
  // the AI returns `NEUTRAL_INPUT` and waits. The fresh state still
  // mirrors `aiCar` so a stationary grid renders correctly.
  if (race.phase !== "racing") {
    return { input: { ...NEUTRAL_INPUT }, nextAiState };
  }

  // Throttle / brake from speed error. Three regimes:
  // - error > +hysteresis: full throttle, no brake.
  // - error < -hysteresis: no throttle, brake proportional to overshoot.
  // - within band: proportional throttle, no brake.
  const speedError = targetSpeed - aiCar.speed;
  let throttle = 0;
  let brake = 0;
  if (speedError > AI_TUNING.SPEED_HYSTERESIS) {
    throttle = 1;
  } else if (speedError < -AI_TUNING.SPEED_HYSTERESIS) {
    brake = clamp(-speedError / AI_TUNING.BRAKE_RAMP, 0, 1);
  } else {
    throttle = clamp(speedError / AI_TUNING.SPEED_HYSTERESIS, 0, 1);
  }

  // Steer from lateral error. P-controller with a 1.5 m authority band.
  // Off-track recovery is implicit: once `aiCar.x` crosses the rumble
  // the lateral error grows and pulls the AI back toward the racing
  // line.
  const lateralError = idealLateralOffset - aiCar.x;
  const steer = clamp(lateralError / AI_TUNING.STEER_GAIN, -1, 1);

  const input: Input = {
    steer,
    throttle,
    brake,
    nitro: false,
    handbrake: false,
    pause: false,
    shiftUp: false,
    shiftDown: false,
  };

  return { input, nextAiState };
}

/**
 * Look up the compiled segment under the given world Z position.
 * Returns `undefined` when the track is empty so the caller can fall
 * back to a straight-line default. Wraps with modulo so AIs that drive
 * past the compiled length keep producing sensible decisions until the
 * race lifecycle catches up and ends the session.
 */
function currentSegment(
  track: Readonly<CompiledSegmentBuffer>,
  z: number,
): CompiledSegmentBuffer["segments"][number] | undefined {
  const segments = track.segments;
  if (segments.length === 0) return undefined;
  const totalLength = track.totalLength;
  // Defend against zero or non-finite z; clamp into the ring.
  let normalized = z;
  if (!Number.isFinite(normalized)) normalized = 0;
  if (totalLength > 0) {
    normalized = ((normalized % totalLength) + totalLength) % totalLength;
  } else {
    normalized = 0;
  }
  const index = Math.min(
    segments.length - 1,
    Math.max(0, Math.floor(normalized / SEGMENT_LENGTH)),
  );
  return segments[index];
}

function lapFraction(totalLength: number, z: number): number {
  if (!Number.isFinite(totalLength) || totalLength <= 0) return 0;
  const normalized = ((z % totalLength) + totalLength) % totalLength;
  return clamp(normalized / totalLength, 0, 1);
}

function trafficPressureOffset(
  pressure: number,
  aggression: number,
  aiCar: Readonly<CarState>,
  playerCar: Readonly<CarState>,
  roadHalfWidth: number,
): number {
  if (pressure === 0) return 0;
  const gap = playerCar.z - aiCar.z;
  if (Math.abs(gap) > AI_TUNING.TRAFFIC_PRESSURE_WINDOW_METERS) return 0;
  const closeness =
    1 - Math.abs(gap) / AI_TUNING.TRAFFIC_PRESSURE_WINDOW_METERS;
  const direction = clamp(
    (playerCar.x - aiCar.x) / Math.max(roadHalfWidth, 1),
    -1,
    1,
  );
  return direction * pressure * clamp(aggression, 0, 1) * closeness;
}

// Numeric helpers ----------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
