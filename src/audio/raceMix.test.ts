import { describe, expect, it } from "vitest";

import {
  NO_RACE_MUSIC_DUCKING,
  applyRaceMusicDucking,
  raceMusicDuckingForAudioEvents,
  raceMusicDuckingForCountdownStep,
} from "./raceMix";

describe("race music ducking", () => {
  it("keeps normal mix when there are no race SFX events", () => {
    expect(raceMusicDuckingForAudioEvents([])).toEqual(NO_RACE_MUSIC_DUCKING);
  });

  it("ducks deepest for high-priority race moments", () => {
    expect(
      raceMusicDuckingForAudioEvents([
        { kind: "gearShift", carId: "player", fromGear: 1, toGear: 2 },
        { kind: "nitroEngage", carId: "player" },
        { kind: "raceFinish", carId: "player" },
      ]),
    ).toEqual({ volumeScale: 0.5, holdMs: 900 });
  });

  it("keeps collisions, warning, and weather cues above the engine", () => {
    expect(
      raceMusicDuckingForAudioEvents([
        {
          kind: "impact",
          carId: "player",
          hitKind: "wallHit",
          speedFactor: 1,
        },
      ]),
    ).toEqual({ volumeScale: 0.48, holdMs: 360 });
    expect(
      raceMusicDuckingForAudioEvents([
        { kind: "damageWarning", carId: "player", damagePercent: 76 },
      ]),
    ).toEqual({ volumeScale: 0.52, holdMs: 720 });
    expect(
      raceMusicDuckingForAudioEvents([
        {
          kind: "surfaceHush",
          carId: "player",
          surface: "wet",
          speedFactor: 0.7,
        },
      ]),
    ).toEqual({ volumeScale: 0.78, holdMs: 260 });
  });

  it("ducks countdown and go cues without muting the music", () => {
    expect(raceMusicDuckingForCountdownStep(3)).toEqual({
      volumeScale: 0.82,
      holdMs: 220,
    });
    expect(raceMusicDuckingForCountdownStep(0)).toEqual({
      volumeScale: 0.72,
      holdMs: 360,
    });
  });

  it("applies ducking with defensive clamping", () => {
    expect(applyRaceMusicDucking(1, { volumeScale: 0.5, holdMs: 100 })).toBe(0.5);
    expect(applyRaceMusicDucking(2, NO_RACE_MUSIC_DUCKING)).toBe(1.2);
    expect(
      applyRaceMusicDucking(Number.NaN, NO_RACE_MUSIC_DUCKING),
    ).toBe(0);
  });
});
