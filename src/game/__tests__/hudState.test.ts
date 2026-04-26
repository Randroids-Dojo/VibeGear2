/**
 * Unit tests for the HUD state derivation.
 *
 * Covers the dot's listed edge cases:
 * - Lap 0 (pre-countdown): show "1 / N" placeholder, not "0".
 * - Position when no opponents: "1 / 1".
 * - Speed when reversing: show absolute value (no negative number).
 *
 * Plus: position ordering by total progress, deterministic tie break,
 * unit conversion correctness, lap clamp at totalLaps, and purity.
 */

import { describe, expect, it } from "vitest";

import {
  deriveHudState,
  rankPosition,
  speedToDisplayUnit,
  type HudStateInput,
  type RankedCar,
} from "@/game/hudState";

const PLAYER = "player";

function input(overrides: Partial<HudStateInput> = {}): HudStateInput {
  return {
    race: { lap: 1, totalLaps: 3, phase: "racing" },
    playerSpeedMetersPerSecond: 0,
    playerId: PLAYER,
    cars: [{ id: PLAYER, totalProgress: 0 }],
    speedUnit: "kph",
    ...overrides,
  };
}

describe("speedToDisplayUnit", () => {
  it("converts m/s to km/h with the 3.6 factor", () => {
    expect(speedToDisplayUnit(10, "kph")).toBe(36);
    expect(speedToDisplayUnit(50, "kph")).toBe(180);
  });

  it("converts m/s to mph", () => {
    // 10 m/s = 22.369 mph -> 22 after rounding
    expect(speedToDisplayUnit(10, "mph")).toBe(22);
    // 50 m/s = 111.847 mph -> 112
    expect(speedToDisplayUnit(50, "mph")).toBe(112);
  });

  it("returns the absolute value when speed is negative", () => {
    // Reverse is not in the MVP physics layer but the HUD must defend
    // against a future reverse slice producing negative speed.
    expect(speedToDisplayUnit(-10, "kph")).toBe(36);
    expect(speedToDisplayUnit(-25, "mph")).toBe(56);
  });

  it("collapses non-finite values to zero", () => {
    expect(speedToDisplayUnit(Number.NaN, "kph")).toBe(0);
    expect(speedToDisplayUnit(Number.POSITIVE_INFINITY, "kph")).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    // 1.4 m/s = 5.04 kph -> 5
    expect(speedToDisplayUnit(1.4, "kph")).toBe(5);
    // 1.5 m/s = 5.4 kph -> 5
    expect(speedToDisplayUnit(1.5, "kph")).toBe(5);
    // 1.6 m/s = 5.76 kph -> 6
    expect(speedToDisplayUnit(1.6, "kph")).toBe(6);
  });
});

describe("rankPosition", () => {
  it("returns 1 when only the player is in the field", () => {
    expect(rankPosition(PLAYER, [{ id: PLAYER, totalProgress: 0 }])).toBe(1);
  });

  it("ranks by total progress descending", () => {
    const cars: RankedCar[] = [
      { id: "ai-a", totalProgress: 100 },
      { id: PLAYER, totalProgress: 250 },
      { id: "ai-b", totalProgress: 200 },
    ];
    expect(rankPosition(PLAYER, cars)).toBe(1);
    expect(rankPosition("ai-b", cars)).toBe(2);
    expect(rankPosition("ai-a", cars)).toBe(3);
  });

  it("breaks ties on id lex ascending so the result is deterministic", () => {
    // Pre-countdown grid: every car has progress 0. The HUD should not
    // flicker between equal-progress cars between ticks.
    const cars: RankedCar[] = [
      { id: "ai-c", totalProgress: 0 },
      { id: "ai-a", totalProgress: 0 },
      { id: PLAYER, totalProgress: 0 },
      { id: "ai-b", totalProgress: 0 },
    ];
    expect(rankPosition("ai-a", cars)).toBe(1);
    expect(rankPosition("ai-b", cars)).toBe(2);
    expect(rankPosition("ai-c", cars)).toBe(3);
    expect(rankPosition(PLAYER, cars)).toBe(4);
  });

  it("does not mutate the input array", () => {
    const cars: RankedCar[] = [
      { id: PLAYER, totalProgress: 100 },
      { id: "ai-a", totalProgress: 200 },
    ];
    const snapshot = [...cars];
    rankPosition(PLAYER, cars);
    expect(cars).toEqual(snapshot);
  });

  it("throws when the field is empty", () => {
    expect(() => rankPosition(PLAYER, [])).toThrow(RangeError);
  });

  it("throws when the player id is not in the field", () => {
    expect(() =>
      rankPosition("missing", [{ id: PLAYER, totalProgress: 0 }]),
    ).toThrow(RangeError);
  });
});

describe("deriveHudState lap handling", () => {
  it("renders lap 1 / N during the countdown even if race.lap is 0", () => {
    // A countdown phase that left lap = 0 must not surface as "0 / 3".
    const state = deriveHudState(
      input({ race: { lap: 0, totalLaps: 3, phase: "countdown" } }),
    );
    expect(state.lap).toBe(1);
    expect(state.totalLaps).toBe(3);
  });

  it("clamps lap to totalLaps when the sim transiently overshoots", () => {
    const state = deriveHudState(
      input({ race: { lap: 4, totalLaps: 3, phase: "racing" } }),
    );
    expect(state.lap).toBe(3);
    expect(state.totalLaps).toBe(3);
  });

  it("rounds fractional lap values toward zero before clamping", () => {
    // Defends against a future race-state field that stores lap as a
    // float (e.g. progress through current lap). For the MVP lap is
    // always an integer; the truncation just keeps the contract loud.
    const state = deriveHudState(
      input({ race: { lap: 2.7, totalLaps: 5, phase: "racing" } }),
    );
    expect(state.lap).toBe(2);
  });
});

describe("deriveHudState position handling", () => {
  it("returns 1 / 1 when the player is alone in the field", () => {
    const state = deriveHudState(input());
    expect(state.position).toBe(1);
    expect(state.totalCars).toBe(1);
  });

  it("reports the right place across a 4-car field", () => {
    const cars: RankedCar[] = [
      { id: "ai-a", totalProgress: 1000 },
      { id: "ai-b", totalProgress: 800 },
      { id: PLAYER, totalProgress: 600 },
      { id: "ai-c", totalProgress: 400 },
    ];
    const state = deriveHudState(input({ cars }));
    expect(state.position).toBe(3);
    expect(state.totalCars).toBe(4);
  });
});

describe("deriveHudState speed handling", () => {
  it("displays positive speed in km/h by default", () => {
    const state = deriveHudState(
      input({ playerSpeedMetersPerSecond: 30, speedUnit: "kph" }),
    );
    expect(state.speed).toBe(108);
    expect(state.speedUnit).toBe("kph");
  });

  it("respects the mph preference from save settings", () => {
    const state = deriveHudState(
      input({ playerSpeedMetersPerSecond: 30, speedUnit: "mph" }),
    );
    expect(state.speed).toBe(67);
    expect(state.speedUnit).toBe("mph");
  });

  it("never renders a negative number even if the sim reports reverse", () => {
    const state = deriveHudState(
      input({ playerSpeedMetersPerSecond: -12, speedUnit: "kph" }),
    );
    expect(state.speed).toBe(43);
  });
});

describe("deriveHudState purity", () => {
  it("does not mutate the input cars array or any car object", () => {
    const cars: RankedCar[] = [
      { id: PLAYER, totalProgress: 100 },
      { id: "ai-a", totalProgress: 50 },
    ];
    const snapshot = JSON.stringify(cars);
    deriveHudState(input({ cars }));
    expect(JSON.stringify(cars)).toBe(snapshot);
  });

  it("returns identical output for identical input across many calls", () => {
    // Determinism guard per AGENTS.md RULE 8. The HUD ships into the
    // §21 replay/ghost path eventually; same snapshot must always
    // render the same display.
    const cars: RankedCar[] = [
      { id: "ai-a", totalProgress: 0 },
      { id: PLAYER, totalProgress: 0 },
    ];
    const i = input({ playerSpeedMetersPerSecond: 22.5, cars });
    const first = deriveHudState(i);
    for (let n = 0; n < 100; n++) {
      expect(deriveHudState(i)).toEqual(first);
    }
  });
});
