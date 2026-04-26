/**
 * Car catalogue. Re-exports the MVP car set per docs/gdd/11-cars-and-stats.md
 * keyed by `Car.id` for quick lookup, plus the ordered `CARS` array for UI
 * lists (selector, garage, championship eligibility checks).
 *
 * Car JSON files validate against `CarSchema` from `@/data/schemas` via the
 * sibling `cars-content.test.ts` content test. The runtime registry keeps
 * the JSONs as the source of truth so modders can swap or extend the set
 * by replacing files (per docs/gdd/26-open-source-project-guidance.md).
 */

import type { Car } from "@/data/schemas";

import bastionLm from "./bastion-lm.json";
import breakerS from "./breaker-s.json";
import novaShade from "./nova-shade.json";
import sparrowGt from "./sparrow-gt.json";
import tempestR from "./tempest-r.json";
import vantaXr from "./vanta-xr.json";

/**
 * Ordered car list for UI presentation. Starters first (purchasePrice 0
 * granted on new save, then ascending price), late-game cars after.
 */
export const CARS: readonly Car[] = [
  sparrowGt as Car,
  breakerS as Car,
  vantaXr as Car,
  bastionLm as Car,
  tempestR as Car,
  novaShade as Car,
];

/** Lookup table keyed by `Car.id`. */
export const CARS_BY_ID: ReadonlyMap<string, Car> = new Map(
  CARS.map((car) => [car.id, car]),
);

/**
 * Fetch a car by id. Returns undefined when the id is unknown so callers
 * can decide how to handle missing references (e.g. broken save loads).
 */
export function getCar(id: string): Car | undefined {
  return CARS_BY_ID.get(id);
}

/** The id of the starter car granted on new save. */
export const STARTER_CAR_ID = "sparrow-gt";
