import { segmentIsTunnel } from "@/game/tunnelState";
import type { Strip, Viewport } from "@/road/types";

export const TUNNEL_ADAPTATION_OVERLAY_FILL = "#05070d";
export const TUNNEL_ADAPTATION_HIGHLIGHT_FILL = "#f2e18a";
export const TUNNEL_ADAPTATION_MAX_ALPHA = 0.38;
export const TUNNEL_ADAPTATION_HIGHLIGHT_MAX_ALPHA = 0.24;

export interface TunnelRendererOptions {
  readonly enabled?: boolean;
  readonly intensityScale?: number;
}

export function drawTunnelAdaptation(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  options: TunnelRendererOptions | undefined,
): void {
  if (options?.enabled === false) return;
  if (viewport.width <= 0 || viewport.height <= 0) return;
  const intensity = tunnelAdaptationIntensity(strips) * clampUnit(options?.intensityScale ?? 1);
  if (intensity <= 0) return;

  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = TUNNEL_ADAPTATION_MAX_ALPHA * intensity;
    ctx.fillStyle = TUNNEL_ADAPTATION_OVERLAY_FILL;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.globalAlpha = TUNNEL_ADAPTATION_HIGHLIGHT_MAX_ALPHA * intensity;
    ctx.fillStyle = TUNNEL_ADAPTATION_HIGHLIGHT_FILL;
    const bandHeight = Math.max(2, viewport.height * 0.018);
    ctx.fillRect(0, viewport.height * 0.22, viewport.width, bandHeight);
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

export function tunnelAdaptationIntensity(strips: readonly Strip[]): number {
  let visible = 0;
  let tunnel = 0;
  for (const strip of strips) {
    if (!strip.visible) continue;
    visible += 1;
    if (segmentIsTunnel(strip.segment)) tunnel += 1;
  }
  if (visible === 0 || tunnel === 0) return 0;
  return 0.55 + Math.min(0.45, tunnel / visible);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
