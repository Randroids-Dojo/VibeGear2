/**
 * Drafting / slipstream helpers per `docs/gdd/10-driving-model-and-physics.md`
 * "Drafting" subsection. The §10 design rules:
 *
 * - Activate only above a speed threshold.
 * - Small but noticeable acceleration bonus after 0.6 s in the wake.
 * - Break instantly on side movement or brake input.
 *
 * This module is a pair of pure helpers that the race scene can layer on
 * top of the existing `physics.step()` without changing its fixed-step
 * contract (AGENTS.md RULE 8). The physics module accepts an optional
 * `draftBonus` accel multiplier in `step()`; this module computes that
 * multiplier from a leader / follower geometric snapshot plus a small
 * accumulator.
 *
 * Why split the geometry from the time-windowed accumulator?
 *
 * - `computeWakeOffset` is a pure geometric check: given two positions,
 *   is the follower in the leader's wake right now? It carries no state.
 *   The race scene calls it every tick to drive the accumulator below.
 * - `tickDraftWindow` carries the state: how long the follower has been
 *   continuously in the wake, what the current accel multiplier is, and
 *   whether the follower has been disqualified by a brake or side step
 *   this tick. Reset rules live here so the §10 break conditions are
 *   pinned in one place.
 *
 * Determinism: same inputs produce deep-equal outputs. The accumulator
 * uses milliseconds (consumed via `dt` in seconds, multiplied by 1000)
 * rather than tick counts so it remains stable across physics-rate
 * tweaks; consumers should still pass the canonical fixed-step `dt`.
 */

/**
 * Minimum follower speed (m/s) below which drafting cannot activate.
 * §10 says "activate only above a speed threshold" without naming the
 * value; we pin it to 30 m/s (about 108 km/h) so drafting is a high-speed
 * straight-line tactic rather than a low-speed crutch out of corners.
 *
 * The constant is exported so the verify dot can pin the threshold in a
 * unit test and so a future weather/damage slice can derate it without
 * editing call sites.
 */
export const DRAFT_MIN_SPEED_M_PER_S = 30;

/**
 * Continuous in-wake time (ms) before any acceleration bonus applies.
 * §10: "Small but noticeable acceleration bonus after 0.6 s in wake."
 * Below this threshold the multiplier stays at 1.0 (no bonus).
 */
export const DRAFT_ENGAGE_MS = 600;

/**
 * Maximum drafting accel multiplier. §10 calls for a "small but
 * noticeable" bonus; 5 percent on the §10 acceleration table is around
 * 0.8 m/s^2 added on the starter car, enough to close a half-second gap
 * over a long straight without making drafting dominant.
 */
export const DRAFT_MAX_ACCEL_MULTIPLIER = 1.05;

/**
 * Time (ms) between engagement and full bonus. The multiplier ramps
 * linearly from 1.0 at `DRAFT_ENGAGE_MS` to `DRAFT_MAX_ACCEL_MULTIPLIER`
 * at `DRAFT_ENGAGE_MS + DRAFT_RAMP_MS`. Keeps the bonus from snapping on
 * abruptly which would feel like a discrete event.
 */
export const DRAFT_RAMP_MS = 400;

/**
 * Lateral half-width (m) of the wake cone behind the leader. A follower
 * sitting within `|leader.x - follower.x| <= DRAFT_LATERAL_TOLERANCE_M`
 * counts as "in the wake" for the geometric check.
 *
 * §10's "Edge Cases" entry on the dot says "Follower side-steps within
 * tolerance (e.g. 0.3 m): window does not break." We pick a slightly
 * larger 0.8 m so a typical lane-width nudge stays in-wake while a full
 * lane change (~1.5 m) breaks it. The `DRAFT_LATERAL_BREAK_M` constant
 * below is the hard break threshold tested separately.
 */
export const DRAFT_LATERAL_TOLERANCE_M = 0.8;

/**
 * Lateral offset (m) at which the wake breaks instantly. Pinned to match
 * the dot's verify item "Lateral offset > 1.5 m breaks the window."
 *
 * Between `DRAFT_LATERAL_TOLERANCE_M` and `DRAFT_LATERAL_BREAK_M` the
 * follower is "marginal": still in the wake but close to leaving it.
 * `computeWakeOffset` reports `inWake: false` past the break threshold
 * regardless of longitudinal gap.
 */
export const DRAFT_LATERAL_BREAK_M = 1.5;

/**
 * Longitudinal gap (m) within which a follower is in the leader's wake.
 * Measured along the track centerline (`progress` field). The follower
 * must be behind the leader (`leader.progress > follower.progress`) and
 * within this gap to count.
 *
 * §10 does not pin a numeric value; we use 25 m so two cars about three
 * car-lengths apart can still draft. Closer than 1 m would be visually
 * "touching"; we leave that as in-wake too since collisions are a
 * separate slice.
 */
export const DRAFT_LONGITUDINAL_GAP_M = 25;

/**
 * Geometric snapshot of a car for the wake check. Only fields drafting
 * cares about, so callers do not have to pass the full `CarState`.
 *
 * - `x` is lateral offset from the road centerline (m), matching
 *   `CarState.x`.
 * - `progress` is forward progress along the track (m). For a single-car
 *   straight it equals `CarState.z`; for full track support a future
 *   slice may project lap-relative progress here.
 */
export interface DraftCarSnapshot {
  x: number;
  progress: number;
}

/**
 * Result of the per-tick wake check. `inWake` is the only field most
 * callers look at; `lateralOffset` and `longitudinalGap` are exposed so
 * tests can assert geometry and so a future HUD widget can show "you are
 * X m behind, Y m sideways" without re-deriving the math.
 *
 * `ageMs` is always 0 here. The field exists so the verify item
 * `computeWakeOffset(...) returns { inWake: true, ageMs: 0 }` is a
 * shape-stable check; the actual accumulated age lives in
 * `DraftWindowState.engagedMs` and is advanced by `tickDraftWindow`.
 */
export interface WakeOffset {
  inWake: boolean;
  lateralOffset: number;
  longitudinalGap: number;
  ageMs: 0;
}

/**
 * Time-windowed drafting accumulator. Pure data; reducers below return
 * fresh copies. `engagedMs` accumulates while the follower stays in the
 * wake at sufficient speed; `accelMultiplier` is the value to pass into
 * `physics.step()` as a bonus.
 *
 * `engagedMs` resets to 0 whenever the wake breaks, the follower brakes,
 * the follower drops below `DRAFT_MIN_SPEED_M_PER_S`, or the geometric
 * check returns `inWake: false`. Once reset, the follower must spend
 * another full `DRAFT_ENGAGE_MS` continuously in-wake before the bonus
 * re-applies, which is what §10 calls for.
 */
export interface DraftWindowState {
  engagedMs: number;
  accelMultiplier: number;
}

/** Initial / "no draft" state. */
export const INITIAL_DRAFT_WINDOW: Readonly<DraftWindowState> = Object.freeze({
  engagedMs: 0,
  accelMultiplier: 1,
});

/**
 * Geometric check: is `follower` in `leader`'s wake right now? Pure;
 * called once per tick per (leader, follower) pair. Side-steps and brake
 * inputs are NOT consulted here; those break conditions live in
 * `tickDraftWindow` so this function stays a pure spatial query.
 *
 * Wake conditions:
 * - Follower must be behind the leader along `progress`.
 * - Longitudinal gap must be within `DRAFT_LONGITUDINAL_GAP_M`.
 * - Lateral offset must be within `DRAFT_LATERAL_BREAK_M`. Beyond the
 *   break threshold the follower is unambiguously out of the wake.
 *
 * The dot's verify case `computeWakeOffset({ x: 0, progress: 100 },
 * { x: 0.1, progress: 99 })` returns `{ inWake: true, ageMs: 0 }`: the
 * follower is 1 m behind and 0.1 m to the side, both well inside
 * tolerance, so the function returns `inWake: true`.
 */
export function computeWakeOffset(
  leader: Readonly<DraftCarSnapshot>,
  follower: Readonly<DraftCarSnapshot>,
): WakeOffset {
  const lateralOffset = Math.abs(leader.x - follower.x);
  const longitudinalGap = leader.progress - follower.progress;
  const inWake =
    longitudinalGap > 0 &&
    longitudinalGap <= DRAFT_LONGITUDINAL_GAP_M &&
    lateralOffset <= DRAFT_LATERAL_BREAK_M;
  return { inWake, lateralOffset, longitudinalGap, ageMs: 0 };
}

/**
 * Per-tick inputs that can break the draft window even when the
 * geometric check still says `inWake`. Brake input always breaks the
 * window per §10 ("Break instantly on ... brake."). Speed below
 * `DRAFT_MIN_SPEED_M_PER_S` also resets the window since §10 requires
 * activation above a speed threshold; once below it the window cannot
 * stay open.
 */
export interface DraftTickInputs {
  /** True if the follower has any brake input held this tick. */
  brake: boolean;
  /** Follower's forward speed in m/s. */
  followerSpeed: number;
}

/**
 * Advance the drafting window by `dt` seconds. Pure: returns a fresh
 * state; the input `state` is not mutated.
 *
 * Reset conditions (any of the following resets `engagedMs` to 0 and
 * `accelMultiplier` to 1):
 * - `wake.inWake === false` (geometric break, includes lateral side-step
 *   past `DRAFT_LATERAL_BREAK_M` and any out-of-gap case).
 * - `inputs.brake === true` (brake-input break per §10).
 * - `inputs.followerSpeed < DRAFT_MIN_SPEED_M_PER_S` (speed-threshold
 *   break per §10).
 * - `dt <= 0` or non-finite (defensive: nothing happens this tick).
 *
 * When in-wake and not broken, `engagedMs` increases by `dt * 1000`. The
 * multiplier stays at 1.0 until `engagedMs >= DRAFT_ENGAGE_MS`, then
 * ramps linearly to `DRAFT_MAX_ACCEL_MULTIPLIER` over `DRAFT_RAMP_MS`.
 */
export function tickDraftWindow(
  state: Readonly<DraftWindowState>,
  wake: Readonly<WakeOffset>,
  inputs: Readonly<DraftTickInputs>,
  dt: number,
): DraftWindowState {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { engagedMs: state.engagedMs, accelMultiplier: state.accelMultiplier };
  }
  if (!wake.inWake || inputs.brake || inputs.followerSpeed < DRAFT_MIN_SPEED_M_PER_S) {
    return { engagedMs: 0, accelMultiplier: 1 };
  }
  const nextEngagedMs = state.engagedMs + dt * 1000;
  const accelMultiplier = multiplierForEngagedMs(nextEngagedMs);
  return { engagedMs: nextEngagedMs, accelMultiplier };
}

/**
 * Pure ramp from `engagedMs` to multiplier. Exposed for tests and for
 * any HUD widget that wants to render the current bonus as a percentage.
 *
 * The ramp is linear from `(DRAFT_ENGAGE_MS, 1.0)` to
 * `(DRAFT_ENGAGE_MS + DRAFT_RAMP_MS, DRAFT_MAX_ACCEL_MULTIPLIER)` and
 * clamps at the maximum past the end of the ramp.
 */
export function multiplierForEngagedMs(engagedMs: number): number {
  if (!Number.isFinite(engagedMs) || engagedMs < DRAFT_ENGAGE_MS) return 1;
  const t = (engagedMs - DRAFT_ENGAGE_MS) / DRAFT_RAMP_MS;
  if (t >= 1) return DRAFT_MAX_ACCEL_MULTIPLIER;
  return 1 + t * (DRAFT_MAX_ACCEL_MULTIPLIER - 1);
}
