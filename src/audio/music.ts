import type { AudioSettings, WeatherOption } from "@/data/schemas";

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

export type WeatherMusicStemId = "rain" | "heavy_rain" | "fog" | "snow";

export interface WeatherMusicStem {
  readonly id: WeatherMusicStemId;
  readonly src: string;
  readonly volumeScale: number;
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
  readonly weatherStemGain?: number;
  readonly fadeSeconds?: number;
}

interface Channel<Cue extends MusicCue | WeatherMusicStem> {
  readonly cue: Cue;
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
const DEFAULT_WEATHER_STEM_GAIN = 0.16;
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

export const WEATHER_MUSIC_STEMS: Readonly<
  Record<WeatherMusicStemId, WeatherMusicStem>
> = Object.freeze({
  rain: {
    id: "rain",
    src: "/audio/weather/rain-loop.opus",
    volumeScale: 0.86,
  },
  heavy_rain: {
    id: "heavy_rain",
    src: "/audio/weather/heavy-rain-loop.opus",
    volumeScale: 1,
  },
  fog: {
    id: "fog",
    src: "/audio/weather/fog-wind-loop.opus",
    volumeScale: 0.72,
  },
  snow: {
    id: "snow",
    src: "/audio/weather/snow-loop.opus",
    volumeScale: 0.78,
  },
});

export function titleMusicCue(): MusicCue {
  return MUSIC_CUES.title;
}

export function raceMusicCue(input: RaceMusicInput): MusicCue {
  const region = regionMusicCueId(input.tourId ?? input.trackId);
  return MUSIC_CUES[region];
}

export function weatherMusicStem(
  weather: WeatherOption | null | undefined,
): WeatherMusicStem | null {
  switch (weather) {
    case "light_rain":
    case "rain":
      return WEATHER_MUSIC_STEMS.rain;
    case "heavy_rain":
      return WEATHER_MUSIC_STEMS.heavy_rain;
    case "fog":
      return WEATHER_MUSIC_STEMS.fog;
    case "snow":
      return WEATHER_MUSIC_STEMS.snow;
    default:
      return null;
  }
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
  private active: Channel<MusicCue> | null = null;
  private fadingOut: Channel<MusicCue> | null = null;
  private activeWeatherStem: Channel<WeatherMusicStem> | null = null;
  private fadingWeatherStem: Channel<WeatherMusicStem> | null = null;
  private readonly createAudio: (src: string) => MusicAudioElementLike | null;
  private readonly nowSeconds: () => number;
  private readonly baseGain: number;
  private readonly weatherStemGain: number;
  private readonly fadeSeconds: number;

  constructor(options: MusicRuntimeOptions = {}) {
    this.createAudio = options.createAudio ?? browserAudioElementFactory;
    this.nowSeconds = options.nowSeconds ?? defaultNowSeconds;
    this.baseGain = nonNegativeOr(options.baseGain, DEFAULT_BASE_GAIN);
    this.weatherStemGain = nonNegativeOr(
      options.weatherStemGain,
      DEFAULT_WEATHER_STEM_GAIN,
    );
    this.fadeSeconds = nonNegativeOr(options.fadeSeconds, DEFAULT_FADE_SECONDS);
  }

  currentCueId(): MusicCueId | null {
    return this.active?.cue.id ?? null;
  }

  isPlaying(): boolean {
    return (
      this.active !== null ||
      this.fadingOut !== null ||
      this.activeWeatherStem !== null ||
      this.fadingWeatherStem !== null
    );
  }

  currentWeatherStemId(): WeatherMusicStemId | null {
    return this.activeWeatherStem?.cue.id ?? null;
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
      this.stopChannel(this.fadingOut);
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

  playWeatherStem(
    stem: WeatherMusicStem | null,
    audio: AudioSettings | undefined,
  ): boolean {
    const targetVolume = this.effectiveWeatherStemGain(audio, stem);
    if (stem === null || targetVolume === 0) {
      this.stopWeatherStem();
      return false;
    }

    if (this.activeWeatherStem?.cue.id === stem.id) {
      this.updateWeatherStem(stem, audio);
      return true;
    }

    const element = this.createAudio(stem.src);
    if (element === null) return false;

    const now = this.nowSeconds();
    if (this.activeWeatherStem !== null) {
      this.stopChannel(this.fadingWeatherStem);
      this.fadingWeatherStem = {
        ...this.activeWeatherStem,
        startedAt: now,
        fromVolume: this.activeWeatherStem.element.volume,
      };
    }

    element.src = stem.src;
    element.loop = true;
    element.preload = "auto";
    element.currentTime = 0;
    element.volume = 0;
    element.playbackRate = 1;
    this.activeWeatherStem = { cue: stem, element, startedAt: now, fromVolume: 0 };
    void Promise.resolve(element.play()).catch(() => {
      if (this.activeWeatherStem?.element === element) {
        this.activeWeatherStem = null;
      }
      this.stopChannel({ cue: stem, element, startedAt: now, fromVolume: 0 });
    });
    this.updateWeatherStem(stem, audio);
    return true;
  }

  updateWeatherStem(
    stem: WeatherMusicStem | null,
    audio: AudioSettings | undefined,
  ): void {
    const now = this.nowSeconds();
    const targetVolume = this.effectiveWeatherStemGain(audio, stem);

    if (stem === null || targetVolume === 0) {
      this.stopWeatherStem();
      return;
    }

    if (this.activeWeatherStem === null || this.activeWeatherStem.cue.id !== stem.id) {
      this.playWeatherStem(stem, audio);
      return;
    }

    const fade = fadeProgress(
      now,
      this.activeWeatherStem.startedAt,
      this.fadeSeconds,
    );
    this.activeWeatherStem.element.volume = targetVolume * fade;
    this.activeWeatherStem.element.playbackRate = 1;

    if (this.fadingWeatherStem !== null) {
      const fadeOut = fadeProgress(
        now,
        this.fadingWeatherStem.startedAt,
        this.fadeSeconds,
      );
      this.fadingWeatherStem.element.volume =
        this.fadingWeatherStem.fromVolume * (1 - fadeOut);
      if (fadeOut >= 1) {
        this.stopChannel(this.fadingWeatherStem);
        this.fadingWeatherStem = null;
      }
    }
  }

  stop(): void {
    this.stopChannel(this.active);
    this.stopChannel(this.fadingOut);
    this.stopChannel(this.activeWeatherStem);
    this.stopChannel(this.fadingWeatherStem);
    this.active = null;
    this.fadingOut = null;
    this.activeWeatherStem = null;
    this.fadingWeatherStem = null;
  }

  stopWeatherStem(): void {
    this.stopChannel(this.activeWeatherStem);
    this.stopChannel(this.fadingWeatherStem);
    this.activeWeatherStem = null;
    this.fadingWeatherStem = null;
  }

  private stopChannel<Cue extends MusicCue | WeatherMusicStem>(
    channel: Channel<Cue> | null,
  ): void {
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

  private effectiveWeatherStemGain(
    audio: AudioSettings | undefined,
    stem: WeatherMusicStem | null,
  ): number {
    if (stem === null) return 0;
    const gains = resolveMixerGains(audio ?? SILENT_AUDIO);
    if (gains === null || isMixerSilent(gains) || gains.music === 0) return 0;
    return clamp01(
      gains.master * gains.music * this.weatherStemGain * stem.volumeScale,
    );
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
