# Followups

Known followup work that did not fit in the slice that surfaced it. Each
entry has an id (`F-NNN`), a one-line description, the loop that created it,
and a priority.

Priorities: `blocks-release`, `nice-to-have`, `polish`. Statuses: `open`,
`in-progress`, `done`, `obsolete`. Do not delete entries — mark them `done`
or `obsolete` so the trail is preserved.

---

## F-018: Playwright e2e spec for the loading screen / preload gate
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The asset preload slice unit-tested the pure loader (parallel
resolve, partial failures, abort cancellation, kind-mismatch guard, progress
events) and the loading-screen state machine (idle / loading /
failed-critical / ready transitions, formatted text, progress fraction).
The dot also asked for a Playwright spec (`e2e/loading-screen.spec.ts`)
that simulates a slow network with `route.fulfill(..., delay)` and
asserts the progress text advances from "Loading 0 of N" to "Loaded N of
N" before `[data-testid=race-ready]` mounts. Deferred because the
project still has no Playwright runner configured (F-002 tracks that
harness slice). When the harness lands, navigate to `/race`, slow each
manifest URL with a 200 ms delay, assert the bar progresses, and assert
the ready card mounts on completion.

## F-017: Playwright e2e specs for touch / mobile input
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The touch / mobile slice unit-tested the pure projector,
the stateful manager (cancellation, blur, multi-touch, dispose), the
`mergeWithTouch` precedence rule, and the `createInputManager`
integration (38 cases). The dot also asked for a Playwright spec
(`e2e/touch-input.spec.ts`) on emulated `device: 'iPhone 13'` that
taps accelerator and drags the steer stick; that spec is deferred
because the project still has no Playwright runner configured (F-002
tracks the harness slice). Land this once the harness exists: emulate
mobile, navigate to `/dev/road` (or the race route once it lands),
tap accelerator and assert speed > 0, drag the stick right and assert
the lateral camera position changes; then tap pause and assert the
overlay opens.

## F-016: Playwright e2e specs for pause overlay and error boundary
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The pause overlay + error boundary slice unit-tested the
loop pause semantics, the key binding resolution, and the error report
formatter (16 cases, every path). The dot also listed two Playwright
specs (`e2e/pause-overlay.spec.ts`, `e2e/error-boundary.spec.ts`) that
were deferred because the project has no Playwright runner configured
yet (F-002 still tracks the harness slice). Once the harness lands,
add: (a) start a race, press Escape, assert overlay visible and
speedometer unchanged after 500 ms; press Escape again, assert race
resumes; press Retire while paused, assert results screen. (b) inject
a thrown render error via a hidden `?test_error=1` route guard, assert
the fallback renders, click Reload, assert the page reloads.

## F-015: Persistent off-road damage at high speed
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** §10 "Road edge and off-road slowdown" calls for "Increase
damage slightly if the player persists off-road at high speed". The
arcade physics slice ships drag and a top-speed cap when off-road but
defers damage to the §13 damage / repairs slice that owns the damage
state machine. When the §13 slice lands, plumb a `damage` accumulator
into the physics state and increment it in `step()` proportional to
(speed * dt) while off-road.

## F-014: Key remapping UI and persistence
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** `createInputManager` already accepts a `bindings` override and
the §22 SaveSchema reserves a slot for control profiles, but there is no
UI to edit or persist them. Build a settings screen that shows each action,
prompts for a key, validates against conflicts, and writes back to the
save file. §19 lists this as a first-class feature on desktop.

## F-013: Touch and mobile input
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** §19 explicitly defers touch to future work and the keyboard +
gamepad slice did not implement it. When this lands, model it as another
source feeding into `mergeInputs` so the existing keyboard / pad path is
unchanged. Closed 2026-04-26 by `feat/touch-mobile-input`: the new
`src/game/inputTouch.ts` ships the pure projector `inputFromTouchState`
plus the stateful `createTouchInputSource`; `src/game/input.ts` exposes
`touchTarget` / `touchLayout` on `InputManagerOptions` and a new
`mergeWithTouch(base, touch)` helper that the manager calls after
`mergeInputs(keyboard, pad)`. Visual overlay lives at
`src/components/touch/TouchControls.tsx` and gates on `pointer:coarse`.

## F-004 — Playwright save/load round-trip via the garage UI
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/localstorage-save` slice unit-tested the persistence
module against an in-memory Storage shim (15 cases, all paths). The dot spec
also asked for a Playwright reload-survives-save test, but the save module
has no UI bindings yet (no garage screen, no options screen), so there is
nothing meaningful to drive in a browser. Land this once the Phase 2 garage
flow exists: navigate to the garage, mutate a value (e.g. swap car or buy an
upgrade), reload, assert the value persisted.

## F-003 — Auto-deploy pipeline from `main`
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** open
**Notes:** Blocked by Q-003 (deploy target). Once chosen, add CI workflow
that builds, runs the test suite, and deploys on every merge to `main`.

## F-002 — Project skeleton (Next.js + TypeScript + CI)
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** in-progress
**Notes:** First implementation slice once Q-001 is answered. Must include
lint, type-check, unit tests, e2e harness, and a smoke test that the dev
server boots. App shell, lint (next lint), strict type-check, and the Vitest
unit harness landed in the `feat/scaffold-next-app` slice. Remaining: Playwright
e2e harness with title-screen smoke (own slice), then GitHub Actions CI (own
slice, blocked by F-003 deploy target choice).

## F-001 — Author GDD sections 18–28
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
**Notes:** Verified on 2026-04-26 during the scaffold slice: all 28 GDD section
files exist under `docs/gdd/` (01 through 28). The original assumption that
sections 18 to 28 were missing was incorrect at the time this followup was
filed (or had been resolved before any later loop saw it). No action required.
