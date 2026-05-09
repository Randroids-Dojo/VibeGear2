---
title: "implement: cornering tuning pass to re-pin steerRate constants and per-car gripDry to §10 / §23 numbers after the lateral fix"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:36:33.688866-05:00"
blocks:
  - VibeGear2-implement-fix-lateral-b2503f6f
---

TUNING PASS, no equation changes. After the lateral-fix slice lands the displacement-per-tick collapses by 60x, so the §10 starter steer-rate band (low 2.3 / high 1.25 rad/s) needs re-validation against the §10 'tight at low speed, expressive at high speed' feel goals and the §23 per-car gripDry / topSpeed table. Affected: src/game/physics.ts STEER_RATE_LOW_RAD_PER_S / STEER_RATE_HIGH_RAD_PER_S (re-pin to the §10 starter / mid / late rows once feel is verified, plumbed per stats tier rather than a single global); src/data/cars/*.json baseStats.gripDry pinned to the §23 grip-dry column; src/game/__tests__/physics.test.ts adds 'starter car at 30 m/s full steer crosses lane in 1.0-1.8 s' and 'late-tier Nova Shade at 80 m/s full steer crosses lane in 1.4-2.2 s'. Verify: npx vitest run src/game/__tests__/physics.test.ts plus tests-e2e/race-feel-cornering-tuning.spec.ts that drives a Velvet Coast Sweep with starter Sparrow GT and asserts time-to-cross-lane is in the §10 band.
