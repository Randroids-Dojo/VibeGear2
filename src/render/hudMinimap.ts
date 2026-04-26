/**
 * Canvas2D minimap overlay drawer.
 *
 * Source of truth: `docs/gdd/20-hud-and-ui-ux.md` ("simplified minimap or
 * progress strip" in the bottom-left grip cluster of the wireframe). The
 * drawer consumes the pre-projected minimap points from
 * `src/road/minimap.ts` and a list of car positions in the same
 * normalised footprint space, and emits one stroke path for the track
 * plus one filled circle (or square, when colour-blind mode is on) per
 * car.
 *
 * The drawer is the only minimap module that knows about a Canvas2D
 * context. The pure projection lives in `src/road/minimap.ts` so unit
 * tests can run headless without canvas mocking.
 *
 * Layout: callers pass a target box rectangle each frame and the drawer
 * paints the minimap inside it. The pure projection is precomputed once
 * at compile time and cached on the `CompiledTrack`; the drawer never
 * recomputes it.
 *
 * Edge cases:
 * - Empty point list: nothing is drawn (no error, no path).
 * - Box with zero area: nothing is drawn.
 * - Player car missing from the cars list: only the AI markers paint.
 *   The HUD position widget is the source of truth for "did the player
 *   get dropped from the field" and surfaces that condition itself.
 */

import type { MinimapPoint } from "@/road/minimap";

/** One car marker on the minimap. */
export interface MinimapCar {
  /** Normalised footprint x in the same space as `MinimapPoint`. */
  x: number;
  /** Normalised footprint y. */
  y: number;
  /** True for the player; false for AI. Drawn with a different fill. */
  isPlayer: boolean;
}

export interface MinimapColors {
  /** Stroke colour for the track polyline. */
  trackStroke: string;
  /** Fill colour for the player car marker. */
  playerFill: string;
  /** Fill colour for AI car markers. */
  aiFill: string;
  /** Optional background fill behind the minimap. Skipped when empty. */
  background: string;
}

export interface MinimapLayout {
  /** Target rectangle to draw into, in CSS pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** Marker radius in CSS pixels. Defaults to 3. */
  markerRadius?: number;
  /** Track polyline width in CSS pixels. Defaults to 2. */
  trackWidth?: number;
}

export interface DrawMinimapOptions {
  colors?: MinimapColors;
  /**
   * When true the player marker uses a square shape instead of a circle
   * so it is distinguishable from AI markers without relying solely on
   * fill colour. Wire to the §19 colour-blind mode setting.
   */
  colorBlindMode?: boolean;
}

const DEFAULT_COLORS: MinimapColors = {
  trackStroke: "#cfd6e4",
  playerFill: "#ffd54a",
  aiFill: "#7c8da9",
  background: "rgba(8, 14, 28, 0.65)",
};

const DEFAULT_MARKER_RADIUS = 3;
const DEFAULT_TRACK_WIDTH = 2;

/**
 * Draw the minimap overlay onto `ctx`. Pure draw: state on the context
 * (fillStyle, strokeStyle, lineWidth) is restored before return so the
 * caller does not need to wrap with save / restore.
 */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  points: readonly MinimapPoint[],
  cars: readonly MinimapCar[],
  layout: MinimapLayout,
  options: DrawMinimapOptions = {},
): void {
  const colors = options.colors ?? DEFAULT_COLORS;
  const radius = layout.markerRadius ?? DEFAULT_MARKER_RADIUS;
  const trackWidth = layout.trackWidth ?? DEFAULT_TRACK_WIDTH;
  const { box } = layout;

  if (box.w <= 0 || box.h <= 0) return;
  if (points.length === 0 && cars.length === 0) return;

  const prevFill = ctx.fillStyle;
  const prevStroke = ctx.strokeStyle;
  const prevWidth = ctx.lineWidth;

  // Background fill so the polyline reads over the road.
  if (colors.background !== "") {
    ctx.fillStyle = colors.background;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }

  // Track polyline.
  if (points.length >= 2) {
    ctx.strokeStyle = colors.trackStroke;
    ctx.lineWidth = trackWidth;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    // Close the loop so the start and finish line meet visually.
    ctx.closePath();
    ctx.stroke();
  }

  // Car markers. AI first, player last so the player draws on top.
  for (const car of cars) {
    if (car.isPlayer) continue;
    ctx.fillStyle = colors.aiFill;
    ctx.beginPath();
    ctx.arc(car.x, car.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of cars) {
    if (!car.isPlayer) continue;
    ctx.fillStyle = colors.playerFill;
    if (options.colorBlindMode === true) {
      // Square highlight so the player marker is distinguishable by
      // shape, not just colour. §19 colour-blind mode contract.
      ctx.fillRect(car.x - radius, car.y - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(car.x, car.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = prevFill;
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth = prevWidth;
}
