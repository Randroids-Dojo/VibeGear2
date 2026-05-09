---
title: "implement: asset preload + loading screen per §21"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:42.344656-05:00\\\"\""
closed-at: "2026-04-26T02:33:55.865994-05:00"
close-reason: verified
---

## Description

Add an asset-preload phase that runs before the race scene mounts. Loads sprite atlases, audio buffers, and any track-specific assets in parallel, shows a deterministic loading screen with a progress bar, and only transitions to the race once every required asset has resolved (or surfaced a typed error). Prevents the first-frame asset pop-in and the silent-audio-until-first-buffer-decodes effect that otherwise hits on cold cache.

## Context

`docs/gdd/21-technical-design-for-web-implementation.md` lists asset loading under the Renderer / Audio layers. Currently each renderer module decodes its own asset on first use, which means: (a) the first frame draws missing sprites, (b) audio playback begins late, (c) e2e tests are flaky because they race the asset pipeline. Phase 6 hardening's "no console errors during a 30-s drive" requirement is hard to meet without a deterministic preload gate. This dot is the gate.

The loading screen is also the home for §20's accessibility prefs that should run before the world: applying `reducedMotion` before any animation, applying `colorBlindMode` palette before the first sprite paints.

## Affected Files

- `src/asset/preload.ts` (new): pure manifest loader. `preloadAll(manifest, fetcher) -> Promise<{ assets, failures }>` where `manifest` is an array of `{ id, kind: 'image' | 'audio' | 'json', src }`. Returns a typed map of decoded assets. No DOM dependence; tests inject a `fetcher`.
- `src/asset/__tests__/preload.test.ts` (new): all-success returns the asset map; one failure returns the partial map plus the typed failure list; cancellation returns mid-flight (AbortSignal honoured).
- `src/components/loading/LoadingScreen.tsx` (new): progress bar fed by an external store, accessibility-friendly text fallback ("Loading 12 of 24"), respects `reducedMotion` (no spin animation when set).
- `src/asset/manifest.ts` (new): per-route or per-track manifest builder. `manifestForTrack(track)` returns the assets needed for a given race.
- `src/app/race/page.tsx` (modify): wraps the race in a `<LoadingGate manifest={manifestForTrack(track)}>`; until preload settles, renders `<LoadingScreen>`. On failure, renders a typed error with a retry button.
- `e2e/loading-screen.spec.ts` (new): simulates a slow network (Playwright `route.fulfill` with delay), asserts the progress bar advances; on completion, asserts the race canvas mounts.

## Edge Cases

- Manifest has zero assets: skip the gate entirely, mount the race immediately.
- One failed asset: surface a "Some assets failed to load" warning, allow continuing with placeholders for non-critical assets (sprite atlas for environment), but block on critical ones (track JSON, player car sprite).
- Race route changes mid-load: cancel the in-flight preload via AbortController.
- `reducedMotion` set in save: the progress bar updates without easing.

## Verify

- [ ] `preloadAll` resolves a happy-path manifest of three images + two audio buffers + one JSON in a deterministic test.
- [ ] One failed asset returns the expected `failures` list with `{ id, error }`; the rest of the manifest still resolves.
- [ ] AbortSignal aborts the in-flight loads; subsequent calls do not log to console.
- [ ] `LoadingScreen` reads the store and renders the live progress count + bar (RTL test).
- [ ] `reducedMotion === true` in save disables the bar's CSS transition (RTL with mocked save).
- [ ] Race route's `<LoadingGate>` does not mount the canvas until preload resolves (RTL with a controlled-promise fetcher).
- [ ] Playwright e2e simulates a slow network and asserts the progress text advances; on completion, asserts the canvas mounts.
- [ ] Critical-vs-non-critical asset distinction documented in `manifest.ts` jsdoc.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/asset src/components/loading e2e/loading-screen.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/21-technical-design-for-web-implementation.md` (Renderer + Audio layers)
- `docs/gdd/16-rendering-and-visual-design.md` (sprite atlas)
- `docs/gdd/18-sound-and-music-design.md` (audio buffers)
- `docs/gdd/20-hud-and-ui-ux.md` (loading-screen accessibility)
