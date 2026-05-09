---
title: "implement: off-road dust particles + physics surface flag (split from visual-polish)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:17:29.020779-05:00\\\"\""
closed-at: "2026-04-26T03:47:51.329606-05:00"
close-reason: verified
---

## Description

Two-part dot per stress-test item 8 of visual-polish-7d31d112: (1) extend `src/game/physics.ts` to expose `surface: 'road' | 'rumble' | 'grass'` on `CarState`; (2) ship dust particle pool in `src/render/dust.ts` that emits 1 particle per 2 ticks while surface is grass and speed > 8 m/s, lifetime 600 ms, MAX_DUST = 64.

## Context

Child of visual-polish-7d31d112. Source: `docs/gdd/10-driving-model-and-physics.md` ('Road edge and off-road slowdown'), `docs/gdd/16-rendering-and-visual-design.md`. Surface derived from |car.x| vs roadHalfWidth; rumble band is half-width to half-width*1.15.

## Affected Files

- `src/game/physics.ts` (update): emit `surface` per tick
- `src/game/__tests__/physics.test.ts` (update): unit cover surface transitions
- `src/render/dust.ts` (new): particle pool + tick + draw
- `src/render/__tests__/dust.test.ts` (new): emit rate, pool cap, lifetime
- `src/render/pseudoRoadCanvas.ts` (update): consume surface flag and dust

## Edge Cases

- Pool exhausted: oldest particle recycled (no allocation per emit).
- Surface = grass but speed below threshold: no emission.
- Surface flips road -> grass instantly: emit starts on the transition tick.
- Determinism: random horizontal velocity uses the §22 seeded RNG channel.

## Verify

- [ ] `physics.step()` emits `surface: 'road'` when |car.x| within road half-width; 'rumble' in the half-width..half-width*1.15 band; 'grass' beyond.
- [ ] Dust emits at 1 particle / 2 ticks while grass + speed > 8 m/s.
- [ ] `MAX_DUST = 64`: 65th emit overwrites the oldest.
- [ ] Lifetime 600 ms: a particle removed at exactly its 600 ms mark.
- [ ] Determinism: identical input + seed -> identical particle positions across two runs.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
