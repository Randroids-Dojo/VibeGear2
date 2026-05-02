import { getCar } from "@/data/cars";
import type { Championship, SaveGame, UpgradeCategory } from "@/data/schemas";
import { UPGRADES } from "@/data/upgrades";

import { tourComplete } from "./championship";
import { createDamageState, type DamageState } from "./damage";
import { applyRepairCost } from "./economy";

const REPAIR_ZONES = ["engine", "tires", "body"] as const;

type PendingGarageDamage = NonNullable<
  SaveGame["garage"]["pendingDamage"]
>[string];

export interface TourPressureSummary {
  readonly tourId: string;
  readonly tourName: string;
  readonly progressLabel: string;
  readonly nextRaceId: string | null;
  readonly nextRaceLabel: string;
  readonly standingsLabel: string;
  readonly gateLabel: string;
  readonly pressureLabel: string;
  readonly playerStanding: number | null;
  readonly requiredStanding: number;
  readonly playerPoints: number;
  readonly pointsToGate: number;
  readonly cashOnHand: number;
  readonly repairEstimate: number;
  readonly cashAfterRepair: number;
  readonly nextUpgradeLabel: string;
  readonly nextUpgradeCost: number | null;
  readonly upgradeShortfall: number;
}

export function buildTourPressureSummary(input: {
  readonly save: SaveGame;
  readonly championship: Championship;
}): TourPressureSummary | null {
  const activeTour = input.save.progress.activeTour;
  if (!activeTour) return null;

  const tour = input.championship.tours.find(
    (candidate) => candidate.id === activeTour.tourId,
  );
  if (!tour) return null;

  const totalRaces = tour.tracks.length;
  const completedRaces = Math.min(activeTour.results.length, totalRaces);
  const nextRaceIndex = Math.min(activeTour.raceIndex, totalRaces - 1);
  const nextRaceId =
    activeTour.raceIndex < totalRaces
      ? (tour.tracks[nextRaceIndex] ?? null)
      : null;
  const summary = tourComplete(
    activeTour,
    input.championship,
    input.save.garage.activeCarId,
  );
  const playerEntry =
    summary.standings.find(
      (entry) => entry.carId === input.save.garage.activeCarId,
    ) ?? null;
  const playerStanding = playerEntry
    ? summary.standings.findIndex(
        (entry) => entry.carId === playerEntry.carId,
      ) + 1
    : null;
  const gateEntry = summary.standings[tour.requiredStanding - 1] ?? null;
  const playerPoints = playerEntry?.points ?? 0;
  const pointsToGate =
    playerStanding !== null && playerStanding <= tour.requiredStanding
      ? 0
      : Math.max(0, (gateEntry?.points ?? 0) - playerPoints);
  const repairEstimate = estimateFullRepair(input.save);
  const cashAfterRepair = Math.max(
    0,
    input.save.garage.credits - repairEstimate,
  );
  const nextUpgrade = cheapestNextUpgrade(input.save);
  const upgradeShortfall =
    nextUpgrade === null ? 0 : Math.max(0, nextUpgrade.cost - cashAfterRepair);

  return {
    tourId: tour.id,
    tourName: displayTourName(tour.id),
    progressLabel: `Race ${Math.min(totalRaces, activeTour.raceIndex + 1)} of ${totalRaces}, ${completedRaces} complete`,
    nextRaceId,
    nextRaceLabel: nextRaceId ?? "Tour complete",
    standingsLabel:
      playerStanding === null
        ? "No standing yet"
        : `${ordinal(playerStanding)} of ${Math.max(1, summary.standings.length)}`,
    gateLabel: `Need ${ordinal(tour.requiredStanding)} or better to advance`,
    pressureLabel: pressureLabel({
      completedRaces,
      playerStanding,
      requiredStanding: tour.requiredStanding,
      playerPoints,
      pointsToGate,
    }),
    playerStanding,
    requiredStanding: tour.requiredStanding,
    playerPoints,
    pointsToGate,
    cashOnHand: input.save.garage.credits,
    repairEstimate,
    cashAfterRepair,
    nextUpgradeLabel: nextUpgrade?.label ?? "No eligible upgrade",
    nextUpgradeCost: nextUpgrade?.cost ?? null,
    upgradeShortfall,
  };
}

export function estimateFullRepair(save: SaveGame): number {
  const carId = save.garage.activeCarId;
  const damage = damageFromPending(save.garage.pendingDamage?.[carId]);
  const quoteSave: SaveGame = {
    ...save,
    garage: {
      ...save.garage,
      credits: Number.MAX_SAFE_INTEGER,
    },
  };
  const result = applyRepairCost(quoteSave, {
    carId,
    damage,
    tourTier: 1,
    zones: REPAIR_ZONES,
    repairKind: "full",
    lastRaceCashEarned: save.garage.lastRaceCashEarned ?? 0,
  });
  return result.ok ? (result.cashSpent ?? 0) : 0;
}

function cheapestNextUpgrade(
  save: SaveGame,
): { readonly label: string; readonly cost: number } | null {
  const activeCar = getCar(save.garage.activeCarId);
  if (!activeCar) return null;
  const installed = save.garage.installedUpgrades[save.garage.activeCarId];
  const candidates = UPGRADES.filter((upgrade) => {
    const currentTier = installed?.[upgrade.category] ?? 0;
    const cap = activeCar.upgradeCaps[upgrade.category];
    return upgrade.tier === currentTier + 1 && upgrade.tier <= cap;
  }).map((upgrade) => ({
    label: `${upgradeLabel(upgrade.category)} ${tierLabel(upgrade.tier)}`,
    cost: upgrade.cost,
  }));

  candidates.sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label));
  return candidates[0] ?? null;
}

function pressureLabel(input: {
  readonly completedRaces: number;
  readonly playerStanding: number | null;
  readonly requiredStanding: number;
  readonly playerPoints: number;
  readonly pointsToGate: number;
}): string {
  if (input.completedRaces === 0) {
    return `Opening race: bank points for the top ${input.requiredStanding} gate`;
  }
  if (
    input.playerStanding !== null &&
    input.playerStanding <= input.requiredStanding
  ) {
    return `Inside the gate with ${input.playerPoints} points`;
  }
  return `Chase ${input.pointsToGate} points to reach the gate`;
}

function damageFromPending(
  pending: PendingGarageDamage | undefined,
): DamageState {
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

function upgradeLabel(category: UpgradeCategory): string {
  switch (category) {
    case "dryTires":
      return "Dry tires";
    case "wetTires":
      return "Wet tires";
    case "nitro":
      return "Nitro";
    case "armor":
      return "Armor";
    case "aero":
      return "Aero";
    default:
      return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  }
}

function tierLabel(tier: number): string {
  switch (tier) {
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

function displayTourName(tourId: string): string {
  return tourId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ordinal(n: number): string {
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
