/**
 * Canvas2D strip drawer for the pseudo-3D road renderer.
 *
 * Consumes a `Strip[]` produced by `segmentProjector.project` and walks
 * back-to-front, drawing the sky band once, then each visible strip pair
 * (grass, rumble, road, lane markings) as filled trapezoids.
 *
 * Parallax support is opt-in via `DrawRoadOptions.parallax`: when present,
 * the drawer paints the parallax bands instead of the flat sky gradient,
 * preserving the painter's algorithm (background first, road over).
 *
 * No textures in Phase 1, no sprites in this module. Those land in
 * follow-up slices (`spriteAtlas.ts`).
 *
 * The drawer is the only module that knows about a Canvas2D context. The
 * projector is pure so unit tests can run without jsdom canvas mocking.
 */

import {
  DEFAULT_COLORS,
  GRASS_STRIPE_LEN,
  LANE_STRIPE_LEN,
  RUMBLE_STRIPE_LEN,
} from "@/road/constants";
import type { Camera, Strip, Viewport } from "@/road/types";

import { drawParallax, type ParallaxLayer } from "./parallax";

export interface RoadColors {
  skyTop: string;
  skyBottom: string;
  grassLight: string;
  grassDark: string;
  rumbleLight: string;
  rumbleDark: string;
  roadLight: string;
  roadDark: string;
  lane: string;
}

export interface DrawRoadOptions {
  colors?: RoadColors;
  /**
   * Optional parallax bands. When present, the drawer renders the bands
   * instead of the flat sky gradient. Pass an empty array to skip the
   * sky entirely (useful for dev pages that test road-only behaviour).
   * The accompanying `camera` is required so the parallax module can
   * scroll horizontally.
   */
  parallax?: {
    layers: readonly ParallaxLayer[];
    camera: Pick<Camera, "x" | "z">;
  };
}

const FALLBACK_COLORS: RoadColors = {
  skyTop: DEFAULT_COLORS.skyTop,
  skyBottom: DEFAULT_COLORS.skyBottom,
  grassLight: DEFAULT_COLORS.grassLight,
  grassDark: DEFAULT_COLORS.grassDark,
  rumbleLight: DEFAULT_COLORS.rumbleLight,
  rumbleDark: DEFAULT_COLORS.rumbleDark,
  roadLight: DEFAULT_COLORS.roadLight,
  roadDark: DEFAULT_COLORS.roadDark,
  lane: DEFAULT_COLORS.lane,
};

function pickAlternating(index: number, period: number, light: string, dark: string): string {
  return Math.floor(index / period) % 2 === 0 ? light : dark;
}

/** Fill a vertical-axis trapezoid between two centered horizontal segments. */
function drawTrapezoid(
  ctx: CanvasRenderingContext2D,
  color: string,
  nearX: number,
  nearY: number,
  nearHalfW: number,
  farX: number,
  farY: number,
  farHalfW: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(nearX - nearHalfW, nearY);
  ctx.lineTo(nearX + nearHalfW, nearY);
  ctx.lineTo(farX + farHalfW, farY);
  ctx.lineTo(farX - farHalfW, farY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw the sky band as a vertical gradient covering the full viewport.
 * The road strips are drawn over this base.
 */
function drawSky(ctx: CanvasRenderingContext2D, viewport: Viewport, colors: RoadColors): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/**
 * Render the projected road strips into the given Canvas2D context.
 *
 * The strip array is iterated back-to-front so nearer strips paint over
 * farther ones, producing the classic Outrun look without a depth buffer.
 *
 * Empty strip arrays are valid; the drawer renders only the sky band.
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  options: DrawRoadOptions = {},
): void {
  const colors = options.colors ?? FALLBACK_COLORS;

  if (options.parallax) {
    drawParallax(ctx, options.parallax.layers, options.parallax.camera, viewport);
  } else {
    drawSky(ctx, viewport, colors);
  }
  if (strips.length < 2) return;

  // Walk far to near so the painter's algorithm covers distant strips with
  // closer ones. We need pairs (near, far); start from the last visible
  // strip and step toward index 0.
  for (let n = strips.length - 1; n >= 1; n--) {
    const far = strips[n];
    const near = strips[n - 1];
    if (!far || !near) continue;
    if (!far.visible || !near.visible) continue;

    const segIndex = far.segment.index;

    // Grass band: full-width fill behind the road on this strip slice.
    const grassColor = pickAlternating(
      segIndex,
      GRASS_STRIPE_LEN,
      colors.grassLight,
      colors.grassDark,
    );
    ctx.fillStyle = grassColor;
    const yTop = far.screenY;
    const yBottom = near.screenY;
    if (yBottom > yTop) {
      ctx.fillRect(0, yTop, viewport.width, yBottom - yTop);
    }

    // Rumble strips: trapezoid 15% wider than the road.
    const rumbleColor = pickAlternating(
      segIndex,
      RUMBLE_STRIPE_LEN,
      colors.rumbleLight,
      colors.rumbleDark,
    );
    drawTrapezoid(
      ctx,
      rumbleColor,
      near.screenX,
      near.screenY,
      near.screenW * 1.15,
      far.screenX,
      far.screenY,
      far.screenW * 1.15,
    );

    // Road surface.
    const roadColor = pickAlternating(
      segIndex,
      RUMBLE_STRIPE_LEN,
      colors.roadLight,
      colors.roadDark,
    );
    drawTrapezoid(
      ctx,
      roadColor,
      near.screenX,
      near.screenY,
      near.screenW,
      far.screenX,
      far.screenY,
      far.screenW,
    );

    // Lane markings: a narrow center stripe on alternating segments. Phase 1
    // ships a single lane line down the middle; multi-lane comes in §9.
    if (Math.floor(segIndex / LANE_STRIPE_LEN) % 2 === 0) {
      const laneHalfNear = Math.max(1, near.screenW * 0.03);
      const laneHalfFar = Math.max(0.5, far.screenW * 0.03);
      drawTrapezoid(
        ctx,
        colors.lane,
        near.screenX,
        near.screenY,
        laneHalfNear,
        far.screenX,
        far.screenY,
        laneHalfFar,
      );
    }
  }
}
