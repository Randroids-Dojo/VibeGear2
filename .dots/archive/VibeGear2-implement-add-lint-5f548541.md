---
title: "implement: add lint, type-check, and Vitest unit harness"
status: closed
priority: 1
issue-type: task
created-at: "\"2026-04-26T00:56:09.313821-05:00\""
closed-at: "2026-04-26T01:03:34.268349-05:00"
close-reason: Delivered together with the scaffold slice (feat/scaffold-next-app commit 554ef04). ESLint via next/core-web-vitals + next/typescript, tsc --noEmit strict, Vitest 2 with src/game/raceState.test.ts. npm run lint, typecheck, test, and verify all green.
blocks:
  - VibeGear2-implement-scaffold-next-1ca9bd3c
---

## Description

Wire ESLint, TypeScript strict type-check, and Vitest into the project. Provide `npm run lint`, `npm run typecheck`, and `npm run test` scripts. Add one trivial unit test to prove Vitest is wired.

## Context

`docs/IMPLEMENTATION_PLAN.md` §8 requires unit tests for new logic. `docs/WORKING_AGREEMENT.md` §6 requires lint, type-check, unit, integration, and e2e suites to pass before any slice is marked done. The DoD checklist in `AGENTS.md` requires no new lint warnings.

## Affected Files

- `package.json` (add devDeps: `eslint`, `eslint-config-next`, `vitest`, `@vitest/ui`, `typescript`, `@types/node`)
- `.eslintrc.cjs` or `eslint.config.mjs` (new)
- `tsconfig.json` (ensure `"strict": true`)
- `vitest.config.ts` (new)
- `src/game/__tests__/sanity.test.ts` (new, asserts `1 + 1 === 2`)
- `package.json` scripts: `lint`, `typecheck`, `test`, `test:watch`

## Verify

- [ ] `npm run lint` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run test` runs the sanity test and passes.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
