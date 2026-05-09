---
title: "implement: title screen menu wiring (Start Race / Garage / Options buttons enable + routes)"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:13:45.430382-05:00\\\"\""
closed-at: "2026-04-26T03:20:54.009238-05:00"
close-reason: verified
---

## Description

Wire the title screen main menu so the three currently-disabled buttons (Start Race, Garage, Options) become enabled and navigate to the correct routes. Currently `src/app/page.tsx` ships three `<button disabled>` placeholders with no `onClick`. The race route exists at `/race`; the garage route exists at `/garage/cars`; the options route does NOT yet exist (a separate dot covers /options creation).

## Context

GDD source of truth: `docs/gdd/05-core-gameplay-loop.md` and `docs/gdd/20-hud-and-ui-ux.md`. Working agreement requires Phase 1 vertical slice to be reachable from the title screen. The Playwright smoke spec `e2e/title-screen.spec.ts` currently asserts the buttons are visible AND disabled; that assertion must flip to visible AND enabled.

## Affected Files

- `src/app/page.tsx` (update): replace disabled buttons with `next/link` anchors styled as buttons; preserve `data-testid` hooks
- `src/app/page.module.css` (update if needed): keep visual parity
- `e2e/title-screen.spec.ts` (update): assert enabled and assert each link has the correct href
- `src/app/__tests__/page.test.tsx` (new or update): RTL render asserts each menu item has the correct href and is keyboard-focusable

## Edge Cases

- Options route: until the /options page lands, gate that link disabled with a clear data-testid (`menu-options-pending`) so tests can flip when the route arrives.
- Footer build-status text must stay (`data-testid=build-status`) so the smoke spec keeps a stable assertion.

## Verify

- [ ] `/` renders three menu items.
- [ ] Start Race navigates to `/race` (assert href on the anchor).
- [ ] Garage navigates to `/garage/cars` (current shipped route).
- [ ] Options is disabled until /options lands; data-testid `menu-options-pending` present.
- [ ] Keyboard tab order goes Start Race -> Garage -> Options.
- [ ] Playwright smoke spec updated and green.
- [ ] No em-dashes (grep -P '[\\x{2013}\\x{2014}]' on touched files returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.
