/**
 * Upgrade catalogue. Re-exports the §12 upgrade table per
 * `docs/gdd/12-upgrade-and-economy-system.md` "Example upgrade table" keyed
 * by `Upgrade.id` for quick lookup, plus the ordered `UPGRADES` array for
 * UI lists (garage tabs, purchase modals).
 *
 * The JSON ships the §12 prices verbatim. Numeric `effects` values are
 * placeholder shapes in this slice (every upgrade declares at least one
 * effect so `UpgradeSchema` accepts it); the balancing-pass slice owns
 * the final per-tier deltas via §23. Mirror of `src/data/cars/index.ts`.
 *
 * Add a new upgrade by appending to `src/data/upgrades.json` and re-running
 * the `upgrades-content` test, which validates every entry against
 * `UpgradeSchema` and asserts the §12 (category x tier) coverage matrix.
 */

import { UpgradeSchema, type Upgrade } from "@/data/schemas";

import upgradesJson from "./upgrades.json";

/**
 * Ordered upgrade list for UI presentation. Entries follow the §12
 * "Example upgrade table" row order (engine, gearbox, dryTires, wetTires,
 * nitro, armor, cooling, aero) then ascending tier within each category.
 *
 * Cast through `unknown` keeps the JSON import in sync with the schema
 * without forcing a `z.parse` at module load (the content test runs the
 * full safeParse pass for every entry).
 */
export const UPGRADES: readonly Upgrade[] = (upgradesJson as unknown) as readonly Upgrade[];

/** Lookup table keyed by `Upgrade.id`. */
export const UPGRADES_BY_ID: ReadonlyMap<string, Upgrade> = new Map(
  UPGRADES.map((u) => [u.id, u]),
);

/**
 * Fetch an upgrade by id. Returns undefined when the id is unknown so
 * callers can decide how to handle missing references (e.g. broken save
 * loads, modder-supplied car JSON referencing a removed upgrade slug).
 */
export function getUpgrade(id: string): Upgrade | undefined {
  return UPGRADES_BY_ID.get(id);
}

/**
 * Validate every shipped upgrade entry against `UpgradeSchema`. Throws
 * on the first failure with the issue list embedded in the message so
 * the registry refuses to load against a corrupted JSON.
 *
 * Called from `loadUpgrades` for callers that want strict-mode loading.
 * Day-to-day reads use `UPGRADES_BY_ID` / `getUpgrade` directly since the
 * `upgrades-content` test pins shape correctness at CI time.
 */
export function loadUpgrades(): ReadonlyMap<string, Upgrade> {
  for (const entry of UPGRADES) {
    const parsed = UpgradeSchema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(
        `loadUpgrades: upgrade "${(entry as Upgrade).id}" failed schema validation: ${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  }
  return UPGRADES_BY_ID;
}
