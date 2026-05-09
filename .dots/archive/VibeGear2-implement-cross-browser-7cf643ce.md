---
title: "implement: cross-browser, performance, accessibility verification"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:55.817468-05:00\\\"\""
closed-at: "2026-04-29T21:47:33.598670-05:00"
close-reason: "Merged PR #113 and PR #114, main CI green, and production smoke passed at bfb5300."
blocks:
  - VibeGear2-implement-visual-polish-7d31d112
  - VibeGear2-implement-hud-ui-6c1b130d
---

## Description

Phase 6 hardening sweep: verify the game runs on Chrome, Firefox, Safari (desktop), and a Steam-Deck-class browser. Profile a representative race for performance regressions. Run accessibility checks (color contrast, keyboard-only navigation, prefers-reduced-motion).

## Context

Phase 6 task per `docs/IMPLEMENTATION_PLAN.md`. Risks and mitigations from `docs/gdd/27-risks-and-mitigations.md` are addressed here as a coordinated pass.

## Affected Files

- `e2e/playwright.config.ts` (update): add Firefox + Safari projects
- `src/render/pseudoRoadCanvas.ts` (update if perf issue found)
- `src/components/*` (update for a11y issues found)
- `docs/PROGRESS_LOG.md` (entry summarizing findings)
- `docs/FOLLOWUPS.md` (entries for issues deferred to future slices)

## Edge Cases

- Safari WebAudio quirks: handle suspended-context behaviour explicitly.
- Firefox Canvas2D anti-aliasing differences: visual diff acceptable, gameplay must not change.
- Steam Deck small-screen: HUD must not clip.

## Verify

- [ ] Playwright e2e suite green on Chromium, Firefox, WebKit.
- [ ] Manual smoke on real Safari and a Deck-size viewport.
- [ ] Lighthouse accessibility score ≥ 90 on title screen.
- [ ] Keyboard-only flow: title -> race -> garage works without mouse.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
