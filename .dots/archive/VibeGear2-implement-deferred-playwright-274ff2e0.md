---
title: "implement: deferred Playwright e2e specs (F-016 pause overlay + error boundary, F-017 touch input, F-018 loading screen)"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:00:44.130754-05:00\\\"\""
closed-at: "2026-04-26T05:49:00.590049-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-add-playwright-64eb2a44
---

Land the three Playwright e2e specs that prior slices deferred because the harness was not yet configured. Closes F-016, F-017, and F-018 in docs/FOLLOWUPS.md.

## Context

Three slices in iterations 14-16 shipped their unit tests but deferred their Playwright specs because no harness existed:

- **F-016** (pause overlay + error boundary): the dot listed `e2e/pause-overlay.spec.ts` and `e2e/error-boundary.spec.ts` and the slice closed with the unit tests only. Followup notes are in `docs/FOLLOWUPS.md`.
- **F-017** (touch / mobile input): the dot listed `e2e/touch-input.spec.ts` on emulated `device: 'iPhone 13'`. Slice closed with unit-only coverage.
- **F-018** (loading screen / preload gate): the dot listed `e2e/loading-screen.spec.ts` driving a slow-network simulation via `route.fulfill(..., delay)`.

The Playwright harness re-open dot (VibeGear2-implement-add-playwright-64eb2a44) only commits to landing the harness + a title-screen smoke. These three deferred specs need their own slice so they do not get lost.

## Depends on

- VibeGear2-implement-add-playwright-64eb2a44 (Playwright harness must land first; this dot's `blocks:` field already enforces ordering).

## Affected files

- `e2e/pause-overlay.spec.ts` (new): start a race, press Escape, assert the overlay is visible and the speedometer value is unchanged after 500 ms; press Escape again, assert the race resumes; press "Retire race" while paused, assert the results screen.
- `e2e/error-boundary.spec.ts` (new): inject a thrown render error via a hidden `?test_error=1` route guard or a dev-only `/dev/error-boundary` route, assert the fallback renders, click "Reload", assert the page reloads.
- `e2e/touch-input.spec.ts` (new): Playwright project with `device: 'iPhone 13'`. Navigate to `/dev/road` (or the race route once it exists), tap accelerator and assert speed increases, drag the steer stick right and assert the lateral camera position changes; tap pause and assert the overlay opens.
- `e2e/loading-screen.spec.ts` (new): navigate to `/race`, slow each manifest URL with a 200 ms delay via `route.fulfill`, assert the progress text advances from "Loading 0 of N" toward "Loaded N of N" before `[data-testid=race-ready]` mounts. On completion, assert the gate exits.
- `playwright.config.ts` (modify): if not already present after the harness slice, add a `mobile-chromium` project for the iPhone 13 emulation so the touch spec runs against the right device profile without polluting the default chromium project.
- `docs/FOLLOWUPS.md` (modify): mark F-016, F-017, F-018 `done` once the specs are green in CI.

## Edge cases

- **`?test_error=1` route guard.** If the implementer prefers not to reach into the App Router with a query-string side-channel, a dev-only `/dev/throw` page that throws synchronously inside its render is equivalent and cleaner.
- **Touch spec needs a route with the touch overlay mounted.** `TouchControls` gates on `pointer:coarse`. The Playwright iPhone 13 emulation reports coarse pointer, so the overlay should mount; if it does not, the test must call `forceVisible` on the overlay or drive the input source directly via a hidden test endpoint.
- **Loading-screen spec** is sensitive to the manifest the race route requests. Until a real asset pipeline lands, `manifestForTrack` returns mostly non-critical entries, so the gate may surface "Race ready" with warnings instead of a clean success. The spec should either pin a fixture manifest or assert the warnings count rather than zero.
- **CI flakiness.** Slow-network simulation via `route.fulfill(..., delay)` can flake under heavy CI load. Use a generous timeout (10 s) and a Playwright retry on CI only.

## Verify

- [ ] All four spec files run green locally via `npm run test:e2e`.
- [ ] CI workflow runs the same suite and is green on the PR.
- [ ] F-016, F-017, F-018 marked `done` in `docs/FOLLOWUPS.md` with a link to this slice's PR.
- [ ] No em-dashes or en-dashes in any added file (`grep -P "[\\x{2013}\\x{2014}]"` returns nothing).
- [ ] PROGRESS_LOG.md entry added per IMPLEMENTATION_PLAN.md §6.

## Out of scope

- Mobile firefox / webkit / additional device matrix. That lives in the cross-browser dot (VibeGear2-implement-cross-browser-7cf643ce).
- Any new specs surfaced by future slices. Those file their own followups (F-NNN) and own their own dots, just like F-016/F-017/F-018 did here.
