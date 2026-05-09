---
title: "implement: browser compatibility matrix doc + smoke test results per §25 §27"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:22:58.981033-05:00\\\"\""
closed-at: "2026-04-29T22:17:25.905186-05:00"
close-reason: "Merged PR #115, main CI green, and production smoke passed at 98391f7."
blocks:
  - VibeGear2-implement-cross-browser-7cf643ce
---

## Description

Author `docs/BROWSER_COMPATIBILITY.md` capturing the supported-browsers matrix called for in `docs/gdd/25-development-roadmap.md` v1.0 phase. The matrix lists each combination of browser x OS x viewport tested, the agent or human who ran the smoke, the build SHA tested, the result (pass / fail with reproducer), and a per-row link to the Playwright report or screenshot. Updated on every release pass.

`implement-cross-browser-7cf643ce` runs the verification; this dot owns the *published* matrix that consumers (and contributors) read to know what is actually supported. The two slices ship together but the matrix is its own artefact.

## Context

§25 v1.0 phase deliverable "browser compatibility matrix" is currently uncovered. `docs/gdd/27-risks-and-mitigations.md` Browser performance row mitigates with adjustable settings; the matrix is the consumer-visible commitment that those settings are tested against real browsers. Without a published matrix, every contributor / player guesses what is supported.

Aligns with `docs/gdd/25-development-roadmap.md` Beta + v1.0 phases.

## Affected Files

- `docs/BROWSER_COMPATIBILITY.md` (new): the matrix.
- `docs/PROGRESS_LOG.md` (update on every release pass that updates the matrix).
- `README.md` (update): link to the matrix from the "Supported browsers" subsection.
- Optional: `scripts/print-browser-matrix.ts` to dump a fresh row from a Playwright run, but only if it stays simple.

## Edge Cases

- A combination that is supported but never automatically smoked (e.g. real Safari on macOS, since Playwright WebKit is a proxy): the matrix flags it as "manual smoke" with a date.
- A combination that fails: the row is kept (not deleted) with a fail flag and a reproducer link, so history is preserved.
- A combination that becomes unsupported (deprecated browser): the row is kept with a "dropped" flag and a date.
- Mobile browsers: out of scope until `implement-touch-mobile-061df755` lands; the matrix flags the gap explicitly.

## Verify

- [ ] `docs/BROWSER_COMPATIBILITY.md` exists and lists at minimum: Chromium-on-Linux, Firefox-on-Linux, WebKit-on-Linux (Playwright projects), Chrome-on-macOS, Safari-on-macOS, Edge-on-Windows, Steam-Deck-class browser.
- [ ] Each row has: browser, OS, viewport, build SHA, date, result (pass/fail/dropped), and a link to evidence.
- [ ] README links to the matrix.
- [ ] `implement-cross-browser-7cf643ce` updates the matrix as part of its verify list.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/25-development-roadmap.md` (v1.0 deliverables)
- `docs/gdd/27-risks-and-mitigations.md` (Browser performance row)
