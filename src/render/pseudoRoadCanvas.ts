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

import { drawDust, type DustState } from "./dust";
import { drawParallax, type ParallaxLayer } from "./parallax";
import { drawVfx, type VfxState } from "./vfx";

/**
 * Default alpha for the ghost car overlay. Pinned by the F-022 dot
 * stress-test item 9: a translucent second car following the player's
 * recorded path so the live driver can see their best line without the
 * ghost occluding the road. Kept as a named constant so the §6 Time Trial
 * UI can dim or brighten the ghost from a settings toggle without
 * re-pinning the magic number at every call site.
 */
export const GHOST_CAR_DEFAULT_ALPHA = 0.5;

/**
 * Default fill colour for the ghost car placeholder rectangle. The §6
 * Time Trial spec calls out a desaturated / blue tint to differentiate
 * the ghost from the live car; we ship the blue tint as the default so
 * the placeholder reads as "other player" without the §17 sprite atlas
 * being wired in. The atlas-frame variant lands in the same slice that
 * threads `LoadedAtlas` into the renderer (followup F-022 consumer side).
 */
export const GHOST_CAR_DEFAULT_FILL = "#5fb6ff";

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
  /**
   * Optional VFX state. When present, the drawer paints active flashes
   * over the parallax / sky band, then translates the canvas by the
   * summed shake offset before drawing the road strips so the entire
   * road frame shakes as one unit. The flash lands BEHIND the road on
   * purpose: a HUD-style overlay flash belongs in the UI layer, while
   * an in-world impact flash should not occlude the player car.
   */
  vfx?: VfxState;
  /**
   * Optional dust pool. Painted AFTER the road strips so particles sit
   * over the grass / road, matching the §16 "Dust roost" reference (the
   * plume rises above the surface, never under it). Production sites
   * tick the pool from the sim layer with the player's surface flag and
   * pass it in here; the drawer never advances the pool itself.
   */
  dust?: DustState;
  /**
   * Optional ghost car overlay per F-022. The §6 Time Trial flow drives
   * a second physics step from the recorded `Player.readNext` inputs to
   * derive the ghost's world position, projects it to the screen with
   * the same camera the live road uses, and passes the resulting
   * placement here. The drawer paints a translucent placeholder rect
   * BEHIND the dust pool (so off-road dust still occludes the ghost) but
   * AFTER the road strips (so the ghost reads as "on the road" rather
   * than driving through it). The atlas-frame draw variant lands when
   * the F-022 consumer slice threads a `LoadedAtlas` reference through
   * the renderer; until then the placeholder rect is the contract.
   *
   * `screenX` / `screenY` are CSS pixels (the render-time coordinates the
   * caller already computed via `segmentProjector.project`); `screenW` is
   * the projected car width in CSS pixels (commonly `strip.screenW *
   * carWidthFraction`); `alpha` defaults to `GHOST_CAR_DEFAULT_ALPHA`
   * when omitted. `null` / `undefined` skips the draw entirely so a fresh
   * Time Trial run with no stored ghost paints nothing extra.
   */
  ghostCar?: {
    screenX: number;
    screenY: number;
    screenW: number;
    alpha?: number;
    fill?: string;
  } | null;
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

  // VFX runs after the sky / parallax pass so the flash overlay sits on
  // top of the static background but BEHIND the road strips. The shake
  // offset, however, has to wrap the road draw so the road translates
  // as one unit. We capture the offset here, then save / translate /
  // restore around the strip loop.
  const shakeOffset = options.vfx ? drawVfx(ctx, options.vfx, viewport) : null;

  if (strips.length >= 2) {
    if (shakeOffset && (shakeOffset.dx !== 0 || shakeOffset.dy !== 0)) {
      ctx.save();
      ctx.translate(shakeOffset.dx, shakeOffset.dy);
      drawStrips(ctx, strips, viewport, colors);
      ctx.restore();
    } else {
      drawStrips(ctx, strips, viewport, colors);
    }
  }

  // Ghost car paints over the road strips so the player sees their best
  // line, but BEFORE the dust pool so off-road dust the live car kicks
  // up still occludes the ghost rather than the ghost showing through
  // the plume. The shake offset is intentionally not applied to the
  // ghost: a §16 impact shake should not drag the recorded path with
  // the live car. Painted unconditionally on a non-empty `ghostCar`
  // prop so an empty strip array (test / dev scenes that draw the sky
  // but no road) still surfaces the ghost overlay.
  if (options.ghostCar) {
    drawGhostCar(ctx, options.ghostCar, viewport);
  }

  // Dust paints last so particles sit over the road / grass strips.
  // The pool is owned by the caller; the drawer is read-only on it.
  if (options.dust) {
    drawDust(ctx, options.dust, viewport);
  }
}

/**
 * Paint the F-022 ghost car overlay as a translucent placeholder rect.
 *
 * The atlas-frame variant (sampling the player car sprite at the same
 * facing the live car uses, optionally desaturated) lands in the F-022
 * consumer slice that wires `LoadedAtlas` through the renderer. Until
 * then the rect is the contract: a `screenW`-wide, half-square-tall
 * box anchored at the projected ground point, painted at 0.5 alpha by
 * default. The aspect choice (1:0.5) keeps the placeholder visually
 * read as a car silhouette without claiming sprite-grade detail.
 *
 * No-op when the projection collapses to zero width (the ghost is past
 * the draw distance / behind the camera) or when the viewport is
 * zero-area, so callers do not need to gate the call themselves.
 *
 * The `globalAlpha` mutation is wrapped in a `try / finally` save and
 * restore equivalent so a thrown rect (vanishingly unlikely on Canvas2D
 * but possible if the host injects a custom context) cannot leak alpha
 * into the next draw call.
 */
function drawGhostCar(
  ctx: CanvasRenderingContext2D,
  ghost: NonNullable<DrawRoadOptions["ghostCar"]>,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  if (!Number.isFinite(ghost.screenW) || ghost.screenW <= 0) return;
  if (!Number.isFinite(ghost.screenX) || !Number.isFinite(ghost.screenY)) return;

  const alpha =
    typeof ghost.alpha === "number" && Number.isFinite(ghost.alpha)
      ? Math.max(0, Math.min(1, ghost.alpha))
      : GHOST_CAR_DEFAULT_ALPHA;
  if (alpha <= 0) return;

  const fill = ghost.fill ?? GHOST_CAR_DEFAULT_FILL;
  // 1:0.5 aspect places the rectangle centered on the projected ground
  // point with the silhouette sitting just above it; matches the §17
  // car-silhouette aspect well enough to read as a vehicle.
  const halfW = ghost.screenW / 2;
  const heightPx = ghost.screenW / 2;

  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  try {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(ghost.screenX - halfW, ghost.screenY - heightPx, ghost.screenW, heightPx);
  } finally {
    ctx.globalAlpha = prevAlpha;
    ctx.fillStyle = prevFill;
  }
}

function drawStrips(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  colors: RoadColors,
): void {
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
