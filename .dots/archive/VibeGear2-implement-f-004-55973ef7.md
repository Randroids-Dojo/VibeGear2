---
title: "implement: F-004 garage save/load Playwright e2e regression"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T02:02:42.346713-05:00\""
closed-at: "2026-04-26T14:39:58.666777-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-garage-flow-07f26703
---

## Description

Land the Playwright reload-survives-save test that the localStorage-save slice deferred (F-004 in `docs/FOLLOWUPS.md`). The test drives the garage UI to mutate save state, reloads the page, and asserts the value persisted. Closes F-004.

## Context

The original save/load slice unit-tested the persistence module against an in-memory Storage shim (15 cases, every path). The dot spec also asked for a Playwright reload-survives-save test, but the save module had no UI bindings yet (no garage screen, no options screen) so there was nothing meaningful to drive in a browser. The Garage flow dot (`implement-garage-flow-07f26703`) lands the UI bindings, so the regression test becomes implementable in its own small slice.

## Affected Files

- `e2e/save-persistence.spec.ts` (new): Playwright spec. Steps:
  1. Navigate to `/garage/cars`.
  2. Buy or select a non-default car (the active car id mutates).
  3. Reload the page.
  4. Assert the active car indicator is the same.
  5. Repeat for: buying an upgrade (in `/garage/upgrade` after the upgrade dot ships); changing a setting (units toggle in `/settings` after the HUD-UI dot ships).
- `docs/FOLLOWUPS.md` (modify): mark F-004 `done` with the spec path.
- `docs/PROGRESS_LOG.md` (append per §6).

## Edge Cases

- Storage quota exceeded mid-test: the save module already throws a typed error; the test expects the toast and asserts the prior state remains.
- localStorage disabled (Playwright option): the test is gated behind a single `test.skip(!hasStorage)` check that uses `page.evaluate(() => typeof localStorage)`.
- Multi-tab consistency: out of scope for v1; F-NNN if it surfaces.

## Verify

- [ ] `npm run test:e2e` includes the new spec, runs locally, and is green.
- [ ] CI's `verify` job runs Playwright and is green on PR.
- [ ] Mutating active car, reloading, and re-reading the save round-trips correctly.
- [ ] Storage-disabled branch skips cleanly with the expected reason in the report.
- [ ] F-004 marked `done` in `docs/FOLLOWUPS.md` with the spec path.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" e2e/save-persistence.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/FOLLOWUPS.md` F-004
- `src/persistence/save.ts`
- `implement-garage-flow-07f26703` (UI surface this test drives)
