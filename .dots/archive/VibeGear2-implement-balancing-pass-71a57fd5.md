---
title: "implement: balancing pass per §23 tables"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T00:57:27.928473-05:00\""
closed-at: "2026-04-26T10:53:41.021308-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-car-set-26dc37be
  - VibeGear2-implement-economy-upgrade-ff73b279
---

## Description

Apply the numeric tables in `docs/gdd/23-balancing-tables.md` across cars, upgrades, AI, damage, and economy. This is a content-and-tuning slice, not a code-feature slice. Update existing JSON catalogues and the rare hard-coded constants in physics / economy modules.

## Context

Phase 3 task per `docs/IMPLEMENTATION_PLAN.md`. Closes the gap between schema-shape (already validated) and design intent (numeric correctness).

## Affected Files

- `src/data/cars/*.json` (update)
- `src/data/upgrades.json` (update)
- `src/data/ai/*.json` (update)
- `src/game/physics.ts` (update: tuning constants only)
- `src/game/economy.ts` (update: pricing constants)
- `src/data/__tests__/balancing.test.ts` (new): assert each numeric value matches §23 tables

## Edge Cases

- Numeric value outside the bounded range of its column in §23: test failure.
- Missing entry in §23: file Q-NNN to ask the dev for the value, do not guess.

## Verify

- [ ] Balancing test asserts all values match §23 tables.
- [ ] Manual race playtest: starting car feel matches the design pillars.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
