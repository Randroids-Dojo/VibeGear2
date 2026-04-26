/**
 * Single AI driver tick for the `clean_line` archetype per §15
 * "CPU opponents and AI". Phase 1 vertical slice: one opponent on the
 * grid that proves the AI shape works end to end. Later slices add the
 * remaining archetypes (aggressive, bully, cautious, chaotic, enduro)
 * and full grid behaviour (overtake, collision avoidance, mistakes,
 * nitro, weather skill, rubber-banding).
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
 *   tickAI(driver, aiState, aiCar, player, track, race, dt)
 *     -> { input, nextAiState }
 *
 * No globals, no time source, no RNG. Same arguments produce identical
 * outputs across runs, satisfying the §21 replay/ghost determinism
 * requirement (AGENTS.md RULE 8 "Determinism is mandatory"). The clean
 * line slice contains zero randomness; the `seed` field on `AIState` is
 * carried through so later mistake-prone archetypes can stream a
 * dedicated PRNG without a breaking signature change.
 *
 * Out of scope for this slice (deferred to follow-up AI dots):
 * - Overtake / lane-shift behaviour. §15 lists it; the clean_line single
 *   AI may collide with the player. Collision avoidance lands with the
 *   full grid slice.
 * - Nitro firing. The clean_line AI never fires nitro in this slice.
 * - Mistake injection (miss apex, brake too early in fog, etc.).
 * - Weather skill modulation of `paceScalar`.
 * - Rubber-banding catch-up logic.
 */

import type { AIDriver, CarBaseStats } from "@/data/schemas";
import { CURVATURE_SCALE, ROAD_WIDTH, SEGMENT_LENGTH } from "@/road/constants";
import type { CompiledTrack } from "@/road/trackCompiler";
import { NEUTRAL_INPUT, type Input } from "./input";
import type { CarState } from "./physics";
import type { RaceState } from "./raceState";

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
  _player: Readonly<PlayerView>,
  track: Readonly<CompiledTrack>,
  race: Readonly<RaceState>,
  stats: Readonly<CarBaseStats>,
  context: Readonly<AITrackContext> = DEFAULT_AI_TRACK_CONTEXT,
  _dt: number = 0,
): AITickResult {
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
  const rawIdealOffset = -authoredCurve * AI_TUNING.MAX_RACING_LINE_OFFSET;
  const idealLateralOffset = clamp(
    rawIdealOffset === 0 ? 0 : rawIdealOffset,
    -context.roadHalfWidth,
    context.roadHalfWidth,
  );

  // Target speed per segment. §15 "AI chooses a lane offset target" plus
  // a per-driver `paceScalar` from §22 maps onto a curve-aware target
  // speed. The MIN_AI_SPEED floor keeps pathological corners drivable.
  const curvePenalty = 1 - AI_TUNING.CLEAN_LINE_CURVE_DECEL * Math.abs(authoredCurve);
  const rawTarget = stats.topSpeed * Math.max(0, curvePenalty) * driver.paceScalar;
  const targetSpeed = clamp(rawTarget, AI_TUNING.MIN_AI_SPEED, stats.topSpeed);

  // The state we will return regardless of phase. Mirrors the car so
  // other systems can read AI position without poking the physics state.
  const nextAiState: AIState = {
    progress: aiCar.z / SEGMENT_LENGTH,
    laneOffset: aiCar.x,
    speed: aiCar.speed,
    intent: aiState.intent,
    targetSpeed,
    seed: aiState.seed,
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
  track: Readonly<CompiledTrack>,
  z: number,
): CompiledTrack["segments"][number] | undefined {
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

// Numeric helpers ----------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
