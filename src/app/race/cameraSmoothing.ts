/**
 * Speed- and brake-coupled camera language per §16
 * "Camera lowers slightly at high speed. Crest lines should reveal horizon
 * dramatically." Today the road camera is geometrically static (FOV 100,
 * height 1.5 m); this module produces small per-frame deltas that the race
 * page applies to `camera.depth` and `camera.y` before each `drawRoad`
 * call.
 *
 * Contract pinned by `.dots/VibeGear2-implement-speed-coupled-3cc0838f.md`:
 *
 * - `fovDelta` grows from 0 to +6 deg as `speed / topSpeed` goes 0 -> 1.
 *   At top speed the effective FOV is 106 deg, which the caller maps to
 *   `cameraDepth = 1 / tan((100 + fovDelta) / 2 * pi/180)`.
 * - `heightDelta` drops from 0 to -0.18 m as `brake` goes 0 -> 1, so the
 *   camera lowers from 1.5 m to 1.32 m under hard brake (weight transfer
 *   read).
 * - Both targets are low-pass smoothed at tau = 0.16 s (~6 Hz cutoff) so
 *   transient input spikes do not strobe the camera.
 * - Reduced-motion gate: when `prefersReducedMotion()` is true, the
 *   target deltas hold at 0 and the smoothing is skipped. The camera
 *   stays at the §16 authored defaults.
 *
 * Pure: same input + same prior state produces the same next state.
 * The caller owns the state object and threads it through each frame.
 */

import { prefersReducedMotion } from "@/render/vfx";

export interface CameraSmoothingInput {
  /** Player's current speed in m/s. */
  readonly speed: number;
  /** Top speed in m/s used to normalize the FOV widen. */
  readonly topSpeed: number;
  /** Brake input in [0, 1]. */
  readonly brake: number;
}

export interface CameraSmoothingState {
  /** Smoothed FOV widen in degrees. Authored default 0. */
  readonly fovDelta: number;
  /** Smoothed camera-height offset in meters. Authored default 0. */
  readonly heightDelta: number;
}

export const INITIAL_CAMERA_SMOOTHING_STATE: CameraSmoothingState = Object.freeze({
  fovDelta: 0,
  heightDelta: 0,
});

/** Maximum FOV widen at top speed, in degrees. */
export const MAX_FOV_WIDEN_DEG = 6;
/** Maximum brake-coupled camera dip, in meters (negative = lower). */
export const MAX_BRAKE_DIP_METERS = 0.18;
/** Smoothing time constant, in seconds (tau = 0.16 -> ~6 Hz cutoff). */
export const SMOOTHING_TAU_SEC = 0.16;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Advance the camera-smoothing state by `dtMs`. Returns the input state
 * unchanged when the result would be byte-identical (so the caller can
 * skip the `camera.depth` / `camera.y` overwrite on still frames).
 */
export function tickCameraSmoothing(
  state: CameraSmoothingState,
  input: CameraSmoothingInput,
  dtMs: number,
): CameraSmoothingState {
  if (prefersReducedMotion()) {
    if (state.fovDelta === 0 && state.heightDelta === 0) return state;
    return INITIAL_CAMERA_SMOOTHING_STATE;
  }

  const speedNorm =
    input.topSpeed > 0 ? clamp01(input.speed / input.topSpeed) : 0;
  const fovTarget = speedNorm * MAX_FOV_WIDEN_DEG;
  const heightTarget = -clamp01(input.brake) * MAX_BRAKE_DIP_METERS;

  const dtSec = Math.max(0, dtMs) / 1000;
  // Exponential low-pass: alpha = 1 - exp(-dt / tau). At dt = tau the
  // response is ~63 percent of the step; at 3 tau the response is ~95
  // percent.
  const alpha = dtSec > 0 ? 1 - Math.exp(-dtSec / SMOOTHING_TAU_SEC) : 0;
  const fovDelta = state.fovDelta + (fovTarget - state.fovDelta) * alpha;
  const heightDelta =
    state.heightDelta + (heightTarget - state.heightDelta) * alpha;

  if (fovDelta === state.fovDelta && heightDelta === state.heightDelta) {
    return state;
  }
  return { fovDelta, heightDelta };
}

/**
 * Map a (fovDelta, heightDelta) pair to the `camera.depth` and `camera.y`
 * values the renderer reads. Pure helper kept next to the smoother so the
 * §16 derivation stays in one place.
 */
export function cameraOverridesFor(
  state: CameraSmoothingState,
  baseFovDeg: number,
  baseHeightMeters: number,
): { depth: number; y: number } {
  const fovDeg = baseFovDeg + state.fovDelta;
  const depth = 1 / Math.tan((fovDeg / 2) * (Math.PI / 180));
  return {
    depth,
    y: baseHeightMeters + state.heightDelta,
  };
}
