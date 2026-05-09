---
title: "implement: SaveGameSettings schema expansion + v2 migration (audio, a11y, keybindings) per §19 §20 §22"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:38.180535-05:00\\\"\""
closed-at: "2026-04-26T10:07:18.644721-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-hud-ui-6c1b130d
  - VibeGear2-implement-sound-music-1611f9dd
  - VibeGear2-implement-key-remap-a0908466
---

## Description

Expand `SaveGameSettingsSchema` in `src/data/schemas.ts` to cover the full settings surface area enumerated in `docs/gdd/20-hud-and-ui-ux.md` and `docs/gdd/19-controls-and-input.md`: audio levels (master, music, sfx), accessibility prefs (color blind mode, reduced motion, large UI text, screen-shake intensity), key bindings (per-action token map), and game-feel assists already present. Bump `CURRENT_SAVE_VERSION` from 1 to 2, register a v1 to v2 migration that fills the new fields with documented defaults, and ensure existing v1 saves on disk round-trip cleanly through `loadSave`.

This is the **single coordinated owner** for SaveSchema growth driven by §19 / §20 surfaces. Without it, the HUD, Sound, and Key-remap dots each propose ad-hoc schema additions and the migration registry never gets the matching migration entry.

## Context

`docs/gdd/22-data-schemas.md` and `docs/gdd/21-technical-design-for-web-implementation.md` (Save system subsection) both treat the SaveSchema version as the single source of truth for save compatibility. `src/persistence/migrations/index.ts` already exposes a registry shape (`migrations[fromVersion] -> next-shape`) and refuses identity / skipping. The current `SaveGameSettingsSchema` only has `displaySpeedUnit` + three assist booleans. §20 settings page specifies controls, display, audio, accessibility, game feel assists, and profile / save clear. §19 specifies a control profile slot with re-mappable bindings.

Multiple downstream slices (HUD UI, Sound, Key-remap) need to read and write these new settings. Doing the schema work in one slice avoids three concurrent migrations and a race over `CURRENT_SAVE_VERSION`.

## Affected Files

- `src/data/schemas.ts` (modify):
  - `AudioSettingsSchema` (new) with `master`, `music`, `sfx` each `z.number().min(0).max(1)`.
  - `AccessibilitySettingsSchema` (new) with `colorBlindMode: z.enum(["off","protanopia","deuteranopia","tritanopia"])`, `reducedMotion: z.boolean()`, `largeUiText: z.boolean()`, `screenShakeScale: z.number().min(0).max(1)`.
  - `KeyBindingsSchema` (new) `z.record(z.string(), z.array(z.string()))` keyed by action with arrays of token aliases (matches the shape of `DEFAULT_KEY_BINDINGS` in `src/game/input.ts`).
  - Extend `SaveGameSettingsSchema` to include `audio`, `accessibility`, `keyBindings`. Keep `displaySpeedUnit` and `assists` as-is.
- `src/persistence/migrations/v1ToV2.ts` (new): pure function `(v1: unknown) => v2: SaveGame` that validates input as `SaveGameSchema_v1` (preserve the prior shape as a frozen schema constant) and fills `audio = { master: 1, music: 0.8, sfx: 0.9 }`, accessibility defaults, and `keyBindings = DEFAULT_KEY_BINDINGS`.
- `src/persistence/migrations/index.ts` (modify): bump `CURRENT_SAVE_VERSION` to 2, register `migrations[1] = v1ToV2`.
- `src/persistence/save.ts` (modify): `defaultSave()` returns a v2 save with the new defaults pre-filled.
- `src/data/__tests__/settings-schema.test.ts` (new): every new schema field validates expected and rejects unexpected.
- `src/persistence/migrations/v1ToV2.test.ts` (new): a v1 fixture (the previous default save) migrates cleanly with documented defaults; running migration twice is idempotent (second run rejects already-v2 input the same way the registry already rejects no-op identity).
- `docs/PROGRESS_LOG.md` (append per §6).

## Edge Cases

- A v1 save with extra unknown keys (forward-compat data left by a future agent): preserve unknown keys through migration unless the schema explicitly rejects them; current Zod settings use strict object so extras are stripped, document that.
- A v2 save with `keyBindings` referencing a binding token no longer in `DEFAULT_KEY_BINDINGS`: validate but log a warning at load time (not at schema time).
- `screenShakeScale: 0` must disable shake entirely without breaking any consumer that multiplies by it.
- `colorBlindMode !== "off"` does not require a corresponding LUT in this slice; the renderer slice consumes the field. Document that decoupling.

## Verify

- [ ] `npm run typecheck` clean: every schema export has a matching `z.infer` type and is re-exported from `src/data/index.ts`.
- [ ] `npm run test` covers: each new schema rejects out-of-range / wrong-type / missing-key inputs and accepts a documented happy-path fixture.
- [ ] `migrate({ ...v1Default, version: 1 })` returns a value that `SaveGameSchema.safeParse` accepts at version 2.
- [ ] `migrate({ ...v2Default })` is rejected (no-op identity) per the existing migration registry contract.
- [ ] `defaultSave()` round-trips through `saveSave` then `loadSave` and the rehydrated value is deep-equal.
- [ ] Existing `src/persistence/save.test.ts` fixtures updated to use v2 shape; the prior v1 fixture moves into `src/persistence/migrations/__fixtures__/v1-default-save.json` and is consumed by the migration test.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/data/schemas.ts src/persistence/migrations src/data/__tests__/settings-schema.test.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/19-controls-and-input.md`
- `docs/gdd/20-hud-and-ui-ux.md` (Settings, Pause menu)
- `docs/gdd/22-data-schemas.md` (SaveGame)
- `src/persistence/save.ts`, `src/persistence/migrations/index.ts`
- F-014 (key remap UI), F-013 (touch input)
