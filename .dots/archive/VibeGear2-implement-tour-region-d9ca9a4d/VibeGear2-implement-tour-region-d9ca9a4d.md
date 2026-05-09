---
title: "implement: tour + region structure per §8"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:19.435852-05:00\\\"\""
closed-at: "2026-04-28T00:17:48.018164-05:00"
close-reason: "Completed across PR #34, PR #35, and PR #36. Tour progression, active tour persistence, unlocks, failure handling, and full seeded browser flow are verified."
blocks:
  - VibeGear2-implement-race-rules-b30656ae
---

## Description

Implement the tour and region progression structure: a tour is four linked races, aggregate standings determine tour completion, completing tours unlocks regions. Read championship JSON conforming to §22.

## Context

Phase 3 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/08-world-and-progression-design.md` and `docs/gdd/24-content-plan.md`.

## Affected Files

- `src/game/championship.ts` (new): `enterTour`, `recordResult`, `tourComplete`, `unlockNextTour`
- `src/game/__tests__/championship.test.ts` (new): aggregate standings, unlock thresholds
- `src/data/championships/world-tour-standard.json` (new): example championship from §22
- `src/app/world/page.tsx` (new): map of regions, tour selection

## Edge Cases

- Tour DNF on one race: standings still aggregate (last place credited), tour can still be passed if other races compensate.
- Tour failure: option to retry the tour from race 1.
- Locked tour selection: button disabled with reason tooltip.

## Verify

- [ ] `enterTour(saveState, tourId)` returns a new save state with `progress.activeTour = { tourId, raceIndex: 0, results: [] }`; rejects when tour is locked (returns failure result, no mutation).
- [ ] `recordResult(activeTour, raceResult)` appends to `results[]` and increments `raceIndex`; never mutates the input.
- [ ] `tourComplete(activeTour, championship)` returns `{ passed: boolean, finalStandings: PlacementMap }` after race 4; standings sum points per the §7 / §22 placement table.
- [ ] Pass threshold: a tour passes when aggregate standing is `<= tour.requiredStanding`. Unit test covers boundary cases (`requiredStanding === 4` -> pass on 4, fail on 5).
- [ ] `unlockNextTour(saveState, completedTourId, championship)` adds the next tour id from the championship list to `progress.unlockedTours`; the final tour unlocks nothing.
- [ ] DNF in race 1 does not abort the tour: standings still aggregate (DNF gets last place credited per §7); tour can still be passed if other races compensate.
- [ ] Tour failure: `progress.activeTour` clears and the player can retry from race 1.
- [ ] `/world` renders one card per tour from `championship.json`; locked tours show a disabled "Enter" button with a tooltip naming the gating tour. RTL snapshot covers locked / unlocked states.
- [ ] Playwright e2e (`e2e/tour-flow.spec.ts`): seed save with championship and starter car, click "Enter Velvet Coast", finish 4 scripted 1-lap races (Up arrow), assert "Iron Borough" tile becomes unlocked.
- [ ] Determinism: same seed and same scripted inputs across two e2e runs produce identical aggregate standings.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/championship.ts src/data/championships src/app/world e2e/tour-flow.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.
