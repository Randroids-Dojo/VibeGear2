/**
 * Canvas2D lap-timer + ghost-delta widget.
 *
 * Source of truth: `docs/gdd/20-hud-and-ui-ux.md` Race HUD ("lap timer",
 * "best lap") and the wireframe ("Top-right: best lap / ghost delta").
 *
 * Up to three text drawcalls per frame (the dot pins "at most three"):
 *   1. Lap timer (large, top-right anchor).
 *   2. Sector label below the timer.
 *   3. Signed delta in red / green below the label, omitted when the
 *      delta is null (first lap of a fresh track, or sector still in
 *      progress).
 *
 * The drawer is the only splits module that knows about a Canvas2D
 * context. The pure state lives in `src/game/sectorTimer.ts` and
 * `src/game/hudState.ts` so unit tests for the math stay headless.
 *
 * Reduced-motion: this widget never animates. Color flashes on improvement
 * are gated by the caller (passes a different `colors.deltaImproved` when
 * it wants to flash on a sub-tick window) so the drawer stays pure.
 */

import type { Viewport } from "@/road/types";

export interface SplitsState {
  /** Cumulative lap-time in ms since the green light. */
  lapTimerMs: number;
  /**
   * Index of the sector currently being driven. Used only to look up the
   * sector label; the caller computes the index from the sector-timer
   * state owned by `src/game/sectorTimer.ts`.
   */
  currentSectorIdx: number;
  /** Sector label (e.g. "split-a"). Drawn below the timer. */
  sectorLabel: string;
  /**
   * Signed delta in ms vs the best run for this sector. Positive = current
   * is slower (red); negative = current is faster (green); `null` = no
   * delta to draw (first run, or sector still in progress).
   */
  sectorDeltaMs: number | null;
}

export interface SplitsColors {
  /** Lap-timer text fill. */
  text: string;
  /** Muted text used for the sector label. */
  textMuted: string;
  /** Delta colour when the player is FASTER than best (negative delta). */
  deltaFaster: string;
  /** Delta colour when the player is SLOWER than best (positive delta). */
  deltaSlower: string;
  /** Drop-shadow underlay so text reads on every background. */
  shadow: string;
}

export interface SplitsLayout {
  /** Padding from the viewport edges in CSS pixels. Defaults to 16. */
  padding?: number;
  /** Font family. Defaults to the §20 monospace stack. */
  fontFamily?: string;
}

const DEFAULT_COLORS: SplitsColors = {
  text: "#ffffff",
  textMuted: "#cfd6e4",
  deltaFaster: "#7ce25a",
  deltaSlower: "#ff5a5a",
  shadow: "rgba(0, 0, 0, 0.65)",
};

const DEFAULT_PADDING = 16;
const DEFAULT_FONT_FAMILY =
  '"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace';

/**
 * Format a millisecond duration as `MM:SS.mmm`. Negative values produce
 * a leading `-`. Pure: `formatLapTime(0)` is `"00:00.000"`.
 */
export function formatLapTime(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--.---";
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const totalMs = Math.round(abs);
  const minutes = Math.floor(totalMs / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${sign}${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

/**
 * Format a signed delta in ms as `+MM:SS.mmm` or `-MM:SS.mmm` rounded to
 * 100 ms granularity per the dot's pinned widget contract.
 */
export function formatDelta(ms: number): string {
  if (!Number.isFinite(ms)) return "+--:--.---";
  // Round to the nearest 100 ms so the display does not flicker on
  // sub-frame jitter. Negative deltas round toward the better direction.
  const rounded = Math.round(ms / 100) * 100;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  const abs = Math.abs(rounded);
  const minutes = Math.floor(abs / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1000);
  const millis = abs % 1000;
  return `${sign}${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

/** Pick the delta fill colour for a signed delta. */
export function deltaColor(
  deltaMs: number,
  colors: SplitsColors = DEFAULT_COLORS,
): string {
  return deltaMs < 0 ? colors.deltaFaster : colors.deltaSlower;
}

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
 * Draw the splits widget into the top-right corner of `viewport`. Pure
 * draw: state on the context (fillStyle, font, textAlign, textBaseline)
 * is restored before return so the caller does not need to wrap with
 * save / restore.
 */
export function drawSplitsWidget(
  ctx: CanvasRenderingContext2D,
  state: SplitsState,
  viewport: Viewport,
  options: { colors?: SplitsColors; layout?: SplitsLayout } = {},
): void {
  const colors = options.colors ?? DEFAULT_COLORS;
  const padding = options.layout?.padding ?? DEFAULT_PADDING;
  const fontFamily = options.layout?.fontFamily ?? DEFAULT_FONT_FAMILY;

  const prevFill = ctx.fillStyle;
  const prevFont = ctx.font;
  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;

  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const x = viewport.width - padding;

  // Lap timer (large).
  ctx.font = `700 20px ${fontFamily}`;
  drawShadowedText(
    ctx,
    formatLapTime(state.lapTimerMs),
    x,
    padding,
    colors.shadow,
    colors.text,
  );

  // Sector label (small, muted).
  ctx.font = `600 12px ${fontFamily}`;
  drawShadowedText(
    ctx,
    state.sectorLabel,
    x,
    padding + 26,
    colors.shadow,
    colors.textMuted,
  );

  // Signed delta. Skipped when null so first-lap runs render only timer + label.
  if (state.sectorDeltaMs !== null && Number.isFinite(state.sectorDeltaMs)) {
    ctx.font = `700 16px ${fontFamily}`;
    drawShadowedText(
      ctx,
      formatDelta(state.sectorDeltaMs),
      x,
      padding + 44,
      colors.shadow,
      deltaColor(state.sectorDeltaMs, colors),
    );
  }

  ctx.fillStyle = prevFill;
  ctx.font = prevFont;
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}
