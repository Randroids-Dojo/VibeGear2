/**
 * Content tests for the MVP car set.
 *
 * Each car JSON under `src/data/cars/` must:
 * - validate against `CarSchema` from `docs/gdd/22-data-schemas.md`,
 * - carry stats that match `docs/gdd/23-balancing-tables.md` (the §23
 *   "Core car balance sheet" is the source of truth for topSpeed, accel,
 *   gripDry, gripWet, stability, durability, and nitroEfficiency),
 * - resolve to a unique id when looked up via the registry,
 * - declare a class drawn from §11 "Car classes".
 *
 * Adding a car: drop a JSON next to the others, register it in
 * `src/data/cars/index.ts`, then extend `EXPECTED_BALANCE` below if §23 has
 * a row for it. The starter-car invariant block guards the new-save flow.
 */

import { describe, expect, it } from "vitest";

import {
  CARS,
  CARS_BY_ID,
  STARTER_CAR_ID,
  getCar,
} from "@/data/cars";
import { CarSchema, type CarBaseStats } from "@/data/schemas";

/**
 * §23 "Core car balance sheet". `brake` is intentionally omitted because
 * §23 does not list it. Brake values live in the JSON and are checked by
 * the schema (positive number) rather than against §23.
 */
const EXPECTED_BALANCE: Record<string, Omit<CarBaseStats, "brake">> = {
  "sparrow-gt": {
    topSpeed: 61.0,
    accel: 16.0,
    gripDry: 1.0,
    gripWet: 0.82,
    stability: 1.0,
    durability: 0.95,
    nitroEfficiency: 1.0,
  },
  "breaker-s": {
    topSpeed: 58.0,
    accel: 16.5,
    gripDry: 1.08,
    gripWet: 0.9,
    stability: 1.05,
    durability: 0.92,
    nitroEfficiency: 0.95,
  },
  "vanta-xr": {
    topSpeed: 64.0,
    accel: 17.5,
    gripDry: 0.93,
    gripWet: 0.76,
    stability: 0.9,
    durability: 0.88,
    nitroEfficiency: 1.08,
  },
  "tempest-r": {
    topSpeed: 76.0,
    accel: 20.0,
    gripDry: 1.02,
    gripWet: 0.84,
    stability: 1.0,
    durability: 0.96,
    nitroEfficiency: 1.05,
  },
  "bastion-lm": {
    topSpeed: 72.0,
    accel: 18.0,
    gripDry: 1.0,
    gripWet: 0.86,
    stability: 1.08,
    durability: 1.12,
    nitroEfficiency: 0.96,
  },
  "nova-shade": {
    topSpeed: 82.0,
    accel: 22.0,
    gripDry: 0.95,
    gripWet: 0.78,
    stability: 0.92,
    durability: 0.9,
    nitroEfficiency: 1.12,
  },
};

const TOLERANCE = 1e-6;

describe("car catalogue", () => {
  it("exposes all six MVP cars from §11", () => {
    expect(CARS.length).toBe(6);
  });

  it("contains exactly the §11 + §23 ids", () => {
    const ids = CARS.map((c) => c.id).sort();
    expect(ids).toEqual(
      [
        "bastion-lm",
        "breaker-s",
        "nova-shade",
        "sparrow-gt",
        "tempest-r",
        "vanta-xr",
      ].sort(),
    );
  });

  it("indexes every car uniquely", () => {
    expect(CARS_BY_ID.size).toBe(CARS.length);
    for (const car of CARS) {
      expect(getCar(car.id)).toBe(car);
    }
  });

  it("designates `sparrow-gt` as the starter granted on new save", () => {
    const starter = getCar(STARTER_CAR_ID);
    expect(starter).toBeDefined();
    expect(starter?.purchasePrice).toBe(0);
  });

  it("has exactly one starter (purchasePrice === 0)", () => {
    const starters = CARS.filter((c) => c.purchasePrice === 0);
    expect(starters.length).toBe(1);
    expect(starters[0]?.id).toBe(STARTER_CAR_ID);
  });
});

describe.each(CARS.map((car) => [car.id, car] as const))(
  "car JSON: %s",
  (_id, car) => {
    it("validates against CarSchema", () => {
      const result = CarSchema.safeParse(car);
      if (!result.success) {
        // Surface the issues in the test output for fast diagnosis.
        throw new Error(
          `CarSchema rejected ${car.id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });

    it("matches the §23 balancing-table row", () => {
      const expected = EXPECTED_BALANCE[car.id];
      expect(expected).toBeDefined();
      if (!expected) return;
      expect(car.baseStats.topSpeed).toBeCloseTo(expected.topSpeed, 5);
      expect(car.baseStats.accel).toBeCloseTo(expected.accel, 5);
      expect(car.baseStats.gripDry).toBeCloseTo(expected.gripDry, 5);
      expect(car.baseStats.gripWet).toBeCloseTo(expected.gripWet, 5);
      expect(car.baseStats.stability).toBeCloseTo(expected.stability, 5);
      expect(car.baseStats.durability).toBeCloseTo(expected.durability, 5);
      expect(car.baseStats.nitroEfficiency).toBeCloseTo(
        expected.nitroEfficiency,
        5,
      );
    });

    it("has a positive brake value", () => {
      expect(car.baseStats.brake).toBeGreaterThan(TOLERANCE);
    });

    it("declares non-negative upgrade caps for every category", () => {
      for (const cap of Object.values(car.upgradeCaps)) {
        expect(cap).toBeGreaterThanOrEqual(0);
      }
    });
  },
);
