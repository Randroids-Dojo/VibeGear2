/**
 * Runtime core. Fixed-step simulation, AI, race rules, economy.
 * See docs/gdd/21-technical-design-for-web-implementation.md §"Suggested module structure".
 */
export * from "./raceState";
export * from "./raceSession";
export * from "./raceSessionActions";
export * from "./raceRules";
export * from "./loop";
export * from "./input";
export * from "./physics";
export * from "./hudState";
export * from "./ai";
export * from "./damageBands";
export * from "./transmission";
export * from "./nitro";
export * from "./sectorTimer";
export * from "./rng";
export * from "./ghost";
export * from "./ghostDriver";
export * from "./timeTrial";
export * from "./assists";
export * from "./difficultyPresets";
export * from "./raceDamagePersistence";
// `raceBonuses` is the owner of the §5 bonus pipeline; `raceResult` is
// the §20 results-screen builder that consumes it. The two re-export the
// same `RaceBonus` / `RaceBonusKind` and the four bonus constants, so
// only `raceResult` is barrel-exported here to avoid duplicate-export
// ambiguity. Direct importers can still reach `raceBonuses` via
// `@/game/raceBonuses` for the tour-completion / sponsor surfaces.
export * from "./raceResult";
export * from "./tourProgress";
