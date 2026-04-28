import { STARTER_CAR_IDS, getCar } from "@/data/cars";
import type {
  Car,
  SaveGame,
  UpgradeCategory,
} from "@/data/schemas";
import { UpgradeCategorySchema } from "@/data/schemas";

const UPGRADE_CATEGORIES: ReadonlyArray<UpgradeCategory> =
  UpgradeCategorySchema.options;

export interface GarageSummaryView {
  readonly activeCar: Car | null;
  readonly activeCarId: string;
  readonly credits: number;
  readonly ownedCount: number;
  readonly damagePercent: number;
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
  const pendingDamage = save.garage.pendingDamage?.[save.garage.activeCarId];

  return {
    activeCar,
    activeCarId: save.garage.activeCarId,
    credits: save.garage.credits,
    ownedCount: save.garage.ownedCars.length,
    damagePercent: Math.round((pendingDamage?.total ?? 0) * 100),
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
  if (!car || !isStarterCarId(carId)) return null;
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
  const cars = STARTER_CAR_IDS.flatMap((carId) => {
    const car = getCar(carId);
    return car ? [car] : [];
  });

  if (cars.length === 0) {
    throw new Error(
      `No configured starter cars could be resolved from STARTER_CAR_IDS: ${STARTER_CAR_IDS.join(", ")}`,
    );
  }

  return cars;
}

function isStarterCarId(carId: string): boolean {
  return STARTER_CAR_IDS.some((starterId) => starterId === carId);
}

function defaultUpgradeTiers(): Record<UpgradeCategory, number> {
  return Object.fromEntries(
    UPGRADE_CATEGORIES.map((category) => [category, 0]),
  ) as Record<UpgradeCategory, number>;
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
