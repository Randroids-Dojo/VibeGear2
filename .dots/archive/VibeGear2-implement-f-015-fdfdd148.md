---
title: "implement: F-015 wire applyOffRoadDamage into the race-session tick + performanceMultiplier into physics call site per §10 §13"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:52:10.485079-05:00\\\"\""
closed-at: "2026-04-26T14:20:07.255348-05:00"
close-reason: verified
---

F-019 is in-progress (race-session damage state + scalar wiring landed). The dedicated F-015 hook still needs the off-road branch:

§10 "Road edge and off-road slowdown" calls for "Increase damage slightly if the player persists off-road at high speed". The §13 damage module already exposes applyOffRoadDamage(state, speed, dt, assistScalars) with OFF_ROAD_DAMAGE_PER_M = 0.000107. F-047 wired the per-car DamageState into raceSession; F-019 wired the damageScalars into stepRaceSession. The F-015-specific gap is the off-road predicate gate around the damage emit.

Land:
1. In stepRaceSession's per-tick damage pass (src/game/raceSession.ts), confirm the player branch calls applyOffRoadDamage only when isOffRoad(player.x) returns true, with assistScalars resolved from the active difficulty preset.
2. Same path for AI cars whose lateral position satisfies isOffRoad(entry.x).
3. Confirm the resulting DamageState feeds getDamageScalars on the next tick (already wired by F-019) so persistent off-road damage shows up as topSpeed and grip degradation.
4. Unit tests pin: 5 s of top-speed off-road accumulates within 1% of one mid-speed carHit body share (per the producer note); on-road ticks emit zero off-road damage; assist scalars on the no-damage assist preset fully zero the emit.

Affected files:
- src/game/raceSession.ts (update): off-road branch.
- src/game/__tests__/raceSession.test.ts (update): off-road persistence cases.
- docs/FOLLOWUPS.md: F-015 marked done; F-019 closed once hazards-runtime path also lands.

Verify: ratchet pass; off-road damage persists across ticks and shows up as topSpeedScalar < 1 in the next stepRaceSession call.
