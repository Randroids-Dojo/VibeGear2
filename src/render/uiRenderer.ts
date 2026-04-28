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
 * - Top-left: lap, position, current-lap timer (TIME row, polish slice),
 *   and BEST lap (polish slice) under that.
 * - Bottom-right: speed and unit
 * - Top-right (below the splits widget): accessibility-assist badge,
 *   only when `HudState.assistBadge.active` is true. The badge sits at
 *   `y = padding + 64` so it never overlaps the splits widget's three
 *   text rows (timer 20 px, label 12 px, delta 16 px, plus padding).
 *
 * The TIME and BEST rows draw only when the matching `HudState` field
 * is supplied (per-field guard); the legacy minimal-HUD callers that
 * never set them keep their current layout untouched.
 *
 * Other §20 corners (bottom-left damage, weather icon, etc) are
 * renderer-guarded so callers can wire them one at a time.
 */

import { ASSIST_BADGE_LABELS, type AssistBadge } from "@/game/assists";
import { formatLapTime, type HudState } from "@/game/hudState";
import type { Viewport } from "@/road/types";

export interface HudColors {
  /** Text fill. */
  text: string;
  /** Tinted text color used to label units and totals. */
  textMuted: string;
  /** Drop-shadow underlay so the HUD reads on grass and sky alike. */
  shadow: string;
  /**
   * Accessibility-assist badge pill background. Tinted accent so the
   * badge reads as a status indicator rather than a regular label.
   */
  assistBadgeFill: string;
  /** Text colour drawn on top of the assist-badge pill. */
  assistBadgeText: string;
  /** Bottom-left status panel fill for damage and weather. */
  statusPanelFill: string;
  /** Healthy damage bar fill. */
  damageGood: string;
  /** Warning damage bar fill. */
  damageWarn: string;
  /** Critical damage bar fill. */
  damageBad: string;
  /** Weather icon chip fill. */
  weatherChipFill: string;
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
  assistBadgeFill: "rgba(80, 130, 220, 0.85)",
  assistBadgeText: "#ffffff",
  statusPanelFill: "rgba(7, 14, 28, 0.72)",
  damageGood: "#66d17a",
  damageWarn: "#f3c84b",
  damageBad: "#ef4b4b",
  weatherChipFill: "rgba(104, 160, 220, 0.78)",
};

const DEFAULT_PADDING = 16;
const DEFAULT_FONT_FAMILY =
  '"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace';

/**
 * Vertical offset (from the top of the viewport, before the configured
 * padding) where the assist badge sits. The splits widget consumes the
 * rows above: timer 20 px + 6 px gap + sector label 12 px + 6 px gap +
 * delta 16 px = ~60 px; the badge sits below at y = padding + 64.
 */
const ASSIST_BADGE_TOP_OFFSET = 64;
/**
 * Vertical offset (from the top of the viewport, before the configured
 * padding) for the §20 current-lap timer row, drawn under the POS line.
 * LAP row sits at y = padding (16 px tall), POS row at y = padding + 22
 * (14 px tall). The timer follows at y = padding + 44.
 */
const LAP_TIMER_TOP_OFFSET = 44;
/**
 * Vertical offset for the §20 BEST lap row, drawn beneath the current
 * timer in the muted text colour. Timer row is 14 px tall; BEST row at
 * y = padding + 64 lines up directly under it.
 */
const BEST_LAP_TOP_OFFSET = 64;
/** Badge pill horizontal padding around the label text. */
const ASSIST_BADGE_PADDING_X = 8;
/** Badge pill vertical padding around the label text. */
const ASSIST_BADGE_PADDING_Y = 4;
/** Badge pill height in CSS pixels. Sized for a 12 px font with breathing room. */
const ASSIST_BADGE_HEIGHT = 20;
/** Badge label font size. Matches the splits sector label so the corner reads cohesive. */
const ASSIST_BADGE_FONT_SIZE = 12;
const STATUS_CLUSTER_WIDTH = 142;
const STATUS_CLUSTER_ROW_HEIGHT = 16;
const STATUS_CLUSTER_BOTTOM_OFFSET = 156;
const DAMAGE_BAR_WIDTH = 74;
const DAMAGE_BAR_HEIGHT = 5;

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

  // §20 lap-timer widget. Drawer is a no-op when neither field is
  // supplied so the existing minimal HUD layout is preserved for
  // callers that have not yet wired the §20 polish data.
  if (state.currentLapElapsedMs != null) {
    ctx.font = `600 14px ${fontFamily}`;
    const timerLabel = `TIME ${formatLapTime(state.currentLapElapsedMs)}`;
    drawShadowedText(
      ctx,
      timerLabel,
      padding,
      padding + LAP_TIMER_TOP_OFFSET,
      colors.shadow,
      colors.text,
    );
  }
  if (state.bestLapMs != null) {
    ctx.font = `600 12px ${fontFamily}`;
    const bestLabel = `BEST ${formatLapTime(state.bestLapMs)}`;
    drawShadowedText(
      ctx,
      bestLabel,
      padding,
      padding + BEST_LAP_TOP_OFFSET,
      colors.shadow,
      colors.textMuted,
    );
  }

  if (state.damage !== undefined || state.weather !== undefined) {
    drawStatusCluster(ctx, state, viewport, padding, fontFamily, colors);
  }

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

  // Top-right (below the splits widget): accessibility-assist badge.
  // Drawer is a no-op when the badge is missing or inactive so the §19
  // assists-off case never paints a phantom pill.
  if (state.assistBadge !== undefined && state.assistBadge.active) {
    drawAssistBadge(ctx, state.assistBadge, viewport, padding, fontFamily, colors);
  }

  ctx.fillStyle = prevFill;
  ctx.font = prevFont;
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}

function drawStatusCluster(
  ctx: CanvasRenderingContext2D,
  state: HudState,
  viewport: Viewport,
  padding: number,
  fontFamily: string,
  colors: HudColors,
): void {
  const rows =
    (state.damage !== undefined ? 2 : 0) + (state.weather !== undefined ? 2 : 0);
  const panelHeight = rows * STATUS_CLUSTER_ROW_HEIGHT + 14;
  const x = padding;
  const y = Math.max(
    padding + 88,
    viewport.height - padding - STATUS_CLUSTER_BOTTOM_OFFSET - panelHeight,
  );
  ctx.fillStyle = colors.statusPanelFill;
  ctx.fillRect(x, y, STATUS_CLUSTER_WIDTH, panelHeight);

  let rowY = y + 8;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 11px ${fontFamily}`;

  if (state.damage !== undefined) {
    const total = state.damage.totalPercent;
    drawShadowedText(
      ctx,
      `DMG ${total}%`,
      x + 8,
      rowY,
      colors.shadow,
      colors.text,
    );
    const barX = x + 60;
    const barY = rowY + 5;
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(barX, barY, DAMAGE_BAR_WIDTH, DAMAGE_BAR_HEIGHT);
    ctx.fillStyle = damageColor(total, colors);
    ctx.fillRect(
      barX,
      barY,
      Math.round((DAMAGE_BAR_WIDTH * Math.max(0, Math.min(100, total))) / 100),
      DAMAGE_BAR_HEIGHT,
    );
    rowY += STATUS_CLUSTER_ROW_HEIGHT;
    const zoneLabel = `E${state.damage.zones.engine} T${state.damage.zones.tires} B${state.damage.zones.body}`;
    drawShadowedText(
      ctx,
      zoneLabel,
      x + 8,
      rowY,
      colors.shadow,
      colors.textMuted,
    );
    rowY += STATUS_CLUSTER_ROW_HEIGHT;
  }

  if (state.weather !== undefined) {
    ctx.fillStyle = colors.weatherChipFill;
    ctx.fillRect(x + 8, rowY + 1, 22, 12);
    drawShadowedText(
      ctx,
      weatherIconText(state.weather.icon),
      x + 13,
      rowY + 1,
      colors.shadow,
      colors.text,
    );
    drawShadowedText(
      ctx,
      state.weather.label,
      x + 36,
      rowY,
      colors.shadow,
      colors.text,
    );
    rowY += STATUS_CLUSTER_ROW_HEIGHT;
    const gripLabel =
      state.weather.gripPercent === undefined
        ? `GRIP ${state.weather.gripHint ?? "dry"}`
        : `GRIP ${state.weather.gripPercent}% ${state.weather.gripHint ?? ""}`.trim();
    drawShadowedText(
      ctx,
      gripLabel.toUpperCase(),
      x + 8,
      rowY,
      colors.shadow,
      colors.textMuted,
    );
  }
}

function damageColor(totalPercent: number, colors: HudColors): string {
  if (totalPercent >= 70) return colors.damageBad;
  if (totalPercent >= 35) return colors.damageWarn;
  return colors.damageGood;
}

function weatherIconText(icon: NonNullable<HudState["weather"]>["icon"]): string {
  switch (icon) {
    case "rain":
      return "R";
    case "fog":
      return "F";
    case "snow":
      return "S";
    case "night":
      return "N";
    case "overcast":
      return "O";
    case "clear":
      return "C";
  }
}

/**
 * Format the assist-badge label. When more than one assist is active,
 * the label gets an `xN` suffix with a plain ASCII multiplication sign
 * so the §20 monospace stack renders it without falling back to a
 * Unicode glyph. The badge always shows the badge's `primary` label;
 * the count tells the player there are more.
 */
export function formatAssistBadgeLabel(badge: AssistBadge): string {
  if (badge.primary === null) return "";
  const base = ASSIST_BADGE_LABELS[badge.primary];
  return badge.count > 1 ? `${base} x${badge.count}` : base;
}

/**
 * Draw the assist-badge pill in the top-right corner, below the splits
 * widget. Caller has already restored / saved the context state, so the
 * pill draw is local: it does not save / restore on its own.
 */
function drawAssistBadge(
  ctx: CanvasRenderingContext2D,
  badge: AssistBadge,
  viewport: Viewport,
  padding: number,
  fontFamily: string,
  colors: HudColors,
): void {
  const label = formatAssistBadgeLabel(badge);
  if (label === "") return;
  // Measure first so the pill background is sized to the label. The
  // recording-mock canvas in tests stubs measureText to return a
  // synthetic width per character; production canvases return a
  // real TextMetrics. Both code paths converge on the same layout.
  ctx.font = `600 ${ASSIST_BADGE_FONT_SIZE}px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const metrics = ctx.measureText(label);
  const labelWidth = Math.max(0, metrics.width);
  const pillWidth = labelWidth + ASSIST_BADGE_PADDING_X * 2;
  const pillHeight = ASSIST_BADGE_HEIGHT;
  const pillRight = viewport.width - padding;
  const pillTop = padding + ASSIST_BADGE_TOP_OFFSET;
  const pillLeft = pillRight - pillWidth;

  ctx.fillStyle = colors.assistBadgeFill;
  ctx.fillRect(pillLeft, pillTop, pillWidth, pillHeight);

  // Label text: anchored right with a small horizontal inset so the
  // glyph never kisses the pill's right edge. Vertical inset keeps the
  // 12 px baseline visually centred inside the 20 px pill.
  drawShadowedText(
    ctx,
    label,
    pillRight - ASSIST_BADGE_PADDING_X,
    pillTop + ASSIST_BADGE_PADDING_Y,
    colors.shadow,
    colors.assistBadgeText,
  );
}
