import type { GraphicsSettings, SaveGame } from "@/data/schemas";
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type GraphicsTier,
  normalizeGraphicsSettings,
} from "@/render/graphicsSettings";

export const PERFORMANCE_PANE_HEADLINE = "Performance";
export const PERFORMANCE_PANE_SUBTITLE =
  "Tune road visibility, roadside prop density, and high-DPI canvas cost for weaker devices.";

export const GRAPHICS_DRAW_DISTANCE_OPTIONS: ReadonlyArray<{
  readonly value: GraphicsTier;
  readonly label: string;
  readonly description: string;
}> = [
  { value: "low", label: "Low", description: "Shortest safe visibility for low-end devices." },
  { value: "medium", label: "Medium", description: "Reduced horizon for integrated GPUs." },
  { value: "high", label: "High", description: "Default full-distance road view." },
  { value: "ultra", label: "Ultra", description: "Extra horizon on fast desktops." },
];

export const GRAPHICS_SPRITE_DENSITY_OPTIONS = [
  { value: 0.25, label: "25%" },
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
] as const;

export const GRAPHICS_PIXEL_RATIO_OPTIONS = [
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
] as const;

export type ApplyGraphicsSettingsResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-value" };

export function readGraphicsSettings(save: SaveGame): GraphicsSettings {
  return normalizeGraphicsSettings(save.settings.graphics);
}

export function applyGraphicsSettings(
  save: SaveGame,
  patch: Partial<GraphicsSettings>,
): ApplyGraphicsSettingsResult {
  const current = readGraphicsSettings(save);
  const next: GraphicsSettings = {
    ...current,
    ...patch,
  };
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return { kind: "noop", reason: "same-value" };
  }
  return {
    kind: "applied",
    save: {
      ...save,
      settings: {
        ...save.settings,
        graphics: next,
      },
    },
  };
}

export function resetGraphicsSettings(save: SaveGame): SaveGame {
  return {
    ...save,
    settings: {
      ...save.settings,
      graphics: { ...DEFAULT_GRAPHICS_SETTINGS },
    },
  };
}
