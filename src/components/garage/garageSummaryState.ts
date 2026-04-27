import { CARS, getCar, STARTER_CAR_ID } from "@/data/cars";
import type {
  Car,
  SaveGame,
  UpgradeCategory,
} from "@/data/schemas";

const UPGRADE_CATEGORIES: ReadonlyArray<UpgradeCategory> = [
  "engine",
  "gearbox",
  "dryTires",
  "wetTires",
  "nitro",
  "armor",
  "cooling",
  "aero",
];

export interface GarageSummaryView {
  readonly activeCar: Car | null;
  readonly activeCarId: string;
  readonly credits: number;
  readonly ownedCount: number;
  readonly needsStarterPick: boolean;
  readonly starterCars: ReadonlyArray<Car>;
  readonly installedTiers: ReadonlyArray<GarageUpgradeTier>;
}

export interface GarageUpgradeTier {
  readonly category: UpgradeCategory;
  readonly label: string;
  readonly tier: number;
}

export function buildGarageSummaryView(
  save: Readonly<SaveGame>,
): GarageSummaryView {
  const activeCar = getCar(save.garage.activeCarId) ?? null;
  const ownsActive = save.garage.ownedCars.includes(save.garage.activeCarId);
  const installed = save.garage.installedUpgrades[save.garage.activeCarId];

  return {
    activeCar,
    activeCarId: save.garage.activeCarId,
    credits: save.garage.credits,
    ownedCount: save.garage.ownedCars.length,
    needsStarterPick: activeCar === null || !ownsActive,
    starterCars: starterCars(),
    installedTiers: UPGRADE_CATEGORIES.map((category) => ({
      category,
      label: upgradeLabel(category),
      tier: installed?.[category] ?? 0,
    })),
  };
}

export function selectStarterCar(
  save: Readonly<SaveGame>,
  carId: string,
): SaveGame | null {
  const car = getCar(carId);
  if (!car || car.purchasePrice !== 0) return null;
  const ownedCars = save.garage.ownedCars.includes(carId)
    ? save.garage.ownedCars
    : [...save.garage.ownedCars, carId];
  return {
    ...save,
    garage: {
      ...save.garage,
      ownedCars,
      activeCarId: carId,
      installedUpgrades: {
        ...save.garage.installedUpgrades,
        [carId]:
          save.garage.installedUpgrades[carId] ?? defaultUpgradeTiers(),
      },
    },
  };
}

export function starterCars(): ReadonlyArray<Car> {
  const freeCars = CARS.filter((car) => car.purchasePrice === 0);
  if (freeCars.length > 0) return freeCars;
  const fallback = getCar(STARTER_CAR_ID);
  return fallback ? [fallback] : [];
}

function defaultUpgradeTiers(): Record<UpgradeCategory, number> {
  return {
    engine: 0,
    gearbox: 0,
    dryTires: 0,
    wetTires: 0,
    nitro: 0,
    armor: 0,
    cooling: 0,
    aero: 0,
  };
}

function upgradeLabel(category: UpgradeCategory): string {
  switch (category) {
    case "dryTires":
      return "Dry tires";
    case "wetTires":
      return "Wet tires";
    case "nitro":
      return "Nitro system";
    case "armor":
      return "Chassis armor";
    case "aero":
      return "Aero kit";
    default:
      return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  }
}
