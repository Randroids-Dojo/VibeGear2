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
 *  4. Weather modifiers (§23) -> `WEATHER_TIRE_MODIFIERS` in
 *     `src/game/weather.ts`. The §23 row gives a dry/wet tire offset
 *     per weather (Clear, Rain, Heavy rain, Snow, Fog). The wiring
 *     consumer (physics integration that adds the offset to a car's
 *     `baseStats.gripDry / gripWet`) has not landed yet; the table
 *     here is the binding the wiring slice reads. Owned by the parent
 *     dot `VibeGear2-implement-weather-38d61fc2`.
 *  5. CPU difficulty modifiers (§23) -> `CPU_DIFFICULTY_MODIFIERS`
 *     in `src/game/aiDifficulty.ts`. The §23 column gives
 *     pace / recovery / mistake scalars per `Easy / Normal / Hard /
 *     Master` ladder. `tickAI` consumes all three scalars; the table
 *     here keeps future balancing edits visible.
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
  cappedRepairCost,
  EASY_MODE_TOUR_BONUS_FRACTION,
  easyModeBonus,
  REPAIR_CAP_FRACTION,
  STIPEND_AMOUNT,
  STIPEND_THRESHOLD_CREDITS,
} from "@/game/catchUp";
import type { SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence/save";
import {
  BASE_REWARDS_BY_TRACK_DIFFICULTY,
  baseRewardForTrackDifficulty,
  TOUR_TIER_SCALE,
  tourTierScale,
} from "@/game/economy";
import {
  HIT_MAGNITUDE_RANGES,
  NITRO_WHILE_SEVERELY_DAMAGED_BONUS,
} from "@/game/damage";
import { CPU_DIFFICULTY_MODIFIERS } from "@/game/aiDifficulty";
import {
  WEATHER_TIRE_MODIFIERS,
  WEATHER_TIRE_MODIFIER_KEYS,
  type WeatherTireModifierKey,
} from "@/game/weather";
import type { PlayerDifficultyPreset } from "@/data/schemas";

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
// 2b. Repair cost tour tier scale (§23, per Q-010 option (a))
// ---------------------------------------------------------------------------

/**
 * §23 "Repair cost tour tier scale" verbatim. Pin against
 * `TOUR_TIER_SCALE` from `src/game/economy.ts`. Resolved by `Q-010`
 * with the iter-19 placeholder table; tours past 8 reuse the tour-8
 * value.
 */
const TOUR_TIER_SCALE_TARGETS: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, number> = {
  1: 1.0,
  2: 1.15,
  3: 1.3,
  4: 1.5,
  5: 1.75,
  6: 2.05,
  7: 2.4,
  8: 2.8,
};

describe("§23 Repair cost tour tier scale", () => {
  it.each(
    ([1, 2, 3, 4, 5, 6, 7, 8] as const).map(
      (tour) => [tour, TOUR_TIER_SCALE_TARGETS[tour]] as const,
    ),
  )("tour %i scales repair cost by %f", (tour, expected) => {
    expect(TOUR_TIER_SCALE[tour]).toBeCloseTo(expected, 9);
  });

  it("tourTierScale resolves every in-range tour", () => {
    for (const tour of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(tourTierScale(tour)).toBeCloseTo(
        TOUR_TIER_SCALE_TARGETS[tour],
        9,
      );
    }
  });

  it("tourTierScale clamps below 1 to tour 1", () => {
    expect(tourTierScale(0)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[1], 9);
    expect(tourTierScale(-3)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[1], 9);
  });

  it("tourTierScale clamps above 8 to tour 8", () => {
    expect(tourTierScale(9)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[8], 9);
    expect(tourTierScale(99)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[8], 9);
  });

  it("tourTierScale falls back to tour 1 on NaN", () => {
    expect(tourTierScale(Number.NaN)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[1], 9);
  });

  it("rounds fractional tour indexes to the nearest tour", () => {
    expect(tourTierScale(2.4)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[2], 9);
    expect(tourTierScale(2.5)).toBeCloseTo(TOUR_TIER_SCALE_TARGETS[3], 9);
  });

  it("scale is monotonically non-decreasing across tours", () => {
    for (let tour = 2; tour <= 8; tour += 1) {
      const prev = TOUR_TIER_SCALE[(tour - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];
      const curr = TOUR_TIER_SCALE[tour as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];
      expect(curr).toBeGreaterThanOrEqual(prev - TOL);
    }
  });

  it("tour 1 sits at identity so the first tour does not scale up", () => {
    expect(TOUR_TIER_SCALE[1]).toBeCloseTo(1.0, 9);
  });

  it("TOUR_TIER_SCALE is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(TOUR_TIER_SCALE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2c. Tour stipend (§23 catch-up mechanism #1, per Q-004)
// ---------------------------------------------------------------------------

/**
 * §23 "Tour stipend (catch-up mechanism #1)" verbatim. Pin against
 * `STIPEND_THRESHOLD_CREDITS` and `STIPEND_AMOUNT` from
 * `src/game/catchUp.ts`. Resolved by `Q-004` with the dot-spec
 * defaults; the F-035 slice (`feat/f-035-stipend-at-tour-entry`,
 * commit `927e797`) wires the lever into `enterTour`.
 */
const STIPEND_THRESHOLD_TARGET = 1500;
const STIPEND_AMOUNT_TARGET = 1000;

describe("§23 Tour stipend (catch-up mechanism #1)", () => {
  it("stipend threshold matches §23", () => {
    expect(STIPEND_THRESHOLD_CREDITS).toBe(STIPEND_THRESHOLD_TARGET);
  });

  it("stipend amount matches §23", () => {
    expect(STIPEND_AMOUNT).toBe(STIPEND_AMOUNT_TARGET);
  });

  it("stipend amount sits below the threshold so the lever stays a catch-up", () => {
    expect(STIPEND_AMOUNT_TARGET).toBeLessThan(STIPEND_THRESHOLD_TARGET);
  });
});

// ---------------------------------------------------------------------------
// 2d. Repair cap (§23 catch-up mechanism #2, per Q-005)
// ---------------------------------------------------------------------------

/**
 * §23 "Repair cap (catch-up mechanism #2)" verbatim. Pin against
 * `REPAIR_CAP_FRACTION` from `src/game/catchUp.ts`. Resolved by
 * `Q-005` with the dot-spec defaults; the F-036 consumer slice
 * (`feat/wire-capped-repair-cost`, commit `3ed8720`) wires
 * `cappedRepairCost` into `applyRepairCost`.
 *
 * The §23 row pins four parameters: the fraction itself, the
 * essential-only repair-kind gate, the easy / normal / novice
 * difficulty gate, and the zero-income clamp behaviour. The
 * fraction is the only numeric lever the balancing pass would tune;
 * the three gates are protocol invariants that a future loop should
 * not flip without re-opening Q-005.
 */
const REPAIR_CAP_FRACTION_TARGET = 0.4;

describe("§23 Repair cap (catch-up mechanism #2)", () => {
  it("essential-repair cap fraction matches §23", () => {
    expect(REPAIR_CAP_FRACTION).toBeCloseTo(REPAIR_CAP_FRACTION_TARGET, 9);
  });

  it("fraction stays in the (0, 1) range so the cap is a discount not a free repair", () => {
    expect(REPAIR_CAP_FRACTION_TARGET).toBeGreaterThan(0);
    expect(REPAIR_CAP_FRACTION_TARGET).toBeLessThan(1);
  });

  it("essential repair on easy / normal / novice clamps to fraction of race income", () => {
    for (const difficulty of ["easy", "normal", "novice"] as const) {
      const result = cappedRepairCost(5000, 4000, "essential", difficulty);
      expect(result).toBe(Math.round(4000 * REPAIR_CAP_FRACTION_TARGET));
    }
  });

  it("essential repair on hard / master / extreme pays raw cost (cap excluded)", () => {
    for (const difficulty of ["hard", "master", "extreme"] as const) {
      const result = cappedRepairCost(5000, 4000, "essential", difficulty);
      expect(result).toBe(5000);
    }
  });

  it("full / cosmetic repair always pays raw cost regardless of difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard", "master"] as const) {
      const result = cappedRepairCost(5000, 4000, "full", difficulty);
      expect(result).toBe(5000);
    }
  });

  it("zero race income collapses the essential-repair cap to 0", () => {
    expect(cappedRepairCost(5000, 0, "essential", "normal")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2e. Easy-mode tour-clear bonus (§23 catch-up mechanism #3, per Q-006)
// ---------------------------------------------------------------------------

/**
 * §23 "Easy-mode tour-clear bonus (catch-up mechanism #3)" verbatim.
 * Pin against `EASY_MODE_TOUR_BONUS_FRACTION` from
 * `src/game/catchUp.ts`. Resolved by `Q-006` with the dot-spec
 * default; the F-037 consumer slice (wire `easyModeBonus` into the
 * tour-clear bonus payout) is still owed and will append a sibling
 * `bonuses` entry alongside `tourBonus` so the §20 receipt renders
 * the easy-mode bonus on its own line.
 *
 * The §23 row pins four parameters: the fraction itself, the
 * `easy`-only difficulty gate, the negative-entry policy, and the
 * empty tour-complete clamp. The fraction is the only numeric lever
 * the balancing pass would tune; the three gates are protocol
 * invariants that a future loop should not flip without re-opening
 * Q-006.
 */
const EASY_MODE_TOUR_BONUS_FRACTION_TARGET = 0.2;

function freshSaveForBonus(): SaveGame {
  return JSON.parse(JSON.stringify(defaultSave())) as SaveGame;
}

describe("§23 Easy-mode tour-clear bonus (catch-up mechanism #3)", () => {
  it("easy-mode tour-clear bonus fraction matches §23", () => {
    expect(EASY_MODE_TOUR_BONUS_FRACTION).toBeCloseTo(
      EASY_MODE_TOUR_BONUS_FRACTION_TARGET,
      9,
    );
  });

  it("fraction stays in the (0, 1) range so the bonus is a catch-up not a free win", () => {
    expect(EASY_MODE_TOUR_BONUS_FRACTION_TARGET).toBeGreaterThan(0);
    expect(EASY_MODE_TOUR_BONUS_FRACTION_TARGET).toBeLessThan(1);
  });

  it("easy preset receives the fraction of summed race rewards", () => {
    const save = freshSaveForBonus();
    save.settings.difficultyPreset = "easy";
    const rewards = [1000, 800, 600, 400];
    const sum = rewards.reduce((a, b) => a + b, 0);
    expect(easyModeBonus(save, rewards)).toBe(
      Math.round(sum * EASY_MODE_TOUR_BONUS_FRACTION_TARGET),
    );
  });

  it("normal / hard / master presets pay no easy-mode bonus", () => {
    for (const preset of ["normal", "hard", "master"] as const) {
      const save = freshSaveForBonus();
      save.settings.difficultyPreset = preset;
      expect(easyModeBonus(save, [1000, 800, 600])).toBe(0);
    }
  });

  it("undefined difficulty preset (legacy v1 save) pays no easy-mode bonus", () => {
    const save = freshSaveForBonus();
    save.settings.difficultyPreset = undefined;
    expect(easyModeBonus(save, [1000, 800, 600])).toBe(0);
  });

  it("ignores negative race rewards rather than clawing back the bonus", () => {
    const save = freshSaveForBonus();
    save.settings.difficultyPreset = "easy";
    expect(easyModeBonus(save, [1000, -500, 800])).toBe(
      Math.round((1000 + 800) * EASY_MODE_TOUR_BONUS_FRACTION_TARGET),
    );
  });

  it("empty tour-complete rewards collapses the bonus to 0", () => {
    const save = freshSaveForBonus();
    save.settings.difficultyPreset = "easy";
    expect(easyModeBonus(save, [])).toBe(0);
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
// 4. Weather modifiers (§23)
// ---------------------------------------------------------------------------

/**
 * §23 "Weather modifiers" verbatim. Pin against
 * `WEATHER_TIRE_MODIFIERS` from `src/game/weather.ts`. Keyed by the
 * §23 schema-name subset so the cross-check is a direct lookup.
 *
 * The §23 row labels ("Clear", "Rain", "Heavy rain", "Snow", "Fog")
 * map onto the `WeatherOption` schema enum values (`clear`, `rain`,
 * `heavy_rain`, `snow`, `fog`). The other three `WeatherOption`
 * values (`light_rain`, `dusk`, `night`) are not part of §23 and are
 * deliberately not pinned here. See Q-008.
 */
const WEATHER_MODIFIER_TARGETS: Readonly<
  Record<WeatherTireModifierKey, { dryTireMod: number; wetTireMod: number }>
> = {
  clear: { dryTireMod: 0.08, wetTireMod: 0 },
  rain: { dryTireMod: -0.12, wetTireMod: 0.1 },
  heavy_rain: { dryTireMod: -0.2, wetTireMod: 0.16 },
  snow: { dryTireMod: -0.18, wetTireMod: 0.14 },
  fog: { dryTireMod: 0, wetTireMod: 0 },
};

describe("§23 Weather modifiers", () => {
  it.each(
    WEATHER_TIRE_MODIFIER_KEYS.map(
      (key) => [key, WEATHER_MODIFIER_TARGETS[key]] as const,
    ),
  )("%s row matches the §23 table", (key, expected) => {
    const row = WEATHER_TIRE_MODIFIERS[key];
    expect(row.dryTireMod).toBeCloseTo(expected.dryTireMod, 9);
    expect(row.wetTireMod).toBeCloseTo(expected.wetTireMod, 9);
  });

  it("dryTireMod walks Clear -> Rain -> Heavy rain monotonically down", () => {
    expect(WEATHER_TIRE_MODIFIERS.clear.dryTireMod).toBeGreaterThanOrEqual(
      WEATHER_TIRE_MODIFIERS.rain.dryTireMod - TOL,
    );
    expect(WEATHER_TIRE_MODIFIERS.rain.dryTireMod).toBeGreaterThanOrEqual(
      WEATHER_TIRE_MODIFIERS.heavy_rain.dryTireMod - TOL,
    );
  });

  it("wetTireMod walks Clear -> Rain -> Heavy rain monotonically up", () => {
    expect(WEATHER_TIRE_MODIFIERS.clear.wetTireMod).toBeLessThanOrEqual(
      WEATHER_TIRE_MODIFIERS.rain.wetTireMod + TOL,
    );
    expect(WEATHER_TIRE_MODIFIERS.rain.wetTireMod).toBeLessThanOrEqual(
      WEATHER_TIRE_MODIFIERS.heavy_rain.wetTireMod + TOL,
    );
  });

  it("Fog is grip-neutral on both tire types per §23", () => {
    expect(WEATHER_TIRE_MODIFIERS.fog.dryTireMod).toBeCloseTo(0, 9);
    expect(WEATHER_TIRE_MODIFIERS.fog.wetTireMod).toBeCloseTo(0, 9);
  });

  it("WEATHER_TIRE_MODIFIERS is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(WEATHER_TIRE_MODIFIERS)).toBe(true);
    for (const key of WEATHER_TIRE_MODIFIER_KEYS) {
      expect(Object.isFrozen(WEATHER_TIRE_MODIFIERS[key])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. CPU difficulty modifiers (§23)
// ---------------------------------------------------------------------------

/**
 * §23 "CPU difficulty modifiers" verbatim. Pin against
 * `CPU_DIFFICULTY_MODIFIERS` from `src/game/aiDifficulty.ts`. Keyed by
 * the §15 four-tier `PlayerDifficultyPreset` ladder so the cross-check
 * is a direct lookup.
 */
const CPU_DIFFICULTY_TARGETS: Readonly<
  Record<
    PlayerDifficultyPreset,
    { paceScalar: number; recoveryScalar: number; mistakeScalar: number }
  >
> = {
  easy: { paceScalar: 0.92, recoveryScalar: 0.95, mistakeScalar: 1.4 },
  normal: { paceScalar: 1.0, recoveryScalar: 1.0, mistakeScalar: 1.0 },
  hard: { paceScalar: 1.05, recoveryScalar: 1.03, mistakeScalar: 0.7 },
  master: { paceScalar: 1.09, recoveryScalar: 1.05, mistakeScalar: 0.45 },
};

describe("§23 CPU difficulty modifiers", () => {
  it.each(
    (Object.keys(CPU_DIFFICULTY_TARGETS) as ReadonlyArray<
      PlayerDifficultyPreset
    >).map((tier) => [tier, CPU_DIFFICULTY_TARGETS[tier]] as const),
  )("%s row matches the §23 table", (tier, expected) => {
    const row = CPU_DIFFICULTY_MODIFIERS[tier];
    expect(row.paceScalar).toBeCloseTo(expected.paceScalar, 9);
    expect(row.recoveryScalar).toBeCloseTo(expected.recoveryScalar, 9);
    expect(row.mistakeScalar).toBeCloseTo(expected.mistakeScalar, 9);
  });

  it("paceScalar is monotonically non-decreasing across the ladder", () => {
    const ladder: ReadonlyArray<PlayerDifficultyPreset> = [
      "easy",
      "normal",
      "hard",
      "master",
    ];
    for (let i = 1; i < ladder.length; i += 1) {
      const prev = CPU_DIFFICULTY_MODIFIERS[ladder[i - 1]!];
      const curr = CPU_DIFFICULTY_MODIFIERS[ladder[i]!];
      expect(curr.paceScalar).toBeGreaterThanOrEqual(prev.paceScalar - TOL);
    }
  });

  it("mistakeScalar is monotonically non-increasing across the ladder", () => {
    const ladder: ReadonlyArray<PlayerDifficultyPreset> = [
      "easy",
      "normal",
      "hard",
      "master",
    ];
    for (let i = 1; i < ladder.length; i += 1) {
      const prev = CPU_DIFFICULTY_MODIFIERS[ladder[i - 1]!];
      const curr = CPU_DIFFICULTY_MODIFIERS[ladder[i]!];
      expect(curr.mistakeScalar).toBeLessThanOrEqual(prev.mistakeScalar + TOL);
    }
  });

  it("Normal sits at identity for every column", () => {
    const normal = CPU_DIFFICULTY_MODIFIERS.normal;
    expect(normal.paceScalar).toBeCloseTo(1, 9);
    expect(normal.recoveryScalar).toBeCloseTo(1, 9);
    expect(normal.mistakeScalar).toBeCloseTo(1, 9);
  });

  it("CPU_DIFFICULTY_MODIFIERS is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(CPU_DIFFICULTY_MODIFIERS)).toBe(true);
    for (const tier of Object.keys(CPU_DIFFICULTY_MODIFIERS) as ReadonlyArray<
      PlayerDifficultyPreset
    >) {
      expect(Object.isFrozen(CPU_DIFFICULTY_MODIFIERS[tier])).toBe(true);
    }
  });
});
