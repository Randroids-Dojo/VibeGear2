import type { AudioSettings } from "@/data/schemas";

import { isMixerSilent, resolveMixerGains } from "./mixer";

export type MusicCueId =
  | "title"
  | "velvet-coast"
  | "iron-borough"
  | "ember-steppe"
  | "breakwater-isles"
  | "glass-ridge"
  | "neon-meridian"
  | "moss-frontier"
  | "crown-circuit";

export interface MusicCue {
  readonly id: MusicCueId;
  readonly src: string;
}

export interface MusicIntensity {
  readonly volumeScale: number;
  readonly playbackRate: number;
}

export interface RaceMusicInput {
  readonly trackId: string;
  readonly tourId?: string | null;
  readonly mode?: "race" | "timeTrial";
}

export interface RaceMusicIntensityInput {
  readonly speed: number;
  readonly topSpeed: number;
  readonly nitroActive?: boolean;
  readonly finalLap?: boolean;
}

export interface MusicAudioElementLike {
  src: string;
  loop: boolean;
  preload: string;
  volume: number;
  playbackRate: number;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
}

export interface MusicRuntimeOptions {
  readonly createAudio?: (src: string) => MusicAudioElementLike | null;
  readonly nowSeconds?: () => number;
  readonly baseGain?: number;
  readonly fadeSeconds?: number;
}

interface Channel {
  readonly cue: MusicCue;
  readonly element: MusicAudioElementLike;
  readonly startedAt: number;
  readonly fromVolume: number;
}

const SILENT_AUDIO: AudioSettings = Object.freeze({
  master: 0,
  music: 0,
  sfx: 0,
});

const DEFAULT_INTENSITY: MusicIntensity = Object.freeze({
  volumeScale: 1,
  playbackRate: 1,
});

const DEFAULT_BASE_GAIN = 0.34;
const DEFAULT_FADE_SECONDS = 0.35;

export const MUSIC_CUES: Readonly<Record<MusicCueId, MusicCue>> = Object.freeze({
  title: { id: "title", src: "/audio/music/title.opus" },
  "velvet-coast": {
    id: "velvet-coast",
    src: "/audio/music/velvet-coast.opus",
  },
  "iron-borough": {
    id: "iron-borough",
    src: "/audio/music/iron-borough.opus",
  },
  "ember-steppe": {
    id: "ember-steppe",
    src: "/audio/music/ember-steppe.opus",
  },
  "breakwater-isles": {
    id: "breakwater-isles",
    src: "/audio/music/breakwater-isles.opus",
  },
  "glass-ridge": {
    id: "glass-ridge",
    src: "/audio/music/glass-ridge.opus",
  },
  "neon-meridian": {
    id: "neon-meridian",
    src: "/audio/music/neon-meridian.opus",
  },
  "moss-frontier": {
    id: "moss-frontier",
    src: "/audio/music/moss-frontier.opus",
  },
  "crown-circuit": {
    id: "crown-circuit",
    src: "/audio/music/crown-circuit.opus",
  },
});

export function titleMusicCue(): MusicCue {
  return MUSIC_CUES.title;
}

export function raceMusicCue(input: RaceMusicInput): MusicCue {
  const region = regionMusicCueId(input.tourId ?? input.trackId);
  return MUSIC_CUES[region];
}

export function raceMusicIntensity(input: RaceMusicIntensityInput): MusicIntensity {
  const speedScalar = clampUnit(input.speed / Math.max(1, input.topSpeed));
  const nitro = input.nitroActive ? 1 : 0;
  const finalLap = input.finalLap ? 1 : 0;
  const timeTrialTrim = input.nitroActive === undefined ? -0.04 : 0;
  return {
    volumeScale: clamp(0.76 + speedScalar * 0.2 + nitro * 0.07 + finalLap * 0.06, 0, 1.12),
    playbackRate: clamp(0.98 + speedScalar * 0.035 + nitro * 0.025 + finalLap * 0.015 + timeTrialTrim, 0.92, 1.08),
  };
}

export class MusicRuntime {
  private active: Channel | null = null;
  private fadingOut: Channel | null = null;
  private readonly createAudio: (src: string) => MusicAudioElementLike | null;
  private readonly nowSeconds: () => number;
  private readonly baseGain: number;
  private readonly fadeSeconds: number;

  constructor(options: MusicRuntimeOptions = {}) {
    this.createAudio = options.createAudio ?? browserAudioElementFactory;
    this.nowSeconds = options.nowSeconds ?? defaultNowSeconds;
    this.baseGain = nonNegativeOr(options.baseGain, DEFAULT_BASE_GAIN);
    this.fadeSeconds = nonNegativeOr(options.fadeSeconds, DEFAULT_FADE_SECONDS);
  }

  currentCueId(): MusicCueId | null {
    return this.active?.cue.id ?? null;
  }

  isPlaying(): boolean {
    return this.active !== null;
  }

  play(
    cue: MusicCue,
    audio: AudioSettings | undefined,
    intensity: MusicIntensity = DEFAULT_INTENSITY,
  ): boolean {
    const targetVolume = this.effectiveGain(audio, intensity);
    if (targetVolume === 0) {
      this.stop();
      return false;
    }

    if (this.active?.cue.id === cue.id) {
      this.update(audio, intensity);
      return true;
    }

    const element = this.createAudio(cue.src);
    if (element === null) return false;

    const now = this.nowSeconds();
    if (this.active !== null) {
      this.fadingOut = {
        ...this.active,
        startedAt: now,
        fromVolume: this.active.element.volume,
      };
    }

    element.src = cue.src;
    element.loop = true;
    element.preload = "auto";
    element.currentTime = 0;
    element.volume = 0;
    element.playbackRate = intensity.playbackRate;
    this.active = { cue, element, startedAt: now, fromVolume: 0 };
    void Promise.resolve(element.play()).catch(() => {
      if (this.active?.element === element) this.active = null;
      this.stopChannel({ cue, element, startedAt: now, fromVolume: 0 });
    });
    this.update(audio, intensity);
    return true;
  }

  update(
    audio: AudioSettings | undefined,
    intensity: MusicIntensity = DEFAULT_INTENSITY,
  ): void {
    const now = this.nowSeconds();
    const targetVolume = this.effectiveGain(audio, intensity);

    if (targetVolume === 0) {
      this.stop();
      return;
    }

    if (this.active !== null) {
      const fade = fadeProgress(now, this.active.startedAt, this.fadeSeconds);
      this.active.element.volume = targetVolume * fade;
      this.active.element.playbackRate = intensity.playbackRate;
    }

    if (this.fadingOut !== null) {
      const fade = fadeProgress(now, this.fadingOut.startedAt, this.fadeSeconds);
      this.fadingOut.element.volume = this.fadingOut.fromVolume * (1 - fade);
      if (fade >= 1) {
        this.stopChannel(this.fadingOut);
        this.fadingOut = null;
      }
    }
  }

  stop(): void {
    this.stopChannel(this.active);
    this.stopChannel(this.fadingOut);
    this.active = null;
    this.fadingOut = null;
  }

  private stopChannel(channel: Channel | null): void {
    if (channel === null) return;
    channel.element.pause();
    channel.element.volume = 0;
  }

  private effectiveGain(
    audio: AudioSettings | undefined,
    intensity: MusicIntensity,
  ): number {
    const gains = resolveMixerGains(audio ?? SILENT_AUDIO);
    if (gains === null || isMixerSilent(gains) || gains.music === 0) return 0;
    return clamp01(gains.master * gains.music * this.baseGain * intensity.volumeScale);
  }
}

function regionMusicCueId(value: string): MusicCueId {
  if (value.startsWith("iron-borough")) return "iron-borough";
  if (value.startsWith("ember-steppe")) return "ember-steppe";
  if (value.startsWith("breakwater-isles")) return "breakwater-isles";
  if (value.startsWith("glass-ridge")) return "glass-ridge";
  if (value.startsWith("neon-meridian")) return "neon-meridian";
  if (value.startsWith("moss-frontier")) return "moss-frontier";
  if (value.startsWith("crown-circuit")) return "crown-circuit";
  return "velvet-coast";
}

function browserAudioElementFactory(src: string): MusicAudioElementLike | null {
  if (typeof Audio === "undefined") return null;
  return new Audio(src);
}

function defaultNowSeconds(): number {
  if (typeof performance === "undefined") return 0;
  return performance.now() / 1000;
}

function fadeProgress(now: number, start: number, duration: number): number {
  if (duration <= 0) return 1;
  return clampUnit((now - start) / duration);
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clampUnit(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
