/**
 * Off-road dust particle pool.
 *
 * Source of truth:
 * - `docs/gdd/10-driving-model-and-physics.md` "Road edge and off-road
 *   slowdown" pins the off-road feel: stronger drag, lower top speed,
 *   "increase rumble and dust/spray/snow VFX". This module ships the
 *   dust slice; the spray / snow weather variants are followups under
 *   the §14 weather dot.
 * - `docs/gdd/16-rendering-and-visual-design.md` "Recommended VFX set"
 *   lists "Dust roost" alongside the other in-world VFX.
 * - `AGENTS.md` RULE 8: replays must be deterministic. The dust pool's
 *   per-particle horizontal velocity is hashed off the (seed, tickIdx)
 *   integer pair, never `Math.random()`, so two replays with identical
 *   inputs paint identical particles.
 *
 * Contract pinned by the parent dot's stress-test item 8 and the
 * `implement-off-road-2f037c64` split:
 *
 * - `INITIAL_DUST_STATE` is the empty pool. Callers own the state object
 *   and pass it into every entry point. Pool size is fixed at
 *   `MAX_DUST = 64`; emissions past the cap recycle the oldest (lowest
 *   index) particle in-place so we never allocate per-emit.
 * - `tickDust(state, surface, speed, dtMs, seed)` advances the pool by
 *   `dtMs`. When `surface === "grass"` AND `speed > EMIT_SPEED_THRESHOLD_M_PER_S`
 *   it emits at `EMIT_INTERVAL_TICKS = 2` (one particle per two ticks of
 *   the §21 60 Hz fixed step, i.e. ~30 emissions / s). Particles whose
 *   `elapsedMs` has met or exceeded `LIFETIME_MS` are removed (recycled
 *   on the next emit).
 * - `drawDust(ctx, state, viewport)` paints active particles as soft
 *   alpha-decayed circles. Pure: no state mutation. Renders nothing on a
 *   zero-area viewport.
 *
 * Determinism:
 *
 * Each particle's horizontal velocity is derived from
 * `dustHashAt(seed, particleIndex)` which is pure. The pool advances its
 * `tickIdx` counter once per `tickDust` call regardless of whether an
 * emission fires this tick; doing it that way means two pools fed the
 * same surface / speed series produce identical particle layouts even
 * when the calling code interleaves zero-dt ticks (the renderer does
 * exactly this for the rAF -> sim alpha bridge).
 *
 * Coordinate convention:
 *
 * Particle `(x, y)` is in CSS pixels relative to the canvas top-left.
 * The integration site (typically `pseudoRoadCanvas.drawRoad`) is
 * responsible for translating screen-space car position into that frame
 * before calling `emit`. This module never reads the road geometry; it
 * only consumes a surface enum + a speed scalar + an emission origin.
 */

import type { Viewport } from "@/road/types";

import type { Surface } from "@/game/physics";

/** Maximum simultaneously-tracked dust particles. */
export const MAX_DUST = 64;

/** Particle lifetime in milliseconds. */
export const LIFETIME_MS = 600;

/**
 * Emit one particle every N tickDust calls while conditions hold.
 * Pinned at 2 by the dot ("1 particle per 2 ticks") which is one
 * emission per 33 ms at the §21 60 Hz fixed step (~30 / s).
 */
export const EMIT_INTERVAL_TICKS = 2;

/**
 * Speed gate for emission, in meters per second. Below this the car is
 * crawling and any kick-up would feel jittery. The dot pins 8 m/s; that
 * lines up with the slower steering authority kicking in around the
 * same speed band so dust is only seen during meaningful off-road
 * sliding.
 */
export const EMIT_SPEED_THRESHOLD_M_PER_S = 8;

/**
 * Maximum horizontal velocity of a freshly-spawned particle, in pixels
 * per second. The hash returns a value in [-1, 1]; we multiply by this
 * scalar so callers can tune dust spread without touching the hash.
 */
export const PARTICLE_X_VELOCITY_PX_PER_S = 32;

/**
 * Fixed upward drift for emitted particles, in pixels per second.
 * Constant on purpose: dust roost rises in a relatively uniform plume,
 * and a per-particle vertical hash would alias against the horizontal
 * one without adding visual variety at this scale.
 */
export const PARTICLE_Y_VELOCITY_PX_PER_S = -18;

/** Default fill colour for a particle when the caller does not specify. */
export const DEFAULT_DUST_COLOR = "#c9b48a";

/** Maximum draw radius in pixels at spawn. Linearly attenuates to 0. */
export const PARTICLE_RADIUS_PX = 4;

/**
 * One particle in the pool. `vx` and `vy` are linear; we do not model
 * gravity in this slice because the §16 reference cards "dust roost" as
 * a roughly uniform plume.
 */
export interface DustParticle {
  /** Spawn-relative horizontal position in CSS pixels. */
  x: number;
  /** Spawn-relative vertical position in CSS pixels. */
  y: number;
  /** Horizontal velocity, px/s. Hashed off (seed, particleIndex). */
  vx: number;
  /** Vertical velocity, px/s. Constant per `PARTICLE_Y_VELOCITY_PX_PER_S`. */
  vy: number;
  /** Time since spawn, ms. */
  elapsedMs: number;
  /** Fill colour. */
  color: string;
}

/**
 * Pool state. `particles` is exposed read-only so render-time draws can
 * iterate without an extra alloc; mutations go through the entry-point
 * functions below. `tickIdx` advances once per `tickDust` call so the
 * "every 2 ticks" cadence does not depend on wall-clock dt jitter.
 * `nextRecycleIdx` walks 0..MAX_DUST-1 so the oldest particle is the
 * first to be replaced when the pool is full.
 */
export interface DustState {
  particles: readonly DustParticle[];
  tickIdx: number;
  nextRecycleIdx: number;
}

export const INITIAL_DUST_STATE: DustState = Object.freeze({
  particles: Object.freeze([]) as readonly DustParticle[],
  tickIdx: 0,
  nextRecycleIdx: 0,
});

/**
 * Origin where new particles spawn. Typically the screen-space car
 * position. The integration site computes this; the dust module never
 * looks at car / road geometry directly.
 */
export interface DustEmitOrigin {
  x: number;
  y: number;
}

/**
 * Mulberry32-style hash applied to the integer pair `(seed, idx)`,
 * mapped to `[-1, 1]`. Same shape as `vfx.shakeOffsetAt`'s hash; the
 * two modules deliberately do NOT share an implementation so a tweak
 * to one does not silently shift the other's outputs across replays.
 */
function dustHashAt(seed: number, idx: number, axis: number): number {
  let x = (seed | 0) ^ Math.imul(idx | 0, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  x = Math.imul(x ^ Math.imul(axis | 0, 0x27d4eb2d), 0x9e3779b1);
  x ^= x >>> 16;
  const u = (x >>> 0) / 0x100000000;
  return u * 2 - 1;
}

/**
 * Spawn a particle at `origin` with hashed horizontal velocity.
 * Replaces the oldest particle when the pool is at `MAX_DUST`. Returns
 * a new state; never mutates the input.
 *
 * `particleIndex` is a monotonic counter (the pool's emit count, NOT
 * the position in the array) so that two emits in the same frame still
 * hash to different velocities. We thread it through `tickIdx` since
 * emissions only fire on tick boundaries.
 */
function spawnParticle(
  state: DustState,
  origin: DustEmitOrigin,
  seed: number,
  color: string,
): DustState {
  const particleIndex = state.tickIdx;
  const vx = dustHashAt(seed, particleIndex, 0) * PARTICLE_X_VELOCITY_PX_PER_S;
  const particle: DustParticle = {
    x: origin.x,
    y: origin.y,
    vx,
    vy: PARTICLE_Y_VELOCITY_PX_PER_S,
    elapsedMs: 0,
    color,
  };
  if (state.particles.length < MAX_DUST) {
    return {
      particles: [...state.particles, particle],
      tickIdx: state.tickIdx,
      nextRecycleIdx: state.nextRecycleIdx,
    };
  }
  // Pool full: replace the oldest slot in place. `nextRecycleIdx` walks
  // 0..MAX_DUST-1 so the FIFO order is preserved across multiple
  // recycles, which keeps determinism intact even after wrap-around.
  const next = state.particles.slice();
  next[state.nextRecycleIdx] = particle;
  return {
    particles: next,
    tickIdx: state.tickIdx,
    nextRecycleIdx: (state.nextRecycleIdx + 1) % MAX_DUST,
  };
}

export interface TickDustParams {
  surface: Surface;
  speed: number;
  dtMs: number;
  seed: number;
  /**
   * Where to spawn new particles, in canvas-pixel coordinates. The dust
   * module never derives this; the renderer projects the car position
   * before calling `tickDust`. Defaults to (0, 0) for tests that only
   * care about emission counts and lifetimes.
   */
  origin?: DustEmitOrigin;
  /** Optional fill colour override. Defaults to `DEFAULT_DUST_COLOR`. */
  color?: string;
}

/**
 * Advance the pool by `dtMs` and possibly emit one new particle. Pure:
 * the input state is never mutated. The same arguments always produce
 * the same output (per AGENTS.md RULE 8).
 *
 * Cadence:
 * - `tickIdx` increments by exactly 1 per call regardless of dt or
 *   emission. This keeps the "every 2 ticks" rule independent of frame
 *   timing so a long-paused tab does not blast the pool when it
 *   resumes.
 * - Negative or zero `dtMs` advances the tick index but does not move
 *   particles or emit; this matches the `tickVfx` semantics so tests
 *   can drive both modules off the same dt source.
 */
export function tickDust(state: DustState, params: TickDustParams): DustState {
  const tickIdx = state.tickIdx + 1;

  // Advance / cull existing particles. dt <= 0 keeps positions but still
  // bumps tickIdx so the emission cadence stays coherent.
  let particles: DustParticle[];
  if (params.dtMs > 0) {
    particles = [];
    for (const p of state.particles) {
      const elapsed = p.elapsedMs + params.dtMs;
      if (elapsed >= LIFETIME_MS) continue;
      particles.push({
        x: p.x + (p.vx * params.dtMs) / 1000,
        y: p.y + (p.vy * params.dtMs) / 1000,
        vx: p.vx,
        vy: p.vy,
        elapsedMs: elapsed,
        color: p.color,
      });
    }
  } else {
    // Preserve the array reference when nothing moved; the spawn step
    // below copies before mutating so this is still safe.
    particles = state.particles.slice();
  }

  let next: DustState = {
    particles,
    tickIdx,
    nextRecycleIdx: state.nextRecycleIdx,
  };

  const shouldEmit =
    params.surface === "grass" &&
    params.speed > EMIT_SPEED_THRESHOLD_M_PER_S &&
    tickIdx % EMIT_INTERVAL_TICKS === 0;
  if (shouldEmit) {
    const origin = params.origin ?? { x: 0, y: 0 };
    const color = params.color ?? DEFAULT_DUST_COLOR;
    next = spawnParticle(next, origin, params.seed, color);
  }

  return next;
}

/**
 * Paint active particles as soft circles with linearly-decaying alpha
 * and radius. Pure with respect to `state`; only the canvas context is
 * mutated. No-ops on a zero-area viewport so tests can short-circuit
 * the draw without stubbing `arc`.
 */
export function drawDust(
  ctx: CanvasRenderingContext2D,
  state: DustState,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  for (const p of state.particles) {
    const remaining = 1 - p.elapsedMs / LIFETIME_MS;
    if (remaining <= 0) continue;
    const radius = PARTICLE_RADIUS_PX * remaining;
    if (radius <= 0) continue;
    ctx.globalAlpha = remaining;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = prevAlpha;
}
