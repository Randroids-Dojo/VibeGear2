---
title: "implement: pause overlay + global error boundary per §20"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:42.338044-05:00\\\"\""
closed-at: "2026-04-26T02:14:23.891820-05:00"
close-reason: verified
---

## Description

Two small but missing UI primitives bundled because they share an architectural shape (a `<dialog>`-style overlay that suspends the underlying loop):

1. **Pause overlay** per `docs/gdd/20-hud-and-ui-ux.md` Pause menu: resume / restart race / retire race / settings / leaderboard / exit to title. Pressing the configured pause key (default `Escape`, defined in `DEFAULT_KEY_BINDINGS`) toggles it. While open, the loop's simulate callback is a no-op (or `LoopHandle.pause()` stops accumulating sim ticks). Render keeps drawing the last frame so the world does not freeze visually with stale UI.
2. **Global error boundary** per `docs/gdd/21-technical-design-for-web-implementation.md` (recommended layers: App shell catches runtime errors). React error boundary at the App Router root that catches render errors anywhere in the tree, displays a friendly fallback ("Something broke. Reload?"), wires a "Copy error" button (clipboard the stack), and logs to console. No telemetry per the project's privacy posture.

## Context

The HUD-UI polish dot lists "pause overlay" but its scope is broader (full HUD redraw + settings page). The pause overlay deserves its own slice because: (a) it gates Phase-1+ playable demos; (b) it interacts with the §21 fixed-step loop's accumulator (pausing must not leak `MAX_ACCUMULATOR_MS` once resumed); (c) it requires a bit of testable state machine work that the larger HUD slice would otherwise inline.

The error boundary is missing entirely. Phase 6 hardening calls for it implicitly under "no console errors during a 30-s drive" but a thrown error inside a React tree currently brings down the page with no recovery. Bundling here keeps both as one PR-sized slice.

## Affected Files

- `src/components/pause/PauseOverlay.tsx` (new): controlled component (open prop), keyboard trap, focus management, the §20 menu list.
- `src/components/pause/usePauseToggle.ts` (new): hook that listens for the bound pause action and toggles open state. Reads bindings from settings (post `SaveGameSettings` expansion); falls back to `Escape` if not set.
- `src/game/loop.ts` (modify): add `pause()` and `resume()` to `LoopHandle`. While paused: simulate is skipped, render runs, and the accumulator is **drained** to zero on resume so a long pause does not produce a sim-burst on the next frame.
- `src/game/loop.test.ts` (modify): add cases for pause-then-resume (no sim ticks accrued during pause; first frame after resume runs at most one sim tick).
- `src/components/error/ErrorBoundary.tsx` (new): class component implementing `componentDidCatch`, fallback UI, "Copy error" button.
- `src/app/layout.tsx` (modify): wrap children in `<ErrorBoundary>`.
- `src/components/error/ErrorBoundary.test.tsx` (new): renders fallback when a child throws; "Copy error" copies the stack via `navigator.clipboard.writeText` mock.
- `e2e/pause-overlay.spec.ts` (new): start a race, press Escape, assert overlay visible + speedometer value unchanged after 500 ms; press Escape again, assert race resumes; press "Retire race" while paused, assert results screen.
- `e2e/error-boundary.spec.ts` (new): inject a thrown error via a hidden `?test_error=1` route guard, assert the fallback renders.

## Edge Cases

- Pause during countdown: countdown timer also freezes (existing HUD-UI dot's edge case re-stated here so the pause owner knows it).
- Window blur while paused: stay paused; do not auto-resume on focus return.
- Multiple pause requests in one frame (key spam): debounce to one toggle per pause-action edge.
- Error boundary itself throws (rare): fall back to a static `<noscript>`-style message; do not infinite-loop.

## Verify

- [ ] `LoopHandle.pause()` followed by 500 ms of `tickFor()` produces zero simulate calls and the accumulator is zero on first post-resume tick (Vitest with `Scheduler` injected).
- [ ] `PauseOverlay` traps focus inside the dialog (Tab cycles through visible buttons only, RTL test).
- [ ] Pause action key resolves from settings if present, falls back to `Escape` otherwise.
- [ ] Error boundary catches a thrown render error and shows the fallback without a console crash trace re-thrown to the parent.
- [ ] Clipboard write copies a stable, single-string error report (mocked clipboard, RTL test).
- [ ] Playwright e2e (`e2e/pause-overlay.spec.ts`) covers: open, sim freezes, close, sim resumes, retire returns to results.
- [ ] Playwright e2e (`e2e/error-boundary.spec.ts`) covers: triggered render error renders the fallback; clicking "Reload" reloads the page.
- [ ] Keyboard-only navigation: Tab through pause-menu buttons, Enter on Resume returns to race.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/components/pause src/components/error src/game/loop.ts src/game/loop.test.ts e2e/pause-overlay.spec.ts e2e/error-boundary.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/20-hud-and-ui-ux.md` (Pause menu)
- `docs/gdd/21-technical-design-for-web-implementation.md` (App shell layer)
- `src/game/loop.ts` (existing fixed-step loop)
