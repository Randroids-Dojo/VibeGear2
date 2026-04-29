import { describe, expect, it, vi } from "vitest";

import { enginePitchHz } from "./engine";
import {
  ProceduralEngineRuntime,
  type EngineAudioContextLike,
  type EngineAudioParamLike,
} from "./engineRuntime";

const AUDIO = { master: 1, music: 0.8, sfx: 0.9 };

describe("ProceduralEngineRuntime", () => {
  it("does not create a graph when no context is available", () => {
    const runtime = new ProceduralEngineRuntime({ context: () => null });

    expect(runtime.start({ speed: 10, topSpeed: 60, audio: AUDIO })).toBe(false);
    expect(runtime.isRunning()).toBe(false);
  });

  it("does not create a graph when the SFX bus is silent", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralEngineRuntime({ context: () => context });

    expect(
      runtime.start({
        speed: 10,
        topSpeed: 60,
        audio: { master: 1, music: 1, sfx: 0 },
      }),
    ).toBe(false);

    expect(context.oscillators).toHaveLength(0);
  });

  it("starts an oscillator at the current engine pitch and mixer gain", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralEngineRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(runtime.start({ speed: 30, topSpeed: 60, audio: AUDIO })).toBe(true);

    expect(context.oscillators).toHaveLength(1);
    expect(context.gains).toHaveLength(1);
    expect(context.oscillators[0]?.type).toBe("sawtooth");
    expect(context.oscillators[0]?.started).toBe(true);
    expect(context.oscillators[0]?.frequency.value).toBeCloseTo(
      enginePitchHz({ speed: 30, topSpeed: 60 }),
    );
    expect(context.gains[0]?.gain.value).toBeCloseTo(1 * 0.9 * 0.2);
  });

  it("updates pitch and gain without recreating the oscillator", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralEngineRuntime({
      context: () => context,
      baseGain: 0.2,
      smoothingSeconds: 0.05,
    });

    runtime.start({ speed: 10, topSpeed: 60, audio: AUDIO });
    runtime.update({
      speed: 55,
      topSpeed: 60,
      audio: { master: 0.5, music: 0.8, sfx: 0.5 },
    });

    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0]?.frequency.value).toBeCloseTo(
      enginePitchHz({ speed: 55, topSpeed: 60 }),
    );
    expect(context.oscillators[0]?.frequency.setTargetAtTime).toHaveBeenCalledWith(
      enginePitchHz({ speed: 55, topSpeed: 60 }),
      0,
      0.05,
    );
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.5 * 0.5 * 0.2);
  });

  it("stops and disconnects the graph", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralEngineRuntime({ context: () => context });

    runtime.start({ speed: 10, topSpeed: 60, audio: AUDIO });
    runtime.stop();

    expect(runtime.isRunning()).toBe(false);
    expect(context.oscillators[0]?.stopped).toBe(true);
    expect(context.oscillators[0]?.disconnected).toBe(true);
    expect(context.gains[0]?.disconnected).toBe(true);
    expect(context.gains[0]?.gain.value).toBe(0);
  });
});

class FakeAudioParam implements EngineAudioParamLike {
  value = 0;
  readonly setTargetAtTime = vi.fn(
    (value: number, _startTime: number, _timeConstant: number) => {
      this.value = value;
    },
  );
  readonly setValueAtTime = vi.fn((value: number, _startTime: number) => {
    this.value = value;
  });
}

class FakeOscillator {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();
  started = false;
  stopped = false;
  disconnected = false;

  connect(_destination: unknown): unknown {
    return undefined;
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  disconnected = false;

  connect(_destination: unknown): unknown {
    return undefined;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeAudioContext implements EngineAudioContextLike {
  readonly currentTime = 0;
  readonly destination = {};
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
}
