---
title: "implement: garage flow + screens per §5"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:08.362199-05:00\\\"\""
closed-at: "2026-04-27T22:21:02.924772-05:00"
close-reason: "Implemented and merged PR #33. Main CI and production deploy passed. Production smoke passed for title, race, results, garage, repair, and upgrade routes."
blocks:
  - VibeGear2-implement-damage-model-765f2bb9
  - VibeGear2-implement-economy-upgrade-ff73b279
---

## Description

Build the garage flow: results screen after a race, repair / upgrade UI, "next race" button. Pages: `/garage`, `/garage/repair`, `/garage/upgrade`. Read save state on mount, write changes back via the localStorage save module.

## Context

Phase 2 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/05-core-gameplay-loop.md`. The garage is the between-race economy interaction surface.

## Affected Files

- `src/app/garage/page.tsx` (new): summary, current car, credits
- `src/app/garage/repair/page.tsx` (new): per-zone repair selection
- `src/app/garage/upgrade/page.tsx` (new): upgrade catalogue, install button
- `src/components/garage/*` (new): shared UI primitives
- `e2e/garage-flow.spec.ts` (new): finish race -> garage -> buy upgrade -> start next race

## Edge Cases

- No car selected: prompt to select.
- Insufficient credits for any action: disable buttons with tooltip explanation.
- Save migration on version mismatch: handled by save module.

## Verify

- [ ] `/garage` renders the active car's name, the credits balance from save, and links to repair / upgrade / race; React Testing Library snapshot covers the steady-state markup.
- [ ] `/garage/repair` lists the §13 damage zones with current damage percent and a per-zone repair button; the button is disabled when `damage === 0` for that zone or when `credits < zoneRepairCost`.
- [ ] `/garage/upgrade` lists each upgrade category from `src/data/upgrades.json`, flags the currently-installed tier, and disables the next-tier button when `credits < cost` or the previous tier is not yet installed (sequential install rule).
- [ ] Buying an upgrade calls `economy.purchaseUpgrade`, decrements credits, increments the installed tier, and writes via `src/persistence/save.ts`. Reload the page and the new state survives (RTL test with mocked storage; Playwright covers the real localStorage path).
- [ ] Playwright e2e (`e2e/garage-flow.spec.ts`) walks: load `/race?track=test-straight` with a seeded save, finish a 1-lap race, redirect to `/garage`, click "Repair body", click "Buy engine tier 1", click "Next race", confirm `/race` boots with the upgrade applied (engine top-speed bonus visible in HUD speedometer at full throttle).
- [ ] Pre-race: if `garage.activeCarId` is null, `/garage` renders a "Pick your starter car" subview inline (no separate page) and lists the three starter cars from §11.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/app/garage src/components/garage e2e/garage-flow.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.
