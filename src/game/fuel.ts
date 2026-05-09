/**
 * F-104 slice 1. TG2-faithful fuel runtime.
 *
 * Per the 2026-05-09 research pass on Top Gear 2 (1994, SNES):
 *   - Cars carry a per-race fuel reserve that depletes as the car drives.
 *   - There are no mid-race refuels (no pit stops, no on-road gas cans;
 *     those were the 1992 Top Gear mechanic dropped in the sequel).
 *   - The strategic spend driver is the gearbox upgrade in the garage:
 *     a higher tier gives better fuel economy so longer races become
 *     survivable.
 *
 * This module is the pure side of the runtime. Slice 2 wires the HUD
 * gauge and slice 3 tunes the per-archetype capacities + the gearbox
 * tier curve against playtest data.
 *
 * Pure: same inputs always produce the same output. No globals, no
 * `Date.now()`, no React. Only the player's fuel is tracked in slice 1
 * - the AI grid runs without fuel so a stock-gearbox player does not
 * have to win against AI cars that DNF on lap 6 of a 16-lap standard.
 *
 * Capacity curve (litres) by `TrackArchetype`. Sized so a player at
 * gearbox tier 0 finishes a `short-sprint` with comfortable margin and
 * needs to upgrade the gearbox to survive `standard` / `long-scenic` /
 * `endurance` archetypes. The numbers will be re-tuned in F-104 slice 3
 * once playtest data is in.
 */

import type { TrackArchetype } from "@/data/schemas";

/**
 * Base fuel drain (litres / second) per metre / second of speed.
 * `tickFuel` reads `BASE_CONSUMPTION_LPS_PER_MPS * speed_mps * dt`
 * for the per-tick burn before the gearbox-tier scalar.
 */
export const BASE_CONSUMPTION_LPS_PER_MPS = 0.015;

/**
 * Per-archetype starting capacity. `createRaceSession` reads
 * `fuelCapacityForArchetype(track.archetype) / gearboxFuelEfficiency(tier)`
 * is NOT how it works - the gearbox scalar lives on consumption,
 * not on capacity, so a tier 0 car runs out before a tier 5 car at the
 * same archetype.
 */
const CAPACITY_BY_ARCHETYPE: Readonly<Record<TrackArchetype, number>> = {
  "short-sprint": 100,
  standard: 400,
  "long-scenic": 280,
  endurance: 220,
};

export function fuelCapacityForArchetype(archetype: TrackArchetype): number {
  return CAPACITY_BY_ARCHETYPE[archetype];
}

/**
 * Gearbox-tier fuel-economy multiplier. `tickFuel` divides the base
 * drain by this scalar so a higher tier burns less fuel per metre.
 *
 * Linear ramp at 10 % per tier. Tier 0 = 1.0 (base), tier 5 = 1.5
 * (50 % more range). Mirrors the §11 `upgradeCaps.gearbox` cap, which
 * tops out at tier 5 on every car. The curve is intentionally gentle
 * so gearbox tiers are a strategic compounding spend rather than a
 * single jump from "DNF" to "safe".
 */
export function gearboxFuelEfficiency(tier: number): number {
  if (!Number.isFinite(tier) || tier < 0) return 1;
  return 1 + tier * 0.1;
}

export interface FuelState {
  /** Current litres remaining. Clamped to `[0, capacityLiters]`. */
  readonly liters: number;
  /** Maximum capacity for the active race. Set at session creation. */
  readonly capacityLiters: number;
}

export interface TickFuelInput {
  readonly state: FuelState;
  /** Forward speed in m/s; reads `car.speed` at the call site. */
  readonly speedMps: number;
  /** Gearbox upgrade tier; `save.garage.installedUpgrades[carId].gearbox`. */
  readonly gearboxTier: number;
  /** Tick duration in seconds. */
  readonly dt: number;
}

export interface TickFuelResult {
  readonly state: FuelState;
  /**
   * True the tick the player crosses from `liters > 0` to `liters === 0`.
   * The race-session reducer reads this and flips the player's status to
   * `dnf` with `dnfReason: "out-of-fuel"`.
   */
  readonly depleted: boolean;
}

/**
 * Advance the fuel state by one tick. Drain = `BASE_CONSUMPTION_LPS_PER_MPS
 * * speed_mps * dt / gearboxFuelEfficiency(tier)`. A negative or zero
 * `dt` collapses to a no-op so paused / countdown ticks do not deplete
 * the tank. Already-empty tanks stay at zero and report `depleted: false`
 * (the depletion edge already fired on the prior tick).
 */
export function tickFuel(input: TickFuelInput): TickFuelResult {
  if (!Number.isFinite(input.dt) || input.dt <= 0) {
    return { state: input.state, depleted: false };
  }
  if (input.state.liters <= 0) {
    return {
      state: { ...input.state, liters: 0 },
      depleted: false,
    };
  }
  const speed = Math.max(0, input.speedMps);
  const drainPerSec =
    (BASE_CONSUMPTION_LPS_PER_MPS * speed) /
    gearboxFuelEfficiency(input.gearboxTier);
  const next = Math.max(0, input.state.liters - drainPerSec * input.dt);
  const depleted = input.state.liters > 0 && next === 0;
  return {
    state: { ...input.state, liters: next },
    depleted,
  };
}

/**
 * Build the initial `FuelState` for a fresh race. Capacity comes from
 * the track archetype; the tank starts full.
 */
export function createFuelState(archetype: TrackArchetype): FuelState {
  const capacityLiters = fuelCapacityForArchetype(archetype);
  return { liters: capacityLiters, capacityLiters };
}
