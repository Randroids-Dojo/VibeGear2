/**
 * Canvas2D HUD overlay drawer.
 *
 * Phase 1 minimal HUD per `docs/IMPLEMENTATION_PLAN.md`. Source of truth:
 * `docs/gdd/20-hud-and-ui-ux.md`. This slice ships only speed, lap, and
 * position; the full HUD treatment (lap timer, best lap, nitro meter,
 * damage, weather icon, minimap) lands in the §20 polish slice.
 *
 * The drawer is the only HUD module that knows about a Canvas2D
 * context. The `HudState` it consumes comes from `src/game/hudState.ts`
 * and is pure-derived from race + car snapshots, so unit tests for the
 * derivation can run headless without canvas mocking.
 *
 * Layout matches §20 "UX wireframe descriptions / Race HUD layout":
 * - Top-left: lap and position
 * - Bottom-right: speed and unit
 *
 * Other §20 corners (top-center lap timer, bottom-left damage, etc) are
 * intentionally empty in this slice.
 */

import type { HudState } from "@/game/hudState";
import type { Viewport } from "@/road/types";

export interface HudColors {
  /** Text fill. */
  text: string;
  /** Tinted text color used to label units and totals. */
  textMuted: string;
  /** Drop-shadow underlay so the HUD reads on grass and sky alike. */
  shadow: string;
}

export interface DrawHudOptions {
  colors?: HudColors;
  /**
   * Padding from the viewport edges in CSS pixels. Defaults to 16,
   * enough to clear a 12 px font with breathing room.
   */
  padding?: number;
  /**
   * Font family for the HUD text. Defaults to a system mono stack so
   * the digits are fixed-width and the display does not jitter as the
   * speed crosses different glyph widths.
   */
  fontFamily?: string;
}

const DEFAULT_COLORS: HudColors = {
  text: "#ffffff",
  textMuted: "#cfd6e4",
  shadow: "rgba(0, 0, 0, 0.65)",
};

const DEFAULT_PADDING = 16;
const DEFAULT_FONT_FAMILY =
  '"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace';

/**
 * Draw a string with a one-pixel drop shadow underlay so it reads over
 * any background. Faster than a real `shadowBlur` and good enough for
 * the §20 minimal-HUD slice; the polish slice can switch to layered
 * blurs once we are confident in the typography.
 */
function drawShadowedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  shadowColor: string,
  textColor: string,
): void {
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y);
}

/**
 * Draw the minimal HUD overlay onto `ctx`. Pure draw: state on the
 * context (fillStyle, font, textAlign, textBaseline) is restored before
 * return so the caller does not need to wrap with save/restore.
 *
 * The renderer is invoked from the rAF render callback (not the fixed
 * sim step), so it shares the road renderer's cadence and cannot
 * flicker between sim ticks. Interpolation between sim states is the
 * caller's responsibility; the HUD reads the current snapshot.
 */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: HudState,
  viewport: Viewport,
  options: DrawHudOptions = {},
): void {
  const colors = options.colors ?? DEFAULT_COLORS;
  const padding = options.padding ?? DEFAULT_PADDING;
  const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;

  const prevFill = ctx.fillStyle;
  const prevFont = ctx.font;
  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;

  // Top-left: lap N / M, then position P / T on a second line.
  ctx.font = `600 16px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lapLabel = `LAP ${state.lap} / ${state.totalLaps}`;
  drawShadowedText(ctx, lapLabel, padding, padding, colors.shadow, colors.text);

  ctx.font = `600 14px ${fontFamily}`;
  const posLabel = `POS ${state.position} / ${state.totalCars}`;
  drawShadowedText(
    ctx,
    posLabel,
    padding,
    padding + 22,
    colors.shadow,
    colors.textMuted,
  );

  // Bottom-right: large speed value with a small unit label below.
  ctx.font = `700 36px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const speedX = viewport.width - padding;
  const speedY = viewport.height - padding - 16;
  const speedText = `${state.speed}`;
  drawShadowedText(ctx, speedText, speedX, speedY, colors.shadow, colors.text);

  ctx.font = `600 12px ${fontFamily}`;
  const unitLabel = state.speedUnit === "mph" ? "MPH" : "KM/H";
  drawShadowedText(
    ctx,
    unitLabel,
    speedX,
    viewport.height - padding,
    colors.shadow,
    colors.textMuted,
  );

  ctx.fillStyle = prevFill;
  ctx.font = prevFont;
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}
