import { getCar } from "@/data/cars";
import type { Car, SaveGame } from "@/data/schemas";
import {
  applyRepairCost,
  type EconomyFailure,
  type EconomyResult,
} from "@/game/economy";
import {
  createDamageState,
  type DamageState,
  type DamageZone,
} from "@/game/damage";

const REPAIR_ZONES: ReadonlyArray<DamageZone> = ["engine", "tires", "body"];
const ESSENTIAL_ZONES: ReadonlyArray<DamageZone> = ["engine", "tires"];

export type GarageRepairKind = "full" | "essential";

export interface GarageRepairView {
  readonly activeCar: Car | null;
  readonly activeCarId: string;
  readonly credits: number;
  readonly canUseShop: boolean;
  readonly damage: DamageState;
  readonly rows: ReadonlyArray<GarageRepairZoneRow>;
  readonly full: GarageRepairQuote;
  readonly essential: GarageRepairQuote;
}

export interface GarageRepairZoneRow {
  readonly zone: DamageZone;
  readonly label: string;
  readonly damagePercent: number;
  readonly fullCost: number;
}

export interface GarageRepairQuote {
  readonly kind: GarageRepairKind;
  readonly label: string;
  readonly zones: ReadonlyArray<DamageZone>;
  readonly cost: number;
  readonly saved: number;
  readonly disabledReason: string;
  readonly breakdown: ReadonlyArray<{ zone: DamageZone; credits: number }>;
}

export function buildGarageRepairView(
  save: Readonly<SaveGame>,
): GarageRepairView {
  const activeCar = getCar(save.garage.activeCarId) ?? null;
  const ownsActive = save.garage.ownedCars.includes(save.garage.activeCarId);
  const damage = pendingDamageFor(save, save.garage.activeCarId);
  const quoteBase = quoteSave(save);
  const full = quoteRepair(quoteBase, save.garage.activeCarId, damage, "full");
  const essential = quoteRepair(
    quoteBase,
    save.garage.activeCarId,
    damage,
    "essential",
  );
  const fullByZone = new Map(
    full.breakdown.map((entry) => [entry.zone, entry.credits] as const),
  );

  return {
    activeCar,
    activeCarId: save.garage.activeCarId,
    credits: save.garage.credits,
    canUseShop: activeCar !== null && ownsActive,
    damage,
    rows: REPAIR_ZONES.map((zone) => ({
      zone,
      label: zoneLabel(zone),
      damagePercent: Math.round((damage.zones[zone] ?? 0) * 100),
      fullCost: fullByZone.get(zone) ?? 0,
    })),
    full: withDisabledReason(full, save, activeCar, ownsActive, damage),
    essential: withDisabledReason(essential, save, activeCar, ownsActive, damage),
  };
}

export function repairGarageDamage(
  save: Readonly<SaveGame>,
  kind: GarageRepairKind,
): EconomyResult {
  const activeCarId = save.garage.activeCarId;
  const result = applyRepairCost(cloneSaveForRepair(save), {
    carId: activeCarId,
    damage: pendingDamageFor(save, activeCarId),
    tourTier: 1,
    zones: kind === "essential" ? ESSENTIAL_ZONES : REPAIR_ZONES,
    repairKind: kind,
    lastRaceCashEarned: save.garage.lastRaceCashEarned ?? 0,
  });

  if (!result.ok) return result;

  return {
    ...result,
    state: {
      ...result.state,
      garage: {
        ...result.state.garage,
        pendingDamage: {
          ...(result.state.garage.pendingDamage ?? {}),
          [activeCarId]: result.damage ?? pendingDamageFor(save, activeCarId),
        },
      },
    },
  };
}

export function repairFailureMessage(failure: EconomyFailure): string {
  switch (failure.code) {
    case "insufficient_credits":
      return `Not enough credits. Need ${failure.required}, have ${failure.available}.`;
    case "unknown_car":
      return `Unknown car: ${failure.carId}.`;
    case "unknown_zone":
      return `Unknown repair zone: ${failure.zone}.`;
    case "car_not_owned":
      return `You do not own ${failure.carId}.`;
    case "unknown_upgrade":
      return `Unknown upgrade: ${failure.upgradeId}.`;
    case "tier_skip":
      return `Upgrade tier ${failure.attempted} is not available yet.`;
    case "upgrade_at_cap":
      return `Upgrade is capped at tier ${failure.cap}.`;
  }
}

function pendingDamageFor(
  save: Readonly<SaveGame>,
  carId: string,
): DamageState {
  const pending = save.garage.pendingDamage?.[carId];
  if (!pending) return createDamageState({});
  return {
    ...createDamageState({
      engine: pending.zones.engine,
      tires: pending.zones.tires,
      body: pending.zones.body,
    }),
    offRoadAccumSeconds: pending.offRoadAccumSeconds,
  };
}

function quoteSave(save: Readonly<SaveGame>): SaveGame {
  return {
    ...save,
    garage: {
      ...save.garage,
      credits: Number.MAX_SAFE_INTEGER,
    },
  };
}

function quoteRepair(
  save: SaveGame,
  carId: string,
  damage: DamageState,
  kind: GarageRepairKind,
): GarageRepairQuote {
  const zones = kind === "essential" ? ESSENTIAL_ZONES : REPAIR_ZONES;
  const result = applyRepairCost(save, {
    carId,
    damage,
    tourTier: 1,
    zones,
    repairKind: kind,
    lastRaceCashEarned: save.garage.lastRaceCashEarned ?? 0,
  });

  if (!result.ok) {
    return {
      kind,
      label: kind === "essential" ? "Essential repair" : "Full service",
      zones,
      cost: 0,
      saved: 0,
      disabledReason: repairFailureMessage(result.failure),
      breakdown: zones.map((zone) => ({ zone, credits: 0 })),
    };
  }

  return {
    kind,
    label: kind === "essential" ? "Essential repair" : "Full service",
    zones,
    cost: result.cashSpent ?? 0,
    saved: result.cashSaved ?? 0,
    disabledReason: "",
    breakdown: result.repairBreakdown ?? [],
  };
}

function withDisabledReason(
  quote: GarageRepairQuote,
  save: Readonly<SaveGame>,
  activeCar: Car | null,
  ownsActive: boolean,
  damage: DamageState,
): GarageRepairQuote {
  if (activeCar === null) {
    return { ...quote, disabledReason: "Select an owned active car first." };
  }
  if (!ownsActive) {
    return { ...quote, disabledReason: "You do not own the active car." };
  }
  const hasDamage = quote.zones.some((zone) => (damage.zones[zone] ?? 0) > 0);
  if (!hasDamage) {
    return { ...quote, disabledReason: "No damage in these zones." };
  }
  if (quote.cost > save.garage.credits) {
    const needed = quote.cost - save.garage.credits;
    return {
      ...quote,
      disabledReason: `Need ${needed} more ${needed === 1 ? "credit" : "credits"}.`,
    };
  }
  return quote;
}

function cloneSaveForRepair(save: Readonly<SaveGame>): SaveGame {
  return {
    ...save,
    garage: { ...save.garage },
  };
}

function zoneLabel(zone: DamageZone): string {
  switch (zone) {
    case "engine":
      return "Engine";
    case "tires":
      return "Tires";
    case "body":
      return "Body";
  }
}
