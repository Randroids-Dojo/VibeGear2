/**
 * Radial speed-line streak particle pool. §16 "Strong foreground speed
 * cues" + "Nitro bloom trail": at high speedNorm the player needs
 * radial streaks rushing past the camera so committed speed feels
 * committed. Today the only foreground motion FX above the road are
 * rain streaks (rain-only, downward) and the off-road dust pool
 * (grass-only); on a clear track at top speed the player gets zero
 * foreground motion cues.
 *
 * Source of truth:
 * - `.dots/VibeGear2-implement-radial-speed-02dc1556.md`.
 * - `docs/gdd/16-rendering-and-visual-design.md`
 *   "Strong foreground speed cues" + "Nitro bloom trail".
 * - `docs/gdd/19-controls-and-accessibility.md` reduced-motion gate.
 * - `AGENTS.md` RULE 8: replays must be deterministic, so per-particle
 *   jitter is hashed off `(seed, particleIndex)`, never `Math.random()`.
 *
 * Contract pinned by the dot:
 *
 * - `INITIAL_SPEED_LINE_STATE` is the empty pool. Callers own the state
 *   object and pass it into every entry point. Pool size is fixed at
 *   `MAX_SPEED_LINES = 96`; emissions past the cap recycle the oldest
 *   slot in-place so we never allocate per-emit.
 * - `tickSpeedLines(state, params)` advances the pool by `dtMs` and
 *   possibly emits new particles. The emit rate is a linear ramp from
 *   0 / s at `EMIT_THRESHOLD_NORM = 0.7` to `BASE_PEAK_RATE_PER_SEC = 24`
 *   at `speedNorm = 1`, plus `NITRO_BONUS_RATE_PER_SEC = 18` whenever
 *   `nitroActive` is true (so the peak rate during nitro is 42 / s).
 * - `drawSpeedLines(ctx, state, viewport)` paints active particles as
 *   short white strokes radiating from a horizon focal point toward the
 *   bottom corners. Pure with respect to `state`; only the canvas
 *   context is mutated.
 *
 * Reduced-motion: when `prefersReducedMotion()` is true the emit rate
 * is forced to 0. Existing particles still age out so the pool drains
 * cleanly when the user toggles the OS setting mid-session.
 *
 * Determinism:
 *
 * Each particle's spawn-jitter offset and outward velocity are derived
 * from `speedLineHashAt(seed, particleIndex, axis)` which is pure. The
 * pool advances its `tickIdx` and an emission accumulator once per
 * `tickSpeedLines` call, so two pools fed the same speedNorm / nitro
 * series produce identical particle layouts.
 */

import type { Viewport } from "@/road/types";

import { prefersReducedMotion } from "./vfx";

/** Maximum simultaneously-tracked speed-line particles. */
export const MAX_SPEED_LINES = 96;

/** Particle lifetime in milliseconds. */
export const LIFETIME_MS = 220;

/** Emit threshold on `speed / topSpeed`. Below this no lines emit. */
export const EMIT_THRESHOLD_NORM = 0.7;

/** Emit rate in particles per second at `speedNorm = 1` (no nitro). */
export const BASE_PEAK_RATE_PER_SEC = 24;

/** Additional emit rate while nitro is active. */
export const NITRO_BONUS_RATE_PER_SEC = 18;

/**
 * Outward velocity scalar in view-heights per second. The dot pins
 * `(speedNorm * 8 + nitroActive * 6)` view-heights / sec; at 720 px
 * tall that's roughly 5760 px/s at top speed, 10080 px/s under nitro.
 */
export const RADIAL_VELOCITY_SPEED_FACTOR = 8;
export const RADIAL_VELOCITY_NITRO_BONUS = 6;

/** Stroke colour bands. */
export const BASE_COLOR = "#ffffff";
export const NITRO_COLOR = "#dde7ff";

/** Horizon focal point as a fraction of viewport height. */
export const FOCAL_Y_FRACTION = 0.45;

/** Maximum stroke width in CSS pixels (linearly tapers to 1 px). */
export const MAX_STROKE_WIDTH_PX = 2;

/**
 * One particle in the pool. `vx` / `vy` are in CSS pixels per second.
 * `length` is the per-frame stroke length in CSS pixels (we paint a
 * short streak from `(x - vx*dtFrame, y - vy*dtFrame)` to `(x, y)` for
 * a motion-blur read; `drawSpeedLines` uses a fixed 12 px tail length).
 */
export interface SpeedLineParticle {
  /** Current x position in CSS pixels. */
  x: number;
  /** Current y position in CSS pixels. */
  y: number;
  /** Horizontal velocity, px/s. */
  vx: number;
  /** Vertical velocity, px/s. */
  vy: number;
  /** Time since spawn, ms. */
  elapsedMs: number;
  /** Stroke colour. */
  color: string;
}

export interface SpeedLineState {
  particles: readonly SpeedLineParticle[];
  tickIdx: number;
  nextRecycleIdx: number;
  /**
   * Carry-over fractional emissions across ticks. Without this a
   * 24/s rate at 60 Hz dt would emit on alternating frames only when
   * the rate aligns, losing fidelity at fractional rates. Accumulator
   * resets implicitly when emissions consume integer counts.
   */
  emitAccumulator: number;
}

export const INITIAL_SPEED_LINE_STATE: SpeedLineState = Object.freeze({
  particles: Object.freeze([]) as readonly SpeedLineParticle[],
  tickIdx: 0,
  nextRecycleIdx: 0,
  emitAccumulator: 0,
});

/**
 * Mulberry32-style hash applied to the integer pair `(seed, idx, axis)`,
 * mapped to `[-1, 1]`. Same shape as the dust hash; deliberately
 * separate so a tweak to one does not silently shift the other across
 * replays.
 */
function speedLineHashAt(seed: number, idx: number, axis: number): number {
  let x = (seed | 0) ^ Math.imul(idx | 0, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  x = Math.imul(x ^ Math.imul(axis | 0, 0x27d4eb2d), 0x9e3779b1);
  x ^= x >>> 16;
  const u = (x >>> 0) / 0x100000000;
  return u * 2 - 1;
}

export interface TickSpeedLinesParams {
  /** speed / topSpeed in [0, 1]. Values past 1 are clamped. */
  speedNorm: number;
  /** Whether nitro is currently active. */
  nitroActive: boolean;
  /** Wall-clock delta since the last tick, in milliseconds. */
  dtMs: number;
  /** Per-session deterministic seed. */
  seed: number;
  /** Active viewport. The focal point is at (width/2, height * 0.45). */
  viewport: Viewport;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function spawnParticle(
  state: SpeedLineState,
  emitIndex: number,
  params: TickSpeedLinesParams,
  speedNorm: number,
): SpeedLineState {
  const { viewport, nitroActive, seed } = params;
  const focalX = viewport.width / 2;
  const focalY = viewport.height * FOCAL_Y_FRACTION;
  // Spawn offset within the upper half of the viewport. The hashes are
  // in [-1, 1]; we scale them so the spawn cone covers most of the
  // upper half and a bit of the sides without hitting the corners.
  const jitterX =
    speedLineHashAt(seed, emitIndex, 0) * (viewport.width * 0.45);
  const jitterY =
    Math.abs(speedLineHashAt(seed, emitIndex, 1)) * (viewport.height * 0.25);
  const spawnX = focalX + jitterX;
  const spawnY = focalY - jitterY;
  const dxFromFocal = spawnX - focalX;
  const dyFromFocal = spawnY - focalY;
  const distance = Math.sqrt(dxFromFocal * dxFromFocal + dyFromFocal * dyFromFocal) || 1;
  const radialSpeed =
    (speedNorm * RADIAL_VELOCITY_SPEED_FACTOR +
      (nitroActive ? RADIAL_VELOCITY_NITRO_BONUS : 0)) *
    viewport.height;
  const vx = (dxFromFocal / distance) * radialSpeed;
  const vy = (dyFromFocal / distance) * radialSpeed;
  const particle: SpeedLineParticle = {
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    elapsedMs: 0,
    color: nitroActive ? NITRO_COLOR : BASE_COLOR,
  };
  if (state.particles.length < MAX_SPEED_LINES) {
    return {
      particles: [...state.particles, particle],
      tickIdx: state.tickIdx,
      nextRecycleIdx: state.nextRecycleIdx,
      emitAccumulator: state.emitAccumulator,
    };
  }
  const next = state.particles.slice();
  next[state.nextRecycleIdx] = particle;
  return {
    particles: next,
    tickIdx: state.tickIdx,
    nextRecycleIdx: (state.nextRecycleIdx + 1) % MAX_SPEED_LINES,
    emitAccumulator: state.emitAccumulator,
  };
}

/**
 * Compute the per-second emit rate from speedNorm and nitroActive. A
 * linear ramp from 0 / s at the threshold to BASE_PEAK_RATE_PER_SEC at
 * speedNorm=1, plus the nitro bonus. Reduced-motion forces 0.
 */
export function emitRatePerSec(
  speedNorm: number,
  nitroActive: boolean,
): number {
  if (prefersReducedMotion()) return 0;
  const norm = clamp01(speedNorm);
  if (norm <= EMIT_THRESHOLD_NORM) return 0;
  const ramp =
    (norm - EMIT_THRESHOLD_NORM) / (1 - EMIT_THRESHOLD_NORM);
  const base = ramp * BASE_PEAK_RATE_PER_SEC;
  return base + (nitroActive ? NITRO_BONUS_RATE_PER_SEC : 0);
}

/**
 * Advance the pool by `dtMs` and emit particles per the rate function.
 * Pure: the input state is never mutated.
 *
 * The same arguments always produce the same output (per AGENTS.md
 * RULE 8). `tickIdx` increments by exactly 1 per call regardless of dt
 * or emission so emit-index hashes stay stable when a long-paused tab
 * resumes.
 */
export function tickSpeedLines(
  state: SpeedLineState,
  params: TickSpeedLinesParams,
): SpeedLineState {
  const tickIdx = state.tickIdx + 1;
  const dtSec = Math.max(0, params.dtMs) / 1000;

  // Advance / cull existing particles.
  let particles: SpeedLineParticle[];
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
    particles = state.particles.slice();
  }

  const speedNorm = clamp01(params.speedNorm);
  const rate = emitRatePerSec(speedNorm, params.nitroActive);
  const accumulated = state.emitAccumulator + rate * dtSec;
  const emits = Math.floor(accumulated);
  const carry = accumulated - emits;

  let next: SpeedLineState = {
    particles,
    tickIdx,
    nextRecycleIdx: state.nextRecycleIdx,
    emitAccumulator: carry,
  };

  for (let i = 0; i < emits; i += 1) {
    next = spawnParticle(next, tickIdx * 1009 + i, params, speedNorm);
  }

  return next;
}

/**
 * Paint active particles as short white strokes with linearly-decaying
 * alpha + width. Pure with respect to `state`; only the canvas context
 * is mutated. No-ops on a zero-area viewport.
 */
export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  state: SpeedLineState,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  if (state.particles.length === 0) return;
  const prevAlpha = ctx.globalAlpha;
  const prevLineCap = ctx.lineCap;
  const prevLineWidth = ctx.lineWidth;
  ctx.lineCap = "round";
  for (const p of state.particles) {
    const remaining = 1 - p.elapsedMs / LIFETIME_MS;
    if (remaining <= 0) continue;
    // Per-particle motion-blur tail: 12 px back along the velocity
    // vector. Velocities are in px/s so we scale by a fixed 12 / |v|
    // factor to keep the streak length viewport-independent.
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
    const tailLen = 12;
    const tailX = p.x - (p.vx / speed) * tailLen;
    const tailY = p.y - (p.vy / speed) * tailLen;
    ctx.globalAlpha = 0.6 * remaining;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, MAX_STROKE_WIDTH_PX * remaining);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.globalAlpha = prevAlpha;
  ctx.lineCap = prevLineCap;
  ctx.lineWidth = prevLineWidth;
}
