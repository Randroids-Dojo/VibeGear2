---
title: "implement: difficulty preset selection UI in /options Difficulty pane per §15 §28"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:16:35.379643-05:00\\\"\""
closed-at: "2026-04-26T04:34:43.304136-05:00"
close-reason: verified
---

## Description

The §28 difficulty preset tuning dot ships the values; this dot ships the UI in the /options Difficulty tab so the player can pick Beginner / Balanced / Expert (or §15's Easy / Normal / Hard / Master) and see the live preview of what each preset toggles. Persists to `SaveGameSettings`.

## Context

GDD source of truth: `docs/gdd/15-cpu-opponents-and-ai.md` ('Difficulty tiers' table), `docs/gdd/28-appendices-and-research-references.md` (preset tuning values via sibling dot), `docs/gdd/20-hud-and-ui-ux.md` (Options screen requirement). Sibling dots: `implement-options-screen-...` (route scaffold), `implement-28-difficulty-...` (the values).

## Affected Files

- `src/components/options/DifficultyPane.tsx` (new): radio-group of preset names, expandable detail showing AI pace / mistakes / rubber-banding values from §15
- `src/components/options/__tests__/DifficultyPane.test.tsx` (new): RTL renders all presets, selecting a preset persists, the detail panel updates
- `src/data/schemas.ts` (update): `SaveGameSettings.difficultyPreset: 'beginner' | 'balanced' | 'expert' | 'master'`
- `src/app/options/page.tsx` (update): mount DifficultyPane in the Difficulty tab

## Edge Cases

- Difficulty change mid-tour: the active championship's difficultyPreset is fixed at tour-enter time; switching the UI preset only affects future tours. Document this in a `<Tooltip>` on the pane.
- Preset 'Master' is unlock-gated per §15; show locked state until the player completes one championship at Hard.
- Default = Balanced per §28 dot.

## Verify

- [ ] All four preset radio buttons render with stable testids.
- [ ] Selecting a preset persists to save (use existing localstorage save module).
- [ ] Detail panel shows the §15 row for the active preset (AI pace, rubber banding, mistakes, economy pressure).
- [ ] Locked Master tile cannot be selected; tooltip names the unlock condition.
- [ ] Default = Balanced on a fresh save.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
