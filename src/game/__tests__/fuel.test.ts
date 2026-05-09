/**
 * Unit tests for the F-104 slice 1 fuel runtime. Pin the per-archetype
 * capacity curve, the gearbox-tier scalar, the per-tick drain shape,
 * and the depletion edge so a future tune of any constant cannot
 * silently regress the TG2-faithful "no mid-race refuel" loop.
 */

import { describe, expect, it } from "vitest";

import {
  BASE_CONSUMPTION_LPS_PER_MPS,
  createFuelState,
  fuelCapacityForArchetype,
  gearboxFuelEfficiency,
  tickFuel,
} from "@/game/fuel";

describe("fuelCapacityForArchetype", () => {
  it("returns the per-archetype capacity in litres", () => {
    expect(fuelCapacityForArchetype("short-sprint")).toBe(100);
    expect(fuelCapacityForArchetype("standard")).toBe(400);
    expect(fuelCapacityForArchetype("long-scenic")).toBe(280);
    expect(fuelCapacityForArchetype("endurance")).toBe(220);
  });
});

describe("gearboxFuelEfficiency", () => {
  it("returns 1.0 at tier 0 and ramps 10 % per tier up to 1.5 at tier 5", () => {
    expect(gearboxFuelEfficiency(0)).toBeCloseTo(1.0, 6);
    expect(gearboxFuelEfficiency(1)).toBeCloseTo(1.1, 6);
    expect(gearboxFuelEfficiency(2)).toBeCloseTo(1.2, 6);
    expect(gearboxFuelEfficiency(3)).toBeCloseTo(1.3, 6);
    expect(gearboxFuelEfficiency(4)).toBeCloseTo(1.4, 6);
    expect(gearboxFuelEfficiency(5)).toBeCloseTo(1.5, 6);
  });

  it("clamps a negative or non-finite tier to identity", () => {
    expect(gearboxFuelEfficiency(-1)).toBe(1);
    expect(gearboxFuelEfficiency(Number.NaN)).toBe(1);
  });
});

describe("createFuelState", () => {
  it("starts the tank full at the archetype capacity", () => {
    const state = createFuelState("short-sprint");
    expect(state.liters).toBe(100);
    expect(state.capacityLiters).toBe(100);
  });
});

describe("tickFuel", () => {
  it("drains liters at BASE_CONSUMPTION_LPS_PER_MPS * speed * dt at tier 0", () => {
    const state = createFuelState("standard");
    const result = tickFuel({
      state,
      speedMps: 50,
      gearboxTier: 0,
      dt: 1,
    });
    expect(result.state.liters).toBeCloseTo(
      400 - BASE_CONSUMPTION_LPS_PER_MPS * 50,
      6,
    );
    expect(result.state.capacityLiters).toBe(400);
    expect(result.depleted).toBe(false);
  });

  it("scales the drain inversely with the gearbox-tier efficiency", () => {
    const state = createFuelState("standard");
    const tier0 = tickFuel({ state, speedMps: 50, gearboxTier: 0, dt: 1 });
    const tier5 = tickFuel({ state, speedMps: 50, gearboxTier: 5, dt: 1 });
    const burn0 = state.liters - tier0.state.liters;
    const burn5 = state.liters - tier5.state.liters;
    // Tier 5 burns 50 % less fuel than tier 0 over the same tick.
    expect(burn5).toBeCloseTo(burn0 / 1.5, 6);
  });

  it("clamps to zero on the depletion tick and reports the edge", () => {
    const state = { liters: 0.1, capacityLiters: 100 };
    const result = tickFuel({
      state,
      speedMps: 50,
      gearboxTier: 0,
      dt: 1,
    });
    expect(result.state.liters).toBe(0);
    expect(result.depleted).toBe(true);
  });

  it("does not re-emit the depletion edge once the tank is already empty", () => {
    const state = { liters: 0, capacityLiters: 100 };
    const result = tickFuel({
      state,
      speedMps: 50,
      gearboxTier: 0,
      dt: 1,
    });
    expect(result.state.liters).toBe(0);
    expect(result.depleted).toBe(false);
  });

  it("collapses to a no-op for non-positive dt (paused / countdown tick)", () => {
    const state = createFuelState("short-sprint");
    expect(tickFuel({ state, speedMps: 50, gearboxTier: 0, dt: 0 }).state).toBe(
      state,
    );
    expect(
      tickFuel({ state, speedMps: 50, gearboxTier: 0, dt: -1 }).state,
    ).toBe(state);
  });

  it("does not drain at zero speed", () => {
    const state = createFuelState("short-sprint");
    const result = tickFuel({
      state,
      speedMps: 0,
      gearboxTier: 0,
      dt: 1,
    });
    expect(result.state.liters).toBe(100);
  });

  it("clamps a negative speed to zero (defensive)", () => {
    const state = createFuelState("short-sprint");
    const result = tickFuel({
      state,
      speedMps: -10,
      gearboxTier: 0,
      dt: 1,
    });
    expect(result.state.liters).toBe(100);
  });

  it("a stock-gearbox player at 50 m/s avg burns ~98 L over a 130 s short-sprint", () => {
    // Sanity: a 4-lap 1.5 km short-sprint averaging 50 m/s takes 120 s
    // and burns 90 L. Capacity 100 L leaves a comfortable margin so a
    // first-tour player does not run out at tier 0.
    let state = createFuelState("short-sprint");
    for (let s = 0; s < 130; s += 1) {
      state = tickFuel({ state, speedMps: 50, gearboxTier: 0, dt: 1 }).state;
    }
    expect(state.liters).toBeGreaterThan(0);
    expect(100 - state.liters).toBeGreaterThan(95);
  });
});
