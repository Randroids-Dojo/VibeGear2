# Compatibility Matrix

This file records the browser, performance, and accessibility verification
expected before a tagged release. Keep it current when the cross-browser
smoke or release verification changes.

For the published support table with per-browser evidence rows, see
[`BROWSER_COMPATIBILITY.md`](BROWSER_COMPATIBILITY.md).

## Automated Smoke

Run from the repository root:

```bash
npm run test:e2e:cross-browser
```

The smoke covers Chromium, Firefox, and WebKit through Playwright projects:

| Engine | Coverage | Status |
| --- | --- | --- |
| Chromium | Core routes, practice race canvas, Steam Deck viewport, reduced-motion media query, keyboard title to race to garage flow. | Automated in CI. |
| Firefox | Same compatibility smoke as Chromium. | Automated in CI. |
| WebKit | Same compatibility smoke as Chromium. | Automated in CI. |

## Manual Release Checks

These checks are required for a tagged release and should be recorded in the
release PR:

| Target | Check |
| --- | --- |
| Desktop Safari | Open the production build, start a practice race, pause, exit to title, and open Garage. |
| Steam-Deck-size viewport | Smoke production on the target device when available. The Playwright compatibility smoke covers 1280 by 800 layout bounds. |
| Keyboard-only navigation | From title, Tab to Start Race, press Enter, press Escape in race, exit to title, then Tab to Garage and press Enter. |
| Reduced motion | In a browser with reduced motion enabled, open `/race?mode=practice` and confirm the race canvas boots and controls respond. |

## Deferred Gates

`VibeGear2-implement-ci-bundle-57af4a04` owns the heavier release gates:
bundle-size budget, Lighthouse performance and accessibility checks, and axe
coverage. This file tracks the compatibility smoke and manual release matrix
only.
