---
title: "implement: drafting / slipstream per §10"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:14:34.483438-05:00\\\"\""
closed-at: "2026-04-26T05:00:05.198760-05:00"
close-reason: verified
---

## Description

Implement the optional slipstream / drafting bonus per §10 'Drafting': activate above a speed threshold, small acceleration bonus after 0.6s in the wake of another car, breaks instantly on side movement or brake input.

## Context

GDD source of truth: `docs/gdd/10-driving-model-and-physics.md` ('Drafting' subsection). Pure helper that sits next to physics; does not alter the fixed-step contract.

## Affected Files

- `src/game/drafting.ts` (new): pure helpers `computeWakeOffset(leader, follower)`, `tickDraftWindow(state, dt)` that produces an additive accel multiplier
- `src/game/__tests__/drafting.test.ts` (new): cases for in-wake/out-of-wake, threshold speed, side-step break, brake break
- `src/game/physics.ts` (update): consume optional `draftBonus: number` in step()

## Edge Cases

- Multiple cars in line: only the closest leader counts (single source).
- Leader brakes hard mid-window: window breaks instantly via brake-input flag, not via speed differential.
- Follower side-steps within tolerance (e.g. 0.3 m): window does not break.

## Verify

- [ ] `computeWakeOffset({ x: 0, progress: 100 }, { x: 0.1, progress: 99 })` returns `{ inWake: true, ageMs: 0 }` for first call.
- [ ] After 600 ms continuous, `tickDraftWindow` returns `accelMultiplier > 1.0`.
- [ ] Brake input flag mid-window resets ageMs to 0.
- [ ] Lateral offset > 1.5 m breaks the window.
- [ ] Speed below threshold (e.g. 30 m/s) returns `accelMultiplier === 1.0`.
- [ ] Determinism: identical inputs produce deep-equal state.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
