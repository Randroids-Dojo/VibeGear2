---
title: "implement: arcade physics (player car) per §10"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:35.278473-05:00\\\"\""
closed-at: "2026-04-26T01:58:28.187909-05:00"
close-reason: verified
---

## Description

Build `src/game/physics.ts`. Implement a deterministic arcade physics step for the player car: acceleration, top speed, brake, steering (lane-relative), and basic off-road / collision feedback. Inputs come from the keyboard layer. The function is pure: `(carState, input, trackContext, dt) -> carState`.

## Context

Phase 1 prerequisite per `docs/IMPLEMENTATION_PLAN.md`. Source of truth is `docs/gdd/10-driving-model-and-physics.md`. Numeric defaults come from `docs/gdd/11-cars-and-stats.md` and `docs/gdd/23-balancing-tables.md`. Determinism is mandatory per `AGENTS.md` RULE 8.

## Affected Files

- `src/game/physics.ts` (new): pure step function, no side effects
- `src/game/__tests__/physics.test.ts` (new): tests for accel curve, top-speed clamp, steering response, off-road slowdown, with float tolerances
- `src/app/dev/physics/page.tsx` (new): dev-only page that drives a car around a straight road for visual smoke

## Edge Cases

- Speed clamped at `topSpeed` from car stats (cannot exceed by accumulating accel).
- Brake while reversing: do not invert velocity past zero.
- Off-road for one frame: apply slowdown but no damage.
- Steering at zero speed: no lateral movement.
- dt of 0: state unchanged.

## Verify

- [ ] Unit tests pass with float tolerances (no `===` on floats).
- [ ] Determinism test: same `(state, input, dt)` produces same output across 1000 runs.
- [ ] `/dev/physics` lets the player accelerate, brake, and steer; behaviour matches the design pillars in §10.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
