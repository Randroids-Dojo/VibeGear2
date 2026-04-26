/**
 * Data layer. Zod schemas + inferred TypeScript types for every JSON contract
 * in docs/gdd/22-data-schemas.md, plus the bundled content registries
 * (cars, etc.) keyed by id for runtime lookup.
 */
export * from "./schemas";
export {
  CARS,
  CARS_BY_ID,
  STARTER_CAR_ID,
  getCar,
} from "./cars";
