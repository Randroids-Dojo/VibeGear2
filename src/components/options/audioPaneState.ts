import type { AudioSettings, SaveGame } from "@/data/schemas";

export type AudioLevelKey = keyof AudioSettings;

export interface AudioControlSpec {
  readonly key: AudioLevelKey;
  readonly label: string;
  readonly description: string;
}

export const AUDIO_SETTINGS_DEFAULTS: AudioSettings = Object.freeze({
  master: 1,
  music: 0.8,
  sfx: 0.9,
});

export const AUDIO_CONTROLS: ReadonlyArray<AudioControlSpec> = [
  {
    key: "master",
    label: "Master",
    description: "Overall output level for every audio bus.",
  },
  {
    key: "music",
    label: "Music",
    description: "Menu and race music bus level before master output.",
  },
  {
    key: "sfx",
    label: "SFX",
    description: "Engine, tire, hazard, countdown, and UI sound level before master output.",
  },
];

export const AUDIO_PANE_HEADLINE = "Audio mix";
export const AUDIO_PANE_SUBTITLE =
  "§20 mix controls for master, music, and SFX levels. These settings persist to your save and feed the §18 mixer.";

export type ApplyAudioLevelResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-value" };

export function readAudioSettings(save: SaveGame): AudioSettings {
  const audio = save.settings.audio;
  return {
    master: clampUnit(audio?.master ?? AUDIO_SETTINGS_DEFAULTS.master),
    music: clampUnit(audio?.music ?? AUDIO_SETTINGS_DEFAULTS.music),
    sfx: clampUnit(audio?.sfx ?? AUDIO_SETTINGS_DEFAULTS.sfx),
  };
}

export function applyAudioLevel(
  save: SaveGame,
  key: AudioLevelKey,
  value: number,
): ApplyAudioLevelResult {
  const nextValue = clampUnit(value);
  const current = readAudioSettings(save);
  if (current[key] === nextValue) {
    return { kind: "noop", reason: "same-value" };
  }
  return {
    kind: "applied",
    save: {
      ...save,
      settings: {
        ...save.settings,
        audio: {
          ...current,
          [key]: nextValue,
        },
      },
    },
  };
}

export function formatAudioPercent(value: number): string {
  return `${Math.round(clampUnit(value) * 100)}%`;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 100) / 100;
}
