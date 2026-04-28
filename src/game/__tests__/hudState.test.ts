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
  formatLapTime,
  gripHintForHud,
  rankPosition,
  summarizeHudDamage,
  summarizeHudGear,
  summarizeHudNitro,
  summarizeHudCashDelta,
  summarizeHudWeather,
  speedToDisplayUnit,
  weatherIconForHud,
  type HudStateInput,
  type RankedCar,
} from "@/game/hudState";
import { createDamageState } from "@/game/damage";

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

describe("deriveHudState assist badge", () => {
  it("omits the badge when the caller passes no assistBadge", () => {
    const state = deriveHudState(input());
    expect(state.assistBadge).toBeUndefined();
  });

  it("omits the badge when the assistBadge says inactive", () => {
    const state = deriveHudState(
      input({
        assistBadge: {
          active: false,
          count: 0,
          primary: null,
          active_labels: [],
        },
      }),
    );
    expect(state.assistBadge).toBeUndefined();
  });

  it("passes the badge through when at least one assist is active", () => {
    const state = deriveHudState(
      input({
        assistBadge: {
          active: true,
          count: 2,
          primary: "auto-accelerate",
          active_labels: ["auto-accelerate", "brake-assist"],
        },
      }),
    );
    expect(state.assistBadge?.active).toBe(true);
    expect(state.assistBadge?.primary).toBe("auto-accelerate");
    expect(state.assistBadge?.count).toBe(2);
  });
});

describe("formatLapTime", () => {
  it("renders zero as 00:00.000", () => {
    expect(formatLapTime(0)).toBe("00:00.000");
  });

  it("formats a sub-minute lap with two-digit seconds and three-digit ms", () => {
    expect(formatLapTime(73499)).toBe("01:13.499");
  });

  it("renders exactly one second as 00:01.000", () => {
    expect(formatLapTime(1000)).toBe("00:01.000");
  });

  it("renders an hour without rolling over the minute place", () => {
    // §20 lap times never approach an hour; the formatter keeps counting
    // so a stuck timer still reads honestly.
    expect(formatLapTime(3_600_000)).toBe("60:00.000");
  });

  it("collapses negative input to 00:00.000", () => {
    // Negative durations have no physical meaning for a lap timer.
    expect(formatLapTime(-5)).toBe("00:00.000");
    expect(formatLapTime(-1_000)).toBe("00:00.000");
  });

  it("collapses non-finite input to the placeholder string", () => {
    expect(formatLapTime(Number.NaN)).toBe("--:--.---");
    expect(formatLapTime(Number.POSITIVE_INFINITY)).toBe("--:--.---");
    expect(formatLapTime(Number.NEGATIVE_INFINITY)).toBe("--:--.---");
  });

  it("truncates fractional milliseconds rather than rounding up", () => {
    // The HUD must never show a timer ahead of the sim-reported elapsed.
    expect(formatLapTime(999.9)).toBe("00:00.999");
    expect(formatLapTime(1500.7)).toBe("00:01.500");
  });

  it("is pure: same input always produces the same output", () => {
    const first = formatLapTime(45_678);
    for (let n = 0; n < 100; n++) {
      expect(formatLapTime(45_678)).toBe(first);
    }
  });
});

describe("deriveHudState lap-timer fields", () => {
  it("omits both fields when the caller passes neither", () => {
    const state = deriveHudState(input());
    expect(state.currentLapElapsedMs).toBeUndefined();
    expect(state.bestLapMs).toBeUndefined();
  });

  it("surfaces currentLapElapsedMs when the caller supplies it", () => {
    const state = deriveHudState(input({ currentLapElapsedMs: 12_345 }));
    expect(state.currentLapElapsedMs).toBe(12_345);
    expect(state.bestLapMs).toBeUndefined();
  });

  it("surfaces bestLapMs when the caller supplies it", () => {
    const state = deriveHudState(input({ bestLapMs: 65_432 }));
    expect(state.bestLapMs).toBe(65_432);
    expect(state.currentLapElapsedMs).toBeUndefined();
  });

  it("preserves an explicit null bestLapMs so the renderer can suppress the BEST row", () => {
    const state = deriveHudState(
      input({ currentLapElapsedMs: 1_000, bestLapMs: null }),
    );
    expect(state.bestLapMs).toBeNull();
    expect(state.currentLapElapsedMs).toBe(1_000);
  });

  it("round-trips both fields together when both are supplied", () => {
    const state = deriveHudState(
      input({ currentLapElapsedMs: 4_321, bestLapMs: 9_999 }),
    );
    expect(state.currentLapElapsedMs).toBe(4_321);
    expect(state.bestLapMs).toBe(9_999);
  });
});

describe("HUD damage and weather summaries", () => {
  it("summarizes damage total and zones as rounded percentages", () => {
    const damage = createDamageState({ engine: 0.123, tires: 0.49, body: 0.8 });
    expect(summarizeHudDamage(damage)).toEqual({
      totalPercent: 43,
      zones: { engine: 12, tires: 49, body: 80 },
    });
  });

  it("maps weather variants to compact icon buckets", () => {
    expect(weatherIconForHud("clear")).toBe("clear");
    expect(weatherIconForHud("overcast")).toBe("overcast");
    expect(weatherIconForHud("rain")).toBe("rain");
    expect(weatherIconForHud("heavy_rain")).toBe("rain");
    expect(weatherIconForHud("fog")).toBe("fog");
    expect(weatherIconForHud("snow")).toBe("snow");
    expect(weatherIconForHud("night")).toBe("night");
  });

  it("derives readable weather label, grip hint, and grip percent", () => {
    expect(summarizeHudWeather("heavy_rain", 0.72)).toEqual({
      icon: "rain",
      label: "HEAVY RAIN",
      gripHint: "slick",
      gripPercent: 72,
    });
  });

  it("keeps grip hints deterministic by weather class", () => {
    expect(gripHintForHud("clear", 1)).toBe("dry");
    expect(gripHintForHud("rain", 0.85)).toBe("wet");
    expect(gripHintForHud("rain", 0.72)).toBe("slick");
    expect(gripHintForHud("fog", 1)).toBe("low-vis");
    expect(gripHintForHud("snow", 0.6)).toBe("snow");
    expect(gripHintForHud("night", 1)).toBe("night");
  });

  it("surfaces damage and weather when the caller supplies live race state", () => {
    const state = deriveHudState(
      input({
        damage: createDamageState({ engine: 0.5, tires: 0.25, body: 0 }),
        weather: "fog",
        weatherGripScalar: 0.91,
      }),
    );
    expect(state.damage).toEqual({
      totalPercent: 28,
      zones: { engine: 50, tires: 25, body: 0 },
    });
    expect(state.weather).toEqual({
      icon: "fog",
      label: "FOG",
      gripHint: "low-vis",
      gripPercent: 91,
    });
  });

  it("omits damage and weather when callers remain on the minimal HUD shape", () => {
    const state = deriveHudState(input());
    expect(state.damage).toBeUndefined();
    expect(state.weather).toBeUndefined();
  });
});

describe("HUD gear and nitro summaries", () => {
  it("summarizes idle nitro as full stock charges", () => {
    expect(
      summarizeHudNitro({ charges: 3, activeRemainingSec: 0 }, 3, 1.1),
    ).toEqual({
      current: 3,
      max: 3,
      active: false,
      percent: 100,
    });
  });

  it("includes the active charge fraction in the nitro meter", () => {
    expect(
      summarizeHudNitro({ charges: 2, activeRemainingSec: 0.55 }, 3, 1.1),
    ).toEqual({
      current: 2.5,
      max: 3,
      active: true,
      percent: 83,
    });
  });

  it("summarizes transmission gear, RPM, and mode", () => {
    expect(summarizeHudGear({ mode: "manual", gear: 4, rpm: 0.876 })).toEqual({
      gear: 4,
      rpmPercent: 88,
      mode: "manual",
    });
  });

  it("surfaces nitro and gear when callers supply runtime state", () => {
    const state = deriveHudState(
      input({
        nitro: { charges: 1, activeRemainingSec: 0.25 },
        nitroMaxCharges: 3,
        nitroChargeDurationSec: 1,
        transmission: { mode: "auto", gear: 2, rpm: 0.42 },
      }),
    );
    expect(state.nitro).toEqual({
      current: 1.25,
      max: 3,
      active: true,
      percent: 42,
    });
    expect(state.gear).toEqual({
      gear: 2,
      rpmPercent: 42,
      mode: "auto",
    });
  });

  it("omits nitro and gear for minimal HUD callers", () => {
    const state = deriveHudState(input());
    expect(state.nitro).toBeUndefined();
    expect(state.gear).toBeUndefined();
  });
});

describe("HUD cash delta summary", () => {
  it("formats positive cash with an explicit plus sign", () => {
    expect(summarizeHudCashDelta(1250)).toEqual({
      credits: 1250,
      label: "+1,250 cr",
    });
  });

  it("formats negative cash with a minus sign", () => {
    expect(summarizeHudCashDelta(-375)).toEqual({
      credits: -375,
      label: "-375 cr",
    });
  });

  it("collapses non-finite cash to zero", () => {
    expect(summarizeHudCashDelta(Number.NaN)).toEqual({
      credits: 0,
      label: "0 cr",
    });
  });

  it("surfaces cash delta only when the caller supplies it", () => {
    expect(deriveHudState(input({ cashDelta: 999 })).cashDelta).toEqual({
      credits: 999,
      label: "+999 cr",
    });
    expect(deriveHudState(input()).cashDelta).toBeUndefined();
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
