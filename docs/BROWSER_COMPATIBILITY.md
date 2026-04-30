# Browser Compatibility

This matrix records the browser and viewport combinations VibeGear2 supports
or intends to support for v1.0. Keep rows append-only where practical: when a
target fails, keep the row with the reproducer; when a target is dropped, mark
it dropped with the date.

Automated evidence comes from `npm run test:e2e:cross-browser` in CI. Manual
rows are required before a tagged release.

## Current Matrix

Build under test: `bfb5300`

| Browser | OS or device class | Viewport | Verification | Date | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium | Linux GitHub runner | Desktop Chrome default | Playwright cross-browser smoke | 2026-04-30 | pass | [CI run 25144458887](https://github.com/Randroids-Dojo/VibeGear2/actions/runs/25144458887) |
| Firefox | Linux GitHub runner | Desktop Firefox default | Playwright cross-browser smoke | 2026-04-30 | pass | [CI run 25144458887](https://github.com/Randroids-Dojo/VibeGear2/actions/runs/25144458887) |
| WebKit | Linux GitHub runner | Desktop Safari profile | Playwright cross-browser smoke | 2026-04-30 | pass | [CI run 25144458887](https://github.com/Randroids-Dojo/VibeGear2/actions/runs/25144458887) |
| Chrome | macOS | Desktop | Manual smoke | pending | not-yet-run | Required for tagged release |
| Safari | macOS | Desktop | Manual smoke | pending | not-yet-run | Required for tagged release |
| Edge | Windows | Desktop | Manual smoke | pending | not-yet-run | Required for tagged release |
| Chromium-class browser | Steam Deck class | 1280 by 800 | Playwright layout smoke | 2026-04-30 | pass | [CI run 25144458887](https://github.com/Randroids-Dojo/VibeGear2/actions/runs/25144458887) |

## Smoke Scope

The automated smoke covers:

- title, options, garage, world, and practice race route boot
- live race canvas rendering with spatial color variation
- reduced-motion media-query support
- Steam Deck class 1280 by 800 race surface bounds
- keyboard-only title to race to pause to title to garage navigation

## Manual Release Rows

Before a tagged release, update the pending manual rows with:

- the exact browser version
- the OS version
- the tested build SHA
- a pass or fail result
- evidence, such as a CI run, issue, screenshot, or PR comment

If a manual target fails, keep the row and link the reproducer. If a browser
or device class is no longer supported, change the result to `dropped` and
record the date.

## Known Gaps

- Real desktop Safari remains a manual release check. Playwright WebKit is
  the automated proxy, not a replacement for a final Safari smoke.
- Edge on Windows remains a manual release check.
- Mobile browser support is outside this matrix until the mobile touch pass
  becomes release scope.
- Lighthouse, axe, and bundle-budget gates are tracked separately by
  `VibeGear2-implement-ci-bundle-57af4a04`.
