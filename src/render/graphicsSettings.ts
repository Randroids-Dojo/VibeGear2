import type { GraphicsSettings } from "@/data/schemas";
import { DRAW_DISTANCE } from "@/road/constants";

export type GraphicsTier = GraphicsSettings["drawDistance"];

export interface DeviceHints {
  readonly hardwareConcurrency?: number;
  readonly devicePixelRatio?: number;
}

export interface ResolvedGraphicsSettings {
  readonly mode: GraphicsSettings["mode"];
  readonly drawDistanceSegments: number;
  readonly spriteDensityFactor: number;
  readonly pixelRatioCap: number;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  mode: "auto",
  drawDistance: "high",
  spriteDensity: 1,
  pixelRatioCap: 2,
};

export const DRAW_DISTANCE_BY_TIER: Record<GraphicsTier, number> = {
  low: 90,
  medium: 160,
  high: DRAW_DISTANCE,
  ultra: 420,
};

const AUTO_TIER_SETTINGS: Record<GraphicsTier, Omit<GraphicsSettings, "mode">> = {
  low: {
    drawDistance: "low",
    spriteDensity: 0.25,
    pixelRatioCap: 1,
  },
  medium: {
    drawDistance: "medium",
    spriteDensity: 0.5,
    pixelRatioCap: 1.5,
  },
  high: {
    drawDistance: "high",
    spriteDensity: 0.75,
    pixelRatioCap: 2,
  },
  ultra: {
    drawDistance: "ultra",
    spriteDensity: 1,
    pixelRatioCap: 2,
  },
};

export function detectAutoTier(hints: DeviceHints = browserDeviceHints()): GraphicsTier {
  const cores = hints.hardwareConcurrency ?? 4;
  const dpr = hints.devicePixelRatio ?? 1;
  if (cores <= 2 || dpr >= 3) return "low";
  if (cores <= 4 || dpr >= 2.25) return "medium";
  if (cores >= 12 && dpr <= 1.5) return "ultra";
  return "high";
}

export function browserDeviceHints(): DeviceHints {
  return {
    hardwareConcurrency:
      typeof navigator === "undefined" ? undefined : navigator.hardwareConcurrency,
    devicePixelRatio:
      typeof window === "undefined" ? undefined : window.devicePixelRatio,
  };
}

export function normalizeGraphicsSettings(
  settings: GraphicsSettings | undefined,
): GraphicsSettings {
  return settings ?? DEFAULT_GRAPHICS_SETTINGS;
}

export function resolveGraphicsSettings(
  settings: GraphicsSettings | undefined,
  hints: DeviceHints = browserDeviceHints(),
): ResolvedGraphicsSettings {
  const normalized = normalizeGraphicsSettings(settings);
  const effective =
    normalized.mode === "auto"
      ? AUTO_TIER_SETTINGS[detectAutoTier(hints)]
      : normalized;
  return {
    mode: normalized.mode,
    drawDistanceSegments: DRAW_DISTANCE_BY_TIER[effective.drawDistance],
    spriteDensityFactor: effective.spriteDensity,
    pixelRatioCap: effective.pixelRatioCap,
  };
}

export function clampDevicePixelRatio(
  actualDevicePixelRatio: number,
  pixelRatioCap: number,
): number {
  const actual = Number.isFinite(actualDevicePixelRatio)
    ? actualDevicePixelRatio
    : 1;
  return Math.max(1, Math.min(actual, pixelRatioCap));
}
