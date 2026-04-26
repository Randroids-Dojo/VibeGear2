/**
 * Accessibility assists per `docs/gdd/19-controls-and-input.md`
 * 'Accessibility controls'. Pure transforms over the resolved
 * `Input` snapshot, applied after `mergeInputs` (and `mergeWithTouch`
 * when present) so a single pipeline serves keyboard, gamepad, and
 * touch sources.
 *
 * Six §19 assists ship in this module:
 *
 *   - Auto-accelerate: throttle pinned to 1 unless brake is held.
 *   - Brake assist: scales brake input upward when the player is
 *     braking into a known high-speed corner.
 *   - Steering smoothing: low-pass filter over the steer axis to damp
 *     twitchy keyboard digital input.
 *   - Hold-vs-toggle nitro: tap toggles the burn on / off rather than
 *     the default hold-to-burn semantics.
 *   - Reduced simultaneous input: only one of steer / accel / brake /
 *     nitro / handbrake is honoured per tick, picked by a stable
 *     priority ladder. Helps single-switch and one-handed play.
 *   - Visual-only weather: surfaced as a flag through the assist
 *     context so the physics layer can skip weather grip penalties
 *     while the renderer keeps drawing reduced-intensity rain / snow.
 *
 * Determinism: same `(input, assists, ctx, prevState)` tuple always
 * produces the same `(input, nextState)` pair. No `Math.random`, no
 * time source, no globals (AGENTS.md RULE 8).
 *
 * Idempotency: `applyAssists(applyAssists(x).input, assists, ctx,
 * applyAssists(x).state)` equals the second-call output of a single
 * invocation. Each transform is convergent: auto-accelerate already
 * pins throttle to 1, brake assist already saturates at 1, steering
 * smoothing converges to the input under repeated application against
 * a fixed input, toggle nitro is edge-triggered (no spurious flips on
 * a held state), reduced-input picks the same winner each call, and
 * visual-only weather is a no-op on the input stream itself.
 *
 * Stateful assists (steering smoothing, toggle nitro, reduced-input
 * tracking) thread their state through `AssistMemory`. Callers create
 * a fresh memory at race start via `INITIAL_ASSIST_MEMORY` and feed
 * the result of each call back in next tick.
 */

import type { WeatherOption } from "@/data/schemas";
import type { Input } from "./input";
import { NEUTRAL_INPUT } from "./input";
import type { Surface } from "./physics";

// Settings ----------------------------------------------------------------

/**
 * Snapshot of the §19 assists picked from `SaveGameSettings.assists`.
 * Local mirror so this module does not pull in the full save shape; the
 * caller copies the fields it cares about. Each flag treats `undefined`
 * as `false` so a v1 save that predates the new fields lands "all off"
 * by default.
 */
export interface AssistSettingsRuntime {
  autoAccelerate?: boolean;
  brakeAssist?: boolean;
  steeringSmoothing?: boolean;
  nitroToggleMode?: boolean;
  reducedSimultaneousInput?: boolean;
  weatherVisualReduction?: boolean;
}

/** Resolve the runtime view of a stored AssistSettings shape. */
export function resolveAssists(raw: AssistSettingsRuntime): Required<AssistSettingsRuntime> {
  return {
    autoAccelerate: raw.autoAccelerate === true,
    brakeAssist: raw.brakeAssist === true,
    steeringSmoothing: raw.steeringSmoothing === true,
    nitroToggleMode: raw.nitroToggleMode === true,
    reducedSimultaneousInput: raw.reducedSimultaneousInput === true,
    weatherVisualReduction: raw.weatherVisualReduction === true,
  };
}

// Context -----------------------------------------------------------------

/**
 * Per-tick context the assists pipeline consults. Surface and weather
 * are read by visual-only weather (downstream physics flag) and brake
 * assist (pavement-only triggering). `speedMps` and
 * `upcomingCurvature` drive brake-assist's "is this actually a corner
 * approach worth saving" check.
 *
 * `dt` is the fixed-step delta in seconds. Smoothing math depends on
 * it so the time constant stays right at any tick rate the loop ever
 * adopts.
 */
export interface AssistContext {
  speedMps: number;
  surface: Surface;
  weather: WeatherOption;
  /**
   * Signed curvature ahead of the player in the [-1, 1] band, matching
   * `TrackSegment.curve`. Magnitude maps to "how sharp"; sign is the
   * turn direction. `0` means "no upcoming curve known" and brake
   * assist becomes a no-op.
   */
  upcomingCurvature: number;
  /** Seconds since the previous tick. Used by steering smoothing. */
  dt: number;
}

// Memory ------------------------------------------------------------------

/**
 * Persisted state across ticks. Threaded by the caller; this module
 * never reaches for a global.
 *
 * - `smoothedSteer` is the low-pass output for steering smoothing.
 *   Initialised to `0` (the neutral steer).
 * - `nitroToggleActive` is the latched on / off bit for the toggle
 *   nitro assist. Flips only on a rising edge of `input.nitro`.
 * - `nitroLastPressed` is the previous tick's `input.nitro` reading.
 *   Used to detect rising edges; toggle does not fire on a held key.
 * - `reducedInputLastWinner` records which action was honoured last
 *   tick. The reducer can use this for round-robin if no priority
 *   action is held; today we keep it for diagnostic surfaces and the
 *   future round-robin enhancement.
 */
export interface AssistMemory {
  smoothedSteer: number;
  nitroToggleActive: boolean;
  nitroLastPressed: boolean;
  reducedInputLastWinner: ReducedInputWinner | null;
}

/**
 * Action winners under the reduced-simultaneous-input assist. Mirrors
 * the priority ladder constants below so consumers can label the HUD
 * badge without reaching into private literals.
 */
export type ReducedInputWinner =
  | "steer-left"
  | "steer-right"
  | "brake"
  | "throttle"
  | "nitro"
  | "handbrake"
  | "none";

export const INITIAL_ASSIST_MEMORY: Readonly<AssistMemory> = Object.freeze({
  smoothedSteer: 0,
  nitroToggleActive: false,
  nitroLastPressed: false,
  reducedInputLastWinner: null,
});

// Tunables ----------------------------------------------------------------

/**
 * Time constant of the steering low-pass filter, in seconds. Picks the
 * "snap halfway in 80 ms" target named in the dot's edge cases. The
 * filter coefficient per tick is `dt / (TAU + dt)` which collapses to
 * the standard exponential smoothing identity at small dt.
 */
export const STEERING_SMOOTHING_TAU_SECONDS = 0.08;

/**
 * Brake assist scales the player's brake input upward by this factor,
 * but only when speed is above the safety threshold and the upcoming
 * curve is sharp enough. The scaled value is always clamped to `[0, 1]`
 * so the assist never invents brake out of a neutral input.
 */
export const BRAKE_ASSIST_BOOST = 1.4;

/**
 * Brake assist only kicks in above this speed. Below it, the player can
 * already stop trivially; the assist would only feel like the brake is
 * being yanked from them.
 */
export const BRAKE_ASSIST_MIN_SPEED_MPS = 30;

/**
 * Brake assist only kicks in when the upcoming curve magnitude is at
 * least this sharp. Lower-magnitude bends are handled by lifting off
 * the throttle; auto-braking on a gentle sweeper would feel wrong.
 */
export const BRAKE_ASSIST_MIN_CURVATURE = 0.35;

/**
 * Reduced-input priority ladder (highest priority first). When the
 * assist is on and the player is holding multiple actions the same
 * tick, the first hit on this list wins. Steering plays first because
 * losing it means losing the lane; brake plays before throttle because
 * stopping is the safety choice; nitro and handbrake are last because
 * the player can always re-tap them.
 */
const REDUCED_INPUT_PRIORITY: ReadonlyArray<ReducedInputWinner> = [
  "steer-left",
  "steer-right",
  "brake",
  "throttle",
  "nitro",
  "handbrake",
];

// Per-assist transforms ---------------------------------------------------

/**
 * Auto-accelerate: throttle defaults to 1 unless the player is
 * actively braking. The dot's edge case is explicit: brake wins.
 *
 * Pure: depends only on the input shape.
 */
export function applyAutoAccelerate(input: Input): Input {
  if (input.brake > 0) return input;
  if (input.throttle === 1) return input;
  return { ...input, throttle: 1 };
}

/**
 * Brake assist: when the player is already braking and the projected
 * curvature ahead is above the threshold and the speed is above the
 * threshold, scale the brake reading by `BRAKE_ASSIST_BOOST` and
 * saturate at 1.
 *
 * Important: this assist never invents brake out of nothing. The
 * player must be touching the brake key (or trigger) for the boost to
 * kick in. That keeps the assist consistent with the §19 wording
 * ("Brake assist": helps the player who is already trying to brake)
 * rather than turning into automatic braking.
 */
export function applyBrakeAssist(
  input: Input,
  ctx: Pick<AssistContext, "speedMps" | "upcomingCurvature">,
): Input {
  if (input.brake <= 0) return input;
  if (ctx.speedMps < BRAKE_ASSIST_MIN_SPEED_MPS) return input;
  if (Math.abs(ctx.upcomingCurvature) < BRAKE_ASSIST_MIN_CURVATURE) return input;
  const boosted = Math.min(1, input.brake * BRAKE_ASSIST_BOOST);
  if (boosted === input.brake) return input;
  return { ...input, brake: boosted };
}

/**
 * Steering smoothing: low-pass filter over the steer axis. Reads the
 * `prevSmoothed` value from the assist memory and blends toward
 * `input.steer` with a coefficient derived from `dt` and the time
 * constant `STEERING_SMOOTHING_TAU_SECONDS`.
 *
 * Returns the next smoothed value alongside the rewritten input so the
 * caller can stash it back into the memory object without a second
 * pass.
 */
export function applySteeringSmoothing(
  input: Input,
  prevSmoothed: number,
  dt: number,
): { input: Input; smoothed: number } {
  // dt <= 0 leaves the filter untouched. Defends against a paused
  // tick where the loop ticked the assists module without advancing
  // the clock.
  if (!Number.isFinite(dt) || dt <= 0) {
    return { input, smoothed: prevSmoothed };
  }
  const tau = STEERING_SMOOTHING_TAU_SECONDS;
  const alpha = dt / (tau + dt);
  const next = prevSmoothed + alpha * (input.steer - prevSmoothed);
  // Snap tiny residuals back to zero so a steady-state neutral input
  // converges exactly rather than asymptotically. Below 1e-3 is below
  // any car's lateral response threshold; the visible behaviour is the
  // same and the idempotency contract gets exactness.
  const snapped = Math.abs(next) < 1e-3 ? 0 : next;
  if (snapped === input.steer) return { input, smoothed: snapped };
  return { input: { ...input, steer: snapped }, smoothed: snapped };
}

/**
 * Hold-vs-toggle nitro: when on, a rising edge of `input.nitro` flips
 * a latched bit; the latched bit is what the rest of the runtime sees.
 *
 * Returns the rewritten input alongside the next memory bits so the
 * caller can stash them.
 */
export function applyToggleNitro(
  input: Input,
  prevToggleActive: boolean,
  prevNitroPressed: boolean,
): { input: Input; toggleActive: boolean; nitroPressed: boolean } {
  const risingEdge = input.nitro && !prevNitroPressed;
  const toggleActive = risingEdge ? !prevToggleActive : prevToggleActive;
  const nitroPressed = input.nitro;
  if (toggleActive === input.nitro) {
    return { input, toggleActive, nitroPressed };
  }
  return {
    input: { ...input, nitro: toggleActive },
    toggleActive,
    nitroPressed,
  };
}

/**
 * Reduced simultaneous input: pick the highest-priority action the
 * player is currently holding and zero out everything else. Pause is
 * never zeroed (the player must always be able to pause); shifts are
 * also passed through (transmission inputs are edge-triggered and
 * mutually exclusive in practice).
 *
 * Returns both the rewritten input and the winner label so the HUD
 * badge can surface the state.
 */
export function applyReducedSimultaneousInput(
  input: Input,
): { input: Input; winner: ReducedInputWinner } {
  const winner = pickReducedWinner(input);
  if (winner === "none") {
    // Nothing actionable held; pass through (pause / shifts may still
    // be set; do not strip them).
    return { input, winner };
  }
  const next: Input = { ...NEUTRAL_INPUT };
  next.pause = input.pause;
  next.shiftUp = input.shiftUp;
  next.shiftDown = input.shiftDown;
  switch (winner) {
    case "steer-left":
      next.steer = input.steer < 0 ? input.steer : -1;
      break;
    case "steer-right":
      next.steer = input.steer > 0 ? input.steer : 1;
      break;
    case "brake":
      next.brake = input.brake;
      break;
    case "throttle":
      next.throttle = input.throttle;
      break;
    case "nitro":
      next.nitro = true;
      break;
    case "handbrake":
      next.handbrake = true;
      break;
  }
  return { input: next, winner };
}

function pickReducedWinner(input: Input): ReducedInputWinner {
  for (const candidate of REDUCED_INPUT_PRIORITY) {
    if (isHeld(input, candidate)) return candidate;
  }
  return "none";
}

function isHeld(input: Input, action: ReducedInputWinner): boolean {
  switch (action) {
    case "steer-left":
      return input.steer < 0;
    case "steer-right":
      return input.steer > 0;
    case "brake":
      return input.brake > 0;
    case "throttle":
      return input.throttle > 0;
    case "nitro":
      return input.nitro;
    case "handbrake":
      return input.handbrake;
    case "none":
      return false;
  }
}

/**
 * Visual-only weather is a flag-only assist for the input stream: the
 * input itself is unchanged, but the consumer (physics) reads
 * `assistsApplied.weatherVisualReductionActive` to know whether to
 * skip the weather grip multiplier this tick. Surfaced through the
 * `applyAssists` result so each call returns a single coherent
 * snapshot rather than forcing the caller to re-read the settings
 * struct.
 */
export interface AssistsApplied {
  input: Input;
  memory: AssistMemory;
  /** True when the weather-visual-reduction assist is on. */
  weatherVisualReductionActive: boolean;
  /** Stable label of any active assist; useful for the HUD badge. */
  badge: AssistBadge;
}

/**
 * HUD-facing summary of which assists are currently affecting the
 * player. The badge tier surfaces the "loudest" active assist so a
 * single corner pip can stay readable at any HUD scale.
 */
export interface AssistBadge {
  /** True when at least one assist is active for this tick. */
  active: boolean;
  /** Count of active assists this tick (for the optional secondary line). */
  count: number;
  /** Stable label of the highest-priority active assist, or `null`. */
  primary: AssistBadgeLabel | null;
  /** Stable list of every active assist label, ordered by priority. */
  active_labels: ReadonlyArray<AssistBadgeLabel>;
}

export type AssistBadgeLabel =
  | "auto-accelerate"
  | "brake-assist"
  | "steering-smoothing"
  | "toggle-nitro"
  | "reduced-input"
  | "visual-weather";

const BADGE_PRIORITY: ReadonlyArray<AssistBadgeLabel> = [
  "auto-accelerate",
  "brake-assist",
  "reduced-input",
  "toggle-nitro",
  "steering-smoothing",
  "visual-weather",
];

// Compose -----------------------------------------------------------------

/**
 * Apply the active §19 assists to the resolved input. Each assist's
 * gate is checked independently; the order matters for cross-effects
 * (e.g. auto-accelerate runs before reduced-input so a single-switch
 * player still gets continuous throttle). The order:
 *
 *   1. Auto-accelerate (input shape rewrite).
 *   2. Brake assist (input shape rewrite).
 *   3. Steering smoothing (memory + input rewrite).
 *   4. Toggle nitro (memory + input rewrite).
 *   5. Reduced simultaneous input (input rewrite). Runs last so the
 *      priority ladder evaluates the post-assist values; otherwise
 *      auto-accelerate's throttle = 1 would always lose to a brake
 *      held the same tick, which is what we want.
 *   6. Visual-only weather flag (no input rewrite, surfaces a flag).
 *
 * Pure: same input + assists + ctx + memory always returns the same
 * output snapshot.
 */
export function applyAssists(
  input: Readonly<Input>,
  assists: AssistSettingsRuntime,
  ctx: AssistContext,
  memory: Readonly<AssistMemory> = INITIAL_ASSIST_MEMORY,
): AssistsApplied {
  const resolved = resolveAssists(assists);
  let next: Input = { ...input };
  let smoothed = memory.smoothedSteer;
  let toggleActive = memory.nitroToggleActive;
  let nitroPressed = memory.nitroLastPressed;
  let reducedWinner: ReducedInputWinner | null = memory.reducedInputLastWinner;

  if (resolved.autoAccelerate) {
    next = applyAutoAccelerate(next);
  }

  if (resolved.brakeAssist) {
    next = applyBrakeAssist(next, ctx);
  }

  if (resolved.steeringSmoothing) {
    const out = applySteeringSmoothing(next, smoothed, ctx.dt);
    next = out.input;
    smoothed = out.smoothed;
  } else {
    // When the assist is off, keep the smoothing memory in sync with
    // the unfiltered steer so toggling the assist on mid-race does
    // not snap from a stale cached value.
    smoothed = next.steer;
  }

  if (resolved.nitroToggleMode) {
    const out = applyToggleNitro(next, toggleActive, nitroPressed);
    next = out.input;
    toggleActive = out.toggleActive;
    nitroPressed = out.nitroPressed;
  } else {
    // When the assist is off, decay the latched toggle so re-enabling
    // mid-race does not leave the player holding a phantom toggle.
    toggleActive = false;
    nitroPressed = next.nitro;
  }

  if (resolved.reducedSimultaneousInput) {
    const out = applyReducedSimultaneousInput(next);
    next = out.input;
    reducedWinner = out.winner;
  } else {
    reducedWinner = null;
  }

  const badge = buildAssistBadge(resolved);

  return {
    input: next,
    memory: {
      smoothedSteer: smoothed,
      nitroToggleActive: toggleActive,
      nitroLastPressed: nitroPressed,
      reducedInputLastWinner: reducedWinner,
    },
    weatherVisualReductionActive: resolved.weatherVisualReduction,
    badge,
  };
}

function buildAssistBadge(
  resolved: Required<AssistSettingsRuntime>,
): AssistBadge {
  const active: AssistBadgeLabel[] = [];
  if (resolved.autoAccelerate) active.push("auto-accelerate");
  if (resolved.brakeAssist) active.push("brake-assist");
  if (resolved.reducedSimultaneousInput) active.push("reduced-input");
  if (resolved.nitroToggleMode) active.push("toggle-nitro");
  if (resolved.steeringSmoothing) active.push("steering-smoothing");
  if (resolved.weatherVisualReduction) active.push("visual-weather");
  // Sort by canonical priority order so callers always see a stable
  // sequence regardless of which fields were toggled in which order.
  const sorted = BADGE_PRIORITY.filter((label) => active.includes(label));
  return {
    active: sorted.length > 0,
    count: sorted.length,
    primary: sorted[0] ?? null,
    active_labels: sorted,
  };
}

/**
 * Stable display labels for the §19 accessibility pane and the HUD
 * badge. Mirrors `AssistBadgeLabel`; kept here so the UI layer does
 * not invent its own copy.
 */
export const ASSIST_BADGE_LABELS: Readonly<Record<AssistBadgeLabel, string>> = Object.freeze({
  "auto-accelerate": "Auto accel",
  "brake-assist": "Brake assist",
  "steering-smoothing": "Steer smooth",
  "toggle-nitro": "Toggle nitro",
  "reduced-input": "Reduced input",
  "visual-weather": "Visual weather",
});
