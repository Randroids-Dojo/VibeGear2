import { getCar } from "@/data/cars";
import type {
  Car,
  SaveGame,
  Upgrade,
  UpgradeCategory,
} from "@/data/schemas";
import { UpgradeCategorySchema } from "@/data/schemas";
import { UPGRADES } from "@/data/upgrades";
import type { EconomyFailure } from "@/game/economy";

const UPGRADE_CATEGORIES: ReadonlyArray<UpgradeCategory> =
  UpgradeCategorySchema.options;

export interface GarageUpgradeView {
  readonly activeCar: Car | null;
  readonly activeCarId: string;
  readonly credits: number;
  readonly canUseShop: boolean;
  readonly rows: ReadonlyArray<GarageUpgradeRow>;
}

export interface GarageUpgradeRow {
  readonly category: UpgradeCategory;
  readonly label: string;
  readonly currentTier: number;
  readonly cap: number;
  readonly nextUpgrade: Upgrade | null;
  readonly currentLabel: string;
  readonly nextLabel: string;
  readonly effectsLabel: string;
  readonly canPurchase: boolean;
  readonly disabledReason: string;
}

export function buildGarageUpgradeView(
  save: Readonly<SaveGame>,
): GarageUpgradeView {
  const activeCar = getCar(save.garage.activeCarId) ?? null;
  const ownsActive = save.garage.ownedCars.includes(save.garage.activeCarId);
  const installed = save.garage.installedUpgrades[save.garage.activeCarId];
  const rows = UPGRADE_CATEGORIES.map((category) => {
    const currentTier = installed?.[category] ?? 0;
    const cap = activeCar?.upgradeCaps[category] ?? 0;
    const nextUpgrade = upgradeFor(category, currentTier + 1);
    const atCap = activeCar !== null && currentTier >= cap;
    const cost = nextUpgrade?.cost ?? 0;
    const canPurchase =
      activeCar !== null &&
      ownsActive &&
      nextUpgrade !== null &&
      !atCap &&
      currentTier + 1 === nextUpgrade.tier &&
      save.garage.credits >= cost;

    return {
      category,
      label: upgradeLabel(category),
      currentTier,
      cap,
      nextUpgrade: atCap ? null : nextUpgrade,
      currentLabel: tierLabel(currentTier),
      nextLabel: atCap
        ? "Max installed"
        : nextUpgrade
          ? `${tierLabel(nextUpgrade.tier)} (${nextUpgrade.cost} credits)`
          : "No upgrade available",
      effectsLabel: nextUpgrade ? formatEffects(nextUpgrade.effects) : "No further effect",
      canPurchase,
      disabledReason: disabledReason({
        activeCar,
        ownsActive,
        atCap,
        nextUpgrade,
        credits: save.garage.credits,
      }),
    } satisfies GarageUpgradeRow;
  });

  return {
    activeCar,
    activeCarId: save.garage.activeCarId,
    credits: save.garage.credits,
    canUseShop: activeCar !== null && ownsActive,
    rows,
  };
}

export function upgradeFailureMessage(failure: EconomyFailure): string {
  switch (failure.code) {
    case "insufficient_credits":
      return `Not enough credits. Need ${failure.required}, have ${failure.available}.`;
    case "upgrade_at_cap":
      return `${upgradeLabel(failure.category)} is capped at tier ${failure.cap} for this car.`;
    case "tier_skip":
      return `${upgradeLabel(failure.category)} must be installed in order. Next tier is ${failure.required}.`;
    case "unknown_car":
      return `Unknown car: ${failure.carId}.`;
    case "unknown_upgrade":
      return `Unknown upgrade: ${failure.upgradeId}.`;
    case "car_not_owned":
      return `You do not own ${failure.carId}.`;
    case "unknown_zone":
      return `Unknown repair zone: ${failure.zone}.`;
  }
}

function upgradeFor(
  category: UpgradeCategory,
  tier: number,
): Upgrade | null {
  return (
    UPGRADES.find(
      (upgrade) => upgrade.category === category && upgrade.tier === tier,
    ) ?? null
  );
}

function disabledReason(input: {
  readonly activeCar: Car | null;
  readonly ownsActive: boolean;
  readonly atCap: boolean;
  readonly nextUpgrade: Upgrade | null;
  readonly credits: number;
}): string {
  if (input.activeCar === null) return "Select an owned active car first.";
  if (!input.ownsActive) return "You do not own the active car.";
  if (input.atCap) return "This car is already at its category cap.";
  if (input.nextUpgrade === null) return "No next tier exists.";
  if (input.credits < input.nextUpgrade.cost) {
    const creditsNeeded = input.nextUpgrade.cost - input.credits;
    return `Need ${creditsNeeded} more ${creditsNeeded === 1 ? "credit" : "credits"}.`;
  }
  return "";
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

function tierLabel(tier: number): string {
  switch (tier) {
    case 0:
      return "Stock";
    case 1:
      return "Street";
    case 2:
      return "Sport";
    case 3:
      return "Factory";
    case 4:
      return "Extreme";
    default:
      return `Tier ${tier}`;
  }
}

function formatEffects(effects: Upgrade["effects"]): string {
  const entries = Object.entries(effects).filter(
    ([, value]) => typeof value === "number" && value !== 0,
  );
  if (entries.length === 0) return "No numeric effect listed";
  return entries
    .map(
      ([key, value]) =>
        `${effectLabel(key as keyof Upgrade["effects"])} +${Math.round(value * 100)}%`,
    )
    .join(", ");
}

function effectLabel(key: keyof Upgrade["effects"]): string {
  const labels: Partial<Record<keyof Upgrade["effects"], string>> = {
    accel: "acceleration",
    brake: "braking",
    gripDry: "dry grip",
    gripWet: "wet grip",
    stability: "stability",
    durability: "durability",
    nitroEfficiency: "nitro efficiency",
    topSpeed: "top speed",
  };

  return (
    labels[key] ??
    String(key)
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
  );
}
