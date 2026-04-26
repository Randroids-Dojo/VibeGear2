/**
 * Pure-function pseudo-3D segment projector.
 *
 * Walks a window of compiled segments forward from the camera, accumulates
 * curve and grade per the Gordon / Lou's Pseudo-3D recipe, projects each to
 * screen space with the standard pinhole formula, and culls strips hidden
 * behind a closer hill crest using a back-to-front `maxY` clip.
 *
 * Pinned by `.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md`. No
 * novel math; identical in structure to `Util.project` plus the maxY clip.
 *
 * Pure means easy to unit test without a Canvas2D context: the projector
 * returns a `Strip[]` value and the renderer module consumes it.
 */

import { CURVATURE_SCALE, DRAW_DISTANCE, ROAD_WIDTH, SEGMENT_LENGTH } from "./constants";
import type { Camera, CompiledSegment, Strip, Viewport } from "./types";

export interface ProjectorOptions {
  /** Override the visible strip window. Defaults to `DRAW_DISTANCE`. */
  drawDistance?: number;
}

/**
 * Project a compiled segment list to screen-space strips.
 *
 * Returns the list in **near-to-far** order (index 0 is the closest visible
 * strip). The `maxY` cull marks far-side hidden strips with `visible: false`
 * but keeps them in the array so callers can pair adjacent strips reliably.
 *
 * Edge cases:
 * - Empty segment list: returns `[]`.
 * - Viewport with zero width or height: returns `[]`.
 * - `cameraZ` past the end of the ring: wraps modulo `totalSegments`.
 * - `drawDistance > totalSegments`: capped to `totalSegments` to avoid the
 *   projector double-projecting the same strip on a tiny test track.
 */
export function project(
  segments: readonly CompiledSegment[],
  camera: Camera,
  viewport: Viewport,
  options: ProjectorOptions = {},
): Strip[] {
  if (segments.length === 0) return [];
  if (viewport.width <= 0 || viewport.height <= 0) return [];

  const totalSegments = segments.length;
  const requested = options.drawDistance ?? DRAW_DISTANCE;
  const drawDistance = Math.max(1, Math.min(requested, totalSegments));

  const trackLength = totalSegments * SEGMENT_LENGTH;
  // Wrap camera Z into the ring. Negative camera Z (start-line) wraps too.
  const wrappedCameraZ =
    ((camera.z % trackLength) + trackLength) % trackLength;
  const baseSegmentIndex = Math.floor(wrappedCameraZ / SEGMENT_LENGTH);

  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;

  // Pre-pass: per-segment curve and grade accumulation, then projection.
  let dx = 0;
  let x = 0;
  let dy = 0;
  let y = 0;
  const strips: Strip[] = new Array(drawDistance);
  for (let n = 0; n < drawDistance; n++) {
    const segIndex = (baseSegmentIndex + n) % totalSegments;
    const segment = segments[segIndex];
    if (!segment) continue;

    // Camera-space world position. Curve and grade are pre-scaled in
    // compiled units by the track compiler.
    const worldX = x - camera.x;
    const worldY = y - camera.y;
    // Use the segment offset relative to the camera so wrap-around works.
    // `n * SEGMENT_LENGTH` is the segment's distance ahead of the camera
    // segment; subtract the fractional camera offset within its segment so
    // the closest strip sits exactly at the camera.
    const cameraOffsetWithinSegment = wrappedCameraZ - baseSegmentIndex * SEGMENT_LENGTH;
    const sz = n * SEGMENT_LENGTH - cameraOffsetWithinSegment;

    let strip: Strip;
    if (sz < camera.depth) {
      strip = {
        segment,
        visible: false,
        screenX: 0,
        screenY: viewport.height,
        screenW: 0,
        scale: 0,
        worldX,
        worldY,
      };
    } else {
      const scale = camera.depth / sz;
      const screenX = halfW + scale * worldX * halfW;
      const screenY = halfH - scale * worldY * halfH;
      const screenW = scale * ROAD_WIDTH * halfW;
      strip = {
        segment,
        visible: true,
        screenX,
        screenY,
        screenW,
        scale,
        worldX,
        worldY,
      };
    }
    strips[n] = strip;

    // Advance the curve and grade integrators for the *next* segment.
    x += dx;
    dx += segment.curve;
    y += dy;
    dy += segment.grade;
  }

  // Near-to-far maxY cull (Gordon's racer.js pattern).
  //
  // Walk from the closest visible strip outward. `maxY` tracks the smallest
  // screenY (highest point on screen) reached so far. A strip whose
  // projected centerline lies at or below that running maxY is occluded by
  // a closer hill crest and is marked `visible = false`. The renderer
  // still sees it in the array so it can pair adjacent strips reliably.
  let maxY = viewport.height;
  for (let n = 0; n < drawDistance; n++) {
    const strip = strips[n];
    if (!strip || !strip.visible) continue;
    if (strip.screenY >= maxY) {
      strip.visible = false;
      continue;
    }
    maxY = strip.screenY;
  }

  return strips;
}

/**
 * Default lookahead window for `upcomingCurvature`, in meters. Picked to
 * match the §19 brake-assist's "warning the player about a corner ahead"
 * intent: at 60 m/s (the starter top speed) this is roughly 1.3 seconds
 * of travel, which is the human reaction window the assist is sized for.
 */
export const DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M = 80;

/**
 * Sample the signed curvature in the next `lookaheadMeters` of compiled
 * track ahead of the camera position `cameraZ`. Returns the curve sample
 * with the largest magnitude in the window so the §19 brake-assist gate
 * fires on the sharpest segment in the player's near future, not on the
 * average (which a long straight followed by a tight hairpin would
 * smear toward zero).
 *
 * Pure: depends only on the segment list and the position. Wraps the
 * camera Z modulo the track length so a player crossing the start line
 * still gets a real value rather than a clamped zero.
 *
 * Returns `0` when the segment list is empty, the lookahead is
 * non-positive, or no segment in the window had a signed curve. The
 * sign matches the segment's `curve` (negative = left, positive =
 * right) so consumers can read direction as well as magnitude.
 */
export function upcomingCurvature(
  segments: readonly CompiledSegment[],
  cameraZ: number,
  lookaheadMeters: number = DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M,
): number {
  if (segments.length === 0) return 0;
  if (!Number.isFinite(lookaheadMeters) || lookaheadMeters <= 0) return 0;

  const totalSegments = segments.length;
  const trackLength = totalSegments * SEGMENT_LENGTH;
  const wrappedCameraZ =
    ((cameraZ % trackLength) + trackLength) % trackLength;
  const baseSegmentIndex = Math.floor(wrappedCameraZ / SEGMENT_LENGTH);

  // Cap the lookahead window at the full ring so a tiny test track does
  // not double-sample its own segments. Round up so a partial-segment
  // remainder still gets one sample.
  const requestedSegments = Math.ceil(lookaheadMeters / SEGMENT_LENGTH);
  const lookaheadSegments = Math.min(requestedSegments, totalSegments);

  // Match the projector's convention: pre-scaled `curve` lives in dx
  // accumulator units. We undo the `CURVATURE_SCALE` divide so the
  // returned value is back in the [-1, 1] authored band the §19 brake
  // assist expects.
  let bestSigned = 0;
  let bestMagnitude = 0;
  for (let n = 0; n < lookaheadSegments; n++) {
    const segIndex = (baseSegmentIndex + n) % totalSegments;
    const segment = segments[segIndex];
    if (!segment) continue;
    const magnitude = Math.abs(segment.curve);
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      bestSigned = segment.curve;
    }
  }
  // Re-scale back into the [-1, 1] authored band. The compiler divides
  // by `CURVATURE_SCALE` before storing so multiplying by it here lands
  // back on the authored magnitude.
  const reScaled = bestSigned * CURVATURE_SCALE;
  // Clamp to [-1, 1] so a segment with a slightly out-of-band authored
  // curve (e.g. a future authoring tool that allowed 1.05) does not
  // confuse the assist's `Math.abs(...) >= threshold` gate.
  if (reScaled > 1) return 1;
  if (reScaled < -1) return -1;
  return reScaled;
}
