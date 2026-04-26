/**
 * Unit tests for `src/game/damageBands.ts`.
 *
 * Covers the dot's verify list:
 * - Boundary values (0, 24, 25, 49, 50, 74, 75, 99, 100) produce the
 *   documented scalar tuples (snapshot per band).
 * - Monotonic invariants: stability, gripScalar, topSpeedScalar, and
 *   nitroEfficiency are non-increasing as damage rises;
 *   spinRiskMultiplier is non-decreasing.
 * - Out-of-range inputs (NaN, -1, 101, +Infinity) clamp into the
 *   nearest band without throwing.
 * - Determinism: same damagePercent always returns deep-equal scalars
 *   across many calls (no Math.random / Date.now leakage).
 * - Physics integration: a car at 80% damage has measurably reduced top
 *   speed and grip versus a 0% damage car under identical inputs.
 *
 * AGENTS.md RULE 8: float comparisons use `toBeCloseTo`.
 */

import { describe, expect, it } from "vitest";

import type { CarBaseStats } from "@/data/schemas";
import {
  DAMAGE_BANDS,
  MAX_SPIN_RISK_MULTIPLIER,
  PRISTINE_SCALARS,
  getDamageBand,
  getDamageScalars,
  type DamageBand,
  type DamageScalars,
} from "../damageBands";
import { NEUTRAL_INPUT, type Input } from "../input";
import { DEFAULT_TRACK_CONTEXT, INITIAL_CAR_STATE, step } from "../physics";

const TOL = 1e-9;

const STARTER_STATS: CarBaseStats = Object.freeze({
  topSpeed: 61,
  accel: 16,
  brake: 28,
  gripDry: 1,
  gripWet: 0.82,
  stability: 1,
  durability: 0.95,
  nitroEfficiency: 1,
});

const DT = 1 / 60;

function withInput(overrides: Partial<Input>): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

describe("PRISTINE_SCALARS", () => {
  it("is the identity scalar set", () => {
    expect(PRISTINE_SCALARS.stability).toBe(1);
    expect(PRISTINE_SCALARS.gripScalar).toBe(1);
    expect(PRISTINE_SCALARS.topSpeedScalar).toBe(1);
    expect(PRISTINE_SCALARS.nitroEfficiency).toBe(1);
    expect(PRISTINE_SCALARS.spinRiskMultiplier).toBe(1);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(PRISTINE_SCALARS)).toBe(true);
  });
});

describe("DAMAGE_BANDS table", () => {
  it("covers exactly five bands ordered from 0 to 100", () => {
    expect(DAMAGE_BANDS.map((b) => b.min)).toEqual([0, 25, 50, 75, 100]);
  });

  it("each band entry is frozen", () => {
    for (const band of DAMAGE_BANDS) {
      expect(Object.isFrozen(band)).toBe(true);
      expect(Object.isFrozen(band.scalars)).toBe(true);
    }
  });

  it("0-band is the identity per §10 cosmetic-only narrative", () => {
    const band = DAMAGE_BANDS[0];
    expect(band).toBeDefined();
    expect(band?.scalars).toEqual(PRISTINE_SCALARS);
  });
});

describe("getDamageScalars boundary values", () => {
  // The dot lists 9 boundaries: 0, 24, 25, 49, 50, 74, 75, 99, 100.
  // For each, snapshot the documented tuple. The values pin the §10 +
  // §13 design intent: cosmetic-only at 0..24, stability/nitro hits at
  // 25..49, grip + top speed losses at 50..74, heavy losses at 75..99,
  // catastrophic at 100.

  it("0% returns the pristine identity", () => {
    expect(getDamageScalars(0)).toEqual({
      stability: 1,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 1,
      spinRiskMultiplier: 1,
    });
  });

  it("24% stays in the cosmetic band", () => {
    expect(getDamageScalars(24)).toEqual({
      stability: 1,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 1,
      spinRiskMultiplier: 1,
    });
  });

  it("25% enters the light band (>= rule)", () => {
    expect(getDamageScalars(25)).toEqual({
      stability: 0.92,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 0.9,
      spinRiskMultiplier: 1,
    });
  });

  it("49% stays in the light band", () => {
    expect(getDamageScalars(49)).toEqual({
      stability: 0.92,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 0.9,
      spinRiskMultiplier: 1,
    });
  });

  it("50% enters the moderate band", () => {
    expect(getDamageScalars(50)).toEqual({
      stability: 0.8,
      gripScalar: 0.85,
      topSpeedScalar: 0.92,
      nitroEfficiency: 0.8,
      spinRiskMultiplier: 1.5,
    });
  });

  it("74% stays in the moderate band", () => {
    expect(getDamageScalars(74)).toEqual({
      stability: 0.8,
      gripScalar: 0.85,
      topSpeedScalar: 0.92,
      nitroEfficiency: 0.8,
      spinRiskMultiplier: 1.5,
    });
  });

  it("75% enters the severe band", () => {
    expect(getDamageScalars(75)).toEqual({
      stability: 0.6,
      gripScalar: 0.7,
      topSpeedScalar: 0.78,
      nitroEfficiency: 0.6,
      spinRiskMultiplier: 2.5,
    });
  });

  it("99% stays in the severe band", () => {
    expect(getDamageScalars(99)).toEqual({
      stability: 0.6,
      gripScalar: 0.7,
      topSpeedScalar: 0.78,
      nitroEfficiency: 0.6,
      spinRiskMultiplier: 2.5,
    });
  });

  it("100% enters the catastrophic band", () => {
    expect(getDamageScalars(100)).toEqual({
      stability: 0.45,
      gripScalar: 0.55,
      topSpeedScalar: 0.55,
      nitroEfficiency: 0.4,
      spinRiskMultiplier: MAX_SPIN_RISK_MULTIPLIER,
    });
  });
});

describe("getDamageScalars boundary edge cases", () => {
  it("treats 24.999 as still in the cosmetic band", () => {
    expect(getDamageScalars(24.999).stability).toBe(1);
  });

  it("treats 25.000 as already in the light band per the inclusive-min rule", () => {
    expect(getDamageScalars(25).stability).toBeCloseTo(0.92, 9);
    expect(getDamageScalars(25.0001).stability).toBeCloseTo(0.92, 9);
  });

  it("treats 50.000 as already in the moderate band", () => {
    expect(getDamageScalars(50).gripScalar).toBeCloseTo(0.85, 9);
  });

  it("treats 75.000 as already in the severe band", () => {
    expect(getDamageScalars(75).topSpeedScalar).toBeCloseTo(0.78, 9);
  });
});

describe("monotonic invariants", () => {
  // Walk the integer percent range and check that each scalar that the
  // §10 narrative says "decays" is non-increasing as damage rises, and
  // that spin risk is non-decreasing.

  function snapshot(percent: number) {
    return getDamageScalars(percent);
  }

  it("stability is non-increasing across 0..100", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let p = 0; p <= 100; p += 1) {
      const v = snapshot(p).stability;
      expect(v).toBeLessThanOrEqual(prev + TOL);
      prev = v;
    }
  });

  it("gripScalar is non-increasing across 0..100", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let p = 0; p <= 100; p += 1) {
      const v = snapshot(p).gripScalar;
      expect(v).toBeLessThanOrEqual(prev + TOL);
      prev = v;
    }
  });

  it("topSpeedScalar is non-increasing across 0..100", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let p = 0; p <= 100; p += 1) {
      const v = snapshot(p).topSpeedScalar;
      expect(v).toBeLessThanOrEqual(prev + TOL);
      prev = v;
    }
  });

  it("nitroEfficiency is non-increasing across 0..100", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let p = 0; p <= 100; p += 1) {
      const v = snapshot(p).nitroEfficiency;
      expect(v).toBeLessThanOrEqual(prev + TOL);
      prev = v;
    }
  });

  it("spinRiskMultiplier is non-decreasing across 0..100", () => {
    let prev = Number.NEGATIVE_INFINITY;
    for (let p = 0; p <= 100; p += 1) {
      const v = snapshot(p).spinRiskMultiplier;
      expect(v).toBeGreaterThanOrEqual(prev - TOL);
      prev = v;
    }
  });

  it("spinRiskMultiplier never exceeds the pinned ceiling", () => {
    for (let p = 0; p <= 100; p += 1) {
      expect(snapshot(p).spinRiskMultiplier).toBeLessThanOrEqual(MAX_SPIN_RISK_MULTIPLIER);
    }
  });
});

describe("out-of-range inputs clamp without throwing", () => {
  it("NaN clamps to the pristine band", () => {
    expect(getDamageScalars(Number.NaN)).toEqual(PRISTINE_SCALARS);
  });

  it("negative values clamp to 0", () => {
    expect(getDamageScalars(-1)).toEqual(PRISTINE_SCALARS);
    expect(getDamageScalars(-1000)).toEqual(PRISTINE_SCALARS);
  });

  it("values past 100 clamp to 100 (catastrophic)", () => {
    expect(getDamageScalars(101).topSpeedScalar).toBeCloseTo(0.55, 9);
    expect(getDamageScalars(1e6).topSpeedScalar).toBeCloseTo(0.55, 9);
  });

  it("Infinity clamps to 100", () => {
    expect(getDamageScalars(Number.POSITIVE_INFINITY).topSpeedScalar).toBeCloseTo(0.55, 9);
  });

  it("never throws on pathological inputs", () => {
    expect(() => getDamageScalars(Number.NaN)).not.toThrow();
    expect(() => getDamageScalars(Number.POSITIVE_INFINITY)).not.toThrow();
    expect(() => getDamageScalars(Number.NEGATIVE_INFINITY)).not.toThrow();
  });
});

describe("determinism", () => {
  it("returns deep-equal scalars across many calls", () => {
    const reference = getDamageScalars(60);
    for (let i = 0; i < 1000; i += 1) {
      expect(getDamageScalars(60)).toEqual(reference);
    }
  });

  it("returns a fresh object each call so callers cannot mutate the table", () => {
    const a = getDamageScalars(50);
    a.stability = 0; // mutation should not affect future calls
    const b = getDamageScalars(50);
    expect(b.stability).toBeCloseTo(0.8, 9);
  });

  it("never reads Date.now or Math.random across many percents", () => {
    // Sanity: build a snapshot table and recompute it; full equality
    // both directions confirms there is no time / RNG leakage in the
    // lookup.
    const first: DamageScalars[] = [];
    const second: DamageScalars[] = [];
    for (let p = 0; p <= 100; p += 1) first.push(getDamageScalars(p));
    for (let p = 0; p <= 100; p += 1) second.push(getDamageScalars(p));
    expect(first).toEqual(second);
  });
});

describe("getDamageBand", () => {
  it("maps every band to its name", () => {
    const cases: Array<[number, DamageBand]> = [
      [0, "pristine"],
      [24, "pristine"],
      [25, "light"],
      [49, "light"],
      [50, "moderate"],
      [74, "moderate"],
      [75, "severe"],
      [99, "severe"],
      [100, "catastrophic"],
    ];
    for (const [percent, expected] of cases) {
      expect(getDamageBand(percent)).toBe(expected);
    }
  });

  it("clamps out-of-range inputs", () => {
    expect(getDamageBand(-50)).toBe("pristine");
    expect(getDamageBand(200)).toBe("catastrophic");
    expect(getDamageBand(Number.NaN)).toBe("pristine");
  });
});

describe("physics step integration", () => {
  // The dot's verify item: "a car at 80% damage has measurably reduced
  // top speed and grip vs. a 0% damage car under identical inputs."

  function rollForward(damagePercent: number, steps: number, input: Input) {
    const scalars = getDamageScalars(damagePercent);
    let s = INITIAL_CAR_STATE;
    for (let i = 0; i < steps; i += 1) {
      s = step(s, input, STARTER_STATS, DEFAULT_TRACK_CONTEXT, DT, {
        damageScalars: scalars,
      });
    }
    return s;
  }

  it("reduces achievable top speed at 80% damage relative to pristine", () => {
    // Roll long enough that both reach their respective top-speed caps.
    const fullThrottle = withInput({ throttle: 1 });
    const pristine = rollForward(0, 600, fullThrottle);
    const damaged = rollForward(80, 600, fullThrottle);
    // Pristine should reach the §10 starter top speed (61 m/s).
    expect(pristine.speed).toBeCloseTo(STARTER_STATS.topSpeed, 5);
    // Severe-band topSpeedScalar is 0.78; damaged cap = 61 * 0.78 = 47.58.
    expect(damaged.speed).toBeCloseTo(STARTER_STATS.topSpeed * 0.78, 5);
    expect(damaged.speed).toBeLessThan(pristine.speed);
  });

  it("reduces lateral movement at 80% damage relative to pristine", () => {
    // At equal speed the damaged car should drift less per tick because
    // grip is multiplied by the band's `gripScalar` (severe = 0.7).
    // Construct the same starting speed for both so the comparison is
    // grip-only, not speed-confounded.
    const startedAt30 = { ...INITIAL_CAR_STATE, speed: 30 };
    const steerOnly = withInput({ steer: 1 });
    const pristineScalars = getDamageScalars(0);
    const damagedScalars = getDamageScalars(80);
    const pristineNext = step(
      startedAt30,
      steerOnly,
      STARTER_STATS,
      DEFAULT_TRACK_CONTEXT,
      DT,
      { damageScalars: pristineScalars },
    );
    const damagedNext = step(
      startedAt30,
      steerOnly,
      STARTER_STATS,
      DEFAULT_TRACK_CONTEXT,
      DT,
      { damageScalars: damagedScalars },
    );
    expect(Math.abs(damagedNext.x)).toBeLessThan(Math.abs(pristineNext.x));
    // The ratio should match the band's gripScalar (0.7) under identical
    // inputs and identical pre-step speed.
    expect(Math.abs(damagedNext.x) / Math.abs(pristineNext.x)).toBeCloseTo(0.7, 5);
  });

  it("omitted damageScalars defaults to pristine behaviour (back-compat)", () => {
    const fullThrottle = withInput({ throttle: 1 });
    let withDefault = INITIAL_CAR_STATE;
    let withPristine = INITIAL_CAR_STATE;
    for (let i = 0; i < 600; i += 1) {
      withDefault = step(withDefault, fullThrottle, STARTER_STATS, DEFAULT_TRACK_CONTEXT, DT);
      withPristine = step(
        withPristine,
        fullThrottle,
        STARTER_STATS,
        DEFAULT_TRACK_CONTEXT,
        DT,
        { damageScalars: PRISTINE_SCALARS },
      );
    }
    expect(withDefault.speed).toBeCloseTo(withPristine.speed, 9);
    expect(withDefault.x).toBeCloseTo(withPristine.x, 9);
  });
});
