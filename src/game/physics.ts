/**
 * Arcade physics step for the player car.
 *
 * Source of truth: `docs/gdd/10-driving-model-and-physics.md`. Numeric
 * defaults derive from `docs/gdd/11-cars-and-stats.md` and
 * `docs/gdd/23-balancing-tables.md` (per-car `baseStats`).
 *
 * The step is a pure function:
 *
 *   step(state, input, context, dt) -> state
 *
 * No globals, no time source, no RNG. Same arguments produce identical
 * outputs across runs, which is what the §21 replay/ghost system requires
 * (AGENTS.md RULE 8 "Determinism is mandatory").
 *
 * Coordinate conventions:
 * - `z` is forward distance along the track centerline, in meters. Always
 *   non-decreasing while the car is moving forward.
 * - `x` is lateral offset from the road centerline, in meters. Negative is
 *   left, positive is right. The drivable surface spans
 *   `[-ROAD_WIDTH, +ROAD_WIDTH]`; outside that band is off-road.
 * - `speed` is forward speed in m/s. Always non-negative for the MVP.
 *   Reverse is not modelled in this slice (see Phase 2 followup).
 *
 * MVP scope: this slice covers acceleration, top-speed clamp, brake,
 * lane-relative steering, and off-road slowdown. Collisions, traction
 * loss, drifting, jumps, nitro, weather, and damage are all tracked as
 * later slices per `docs/IMPLEMENTATION_PLAN.md`. The state shape is
 * intentionally minimal so those slices can extend it additively
 * without a breaking rewrite.
 *
 * Drafting bonus: the optional `draftBonus` field on `StepOptions` is a
 * multiplicative scalar applied to the throttle-driven acceleration only.
 * Computed by the pure helpers in `./drafting.ts`. Defaults to 1.0
 * (no bonus) so existing callers keep their behaviour.
 */

import type { CarBaseStats } from "@/data/schemas";
import { ROAD_WIDTH } from "@/road/constants";
import type { DamageScalars } from "./damageBands";
import { PRISTINE_SCALARS } from "./damageBands";
import type { Input } from "./input";

/**
 * Off-road handling tunables from §10 "Suggested tunable constants".
 *
 * These are the starter-tier values from the table. Mid and late tier
 * variants exist; we plumb a single set here and let the per-car stats
 * layer decide whether to override later. Off-road behaviour is mostly
 * grip-class agnostic in §10, so a shared constant is faithful to the
 * design until a balancing slice proves otherwise.
 */
export const OFF_ROAD_CAP_M_PER_S = 24;
export const OFF_ROAD_DRAG_M_PER_S2 = 18;

/**
 * Multiplier applied to `roadHalfWidth` to define the outer edge of the
 * rumble band. Matches the strip drawer's `near.screenW * 1.15` rumble
 * trapezoid in `pseudoRoadCanvas.drawStrips`. The drivable surface is
 * `[-roadHalfWidth, +roadHalfWidth]`; the rumble band sits in
 * `(roadHalfWidth, roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE]` on each side;
 * grass is anything beyond.
 *
 * Why expose the constant rather than re-deriving from the drawer? The
 * physics layer must agree with the renderer on what counts as rumble vs
 * grass so dust particles only emit when the player is visually on grass.
 * Pinning the scalar here keeps the two layers in lockstep without
 * importing the renderer (which would invert the dependency direction).
 */
export const RUMBLE_HALF_WIDTH_SCALE = 1.15;

/**
 * Surface the car is on this tick. Derived from `|car.x|` against
 * `roadHalfWidth`. `road` covers the drivable surface, `rumble` the band
 * just outside, `grass` everything beyond.
 *
 * The renderer's dust pool consumes this flag to decide whether to emit
 * particles; a future surface-audio slice can dispatch tyre-rumble SFX
 * off the same flag without re-deriving the geometry.
 */
export type Surface = "road" | "rumble" | "grass";

/**
 * Coast (no throttle, no brake) drag in m/s^2. §10 lists 4.5 / 4.0 / 3.5
 * across starter/mid/late tiers; we use the starter value for the MVP.
 */
export const COASTING_DRAG_M_PER_S2 = 4.5;

/**
 * Steering rate band, in radians per second. §10 lists three tiers; the
 * starter values are used for the MVP. The "rate" here is the angular
 * authority of the front wheels, not the heading; we translate it into a
 * lateral velocity contribution in `step()` so the car drifts toward the
 * side the driver is steering.
 *
 * Why an angular rate? §10 specifies `yawDelta = steerInput * steerRate
 * * dt * tractionScalar`. The MVP renderer does not show yaw, so we
 * project the yaw delta onto a lateral velocity by multiplying by the
 * forward speed. That keeps the §10 equation intact while producing the
 * lane-relative behaviour the dot calls for.
 */
export const STEER_RATE_LOW_RAD_PER_S = 2.3;
export const STEER_RATE_HIGH_RAD_PER_S = 1.25;

/**
 * Speed at which steering response transitions from "low" (tight) to
 * "high" (subtle). The §10 lerp uses `speedNorm` against the car's top
 * speed; we keep that ratio here.
 */
function steerRateForSpeed(speed: number, topSpeed: number): number {
  if (topSpeed <= 0) return STEER_RATE_LOW_RAD_PER_S;
  const speedNorm = clamp(speed / topSpeed, 0, 1);
  return lerp(STEER_RATE_LOW_RAD_PER_S, STEER_RATE_HIGH_RAD_PER_S, speedNorm);
}

/**
 * Pure car kinematic state. Extended additively by later slices
 * (heading, traction, nitro charges, damage). Nothing in this slice
 * stores time references; the loop owns the clock.
 *
 * `surface` is the surface classification the car is on as of the END of
 * the most recent step. `INITIAL_CAR_STATE` pins it to `"road"` so a
 * fresh state at the centerline reads consistently before any tick has
 * run. Pure consumers (dust, future surface SFX) should treat this as
 * the canonical signal rather than re-deriving from `x`.
 */
export interface CarState {
  /** Forward distance along track centerline in meters. */
  z: number;
  /** Lateral offset from centerline in meters. Negative = left. */
  x: number;
  /** Forward speed in m/s. Always >= 0 in the MVP. */
  speed: number;
  /** Surface classification at the end of the most recent step. */
  surface: Surface;
}

/** Initial state convenience: stationary at the centerline at z=0. */
export const INITIAL_CAR_STATE: Readonly<CarState> = Object.freeze({
  z: 0,
  x: 0,
  speed: 0,
  surface: "road",
});

/**
 * Track context the physics layer needs from the renderer. Kept narrow on
 * purpose: passing the full `Track` would couple physics to data-schemas
 * and force tests to construct full tracks for trivial cases.
 *
 * `roadHalfWidth` is the lateral half-width of the drivable surface. The
 * default is `ROAD_WIDTH` from the renderer. Tracks may override it once
 * the data schema gains a per-track override field.
 */
export interface TrackContext {
  roadHalfWidth: number;
}

/** Default context using the renderer's `ROAD_WIDTH` constant. */
export const DEFAULT_TRACK_CONTEXT: Readonly<TrackContext> = Object.freeze({
  roadHalfWidth: ROAD_WIDTH,
});

/**
 * Optional per-tick modifiers to the physics step. Kept separate from
 * `TrackContext` because these vary per-tick (drafting), per-driver
 * (damage band), or per-input frame, while `TrackContext` is fixed for
 * the duration of a race.
 *
 * `draftBonus` is a multiplicative scalar applied to the throttle-driven
 * acceleration. The pure helpers in `./drafting.ts` compute the value;
 * passing `1` (or omitting the field entirely) means "no bonus". The
 * field is clamped to a sane band (`[1, 1.5]`) inside `step()` so a buggy
 * caller cannot turn a draft bonus into a top-speed override.
 *
 * `damageScalars` are the per-band performance multipliers from
 * `./damageBands.ts`. The race session resolves the band from the
 * driver's current `DamageState.total` and passes the scalars in. When
 * omitted, `step()` uses `PRISTINE_SCALARS` so existing callers keep
 * their behaviour. Only `topSpeedScalar` and `gripScalar` are read
 * inside `step()` today: the §10 "stability", "nitroEfficiency", and
 * "spinRiskMultiplier" knobs are owned by their respective slices
 * (steering smoothing, nitro system, traction loss) and read the
 * scalars off the same field without a second resolve.
 */
export interface StepOptions {
  draftBonus?: number;
  damageScalars?: Readonly<DamageScalars>;
}

/** Conservative upper bound on the draft bonus inside the step. */
export const DRAFT_BONUS_MAX = 1.5;

/**
 * Advance the car state by `dt` seconds. Pure: no mutation of the input
 * `state`; a fresh object is returned even when nothing changes. Callers
 * should treat the result as the canonical next state.
 *
 * Edge cases handled here (per the dot's "Edge Cases" section):
 * - `dt <= 0`: state unchanged. The loop never feeds us negative dt, but
 *   defending against zero keeps the function safe for unit tests that
 *   want to evaluate "did anything happen this frame".
 * - `speed` clamped at `stats.topSpeed`. Acceleration cannot push past it.
 * - Brake while at zero speed does not invert the velocity. We treat
 *   "brake" as deceleration toward zero, never below.
 * - Steering at zero speed produces no lateral movement: the §10 yaw
 *   formula is multiplied by `speed` so the car cannot crab sideways.
 * - Off-road for one frame: reduces traction (via `gripDry` halving) and
 *   applies extra drag, but no damage. Damage is a later slice.
 */
export function step(
  state: Readonly<CarState>,
  input: Readonly<Input>,
  stats: Readonly<CarBaseStats>,
  context: Readonly<TrackContext>,
  dt: number,
  options: Readonly<StepOptions> = {},
): CarState {
  if (!Number.isFinite(dt) || dt <= 0) {
    return {
      z: state.z,
      x: state.x,
      speed: state.speed,
      surface: state.surface,
    };
  }

  const offRoad = isOffRoad(state.x, context.roadHalfWidth);

  // Longitudinal: integrate throttle, brake, drag, then clamp.
  let nextSpeed = state.speed;
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  const draftBonus = clamp(options.draftBonus ?? 1, 1, DRAFT_BONUS_MAX);
  // Damage scalars: clamp each consumed field defensively. A buggy
  // upstream caller cannot turn a damage scalar into a speed boost; the
  // upper bound for `topSpeedScalar` and `gripScalar` is 1.0.
  const damageScalars = options.damageScalars ?? PRISTINE_SCALARS;
  const topSpeedScalar = clamp(damageScalars.topSpeedScalar, 0, 1);
  const damagedTopSpeed = stats.topSpeed * topSpeedScalar;

  if (throttle > 0) {
    nextSpeed += stats.accel * throttle * draftBonus * dt;
  }
  if (brake > 0) {
    // Brake decelerates toward zero. Never inverts velocity.
    const delta = stats.brake * brake * dt;
    nextSpeed = Math.max(0, nextSpeed - delta);
  } else if (throttle === 0) {
    // Coasting drag. Decays toward zero only; cannot push us below 0.
    const delta = COASTING_DRAG_M_PER_S2 * dt;
    nextSpeed = Math.max(0, nextSpeed - delta);
  }

  if (offRoad) {
    // §10 "Off-road should reduce traction, apply strong drag, cap top speed."
    const dragDelta = OFF_ROAD_DRAG_M_PER_S2 * dt;
    nextSpeed = Math.max(0, nextSpeed - dragDelta);
    if (nextSpeed > OFF_ROAD_CAP_M_PER_S) {
      nextSpeed = OFF_ROAD_CAP_M_PER_S;
    }
  }

  // Top-speed clamp last so accel cannot overshoot via accumulated dt.
  // The damage band shrinks the cap; a heavily damaged car cannot reach
  // its undamaged top speed even with full throttle.
  if (nextSpeed > damagedTopSpeed) {
    nextSpeed = damagedTopSpeed;
  }

  // Lateral: §10 yaw equation, projected onto lateral velocity by speed.
  // Grip on-road uses `gripDry`; off-road halves grip per §10's
  // "reduce traction" requirement. A future weather slice replaces the
  // dry-vs-wet selector; clamp guards against degenerate stat values.
  // The damage band's `gripScalar` derates grip in the moderate band
  // and above per §10 "reduced grip".
  const damageGripScalar = clamp(damageScalars.gripScalar, 0, 1);
  const baseGrip = clamp(stats.gripDry, 0, 2) * damageGripScalar;
  const tractionScalar = offRoad ? baseGrip * 0.5 : baseGrip;
  const steerInput = clamp(input.steer, -1, 1);
  const steerRate = steerRateForSpeed(nextSpeed, stats.topSpeed);
  const yawDelta = steerInput * steerRate * dt * tractionScalar;
  // Lateral velocity in m/s = yaw rate * forward speed. At zero speed the
  // car cannot move sideways, satisfying the dot's edge case.
  const lateralVelocity = yawDelta * nextSpeed;
  const nextX = state.x + lateralVelocity;

  // Forward integration uses the post-update speed. Trapezoidal would be
  // more accurate but the §21 fixed-step loop runs at 60 Hz which keeps
  // per-frame error below visible thresholds.
  const nextZ = state.z + nextSpeed * dt;

  // Classify surface from the post-step lateral position. Done last so the
  // surface field reflects "where the car ended up this tick", which is
  // what the dust pool needs when it samples emissions per tick.
  const nextSurface = surfaceAt(nextX, context.roadHalfWidth);

  return { z: nextZ, x: nextX, speed: nextSpeed, surface: nextSurface };
}

/** True if `x` is outside the drivable surface. */
export function isOffRoad(x: number, roadHalfWidth: number): boolean {
  return Math.abs(x) > roadHalfWidth;
}

/**
 * Pure surface classifier. Bands:
 *   |x| <= roadHalfWidth                            -> "road"
 *   roadHalfWidth < |x| <= roadHalfWidth * 1.15     -> "rumble"
 *   |x| > roadHalfWidth * 1.15                      -> "grass"
 *
 * The rumble upper bound matches the renderer's rumble trapezoid in
 * `pseudoRoadCanvas.drawStrips` (see `RUMBLE_HALF_WIDTH_SCALE`). Edges
 * are inclusive on the road and rumble bands so a car sitting exactly on
 * the half-width line classifies as `road`, mirroring `isOffRoad`'s
 * "strictly greater than" semantics.
 */
export function surfaceAt(x: number, roadHalfWidth: number): Surface {
  const absX = Math.abs(x);
  if (absX <= roadHalfWidth) return "road";
  if (absX <= roadHalfWidth * RUMBLE_HALF_WIDTH_SCALE) return "rumble";
  return "grass";
}

// Numeric helpers ----------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
