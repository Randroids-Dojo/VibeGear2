/**
 * Unit tests for `src/game/weather.ts`.
 *
 * Pins the §23 "Weather modifiers" table verbatim so a future
 * balancing pass that retunes a number trips this test (and forces a
 * matching GDD edit). Also covers the §23-row schema subset, the
 * `WeatherOption` values that §23 leaves uncovered, frozen-object
 * semantics, and the call-site guarantees that callers can lean on
 * identity comparison.
 *
 * Float comparisons use `toBe` because every scalar in the table is
 * a clean decimal that round-trips through IEEE-754 exactly. AGENTS.md
 * RULE 8: would have used `toBeCloseTo` if any value were derived
 * arithmetically; here every value is a literal.
 */

import { describe, expect, it } from "vitest";

import type { WeatherOption } from "@/data/schemas";

import {
  getWeatherTireModifier,
  isWeatherTireModifierKey,
  WEATHER_TIRE_MODIFIER_KEYS,
  WEATHER_TIRE_MODIFIERS,
  type WeatherTireModifier,
  type WeatherTireModifierKey,
} from "../weather";

describe("WEATHER_TIRE_MODIFIER_KEYS", () => {
  it("lists the §23 rows in §23 order (Clear, Rain, Heavy rain, Snow, Fog)", () => {
    expect(WEATHER_TIRE_MODIFIER_KEYS).toEqual([
      "clear",
      "rain",
      "heavy_rain",
      "snow",
      "fog",
    ]);
  });

  it("is frozen so callers cannot mutate the iteration order", () => {
    expect(Object.isFrozen(WEATHER_TIRE_MODIFIER_KEYS)).toBe(true);
  });

  it("matches the §23 row count (five)", () => {
    expect(WEATHER_TIRE_MODIFIER_KEYS).toHaveLength(5);
  });
});

describe("WEATHER_TIRE_MODIFIERS", () => {
  it("is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(WEATHER_TIRE_MODIFIERS)).toBe(true);
    for (const key of WEATHER_TIRE_MODIFIER_KEYS) {
      expect(Object.isFrozen(WEATHER_TIRE_MODIFIERS[key])).toBe(true);
    }
  });

  it("covers every §23 weather row with no extras", () => {
    expect(Object.keys(WEATHER_TIRE_MODIFIERS).sort()).toEqual(
      ["clear", "fog", "heavy_rain", "rain", "snow"],
    );
  });

  it("pins the §23 Clear row (+0.08 / 0.00)", () => {
    expect(WEATHER_TIRE_MODIFIERS.clear).toEqual<WeatherTireModifier>({
      dryTireMod: 0.08,
      wetTireMod: 0,
    });
  });

  it("pins the §23 Rain row (-0.12 / +0.10)", () => {
    expect(WEATHER_TIRE_MODIFIERS.rain).toEqual<WeatherTireModifier>({
      dryTireMod: -0.12,
      wetTireMod: 0.1,
    });
  });

  it("pins the §23 Heavy rain row (-0.20 / +0.16)", () => {
    expect(WEATHER_TIRE_MODIFIERS.heavy_rain).toEqual<WeatherTireModifier>({
      dryTireMod: -0.2,
      wetTireMod: 0.16,
    });
  });

  it("pins the §23 Snow row (-0.18 / +0.14)", () => {
    expect(WEATHER_TIRE_MODIFIERS.snow).toEqual<WeatherTireModifier>({
      dryTireMod: -0.18,
      wetTireMod: 0.14,
    });
  });

  it("pins the §23 Fog row (0 / 0) per §14 visibility-not-grip semantics", () => {
    expect(WEATHER_TIRE_MODIFIERS.fog).toEqual<WeatherTireModifier>({
      dryTireMod: 0,
      wetTireMod: 0,
    });
  });
});

describe("isWeatherTireModifierKey", () => {
  it.each(["clear", "rain", "heavy_rain", "snow", "fog"] as const)(
    "returns true for the §23 row %s",
    (key) => {
      expect(isWeatherTireModifierKey(key)).toBe(true);
    },
  );

  it.each(["light_rain", "dusk", "night"] as const)(
    "returns false for the WeatherOption %s that §23 leaves uncovered",
    (key) => {
      expect(isWeatherTireModifierKey(key)).toBe(false);
    },
  );

  it("narrows WeatherOption to WeatherTireModifierKey at the use site", () => {
    const w: WeatherOption = "rain";
    if (isWeatherTireModifierKey(w)) {
      // The narrowed type is `WeatherTireModifierKey`; the lookup is
      // therefore guaranteed to be defined and the assignment is safe.
      const row: WeatherTireModifier = WEATHER_TIRE_MODIFIERS[w];
      expect(row.dryTireMod).toBe(-0.12);
    } else {
      throw new Error("rain should narrow to a §23 row");
    }
  });
});

describe("getWeatherTireModifier", () => {
  it.each([
    ["clear", { dryTireMod: 0.08, wetTireMod: 0 }],
    ["rain", { dryTireMod: -0.12, wetTireMod: 0.1 }],
    ["heavy_rain", { dryTireMod: -0.2, wetTireMod: 0.16 }],
    ["snow", { dryTireMod: -0.18, wetTireMod: 0.14 }],
    ["fog", { dryTireMod: 0, wetTireMod: 0 }],
  ] as ReadonlyArray<readonly [WeatherTireModifierKey, WeatherTireModifier]>)(
    "returns the §23 row for %s",
    (key, expected) => {
      expect(getWeatherTireModifier(key)).toEqual(expected);
    },
  );

  it.each(["light_rain", "dusk", "night"] as ReadonlyArray<WeatherOption>)(
    "returns undefined for the §23-uncovered WeatherOption %s (Q-008)",
    (key) => {
      expect(getWeatherTireModifier(key)).toBeUndefined();
    },
  );

  it("returns the same frozen object reference across calls", () => {
    const first = getWeatherTireModifier("rain");
    const second = getWeatherTireModifier("rain");
    expect(first).toBe(second);
    expect(first && Object.isFrozen(first)).toBe(true);
  });
});

describe("§23 table monotonicity (sanity)", () => {
  // Walking from Clear -> Rain -> Heavy rain, dry grip should fall
  // and wet grip should rise. Snow sits roughly between Rain and
  // Heavy rain in severity. Fog is grip-neutral. These assertions
  // catch a future typo that flips a sign or swaps two cells; they
  // are not a balancing-pass replacement.
  it("dryTireMod is monotonically non-increasing from Clear -> Rain -> Heavy rain", () => {
    const clear = WEATHER_TIRE_MODIFIERS.clear.dryTireMod;
    const rain = WEATHER_TIRE_MODIFIERS.rain.dryTireMod;
    const heavy = WEATHER_TIRE_MODIFIERS.heavy_rain.dryTireMod;
    expect(clear).toBeGreaterThanOrEqual(rain);
    expect(rain).toBeGreaterThanOrEqual(heavy);
  });

  it("wetTireMod is monotonically non-decreasing from Clear -> Rain -> Heavy rain", () => {
    const clear = WEATHER_TIRE_MODIFIERS.clear.wetTireMod;
    const rain = WEATHER_TIRE_MODIFIERS.rain.wetTireMod;
    const heavy = WEATHER_TIRE_MODIFIERS.heavy_rain.wetTireMod;
    expect(clear).toBeLessThanOrEqual(rain);
    expect(rain).toBeLessThanOrEqual(heavy);
  });

  it("Fog is grip-neutral on both columns per §14", () => {
    expect(WEATHER_TIRE_MODIFIERS.fog.dryTireMod).toBe(0);
    expect(WEATHER_TIRE_MODIFIERS.fog.wetTireMod).toBe(0);
  });

  it("Clear gives dry tires the only positive dryTireMod", () => {
    expect(WEATHER_TIRE_MODIFIERS.clear.dryTireMod).toBeGreaterThan(0);
    for (const key of ["rain", "heavy_rain", "snow", "fog"] as const) {
      expect(WEATHER_TIRE_MODIFIERS[key].dryTireMod).toBeLessThanOrEqual(0);
    }
  });

  it("every precipitating row gives wet tires a positive wetTireMod", () => {
    for (const key of ["rain", "heavy_rain", "snow"] as const) {
      expect(WEATHER_TIRE_MODIFIERS[key].wetTireMod).toBeGreaterThan(0);
    }
  });
});
