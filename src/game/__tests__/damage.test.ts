/**
 * Unit tests for `src/game/damage.ts`.
 *
 * Covers the dot's verify list:
 * - Per-zone hit accumulation (cell-by-cell against the §23 mid-range
 *   pin and the `DEFAULT_ZONE_DISTRIBUTION` table).
 * - Per-zone clamp at 1.0 (no bleed into other zones).
 * - Performance falloff curve (linear, exact pin at engine=0.5 -> 0.775).
 * - Body damage never degrades performance directly.
 * - Wreck threshold (`isWrecked`) trips on full damage and not on tires
 *   alone; weighted total stays in `[0, 1]`.
 * - Repair cost is zero on a clean zone.
 * - Determinism (1000 invocations produce deep-equal output).
 * - Idempotent no-op hit (zero magnitude or zero speed factor).
 * - Off-road persistent accumulator matches a mid-speed carHit's body
 *   damage within 5%.
 *
 * AGENTS.md RULE 8: float comparisons use `toBeCloseTo`.
 */

import { describe, expect, it } from "vitest";

import {
  applyHit,
  applyOffRoadDamage,
  createDamageState,
  DAMAGE_UNIT_SCALE,
  DEFAULT_ZONE_DISTRIBUTION,
  isWrecked,
  OFF_ROAD_DAMAGE_PER_M,
  PERFORMANCE_FLOOR,
  PRISTINE_DAMAGE_STATE,
  performanceMultiplier,
  REPAIR_BASE_COST_CREDITS,
  repairCostFor,
  TOTAL_DAMAGE_WEIGHTS,
  totalRepairCost,
  WRECK_THRESHOLD,
  type DamageState,
  type HitEvent,
} from "../damage";

const TOL = 1e-6;

function rub(over: Partial<HitEvent> = {}): HitEvent {
  return { kind: "rub", baseMagnitude: 3, speedFactor: 0.5, ...over };
}

function carHit(over: Partial<HitEvent> = {}): HitEvent {
  return { kind: "carHit", baseMagnitude: 9, speedFactor: 1, ...over };
}

describe("PRISTINE_DAMAGE_STATE", () => {
  it("starts at zero in every zone with zero total", () => {
    expect(PRISTINE_DAMAGE_STATE.zones.engine).toBe(0);
    expect(PRISTINE_DAMAGE_STATE.zones.tires).toBe(0);
    expect(PRISTINE_DAMAGE_STATE.zones.body).toBe(0);
    expect(PRISTINE_DAMAGE_STATE.total).toBe(0);
    expect(PRISTINE_DAMAGE_STATE.offRoadAccumSeconds).toBe(0);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(PRISTINE_DAMAGE_STATE)).toBe(true);
    expect(Object.isFrozen(PRISTINE_DAMAGE_STATE.zones)).toBe(true);
  });
});

describe("DEFAULT_ZONE_DISTRIBUTION", () => {
  it("sums to 1.0 per kind so totalIncrement is conserved across zones", () => {
    for (const kind of Object.keys(DEFAULT_ZONE_DISTRIBUTION) as Array<
      keyof typeof DEFAULT_ZONE_DISTRIBUTION
    >) {
      const dist = DEFAULT_ZONE_DISTRIBUTION[kind];
      const sum = dist.engine + dist.tires + dist.body;
      expect(sum).toBeCloseTo(1, 6);
    }
  });
});

describe("TOTAL_DAMAGE_WEIGHTS", () => {
  it("sums to 1.0 so total stays in [0, 1] for valid zones", () => {
    const sum = TOTAL_DAMAGE_WEIGHTS.engine + TOTAL_DAMAGE_WEIGHTS.tires + TOTAL_DAMAGE_WEIGHTS.body;
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("applyHit (rub, mid-range)", () => {
  it("distributes damage by the rub row and §23 mid-range magnitude", () => {
    // baseMagnitude=3, speedFactor=0.5 -> totalIncrement = 0.015
    // engine = 0.015 * 0.05 = 0.00075
    // tires  = 0.015 * 0.50 = 0.00750
    // body   = 0.015 * 0.45 = 0.00675
    const next = applyHit(PRISTINE_DAMAGE_STATE, rub());
    expect(next.zones.engine).toBeCloseTo(0.00075, 6);
    expect(next.zones.tires).toBeCloseTo(0.0075, 6);
    expect(next.zones.body).toBeCloseTo(0.00675, 6);
  });

  it("recomputes the weighted total after the hit", () => {
    const next = applyHit(PRISTINE_DAMAGE_STATE, rub());
    const expected =
      next.zones.engine * TOTAL_DAMAGE_WEIGHTS.engine +
      next.zones.tires * TOTAL_DAMAGE_WEIGHTS.tires +
      next.zones.body * TOTAL_DAMAGE_WEIGHTS.body;
    expect(next.total).toBeCloseTo(expected, 6);
  });

  it("returns a fresh state without mutating the input", () => {
    const before = createDamageState({ engine: 0.1 });
    const beforeSnapshot = JSON.parse(JSON.stringify(before)) as unknown;
    applyHit(before, rub());
    expect(JSON.parse(JSON.stringify(before))).toEqual(beforeSnapshot);
  });
});

describe("applyHit (clamping behaviour)", () => {
  it("clamps per-zone damage at 1.0 and does not bleed into other zones", () => {
    const half = createDamageState({ engine: 0.95, tires: 0.1, body: 0.1 });
    // carHit with baseMagnitude=9, speedFactor=1 -> totalIncrement = 0.09
    // engine bias 0.20 -> +0.018, would land at 0.968 (no clamp).
    // Push much harder: baseMagnitude = 100 to force clamp.
    const next = applyHit(half, { kind: "carHit", baseMagnitude: 100, speedFactor: 1 });
    // total inc = 1.0; engine adds 0.20, tires 0.30, body 0.50.
    // engine: 0.95 + 0.20 = 1.15 -> clamps to 1.0 (overflow 0.15 NOT bled).
    expect(next.zones.engine).toBe(1);
    expect(next.zones.tires).toBeCloseTo(0.4, 6);
    expect(next.zones.body).toBeCloseTo(0.6, 6);
  });

  it("ignores baseMagnitude=0 (no-op tick)", () => {
    const before = createDamageState({ engine: 0.3 });
    const after = applyHit(before, { kind: "rub", baseMagnitude: 0, speedFactor: 1 });
    expect(after.zones).toEqual(before.zones);
    expect(after.total).toBeCloseTo(before.total, 6);
  });

  it("ignores speedFactor=0 (touching, not crashing)", () => {
    const before = createDamageState({ tires: 0.4 });
    const after = applyHit(before, { kind: "wallHit", baseMagnitude: 24, speedFactor: 0 });
    expect(after.zones).toEqual(before.zones);
  });

  it("clamps speedFactor above 1 to 1", () => {
    const a = applyHit(PRISTINE_DAMAGE_STATE, carHit({ speedFactor: 1 }));
    const b = applyHit(PRISTINE_DAMAGE_STATE, carHit({ speedFactor: 5 }));
    expect(b.zones).toEqual(a.zones);
  });

  it("ignores negative baseMagnitude (no health regen)", () => {
    const before = createDamageState({ body: 0.3 });
    const after = applyHit(before, { kind: "rub", baseMagnitude: -5, speedFactor: 1 });
    expect(after.zones).toEqual(before.zones);
  });

  it("honours zoneOverride when provided", () => {
    const next = applyHit(PRISTINE_DAMAGE_STATE, {
      kind: "carHit",
      baseMagnitude: 10,
      speedFactor: 1,
      zoneOverride: { engine: 1, tires: 0, body: 0 },
    });
    // total inc = 0.1, all to engine.
    expect(next.zones.engine).toBeCloseTo(0.1, 6);
    expect(next.zones.tires).toBe(0);
    expect(next.zones.body).toBe(0);
  });
});

describe("performanceMultiplier", () => {
  it("returns 1.0 at zero damage for every zone", () => {
    expect(performanceMultiplier("engine", 0)).toBe(1);
    expect(performanceMultiplier("tires", 0)).toBe(1);
    expect(performanceMultiplier("body", 0)).toBe(1);
  });

  it("returns 0.775 at engine=0.5 (linear: 1 - 0.5 * (1 - 0.55))", () => {
    expect(performanceMultiplier("engine", 0.5)).toBeCloseTo(0.775, 6);
  });

  it("returns the per-zone floor at full damage (never zero)", () => {
    expect(performanceMultiplier("engine", 1)).toBeCloseTo(PERFORMANCE_FLOOR.engine, 6);
    expect(performanceMultiplier("tires", 1)).toBeCloseTo(PERFORMANCE_FLOOR.tires, 6);
    expect(performanceMultiplier("body", 1)).toBe(1);
    expect(PERFORMANCE_FLOOR.engine).toBeGreaterThan(0);
    expect(PERFORMANCE_FLOOR.tires).toBeGreaterThan(0);
  });

  it("clamps damage below 0 to 0 and above 1 to 1", () => {
    expect(performanceMultiplier("engine", -1)).toBe(1);
    expect(performanceMultiplier("engine", 2)).toBeCloseTo(PERFORMANCE_FLOOR.engine, 6);
  });
});

describe("isWrecked", () => {
  it("is true at WRECK_THRESHOLD and above", () => {
    expect(isWrecked({ zones: { engine: 1, tires: 1, body: 1 }, total: 1, offRoadAccumSeconds: 0 }))
      .toBe(true);
    expect(isWrecked({ zones: { engine: 0, tires: 0, body: 0 }, total: WRECK_THRESHOLD, offRoadAccumSeconds: 0 }))
      .toBe(true);
  });

  it("is false when only tires are fully damaged", () => {
    const tiresOnly = createDamageState({ tires: 1 });
    expect(tiresOnly.total).toBeCloseTo(TOTAL_DAMAGE_WEIGHTS.tires, 6);
    expect(isWrecked(tiresOnly)).toBe(false);
  });

  it("is false on the pristine state", () => {
    expect(isWrecked(PRISTINE_DAMAGE_STATE)).toBe(false);
  });

  it("trips when the weighted total crosses WRECK_THRESHOLD via cumulative hits", () => {
    let state: DamageState = PRISTINE_DAMAGE_STATE;
    for (let i = 0; i < 200; i += 1) {
      state = applyHit(state, { kind: "wallHit", baseMagnitude: 24, speedFactor: 1 });
    }
    expect(isWrecked(state)).toBe(true);
  });
});

describe("repairCostFor", () => {
  it("returns 0 on a clean zone (no UI prompt)", () => {
    expect(repairCostFor("engine", 0)).toBe(0);
    expect(repairCostFor("tires", 0)).toBe(0);
    expect(repairCostFor("body", 0)).toBe(0);
  });

  it("returns the base cost at 100% damage", () => {
    expect(repairCostFor("engine", 1)).toBe(REPAIR_BASE_COST_CREDITS.engine);
    expect(repairCostFor("tires", 1)).toBe(REPAIR_BASE_COST_CREDITS.tires);
    expect(repairCostFor("body", 1)).toBe(REPAIR_BASE_COST_CREDITS.body);
  });

  it("scales linearly with damage and rounds to integer credits", () => {
    expect(repairCostFor("engine", 0.5)).toBe(Math.round(0.5 * REPAIR_BASE_COST_CREDITS.engine));
    expect(repairCostFor("body", 0.25)).toBe(Math.round(0.25 * REPAIR_BASE_COST_CREDITS.body));
  });

  it("clamps damage to [0, 1]", () => {
    expect(repairCostFor("engine", -0.5)).toBe(0);
    expect(repairCostFor("engine", 5)).toBe(REPAIR_BASE_COST_CREDITS.engine);
  });
});

describe("totalRepairCost", () => {
  it("is zero on the pristine state", () => {
    expect(totalRepairCost(PRISTINE_DAMAGE_STATE)).toBe(0);
  });

  it("sums the per-zone costs at intermediate damage", () => {
    const state = createDamageState({ engine: 0.5, tires: 0.25, body: 0.1 });
    const expected =
      Math.round(0.5 * REPAIR_BASE_COST_CREDITS.engine) +
      Math.round(0.25 * REPAIR_BASE_COST_CREDITS.tires) +
      Math.round(0.1 * REPAIR_BASE_COST_CREDITS.body);
    expect(totalRepairCost(state)).toBe(expected);
  });
});

describe("applyOffRoadDamage", () => {
  it("is a no-op for dt <= 0 or non-finite inputs", () => {
    const before = createDamageState({ body: 0.1 });
    expect(applyOffRoadDamage(before, 60, 0).zones).toEqual(before.zones);
    expect(applyOffRoadDamage(before, 60, -1).zones).toEqual(before.zones);
    expect(applyOffRoadDamage(before, Number.NaN, 0.1).zones).toEqual(before.zones);
    expect(applyOffRoadDamage(before, 60, Number.POSITIVE_INFINITY).zones).toEqual(
      before.zones,
    );
  });

  it("is a no-op when the car is stationary", () => {
    const before = createDamageState({ body: 0.05 });
    const after = applyOffRoadDamage(before, 0, 1);
    expect(after.zones).toEqual(before.zones);
  });

  it("accumulates body damage proportional to speed * dt", () => {
    let state: DamageState = PRISTINE_DAMAGE_STATE;
    const dt = 1 / 60;
    const speed = 60; // m/s
    for (let i = 0; i < 60 * 5; i += 1) {
      state = applyOffRoadDamage(state, speed, dt);
    }
    // 5 s at 60 m/s = 300 m. totalIncrement = 0.000107 * 300 = 0.0321.
    // body share = 0.0321 * 0.7 = 0.02247.
    expect(state.zones.body).toBeCloseTo(0.02247, 4);
  });

  it("body damage from 5 s top-speed off-road equals a mid-speed carHit body share within 5%", () => {
    let offRoad: DamageState = PRISTINE_DAMAGE_STATE;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 5; i += 1) {
      offRoad = applyOffRoadDamage(offRoad, 60, dt);
    }
    const oneCarHit = applyHit(PRISTINE_DAMAGE_STATE, {
      kind: "carHit",
      baseMagnitude: 9,
      speedFactor: 0.5,
    });
    const ratio = offRoad.zones.body / oneCarHit.zones.body;
    expect(Math.abs(ratio - 1)).toBeLessThan(0.05);
  });

  it("tracks cumulative off-road seconds", () => {
    let state: DamageState = PRISTINE_DAMAGE_STATE;
    state = applyOffRoadDamage(state, 50, 0.5);
    state = applyOffRoadDamage(state, 50, 0.5);
    expect(state.offRoadAccumSeconds).toBeCloseTo(1, 6);
  });

  it("is a no-op for zero speed but advances offRoadAccumSeconds for non-zero", () => {
    const after = applyOffRoadDamage(PRISTINE_DAMAGE_STATE, 0, 1);
    expect(after.offRoadAccumSeconds).toBe(0);
  });
});

describe("determinism (AGENTS.md RULE 8)", () => {
  it("1000 invocations of applyHit produce deep-equal output", () => {
    const seed = createDamageState({ engine: 0.1 });
    const hit = rub();
    const ref = applyHit(seed, hit);
    for (let i = 0; i < 1000; i += 1) {
      const out = applyHit(seed, hit);
      expect(out).toEqual(ref);
    }
  });

  it("1000 invocations of applyOffRoadDamage produce deep-equal output", () => {
    const seed = createDamageState({ body: 0.05 });
    const ref = applyOffRoadDamage(seed, 50, 1 / 60);
    for (let i = 0; i < 1000; i += 1) {
      const out = applyOffRoadDamage(seed, 50, 1 / 60);
      expect(out).toEqual(ref);
    }
  });

  it("performanceMultiplier is pure", () => {
    const ref = performanceMultiplier("engine", 0.6);
    for (let i = 0; i < 100; i += 1) {
      expect(performanceMultiplier("engine", 0.6)).toBe(ref);
    }
  });
});

describe("createDamageState", () => {
  it("clamps inputs to [0, 1] and computes total", () => {
    const s = createDamageState({ engine: 1.5, tires: -0.2 });
    expect(s.zones.engine).toBe(1);
    expect(s.zones.tires).toBe(0);
    expect(s.zones.body).toBe(0);
    expect(s.total).toBeCloseTo(TOTAL_DAMAGE_WEIGHTS.engine, 6);
  });

  it("freezes the zones object so callers cannot mutate it", () => {
    const s = createDamageState({ engine: 0.3 });
    expect(Object.isFrozen(s.zones)).toBe(true);
  });
});

describe("constants surface", () => {
  it("DAMAGE_UNIT_SCALE pins the §23 raw-magnitude conversion", () => {
    expect(DAMAGE_UNIT_SCALE).toBe(100);
  });

  it("OFF_ROAD_DAMAGE_PER_M is positive and small", () => {
    expect(OFF_ROAD_DAMAGE_PER_M).toBeGreaterThan(0);
    expect(OFF_ROAD_DAMAGE_PER_M).toBeLessThan(0.01);
  });

  it("WRECK_THRESHOLD sits below 1.0 to allow a UI warning band", () => {
    expect(WRECK_THRESHOLD).toBeLessThan(1);
    expect(WRECK_THRESHOLD).toBeGreaterThan(0.5);
  });

  // Float tolerance hint: use TOL where exactness matters.
  it("computes wreck total at zone=1 within tolerance", () => {
    const s = createDamageState({ engine: 1, tires: 1, body: 1 });
    expect(Math.abs(s.total - 1)).toBeLessThan(TOL);
  });
});
