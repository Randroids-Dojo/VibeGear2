/**
 * Pure state helpers for the Accessibility pane (GDD §19, §20, §22).
 *
 * Separated from `AccessibilityPane.tsx` so the §19 assist catalogue and
 * the toggle-mutation logic can be unit-tested under the default node
 * Vitest environment without RTL or jsdom. The thin React shell binds
 * straight to these helpers; the same pattern landed for
 * `difficultyPaneState.ts`.
 */

import type {
  AccessibilitySettings,
  AssistFieldKey,
  AssistSettings,
  SaveGame,
} from "@/data/schemas";
import { ASSIST_FIELDS } from "@/data/schemas";

export interface AssistSpec {
  readonly key: AssistFieldKey;
  readonly label: string;
  readonly description: string;
}

/**
 * The six §19 'Accessibility controls' assists, in the order the dot
 * pins them. The legacy `steeringAssist`, `autoNitro`, and
 * `weatherVisualReduction` flags are kept on the schema for backward
 * compat but only the canonical six show in the pane: legacy
 * `steeringAssist` is superseded by `steeringSmoothing`, legacy
 * `autoNitro` is folded into the future nitro-assist slice, and
 * `weatherVisualReduction` is the canonical name for the visual-only
 * weather assist below.
 */
export const ASSISTS: ReadonlyArray<AssistSpec> = [
  {
    key: "autoAccelerate",
    label: "Auto accelerate",
    description:
      "Hold full throttle by default; brake input always wins.",
  },
  {
    key: "brakeAssist",
    label: "Brake assist",
    description:
      "Boosts brake input when you are braking into a known high-speed corner.",
  },
  {
    key: "steeringSmoothing",
    label: "Steering smoothing",
    description:
      "Low-pass filter on the steering axis to damp twitchy keyboard input.",
  },
  {
    key: "nitroToggleMode",
    label: "Toggle nitro",
    description:
      "Tap to toggle nitro on or off rather than holding the button.",
  },
  {
    key: "reducedSimultaneousInput",
    label: "Reduced simultaneous input",
    description:
      "Honour only one of steer, accel, brake, nitro, handbrake per tick.",
  },
  {
    key: "weatherVisualReduction",
    label: "Visual-only weather",
    description:
      "Skip weather grip penalties; renderer keeps drawing rain or snow softly.",
  },
];

/**
 * Sentinel: the canonical assist keys must equal the schema's exported
 * `ASSIST_FIELDS` list minus the two legacy slots. The pane test pins
 * this so a future schema extension does not silently drop a UI row.
 */
export const VISIBLE_ASSIST_KEYS: ReadonlyArray<AssistFieldKey> = ASSISTS.map(
  (a) => a.key,
);

export const PANE_HEADLINE = "Accessibility assists";
export const PANE_SUBTITLE =
  "Six §19 assists for smoother control. Each toggle persists to your save and applies to every race mode.";

export const WEATHER_SETTINGS_HEADLINE = "Weather visibility";
export const WEATHER_SETTINGS_SUBTITLE =
  "§14 weather display controls for rain, snow, fog, signs, glare, and flashes.";

export const WEATHER_PARTICLE_INTENSITY_LABEL = "Weather particle intensity";
export const FOG_READABILITY_CLAMP_LABEL = "Fog readability floor";

export const WEATHER_ACCESSIBILITY_DEFAULTS = Object.freeze({
  weatherParticleIntensity: 1,
  reducedWeatherGlare: false,
  highContrastRoadsideSigns: false,
  fogReadabilityClamp: 0,
  weatherFlashReduction: false,
});

const BASE_ACCESSIBILITY_DEFAULTS = Object.freeze({
  colorBlindMode: "off" as const,
  reducedMotion: false,
  largeUiText: false,
  screenShakeScale: 1,
});

export type AssistReadResult = Required<
  Pick<
    AssistSettings,
    | "autoAccelerate"
    | "brakeAssist"
    | "steeringSmoothing"
    | "nitroToggleMode"
    | "reducedSimultaneousInput"
    | "weatherVisualReduction"
  >
>;

export function readAssists(save: SaveGame): AssistReadResult {
  const a = save.settings.assists;
  return {
    autoAccelerate: a.autoAccelerate === true,
    brakeAssist: a.brakeAssist === true,
    steeringSmoothing: a.steeringSmoothing === true,
    nitroToggleMode: a.nitroToggleMode === true,
    reducedSimultaneousInput: a.reducedSimultaneousInput === true,
    weatherVisualReduction: a.weatherVisualReduction === true,
  };
}

export type WeatherAccessibilityReadResult = Required<
  Pick<
    AccessibilitySettings,
    | "weatherParticleIntensity"
    | "reducedWeatherGlare"
    | "highContrastRoadsideSigns"
    | "fogReadabilityClamp"
    | "weatherFlashReduction"
  >
>;

export function readWeatherAccessibility(
  save: SaveGame,
): WeatherAccessibilityReadResult {
  const accessibility = save.settings.accessibility;
  return {
    weatherParticleIntensity: clampUnit(
      accessibility?.weatherParticleIntensity ??
        WEATHER_ACCESSIBILITY_DEFAULTS.weatherParticleIntensity,
    ),
    reducedWeatherGlare:
      accessibility?.reducedWeatherGlare ??
      WEATHER_ACCESSIBILITY_DEFAULTS.reducedWeatherGlare,
    highContrastRoadsideSigns:
      accessibility?.highContrastRoadsideSigns ??
      WEATHER_ACCESSIBILITY_DEFAULTS.highContrastRoadsideSigns,
    fogReadabilityClamp: clampUnit(
      accessibility?.fogReadabilityClamp ??
        WEATHER_ACCESSIBILITY_DEFAULTS.fogReadabilityClamp,
    ),
    weatherFlashReduction:
      accessibility?.weatherFlashReduction ??
      WEATHER_ACCESSIBILITY_DEFAULTS.weatherFlashReduction,
  };
}

export type ApplyAssistResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-value" };

/**
 * Pure save-mutation helper. Returns the next save with the toggle
 * applied, or a same-value noop when nothing changed. The component
 * persists the returned save via `saveSave()`.
 */
export function applyAssistToggle(
  save: SaveGame,
  key: AssistFieldKey,
  value: boolean,
): ApplyAssistResult {
  const current = readAssistField(save, key);
  if (current === value) {
    return { kind: "noop", reason: "same-value" };
  }
  const next: SaveGame = {
    ...save,
    settings: {
      ...save.settings,
      assists: {
        ...save.settings.assists,
        [key]: value,
      },
    },
  };
  return { kind: "applied", save: next };
}

export type WeatherAccessibilityToggleKey =
  | "reducedWeatherGlare"
  | "highContrastRoadsideSigns"
  | "weatherFlashReduction";

export type ApplyWeatherAccessibilityResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-value" };

export function applyWeatherAccessibilityToggle(
  save: SaveGame,
  key: WeatherAccessibilityToggleKey,
  value: boolean,
): ApplyWeatherAccessibilityResult {
  const current = readWeatherAccessibility(save)[key];
  if (current === value) {
    return { kind: "noop", reason: "same-value" };
  }
  return {
    kind: "applied",
    save: withAccessibility(save, { [key]: value }),
  };
}

export function applyWeatherParticleIntensity(
  save: SaveGame,
  value: number,
): ApplyWeatherAccessibilityResult {
  return applyWeatherAccessibilityNumber(
    save,
    "weatherParticleIntensity",
    value,
  );
}

export function applyFogReadabilityClamp(
  save: SaveGame,
  value: number,
): ApplyWeatherAccessibilityResult {
  return applyWeatherAccessibilityNumber(save, "fogReadabilityClamp", value);
}

function applyWeatherAccessibilityNumber(
  save: SaveGame,
  key: "weatherParticleIntensity" | "fogReadabilityClamp",
  value: number,
): ApplyWeatherAccessibilityResult {
  const nextValue = clampUnit(value);
  const current = readWeatherAccessibility(save)[key];
  if (current === nextValue) {
    return { kind: "noop", reason: "same-value" };
  }
  return {
    kind: "applied",
    save: withAccessibility(save, { [key]: nextValue }),
  };
}

function readAssistField(save: SaveGame, key: AssistFieldKey): boolean {
  const raw = save.settings.assists[key];
  return raw === true;
}

function withAccessibility(
  save: SaveGame,
  patch: Partial<WeatherAccessibilityReadResult>,
): SaveGame {
  return {
    ...save,
    settings: {
      ...save.settings,
      accessibility: {
        ...BASE_ACCESSIBILITY_DEFAULTS,
        ...save.settings.accessibility,
        ...readWeatherAccessibility(save),
        ...patch,
      },
    },
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Sanity helper consumed by both the pane and its tests: reports
 * whether a particular assist is currently active on the save. Lets
 * the React shell stay declarative without re-reading the assist
 * field shape.
 */
export function isAssistActive(save: SaveGame, key: AssistFieldKey): boolean {
  return readAssistField(save, key);
}

/**
 * Re-export the canonical schema field list so the pane test can
 * assert that the visible row count matches the §19 + §22 contract
 * from a single source of truth.
 */
export const ALL_ASSIST_FIELDS = ASSIST_FIELDS;
