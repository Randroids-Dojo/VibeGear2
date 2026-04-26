/**
 * Minimap projection.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * (recommended module structure lists `src/road/minimap.ts`),
 * `docs/gdd/20-hud-and-ui-ux.md` (Race HUD: simplified minimap or progress
 * strip; wireframe places it in the bottom-left grip cluster), and
 * `docs/gdd/22-data-schemas.md` (Track data model: minimap points).
 *
 * The minimap is a top-down 2D footprint of the track derived by
 * integrating the per-segment heading. The projection is precomputed once
 * at compile time and cached on the `CompiledTrack`. Runtime callers only
 * pay for `projectCar` (a single linear interpolation) plus a `fitToBox`
 * fit per draw frame.
 *
 * Algorithm (per the dot's "Pinned projection algorithm"):
 *
 *   start at heading 0, position (0, 0)
 *   for each compiled segment:
 *     emit (x, y, segmentIndex)
 *     heading += segment.curve
 *     x += cos(heading) * SEGMENT_LENGTH
 *     y += sin(heading) * SEGMENT_LENGTH
 *
 * The closing snap (uniform scale so the last point lands exactly on the
 * first) keeps loops visually closed even when curve integrals drift.
 *
 * Pure: no `Math.random`, no `Date.now`. Same input always returns the
 * same output. Replays paint the same minimap pixels.
 */

import type { CompiledSegment } from "./types";

/** One minimap point in normalised footprint space. */
export interface MinimapPoint {
  /** Normalised x in `[0, 1]` after `fitToBox` is applied. */
  x: number;
  /** Normalised y in `[0, 1]` after `fitToBox` is applied. */
  y: number;
  /** Compiled segment index this point corresponds to. */
  segmentIndex: number;
}

/** Axis-aligned target rectangle for `fitToBox`. */
export interface MinimapBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectTrackOptions {
  /**
   * Author-overridden footprint points. When supplied the projector skips
   * the heading integration and emits these verbatim with sequential
   * `segmentIndex` values. Used for hand-authored maps where the
   * compiler's loop closure looks distorted.
   */
  override?: readonly { x: number; y: number }[];
  /**
   * Target rectangle to fit the projection into. Defaults to the unit
   * square `{x: 0, y: 0, w: 1, h: 1}`. The aspect ratio of the projection
   * is preserved; the longer axis spans the full box and the shorter
   * axis is centered.
   */
  box?: MinimapBox;
}

/**
 * Project a compiled segment list to a list of normalised minimap points.
 *
 * Returns one point per compiled segment. For an N-segment track the
 * output is N points. The points are uniformly scaled into the supplied
 * box (or the unit square when omitted) preserving aspect ratio.
 *
 * Edge cases:
 * - Single-segment track: returns a single point at the box centre.
 * - Open-ended track that does not loop: closing snap still applies and
 *   the track may appear slightly distorted. This is intentional and
 *   pinned in the dot.
 * - Override supplied: heading integration is skipped and the override is
 *   fitted into the box like any other point list.
 */
export function projectTrack(
  segments: readonly CompiledSegment[],
  options: ProjectTrackOptions = {},
): readonly MinimapPoint[] {
  const box = options.box ?? { x: 0, y: 0, w: 1, h: 1 };

  if (segments.length === 0) return [];

  let rawPoints: { x: number; y: number; segmentIndex: number }[];

  if (options.override !== undefined) {
    rawPoints = options.override.map((p, i) => ({
      x: p.x,
      y: p.y,
      segmentIndex: segments[i]?.index ?? i,
    }));
  } else {
    rawPoints = new Array(segments.length);
    let heading = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      rawPoints[i] = { x, y, segmentIndex: seg.index };
      heading += seg.curve;
      x += Math.cos(heading);
      y += Math.sin(heading);
    }

    // Closing snap: uniformly translate-and-rotate the curve so the first
    // and last points coincide. Approximated cheaply by computing the
    // residual offset after the loop and distributing it linearly across
    // the points proportional to their accumulated arc length.
    const last = rawPoints[rawPoints.length - 1]!;
    const closingDx = -last.x;
    const closingDy = -last.y;
    const total = rawPoints.length - 1;
    if (total > 0 && (closingDx !== 0 || closingDy !== 0)) {
      for (let i = 0; i < rawPoints.length; i++) {
        const t = i / total;
        const p = rawPoints[i]!;
        p.x += closingDx * t;
        p.y += closingDy * t;
      }
    }
  }

  return fitToBox(rawPoints, box);
}

/**
 * Linearly interpolate a car's position between two adjacent precomputed
 * minimap points.
 *
 * `segmentIndex` is the compiled segment the car currently occupies.
 * `segmentProgress` is `[0, 1]` from the start of that segment to the
 * next. Out-of-range values are clamped so a car that has briefly left
 * the track never produces a NaN minimap dot.
 */
export function projectCar(
  points: readonly MinimapPoint[],
  segmentIndex: number,
  segmentProgress: number,
): { x: number; y: number } {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return { x: points[0]!.x, y: points[0]!.y };
  }

  const safeProgress = Number.isFinite(segmentProgress)
    ? Math.min(1, Math.max(0, segmentProgress))
    : 0;
  const safeIndex = Number.isFinite(segmentIndex)
    ? Math.min(points.length - 1, Math.max(0, Math.trunc(segmentIndex)))
    : 0;
  const nextIndex = (safeIndex + 1) % points.length;
  const a = points[safeIndex]!;
  const b = points[nextIndex]!;
  return {
    x: a.x + (b.x - a.x) * safeProgress,
    y: a.y + (b.y - a.y) * safeProgress,
  };
}

/**
 * Uniformly fit a point list into a target rectangle preserving aspect
 * ratio. The longer axis spans the full box; the shorter axis is centred.
 *
 * A point list with zero range on one axis (e.g. a perfectly straight
 * track) is centred on that axis and uses the full span on the other.
 */
export function fitToBox<T extends { x: number; y: number }>(
  points: readonly T[],
  box: MinimapBox,
): readonly (T & { x: number; y: number })[] {
  if (points.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  // Single-segment or otherwise zero-range cases: centre everything on
  // the box centre.
  if (rangeX === 0 && rangeY === 0) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return points.map((p) => ({ ...p, x: cx, y: cy }));
  }

  // Uniform scale so the longer axis fits the box exactly. The shorter
  // axis is centred within its leftover span.
  const scaleX = rangeX === 0 ? 0 : box.w / rangeX;
  const scaleY = rangeY === 0 ? 0 : box.h / rangeY;
  const scale = Math.min(
    scaleX === 0 ? scaleY : scaleX,
    scaleY === 0 ? scaleX : scaleY,
  );
  const usedW = rangeX * scale;
  const usedH = rangeY * scale;
  const offsetX = box.x + (box.w - usedW) / 2;
  const offsetY = box.y + (box.h - usedH) / 2;

  return points.map((p) => ({
    ...p,
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  }));
}
