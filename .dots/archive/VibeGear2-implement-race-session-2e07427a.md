---
title: "implement: race-session damage wiring (per-car DamageState + multi-car collision + DNF flip) per §13 F-019"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T05:10:42.807773-05:00\""
closed-at: "2026-04-28T04:30:48.028975-05:00"
close-reason: "Already implemented by race-session damage, damage-scalar, hazards runtime, and PR #42 fixes: per-car DamageState, off-road damage, collision hits, wrecked DNF, physics scalars, F-019 closure, and regression tests are present on main."
blocks:
  - VibeGear2-implement-race-rules-b30656ae
  - VibeGear2-implement-hazards-runtime-6085799c
  - VibeGear2-implement-damage-band-3ffe5352
---

## Description

Wire the consumer side of the §13 damage producer that landed in `feat/damage-model`. The pure module `src/game/damage.ts` ships `applyHit`, `applyOffRoadDamage`, `performanceMultiplier`, `isWrecked`, `repairCostFor` and the constants surface, but there is no consumer: every car in the race-session today runs with `damageState = PRISTINE_DAMAGE_STATE` and no multiplier is applied to physics. This dot owns the wiring slice.

## Context

Source of truth: `docs/FOLLOWUPS.md` F-019 (filed by the damage-model commit), `docs/gdd/13-damage-repairs-and-risk.md`, `docs/gdd/10-driving-model-and-physics.md` "Road edge and off-road slowdown". The producer is `src/game/damage.ts` (HEAD); the consumers are `src/game/raceSession.ts`, `src/game/physics.ts` call site, and `src/game/raceRules.ts` (for the DNF flip path).

Sibling dots:
- `damage-band-3ffe5352` ships per-tick band-based scalars; this dot consumes `performanceMultiplier` until band scalars land then can swap.
- `hazards-runtime-6085799c` emits `HazardEvent` damage events; this dot routes them through `applyHit`.
- `race-rules-b30656ae` owns the `racing -> dnf` status transition; this dot adds the wreck-detection input it consumes.
- `seeded-deterministic-2ae383f2` ships the per-race RNG used to pick band magnitudes; until then collapse to mid-range deterministically.

## Affected Files

- `src/game/raceSession.ts` (update): add per-car `damageState: DamageState` field on `RaceSessionAICar` and on the player struct. On each tick: (a) call `applyOffRoadDamage(damageState, speed, dt)` when `isOffRoad(state.x)`; (b) detect car-car overlap via simple lane + z-bounding-box, emit one `applyHit({kind: "carHit", ...})` per pair-collision per tick (cooldown one tick to avoid double-counting); (c) check `isWrecked(damageState)` and report to raceRules.
- `src/game/raceRules.ts` (update): accept a per-car `wrecked: boolean` flag in `tickRaceRules`'s `carPositions` argument and flip `status` to `"dnf"` on the same tick the flag is true (mirrors §7 DNF rule).
- `src/game/physics.ts` call site (update raceSession only): wrap `stats.topSpeed *= performanceMultiplier("engine", zones.engine)`, `stats.accel *= performanceMultiplier("engine", zones.engine)`, `stats.grip *= performanceMultiplier("tires", zones.tires)` before each `step()` call. Do NOT modify `physics.ts` itself (keeps the §10 fixed-step contract pristine; see damage.ts dot Stress-Test §6).
- `src/game/__tests__/raceSession.test.ts` (new or update): scripted scenario with a player car and one AI: drive off-road for 5s, assert `damageState.zones.body > 0` and physics top-speed measurably lower; collide head-on, assert one carHit event and engine zone increment within ranges; cumulative damage triggers `isWrecked` and the next `tickRaceRules` flips the car to `dnf`.

## Pin: car-car collision detection

§13 names "rub" and "carHit" but no overlap geometry. Pin a deterministic axis-aligned bounding-box check:

```ts
const CAR_HALF_LENGTH_M = 2.4;
const CAR_HALF_WIDTH_M = 0.9;

function carsCollide(a: CarState, b: CarState): boolean {
  return Math.abs(a.z - b.z) < 2 * CAR_HALF_LENGTH_M
      && Math.abs(a.x - b.x) < 2 * CAR_HALF_WIDTH_M;
}
```

Per pair, emit at most one collision event per tick. Distinguish "rub" vs "carHit" by the relative speed: `|a.speed - b.speed| < 5 m/s` is a rub, otherwise carHit. `speedFactor = clamp(|a.speed - b.speed| / topSpeed, 0, 1)`. File Q-NNN if the dev wants a different geometry.

## Edge Cases

- DNF on the same tick a wreck happens: `tickRaceRules` flips status to `dnf` and the next physics step skips that car (consistent with race-rules dot §3 ladder).
- Off-road + collision on the same tick: both events apply; `applyOffRoadDamage` first, then `applyHit`. Order is deterministic by event kind, not arrival.
- Pause / resume during a wreck: `isWrecked` is a read of state, not a transition; resume preserves the wrecked flag.
- Damage band crossing on a tick where physics already read the multiplier: accept one tick of stale multiplier; documented in damage-band dot.
- Determinism: every input deterministic; no `Math.random`, no `Date.now`. The §22 seeded RNG (when it lands) supplies the magnitude band sample; until then collapse to `(min + max) / 2`.

## Verify

- [ ] `RaceSessionAICar` and player struct both carry `damageState: DamageState` initialised to `PRISTINE_DAMAGE_STATE`.
- [ ] After 5 seconds of `isOffRoad(x) === true` at top speed, `damageState.zones.body > 0` and `performanceMultiplier("engine", state.zones.engine) === 1.0` (off-road path hits body, not engine).
- [ ] Two cars overlapping in (x, z) within `CAR_HALF_*` thresholds emit exactly one `carHit` event on the colliding tick, then no event the next tick if they remain overlapping (one-tick cooldown).
- [ ] A car with `damageState` cumulative past `WRECK_THRESHOLD` reads `isWrecked() === true`, and the next `tickRaceRules` call flips that car's `status` to `"dnf"` and `finishedAtTick` is set.
- [ ] Physics call site applies `stats.topSpeed *= performanceMultiplier("engine", zones.engine)` and a 100% engine-damage car reaches PERFORMANCE_FLOOR.engine fraction of top speed under identical inputs.
- [ ] Determinism: 1000 runs of a fixture race produce deep-equal final `damageState` per car (no Math.random, no Date.now).
- [ ] `physics.ts` itself is not modified by this slice (signature unchanged; only the call site in raceSession.ts).
- [ ] No em-dashes (`grep -P '[\x{2013}\x{2014}]' src/game/raceSession.ts src/game/__tests__/raceSession.test.ts` returns nothing).
- [ ] `docs/FOLLOWUPS.md` F-019 marked `done` and F-015 marked `done` in the same PR.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/FOLLOWUPS.md` F-019, F-015
- `docs/gdd/13-damage-repairs-and-risk.md`
- `docs/gdd/10-driving-model-and-physics.md` (off-road, drafting wake)
- `src/game/damage.ts` (producer, HEAD)
- `.dots/archive/VibeGear2-implement-damage-model-765f2bb9.md` (Stress-Test pins)
- `.dots/VibeGear2-implement-race-rules-b30656ae.md` (DNF wiring)
