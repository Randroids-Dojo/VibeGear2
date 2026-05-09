---
title: "implement: data schemas as TypeScript types and Zod validators (§22)"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:20.607782-05:00\\\"\""
closed-at: "2026-04-26T01:10:39.333767-05:00"
close-reason: Added src/data/schemas.ts with Zod validators + inferred TS types for Track, Car, Upgrade, Championship, AIDriver, SaveGame plus enums and nested records. 23 round-trip tests over §22 example fixtures (6 fixtures, 26 total tests passing). Slug regex permits snake_case to match §22 AI driver IDs. Lint, typecheck, test, build all green.
blocks:
  - VibeGear2-implement-add-lint-5f548541
---

## Description

Define TypeScript types and Zod runtime validators for every schema in `docs/gdd/22-data-schemas.md`: Track, Car, Upgrade, Championship, AI driver, Save-game. Provide a single import surface (`src/data/schemas.ts`) and unit tests that round-trip the example JSON shown in §22.

## Context

Phase 0 task per `docs/IMPLEMENTATION_PLAN.md`. Section §22 is the data contract every later phase depends on. `docs/WORKING_AGREEMENT.md` §6 requires data-driven content to be validated against the schema in CI.

## Affected Files

- `src/data/schemas.ts` (new): export Zod schemas + inferred TS types for `Track`, `Car`, `Upgrade`, `Championship`, `AIDriver`, `SaveGame`
- `src/data/__tests__/schemas.test.ts` (new): for each schema, parse the example JSON from §22 and assert `success === true`; for each schema, parse a deliberately broken example and assert `success === false`
- `src/data/examples/` (new): one fixture JSON per schema, copied verbatim from §22

## Edge Cases

- Empty `segments` array: invalid (track must have at least one segment).
- Missing `version` on save-game: invalid.
- Unknown enum values for `class`, `archetype`, `weather` options: invalid.
- Negative `cost`, `tier`, `lengthMeters`: invalid.

## Verify

- [ ] `npm run test` runs schema tests; all pass.
- [ ] `npm run typecheck` exits 0.
- [ ] Importing a schema from `src/data/schemas.ts` works in another module.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
