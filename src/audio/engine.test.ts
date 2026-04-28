import { describe, expect, it } from "vitest";

import { DEFAULT_ENGINE_PITCH, enginePitchHz, engineSpeedRatio } from "./engine";

describe("enginePitchHz", () => {
  it("maps zero speed to idle pitch", () => {
    expect(enginePitchHz({ speed: 0, topSpeed: 60 })).toBe(
      DEFAULT_ENGINE_PITCH.idleHz,
    );
  });

  it("is monotonic from rest to top speed", () => {
    let previous = enginePitchHz({ speed: 0, topSpeed: 60 });
    for (let i = 1; i <= 100; i += 1) {
      const speed = (60 * i) / 100;
      const pitch = enginePitchHz({ speed, topSpeed: 60 });
      expect(pitch).toBeGreaterThanOrEqual(previous);
      previous = pitch;
    }
  });

  it("caps overrun speed at redline", () => {
    expect(enginePitchHz({ speed: 600, topSpeed: 60 })).toBeLessThanOrEqual(
      DEFAULT_ENGINE_PITCH.redlineHz,
    );
  });

  it("is pure for the same input", () => {
    const input = { speed: 31.5, topSpeed: 61 };
    expect(enginePitchHz(input)).toBe(enginePitchHz(input));
    expect(engineSpeedRatio(input)).toBe(engineSpeedRatio(input));
  });

  it("handles invalid speed and top speed defensively", () => {
    expect(enginePitchHz({ speed: Number.NaN, topSpeed: 60 })).toBe(
      DEFAULT_ENGINE_PITCH.idleHz,
    );
    expect(enginePitchHz({ speed: 20, topSpeed: 0 })).toBe(
      DEFAULT_ENGINE_PITCH.idleHz,
    );
    expect(engineSpeedRatio({ speed: 20, topSpeed: 0 })).toBe(0);
  });
});
