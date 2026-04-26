/**
 * Content tests for the MVP upgrade catalogue.
 *
 * `src/data/upgrades.json` must:
 * - validate against `UpgradeSchema` from `docs/gdd/22-data-schemas.md`,
 * - cover every (category x tier 1..4) cell from §12
 *   "Example upgrade table" exactly once,
 * - carry the cost values from §12 cell-by-cell so the §12 progression
 *   (`Street -> Sport -> Factory -> Extreme`) round-trips without drift,
 * - resolve to a unique id when looked up via the registry.
 */

import { describe, expect, it } from "vitest";

import { UPGRADES, UPGRADES_BY_ID, getUpgrade, loadUpgrades } from "@/data/upgrades";
import {
  UpgradeCategorySchema,
  UpgradeSchema,
  type UpgradeCategory,
} from "@/data/schemas";

/**
 * §12 "Example upgrade table" cell-by-cell. Schema row order matches the
 * GDD's row order (engine, gearbox, dryTires, wetTires, nitro, armor,
 * cooling, aero). Tier index 1..4 corresponds to Street, Sport, Factory,
 * Extreme per §12 "Upgrade levels" (Stock = tier 0, implicit).
 */
const EXPECTED_PRICES: Record<UpgradeCategory, Record<1 | 2 | 3 | 4, number>> = {
  engine: { 1: 3000, 2: 6000, 3: 11000, 4: 18000 },
  gearbox: { 1: 2500, 2: 5000, 3: 9000, 4: 15000 },
  dryTires: { 1: 1200, 2: 2400, 3: 4200, 4: 6400 },
  wetTires: { 1: 1200, 2: 2400, 3: 4200, 4: 6400 },
  nitro: { 1: 2000, 2: 4500, 3: 8000, 4: 13000 },
  armor: { 1: 1800, 2: 3600, 3: 6200, 4: 9600 },
  cooling: { 1: 1000, 2: 2200, 3: 4000, 4: 6500 },
  aero: { 1: 1600, 2: 3000, 3: 5200, 4: 8800 },
};

describe("upgrade catalogue", () => {
  it("ships every category x tier 1..4 cell from §12 (32 entries)", () => {
    expect(UPGRADES.length).toBe(32);
  });

  it("indexes every upgrade uniquely by id", () => {
    expect(UPGRADES_BY_ID.size).toBe(UPGRADES.length);
    for (const u of UPGRADES) {
      expect(getUpgrade(u.id)).toBe(u);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(getUpgrade("definitely-not-an-upgrade")).toBeUndefined();
  });

  it("loadUpgrades returns the registry without throwing", () => {
    expect(loadUpgrades().size).toBe(UPGRADES.length);
  });

  it("covers every (category, tier) cell exactly once", () => {
    const counts = new Map<string, number>();
    for (const u of UPGRADES) {
      const key = `${u.category}:${u.tier}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const cat of UpgradeCategorySchema.options) {
      for (const tier of [1, 2, 3, 4] as const) {
        const key = `${cat}:${tier}`;
        expect(counts.get(key) ?? 0).toBe(1);
      }
    }
  });
});

describe.each(UPGRADES.map((u) => [u.id, u] as const))(
  "upgrade JSON: %s",
  (_id, upgrade) => {
    it("validates against UpgradeSchema", () => {
      const result = UpgradeSchema.safeParse(upgrade);
      if (!result.success) {
        throw new Error(
          `UpgradeSchema rejected ${upgrade.id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });

    it("matches the §12 'Example upgrade table' price for its (category, tier)", () => {
      const tierPrices = EXPECTED_PRICES[upgrade.category];
      expect(tierPrices).toBeDefined();
      const expected = tierPrices[upgrade.tier as 1 | 2 | 3 | 4];
      expect(expected).toBeDefined();
      expect(upgrade.cost).toBe(expected);
    });

    it("declares at least one numeric effect (UpgradeEffectsSchema invariant)", () => {
      const numericEffects = Object.values(upgrade.effects).filter(
        (v) => typeof v === "number",
      );
      expect(numericEffects.length).toBeGreaterThanOrEqual(1);
    });
  },
);
