---
title: "implement: nitro system (3 charges, tap/hold, instability) per §10"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:14:22.181896-05:00\\\"\""
closed-at: "2026-04-26T05:32:41.201481-05:00"
close-reason: verified
---

## Description

Implement the nitro / boost mechanic per §10 'Nitro system': 3 charges per race by default, each charge tap-or-hold, base 1.1 s per charge, thrust + duration scale with the nitro upgrade tier, instability multiplier increases under poor traction (wet surface, off-road, damage band 50+%). Wire to keyboard (Space) and gamepad (X / Square) per §19.

## Context

GDD source of truth: `docs/gdd/10-driving-model-and-physics.md` ('Nitro system' subsection), `docs/gdd/19-controls-and-input.md` (nitro keys), `docs/gdd/12-upgrade-and-economy-system.md` ('Nitro system' upgrade category). Currently `src/game/physics.ts` does not expose nitro state; `src/game/input.ts` has a `nitro` action wired but no consumer.

## Affected Files

- `src/game/nitro.ts` (new): pure state machine `{ charges: number; activeUntilMs: number | null }` + reducer `tickNitro(state, input, dt)`
- `src/game/physics.ts` (update): accept `nitroAccelMultiplier` from caller; document the contract; keep nitro pure
- `src/game/__tests__/nitro.test.ts` (new): unit cover tap, hold, all charges expended, charge cooldown rule, instability multiplier under wet / damaged / off-road
- `src/game/raceState.ts` (update): include `nitro: NitroState` in `PlayerCarState`
- `src/game/raceSession.ts` (update if needed): reset nitro to 3 charges at race start

## Edge Cases

- Holding the key past the duration: charge auto-stops; cannot extend.
- Tapping while a charge is active: ignored (no charge stacking, per §10 'tap or hold' implies only one active at a time).
- Off-road + nitro = high spin risk: instability scalar applies in physics's traction term, not in nitro itself; nitro just exposes a 'isActive' boolean that physics multiplies.
- Damage band 50+%: nitro thrust efficiency drops per §10 'Damage effects on performance' (link to §13 dot).

## Verify

- [ ] `createNitroState({ charges: 3 })` returns frozen state.
- [ ] Tap input for one tick: starts a 1.1s window; `isActive(state)` true while remaining > 0; charge count decremented atomically.
- [ ] Hold input for 1.1s+: ends precisely at duration; cannot re-fire same charge.
- [ ] Tap with 0 charges: state unchanged; returns failure result `{ ok: false, code: 'no_charges' }`.
- [ ] Upgrade integration: nitro upgrade tier 4 increases base duration by the §12 Sport->Extreme curve; covered in unit test with explicit numbers.
- [ ] Instability scalar: `getInstabilityMultiplier(state, surface, weather, damageBand)` returns the documented table values; unit-cover all 6 weather x 4 surface x 5 damage cells (120 cases).
- [ ] Determinism: same input sequence produces deep-equal state across 1000 ticks.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
