---
title: "implement: manual transmission + gear shifting (E/Q + RB/LB) per §10 §19"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:14:53.183844-05:00\\\"\""
closed-at: "2026-04-26T05:23:47.325383-05:00"
close-reason: verified
---

## Description

Implement optional manual transmission per §10 'Gear shifting': automatic is default; toggling manual via Settings exposes shift-up (E / RB) and shift-down (Q / LB) inputs. Gearbox upgrades increase max gear count from 5 (stock) to 7 (Extreme); manual gives a small expert advantage on launches and out of corners but is never dominant.

## Context

GDD source of truth: `docs/gdd/10-driving-model-and-physics.md` ('Gear shifting' subsection), `docs/gdd/19-controls-and-input.md` (E/Q for keyboard, RB/LB for gamepad), `docs/gdd/12-upgrade-and-economy-system.md` (gearbox upgrade unlocks higher gears).

## Affected Files

- `src/game/transmission.ts` (new): pure state machine `{ mode: 'auto' | 'manual'; gear: 1..7; rpm: number }` + reducer
- `src/game/__tests__/transmission.test.ts` (new): auto upshift threshold, manual shift, redline limiter, downshift on brake
- `src/game/physics.ts` (update): consume `gearRatio` from transmission to compute torque curve
- `src/game/input.ts` (update): wire `shiftUp` / `shiftDown` actions; default bindings E/Q + RB/LB
- `src/data/schemas.ts` (update): add `transmissionMode: 'auto' | 'manual'` to `SaveGameSettings`

## Edge Cases

- Manual shift past max-gear-for-current-upgrade: ignored, brief 'limit' SFX hook.
- Auto mode: shift-up/shift-down inputs ignored (do not toggle to manual).
- Reverse gear: not part of this dot (out-of-scope; covered by physics reverse already on brake-from-stop).
- Redline limiter: rpm caps at 1.0 normalised; small accel penalty above 0.95.

## Verify

- [ ] Gear count by upgrade: stock 5, Street 5, Sport 6, Factory 6, Extreme 7. Unit test enumerates each tier.
- [ ] Auto upshift triggers at rpm > 0.85; downshift at < 0.4. Pinned constants exported and unit tested.
- [ ] Manual shift at redline: gear advances if available, else ignored.
- [ ] Manual mode advantage: at the same speed, optimal manual shift produces accel >= auto by a small (< 5%) margin documented in §10.
- [ ] Toggle persists in SaveGameSettings; reload survives.
- [ ] Determinism: identical input sequence produces deep-equal state.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
