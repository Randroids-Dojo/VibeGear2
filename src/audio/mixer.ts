import type { AudioSettings } from "@/data/schemas";

export interface MixerSettings extends AudioSettings {
  readonly enabled?: boolean;
}

export interface MixerGains {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
}

export function resolveMixerGains(settings: MixerSettings): MixerGains | null {
  if (settings.enabled === false) {
    return null;
  }

  return {
    master: clamp01(settings.master),
    music: clamp01(settings.music),
    sfx: clamp01(settings.sfx),
  };
}

export function isMixerSilent(gains: MixerGains | null): boolean {
  return gains === null || gains.master === 0 || (gains.music === 0 && gains.sfx === 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
