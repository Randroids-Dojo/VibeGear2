import type { AudioSettings } from "@/data/schemas";

import { enginePitchHz } from "./engine";
import { isMixerSilent, resolveMixerGains } from "./mixer";

export interface EngineAudioParamLike {
  value: number;
  setTargetAtTime?(value: number, startTime: number, timeConstant: number): void;
  setValueAtTime?(value: number, startTime: number): void;
}

export interface EngineOscillatorLike {
  type: OscillatorType;
  frequency: EngineAudioParamLike;
  connect(destination: unknown): unknown;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface EngineGainLike {
  gain: EngineAudioParamLike;
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface EngineAudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createOscillator(): EngineOscillatorLike;
  createGain(): EngineGainLike;
}

export interface EngineRuntimeInput {
  readonly speed: number;
  readonly topSpeed: number;
  readonly audio: AudioSettings | undefined;
}

export interface ProceduralEngineRuntimeOptions {
  readonly context: () => EngineAudioContextLike | null;
  readonly baseGain?: number;
  readonly smoothingSeconds?: number;
}

interface EngineGraph {
  readonly context: EngineAudioContextLike;
  readonly oscillator: EngineOscillatorLike;
  readonly output: EngineGainLike;
}

const DEFAULT_BASE_GAIN = 0.18;
const DEFAULT_SMOOTHING_SECONDS = 0.035;
const SILENT_AUDIO: AudioSettings = Object.freeze({
  master: 0,
  music: 0,
  sfx: 0,
});

export class ProceduralEngineRuntime {
  private graph: EngineGraph | null = null;
  private latestInput: EngineRuntimeInput | null = null;
  private readonly baseGain: number;
  private readonly smoothingSeconds: number;

  constructor(private readonly options: ProceduralEngineRuntimeOptions) {
    this.baseGain = nonNegativeOr(options.baseGain, DEFAULT_BASE_GAIN);
    this.smoothingSeconds = nonNegativeOr(
      options.smoothingSeconds,
      DEFAULT_SMOOTHING_SECONDS,
    );
  }

  isRunning(): boolean {
    return this.graph !== null;
  }

  start(input: EngineRuntimeInput): boolean {
    this.latestInput = input;
    if (this.graph !== null) {
      this.update(input);
      return true;
    }

    const gains = resolveMixerGains(input.audio ?? SILENT_AUDIO);
    if (isMixerSilent(gains) || gains?.sfx === 0) return false;

    const context = this.options.context();
    if (context === null) return false;

    const output = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    setParam(
      oscillator.frequency,
      enginePitchHz({ speed: input.speed, topSpeed: input.topSpeed }),
      context.currentTime,
      0,
    );
    setParam(
      output.gain,
      this.effectiveGain(input.audio),
      context.currentTime,
      0,
    );
    oscillator.connect(output);
    output.connect(context.destination);
    oscillator.start();
    this.graph = { context, oscillator, output };
    return true;
  }

  update(input: EngineRuntimeInput): void {
    this.latestInput = input;
    const graph = this.graph;
    if (graph === null) return;

    setParam(
      graph.oscillator.frequency,
      enginePitchHz({ speed: input.speed, topSpeed: input.topSpeed }),
      graph.context.currentTime,
      this.smoothingSeconds,
    );
    setParam(
      graph.output.gain,
      this.effectiveGain(input.audio),
      graph.context.currentTime,
      this.smoothingSeconds,
    );
  }

  stop(): void {
    const graph = this.graph;
    if (graph === null) return;
    setParam(graph.output.gain, 0, graph.context.currentTime, 0);
    graph.oscillator.stop();
    graph.oscillator.disconnect();
    graph.output.disconnect();
    this.graph = null;
  }

  restartLatest(): boolean {
    if (this.latestInput === null) return false;
    this.stop();
    return this.start(this.latestInput);
  }

  private effectiveGain(audio: AudioSettings | undefined): number {
    const gains = resolveMixerGains(audio ?? SILENT_AUDIO);
    if (gains === null || isMixerSilent(gains) || gains.sfx === 0) return 0;
    return gains.master * gains.sfx * this.baseGain;
  }
}

function setParam(
  param: EngineAudioParamLike,
  value: number,
  time: number,
  smoothingSeconds: number,
): void {
  if (smoothingSeconds > 0 && param.setTargetAtTime) {
    param.setTargetAtTime(value, time, smoothingSeconds);
    return;
  }
  if (param.setValueAtTime) {
    param.setValueAtTime(value, time);
    return;
  }
  param.value = value;
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}
