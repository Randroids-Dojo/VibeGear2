/**
 * Unit tests for the F-097 follow-up tour-completion gate. Pin the
 * three cases the cars-page UI branches on so a future refactor of
 * the gate (e.g. requiring multiple tours, or adding a credits
 * pre-check) does not silently change the contract.
 */

import { describe, expect, it } from "vitest";

import type { Car } from "@/data/schemas";
import { isCarUnlocked } from "@/game/carUnlock";

const BASE_CAR: Car = {
  id: "stub",
  name: "Stub",
  class: "balance",
  purchasePrice: 1000,
  repairFactor: 1,
  baseStats: {
    topSpeed: 60,
    accel: 16,
    brake: 28,
    gripDry: 1,
    gripWet: 0.85,
    stability: 1,
    durability: 1,
    nitroEfficiency: 1,
  },
  upgradeCaps: {
    engine: 4,
    gearbox: 4,
    dryTires: 4,
    wetTires: 4,
    nitro: 4,
    armor: 4,
    cooling: 4,
    aero: 4,
  },
  visualProfile: { spriteSet: "sparrow_gt", paletteSet: "early_a" },
};

describe("isCarUnlocked", () => {
  it("returns true when the car has no requiresTour", () => {
    expect(isCarUnlocked(BASE_CAR, [])).toBe(true);
    expect(isCarUnlocked(BASE_CAR, ["any-tour"])).toBe(true);
  });

  it("returns false when the required tour has not been completed", () => {
    const gated: Car = { ...BASE_CAR, requiresTour: "iron-borough" };
    expect(isCarUnlocked(gated, [])).toBe(false);
    expect(isCarUnlocked(gated, ["velvet-coast"])).toBe(false);
  });

  it("returns true once the required tour is in completedTours", () => {
    const gated: Car = { ...BASE_CAR, requiresTour: "iron-borough" };
    expect(isCarUnlocked(gated, ["iron-borough"])).toBe(true);
    expect(
      isCarUnlocked(gated, ["velvet-coast", "iron-borough", "ember-steppe"]),
    ).toBe(true);
  });
});
