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
import { createRng, serializeRng } from "@/game/rng";

import {
  activeWeatherForState,
  createWeatherState,
  effectiveWeatherGrip,
  getWeatherTireModifier,
  getResolvedWeatherTireModifier,
  isWeatherTireModifierKey,
  resolveWeatherTireModifierKey,
  stepWeatherState,
  visibilityForWeather,
  visibilityForWeatherState,
  weatherGripScalar,
  weatherGripScalarForState,
  weatherSkillFor,
  WEATHER_TRANSITION_SECONDS,
  WEATHER_TIRE_MODIFIER_ALIASES,
  WEATHER_TIRE_MODIFIER_KEYS,
  WEATHER_TIRE_MODIFIERS,
  WEATHER_VISIBILITY,
  type WeatherState,
  type WeatherTireModifier,
  type WeatherTireModifierKey,
} from "../weather";

const STATS = Object.freeze({
  topSpeed: 61,
  accel: 16,
  brake: 28,
  gripDry: 1,
  gripWet: 0.82,
  stability: 1,
  durability: 0.95,
  nitroEfficiency: 1,
});

const DRIVER = Object.freeze({
  id: "ai_weather",
  displayName: "AI Weather",
  archetype: "clean_line" as const,
  paceScalar: 1,
  mistakeRate: 0,
  aggression: 0,
  weatherSkill: { clear: 1, rain: 1.04, fog: 0.98, snow: 1.06 },
  nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
});

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

  it.each(["overcast", "light_rain", "dusk", "night"] as const)(
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

  it.each(["overcast", "light_rain", "dusk", "night"] as ReadonlyArray<WeatherOption>)(
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

describe("runtime weather aliases", () => {
  it("is frozen so runtime alias policy cannot drift by mutation", () => {
    expect(Object.isFrozen(WEATHER_TIRE_MODIFIER_ALIASES)).toBe(true);
  });

  it.each([
    ["clear", "clear"],
    ["overcast", "clear"],
    ["light_rain", "rain"],
    ["rain", "rain"],
    ["heavy_rain", "heavy_rain"],
    ["fog", "fog"],
    ["snow", "snow"],
    ["dusk", "clear"],
    ["night", "clear"],
  ] as ReadonlyArray<readonly [WeatherOption, WeatherTireModifierKey]>)(
    "maps %s to the %s §23 row",
    (weather, expected) => {
      expect(resolveWeatherTireModifierKey(weather)).toBe(expected);
      expect(getResolvedWeatherTireModifier(weather)).toBe(
        WEATHER_TIRE_MODIFIERS[expected],
      );
    },
  );
});

describe("effectiveWeatherGrip", () => {
  it("applies dry-tire §23 offsets to the dry grip baseline", () => {
    expect(effectiveWeatherGrip(STATS, "clear", "dry")).toBeCloseTo(1.08, 9);
    expect(effectiveWeatherGrip(STATS, "rain", "dry")).toBeCloseTo(0.88, 9);
    expect(effectiveWeatherGrip(STATS, "heavy_rain", "dry")).toBeCloseTo(0.8, 9);
  });

  it("can resolve the wet tire channel once tire selection exists", () => {
    expect(effectiveWeatherGrip(STATS, "rain", "wet")).toBeCloseTo(0.92, 9);
    expect(effectiveWeatherGrip(STATS, "snow", "wet")).toBeCloseTo(0.96, 9);
  });

  it("converts effective grip into a scalar relative to dry baseline", () => {
    expect(weatherGripScalar(STATS, "clear", "dry")).toBeCloseTo(1.08, 9);
    expect(weatherGripScalar(STATS, "rain", "dry")).toBeCloseTo(0.88, 9);
  });

  it("uses the runtime alias for light rain instead of returning identity", () => {
    expect(effectiveWeatherGrip(STATS, "light_rain", "dry")).toBeCloseTo(
      effectiveWeatherGrip(STATS, "rain", "dry"),
      9,
    );
  });

  it("uses the runtime alias for overcast as a clear-adjacent grip row", () => {
    expect(effectiveWeatherGrip(STATS, "overcast", "dry")).toBeCloseTo(
      effectiveWeatherGrip(STATS, "clear", "dry"),
      9,
    );
  });
});

describe("visibilityForWeather", () => {
  it("is frozen so forecast/read-distance scalars cannot drift by mutation", () => {
    expect(Object.isFrozen(WEATHER_VISIBILITY)).toBe(true);
  });

  it.each([
    ["clear", 1],
    ["overcast", 0.95],
    ["light_rain", 0.9],
    ["rain", 0.8],
    ["heavy_rain", 0.7],
    ["fog", 0.5],
    ["snow", 0.6],
    ["dusk", 0.85],
    ["night", 0.65],
  ] as ReadonlyArray<readonly [WeatherOption, number]>)(
    "returns %s visibility",
    (weather, expected) => {
      expect(visibilityForWeather(weather)).toBeCloseTo(expected, 9);
    },
  );
});

describe("weatherSkillFor", () => {
  it.each([
    ["clear", 1],
    ["overcast", 1],
    ["dusk", 1],
    ["night", 1],
    ["light_rain", 1.04],
    ["rain", 1.04],
    ["heavy_rain", 1.04],
    ["fog", 0.98],
    ["snow", 1.06],
  ] as ReadonlyArray<readonly [WeatherOption, number]>)(
    "maps %s to the compact AI weather skill row",
    (weather, expected) => {
      expect(weatherSkillFor(DRIVER, weather)).toBeCloseTo(expected, 9);
    },
  );
});

describe("WeatherState transitions", () => {
  it("creates a stable fixed-weather state from a track option", () => {
    expect(createWeatherState("rain", ["clear", "rain"])).toEqual<WeatherState>({
      current: "rain",
      transitioning: null,
    });
  });

  it("rejects empty allowed states and weather outside the track set", () => {
    expect(() => createWeatherState("clear", [])).toThrow(RangeError);
    expect(() => createWeatherState("snow", ["clear", "rain"])).toThrow(
      RangeError,
    );
  });

  it("does not consume RNG when transition chance is disabled", () => {
    const rng = createRng(7);
    const before = serializeRng(rng);
    const next = stepWeatherState(
      createWeatherState("clear", ["clear", "rain"]),
      1,
      rng,
      { allowedStates: ["clear", "rain"] },
    );
    expect(next).toEqual({ current: "clear", transitioning: null });
    expect(serializeRng(rng)).toBe(before);
  });

  it("never leaves a single-weather track", () => {
    const rng = createRng(11);
    const next = stepWeatherState(createWeatherState("clear", ["clear"]), 5, rng, {
      allowedStates: ["clear"],
      changeChancePerSecond: 1,
    });
    expect(next).toEqual({ current: "clear", transitioning: null });
  });

  it("starts a deterministic transition to another allowed state", () => {
    const a = stepWeatherState(
      createWeatherState("clear", ["clear", "rain", "snow"]),
      1,
      createRng(42),
      { allowedStates: ["clear", "rain", "snow"], changeChancePerSecond: 1 },
    );
    const b = stepWeatherState(
      createWeatherState("clear", ["clear", "rain", "snow"]),
      1,
      createRng(42),
      { allowedStates: ["clear", "rain", "snow"], changeChancePerSecond: 1 },
    );
    expect(a).toEqual(b);
    expect(a.transitioning?.from).toBe("clear");
    expect(["rain", "snow"]).toContain(a.transitioning?.to);
    expect(a.transitioning?.progress).toBe(0);
  });

  it("advances transition progress over the default two-second window", () => {
    const initial: WeatherState = {
      current: "clear",
      transitioning: { from: "clear", to: "rain", progress: 0 },
    };
    const half = stepWeatherState(initial, WEATHER_TRANSITION_SECONDS / 2, createRng(1), {
      allowedStates: ["clear", "rain"],
    });
    expect(half.transitioning?.progress).toBeCloseTo(0.5, 9);
    const done = stepWeatherState(half, WEATHER_TRANSITION_SECONDS / 2, createRng(1), {
      allowedStates: ["clear", "rain"],
    });
    expect(done).toEqual({ current: "rain", transitioning: null });
  });

  it("interpolates grip and visibility during a transition", () => {
    const mid: WeatherState = {
      current: "clear",
      transitioning: { from: "clear", to: "rain", progress: 0.5 },
    };
    const clearGrip = weatherGripScalar(STATS, "clear", "dry");
    const rainGrip = weatherGripScalar(STATS, "rain", "dry");
    expect(weatherGripScalarForState(STATS, mid, "dry")).toBeCloseTo(
      (clearGrip + rainGrip) / 2,
      9,
    );
    expect(visibilityForWeatherState(mid)).toBeCloseTo(
      (visibilityForWeather("clear") + visibilityForWeather("rain")) / 2,
      9,
    );
    expect(activeWeatherForState(mid)).toBe("rain");
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
