/**
 * Parallax bands renderer.
 *
 * Source of truth: `docs/gdd/16-rendering-and-visual-design.md`
 * "Parallax backgrounds" (three-layer minimum: sky / mountains / hills).
 * API contract pinned in stress-test item 4 of the
 * `implement-visual-polish-7d31d112` parent dot, then split out into
 * `implement-parallax-bands-c1bf44c4`.
 *
 * Contract:
 * - `drawParallax(ctx, layers, camera, viewport)` walks the layer list in
 *   array order. Authors are expected to put the back-most band (sky)
 *   first and the closest band last so the painter's algorithm covers
 *   distant layers with closer ones, matching the road strip drawer's
 *   far-to-near pass.
 * - Horizontal scroll derives ONLY from `camera.x`. The pseudo-3D road
 *   already bakes per-segment curvature into the strip projector's
 *   centerline; if parallax also responded to curvature it would
 *   double-shift (stress-test item 5).
 * - Each layer tiles horizontally so a camera arbitrarily far from world
 *   origin still paints across the viewport without gaps.
 * - When the layer's image is `null` (placeholder / load failure) the
 *   drawer fills the band with the pinned `PLACEHOLDER_FILL` so the route
 *   stays mountable without art assets.
 *
 * Determinism:
 * - `parallaxOffsetFor(layer, camera)` is pure: same camera always returns
 *   the same offset. The drawer composes pure offsets and a pure
 *   `bandRect` calculation so replays paint identical pixels for identical
 *   camera paths.
 */

import type { Camera, Viewport } from "@/road/types";

/**
 * One parallax band. Layered top-to-bottom in the viewport via
 * `bandHeight` and `yAnchor`. `scrollX` is the horizontal scroll factor:
 * 0 = static (sky), 1 = locks to `camera.x`. Recommended values per
 * stress-test item 4: sky 0.0, mountains 0.25, hills 0.6.
 *
 * `image` is null when the asset has not been loaded yet so callers can
 * pre-define their layer set without blocking on `loadImage`.
 */
export interface ParallaxLayer {
  id: "sky" | "mountains" | "hills";
  image: (CanvasImageSource & { width: number }) | null;
  /** Horizontal scroll factor; 0 = static, 1 = locks to `camera.x`. */
  scrollX: number;
  /** Vertical band height in CSS pixels. */
  bandHeight: number;
  /** Vertical anchor in viewport: 0 = top, 1 = bottom. */
  yAnchor: number;
  /**
   * Optional fallback fill for procedural or not-yet-loaded layers.
   * Kept per-layer so live race views can avoid the dev-only magenta
   * missing-art fill while tests can still exercise that fallback.
   */
  fallbackFill?: string;
}

/**
 * Hex fill the drawer uses when a layer's image is null. Matches the
 * sprite atlas fallback so missing-art is always magenta-on-black during
 * dev and never confused with a real palette.
 */
export const PLACEHOLDER_FILL = "#ff00ff";

/**
 * Scaling between world-space `camera.x` (meters, road-width units) and
 * pixel scroll. Pinned at 1 px per world-x unit for Phase 4; balancing
 * slices may tune this without touching the projector. Lives here, not
 * in `road/constants.ts`, because parallax is a pure renderer concept.
 */
export const PARALLAX_PX_PER_WORLD_X = 1;

/**
 * Pure offset for one layer in CSS pixels. Replay tests compare these
 * directly to assert no per-frame jitter under high curvature.
 */
export function parallaxOffsetFor(
  layer: Pick<ParallaxLayer, "scrollX">,
  camera: Pick<Camera, "x">,
): number {
  return camera.x * layer.scrollX * PARALLAX_PX_PER_WORLD_X;
}

/** Pure band rectangle computation; exported for tests. */
export function bandRect(
  layer: Pick<ParallaxLayer, "bandHeight" | "yAnchor">,
  viewport: Viewport,
): { y: number; height: number } {
  const height = layer.bandHeight;
  // yAnchor 0 -> top of viewport, yAnchor 1 -> bottom of viewport (band
  // sits flush with the bottom edge). Linear interpolation.
  const y = (viewport.height - height) * layer.yAnchor;
  return { y, height };
}

/**
 * Modulo that handles negative dividends so a camera scrolling backwards
 * still tiles cleanly. JS's `%` returns a negative remainder for negative
 * operands; we want a value in `[0, m)` for tiling.
 */
function modPositive(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Draw all parallax bands in array order. Sky should be first, hills
 * last. `camera.z` is accepted for forward compatibility (later slices
 * may add depth-driven horizon lift) but is not consumed today.
 */
export function drawParallax(
  ctx: CanvasRenderingContext2D,
  layers: readonly ParallaxLayer[],
  camera: Pick<Camera, "x" | "z">,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  for (const layer of layers) {
    const { y, height } = bandRect(layer, viewport);
    if (height <= 0) continue;

    if (layer.image === null) {
      // Placeholder fill keeps the route mountable when the asset has
      // not loaded. Renderers are expected to swap in the loaded image
      // once `loadImage` resolves; see `spriteAtlas.loadAtlas` for the
      // analogous pattern in the sprite path.
      ctx.fillStyle = layer.fallbackFill ?? PLACEHOLDER_FILL;
      ctx.fillRect(0, y, viewport.width, height);
      continue;
    }

    const imgWidth = layer.image.width;
    if (imgWidth <= 0) continue;
    const offset = parallaxOffsetFor(layer, camera);
    // Tile horizontally. We want the viewport's left edge to land at
    // `offset` modulo image width, then walk one image to the right at
    // a time until we cover the viewport. Negative remainders are
    // handled by `modPositive`.
    const startX = -modPositive(offset, imgWidth);
    for (let x = startX; x < viewport.width; x += imgWidth) {
      ctx.drawImage(layer.image, x, y, imgWidth, height);
    }
  }
}
