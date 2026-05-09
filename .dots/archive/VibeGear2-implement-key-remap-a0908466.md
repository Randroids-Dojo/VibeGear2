---
title: "implement: key remap UI + persistence (closes F-014) per §19 §20"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:42.342496-05:00\\\"\""
closed-at: "2026-04-29T19:26:34.114336-05:00"
close-reason: "Already implemented by F-014: /options Controls remap UI persists settings.keyBindings, e2e verifies conflict handling and race input consumption, coverage recorded as GDD-19-KEY-REMAPPING."
blocks:
  - VibeGear2-implement-savegamesettings-b948015a
  - VibeGear2-implement-hud-ui-6c1b130d
---

## Description

Build the user-facing key remap surface promised by §19 and slotted in §20 Settings. The screen lists every action from `DEFAULT_KEY_BINDINGS` (steer left / right, throttle, brake, nitro, handbrake, pause, shiftUp, shiftDown), shows the current bindings, lets the player click "rebind" then press a key (or gamepad button) to capture, validates against conflicts, and writes back to the save's `settings.keyBindings`. Reset-to-defaults button restores `DEFAULT_KEY_BINDINGS`. Closes F-014.

## Context

`createInputManager` already accepts a `bindings` override (see `src/game/input.ts`). The blocker has been the absence of (a) a save schema slot for bindings — owned by `implement-savegamesettings`, and (b) the UI to capture a new keypress and validate it. F-014 in `docs/FOLLOWUPS.md` captures the deferred work. §19 lists key remap as a first-class desktop feature.

## Affected Files

- `src/components/settings/KeyRemap.tsx` (new): action-by-action list, "rebind" button per row, capture modal, conflict warning, reset all.
- `src/game/inputCapture.ts` (new): pure helper `captureBinding(event) -> string | null` that returns the canonical token (`KeyboardEvent.code` preferred, fallback to `key` for non-letter keys; gamepad: `Pad:Button:N` style) or null for ignored modifiers (Tab, Shift alone).
- `src/game/inputCapture.test.ts` (new): KeyW -> "KeyW", Escape -> "Escape", Tab alone -> null, gamepad button 0 -> "Pad:Button:0".
- `src/components/settings/KeyRemap.test.tsx` (new, RTL): renders a list, simulates click + keypress, asserts the new binding renders; conflict between two actions surfaces a warning; reset button restores defaults.
- `src/app/settings/controls/page.tsx` (new): settings sub-route hosting `KeyRemap` (parent settings page from HUD-UI dot).
- `src/persistence/save.ts` (read-only): consumed via existing `loadSave` / `saveSave`. No changes here.
- `e2e/key-remap.spec.ts` (new): navigate to `/settings/controls`, rebind throttle from `KeyW` to `KeyZ`, navigate to `/race`, press Z, assert speed > 0; press W, assert no acceleration.
- `docs/FOLLOWUPS.md` (modify): mark F-014 `done` once landed.

## Edge Cases

- Conflict: rebinding action A to a token already used by action B prompts "Replace binding for B?" before committing; cancelling leaves both bindings unchanged.
- Capturing a system-reserved key (`Tab`, `F5`, `F12`): rejected with a tooltip; capture returns null.
- Multiple bindings per action: §19 allows alternates; UI exposes "+ Add alternate" with the same conflict-validation pipeline.
- Empty bindings array for an action: warn but allow; the action becomes unbound. A "reset" button always restores defaults.
- Save quota exceeded on persist: fall back to a transient toast and keep the in-memory bindings until next attempt.

## Verify

- [ ] `captureBinding` covers letter keys, arrow keys, modifiers-alone (returns null), `Pad:Button:N`, with a fixed-table Vitest case per token shape.
- [ ] `KeyRemap` RTL test simulates the full rebind flow including conflict warning and reset.
- [ ] Conflict validation rejects committing without explicit user confirmation.
- [ ] Reset button restores `DEFAULT_KEY_BINDINGS` and writes via `saveSave`.
- [ ] Settings persistence: rebinding throttle, navigating away, reloading, navigating back shows the new binding.
- [ ] Playwright e2e (`e2e/key-remap.spec.ts`) verifies a remapped key drives the car; the old default key no longer does.
- [ ] Empty bindings array warns but still saves; subsequent reset restores defaults.
- [ ] Settings page is keyboard-navigable (Tab through rows, Enter activates rebind).
- [ ] F-014 marked `done` in `docs/FOLLOWUPS.md`.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/components/settings src/game/inputCapture.ts src/app/settings/controls e2e/key-remap.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/19-controls-and-input.md`
- `docs/gdd/20-hud-and-ui-ux.md` (Settings)
- `docs/FOLLOWUPS.md` F-014
- `src/game/input.ts` (`DEFAULT_KEY_BINDINGS`, `InputManagerOptions.bindings`)
