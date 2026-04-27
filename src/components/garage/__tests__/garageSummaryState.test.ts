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
  it("sets a free starter as active and seeds its upgrades", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        activeCarId: "missing-car",
        ownedCars: ["sparrow-gt"],
        installedUpgrades: {},
      },
    };

    const next = selectStarterCar(save, "sparrow-gt");

    expect(next?.garage.activeCarId).toBe("sparrow-gt");
    expect(next?.garage.ownedCars).toContain("sparrow-gt");
    expect(next?.garage.installedUpgrades["sparrow-gt"]?.engine).toBe(0);
  });

  it("rejects paid cars for starter selection", () => {
    expect(selectStarterCar(defaultSave(), "vanta-xr")).toBeNull();
  });
});

describe("starterCars", () => {
  it("returns the currently free starter catalogue entries", () => {
    expect(starterCars().map((car) => car.id)).toEqual(["sparrow-gt"]);
  });
});
