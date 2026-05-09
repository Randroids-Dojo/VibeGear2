---
title: "implement: touch/mobile input source (closes F-013) per §19"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:42.340294-05:00\\\"\""
closed-at: "2026-04-26T02:24:57.644966-05:00"
close-reason: verified
---

## Description

Add a touch / mobile input source that feeds the existing `mergeInputs` pipeline so the keyboard + gamepad path is unchanged. Closes F-013 in `docs/FOLLOWUPS.md`. The control surface is a left-side virtual stick for steering, right-side accelerator + brake buttons, plus thumb-zone nitro and pause buttons. Layout follows the §19 deferred touch sketch.

## Context

`docs/gdd/19-controls-and-input.md` lists touch as a planned input modality but the keyboard + gamepad slice intentionally deferred it. F-013 in `docs/FOLLOWUPS.md` captures the deferral. `src/game/input.ts` already exposes `mergeInputs` and the `Input` shape, so a new source plugs in without touching the existing manager.

Mobile is the target form factor where keyboard + gamepad is unavailable; the goal is *playable* on a phone, not optimised. Multi-touch is required (steer + accelerator simultaneously). The touch source must coexist with keyboard so a desktop user with a touchscreen laptop can mix.

## Affected Files

- `src/game/inputTouch.ts` (new): pure helpers `inputFromTouchState(touchState) -> Input` and stateful `createTouchInputSource(opts) -> { sample(), dispose() }` that subscribes to a target element's `pointerdown / pointermove / pointerup / pointercancel` events. Steering returns a normalised `[-1, 1]` based on the dominant left-zone pointer's x-offset from its initial down position, clamped to a configurable max-radius.
- `src/game/inputTouch.test.ts` (new): pure helper covers initial down at center -> 0, drag right by max radius -> +1, drag left -> -1, no pointer in zone -> 0, multi-touch (left zone steer + right zone accelerate) returns both fields populated. Stateful manager tested via injected pointer event fixtures.
- `src/game/input.ts` (modify): export an optional `touchTarget` in `InputManagerOptions`; when set, the manager wires a touch source into the same `mergeInputs` step as keyboard + gamepad. No behaviour change when `touchTarget` is unset.
- `src/components/touch/TouchControls.tsx` (new): visual overlay (semi-transparent SVG circles for stick + buttons) rendered above the canvas only when `pointer:coarse` matches. Hidden by default on desktop.
- `src/app/race/page.tsx` (modify, future): mount `TouchControls` next to the canvas.
- `e2e/touch-input.spec.ts` (new): Playwright with `device: 'iPhone 13'` emulation; tap accelerator, assert speed > 0; drag steer-stick right, assert lateral x increases.
- `docs/FOLLOWUPS.md` (modify): mark F-013 `done` once landed.

## Edge Cases

- Pointer cancel mid-drag (e.g. system gesture): release the captured input as if the finger lifted.
- Two pointers in the same zone: the latest one wins for steering; oldest stays for accelerator (so the player can lift one finger without losing throttle).
- Orientation change: re-anchor the stick's neutral position to the next pointerdown.
- Accidental palm-rejection zones overlap the steering area: out of scope; a future calibration slice can address it.
- Reduced-motion accessibility pref: disables the visual jiggle of the stick knob, not the input itself.

## Verify

- [ ] Pure `inputFromTouchState` covers: empty state -> NEUTRAL_INPUT; one pointer in steer zone at +max -> `steer === 1`; accelerator zone tap -> `throttle === 1`; both zones touched -> both fields set.
- [ ] Stateful manager dispatches sampled `Input` per fixed step; unrelated DOM events are ignored.
- [ ] Multi-touch: two simultaneous pointers in different zones produce a merged `Input`.
- [ ] Pointer cancel releases captured input without throwing.
- [ ] Window blur clears all active pointers (mirrors keyboard blur behaviour).
- [ ] `mergeInputs` precedence: when both keyboard and touch produce non-neutral steer, the larger absolute value wins (document and test).
- [ ] `pointer:coarse` media query gates visibility of `TouchControls` (RTL with mocked `matchMedia`).
- [ ] Playwright e2e on emulated mobile: tap-and-drag drives the car; pause button opens the pause overlay.
- [ ] F-013 marked `done` in `docs/FOLLOWUPS.md`.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/inputTouch.ts src/game/inputTouch.test.ts src/components/touch e2e/touch-input.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/19-controls-and-input.md` (touch deferral)
- `docs/FOLLOWUPS.md` F-013
- `src/game/input.ts` (existing keyboard + gamepad manager + `mergeInputs`)
