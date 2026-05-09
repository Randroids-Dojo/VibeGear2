---
title: "implement: accessibility assists (auto-accelerate, brake assist, steering smoothing, hold/toggle nitro, reduced-input, visual-only weather) per §19"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:15:11.642462-05:00\\\"\""
closed-at: "2026-04-26T07:20:22.414202-05:00"
close-reason: verified
---

## Description

Implement the §19 'Accessibility controls' bundle as toggleable assists in `SaveGameSettings.assists`. Each assist is a pure function applied to the input stream BEFORE `mergeInputs` returns the resolved `InputState`. Sources: §19, §20 (HUD must reflect assist state), §22 (`SaveGameSettings.assists` shape).

## Context

GDD source of truth: `docs/gdd/19-controls-and-input.md` ('Accessibility controls' subsection), `docs/gdd/20-hud-and-ui-ux.md`, `docs/gdd/22-data-schemas.md`. The current `SaveGameSettings` example only enumerates three assists; the full set is six. The savegamesettings dot owns the schema expansion; this dot consumes it.

## Affected Files

- `src/game/assists.ts` (new): pure `applyAssists(input: InputState, assists: AssistSettings, ctx: { surface, weather, speed }): InputState`
- `src/game/__tests__/assists.test.ts` (new): unit cover each of the six assists, on/off
- `src/game/input.ts` (update): call `applyAssists` after `mergeInputs`; pass current settings via options
- `src/data/schemas.ts` (update): expand `AssistsSchema` to all six fields
- `src/components/options/AccessibilityPane.tsx` (new): UI panel rendered inside /options under the Accessibility tab; six labelled toggles

## Edge Cases

- Auto-accelerate + brake input simultaneously: brake wins; auto-accel does not fight a held brake.
- Brake assist: detects upcoming corner via projected curvature ahead; only applies when speed > corner safe speed.
- Steering smoothing: low-pass filter; documents time constant (e.g. 80 ms).
- Hold-vs-toggle nitro: respects the nitro state machine's input semantics in the nitro dot.
- Reduced simultaneous input: inputs queued one at a time; resolved per fixed step.
- Visual-only weather mode: physics ignores weather grip penalties; visuals still render rain/snow.

## Verify

- [ ] All six assists individually unit-tested with on and off paths.
- [ ] Applying assists is idempotent: `applyAssists(applyAssists(x))` equals `applyAssists(x)`.
- [ ] /options Accessibility tab renders six toggles with stable data-testids.
- [ ] Toggling persists into save and survives reload (use existing localstorage save module).
- [ ] HUD shows a small badge when any assist is active per §20 (data-testid `hud-assist-badge`).
- [ ] Determinism: with assists fixed, identical input streams produce deep-equal output.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
