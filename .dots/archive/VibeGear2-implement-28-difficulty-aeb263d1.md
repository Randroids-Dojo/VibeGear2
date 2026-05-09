---
title: "implement: §28 difficulty preset tuning values (Beginner/Balanced/Expert) into Settings + assists"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T02:37:44.285759-05:00\""
closed-at: "2026-04-26T10:24:46.485634-05:00"
close-reason: "verified: pure §28 binding module (getPreset/resolvePresetScalars) shipped with 15 unit tests pinning Beginner/Balanced/Expert/Master rows; consumer wiring deferred to F-042 to avoid PHYSICS_VERSION bump in this slice"
blocks:
  - VibeGear2-implement-savegamesettings-b948015a
  - VibeGear2-implement-damage-model-765f2bb9
---

## Description

Wire the §28 appendix tuning preset table into a runtime presets module. The
§28 "Example tuning values" table pins three named presets:

> **Researcher note (iter-30, 2026-04-26):** the player-facing difficulty
> preset enum has already landed as `PlayerDifficultyPresetSchema` in
> `src/data/schemas.ts` with values `'easy' | 'normal' | 'hard' | 'master'`
> (commit `2b06fb5`, §15 four-tier ladder). The championship-side
> `DifficultyPresetSchema` (`novice | easy | normal | hard | extreme`) is
> intentionally kept distinct: the player picker uses the §15 ladder, the
> championship value is captured at tour-enter time and may use the wider
> taxonomy. This dot's tuning scalars belong on the **player-facing** preset
> (the four §15 names). Map Beginner -> easy, Balanced -> normal, Expert ->
> hard, and add a §28-extrapolated row for Master (harsher than Expert
> along the same trend). The Affected Files list below still mentions
> `DifficultyPreset` as the keying enum; on landing, switch the keying enum
> to `PlayerDifficultyPreset` so the four-row table matches the schema.
> Drop the novice/extreme extrapolation entirely; those values do not exist
> on the player-facing enum.

| Setting                  | Beginner | Balanced | Expert |
| ------------------------ | -------- | -------- | ------ |
| Steering assist          | 0.25     | 0.10     | 0.00   |
| Nitro stability penalty  | 0.70     | 1.00     | 1.15   |
| Damage severity          | 0.75     | 1.00     | 1.20   |
| Off-road drag            | 1.20     | 1.00     | 0.95   |

These values are scalars but the current `AssistSettingsSchema`
(`src/data/schemas.ts`) carries only three booleans (`steeringAssist`,
`autoNitro`, `weatherVisualReduction`). The §28 appendix has no dot binding it
to runtime; this dot is that binding.

## Context

Phase 4 / Phase 5 task. The named "Beginner / Balanced / Expert" set is a
**display label** layer over the schema's underlying `DifficultyPreset` enum
(`novice / easy / normal / hard / extreme`); the appendix gives only three
points. Map Beginner -> easy, Balanced -> normal, Expert -> hard. Novice and
extreme inherit linear extrapolations.

This dot depends on `savegamesettings-b948015a` because the storage shape
expansion needs to land first (the §28 scalars belong on `SaveGameSettings`).
It blocks `damage-model-765f2bb9` because `damageSeverity` multiplier reads
from this preset.

## Affected Files

- `src/game/difficultyPresets.ts` (new): pin the §28 table as a frozen `Record<DifficultyPreset, AssistScalars>` and expose `getPreset(presetId): AssistScalars`. Also export `DEFAULT_PRESET_ID = "normal"`.
- `src/data/schemas.ts` (modify): extend `AssistSettingsSchema` with optional override scalars: `steeringAssistScale`, `nitroStabilityPenalty`, `damageSeverity`, `offRoadDragScale` each `z.number().min(0).max(2)`, plus `presetId: DifficultyPresetSchema`. The boolean assists stay for back-compat but are derived from the scalars (true if scalar != preset default).
- `src/persistence/migrations/v2ToV3.ts` (new): migrate existing v2 saves to populate the new fields from `presetId = "normal"`.
- `src/game/physics.ts` (modify): consume `steeringAssistScale` (multiplies steer authority) and `offRoadDragScale` (multiplies `OFF_ROAD_DRAG_M_PER_S2`).
- `src/game/damage.ts` (when it lands per damage-model dot): consume `damageSeverity`.
- `src/game/economy.ts` (when it lands): consume `nitroStabilityPenalty` for nitro-based score multipliers if any; otherwise the field affects the §13 nitro stability penalty path only.
- `src/components/settings/PresetPicker.tsx` (new): three-button picker (Beginner / Balanced / Expert) plus "Custom" that exposes the four scalars as sliders. Saves on change.
- `src/game/__tests__/difficultyPresets.test.ts` (new): pinned §28 table values, default preset is `normal`, getPreset returns frozen object, Beginner/Balanced/Expert label-mapping.
- `src/data/__tests__/settings-schema.test.ts` (update from savegamesettings-b948015a): assert the new fields validate.

## Edge Cases

- Existing v2 save with no preset fields: migration writes `presetId: "normal"` and the corresponding scalars.
- Custom values that don't match any preset's table: `presetId` flips to `null`-equivalent or to a sentinel `"custom"`. Decision: add `"custom"` to `DifficultyPresetSchema` enum; UI falls back to Custom mode if scalars don't match the preset table within `1e-6`.
- Out-of-range scalars: schema clamps to `[0, 2]`; the renderer / physics treats `0` as "fully off" (e.g. `steeringAssistScale = 0` removes assist).
- §28 only pins three preset rows; the schema enum has five values. Decision: extrapolate `novice` and `extreme` linearly from the §28 trend (novice = Beginner * 1.5 along the gentle direction; extreme = Expert * 1.2 along the harsh direction). Document the extrapolation in the dot before implementation; flag for design review.

## Verify

- [ ] `getPreset("easy")` returns `{ steeringAssist: 0.25, nitroStabilityPenalty: 0.70, damageSeverity: 0.75, offRoadDragScale: 1.20 }` (Beginner row).
- [ ] `getPreset("normal")` returns the Balanced row exactly.
- [ ] `getPreset("hard")` returns the Expert row exactly.
- [ ] `getPreset("novice")` and `getPreset("extreme")` return the documented extrapolation; tests pin the values.
- [ ] Schema rejects `steeringAssistScale = -0.1`, accepts `0.0`, `1.0`, `2.0`.
- [ ] Migration: a v2 save through `migrate(v2)` produces a v3 save with `presetId = "normal"` and all four scalars filled.
- [ ] Physics integration: `step()` with `steeringAssistScale = 0` produces identical lateral output regardless of input magnitude (the assist-fold contract); `steeringAssistScale = 0.25` (Beginner) cuts oversteer by 25%.
- [ ] Settings UI: clicking "Balanced" sets all four scalars to the Balanced row; clicking "Custom" enables sliders; reload preserves choice.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/28-appendices-and-research-references.md` (Example tuning values table).
- `docs/gdd/22-data-schemas.md` (DifficultyPreset enum, AssistSettings).
- `.dots/VibeGear2-implement-savegamesettings-b948015a.md` (settings expansion).
- `.dots/VibeGear2-implement-damage-model-765f2bb9.md` (damage severity consumer).
