---
title: "implement: car set + Sparrow GT/Breaker S/Vanta XR baseline + 3 late-game cars per §11"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T01:52:10.049486-05:00\\\"\""
closed-at: "2026-04-26T02:28:08.441014-05:00"
close-reason: "Already implemented in repo at e490fc0: all six car JSONs (sparrow-gt, breaker-s, vanta-xr, tempest-r, bastion-lm, nova-shade) exist under src/data/cars/ and validate against CarSchema; src/data/cars/index.ts exports CARS, CARS_BY_ID, STARTER_CAR_ID, getCar; src/data/__tests__/cars-content.test.ts asserts all six cars, schema validation, §23 stat ranks, single starter purchasePrice=0; em/en-dash check clean. Closing as already-done."
---

## Description

Author the six MVP car JSONs from GDD §11 ("Cars and stats") and the runtime catalogue that the garage, race, and AI layers read from. Each car validates against the `CarSchema` from §22 and matches the numeric stats listed in the §11 example tables.

The six cars: three starters (Sparrow GT, Breaker S, Vanta XR) and three late-game cars (Tempest R, Bastion LM, Nova Shade). Six is the v1.0 cap per §27 / §24, so this slice fills the cap exactly.

This is a content slice. It does not author new code paths beyond the catalogue index; the consuming systems (physics, garage, AI) already read `CarSchema`-shaped data.

## Context

GDD §11 lists the canonical six-car set with stat tables (Top speed / Accel / Grip / Stability / Durability) on a 1-10 scale, plus role / strength / weakness commentary. The §22 `CarSchema` requires concrete numeric `baseStats` (topSpeed, accel, brake, gripDry, gripWet, stability, durability, nitroEfficiency), `purchasePrice`, `repairFactor`, `upgradeCaps` per category, and `visualProfile`.

§27 hard-caps v1.0 at 6 cars. §24 lists 6 playable cars under "Full v1.0 content". `implement-content-budget-e42cd8f9` enforces the cap. This dot fills the catalogue.

The 1-10 stat values in §11 are designer-facing; the runtime numbers in §22 (e.g. `topSpeed: 61.0`) are physics-facing. The mapping between the two is part of `implement-balancing-pass-71a57fd5`'s tuning pass; this dot ships the stat values per §11 and uses §22 example numbers as a starting baseline. `balancing-pass` may refine them later.

The blocking direction was historically pinned to `cd1ec10c`; the actual dot id is `26dc37be`. `balancing-pass` and `content-budget` `blocks:` lists must be updated in this same loop or in a follow-up edit so the graph resolves.

## Affected Files

- `src/data/cars/sparrow-gt.json` (new): balanced starter; baseStats per §22 example (topSpeed 61, accel 16, gripDry 1.0).
- `src/data/cars/breaker-s.json` (new): grip starter; higher gripDry / gripWet, lower topSpeed.
- `src/data/cars/vanta-xr.json` (new): power starter; higher topSpeed and accel, lower stability and gripWet.
- `src/data/cars/tempest-r.json` (new): late-game fast all-rounder.
- `src/data/cars/bastion-lm.json` (new): late-game enduro bruiser; high durability, low repair cost.
- `src/data/cars/nova-shade.json` (new): late-game ultimate specialist; max topSpeed, low durability.
- `src/data/cars/index.ts` (new): re-export every car JSON as a typed `Car[]` list and a `Map<CarId, Car>` lookup. Validates each entry against `CarSchema` at module load and throws on schema failure (caught in tests).
- `src/data/__tests__/cars-content.test.ts` (new): walk `src/data/cars/*.json`, assert each validates against `CarSchema`, assert exactly six cars exist, assert ids are unique, assert §11 stat-rank ordering holds (e.g. Nova Shade has the highest topSpeed numeric stat, Bastion LM has the highest durability numeric stat).
- `docs/PROGRESS_LOG.md` (existing): standard slice entry.

## Edge Cases

- `purchasePrice` for the three starter cars must be 0 (all are gifted at game start; the player picks one). Late-game cars have non-zero prices to be worked out by `balancing-pass`.
- Stat values in §11 are 1-10; §22 numerics are open-ended. The conversion table for this slice: §11 1-10 maps roughly to §22 numeric range as documented in a header comment of `index.ts`. `balancing-pass` may rewrite this mapping.
- `repairFactor` defaults to 1.0 except Bastion LM (≈ 0.7 per §11 "cheap repairs") and Nova Shade (≈ 1.5 per §11 "ultimate specialist", repair-expensive).
- `upgradeCaps` defaults from §22 example. Vanta XR `aero` cap may go to 4 (high-speed specialist) and Bastion LM `nitro` cap may drop to 3 (slower-launch enduro). Numeric tweaks belong to `balancing-pass`; this slice keeps the §22 example caps unchanged unless §11 explicitly contradicts.
- A seventh car JSON sneaking in (regression case) is caught by `cars-content.test.ts` ("exactly six cars exist").
- `weatherAffinity` per §11 stat list is a boolean-like preference; if the schema does not yet expose it, leave as a follow-up `F-NNN` rather than block this slice.
- Visual profile `spriteSet` and `paletteSet` strings reference assets that may not exist yet; the schema does not require those binaries to be present, so the JSON ships with placeholder names like `sparrow_gt` and `starter_a`. A separate art slice fills the binaries.

## Verify

- [ ] All six car JSONs validate against `CarSchema.safeParse` in the test file.
- [ ] `cars-content.test.ts` asserts exactly six entries (matches §27 cap).
- [ ] Stat-rank ordering test: Nova Shade has the highest `baseStats.topSpeed` numeric, Bastion LM has the highest `baseStats.durability`, Sparrow GT has the median balanced spread.
- [ ] `src/data/cars/index.ts` exports a typed `cars: Car[]` and a `carsById: Map<CarId, Car>`; both are deep-frozen.
- [ ] `installedUpgrades` skeleton in `src/persistence/save.ts` defaults all installed upgrade tiers to 0 for a freshly-purchased car; this slice does not change that, but the test fixture asserts the default works for each car id.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` are green.
- [ ] No em-dashes or en-dashes in any added file (`grep -P "[\\u2013\\u2014]" src/data/cars/*.json` returns nothing).
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/11-cars-and-stats.md` (canonical stat tables).
- `docs/gdd/22-data-schemas.md` (CarSchema example).
- `docs/gdd/24-content-plan.md` ("Full v1.0 content": 6 playable cars).
- `docs/gdd/27-risks-and-mitigations.md` (scope-creep cap of 6 cars).
