---
title: "implement: AI grid spawner + N-car race field per §15 §25 §22"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-26T02:19:56.616629-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-28T03:22:24.942522-05:00"
close-reason: "Merged PR #40 with deterministic AI grid spawner, first two tour rosters, race-route wiring, coverage ledger, green main CI, and production smoke."
blocks:
  - VibeGear2-implement-single-ai-4cdd40cd
  - VibeGear2-implement-tour-region-d9ca9a4d
---

## Description

Build the bridge between the AI archetype implementations and a populated race grid. Given a championship/tour AI driver list (or a quick-race config) and a track's spawn.gridSlots count, spawn N AI cars at the start line in deterministic grid order with archetype assignments. This is the slice that enables the §25 vertical-slice goal of a 12-car race field.

## Context

`implement-single-ai-4cdd40cd` ships one car. `implement-full-ai-fab57b84` ships archetype variety. Neither owns building the field of N opponents from a championship config. `docs/gdd/15-cpu-opponents-and-ai.md` describes per-archetype shape; `docs/gdd/22-data-schemas.md` Championship + AIDriver schemas list the per-tour AI roster; `docs/gdd/25-development-roadmap.md` Vertical Slice phase calls for "12-car race field". The MVP track JSON has `spawn.gridSlots` (default 12 in §22 example).

Without this slice, every race in the campaign or quick-race surface has only the player + one stub AI. Phase-1 demo is single-AI; this slice lights up Phase 3 race fields.

Depends on `implement-single-ai-4cdd40cd` (the AI tick fn exists) and `implement-tour-region-d9ca9a4d` (for the championship roster shape). Blocks `implement-tagged-release-b3d30084` indirectly via the v1.0 content goal.

## Affected Files

- `src/game/aiGrid.ts` (new): `spawnGrid({trackSpawn, aiDrivers, seed}) -> SpawnedCar[]`. Pure. Each SpawnedCar has `{driverId, archetype, gridSlot, startX, startZ, lane}`.
- `src/game/__tests__/aiGrid.test.ts` (new): N drivers + M slots (M >= N) packs first M into the grid; deterministic order from seed; same seed yields identical grid; lane assignment respects laneCount.
- `src/game/raceSession.ts` (update): use `spawnGrid` to build the initial AI list instead of hardcoded one car.
- `src/data/championships/world-tour-standard.json` (update if exists or stub): per-tour AI roster of 11 driver IDs so each race fields 12 cars (player + 11 AI).
- `e2e/twelve-car-field.spec.ts` (new): load a track with gridSlots=12, count rendered cars on the first frame, assert == 12.

## Edge Cases

- More AI drivers than grid slots: take the first `gridSlots - 1` drivers (player takes slot 0). Log a debug note.
- Fewer AI drivers than slots: leave trailing slots empty; the field is shorter, no synthesis.
- Duplicate driver IDs in the roster: schema-reject upstream; this slice trusts the validated input.
- gridSlots == 1: only the player races, no AI. Practice / time-trial fall through this path.
- Seed missing: derive from track id + race date so a fresh quick-race is still deterministic.

## Verify

- [ ] `spawnGrid` is pure: 1000 calls with the same input return deep-equal output.
- [ ] Determinism across seeds: different seeds permute archetype-to-slot assignment but never duplicate a driver.
- [ ] Lane spread: with laneCount=3 and 12 cars, no two cars share `(gridSlot, lane)`.
- [ ] More-drivers-than-slots and fewer-drivers-than-slots cases tested.
- [ ] Phase-1 demo route (`/race`) still works with the new grid path (player + 1 AI is the trivial case).
- [ ] e2e: 12 cars visible on first frame of a 12-slot track.
- [ ] No em-dashes in any added file (`grep -rP "[\x{2013}\x{2014}]" src/game/aiGrid.ts src/game/__tests__/aiGrid.test.ts e2e/twelve-car-field.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/15-cpu-opponents-and-ai.md`
- `docs/gdd/22-data-schemas.md` (Championship, AIDriver, Track.spawn)
- `docs/gdd/25-development-roadmap.md` (Vertical Slice phase)
