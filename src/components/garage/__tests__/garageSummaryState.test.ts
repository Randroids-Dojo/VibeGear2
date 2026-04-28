import { describe, expect, it } from "vitest";

import type { SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence";

import {
  buildGarageSummaryView,
  selectStarterCar,
  starterCars,
} from "../garageSummaryState";

describe("buildGarageSummaryView", () => {
  it("summarises the active car, credits, owned count, and upgrade tiers", () => {
    const save = defaultSave();
    const view = buildGarageSummaryView(save);

    expect(view.activeCar?.id).toBe("sparrow-gt");
    expect(view.activeCarId).toBe("sparrow-gt");
    expect(view.credits).toBe(0);
    expect(view.ownedCount).toBe(1);
    expect(view.needsStarterPick).toBe(false);
    expect(view.installedTiers).toHaveLength(8);
    expect(view.installedTiers.every((row) => row.tier === 0)).toBe(true);
  });

  it("asks for a starter pick when the active car id is not owned", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        activeCarId: "missing-car",
      },
    };

    const view = buildGarageSummaryView(save);

    expect(view.activeCar).toBeNull();
    expect(view.needsStarterPick).toBe(true);
    expect(view.starterCars.map((car) => car.id)).toContain("sparrow-gt");
  });
});

describe("selectStarterCar", () => {
  it("sets a starter-choice car as active and seeds its upgrades", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        activeCarId: "missing-car",
        ownedCars: ["sparrow-gt"],
        installedUpgrades: {},
      },
    };

    const next = selectStarterCar(save, "vanta-xr");

    expect(next?.garage.activeCarId).toBe("vanta-xr");
    expect(next?.garage.ownedCars).toContain("vanta-xr");
    expect(next?.garage.installedUpgrades["vanta-xr"]?.engine).toBe(0);
  });

  it("rejects non-starter cars for starter selection", () => {
    expect(selectStarterCar(defaultSave(), "bastion-lm")).toBeNull();
  });
});

describe("starterCars", () => {
  it("returns the §11 starter-choice catalogue entries", () => {
    expect(starterCars().map((car) => car.id)).toEqual([
      "sparrow-gt",
      "breaker-s",
      "vanta-xr",
    ]);
  });
});
