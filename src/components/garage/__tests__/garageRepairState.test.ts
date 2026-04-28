import { describe, expect, it } from "vitest";

import type { SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence";

import {
  buildGarageRepairView,
  repairGarageDamage,
  repairFailureMessage,
} from "../garageRepairState";

function damagedSave(): SaveGame {
  return {
    ...defaultSave(),
    garage: {
      ...defaultSave().garage,
      credits: 5000,
      lastRaceCashEarned: 2000,
      pendingDamage: {
        "sparrow-gt": {
          zones: {
            engine: 0.5,
            tires: 0.25,
            body: 0.5,
          },
          total: 0.45,
          offRoadAccumSeconds: 2,
        },
      },
    },
  };
}

describe("buildGarageRepairView", () => {
  it("quotes full and essential repairs for the active car", () => {
    const view = buildGarageRepairView(damagedSave());

    expect(view.activeCar?.id).toBe("sparrow-gt");
    expect(view.canUseShop).toBe(true);
    expect(view.rows.map((row) => row.damagePercent)).toEqual([50, 25, 50]);
    expect(view.full.cost).toBe(1350);
    expect(view.full.disabledReason).toBe("");
    expect(view.essential.cost).toBe(800);
    expect(view.essential.saved).toBe(100);
    expect(view.essential.breakdown).toEqual([
      { zone: "engine", credits: 667 },
      { zone: "tires", credits: 133 },
    ]);
  });

  it("blocks repair when the active car is missing", () => {
    const view = buildGarageRepairView({
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        activeCarId: "missing-car",
      },
    });

    expect(view.activeCar).toBeNull();
    expect(view.canUseShop).toBe(false);
    expect(view.full.disabledReason).toBe("Select an owned active car first.");
  });
});

describe("repairGarageDamage", () => {
  it("stores post-repair damage after a full repair", () => {
    const result = repairGarageDamage(damagedSave(), "full");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cashSpent).toBe(1350);
    expect(result.state.garage.credits).toBe(3650);
    expect(
      result.state.garage.pendingDamage?.["sparrow-gt"]?.zones,
    ).toEqual({
      engine: 0,
      tires: 0,
      body: 0,
    });
    expect(
      result.state.garage.pendingDamage?.["sparrow-gt"]?.offRoadAccumSeconds,
    ).toBe(2);
  });

  it("repairs only essential zones for an essential repair", () => {
    const result = repairGarageDamage(damagedSave(), "essential");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cashSpent).toBe(800);
    expect(
      result.state.garage.pendingDamage?.["sparrow-gt"]?.zones,
    ).toEqual({
      engine: 0,
      tires: 0,
      body: 0.5,
    });
  });
});

describe("repairFailureMessage", () => {
  it("formats insufficient-credit failures", () => {
    expect(
      repairFailureMessage({
        code: "insufficient_credits",
        required: 1350,
        available: 100,
      }),
    ).toBe("Not enough credits. Need 1350, have 100.");
  });
});
