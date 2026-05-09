---
title: "implement: add Playwright e2e harness and title-screen smoke"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:12.061509-05:00\\\"\""
closed-at: "2026-04-26T01:06:43.798409-05:00"
close-reason: "Added @playwright/test 1.48 with chromium project, e2e/title-screen.spec.ts smoke against production build on port 3100, npm scripts test:e2e + test:e2e:ui + verify:full. All checks pass (lint, typecheck, vitest, playwright smoke)."
blocks:
  - VibeGear2-implement-scaffold-next-1ca9bd3c
---

## Description

Configure Playwright for end-to-end testing. Add a single smoke test that boots the dev server, loads `/`, and asserts the page renders the title text. Wire `npm run test:e2e`.

## Context

`docs/IMPLEMENTATION_PLAN.md` Phase 0 requires an end-to-end harness. `docs/WORKING_AGREEMENT.md` §6 requires UI/feel changes to be exercised in a real browser. `docs/gdd/21-technical-design-for-web-implementation.md` calls Playwright out by name.

## Affected Files

- `package.json` (add devDep `@playwright/test`, script `test:e2e`)
- `playwright.config.ts` (new)
- `e2e/title-screen.spec.ts` (new, asserts `/` renders "VibeGear2")
- `.gitignore` (ignore `test-results/`, `playwright-report/`)

## Verify

- [ ] `npx playwright install` runs without error.
- [ ] `npm run test:e2e` boots dev server, runs the smoke test, and passes.
- [ ] On test failure, an HTML report is produced under `playwright-report/`.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
