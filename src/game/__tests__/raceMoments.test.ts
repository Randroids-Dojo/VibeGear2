import { describe, expect, it } from "vitest";

import { deriveRaceStoryMoment } from "@/game/raceMoments";
import type { RankedCar } from "@/game/hudState";

const PLAYER = "player";

function car(id: string, totalProgress: number): RankedCar {
  return { id, totalProgress };
}

describe("deriveRaceStoryMoment", () => {
  it("announces a clean pass when the player gains position", () => {
    const previousCars = [car("ai-a", 120), car(PLAYER, 100), car("ai-b", 80)];
    const currentCars = [car(PLAYER, 130), car("ai-a", 128), car("ai-b", 80)];

    expect(
      deriveRaceStoryMoment({
        playerId: PLAYER,
        previousCars,
        currentCars,
        threatDistanceMeters: 45,
      }),
    ).toEqual({
      kind: "clean-pass",
      title: "Pass",
      detail: "P1",
    });
  });

  it("announces a lost position when the player drops back", () => {
    const previousCars = [car(PLAYER, 150), car("ai-a", 140), car("ai-b", 80)];
    const currentCars = [car("ai-a", 170), car(PLAYER, 160), car("ai-b", 80)];

    expect(
      deriveRaceStoryMoment({
        playerId: PLAYER,
        previousCars,
        currentCars,
        threatDistanceMeters: 45,
      }),
    ).toEqual({
      kind: "lost-position",
      title: "Position lost",
      detail: "P2",
    });
  });

  it("announces rival pressure when a trailing opponent is close", () => {
    expect(
      deriveRaceStoryMoment({
        playerId: PLAYER,
        previousCars: [car(PLAYER, 200), car("ai-a", 160)],
        currentCars: [car(PLAYER, 220), car("ai-a", 199.6), car("ai-b", 40)],
        threatDistanceMeters: 25,
      }),
    ).toEqual({
      kind: "rival-pressure",
      title: "Rival close",
      detail: "20 m back",
    });
  });

  it("does not treat equal start-line progress as pressure", () => {
    expect(
      deriveRaceStoryMoment({
        playerId: PLAYER,
        previousCars: null,
        currentCars: [car(PLAYER, 0), car("ai-a", 0)],
        threatDistanceMeters: 25,
      }),
    ).toBeNull();
  });

  it("ignores distant trailing opponents", () => {
    expect(
      deriveRaceStoryMoment({
        playerId: PLAYER,
        previousCars: [car(PLAYER, 200), car("ai-a", 100)],
        currentCars: [car(PLAYER, 230), car("ai-a", 175)],
        threatDistanceMeters: 25,
      }),
    ).toBeNull();
  });
});
