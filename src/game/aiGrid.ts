import type { AIDriver, CarBaseStats, TrackSpawn } from "@/data/schemas";
import { ROAD_WIDTH } from "@/road/constants";

import type { CarUpgradeTiers, RaceSessionAI } from "./raceSession";
import { createRng, serializeRng, splitRng } from "./rng";

export interface AIGridDriver {
  readonly driver: Readonly<AIDriver>;
  readonly stats: Readonly<CarBaseStats>;
  readonly upgrades?: Readonly<CarUpgradeTiers> | null;
}

export interface SpawnGridInput {
  readonly trackSpawn: Readonly<TrackSpawn>;
  readonly laneCount: number;
  readonly aiDrivers: ReadonlyArray<AIGridDriver>;
  readonly seed?: number;
  readonly rowSpacingMeters?: number;
}

export interface SpawnedGridCar extends RaceSessionAI {
  readonly gridSlot: number;
  readonly lane: number;
  readonly startX: number;
  readonly startZ: number;
}

const DEFAULT_GRID_SEED = 1;
const DEFAULT_ROW_SPACING_METERS = 5;

export function spawnGrid(input: SpawnGridInput): readonly SpawnedGridCar[] {
  const slotCount = Math.max(0, Math.floor(input.trackSpawn.gridSlots) - 1);
  const laneCount = Math.max(1, Math.floor(input.laneCount));
  const rowSpacingMeters =
    input.rowSpacingMeters === undefined
      ? DEFAULT_ROW_SPACING_METERS
      : Math.max(1, input.rowSpacingMeters);
  const shuffled = shuffleDrivers(input.aiDrivers, input.seed ?? DEFAULT_GRID_SEED);

  return shuffled.slice(0, slotCount).map((entry, index) => {
    const gridSlot = index + 1;
    const lane = laneForGridIndex(index, laneCount);
    const row = Math.floor(index / laneCount) + 1;
    const startX = xForLane(lane, laneCount);
    const startZ = -row * rowSpacingMeters;
    return {
      driver: entry.driver,
      stats: entry.stats,
      upgrades: entry.upgrades ?? null,
      gridSlot,
      lane,
      startX,
      startZ,
      seed: seedForGridSlot(input.seed ?? DEFAULT_GRID_SEED, gridSlot),
      initial: { x: startX, z: startZ },
    };
  });
}

function shuffleDrivers(
  drivers: ReadonlyArray<AIGridDriver>,
  seed: number,
): AIGridDriver[] {
  const next = drivers.slice();
  const rng = splitRng(createRng(seed), "ai-grid-roster");
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i + 1);
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

function laneForGridIndex(index: number, laneCount: number): number {
  const rowIndex = index % laneCount;
  const center = Math.floor(laneCount / 2);
  if (rowIndex === 0) return center;
  const offset = Math.ceil(rowIndex / 2);
  return rowIndex % 2 === 1
    ? Math.max(0, center - offset)
    : Math.min(laneCount - 1, center + offset);
}

function xForLane(lane: number, laneCount: number): number {
  const laneWidth = (ROAD_WIDTH * 2) / laneCount;
  return -ROAD_WIDTH + laneWidth * (lane + 0.5);
}

function seedForGridSlot(seed: number, gridSlot: number): number {
  return serializeRng(splitRng(createRng(seed), `ai-grid-slot:${gridSlot}`));
}
