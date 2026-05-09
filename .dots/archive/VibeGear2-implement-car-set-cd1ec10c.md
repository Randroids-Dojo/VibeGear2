---
title: "implement: car set + stats per §11"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:25.058297-05:00\\\"\""
closed-at: "2026-04-26T01:44:19.035771-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-data-schemas-4dd373bc
---

## Description

Author the MVP car catalogue per `docs/gdd/11-cars-and-stats.md`. One JSON per car, conforming to the Car schema in §22. Wire the car selector into the garage flow.

## Context

Phase 3 task per `docs/IMPLEMENTATION_PLAN.md`. Cars are referenced by `activeCarId` in saves, by physics for stat lookups, and by the upgrade system for caps.

## Affected Files

- `src/data/cars/*.json` (new): one file per car listed in §11
- `src/data/__tests__/cars-content.test.ts` (new): validate each car JSON against the Zod schema
- `src/app/garage/cars/page.tsx` (new): car selector UI

## Edge Cases

- Player owns one car only: cannot sell active car.
- Car with `purchasePrice: 0`: starter car, granted on new save.
- Stat outside §23 balancing-table bounds: schema validation should reject.

## Verify

- [ ] All car JSONs validate against the schema.
- [ ] Stats match `docs/gdd/11-cars-and-stats.md` and `docs/gdd/23-balancing-tables.md`.
- [ ] Car selector renders all cars and lets the player pick one.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
