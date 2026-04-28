import { describe, expect, it } from "vitest";

import type { AIDriver, CarBaseStats } from "@/data/schemas";

import { spawnGrid, type AIGridDriver } from "../aiGrid";

const STATS: CarBaseStats = Object.freeze({
  topSpeed: 61,
  accel: 16,
  brake: 28,
  gripDry: 1,
  gripWet: 0.82,
  stability: 1,
  durability: 0.95,
  nitroEfficiency: 1,
});

function driver(id: string): AIDriver {
  return {
    id,
    displayName: id,
    archetype: "clean_line",
    paceScalar: 1,
    mistakeRate: 0,
    aggression: 0.3,
    weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
    nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
  };
}

function roster(count: number): readonly AIGridDriver[] {
  return Array.from({ length: count }, (_, index) => ({
    driver: driver(`ai_${String(index + 1).padStart(2, "0")}`),
    stats: STATS,
  }));
}

describe("spawnGrid", () => {
  it("packs available AI drivers into player-reserved grid slots", () => {
    const grid = spawnGrid({
      trackSpawn: { gridSlots: 12 },
      laneCount: 3,
      aiDrivers: roster(20),
      seed: 42,
    });
    expect(grid).toHaveLength(11);
    expect(grid.map((entry) => entry.gridSlot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("is pure and deterministic for repeated calls", () => {
    const input = {
      trackSpawn: { gridSlots: 12 },
      laneCount: 3,
      aiDrivers: roster(11),
      seed: 7,
    };
    const first = spawnGrid(input);
    for (let i = 0; i < 1000; i += 1) {
      expect(spawnGrid(input)).toEqual(first);
    }
  });

  it("permutes drivers by seed without duplicating ids", () => {
    const input = {
      trackSpawn: { gridSlots: 8 },
      laneCount: 3,
      aiDrivers: roster(8),
    };
    const a = spawnGrid({ ...input, seed: 1 }).map((entry) => entry.driver.id);
    const b = spawnGrid({ ...input, seed: 2 }).map((entry) => entry.driver.id);
    expect(a).not.toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    expect(new Set(b).size).toBe(b.length);
  });

  it("derives stable per-slot AI seeds from the grid seed", () => {
    const input = {
      trackSpawn: { gridSlots: 6 },
      laneCount: 3,
      aiDrivers: roster(5),
      seed: 9,
    };
    const first = spawnGrid(input).map((entry) => entry.seed);
    const repeat = spawnGrid(input).map((entry) => entry.seed);
    const different = spawnGrid({ ...input, seed: 10 }).map((entry) => entry.seed);

    expect(first).toEqual(repeat);
    expect(new Set(first).size).toBe(first.length);
    expect(first).not.toEqual(different);
  });

  it("spreads lanes within each row and preserves unique slots", () => {
    const grid = spawnGrid({
      trackSpawn: { gridSlots: 12 },
      laneCount: 3,
      aiDrivers: roster(11),
      seed: 3,
    });
    expect(grid.slice(0, 3).map((entry) => entry.lane)).toEqual([1, 0, 2]);
    const slotLanePairs = new Set(
      grid.map((entry) => `${entry.gridSlot}:${entry.lane}`),
    );
    expect(slotLanePairs.size).toBe(grid.length);
  });

  it("leaves trailing slots empty when the roster is short", () => {
    const grid = spawnGrid({
      trackSpawn: { gridSlots: 12 },
      laneCount: 3,
      aiDrivers: roster(2),
      seed: 4,
    });
    expect(grid).toHaveLength(2);
  });

  it("returns no AI cars when only the player slot exists", () => {
    const grid = spawnGrid({
      trackSpawn: { gridSlots: 1 },
      laneCount: 3,
      aiDrivers: roster(3),
      seed: 5,
    });
    expect(grid).toEqual([]);
  });
});
