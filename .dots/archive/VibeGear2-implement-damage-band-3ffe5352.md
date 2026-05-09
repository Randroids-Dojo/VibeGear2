---
title: "implement: damage band performance scaling per §10 §13"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:16:18.626324-05:00\\\"\""
closed-at: "2026-04-26T05:14:08.842779-05:00"
close-reason: verified
---

## Description

Implement the damage-band -> performance scalars table from §10 'Damage effects on performance'. The damage model dot owns the damage state machine; THIS dot owns the per-tick lookup that maps current damage% to the (stability, gripScalar, topSpeedScalar, nitroEfficiency) multipliers consumed by physics.

## Context

GDD source of truth: `docs/gdd/10-driving-model-and-physics.md` ('Damage effects on performance' table), `docs/gdd/13-damage-repairs-and-risk.md`. Sibling dot `implement-damage-model-...` ships the damage-tick state machine; this dot is the pure math layer that physics calls each step.

## Affected Files

- `src/game/damageBands.ts` (new): pure `getDamageScalars(damagePercent: number): DamageScalars` returning `{ stability, gripScalar, topSpeedScalar, nitroEfficiency, spinRiskMultiplier }`
- `src/game/__tests__/damageBands.test.ts` (new): boundary values 0, 24, 25, 49, 50, 74, 75, 99, 100; band invariants (monotonic-decreasing where the GDD says so)
- `src/game/physics.ts` (update): consume the scalars; preserve fixed-step purity

## Edge Cases

- damagePercent < 0 or > 100: clamp; do not throw (physics should not crash on a stale value).
- damagePercent at exact boundary (25.000): table specifies bands 0..24, 25..49 inclusive; spec the rounding rule explicitly (>= 25 enters the 25..49 band).
- Band 100% (catastrophic): pin spinRiskMultiplier to a maximum; physics decides limp-vs-retire via the damage model dot, not here.

## Verify

- [ ] All 9 boundary values produce documented scalar tuples (snapshot test).
- [ ] Monotonic invariants: stability and topSpeedScalar non-increasing as damage rises.
- [ ] Out-of-range inputs clamp without throwing.
- [ ] Determinism: same damagePercent always returns the same scalars (no Date.now).
- [ ] Physics step() integration test: a car at 80% damage has measurably reduced top speed and grip vs. a 0% damage car under identical inputs.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
