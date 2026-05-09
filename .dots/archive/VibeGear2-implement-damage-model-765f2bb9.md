---
title: "implement: damage model per §13"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:02.711823-05:00\\\"\""
closed-at: "2026-04-26T05:07:14.876984-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-phase-1-7aef013d
---

## Description

Build `src/game/damage.ts`. Implement the damage system: hit events, damage accumulation by zone (engine, tires, body), performance penalties from accumulated damage, repair cost mapping, and total wreck threshold (DNF or auto-tow).

## Context

Phase 2 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/13-damage-repairs-and-risk.md`. Damage feeds the economy (repair costs) and the upgrade system (armor / cooling reduce intake rate).

## Affected Files

- `src/game/damage.ts` (new): pure damage functions
- `src/game/__tests__/damage.test.ts` (new): hit accumulation, performance falloff curves, threshold
- `src/game/raceSession.ts` (update): wire damage events from physics collision detection

## Edge Cases

- Hit at zero speed: minimal damage (touching, not crashing).
- Cumulative damage past wreck threshold: race ends as DNF.
- Repair cost when undamaged: zero, no UI prompt.
- Armor upgrade max tier: damage rate floored, never zero.

## Verify

- [ ] `applyHit(state, hit)` accumulates per-zone damage with the §13 zone weights (engine, tires, body) within `1e-6` tolerance for a known fixture sequence.
- [ ] Performance-penalty curve: at `engineDamage = 0.5`, top-speed multiplier matches the §23 falloff table within `1e-6`; at `engineDamage = 1.0`, multiplier is the §23 floor (not zero).
- [ ] Wreck threshold: `totalDamage >= 1.0` causes `state.status === "DNF"` on the same tick; the race-rules engine sees this on its next read.
- [ ] Repair cost lookup: for each zone tier in §23 balancing-table, the unit test asserts the credits cost cell-by-cell against the table.
- [ ] Determinism: 1000 invocations of `applyHit(stateA, hitA)` produce deep-equal output (no `Math.random`).
- [ ] Armor upgrade tier 4 floors the damage rate at the §13 floor (e.g. 25%) and never reduces to zero.
- [ ] Idle / no-hit tick: `step(state, NO_HIT)` returns deep-equal state (state unchanged).
- [ ] `raceSession.ts` integration test: a scripted collision in a fixture race produces exactly one `damage` event in the race-state log with the expected zone and magnitude.
- [ ] No em-dashes in any added file (`grep -P "[–—]" src/game/damage.ts src/game/__tests__/damage.test.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## Hand-off from F-015 (persistent off-road damage)

F-015 in `docs/FOLLOWUPS.md` (filed by the §10 arcade-physics slice) is owned by this dot. §10 says "increase damage slightly if the player persists off-road at high speed". `src/game/physics.ts` currently ships drag + an off-road speed cap but defers damage because the damage state machine does not exist yet. When this slice lands:

- Plumb a `damage` accumulator (or the per-zone accumulator from `damage.ts`) into the physics `CarState`.
- In `step(state, input, stats, context, dt)`: when `Math.abs(state.x) > roadHalfWidth`, increment the body-zone damage by a small constant proportional to `state.speed * dt` (suggested coefficient: enough that 5 s of off-road at top speed costs roughly the same as one mid-speed cone collision; pin a constant in §13's tuning constants surface and reference it from physics).
- Mark F-015 `done` in `docs/FOLLOWUPS.md` once the off-road accumulator lands and `physics.test.ts` adds an "off-road accumulates body damage at high speed" case.
- The off-road damage path must remain deterministic (no `Math.random`) per the §21 ghost / replay invariant; tests assert this by running the same input twice and asserting deep-equal output.

## Researcher Stress-Test (iter-19)

The Verify list is sharp; the Description and Affected Files are skinny. Five pins.

### 1. DamageZone enum and DamageState shape.

`docs/gdd/13-damage-repairs-and-risk.md` names "engine, tires, body" as zones (per spec line 13). Pin:

```ts
export type DamageZone = "engine" | "tires" | "body";

export interface DamageState {
  // Per-zone damage accumulated 0..1 (0 = pristine, 1 = catastrophic for that zone).
  zones: Record<DamageZone, number>;
  // Total damage 0..1 across zones (weighted sum). Drives DNF threshold.
  total: number;
  // Tick-stable accumulator for the §10 off-road persistent-damage path.
  offRoadAccumSeconds: number;
}

export const PRISTINE_DAMAGE_STATE: Readonly<DamageState> = {
  zones: { engine: 0, tires: 0, body: 0 },
  total: 0,
  offRoadAccumSeconds: 0,
};
```

DamageState is a sibling of `CarState` (not embedded) so `physics.step` can stay focused on motion. `raceSession.ts` owns the per-car damage map and feeds it back into physics for performance penalties.

### 2. Hit event schema.

```ts
export type HitKind = "rub" | "carHit" | "wallHit" | "offRoadObject" | "offRoadPersistent";

export interface HitEvent {
  kind: HitKind;
  // Damage magnitude before zone weights and armor; from §23 ranges.
  baseMagnitude: number;
  // Multiplier from §23 per-kind ranges. Caller supplies; deterministic.
  speedFactor: number;       // 0..1; high-speed hits are worse
  // Per-event override of the default zone distribution. Defaults applied when null.
  zoneOverride?: Partial<Record<DamageZone, number>>;
}
```

§23 "Damage formula targets" gives RANGES (`rubDamage = 2 to 4`, etc.) but no PRNG is allowed (Verify line: "no Math.random"). Pin: the caller (raceSession) picks a deterministic value within the range from the per-race RNG (depends on `seeded-deterministic-2ae383f2` shipping first, or sample mid-range deterministically `(min + max) / 2` until it does). DOC IT: "magnitude band collapse to mid-range until rng module ships; replay-determinism preserved".

### 3. Default zone distribution.

§13 names the zones but does not table the distribution. Pin defaults so implementation can proceed without another GDD pass:

```ts
const DEFAULT_ZONE_DIST: Record<HitKind, Record<DamageZone, number>> = {
  rub:               { engine: 0.05, tires: 0.50, body: 0.45 },
  carHit:            { engine: 0.20, tires: 0.30, body: 0.50 },
  wallHit:           { engine: 0.30, tires: 0.20, body: 0.50 },
  offRoadObject:     { engine: 0.25, tires: 0.40, body: 0.35 },
  offRoadPersistent: { engine: 0.10, tires: 0.20, body: 0.70 },
};
```

These are placeholders; balancing-pass-71a57fd5 owns the final values. File `Q-NNN` against §13 if dev wants different defaults.

### 4. Performance penalty curves.

Spec Verify line: "at engineDamage = 0.5, top-speed multiplier matches the §23 falloff table within 1e-6". §23 has no falloff table. The "performance falloff curves" table is missing from the GDD. Pin:

```ts
// Linear falloff from full performance at 0 damage to floor at 1.0 damage.
export const PERFORMANCE_FLOOR = {
  engine: 0.55,    // top speed and accel multiply by this at 100% engine damage
  tires:  0.65,    // grip multiplies by this at 100% tires damage
  body:   1.00,    // body damage does not directly degrade performance, only feeds total/DNF
};

export function performanceMultiplier(zone: DamageZone, damage: number): number {
  // Linear: 1 - damage*(1-floor). damage=0 -> 1.0; damage=1 -> floor.
  const floor = PERFORMANCE_FLOOR[zone];
  return 1 - Math.max(0, Math.min(1, damage)) * (1 - floor);
}
```

File `Q-NNN` to ask dev whether to use a curved (e.g. `1 - x^2 * (1-floor)`) falloff. Linear is the conservative pin.

### 5. DNF / wreck threshold.

Spec line: "totalDamage >= 1.0 causes status === 'DNF'". Pin the total computation:

```ts
// Weighted total. Engine and body together drive DNF; tires alone cannot wreck a car (you can drive on rims).
export const TOTAL_DAMAGE_WEIGHTS: Record<DamageZone, number> = {
  engine: 0.45, tires: 0.20, body: 0.35,
};
export const WRECK_THRESHOLD = 0.95; // total reaches 0.95 -> DNF (not 1.0; gives a UI warning band)
```

`applyHit` clamps each per-zone value to `[0, 1]` and then recomputes `total = sum(zones[z] * TOTAL_DAMAGE_WEIGHTS[z])`. When `total >= WRECK_THRESHOLD`, the caller (race-rules) sees this and flips the car's `status` to `"dnf"`. The damage module does NOT mutate raceState; it returns a new DamageState only. The `status` change is owned by `raceRules.ts`.

### 6. Affected Files clarification.

- `src/game/damage.ts` (new): pure functions per (5), exports the constants.
- `src/game/__tests__/damage.test.ts` (new): cell-level §23 fixture, performance curve, zone distribution, threshold, purity, determinism.
- `src/game/raceSession.ts` (update): consumes `applyHit` per collision, passes `DamageState` to physics for performance multiplier reads. NO change to `physics.ts` signature; the multiplier lives in damage.ts and is read by raceSession when assembling the next physics call.
- `src/game/physics.ts` (NO update needed): performance multiplier is multiplied into `stats.topSpeed` and `stats.accel` at the call site by raceSession.ts. This keeps physics.ts pristine.
- F-015 hand-off: add a single `applyOffRoadDamage(state, speedMps, dt)` helper and wire it in raceSession (NOT physics, contra the F-015 hand-off note above; revise that note in the same PR to keep physics.ts decoupled). The off-road accumulator lives on DamageState, not CarState.

### 7. Sharper Verify list (replaces the existing list cell-by-cell).

- [ ] `applyHit(PRISTINE, {kind:"rub", baseMagnitude:3, speedFactor:0.5})` returns `{zones:{engine:~0.0008, tires:~0.0075, body:~0.0068}}` within 1e-6 (cell-by-cell expected from §23 mid-range collapse plus default zone dist plus speed factor; pin the exact expected number in the test, not a range).
- [ ] `applyHit(state, {kind:"carHit", baseMagnitude:9, speedFactor:1.0})` cumulative on a half-damaged engine: result.zones.engine clamps at 1.0 and overflow does not bleed into other zones.
- [ ] `performanceMultiplier("engine", 0.5)` returns `0.775` exactly (1 - 0.5 * (1 - 0.55) = 0.775).
- [ ] `performanceMultiplier("body", 1.0)` returns `1.0` (body never degrades performance).
- [ ] Wreck: state with `zones:{engine:1, tires:1, body:1}` returns `total >= WRECK_THRESHOLD`.
- [ ] Wreck: state with only tires=1 has `total === 0.20`, NOT wrecked.
- [ ] Repair cost lookup: `repairCostFor("body", damagePercent=0.5, repairFactor=1.0, tourTier=1)` matches `0.5 * 1.0 * 1.0 * BODY_BASE_COST` (depends on economy-upgrade-ff73b279 BODY_BASE_COST pin; otherwise this test imports from there).
- [ ] Determinism: 1000 invocations of `applyHit(stateA, hitA)` produce deep-equal output (no Math.random, no Date.now).
- [ ] Idempotent: `applyHit(state, {kind:"rub", baseMagnitude:0, speedFactor:0})` returns deep-equal state.
- [ ] Off-road accumulator: 5s of speed=topSpeed off-road accumulates body damage to within 5% of one carHit at speedFactor=0.5 (the §10 hand-off note).
- [ ] No em-dashes (`grep -P '[\x{2013}\x{2014}]' src/game/damage.ts src/game/__tests__/damage.test.ts` returns nothing).
