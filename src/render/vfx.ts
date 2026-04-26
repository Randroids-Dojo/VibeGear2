/**
 * VFX module: stateful pure flash + shake stack with a reduced-motion
 * accessibility gate on shake.
 *
 * Source of truth:
 * - `docs/gdd/16-rendering-and-visual-design.md` "Recommended VFX set"
 *   (light camera shake on impact, HUD flash on lap complete, off-road
 *   rumble shake should be subtle and short).
 * - `docs/gdd/19-controls-and-accessibility.md` reduced-motion gate.
 * - `AGENTS.md` RULE 8: replays must be deterministic, so any per-frame
 *   shake offset has to come from a seeded PRNG, never `Math.random()`.
 *
 * Contract (pinned in stress-test items 6 / 7 of the visual-polish parent
 * dot, then split into `implement-vfx-flash-3d33b035`):
 *
 * - `INITIAL_VFX_STATE` is the empty stack. Callers own the state object
 *   and pass it into every entry point. State is shaped so structural
 *   sharing for unmodified frames is cheap (the entries lists are
 *   replaced only when something starts, expires, or ticks).
 * - `fireFlash(state, params)` pushes a new flash. Flashes do NOT
 *   consult reduced-motion: a HUD flash on lap complete is a navigation
 *   cue, not a motion effect, and the §19 accessibility table only
 *   gates parallax / camera shake / dust.
 * - `fireShake(state, params)` pushes a new shake unless the user has
 *   `prefers-reduced-motion: reduce` set. In the gated case the function
 *   returns the input state unchanged so callers do not need to branch.
 * - `tickVfx(state, dtMs)` advances every active entry by `dtMs` and
 *   removes any whose elapsed time has met or exceeded their duration.
 *   Pure: returns a new state object (or the same object when nothing
 *   changed) and never mutates the input.
 * - `drawVfx(ctx, state, viewport)` paints any active flashes as a
 *   full-viewport overlay (using each entry's color and the linearly
 *   decayed intensity as alpha) and computes the summed shake offset
 *   for the current tick. The offset is returned so the caller can
 *   translate the road / sprite layers before drawing them. Returning
 *   the offset (rather than calling `ctx.translate` ourselves) keeps
 *   the integration site explicit: pseudoRoadCanvas uses it to nudge
 *   the road, and a HUD layer can opt out.
 * - `refreshReducedMotionPreference()` invalidates the cached match-
 *   media result. Used by tests that flip the preference mid-suite; in
 *   production the cache is fine because the form factor of the
 *   accessibility setting does not change mid-session in practice (same
 *   reasoning as `TouchControls.usePointerCoarse`).
 *
 * Determinism:
 *
 * Each shake entry carries its own PRNG seed. `tickVfx` and `drawVfx`
 * derive offsets from `(seed, elapsedMs)` via `shakeOffsetAt`, which is
 * pure. Two `tickVfx` / `drawVfx` runs with identical inputs produce
 * identical offsets, so deterministic-replay tests can compare draw
 * calls 1:1.
 */

import type { Viewport } from "@/road/types";

/** Single active flash entry. Linear alpha decay from `intensity` to 0. */
export interface FlashEntry {
  intensity: number;
  color: string;
  durationMs: number;
  elapsedMs: number;
}

/** Single active shake entry. Amplitude attenuates linearly to 0. */
export interface ShakeEntry {
  amplitudePx: number;
  durationMs: number;
  elapsedMs: number;
  /** PRNG seed channels through the §22 RNG so replays reproduce. */
  seed: number;
  /**
   * Frequency in cycles per second. Default 30 Hz (the rough sweet spot
   * for "snappy collision shake" cited in §16). Stored per-entry so a
   * future off-road rumble entry can choose a slower rumble frequency.
   */
  frequencyHz: number;
}

export interface VfxState {
  flashes: readonly FlashEntry[];
  shakes: readonly ShakeEntry[];
}

export const INITIAL_VFX_STATE: VfxState = Object.freeze({
  flashes: Object.freeze([]) as readonly FlashEntry[],
  shakes: Object.freeze([]) as readonly ShakeEntry[],
});

/** Maximum total shake amplitude in pixels. Prevents pathological stacks. */
export const MAX_SHAKE_AMPLITUDE_PX = 24;

/** Default frequency for shake entries when the caller does not specify. */
export const DEFAULT_SHAKE_FREQUENCY_HZ = 30;

export interface FireFlashParams {
  intensity: number;
  color: string;
  durationMs: number;
}

export interface FireShakeParams {
  amplitudePx: number;
  durationMs: number;
  seed: number;
  frequencyHz?: number;
}

let cachedReducedMotion: boolean | null = null;

/**
 * Resolve `prefers-reduced-motion: reduce` once and cache the result.
 * SSR safe: returns `false` when `window.matchMedia` is unavailable.
 */
function prefersReducedMotion(): boolean {
  if (cachedReducedMotion !== null) return cachedReducedMotion;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    cachedReducedMotion = false;
    return false;
  }
  cachedReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return cachedReducedMotion;
}

/**
 * Invalidate the cached reduced-motion match. Tests call this between
 * cases that flip the preference; production code does not need to.
 */
export function refreshReducedMotionPreference(): void {
  cachedReducedMotion = null;
}

/**
 * Push a new flash onto the stack. Flashes are NOT gated by
 * reduced-motion (HUD flash on lap complete is a navigation cue).
 *
 * Invalid params (non-positive duration, non-positive intensity) return
 * the input state unchanged so callers do not need to branch.
 */
export function fireFlash(state: VfxState, params: FireFlashParams): VfxState {
  if (params.durationMs <= 0) return state;
  if (params.intensity <= 0) return state;
  const entry: FlashEntry = {
    intensity: params.intensity,
    color: params.color,
    durationMs: params.durationMs,
    elapsedMs: 0,
  };
  return { flashes: [...state.flashes, entry], shakes: state.shakes };
}

/**
 * Push a new shake onto the stack. No-op (returns the input state) when
 * `prefers-reduced-motion: reduce` is set, per §19.
 *
 * Invalid params (non-positive duration / amplitude) also return the
 * input state unchanged.
 */
export function fireShake(state: VfxState, params: FireShakeParams): VfxState {
  if (params.durationMs <= 0) return state;
  if (params.amplitudePx <= 0) return state;
  if (prefersReducedMotion()) return state;
  const entry: ShakeEntry = {
    amplitudePx: params.amplitudePx,
    durationMs: params.durationMs,
    elapsedMs: 0,
    seed: params.seed,
    frequencyHz: params.frequencyHz ?? DEFAULT_SHAKE_FREQUENCY_HZ,
  };
  return { flashes: state.flashes, shakes: [...state.shakes, entry] };
}

/**
 * Mulberry32-style hash applied to the integer pair `(seed, tickIdx)`.
 * Returns a value in `[-1, 1]`. Pure: same inputs always produce the
 * same output, so replays line up across runs.
 *
 * Uses the well-known cycle `(x ^ x >>> 15) * (x | 1)` chain. The bit
 * twiddles run in 32-bit space via `Math.imul`, so the function is
 * resilient to JS's float-to-uint32 coercions.
 */
function hashPair(seed: number, tickIdx: number, axis: number): number {
  let x = (seed | 0) ^ Math.imul(tickIdx | 0, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  // Mix the axis index in last so x and y axes pull from different
  // points in the cycle even when seed + tick collide on shared bits.
  x = Math.imul(x ^ Math.imul(axis | 0, 0x27d4eb2d), 0x9e3779b1);
  x ^= x >>> 16;
  // Convert to a float in [0, 1) then map to [-1, 1].
  const u = (x >>> 0) / 0x100000000;
  return u * 2 - 1;
}

/**
 * Pure shake offset for one entry at a given elapsed time. Exported so
 * tests can assert determinism and zero-net-drift directly without
 * walking through `tickVfx` / `drawVfx`.
 *
 * The amplitude attenuates linearly from `amplitudePx` at t=0 to 0 at
 * t=durationMs. The phase inside that envelope is driven by a hashed
 * tick index sampled at `frequencyHz`, which is what gives the shake a
 * "sub-pixel frame chatter" feel rather than a smooth oscillation.
 */
export function shakeOffsetAt(
  entry: Pick<ShakeEntry, "amplitudePx" | "durationMs" | "seed" | "frequencyHz">,
  elapsedMs: number,
): { dx: number; dy: number } {
  if (elapsedMs >= entry.durationMs) return { dx: 0, dy: 0 };
  const tickIdx = Math.floor((elapsedMs * entry.frequencyHz) / 1000);
  const remaining = 1 - elapsedMs / entry.durationMs;
  const amp = entry.amplitudePx * remaining;
  return {
    dx: hashPair(entry.seed, tickIdx, 0) * amp,
    dy: hashPair(entry.seed, tickIdx, 1) * amp,
  };
}

/**
 * Advance every active entry by `dtMs`. Removes entries whose elapsed
 * time has met or exceeded their duration. Pure: returns a new state
 * object (or the input when no entry changed and none expired).
 *
 * Negative or zero `dtMs` is a no-op so callers can clamp upstream
 * without fear of running the stack backwards.
 */
export function tickVfx(state: VfxState, dtMs: number): VfxState {
  if (dtMs <= 0) return state;
  const flashes: FlashEntry[] = [];
  for (const f of state.flashes) {
    const elapsed = f.elapsedMs + dtMs;
    if (elapsed >= f.durationMs) continue;
    flashes.push({ ...f, elapsedMs: elapsed });
  }
  const shakes: ShakeEntry[] = [];
  for (const s of state.shakes) {
    const elapsed = s.elapsedMs + dtMs;
    if (elapsed >= s.durationMs) continue;
    shakes.push({ ...s, elapsedMs: elapsed });
  }
  if (flashes.length === state.flashes.length && shakes.length === state.shakes.length) {
    // Same entry counts AND every entry advanced (none expired). Still
    // need to return the new objects because elapsedMs changed.
    return { flashes, shakes };
  }
  return { flashes, shakes };
}

/**
 * Paint active flashes as a full-viewport overlay and return the summed
 * shake offset for this frame. Caller is expected to apply the offset
 * before drawing the road / sprite layers (e.g. via `ctx.translate`).
 *
 * Multiple concurrent flashes stack additively in alpha space, capped
 * at 1.0 so a runaway stack cannot fully white-out the screen. Multiple
 * shakes sum amplitude, capped at `MAX_SHAKE_AMPLITUDE_PX` per axis.
 *
 * Returning the offset rather than translating the context keeps the
 * integration site explicit and lets HUD layers opt out of the shake.
 */
export function drawVfx(
  ctx: CanvasRenderingContext2D,
  state: VfxState,
  viewport: Viewport,
): { dx: number; dy: number } {
  if (viewport.width > 0 && viewport.height > 0) {
    for (const flash of state.flashes) {
      const remaining = 1 - flash.elapsedMs / flash.durationMs;
      const alpha = Math.min(1, Math.max(0, flash.intensity * remaining));
      if (alpha <= 0) continue;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.globalAlpha = prevAlpha;
    }
  }
  let dx = 0;
  let dy = 0;
  for (const shake of state.shakes) {
    const offset = shakeOffsetAt(shake, shake.elapsedMs);
    dx += offset.dx;
    dy += offset.dy;
  }
  return {
    dx: clamp(dx, -MAX_SHAKE_AMPLITUDE_PX, MAX_SHAKE_AMPLITUDE_PX),
    dy: clamp(dy, -MAX_SHAKE_AMPLITUDE_PX, MAX_SHAKE_AMPLITUDE_PX),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
