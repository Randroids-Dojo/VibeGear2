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

interface LocalProjectionOffset {
  readonly x: number;
  readonly y: number;
}

function buildLocalProjectionOffsets(
  segments: readonly CompiledSegment[],
  baseSegmentIndex: number,
  count: number,
): LocalProjectionOffset[] {
  const offsets: LocalProjectionOffset[] = new Array(count);
  let dx = 0;
  let x = 0;
  let dy = 0;
  let y = 0;
  const totalSegments = segments.length;

  for (let n = 0; n < count; n++) {
    offsets[n] = { x, y };
    const segment = segments[(baseSegmentIndex + n) % totalSegments];
    if (!segment) continue;
    x += dx;
    dx += segment.curve;
    y += dy;
    dy += segment.grade;
  }

  return offsets;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
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
  const cameraOffsetWithinSegment =
    wrappedCameraZ - baseSegmentIndex * SEGMENT_LENGTH;
  const segmentProgress = cameraOffsetWithinSegment / SEGMENT_LENGTH;
  const boundaryBlend = smoothStep(segmentProgress);
  const currentOffsets = buildLocalProjectionOffsets(
    segments,
    baseSegmentIndex,
    drawDistance,
  );
  const nextOffsets = buildLocalProjectionOffsets(
    segments,
    (baseSegmentIndex + 1) % totalSegments,
    drawDistance,
  );

  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;

  // Pre-pass: per-segment curve and grade accumulation, then projection.
  const strips: Strip[] = new Array(drawDistance);
  for (let n = 0; n < drawDistance; n++) {
    const logicalIndex = baseSegmentIndex + n;
    const segIndex = logicalIndex % totalSegments;
    const segment = segments[segIndex];
    if (!segment) continue;

    const current = currentOffsets[n] ?? { x: 0, y: 0 };
    const next = n > 0 ? nextOffsets[n - 1] ?? current : current;
    // Camera-space world position. The projection remains a bounded
    // local hill window, matching the existing pseudo-3D scale, but
    // blends toward the next segment's local window as the camera
    // approaches a segment boundary. That removes grade-reversal pops
    // without accumulating the whole track's elevation into the view.
    const worldX = lerp(current.x, next.x, boundaryBlend) - camera.x;
    const worldY = lerp(current.y, next.y, boundaryBlend) - camera.y;
    // Use the segment offset relative to the camera so wrap-around works.
    // `n * SEGMENT_LENGTH` is the segment's distance ahead of the camera
    // segment; subtract the fractional camera offset within its segment so
    // the closest strip sits exactly at the camera.
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

  attachForegroundProjection(strips, viewport);

  return strips;
}

/**
 * Attach a screen-bottom endpoint to the closest visible strip. This keeps
 * the renderer's foreground road inside the same projection contract as
 * the rest of the strip list instead of patching the lower viewport with
 * hard-coded road geometry.
 */
function attachForegroundProjection(strips: Strip[], viewport: Viewport): void {
  const nearIndex = strips.findIndex((strip) => strip.visible);
  if (nearIndex < 0) return;

  const near = strips[nearIndex]!;
  if (near.screenY >= viewport.height) return;

  const far = strips.slice(nearIndex + 1).find((strip) => strip.visible);
  const extrapolation =
    far && near.screenY > far.screenY
      ? (viewport.height - near.screenY) / (near.screenY - far.screenY)
      : 0;
  const projectedX =
    far && extrapolation > 0
      ? near.screenX + (near.screenX - far.screenX) * extrapolation
      : near.screenX;
  const projectedHalfW =
    far && extrapolation > 0
      ? near.screenW + (near.screenW - far.screenW) * extrapolation
      : near.screenW;
  const screenW = Math.max(near.screenW, projectedHalfW);

  near.foreground = {
    screenX: projectedX,
    screenY: viewport.height,
    screenW,
  };
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

/**
 * Output of `projectGhostCar`. Mirrors the `screenX` / `screenY` / `screenW`
 * fields the §6 ghost overlay drawer (see `pseudoRoadCanvas.drawRoad`'s
 * `ghostCar` prop) consumes plus a `visible` gate so the caller can skip
 * the prop entirely when the ghost falls behind the camera or past the
 * draw distance.
 *
 * `screenX`, `screenY`, and `screenW` are CSS pixels in the same coordinate
 * frame the strip projector produces; passing them straight into the
 * `ghostCar` prop reuses the same camera projection the live road draw
 * already paid for.
 *
 * `worldX` / `worldY` mirror the strip projector's debug fields so a
 * future renderer slice (e.g. the F-022 atlas-frame upgrade) can sample
 * the same camera-space position the road draw used without recomputing
 * the integration.
 */
export interface GhostCarProjection {
  visible: boolean;
  screenX: number;
  screenY: number;
  screenW: number;
  scale: number;
  worldX: number;
  worldY: number;
}

const HIDDEN_GHOST_PROJECTION: Readonly<GhostCarProjection> = Object.freeze({
  visible: false,
  screenX: 0,
  screenY: 0,
  screenW: 0,
  scale: 0,
  worldX: 0,
  worldY: 0,
});

/**
 * Project one ghost car's world-space `(z, x)` to the screen-space prop the
 * §6 ghost overlay drawer consumes (`pseudoRoadCanvas.drawRoad`'s
 * `ghostCar` field). Pure helper companion to `project`: shares the same
 * pseudo-3D pinhole math and the same curve / grade integration so a
 * ghost rendered through this helper sits on the same road plane the live
 * strips paint.
 *
 * Why a separate helper rather than reading the existing `Strip[]`:
 *
 *   - The live `project` walks `[0, drawDistance)` segments forward of the
 *     camera and returns one strip per segment. The ghost lives at a
 *     specific `(z, x)` between two of those segments; reading off a
 *     strip would either round to the segment boundary (visible jitter
 *     each tick) or require the caller to interpolate by hand at every
 *     site.
 *   - Hoisting that interpolation behind a single helper means the §6
 *     Time Trial route (and any future "second car" overlay slice) can
 *     get a screen position for any `(z, x)` without re-implementing the
 *     curve / grade accumulator. The math is identical to the strip
 *     projector at integer segment boundaries; in between, the ghost's
 *     near edge sits at `cameraDepth / (ghostZ - cameraZ)` scale, which
 *     is the same expression the strip loop uses.
 *
 * Samples the same bounded local hill window used by the strip projector.
 * The ghost's lateral `ghostX` is added to the sampled curve offset
 * before camera subtraction, which mirrors how a live car at `(z, x)`
 * would project.
 *
 * Edge cases:
 *
 *   - Empty segment list: returns `HIDDEN_GHOST_PROJECTION` (visible:
 *     false). The drawer skips the prop on `visible === false`, so the
 *     caller can wire this through unconditionally.
 *   - Degenerate viewport (`width <= 0` or `height <= 0`): returns
 *     hidden. Mirrors `project`'s guard.
 *   - Ghost behind the near plane (`sz < camera.depth`): returns hidden.
 *     The drawer also re-checks `screenW > 0`, so this is defence in
 *     depth rather than the load-bearing path.
 *   - Ghost past the draw distance (`sz > drawDistance * SEGMENT_LENGTH`):
 *     returns hidden. Without this clamp the helper would still produce a
 *     valid (if vanishingly small) projection for a ghost a full lap
 *     ahead, which is not what the renderer should paint.
 *   - Non-finite `ghostZ` or `ghostX`: returns hidden. The Time Trial
 *     route reads `ghostZ` from a recorded `Replay` driven through a
 *     fresh physics step; a NaN here would be a producer bug, but the
 *     guard keeps the renderer safe.
 *   - Camera Z past the end of the ring: wraps modulo track length so a
 *     player crossing the start line still projects the ghost
 *     consistently. Ghost Z wraps the same way; the segment walk uses
 *     the wrapped pair so a ghost one full lap ahead lines up with the
 *     same screen position as a fresh ghost at z=0.
 *
 * Ring-wrap semantics: when `ghostZ` lies past the end of the compiled
 * ring relative to `cameraZ`, the helper treats the ghost as on the
 * next lap and walks the ring around. A ghost behind the camera (the
 * player has overtaken the recorded best) falls into the "behind the
 * near plane" branch and renders as hidden, which matches the §6 intent
 * (you have left your best line behind, so there is nothing in front of
 * you to chase).
 */
export function projectGhostCar(
  segments: readonly CompiledSegment[],
  camera: Camera,
  viewport: Viewport,
  ghostZ: number,
  ghostX: number,
  options: ProjectorOptions = {},
): GhostCarProjection {
  if (segments.length === 0) return HIDDEN_GHOST_PROJECTION;
  if (viewport.width <= 0 || viewport.height <= 0) {
    return HIDDEN_GHOST_PROJECTION;
  }
  if (!Number.isFinite(ghostZ) || !Number.isFinite(ghostX)) {
    return HIDDEN_GHOST_PROJECTION;
  }

  const totalSegments = segments.length;
  const requested = options.drawDistance ?? DRAW_DISTANCE;
  const drawDistance = Math.max(1, Math.min(requested, totalSegments));

  const trackLength = totalSegments * SEGMENT_LENGTH;
  const wrappedCameraZ =
    ((camera.z % trackLength) + trackLength) % trackLength;
  const wrappedGhostZ =
    ((ghostZ % trackLength) + trackLength) % trackLength;
  const baseSegmentIndex = Math.floor(wrappedCameraZ / SEGMENT_LENGTH);
  const cameraOffsetWithinSegment =
    wrappedCameraZ - baseSegmentIndex * SEGMENT_LENGTH;
  const segmentProgress = cameraOffsetWithinSegment / SEGMENT_LENGTH;
  const boundaryBlend = smoothStep(segmentProgress);

  // Forward distance from the camera to the ghost. A ghost behind the
  // camera in lap-relative terms wraps to "one lap ahead" so a player
  // who has just crossed the start/finish line still sees the persisted
  // ghost from the prior lap up the road. The strip projector uses the
  // same convention via its modulo wrap.
  let forwardZ = wrappedGhostZ - wrappedCameraZ;
  if (forwardZ < 0) {
    forwardZ += trackLength;
  }

  if (forwardZ < camera.depth) return HIDDEN_GHOST_PROJECTION;
  if (forwardZ > drawDistance * SEGMENT_LENGTH) {
    return HIDDEN_GHOST_PROJECTION;
  }

  const ghostSegmentOffset = Math.floor(
    (forwardZ + cameraOffsetWithinSegment) / SEGMENT_LENGTH,
  );
  const currentOffsets = buildLocalProjectionOffsets(
    segments,
    baseSegmentIndex,
    ghostSegmentOffset + 1,
  );
  const nextOffsets = buildLocalProjectionOffsets(
    segments,
    (baseSegmentIndex + 1) % totalSegments,
    ghostSegmentOffset + 1,
  );
  const current = currentOffsets[ghostSegmentOffset] ?? { x: 0, y: 0 };
  const next =
    ghostSegmentOffset > 0
      ? nextOffsets[ghostSegmentOffset - 1] ?? current
      : current;
  const worldX = lerp(current.x, next.x, boundaryBlend) + ghostX - camera.x;
  const worldY = lerp(current.y, next.y, boundaryBlend) - camera.y;
  const sz = forwardZ;
  const scale = camera.depth / sz;
  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;
  const screenX = halfW + scale * worldX * halfW;
  const screenY = halfH - scale * worldY * halfH;
  const screenW = scale * ROAD_WIDTH * halfW;

  return {
    visible: true,
    screenX,
    screenY,
    screenW,
    scale,
    worldX,
    worldY,
  };
}
