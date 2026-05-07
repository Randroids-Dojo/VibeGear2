import { describe, expect, it, vi } from "vitest";

import {
  countdownFrequency,
  impactFrequency,
  ProceduralSfxRuntime,
  type SfxAudioContextLike,
  type SfxAudioParamLike,
} from "./sfx";

const AUDIO = { master: 1, music: 0.8, sfx: 0.9 };

describe("countdownFrequency", () => {
  it("uses a higher pitch for go than numbered countdown ticks", () => {
    expect(countdownFrequency(0)).toBeGreaterThan(countdownFrequency(1));
    expect(countdownFrequency(1)).toBeGreaterThan(countdownFrequency(3));
  });

  it("treats invalid and negative steps as the go pitch", () => {
    expect(countdownFrequency(Number.NaN)).toBe(880);
    expect(countdownFrequency(-1)).toBe(880);
  });
});

describe("impactFrequency", () => {
  it("maps harder impacts to higher pitch within the same hit kind", () => {
    expect(impactFrequency("carHit", 1)).toBeGreaterThan(
      impactFrequency("carHit", 0),
    );
  });

  it("clamps invalid impact speed factors", () => {
    expect(impactFrequency("wallHit", Number.NaN)).toBe(
      impactFrequency("wallHit", 0),
    );
    expect(impactFrequency("wallHit", 3)).toBe(impactFrequency("wallHit", 1));
  });
});

describe("ProceduralSfxRuntime", () => {
  it("does not create a graph when no context is available", () => {
    const runtime = new ProceduralSfxRuntime({ context: () => null });

    expect(runtime.playCountdownTick({ step: 3, audio: AUDIO })).toBe(false);
    expect(runtime.activeCount()).toBe(0);
  });

  it("does not create a graph when the SFX bus is silent", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({ context: () => context });

    expect(
      runtime.playCountdownTick({
        step: 3,
        audio: { master: 1, music: 1, sfx: 0 },
      }),
    ).toBe(false);

    expect(context.oscillators).toHaveLength(0);
  });

  it("plays a numbered countdown tick through the SFX bus", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
      durationSeconds: 0.1,
    });

    expect(runtime.playCountdownTick({ step: 2, audio: AUDIO })).toBe(true);

    expect(context.oscillators).toHaveLength(1);
    expect(context.gains).toHaveLength(1);
    expect(context.oscillators[0]?.type).toBe("triangle");
    expect(context.oscillators[0]?.frequency.value).toBe(
      countdownFrequency(2),
    );
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2,
      0.01,
    );
    expect(context.oscillators[0]?.start).toHaveBeenCalledWith(0);
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.1);
    expect(runtime.activeCount()).toBe(1);
  });

  it("uses the go tone for step zero", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({ context: () => context });

    runtime.playCountdownTick({ step: 0, audio: AUDIO });

    expect(context.oscillators[0]?.type).toBe("square");
    expect(context.oscillators[0]?.frequency.value).toBe(
      countdownFrequency(0),
    );
  });

  it("plays car impact tones through the SFX bus", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
      durationSeconds: 0.1,
    });

    expect(
      runtime.playImpact({
        hitKind: "carHit",
        speedFactor: 0.5,
        audio: AUDIO,
      }),
    ).toBe(true);

    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0]?.type).toBe("square");
    expect(context.oscillators[0]?.frequency.value).toBe(
      impactFrequency("carHit", 0.5),
    );
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.875,
      0.01,
    );
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.16);
  });

  it("uses a shorter low-gain scrape for rub impacts", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    runtime.playImpact({
      hitKind: "rub",
      speedFactor: 0,
      audio: AUDIO,
    });

    expect(context.oscillators[0]?.type).toBe("sawtooth");
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.35,
      0.01,
    );
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.08);
  });

  it("plays nitro engage as a short rising SFX cue", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(runtime.playNitroEngage({ audio: AUDIO })).toBe(true);

    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0]?.type).toBe("sawtooth");
    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      980,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1460, 0.18);
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.75,
      0.01,
    );
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.18);
  });

  it("plays distinct cash and nitro pickup collection cues", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(
      runtime.playPickupCollected({ pickupKind: "cash", audio: AUDIO }),
    ).toBe(true);
    expect(
      runtime.playPickupCollected({ pickupKind: "nitro", audio: AUDIO }),
    ).toBe(true);

    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[0]?.type).toBe("triangle");
    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      1180,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1580, 0.14);
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.54,
      0.01,
    );
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.14);
    expect(context.oscillators[1]?.type).toBe("sawtooth");
    expect(context.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      720,
      0,
    );
    expect(
      context.oscillators[1]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1120, 0.18);
    expect(context.gains[1]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.62,
      0.01,
    );
    expect(context.oscillators[1]?.stop).toHaveBeenCalledWith(0.18);
  });

  it("plays gear shifts with direction-specific pitch movement", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(
      runtime.playGearShift({ fromGear: 2, toGear: 3, audio: AUDIO }),
    ).toBe(true);
    expect(
      runtime.playGearShift({ fromGear: 4, toGear: 3, audio: AUDIO }),
    ).toBe(true);

    expect(context.oscillators[0]?.type).toBe("triangle");
    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      420,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(660, 0.09);
    expect(context.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      560,
      0,
    );
    expect(
      context.oscillators[1]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(320, 0.09);
  });

  it("plays lap and results stingers as longer rising cues", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(runtime.playLapComplete({ audio: AUDIO })).toBe(true);
    expect(runtime.playResultsStinger({ audio: AUDIO })).toBe(true);

    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      740,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1110, 0.24);
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.24);
    expect(context.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      0,
    );
    expect(
      context.oscillators[1]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1320, 0.34);
    expect(context.oscillators[1]?.stop).toHaveBeenCalledWith(0.34);
  });

  it("plays a distinct damage warning cue", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(runtime.playDamageWarning({ audio: AUDIO })).toBe(true);

    expect(context.oscillators[0]?.type).toBe("square");
    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      440,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(330, 0.28);
    expect(context.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1 * 0.9 * 0.2 * 0.72,
      0.01,
    );
    expect(context.oscillators[0]?.stop).toHaveBeenCalledWith(0.28);
  });

  it("plays surface cues with speed-scaled ramps", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({
      context: () => context,
      baseGain: 0.2,
    });

    expect(runtime.playBrakeScrub({ speedFactor: 0.5, audio: AUDIO })).toBe(
      true,
    );
    expect(runtime.playTireSqueal({ speedFactor: 0.5, audio: AUDIO })).toBe(
      true,
    );
    expect(
      runtime.playSurfaceHush({
        surface: "snow",
        speedFactor: 0.5,
        audio: AUDIO,
      }),
    ).toBe(true);

    expect(context.oscillators[0]?.type).toBe("sawtooth");
    expect(context.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      215,
      0,
    );
    expect(
      context.oscillators[0]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(165, 0.14);
    expect(context.oscillators[1]?.type).toBe("triangle");
    expect(context.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      1070,
      0,
    );
    expect(
      context.oscillators[1]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(1240, 0.16);
    expect(context.oscillators[2]?.frequency.setValueAtTime).toHaveBeenCalledWith(
      300,
      0,
    );
    expect(
      context.oscillators[2]?.frequency.linearRampToValueAtTime,
    ).toHaveBeenCalledWith(245, 0.24);
  });

  it("disconnects finished one-shots", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({ context: () => context });

    runtime.playCountdownTick({ step: 1, audio: AUDIO });
    context.oscillators[0]?.finish();

    expect(runtime.activeCount()).toBe(0);
    expect(context.oscillators[0]?.disconnected).toBe(true);
    expect(context.gains[0]?.disconnected).toBe(true);
  });

  it("stops all active one-shots", () => {
    const context = new FakeAudioContext();
    const runtime = new ProceduralSfxRuntime({ context: () => context });

    runtime.playCountdownTick({ step: 3, audio: AUDIO });
    runtime.playCountdownTick({ step: 2, audio: AUDIO });
    runtime.stopAll();

    expect(runtime.activeCount()).toBe(0);
    expect(context.oscillators[0]?.stop).toHaveBeenCalledTimes(1);
    expect(context.oscillators[1]?.stop).toHaveBeenCalledTimes(1);
    expect(context.gains[0]?.disconnected).toBe(true);
    expect(context.gains[1]?.disconnected).toBe(true);
  });

  describe("§18 sustained loops", () => {
    it("starts a single tire-squeal oscillator on the first update", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      expect(runtime.hasActiveLoop("tireSqueal")).toBe(false);
      runtime.updateTireSquealLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(true);
      expect(context.oscillators).toHaveLength(1);
      expect(context.oscillators[0]?.type).toBe("triangle");
      expect(context.oscillators[0]?.start).toHaveBeenCalledTimes(1);
    });

    it("does NOT spawn a second oscillator on subsequent updates", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      runtime.updateTireSquealLoop({
        intensity: 0.8,
        speedFactor: 0.7,
        audio: AUDIO,
      });
      runtime.updateTireSquealLoop({
        intensity: 1,
        speedFactor: 1,
        audio: AUDIO,
      });
      expect(context.oscillators).toHaveLength(1);
      // First call setParam-s the frequency at start; subsequent two
      // calls ramp toward new targets. Gain ramps on every call (the
      // start uses a 0->target ramp, not a setValueAtTime).
      expect(
        context.oscillators[0]?.frequency.linearRampToValueAtTime,
      ).toHaveBeenCalledTimes(2);
      expect(
        context.gains[0]?.gain.linearRampToValueAtTime,
      ).toHaveBeenCalledTimes(3);
    });

    it("ramps gain monotone-up as intensity climbs", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.2,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      const calls0 = (
        context.gains[0]?.gain.linearRampToValueAtTime as ReturnType<
          typeof vi.fn
        >
      ).mock.calls;
      const target0 = calls0[calls0.length - 1]![0] as number;

      runtime.updateTireSquealLoop({
        intensity: 0.8,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      const calls1 = (
        context.gains[0]?.gain.linearRampToValueAtTime as ReturnType<
          typeof vi.fn
        >
      ).mock.calls;
      const target1 = calls1[calls1.length - 1]![0] as number;

      expect(target1).toBeGreaterThan(target0);
    });

    it("ramps the loop out to 0 over 80 ms on stop", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.8,
        speedFactor: 0.6,
        audio: AUDIO,
      });
      runtime.stopTireSquealLoop();

      const calls = (
        context.gains[0]?.gain.linearRampToValueAtTime as ReturnType<
          typeof vi.fn
        >
      ).mock.calls;
      const last = calls[calls.length - 1]!;
      expect(last[0]).toBe(0);
      // Final ramp end-time equals currentTime + 0.08.
      expect(last[1]).toBeCloseTo(0.08, 6);
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(false);
    });

    it("treats intensity <= 0 as a stop", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(true);
      runtime.updateTireSquealLoop({
        intensity: 0,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(false);
    });

    it("brake-scrub loop runs independently from tire-squeal", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      runtime.updateBrakeScrubLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(true);
      expect(runtime.hasActiveLoop("brakeScrub")).toBe(true);
      expect(context.oscillators).toHaveLength(2);
      expect(context.oscillators[1]?.type).toBe("sawtooth");

      runtime.stopTireSquealLoop();
      expect(runtime.hasActiveLoop("tireSqueal")).toBe(false);
      expect(runtime.hasActiveLoop("brakeScrub")).toBe(true);
    });

    it("stopAll tears down both loops alongside one-shots", () => {
      const context = new FakeAudioContext();
      const runtime = new ProceduralSfxRuntime({ context: () => context });

      runtime.updateTireSquealLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      runtime.updateBrakeScrubLoop({
        intensity: 0.5,
        speedFactor: 0.5,
        audio: AUDIO,
      });
      runtime.stopAll();

      expect(runtime.hasActiveLoop("tireSqueal")).toBe(false);
      expect(runtime.hasActiveLoop("brakeScrub")).toBe(false);
    });
  });
});

class FakeAudioParam implements SfxAudioParamLike {
  value = 0;
  readonly setValueAtTime = vi.fn((value: number, _startTime: number) => {
    this.value = value;
  });
  readonly linearRampToValueAtTime = vi.fn(
    (value: number, _endTime: number) => {
      this.value = value;
    },
  );
}

class FakeOscillator {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();
  onended: (() => void) | null = null;
  disconnected = false;
  readonly start = vi.fn((_when?: number) => undefined);
  readonly stop = vi.fn((_when?: number) => undefined);

  connect(_destination: unknown): unknown {
    return undefined;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  finish(): void {
    this.onended?.();
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

class FakeAudioContext implements SfxAudioContextLike {
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
