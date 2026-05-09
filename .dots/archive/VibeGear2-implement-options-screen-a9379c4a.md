---
title: "implement: options screen route /options (settings UI scaffold)"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:14:00.215641-05:00\\\"\""
closed-at: "2026-04-26T04:24:49.475168-05:00"
close-reason: verified
---

## Description

Create the `/options` route as a scaffold for the settings UI (audio levels, accessibility assists, key remap entry point, performance settings, difficulty preset). This dot ships the route + layout + persistence wiring but defers each individual settings sub-pane to its specific dot (key-remap, performance-settings, 28-difficulty, savegamesettings).

## Context

GDD source of truth: `docs/gdd/19-controls-and-input.md` (remapping is first-class), `docs/gdd/20-hud-and-ui-ux.md` (Options screen requirement), `docs/gdd/22-data-schemas.md` (`SaveGameSettings` shape). This route closes the title-screen 'Options' button gating.

## Affected Files

- `src/app/options/page.tsx` (new): tabbed scaffold with sections (Display, Audio, Controls, Accessibility, Difficulty, Performance)
- `src/app/options/layout.tsx` (new if needed): shared chrome
- `src/app/options/page.module.css` (new): styles
- `src/app/options/__tests__/page.test.tsx` (new): RTL renders all six tab panels; keyboard arrow-key navigation between tabs
- `e2e/options-screen.spec.ts` (new): smoke spec navigates from / to /options, tabs through panels

## Edge Cases

- Each pane shows a 'Coming soon' placeholder with the dot id of the slice that lands it (e.g. 'Controls -> see VibeGear2-implement-key-remap-...'). When that slice lands, it edits this scaffold to replace the placeholder.
- The 'Reset to defaults' button is disabled until `SaveGameSettings` v2 schema lands.
- Pressing Esc on /options returns to the title screen (history.back fallback).

## Verify

- [ ] `/options` renders with six tab labels matching §20 layout.
- [ ] Tab navigation by arrow keys works (RTL test asserts focus shifts).
- [ ] Each tab panel has a stable `data-testid` (`options-tab-display`, `options-tab-audio`, etc.).
- [ ] Placeholder text in each panel cites the implementing dot id.
- [ ] Title-screen Options button (now-or-later wired by sibling dot) navigates here.
- [ ] Playwright smoke green.
- [ ] No em-dashes (grep -P '[\\x{2013}\\x{2014}]' on touched files returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.
