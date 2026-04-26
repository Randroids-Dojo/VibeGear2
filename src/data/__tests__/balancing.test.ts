/**
 * §23 "Balancing tables" content test.
 *
 * `docs/gdd/23-balancing-tables.md` is the single source of truth for the
 * numeric tuning of the MVP. This file pins each §23 cell against the
 * place in code or content where it lives, so an accidental edit to
 * either side breaks the build.
 *
 * Coverage:
 *
 *  1. Core car balance sheet (§23) -> per-car JSON `baseStats`.
 *     (Already covered cell-by-cell in `cars-content.test.ts`; this file
 *     re-asserts the same values from a §23-shaped table so the §23
 *     "what changed" diff is readable in one place.)
 *  2. Reward formula targets (§23) -> `BASE_REWARDS_BY_TRACK_DIFFICULTY`
 *     in `src/game/economy.ts`.
 *  3. Damage formula targets (§23) -> `HIT_MAGNITUDE_RANGES` and
 *     `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` in `src/game/damage.ts`.
 *  4. Weather modifiers (§23) -> deferred. The weather-state-machine
 *     module (`VibeGear2-implement-weather-38d61fc2`) has not landed; the
 *     consumer table will live there. Tracked as F-043; this test pins
 *     the §23 column so the wiring slice can copy it verbatim once the
 *     module is in place.
 *  5. CPU difficulty modifiers (§23) -> deferred. The §23 column gives
 *     pace / recovery / mistake scalars per `Easy / Normal / Hard /
 *     Master` ladder. Today the AI ladder is per-driver
 *     (`paceScalar` on each `AIDriver` JSON) and there is no consumer
 *     for `recoveryScalar` / `mistakeScalar`; they will land with the
 *     difficulty-tier wiring slice. Tracked as F-044; this test pins
 *     the §23 column so the wiring slice can copy it verbatim.
 *  6. Track difficulty rating rubric (§23) -> qualitative weights, no
 *     runtime consumer; out of scope here.
 *
 * Adding a §23 row: pin it in code (constant or JSON), then add a cell
 * to the table below and a cross-reference assertion. Do not import the
 * module's exported constant *and* re-derive it from §23 in the same
 * test, or the test cannot catch a drift between the two.
 */

import { describe, expect, it } from "vitest";

import { CARS_BY_ID } from "@/data/cars";
import {
  BASE_REWARDS_BY_TRACK_DIFFICULTY,
  baseRewardForTrackDifficulty,
} from "@/game/economy";
import {
  HIT_MAGNITUDE_RANGES,
  NITRO_WHILE_SEVERELY_DAMAGED_BONUS,
} from "@/game/damage";

const TOL = 1e-9;

// ---------------------------------------------------------------------------
// 1. Core car balance sheet (§23)
// ---------------------------------------------------------------------------

/**
 * §23 "Core car balance sheet" verbatim. Mirror of the §23 markdown
 * table; the cars-content test owns the per-car cross-check and this
 * file re-asserts the same shape so a §23 edit fails the build at a
 * single, readable site.
 */
const CAR_BALANCE_SHEET: ReadonlyArray<{
  id: string;
  topSpeed: number;
  accel: number;
  gripDry: number;
  gripWet: number;
  stability: number;
  durability: number;
  nitroEfficiency: number;
}> = [
  { id: "sparrow-gt", topSpeed: 61, accel: 16, gripDry: 1.0, gripWet: 0.82, stability: 1.0, durability: 0.95, nitroEfficiency: 1.0 },
  { id: "breaker-s", topSpeed: 58, accel: 16.5, gripDry: 1.08, gripWet: 0.9, stability: 1.05, durability: 0.92, nitroEfficiency: 0.95 },
  { id: "vanta-xr", topSpeed: 64, accel: 17.5, gripDry: 0.93, gripWet: 0.76, stability: 0.9, durability: 0.88, nitroEfficiency: 1.08 },
  { id: "tempest-r", topSpeed: 76, accel: 20, gripDry: 1.02, gripWet: 0.84, stability: 1.0, durability: 0.96, nitroEfficiency: 1.05 },
  { id: "bastion-lm", topSpeed: 72, accel: 18, gripDry: 1.0, gripWet: 0.86, stability: 1.08, durability: 1.12, nitroEfficiency: 0.96 },
  { id: "nova-shade", topSpeed: 82, accel: 22, gripDry: 0.95, gripWet: 0.78, stability: 0.92, durability: 0.9, nitroEfficiency: 1.12 },
];

describe("§23 Core car balance sheet", () => {
  it.each(CAR_BALANCE_SHEET.map((row) => [row.id, row] as const))(
    "%s baseStats match the §23 table",
    (_id, row) => {
      const car = CARS_BY_ID.get(row.id);
      expect(car).toBeDefined();
      if (!car) return;
      expect(car.baseStats.topSpeed).toBeCloseTo(row.topSpeed, 5);
      expect(car.baseStats.accel).toBeCloseTo(row.accel, 5);
      expect(car.baseStats.gripDry).toBeCloseTo(row.gripDry, 5);
      expect(car.baseStats.gripWet).toBeCloseTo(row.gripWet, 5);
      expect(car.baseStats.stability).toBeCloseTo(row.stability, 5);
      expect(car.baseStats.durability).toBeCloseTo(row.durability, 5);
      expect(car.baseStats.nitroEfficiency).toBeCloseTo(row.nitroEfficiency, 5);
    },
  );
});

// ---------------------------------------------------------------------------
// 2. Reward formula targets (§23)
// ---------------------------------------------------------------------------

/**
 * §23 "Reward formula targets" verbatim. Pin against
 * `BASE_REWARDS_BY_TRACK_DIFFICULTY` from `src/game/economy.ts`.
 */
const REWARD_FORMULA_TARGETS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1000,
  2: 1350,
  3: 1750,
  4: 2250,
  5: 2900,
};

describe("§23 Reward formula targets", () => {
  it.each(
    ([1, 2, 3, 4, 5] as const).map(
      (tier) => [tier, REWARD_FORMULA_TARGETS[tier]] as const,
    ),
  )("difficulty %i pays %i credits", (difficulty, expected) => {
    expect(BASE_REWARDS_BY_TRACK_DIFFICULTY[difficulty]).toBe(expected);
  });

  it("baseRewardForTrackDifficulty resolves every in-range tier", () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      expect(baseRewardForTrackDifficulty(tier)).toBe(REWARD_FORMULA_TARGETS[tier]);
    }
  });

  it("baseRewardForTrackDifficulty clamps below 1 to tier 1", () => {
    expect(baseRewardForTrackDifficulty(0)).toBe(REWARD_FORMULA_TARGETS[1]);
    expect(baseRewardForTrackDifficulty(-3)).toBe(REWARD_FORMULA_TARGETS[1]);
  });

  it("baseRewardForTrackDifficulty clamps above 5 to tier 5", () => {
    expect(baseRewardForTrackDifficulty(6)).toBe(REWARD_FORMULA_TARGETS[5]);
    expect(baseRewardForTrackDifficulty(99)).toBe(REWARD_FORMULA_TARGETS[5]);
  });

  it("baseRewardForTrackDifficulty falls back to tier 1 on NaN", () => {
    expect(baseRewardForTrackDifficulty(Number.NaN)).toBe(REWARD_FORMULA_TARGETS[1]);
  });

  it("rounds fractional difficulties to the nearest tier", () => {
    expect(baseRewardForTrackDifficulty(2.4)).toBe(REWARD_FORMULA_TARGETS[2]);
    expect(baseRewardForTrackDifficulty(2.5)).toBe(REWARD_FORMULA_TARGETS[3]);
  });
});

// ---------------------------------------------------------------------------
// 3. Damage formula targets (§23)
// ---------------------------------------------------------------------------

/**
 * §23 "Damage formula targets" verbatim:
 *
 *     rubDamage             = 2  to 4
 *     carHitDamage          = 6  to 12
 *     wallDamage            = 12 to 24
 *     offRoadObjectDamage   = 10 to 20
 *     nitroWhileSeverelyDamagedBonus = +15%
 */
const DAMAGE_RANGES: Record<"rub" | "carHit" | "wallHit" | "offRoadObject", { min: number; max: number }> = {
  rub: { min: 2, max: 4 },
  carHit: { min: 6, max: 12 },
  wallHit: { min: 12, max: 24 },
  offRoadObject: { min: 10, max: 20 },
};

describe("§23 Damage formula targets", () => {
  it.each(
    (Object.keys(DAMAGE_RANGES) as Array<keyof typeof DAMAGE_RANGES>).map(
      (kind) => [kind, DAMAGE_RANGES[kind]] as const,
    ),
  )("%s magnitude range matches §23", (kind, expected) => {
    const range = HIT_MAGNITUDE_RANGES[kind];
    expect(range.min).toBe(expected.min);
    expect(range.max).toBe(expected.max);
  });

  it("nitroWhileSeverelyDamagedBonus pins +15%", () => {
    expect(NITRO_WHILE_SEVERELY_DAMAGED_BONUS).toBeCloseTo(0.15, 9);
  });

  it("HIT_MAGNITUDE_RANGES is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(HIT_MAGNITUDE_RANGES)).toBe(true);
    for (const kind of Object.keys(HIT_MAGNITUDE_RANGES) as Array<
      keyof typeof HIT_MAGNITUDE_RANGES
    >) {
      expect(Object.isFrozen(HIT_MAGNITUDE_RANGES[kind])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Weather modifiers (§23): deferred to F-043
// ---------------------------------------------------------------------------

/**
 * §23 "Weather modifiers" pinned here for the wiring slice to copy
 * verbatim once `src/game/weather.ts` lands. No assertion runs today;
 * the table is referenced by F-043.
 */
const WEATHER_MODIFIERS: ReadonlyArray<{
  weather: string;
  dryTireMod: number;
  wetTireMod: number;
}> = [
  { weather: "Clear", dryTireMod: 0.08, wetTireMod: 0 },
  { weather: "Rain", dryTireMod: -0.12, wetTireMod: 0.1 },
  { weather: "Heavy rain", dryTireMod: -0.2, wetTireMod: 0.16 },
  { weather: "Snow", dryTireMod: -0.18, wetTireMod: 0.14 },
  { weather: "Fog", dryTireMod: 0, wetTireMod: 0 },
];

describe("§23 Weather modifiers (pinned for F-043)", () => {
  it("table shape matches the §23 row count", () => {
    expect(WEATHER_MODIFIERS.length).toBe(5);
  });

  it("modifiers are within the documented sane range", () => {
    for (const row of WEATHER_MODIFIERS) {
      expect(row.dryTireMod).toBeGreaterThanOrEqual(-1);
      expect(row.dryTireMod).toBeLessThanOrEqual(1);
      expect(row.wetTireMod).toBeGreaterThanOrEqual(-1);
      expect(row.wetTireMod).toBeLessThanOrEqual(1);
    }
  });

  it("Fog is grip-neutral on both tire types per §23", () => {
    const fog = WEATHER_MODIFIERS.find((r) => r.weather === "Fog");
    expect(fog).toBeDefined();
    expect(fog?.dryTireMod ?? Number.NaN).toBeCloseTo(0, 9);
    expect(fog?.wetTireMod ?? Number.NaN).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// 5. CPU difficulty modifiers (§23): deferred to F-044
// ---------------------------------------------------------------------------

/**
 * §23 "CPU difficulty modifiers" pinned here for the wiring slice to
 * copy verbatim once the difficulty-tier consumer lands. Today the AI
 * ladder is per-driver (`AIDriver.paceScalar`); there is no consumer for
 * `recoveryScalar` / `mistakeScalar` yet.
 */
const CPU_DIFFICULTY_MODIFIERS: ReadonlyArray<{
  difficulty: "Easy" | "Normal" | "Hard" | "Master";
  paceScalar: number;
  recoveryScalar: number;
  mistakeScalar: number;
}> = [
  { difficulty: "Easy", paceScalar: 0.92, recoveryScalar: 0.95, mistakeScalar: 1.4 },
  { difficulty: "Normal", paceScalar: 1.0, recoveryScalar: 1.0, mistakeScalar: 1.0 },
  { difficulty: "Hard", paceScalar: 1.05, recoveryScalar: 1.03, mistakeScalar: 0.7 },
  { difficulty: "Master", paceScalar: 1.09, recoveryScalar: 1.05, mistakeScalar: 0.45 },
];

describe("§23 CPU difficulty modifiers (pinned for F-044)", () => {
  it("table shape matches the §23 row count", () => {
    expect(CPU_DIFFICULTY_MODIFIERS.length).toBe(4);
  });

  it("paceScalar is monotonically non-decreasing across the ladder", () => {
    for (let i = 1; i < CPU_DIFFICULTY_MODIFIERS.length; i += 1) {
      const prev = CPU_DIFFICULTY_MODIFIERS[i - 1]!;
      const curr = CPU_DIFFICULTY_MODIFIERS[i]!;
      expect(curr.paceScalar).toBeGreaterThanOrEqual(prev.paceScalar - TOL);
    }
  });

  it("mistakeScalar is monotonically non-increasing across the ladder", () => {
    for (let i = 1; i < CPU_DIFFICULTY_MODIFIERS.length; i += 1) {
      const prev = CPU_DIFFICULTY_MODIFIERS[i - 1]!;
      const curr = CPU_DIFFICULTY_MODIFIERS[i]!;
      expect(curr.mistakeScalar).toBeLessThanOrEqual(prev.mistakeScalar + TOL);
    }
  });

  it("Normal sits at identity for every column", () => {
    const normal = CPU_DIFFICULTY_MODIFIERS.find((r) => r.difficulty === "Normal");
    expect(normal).toBeDefined();
    expect(normal?.paceScalar ?? Number.NaN).toBeCloseTo(1, 9);
    expect(normal?.recoveryScalar ?? Number.NaN).toBeCloseTo(1, 9);
    expect(normal?.mistakeScalar ?? Number.NaN).toBeCloseTo(1, 9);
  });
});
