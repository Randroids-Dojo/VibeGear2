import type { AudioSettings } from "@/data/schemas";

import { isMixerSilent, resolveMixerGains } from "./mixer";

export interface SfxAudioParamLike {
  value: number;
  setValueAtTime?(value: number, startTime: number): void;
  linearRampToValueAtTime?(value: number, endTime: number): void;
}

export interface SfxOscillatorLike {
  type: OscillatorType;
  frequency: SfxAudioParamLike;
  onended: (() => void) | null;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
  disconnect(): void;
}

export interface SfxGainLike {
  gain: SfxAudioParamLike;
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface SfxAudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createOscillator(): SfxOscillatorLike;
  createGain(): SfxGainLike;
}

export interface CountdownSfxInput {
  readonly step: number;
  readonly audio: AudioSettings | undefined;
}

export type ImpactSfxKind =
  | "rub"
  | "carHit"
  | "wallHit"
  | "offRoadObject"
  | "offRoadPersistent";

export interface ImpactSfxInput {
  readonly hitKind: ImpactSfxKind;
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

export interface NitroEngageSfxInput {
  readonly audio: AudioSettings | undefined;
}

export interface PickupCollectedSfxInput {
  readonly pickupKind: "cash" | "nitro";
  readonly audio: AudioSettings | undefined;
}

export interface GearShiftSfxInput {
  readonly fromGear: number;
  readonly toGear: number;
  readonly audio: AudioSettings | undefined;
}

export interface LapCompleteSfxInput {
  readonly audio: AudioSettings | undefined;
}

export interface ResultsStingerSfxInput {
  readonly audio: AudioSettings | undefined;
}

export interface DamageWarningSfxInput {
  readonly audio: AudioSettings | undefined;
}

export interface BrakeScrubSfxInput {
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

export interface TireSquealSfxInput {
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

export interface SurfaceHushSfxInput {
  readonly surface: "wet" | "snow";
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

export interface FuelDepletedSfxInput {
  readonly audio: AudioSettings | undefined;
}

export interface ProceduralSfxRuntimeOptions {
  readonly context: () => SfxAudioContextLike | null;
  readonly baseGain?: number;
  readonly durationSeconds?: number;
}

interface OneShotGraph {
  readonly oscillator: SfxOscillatorLike;
  readonly output: SfxGainLike;
}

interface LoopGraph {
  readonly oscillator: SfxOscillatorLike;
  readonly output: SfxGainLike;
}

export interface TireSquealLoopUpdate {
  readonly intensity: number;
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

export interface BrakeScrubLoopUpdate {
  readonly intensity: number;
  readonly speedFactor: number;
  readonly audio: AudioSettings | undefined;
}

const LOOP_RAMP_OUT_SECONDS = 0.08;
const LOOP_RAMP_PARAM_SECONDS = 0.05;

const DEFAULT_BASE_GAIN = 0.22;
const DEFAULT_DURATION_SECONDS = 0.12;
const SILENT_AUDIO: AudioSettings = Object.freeze({
  master: 0,
  music: 0,
  sfx: 0,
});

export class ProceduralSfxRuntime {
  private readonly active = new Set<OneShotGraph>();
  private readonly baseGain: number;
  private readonly durationSeconds: number;
  private tireSquealLoop: LoopGraph | null = null;
  private brakeScrubLoop: LoopGraph | null = null;

  constructor(private readonly options: ProceduralSfxRuntimeOptions) {
    this.baseGain = nonNegativeOr(options.baseGain, DEFAULT_BASE_GAIN);
    this.durationSeconds = nonNegativeOr(
      options.durationSeconds,
      DEFAULT_DURATION_SECONDS,
    );
  }

  activeCount(): number {
    return this.active.size;
  }

  playCountdownTick(input: CountdownSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: countdownFrequency(input.step),
      oscillatorType: input.step <= 0 ? "square" : "triangle",
      gainScale: 1,
      durationSeconds: this.durationSeconds,
    });
  }

  playImpact(input: ImpactSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: impactFrequency(input.hitKind, input.speedFactor),
      oscillatorType: impactOscillatorType(input.hitKind),
      gainScale: impactGainScale(input.hitKind, input.speedFactor),
      durationSeconds: impactDurationSeconds(input.hitKind),
    });
  }

  playNitroEngage(input: NitroEngageSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: 980,
      oscillatorType: "sawtooth",
      gainScale: 0.75,
      durationSeconds: 0.18,
      endFrequency: 1460,
    });
  }

  playFuelDepleted(input: FuelDepletedSfxInput): boolean {
    // Engine-sputter cue: low sawtooth that drops in pitch over
    // ~360 ms. Sits below the pickup / nitro band so it reads as
    // an engine misfire rather than a UI bleep.
    return this.playTone({
      audio: input.audio,
      frequency: 220,
      oscillatorType: "sawtooth",
      gainScale: 0.6,
      durationSeconds: 0.36,
      endFrequency: 90,
    });
  }

  playPickupCollected(input: PickupCollectedSfxInput): boolean {
    const nitro = input.pickupKind === "nitro";
    return this.playTone({
      audio: input.audio,
      frequency: nitro ? 720 : 1180,
      oscillatorType: nitro ? "sawtooth" : "triangle",
      gainScale: nitro ? 0.62 : 0.54,
      durationSeconds: nitro ? 0.18 : 0.14,
      endFrequency: nitro ? 1120 : 1580,
    });
  }

  playGearShift(input: GearShiftSfxInput): boolean {
    const shiftingUp = input.toGear >= input.fromGear;
    return this.playTone({
      audio: input.audio,
      frequency: shiftingUp ? 420 : 560,
      oscillatorType: "triangle",
      gainScale: 0.45,
      durationSeconds: 0.09,
      endFrequency: shiftingUp ? 660 : 320,
    });
  }

  playLapComplete(input: LapCompleteSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: 740,
      oscillatorType: "square",
      gainScale: 0.7,
      durationSeconds: 0.24,
      endFrequency: 1110,
    });
  }

  playResultsStinger(input: ResultsStingerSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: 880,
      oscillatorType: "square",
      gainScale: 0.8,
      durationSeconds: 0.34,
      endFrequency: 1320,
    });
  }

  playDamageWarning(input: DamageWarningSfxInput): boolean {
    return this.playTone({
      audio: input.audio,
      frequency: 440,
      oscillatorType: "square",
      gainScale: 0.72,
      durationSeconds: 0.28,
      endFrequency: 330,
    });
  }

  playBrakeScrub(input: BrakeScrubSfxInput): boolean {
    const speed = clampUnit(input.speedFactor);
    return this.playTone({
      audio: input.audio,
      frequency: Math.round(170 + speed * 90),
      oscillatorType: "sawtooth",
      gainScale: 0.35 + speed * 0.25,
      durationSeconds: 0.14,
      endFrequency: Math.round(130 + speed * 70),
    });
  }

  playTireSqueal(input: TireSquealSfxInput): boolean {
    const speed = clampUnit(input.speedFactor);
    return this.playTone({
      audio: input.audio,
      frequency: Math.round(860 + speed * 420),
      oscillatorType: "triangle",
      gainScale: 0.4 + speed * 0.3,
      durationSeconds: 0.16,
      endFrequency: Math.round(980 + speed * 520),
    });
  }

  playSurfaceHush(input: SurfaceHushSfxInput): boolean {
    const speed = clampUnit(input.speedFactor);
    const snow = input.surface === "snow";
    return this.playTone({
      audio: input.audio,
      frequency: Math.round((snow ? 260 : 360) + speed * (snow ? 80 : 140)),
      oscillatorType: "sawtooth",
      gainScale: 0.28 + speed * 0.22,
      durationSeconds: snow ? 0.24 : 0.18,
      endFrequency: Math.round((snow ? 210 : 290) + speed * (snow ? 70 : 110)),
    });
  }

  /**
   * §18 sustained tire-squeal loop. Starts a single continuous
   * oscillator on the first call when intensity > 0; subsequent calls
   * update gain + frequency in place. Returns true when the loop is
   * playing audibly after the call.
   */
  updateTireSquealLoop(input: TireSquealLoopUpdate): boolean {
    return this.updateLoop("tireSqueal", input);
  }

  /** §18 sustained brake-scrub loop. Same lifecycle as tire-squeal. */
  updateBrakeScrubLoop(input: BrakeScrubLoopUpdate): boolean {
    return this.updateLoop("brakeScrub", input);
  }

  /** Ramp the active tire-squeal loop out over 80 ms and stop. */
  stopTireSquealLoop(): void {
    this.stopLoop("tireSqueal");
  }

  /** Ramp the active brake-scrub loop out over 80 ms and stop. */
  stopBrakeScrubLoop(): void {
    this.stopLoop("brakeScrub");
  }

  /** Whether a sustained loop is currently audible. Test-only hook. */
  hasActiveLoop(kind: "tireSqueal" | "brakeScrub"): boolean {
    return kind === "tireSqueal"
      ? this.tireSquealLoop !== null
      : this.brakeScrubLoop !== null;
  }

  stopAll(): void {
    this.stopTireSquealLoop();
    this.stopBrakeScrubLoop();
    for (const graph of Array.from(this.active)) {
      this.disconnect(graph);
    }
  }

  private updateLoop(
    kind: "tireSqueal" | "brakeScrub",
    input: TireSquealLoopUpdate | BrakeScrubLoopUpdate,
  ): boolean {
    const baseGain = this.effectiveGain(input.audio);
    const intensity = clampUnit(input.intensity);
    if (intensity <= 0) {
      this.stopLoop(kind);
      return false;
    }
    if (baseGain === 0) {
      this.stopLoop(kind);
      return false;
    }
    const context = this.options.context();
    if (context === null) return false;

    const speed = clampUnit(input.speedFactor);
    const frequency =
      kind === "tireSqueal"
        ? Math.round(860 + speed * 560)
        : Math.round(150 + speed * 150);
    const gainScale =
      kind === "tireSqueal"
        ? 0.4 + intensity * 0.45
        : 0.32 + intensity * 0.4;
    const targetGain = baseGain * gainScale;
    const now = context.currentTime;

    let graph =
      kind === "tireSqueal" ? this.tireSquealLoop : this.brakeScrubLoop;
    if (graph === null) {
      const oscillator = context.createOscillator();
      const output = context.createGain();
      oscillator.type = kind === "tireSqueal" ? "triangle" : "sawtooth";
      setParam(oscillator.frequency, frequency, now);
      setParam(output.gain, 0, now);
      rampParam(output.gain, targetGain, now + LOOP_RAMP_PARAM_SECONDS);
      oscillator.connect(output);
      output.connect(context.destination);
      oscillator.start(now);
      graph = { oscillator, output };
      if (kind === "tireSqueal") this.tireSquealLoop = graph;
      else this.brakeScrubLoop = graph;
      return true;
    }
    rampParam(
      graph.oscillator.frequency,
      frequency,
      now + LOOP_RAMP_PARAM_SECONDS,
    );
    rampParam(graph.output.gain, targetGain, now + LOOP_RAMP_PARAM_SECONDS);
    return true;
  }

  private stopLoop(kind: "tireSqueal" | "brakeScrub"): void {
    const graph =
      kind === "tireSqueal" ? this.tireSquealLoop : this.brakeScrubLoop;
    if (graph === null) return;
    if (kind === "tireSqueal") this.tireSquealLoop = null;
    else this.brakeScrubLoop = null;
    const context = this.options.context();
    const now = context !== null ? context.currentTime : 0;
    rampParam(graph.output.gain, 0, now + LOOP_RAMP_OUT_SECONDS);
    try {
      graph.oscillator.stop(now + LOOP_RAMP_OUT_SECONDS);
    } catch {
      // Some test mocks throw on `stop()` after `start()` was never
      // called; swallow because the gain ramp + disconnect below still
      // leaves the graph silent.
    }
    graph.oscillator.onended = () => {
      graph.oscillator.disconnect();
      graph.output.disconnect();
    };
  }

  private playTone(input: {
    readonly audio: AudioSettings | undefined;
    readonly frequency: number;
    readonly oscillatorType: OscillatorType;
    readonly gainScale: number;
    readonly durationSeconds: number;
    readonly endFrequency?: number;
  }): boolean {
    const gain = this.effectiveGain(input.audio);
    if (gain === 0) return false;

    const context = this.options.context();
    if (context === null) return false;

    const output = context.createGain();
    const oscillator = context.createOscillator();
    const startTime = context.currentTime;
    const stopTime = startTime + input.durationSeconds;
    const graph: OneShotGraph = { oscillator, output };

    oscillator.type = input.oscillatorType;
    setParam(oscillator.frequency, input.frequency, startTime);
    if (input.endFrequency !== undefined) {
      rampParam(oscillator.frequency, input.endFrequency, stopTime);
    }
    setParam(output.gain, 0, startTime);
    rampParam(output.gain, gain * input.gainScale, startTime + 0.01);
    rampParam(output.gain, 0, stopTime);
    oscillator.connect(output);
    output.connect(context.destination);
    oscillator.onended = () => {
      this.disconnect(graph);
    };
    this.active.add(graph);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
    return true;
  }

  private disconnect(graph: OneShotGraph): void {
    if (!this.active.delete(graph)) return;
    graph.oscillator.onended = null;
    graph.oscillator.disconnect();
    graph.output.disconnect();
  }

  private effectiveGain(audio: AudioSettings | undefined): number {
    const gains = resolveMixerGains(audio ?? SILENT_AUDIO);
    if (gains === null || isMixerSilent(gains) || gains.sfx === 0) return 0;
    return gains.master * gains.sfx * this.baseGain;
  }
}

export function countdownFrequency(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 880;
  return step === 1 ? 660 : 520;
}

export function impactFrequency(
  hitKind: ImpactSfxKind,
  speedFactor: number,
): number {
  const speed = clampUnit(speedFactor);
  const base =
    hitKind === "rub" || hitKind === "offRoadPersistent"
      ? 180
      : hitKind === "carHit"
        ? 250
        : 120;
  const range =
    hitKind === "rub" || hitKind === "offRoadPersistent"
      ? 90
      : hitKind === "carHit"
        ? 150
        : 80;
  return Math.round(base + range * speed);
}

function impactOscillatorType(hitKind: ImpactSfxKind): OscillatorType {
  return hitKind === "rub" || hitKind === "offRoadPersistent"
    ? "sawtooth"
    : "square";
}

function impactGainScale(hitKind: ImpactSfxKind, speedFactor: number): number {
  const speed = clampUnit(speedFactor);
  const base =
    hitKind === "rub" || hitKind === "offRoadPersistent" ? 0.35 : 0.6;
  return base + speed * 0.55;
}

function impactDurationSeconds(hitKind: ImpactSfxKind): number {
  return hitKind === "rub" || hitKind === "offRoadPersistent" ? 0.08 : 0.16;
}

function setParam(
  param: SfxAudioParamLike,
  value: number,
  time: number,
): void {
  if (param.setValueAtTime) {
    param.setValueAtTime(value, time);
    return;
  }
  param.value = value;
}

function rampParam(
  param: SfxAudioParamLike,
  value: number,
  time: number,
): void {
  if (param.linearRampToValueAtTime) {
    param.linearRampToValueAtTime(value, time);
    return;
  }
  setParam(param, value, time);
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
