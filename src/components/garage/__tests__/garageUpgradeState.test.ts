import { describe, expect, it } from "vitest";

import type { SaveGame } from "@/data/schemas";
import { defaultSave } from "@/persistence";

import {
  buildGarageUpgradeView,
  upgradeFailureMessage,
} from "../garageUpgradeState";

describe("buildGarageUpgradeView", () => {
  it("lists every upgrade category with the next purchasable tier", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        credits: 3500,
      },
    };

    const view = buildGarageUpgradeView(save);
    const engine = view.rows.find((row) => row.category === "engine");

    expect(view.activeCar?.id).toBe("sparrow-gt");
    expect(view.credits).toBe(3500);
    expect(view.canUseShop).toBe(true);
    expect(view.rows).toHaveLength(8);
    expect(engine?.currentTier).toBe(0);
    expect(engine?.currentLabel).toBe("Stock");
    expect(engine?.nextUpgrade?.id).toBe("engine-street");
    expect(engine?.nextLabel).toBe("Street (3000 credits)");
    expect(engine?.effectsLabel).toContain("accel +4%");
    expect(engine?.canPurchase).toBe(true);
    expect(engine?.disabledReason).toBe("");
  });

  it("disables a next tier when credits are short", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        credits: 2999,
      },
    };

    const view = buildGarageUpgradeView(save);
    const engine = view.rows.find((row) => row.category === "engine");

    expect(engine?.canPurchase).toBe(false);
    expect(engine?.disabledReason).toBe("Need 1 more credits.");
  });

  it("surfaces category caps from the active car", () => {
    const save: SaveGame = {
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        credits: 25000,
        installedUpgrades: {
          ...defaultSave().garage.installedUpgrades,
          "sparrow-gt": {
            ...defaultSave().garage.installedUpgrades["sparrow-gt"]!,
            aero: 3,
          },
        },
      },
    };

    const view = buildGarageUpgradeView(save);
    const aero = view.rows.find((row) => row.category === "aero");

    expect(aero?.cap).toBe(3);
    expect(aero?.currentTier).toBe(3);
    expect(aero?.nextUpgrade).toBeNull();
    expect(aero?.nextLabel).toBe("Max installed");
    expect(aero?.canPurchase).toBe(false);
    expect(aero?.disabledReason).toBe(
      "This car is already at its category cap.",
    );
  });

  it("blocks the shop when the active car is missing or unowned", () => {
    const view = buildGarageUpgradeView({
      ...defaultSave(),
      garage: {
        ...defaultSave().garage,
        activeCarId: "missing-car",
      },
    });

    expect(view.activeCar).toBeNull();
    expect(view.canUseShop).toBe(false);
    expect(view.rows.every((row) => !row.canPurchase)).toBe(true);
    expect(view.rows[0]?.disabledReason).toBe("Select an owned active car first.");
  });
});

describe("upgradeFailureMessage", () => {
  it("formats actionable economy failures", () => {
    expect(
      upgradeFailureMessage({
        code: "insufficient_credits",
        required: 3000,
        available: 1200,
      }),
    ).toBe("Not enough credits. Need 3000, have 1200.");
    expect(
      upgradeFailureMessage({
        code: "tier_skip",
        category: "engine",
        required: 2,
        attempted: 4,
      }),
    ).toBe("Engine must be installed in order. Next tier is 2.");
  });
});
