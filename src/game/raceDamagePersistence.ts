import type { SaveGame } from "@/data/schemas";

import {
  createDamageState,
  type DamageState,
  type DamageZone,
} from "./damage";
import type { DamageDelta } from "./raceResult";

const DAMAGE_ZONES: readonly DamageZone[] = ["engine", "tires", "body"];

export function damageDeltaFromState(
  damage: Readonly<DamageState>,
): DamageDelta {
  return {
    engine: damage.zones.engine,
    tires: damage.zones.tires,
    body: damage.zones.body,
  };
}

export function pendingDamageForActiveCar(save: SaveGame): DamageState {
  const activeCarId = save.garage.activeCarId;
  if (!activeCarId) return createDamageState({});
  const pending = save.garage.pendingDamage?.[activeCarId] ?? null;
  if (pending === null) return createDamageState({});
  return normalizeDamageState(pending);
}

export function applyRaceDamageToGarage(input: {
  save: SaveGame;
  carId: string | null | undefined;
  damage: Readonly<DamageState>;
  lastRaceCashEarned: number;
}): SaveGame {
  const { save, carId, damage, lastRaceCashEarned } = input;
  if (!carId || !save.garage.ownedCars.includes(carId)) {
    return save;
  }

  return {
    ...save,
    garage: {
      ...save.garage,
      pendingDamage: {
        ...(save.garage.pendingDamage ?? {}),
        [carId]: normalizeDamageState(damage),
      },
      lastRaceCashEarned: cleanCash(lastRaceCashEarned),
    },
  };
}

function normalizeDamageState(damage: Readonly<DamageState>): DamageState {
  const zones: Partial<Record<DamageZone, number>> = {};
  for (const zone of DAMAGE_ZONES) {
    zones[zone] = damage.zones[zone];
  }
  const normalized = createDamageState(zones);
  return {
    ...normalized,
    offRoadAccumSeconds: cleanSeconds(damage.offRoadAccumSeconds),
  };
}

function cleanCash(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function cleanSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}
