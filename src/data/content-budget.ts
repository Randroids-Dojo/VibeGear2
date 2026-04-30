/**
 * Content budget caps for the v1.0 content set, per
 * `docs/gdd/27-risks-and-mitigations.md` ("Scope creep" row, hard cap of
 * 32 tracks and 6 cars) and `docs/gdd/24-content-plan.md` (MVP minimums of
 * 8 tracks and 3 cars).
 *
 * Single source of truth for the numeric caps. The companion test suite
 * `src/data/__tests__/content-budget.test.ts` walks `src/data/tracks/**` and
 * `src/data/cars/**` at test time and fails the build when a count crosses
 * one of these limits. Raising a cap requires editing this constant AND the
 * matching GDD row in the same PR (per the §27 mitigation contract).
 *
 * Stretch content (daily challenges, reverse tracks, modder packs) and
 * benchmark-only tracks under `src/data/tracks/_benchmark/` live outside
 * the v1.0 cap; the cap counts only files registered through the shipped
 * barrels (`src/data/tracks/index.ts`, `src/data/cars/index.ts`).
 */

export const CONTENT_BUDGET = Object.freeze({
  /** Maximum number of bundled tracks at v1.0 ship per §27 scope cap. */
  tracks: 32,
  /** Maximum number of bundled playable cars at v1.0 ship per §27 scope cap. */
  cars: 6,
  /** MVP minimum bundled track count per §24 "Suggested region and track list". */
  mvpTracks: 8,
  /** MVP minimum bundled playable car count per §24 "Suggested car set". */
  mvpCars: 3,
} as const);

export type ContentBudget = typeof CONTENT_BUDGET;
