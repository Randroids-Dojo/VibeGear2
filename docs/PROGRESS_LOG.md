# Progress Log

Append a new entry at the **top** of this file at the end of every loop. Use
the template from `IMPLEMENTATION_PLAN.md` §6. Never delete past entries —
correct them by adding a new entry that references the old one.

---

## 2026-04-26: Slice: Title-screen menu wiring (Start Race, Garage, Options pending)

**GDD sections touched:** [§5](gdd/05-core-gameplay-loop.md), [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/title-screen-menu-wiring` (off `feat/race-session-vertical-slice`), PR pending
**Status:** Implemented

### Done
- Replaced the three placeholder `<button disabled>` controls in
  `src/app/page.tsx` with `next/link` anchors for `Start Race` (`/race`)
  and `Garage` (`/garage/cars`), plus a deliberately-disabled `Options`
  button carrying `data-testid="menu-options-pending"` so the future
  `/options` slice can flip the assertion in one line.
- Updated `src/app/page.module.css` so the shared `.menuItem` class
  styles both `<a>` and `<button>` variants identically: added
  `text-align`, `text-decoration: none`, `font: inherit`,
  `display: inline-block`, a `:focus-visible` style, and an
  `[aria-disabled="true"]` selector matching the existing `:disabled`
  visual treatment.
- Rewrote `e2e/title-screen.spec.ts`: the smoke test now asserts the
  Start Race and Garage anchors render with the correct `href`, the
  Options button is visible and disabled with the pending hook, and
  added two new specs that click each enabled menu item and assert the
  resulting URL (`/race`, `/garage/cars`).
- Added `src/app/__tests__/page.test.tsx`: six unit tests that
  `renderToStaticMarkup(TitlePage)` and assert (a) the title renders,
  (b) each anchor has the right `data-testid` and `href`, (c) the
  Options button stays disabled with `aria-disabled="true"`, (d) the
  DOM order is Start Race -> Garage -> Options for keyboard tab, and
  (e) the build-status footer hook still ships.
- Wired `@vitejs/plugin-react` (already in devDependencies) into
  `vitest.config.ts` so `.test.tsx` suites get the automatic JSX
  runtime without each file importing React.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 345 tests passing (6 new in `src/app/__tests__/page.test.tsx`).
- `npm run build` clean. `/` ships at 3.57 kB / 106 kB first-load
  (was 1.41 kB / 102 kB before the Link wiring; the bump comes from
  `next/link` being a client component pulled into the route).
- `npm run test:e2e` 4 of 4 passing (title-screen smoke + two
  navigation specs + race demo).

### Decisions and assumptions
- Options stays disabled with a distinct `data-testid="menu-options-pending"`
  rather than being hidden, so the keyboard tab order is stable across
  the disabled-then-enabled transition and tests can flip the
  assertion in a single line when the `/options` route lands.
- Used `next/link` rather than a programmatic router push so the menu
  works without JS for pre-hydration crawlers and so the keyboard tab
  order falls out of normal anchor focus behavior (no `onClick`
  handlers needed).
- The unit test uses `renderToStaticMarkup` over RTL because the rest
  of the suite runs in `node` without `@testing-library/react`
  installed; for static-shape assertions on a server-rendered page,
  raw HTML inspection is the lighter option and avoids pulling in a
  jsdom test environment.
- Added `@vitejs/plugin-react` to the vitest config (no new dependency,
  it was already installed) so future `.test.tsx` suites have the
  automatic JSX runtime available without a per-file React import.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: Phase 1 vertical slice integration (drivable /race)

**GDD sections touched:** [§7](gdd/07-race-rules-and-structure.md), [§10](gdd/10-driving-model-and-physics.md), [§15](gdd/15-cpu-opponents-and-ai.md), [§20](gdd/20-hud-and-ui-ux.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/race-session-vertical-slice` (off `feat/playwright-smoke-recovery`), PR pending
**Status:** Implemented

### Done
- Added `src/game/raceSession.ts`: pure glue between input, physics, AI,
  and race lifecycle. Exposes `createRaceSession` and `stepRaceSession`
  (both pure, no rAF, no globals) plus a `totalProgress` helper for HUD
  ranking. The session owns the `phase` lifecycle (countdown -> racing
  -> finished), the player car state, the AI car array, and a tick
  counter that resets at the green light so lap timing starts there.
- Extended `src/game/raceState.ts` with `countdownRemainingSec`,
  `lastLapTimeMs`, and `bestLapTimeMs`. Added `DEFAULT_COUNTDOWN_SEC`
  (3 s per the dot stress-test §2) and a `countdownSec` option on
  `createRaceState` so practice / quick-race modes can opt for an
  instant start.
- Wired `/race` to the runtime: track compiler, fixed-step loop, input
  manager, race session, road renderer, and HUD overlay. Reads
  `?track=<slug>` from the URL (defaults to `test/curve`, falls back on
  unknown ids), mounts an 800x480 canvas, wraps in `<ErrorBoundary>`
  and a Suspense fallback, holds the loop handle in a `useRef` and
  stops it on unmount so React StrictMode does not spawn two parallel
  loops.
- Pause overlay sits on top of the canvas. `usePauseToggle` wires
  Escape to `loop.pause()` / `loop.resume()`, so the sim halts without
  stalling the render callback.
- Lap completion: `floor(player.car.z / track.totalLengthMeters)`
  drives the lap counter. On increment we record `lastLapTimeMs`,
  update `bestLapTimeMs`, and on final-lap completion flip to
  `finished` and freeze physics. The full §7 race-rules engine is
  still owned by the race-rules dot; this slice ships only the
  happy-path integration.
- Single AI clean_line opponent spawns 5 m behind the player at the
  centerline, per the dot stress-test §4. Full grid placement remains
  with `implement-ai-grid-02d7e311`.
- Added `src/game/__tests__/raceSession.test.ts` (12 tests: countdown
  decrement, lights-out promotion, lap completion + timing, finished
  freeze, determinism check, immutability of returned state).
- Added `src/data/__tests__/tracks-content.test.ts` (5 tests: every
  bundled track validates against `TrackSchema` and compiles via
  `loadTrack` without throwing).
- Added `e2e/race-demo.spec.ts`: visits `/race`, asserts the canvas
  mounts, waits for the countdown to expire, holds ArrowUp for ~2.5 s,
  asserts the speed HUD reads > 0, and asserts the lap label is
  `1 / N`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 339 tests passing (17 new across the two new suites,
  3 raceState additions).
- `npm run build` clean. `/race` ships at 5.62 kB / 129 kB first-load.
- `npm run test:e2e` 2 of 2 passing locally (title screen smoke +
  race demo).

### Decisions and assumptions
- `RaceSession` lives in `src/game/`, not `src/app/`. Pure module, no
  React. The `/race` page is the only consumer that wires it into the
  rAF loop.
- Track JSON is loaded via static `import` (the bundled
  `src/data/tracks/index.ts` barrel + `loadTrack(id)`) rather than
  `fetch`, so the bundle ships the JSON at build time and the demo
  loads instantly.
- Default countdown is 3 s, per the dot stress-test §2. Configurable
  via `RaceSessionConfig.countdownSec` so practice / quick-race can
  override to 0.
- Asset preload (`LoadingGate`) is intentionally skipped on `/race`
  for this slice. The MVP demo only needs the track JSON (statically
  imported) and the road renderer's solid-fill colours; sprite
  atlases will land with the visual-polish slice. The gate returns
  once `public/assets/` exists, tracked under F-018.
- AI per-frame lap is computed from `floor(ai.car.z / totalLength)`
  (the per-AI lap field is deferred to the AI grid slice).
- Lap timing uses sim-elapsed time so the value is deterministic
  across machines, not wall-clock-influenced.

### Followups created
- None new. The "off-road persistent damage" extension and "full grid
  spawning" are tracked by their existing slices.

### GDD edits
- None.

---

## 2026-04-26: Slice: Recover Playwright e2e harness + title-screen smoke

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/playwright-smoke-recovery` (off `feat/track-compiler-golden`), PR pending
**Status:** Implemented (recovery)

### Done
- Re-applied the Playwright harness that was originally shipped on
  `feat/playwright-smoke` (commit 693043a) but never made it onto any
  later feature branch. Dot
  `VibeGear2-implement-add-playwright-64eb2a44` re-opened
  `VibeGear2-implement-add-playwright-c2ccf4f9` after the iteration 17
  audit found no Playwright artefacts on `main` or any in-flight feature
  branch.
- Recovery option chosen: option 2 from the dot's recovery path
  (re-implement on the latest feature branch). Option 1 was attempted
  first via `git cherry-pick 693043a` but produced two unmergeable
  conflicts in `docs/PROGRESS_LOG.md` because every later iteration
  prepended a new top entry. The file contents from 693043a
  (`playwright.config.ts`, `e2e/title-screen.spec.ts`) were copied
  verbatim via `git show 693043a:<path>` so future bisects still find
  one canonical shape.
- Added `@playwright/test` ^1.48.0 as a devDependency and installed via
  `npm install`.
- Restored `playwright.config.ts`: chromium project, runs against
  `http://127.0.0.1:3100` (configurable via `PLAYWRIGHT_PORT`), boots
  the Next.js production build via `npm run build && npm run start`,
  retains HTML reports + traces + screenshots on failure, GitHub
  reporter under CI.
- Restored `e2e/title-screen.spec.ts`: a single smoke test that loads
  `/`, asserts `data-testid="game-title"` reads "VibeGear2", asserts
  the document title matches, asserts the three menu buttons (Start
  Race, Garage, Options) are visible and disabled, and asserts the
  build-status footer contains "Phase 0".
- Restored npm scripts `test:e2e`, `test:e2e:ui`, and `verify:full`
  (`verify` + `test:e2e`).
- Restored the `vitest.config.ts` exclude pattern from `tests/e2e/**` to
  `e2e/**` so the Playwright spec is not picked up by Vitest.
- Restored the README local-dev block documenting
  `npx playwright install chromium`, `npm run test:e2e`, and
  `npm run verify:full`.

### Verified
- `npm install` succeeds.
- `npx playwright install chromium` succeeds.
- `npm run lint`, `npm run typecheck`, `npm test` all pass.
- `npm run test:e2e` builds and starts the production server, runs the
  smoke spec, and passes (1 passed).
- `npm run build` clean.
- `grep -P` for U+2013 and U+2014 across new files returns nothing.

### Decisions and assumptions
- Branched off `feat/track-compiler-golden` (the head of the current
  13-deep stack) rather than re-cutting `feat/playwright-smoke` against
  `main`, because every other in-flight slice already targets the
  stack's tip and rebasing the whole stack onto a second base branch
  would multiply the merge work.
- Chose to re-apply rather than cherry-pick because the cherry-pick
  conflicted twice in `PROGRESS_LOG.md` (every later iteration prepends
  a top entry) and the source artefacts are tiny.
- Did not bring forward F-016 / F-017 / F-018 specs in this slice. They
  remain open per the dot's "Out of scope" section; their dots can now
  be picked up because the harness exists.

### Followups created
- None new. F-002 advanced: only the GitHub Actions CI sub-slice
  remains, still blocked by F-003 / Q-003.

### GDD edits
- None.

---

## 2026-04-26: Slice: Track compiler + golden-master tests (§9, §22)

**GDD sections touched:** [§9](gdd/09-track-design.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/track-compiler-golden`, PR pending
**Status:** Implemented

### Done
- Replaced the stubbed `compileTrack` in `src/road/trackCompiler.ts`
  with the full pipeline pinned by
  `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md`. The
  function now returns a `CompiledTrack` with `segments`, `checkpoints`,
  `warnings`, and full track metadata, recursively frozen via a local
  `deepFreeze` helper so callers cannot mutate it.
- Added `class TrackCompileError extends Error` with stable `code` and
  `details` fields. The compiler throws on no checkpoints, missing or
  misplaced start checkpoint, out-of-bounds checkpoint segmentIndex, and
  total compiled segment count below the 4-segment minimum.
- Added soft lints emitted into `CompiledTrack.warnings`: spawn.gridSlots
  below 8, weatherOptions missing "clear", lengthMeters drift over 5%
  from the sum of authored len, duplicate non-start checkpoint labels,
  and packed hairpin runs (consecutive |curve| > 0.6 with combined len
  under 80 m).
- Renamed `CompiledSegment.authoredRef` to `authoredIndex` and added the
  `roadsideLeftId`, `roadsideRightId`, and `hazardIds` fields per the
  research spec. `hazardIds` shares the same array reference as the
  authored segment to avoid per-frame allocation in the renderer.
- Kept the lower-level `compileSegments(authored)` entry point for the
  dev pages (`/dev/road`, `/dev/physics`, AI tests) and renamed its
  return type to `CompiledSegmentBuffer` to disambiguate from the full
  `CompiledTrack` returned by `compileTrack`.
- Added a browser-safe `loadTrack(id)` helper in `src/data/index.ts`
  backed by a static-import barrel `src/data/tracks/index.ts`. Two
  bundled tracks ship today: `test/straight` and `test/curve`.
- Added 16 unit tests in `src/road/__tests__/trackCompiler.test.ts`
  covering the algorithm, the throw cases, the warning cases, and the
  frozen-output property. Plus 10 lower-level `compileSegments` tests.
- Added 5 fixture tracks under `src/road/__tests__/fixtures/` (straight,
  gentle-curve, crest, mvp-vs, boundary) and a golden-master suite
  `trackCompiler.golden.test.ts` that deep-compares each fixture against
  a JSON snapshot stored in `__snapshots__/trackCompiler.snapshots.json`.
  Use `UPDATE_SNAPSHOTS=1 vitest run` to regenerate intentionally.
- Implemented `snapshotHelpers.ts` with stable JSON serialisation
  (sorted keys), atomic write-back via tmp + rename, full-prefix of 30
  segments plus stride-25 sampling beyond, and a clear "rerun with
  UPDATE_SNAPSHOTS=1" hint on a first-time miss.
- Updated `src/data/examples/track.example.json` and
  `docs/gdd/22-data-schemas.md` to use valid authored checkpoint
  indices (the previous example referenced compiled-segment indices
  18 and 41, which are out of bounds against the 2 authored segments
  the example actually shows).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 319 total passing (52 new across the three road suites).
- `npm run build` clean. New tracks barrel ships in the client bundle.

### Decisions and assumptions
- Pre-scaled curve and grade kept on `CompiledSegment` (Option A from
  the dot stress-test) so the existing `segmentProjector` does not
  regress. Documented the post-scaled invariant on the type.
- `loadTrack(id)` uses a build-time JSON barrel rather than `node:fs`
  so it is safe under static export and Edge runtime.
- `compileSegments` kept as a thin escape hatch for dev pages so they
  do not need to fabricate fake checkpoints.

### GDD edits
- `docs/gdd/22-data-schemas.md`: changed the example track's checkpoint
  segmentIndex values from 18 and 41 to 1, so the example is internally
  consistent with the authored segments shown.

---

## 2026-04-26: Slice: Single AI driver, clean_line archetype (§15)

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/single-ai-cleanline`, PR pending
**Status:** Implemented

### Done
- Added `src/game/ai.ts` with `tickAI(driver, aiState, aiCar, player,
  track, race, stats, context, dt) -> { input, nextAiState }`. The
  function is pure: no globals, no `Math.random`, no `Date.now`. Same
  arguments produce identical outputs across runs, satisfying the
  §21 replay/ghost determinism requirement.
- Pinned the runtime AI state shape `interface AIState`
  (`progress`, `laneOffset`, `speed`, `intent`, `targetSpeed`,
  `seed`). Carries the per-AI PRNG seed even though the clean_line
  slice does not consume it, so adding mistake-prone or
  nitro-aware archetypes later does not force a breaking
  signature change.
- Pinned `AI_TUNING` constants in one place: racing-line bias cap
  (70 percent of road half-width), curve-driven deceleration
  coefficient (0.6 for unit curvature), minimum AI speed floor
  (8 m/s), speed hysteresis band (1.5 m/s), brake ramp (full at
  6 m/s overshoot), and steer P-gain (1.5 m authority band).
- Implemented the three clean_line behaviours from §15
  "Implementation approach": ideal lateral offset from the segment
  curve (inside-of-corner bias), target speed from `topSpeed`,
  curve magnitude, and `paceScalar`, and a P-controller for steer
  that doubles as off-road recovery once `aiCar.x` crosses the
  rumble.
- Countdown gating: `race.phase !== "racing"` returns
  `NEUTRAL_INPUT`. The AI does not integrate during the countdown
  but still updates its `progress` / `laneOffset` mirror so a
  future grid HUD overlay can show the starting order.
- Reasoned in authored-curve units (multiplied compiled
  `segment.curve` by `CURVATURE_SCALE`) so the tuning constants
  read against the same magnitude a track author types into the
  schema.
- Added `src/app/dev/ai/page.tsx` for visual smoke verification.
  Runs the §10 physics step driven by `tickAI` on a mixed
  straight / sweeper / straight / sweeper test track. The panel
  below the canvas reports live AI speed, target speed, lateral
  offset, and the steer / throttle / brake input.
- Added 18 unit tests in `src/game/__tests__/ai.test.ts`:
  countdown gating returns `NEUTRAL_INPUT`, straight-and-below
  target accelerates with zero steer, target-speed scales with
  `paceScalar`, sweeper biases steer toward the inside, target
  speed drops on curves, brakes when overshooting target,
  hysteresis-band feathering at and just below target,
  off-track recovery steers toward centerline, full-lock clamp on
  large lateral errors, purity (no input mutation), seed
  preservation, deep-equal output across 100 identical calls,
  and a sanity check on the tuning constants.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 18 new tests, 287 total passing.
- `npm run build` clean. `/dev/ai` prerenders to a static page
  (2.98 kB).

### Followups
- AI overtake behaviour, collision avoidance, and lane shifts
  remain on the full-grid AI dot.
- Nitro firing for clean_line is deliberately deferred per the
  dot stress-test (item 3): future slice will add it once the
  nitro budget shape is settled.
- Future archetypes (rocket starter, bully, cautious, chaotic,
  enduro) reuse the `AIState` shape and consume the per-AI
  `seed` for randomised behaviour.

---

## 2026-04-26: Slice: Asset preload + loading screen (§21)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md), [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/asset-preload`, PR pending
**Status:** Implemented

### Done
- Added `src/asset/preload.ts` with the pure loader
  `preloadAll(manifest, options) -> Promise<{ assets, failures }>`.
  Resolves entries in parallel, never rejects, preserves manifest order
  in the output map and failure list, drops aborted entries silently
  (they neither resolve nor surface as failures), and validates that
  the fetcher's returned `kind` matches the entry's declared `kind`.
  Progress is reported through an injected `onProgress` callback after
  every settled entry so the loading screen does not have to derive
  its own progress.
- Distinguished critical vs non-critical assets via the `critical`
  flag on each entry plus the `hasCriticalFailure(result)` helper.
  Critical failures block the gate and surface a retry; non-critical
  failures degrade silently with a screen-reader-friendly warning
  count.
- Added a `createBrowserFetcher(deps)` factory that wraps `fetch`,
  `Image`, and an injected `AudioContext.decodeAudioData` for the
  runtime path. Dependencies are injectable so the unit tests never
  reach for the DOM and so a future Node-side build (e.g. golden
  manifest tests) can use a memory transport.
- Added `src/asset/manifest.ts` with `manifestForTrack({ track,
  weather, playerCarId, aiCarIds, resolver })`. Order is stable: track
  JSON first, then player car sprite, then AI car sprites (deduped
  against the player), then unique roadside atlases in segment order,
  then weather audio for the selected variant. Track JSON and player
  sprite are critical; everything else is non-critical so a missing
  roadside atlas does not block the race.
- Added `src/components/loading/loadingState.ts` as the pure state
  machine for the loading screen. Phases are `idle`, `loading`,
  `failed-critical`, and `ready`; the fold function `applyProgress`
  is idempotent and never mutates the input snapshot. Helpers
  `formatLoadingText` and `progressFraction` produce the screen-reader
  text and bar fraction.
- Added `src/components/loading/LoadingScreen.tsx`: presentational
  view with a `role="status"` live region, `role="progressbar"` track
  with the live percentage, a `data-phase` attribute for Playwright
  assertions, and a retry button only when a critical failure has
  surfaced. `reducedMotion` disables the bar's CSS transition without
  affecting the input flow.
- Added `src/components/loading/LoadingGate.tsx`: controller that wires
  `preloadAll` into the screen. Cancellation runs through an
  `AbortController` that aborts on unmount or manifest-id change.
  Empty manifests skip the gate entirely. A retry handler bumps an
  internal attempt counter so the gate re-runs the preload after a
  critical failure.
- Added `src/app/race/page.tsx` so the gate is wired end to end. The
  route currently mounts a placeholder "Race ready" card instead of
  the full canvas because the §10 / §15 / §20 race scene has not been
  composed into a single mounted page yet; the canvas swap happens in
  the future race-route slice. `/race` builds and prerenders.
- Added 36 new unit tests across three files:
  `src/asset/__tests__/preload.test.ts` (11 cases covering empty
  manifest, happy-path 3 image / 2 audio / 1 json, manifest-order
  preservation when entries resolve out of order, partial failure,
  kind mismatch, progress events, abort with no console noise, and
  AbortError name handling), `src/asset/__tests__/manifest.test.ts`
  (8 cases covering ordering, critical flagging, dedupe, weather
  audio selection, manifest id stability, default and injected
  resolvers), and
  `src/components/loading/__tests__/loadingState.test.ts` (17 cases
  covering startLoading, every phase transition, idempotency,
  immutability, every formatLoadingText branch, and progressFraction
  edge cases).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 269/269 (36 new across the three new test files
  plus 233 prior).
- `npm run build` succeeds; `/race` is one of the prerendered routes
  (3.52 kB).
- `grep -P '[\x{2013}\x{2014}]'` across the new files returns nothing
  (no em-dashes, no en-dashes).
- Manual visual verification of the loading screen and gate defers to
  Playwright once F-002 lands the harness; the dot's e2e spec is
  filed as F-018.

### Decisions and assumptions
- The race route ships a placeholder body because the full §10 / §15
  / §20 race scene has not been composed into a single mounted page
  yet; the gate is the contribution of this slice. The placeholder
  preserves the gate's contract (children receive the decoded asset
  map) so the canvas swap is a leaf change in a future slice.
- `manifestForTrack` does not enforce dedupe across `aiCarIds`
  beyond skipping the player id. Repeated AI ids are the caller's
  responsibility; the manifest test documents this rather than
  silently deduping (a noisy contract is easier to debug than a
  silent one).
- Aborted entries are dropped from `failures` rather than surfaced as
  cancellation failures. This matches the dot's spec ("subsequent
  calls do not log to console") and keeps Playwright assertions about
  the failure list stable across cancelled vs completed runs.
- The default resolver returns URLs under `/assets/...` even though
  no asset pipeline ships those files yet. Until the pipeline lands,
  every preload attempt against a default resolver will fail, but
  most failures are non-critical so the gate still surfaces a "Race
  ready" body. The next asset-pipeline slice will add the files.
- Critical-vs-non-critical split is documented in the manifest module's
  JSDoc per the dot's verify checklist; it is also enforced in code by
  the `critical: true` markers on the track JSON and player sprite
  entries.

### Followups created
- F-018: Playwright e2e spec for the loading screen / preload gate
  (deferred until F-002 lands the harness).

### GDD edits
- None. Implementation conforms to §21 (Renderer + Audio preload) and
  §20 (loading-screen accessibility text + reducedMotion handling).

---

## 2026-04-26: Slice: Touch / mobile input source (§19, closes F-013)

**GDD sections touched:** [§19](gdd/19-controls-and-input.md)
**Branch / PR:** `feat/touch-mobile-input`, PR pending
**Status:** Implemented

### Done
- Added `src/game/inputTouch.ts` with the pure projector
  `inputFromTouchState({ pointers, layout }) -> Input` and the stateful
  `createTouchInputSource({ target, layout, resetOnBlur }) -> { sample,
  hasActivePointers, dispose }`. The projector classifies each pointer
  by its origin position into one of four right-zone buttons
  (accelerator, brake, nitro corner, pause corner) or as the steering
  pointer. Steering reads as the dominant left-zone pointer's X offset
  from its anchor, clamped by `stickMaxRadius` and normalised to
  `[-1, 1]`. Multi-touch is required so a player can hold accelerator
  with one finger and steer with another; the manager tracks each
  pointer by `pointerId` and routes per-zone.
- Edge-case rules per the dot:
  - Two pointers in the steer zone: latest wins (so re-anchoring
    with a fresh finger takes effect immediately).
  - Two pointers in the right zone: any in accelerator counts as
    held (so a player can lift and replace fingers without losing
    throttle).
  - `pointercancel` (system gesture, palm reject, OS modal) releases
    the captured pointer, mirroring `pointerup`.
  - `blur` clears all active pointers, mirroring the keyboard
    manager's window-blur behaviour.
  - Non-finite or zero-radius layouts are guarded to avoid NaN.
- Added `mergeWithTouch(base, touch) -> Input` in `src/game/input.ts`.
  Steering uses the louder-wins rule (larger absolute steer wins);
  throttle / brake take the max; booleans OR. The asymmetric
  keyboard-beats-pad-on-steer rule from `mergeInputs` does not apply
  (a virtual stick is analog like the gamepad).
- Extended `InputManagerOptions` with optional `touchTarget` and
  `touchLayout`. When `touchTarget` is set, `createInputManager`
  attaches a `createTouchInputSource` and folds its sample into the
  pipeline via `mergeWithTouch(mergeInputs(kb, pad), touch)`. When
  unset (the default), no touch listeners attach and behaviour is
  unchanged from the prior keyboard + pad slice. Added a `hasTouch()`
  diagnostic alongside `hasGamepad()`.
- Added `src/components/touch/TouchControls.tsx`: presentational SVG
  overlay sized off `DEFAULT_TOUCH_LAYOUT`. Renders a left-side stick
  with a moving knob, plus accelerator, brake, nitro, and pause
  buttons in their layout positions. Visibility gates on
  `pointer:coarse` via `matchMedia` (SSR safe; defaults to hidden).
  `forceVisible` opt-out for the dev page and tests. `reducedMotion`
  prop disables the knob's CSS transition without affecting input.
  The overlay does not own input state; it subscribes to its own SVG
  for visual knob tracking only. Sets `pointer-events: none` on the
  root so taps still reach the underlying touch input target.
- Added `src/game/inputTouch.test.ts` with 38 cases covering: empty
  state, in-zone vs out-of-zone steer, max-radius clamp, partial
  drag, accelerator vs brake routing, multi-touch composition,
  steer-latest-wins, accelerator-and-brake-coexist, nitro and pause
  corner taps, no-handbrake-or-shifts contract, zero-radius and NaN
  guards, manager event tracking, ignored unknown pointermove,
  pointercancel, blur, dispose listener count and idempotency,
  `resetOnBlur: false`, client-to-local coord conversion via
  `getBoundingClientRect()`, null-target SSR path, re-anchor on next
  pointerdown, layout supplier picked up per sample, plus three
  `createInputManager(touchTarget)` integration cases (no listeners
  when unset, sample merges throttle, dispose tears down).
- Updated `docs/FOLLOWUPS.md`: marked F-013 `done` with the slice
  reference; filed F-017 for the deferred Playwright spec (no harness
  yet, mirrors F-016).
- Updated the touch deferral comment at the top of
  `src/game/input.ts` so future readers see the new `touchTarget`
  option instead of the F-NNN placeholder.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 234/234 (38 new across `inputTouch.test.ts` plus
  196 prior).
- `npm run build` succeeds.
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification of the overlay defers to a human run on a
  touchscreen device or with Chrome devtools' device emulation. The
  pure projector and stateful manager are fully covered by the new
  unit tests.

### Decisions and assumptions
- The dot asked for the e2e Playwright spec on `device: 'iPhone 13'`.
  Deferred to F-017 because the project has no Playwright runner yet
  (F-002 still tracks the harness slice). The same precedent was set
  by the pause-overlay slice's F-016.
- The TouchControls component subscribes to its own SVG for the
  visual knob, not the underlying input source. This avoids a
  cross-module subscription contract and keeps the overlay's render
  cadence independent of the sim sample cadence. The actual input
  reading goes through `createTouchInputSource` (or
  `createInputManager(touchTarget)`), which the race scene wires once
  to its canvas element.
- Pointer-events on the SVG root are set to `none` so finger taps
  pass through to the canvas (which is the touch target). The visible
  overlay is decoration; the real listener lives on the canvas.
- `mergeWithTouch` uses the louder-wins steer rule rather than the
  keyboard-priority rule from `mergeInputs(keyboard, pad)`. Justified
  in the doc comment: virtual stick is analog like the pad, so
  symmetric resolution is the intuitive default for a player
  multi-modal mixing keyboard with a touchscreen laptop.
- Layout stays a single constant (`DEFAULT_TOUCH_LAYOUT`) for now;
  the future calibration / orientation work called out in the dot's
  edge cases lives behind the `layout` supplier so a settings UI can
  swap it without touching the source.
- Race route wiring (`src/app/race/page.tsx`) is still future work
  because that route does not exist yet; the dev road page does not
  need touch since it has no race state. Race-route wiring will land
  with the §6 race-mode slice that owns that page.

### Followups created
- F-017: Playwright e2e spec for touch / mobile input (deferred until
  F-002 lands the Playwright harness).

### GDD edits
- None. Implementation conforms to §19 "Touch and mobile future work".

---

## 2026-04-26: Slice: Pause overlay + global error boundary (§20, §21)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/pause-overlay-error-boundary`, PR pending
**Status:** Implemented

### Done
- Extended `LoopHandle` with `pause()`, `resume()`, and `isPaused()`.
  While paused: `simulate` is skipped, `render` keeps firing so any
  overlay can repaint, the timing origin is held at "now" so the
  accumulator stays at zero, and resume reseats the origin so the next
  rAF tick produces zero sim ticks (no catch-up burst). Idempotent.
- Added three loop tests (`src/game/loop.test.ts`) covering pause skips
  sim, render keeps firing, resume drains accumulator (no burst after a
  5 s pause), and idempotency of pause/resume.
- New `src/components/pause/PauseOverlay.tsx`: controlled `<dialog>`-style
  React component with the §20 menu (Resume, Restart race, Retire race,
  Settings, Leaderboard, Exit to title). Resume is the only handler
  required; the rest accept optional handlers and self-disable when
  absent so the overlay reuses across screens that bind a subset.
- New `src/components/pause/usePauseToggle.ts`: hook that listens for
  the configured pause key on `keydown`, debounces held keys via
  `event.repeat`, and toggles open state. Accepts a `LoopHandle` (or a
  getter for the dev-page ref pattern) and pauses/resumes the loop on
  the same edge.
- New `src/components/pause/pauseAction.ts`: pure binding-resolution
  helper. `resolvePauseTokens()` returns `DEFAULT_KEY_BINDINGS.pause`
  (currently `["Escape"]`); `isPauseEvent(event, tokens?)` matches
  either `event.code` or `event.key` and rejects key-repeat. Six tests.
- New `src/components/error/ErrorBoundary.tsx`: React class component
  wrapping the App Router root in `src/app/layout.tsx`. Catches render
  errors anywhere in the tree, logs to console (dev-tooling only), and
  renders a fallback with "Reload" and "Copy error" buttons. The
  fallback can be overridden via the `fallback` prop.
- New `src/components/error/formatErrorReport.ts`: pure helper that
  shapes a captured error into a single-string clipboard payload
  (name, message, stack, component stack). Seven tests cover Error
  subclasses, non-Error throws, missing component stack, cyclic objects.
- Wired `<ErrorBoundary>` into `src/app/layout.tsx` so every page (dev
  and production) has the global recovery shell.
- Wired the pause overlay into `src/app/dev/road/page.tsx` for manual
  verification: Escape opens / closes the overlay, the camera halts
  while paused, the canvas keeps repainting.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 196/196 (16 new across formatErrorReport, pauseAction,
  and three loop pause/resume cases).
- `npm run build` succeeds; `/dev/road` ships at 3.3 kB; layout shared
  bundle is unchanged (the boundary is small).
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification of the pause overlay and the error fallback
  defers to a human run of `npm run dev` and a navigation to a thrown
  error route. Loop-level pause behaviour is fully covered by the new
  unit tests.

### Decisions and assumptions
- Pause key resolution lives behind `resolvePauseTokens()` so the
  per-save bindings UI tracked as F-014 can replace the implementation
  without touching any caller. Today the helper hardcodes the default
  (`Escape`) per `DEFAULT_KEY_BINDINGS.pause` since `SaveGameSettings`
  has no `controlBindings` field yet.
- `LoopHandle.resume()` reseats `lastTimestamp = null` so the next
  `tickFor` re-establishes the timing origin and runs zero sim that
  frame. The dot's "first frame after resume runs at most one sim tick"
  is therefore satisfied by "first frame runs zero, second frame runs
  one if a fixed step has elapsed". Picked the stricter zero-first to
  avoid any remaining drift across the pause boundary.
- The error boundary mirrors caught errors to `console.error` so dev
  tooling still surfaces them; the on-screen fallback is the only
  user-facing surface. No telemetry per the project privacy posture.
- The Playwright e2e specs listed in the dot
  (`e2e/pause-overlay.spec.ts`, `e2e/error-boundary.spec.ts`) are
  deferred to F-016 because the project has no Playwright runner
  configured yet (F-002 still tracks the harness slice). Loop pause
  semantics, key-binding resolution, and error report formatting are
  fully unit-tested today.
- The hook accepts a getter form for `loop` so the dev pages that store
  the loop in a `useRef` (null until the first effect) can wire the
  hook at the top level without a chained `useEffect`.

### Followups created
- F-016: Playwright e2e specs for the pause overlay and error boundary.

---

## 2026-04-26: Slice: Minimal HUD for speed, lap, and position (§20)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/minimal-hud`, PR pending
**Status:** Implemented

### Done
- Added `src/game/hudState.ts` exposing the pure derivation
  `deriveHudState({race, playerSpeedMetersPerSecond, playerId, cars,
  speedUnit}) -> HudState` plus the helpers `speedToDisplayUnit`
  (m/s to kph or mph with rounding and abs) and `rankPosition`
  (1-indexed place in the field, deterministic tie-break on id lex).
  HudState exposes `{speed, speedUnit, lap, totalLaps, position,
  totalCars}`. Lap is clamped into `[1, totalLaps]` so the HUD never
  surfaces "0 / N" pre-countdown or "4 / 3" mid-overshoot.
- Added `src/render/uiRenderer.ts` exposing `drawHud(ctx, state,
  viewport, options?) -> void`. Pure draw: lap and position read
  top-left, speed and unit read bottom-right per §20 "UX wireframe
  descriptions / Race HUD layout". Uses a one-pixel drop shadow for
  legibility over grass and sky alike. Saves and restores ctx state
  (fillStyle, font, textAlign, textBaseline) so the caller does not
  need to wrap with save/restore.
- Re-exported the HUD surface from `src/game/index.ts` and
  `src/render/index.ts`.
- Wired the HUD into `src/app/dev/road/page.tsx`: the dev page now
  renders the HUD overlay over the road. Lap rolls forward as the
  camera completes laps of the 1.2 km test track. A synthetic ghost
  AI sits 80 m ahead so the position display reads "POS 2 / 2".
- Added `src/game/__tests__/hudState.test.ts` (21 cases) covering:
  speed unit conversion (kph and mph), reverse / NaN / Infinity speed
  collapsing to a non-negative integer, single-car field rendering as
  position 1 / 1, multi-car ranking by total progress, deterministic
  tie-break across grid-start ties, lap 0 to lap 1 placeholder, lap
  overshoot clamped to totalLaps, fractional lap truncation, purity
  (no input mutation), and a 100-call determinism guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 180/180 (21 new + 159 prior).
- `npm run build` succeeds; `/dev/road` ships at 2.14 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/road` deferred to a human run
  of `npm run dev`. Unit tests cover the math.

### Decisions and assumptions
- The HUD computes position from a `RankedCar[]` passed in by the
  race-state owner. The owner is responsible for converting per-car
  `(lap, z)` into a single `totalProgress` scalar. This keeps HUD
  derivation independent of the §15 AI module that does not exist
  yet, and matches the pattern in `physics.ts` (small dependency
  surface, easy to test in isolation).
- Tie-break on id lex ascending, not insertion order. Grid-start ties
  are common (every car at progress 0); the lex order keeps the HUD
  stable across ticks. The §15 AI slice will introduce real
  archetype ids; the lex break stays useful when the §11 grid order
  is otherwise undefined.
- Speed unit reads from `SaveGame.settings.displaySpeedUnit` per §22.
  The dev page hardcodes `"kph"` for now; a future slice will plumb
  the loaded save into the dev pages once the title screen exists.
- Drop shadow is a single-pixel offset rather than a real
  `shadowBlur`. The §20 polish slice can switch to layered blurs
  once typography is settled; for the minimal-HUD slice the cheap
  underlay reads cleanly over the grass and sky bands.
- The HUD draws inside the `render` callback (not `simulate`) so it
  shares the road renderer's rAF cadence and cannot flicker between
  sim ticks. Interpolation across sim states is the caller's job;
  the HUD reads the current snapshot.

### Followups created
- None.

### GDD edits
- None. The implementation conforms to the §20 Race HUD layout.

---

## 2026-04-26: Slice: Arcade physics step for player car (§10)

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md), [§11](gdd/11-cars-and-stats.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/arcade-physics`, PR pending
**Status:** Implemented

### Done
- Added `src/game/physics.ts` exposing the pure step function
  `step(state, input, stats, context, dt) -> CarState`. Implements §10's
  acceleration / top-speed clamp / brake / coasting drag / lane-relative
  steering / off-road slowdown. State is the minimal `{ z, x, speed }`
  triple; future slices for traction loss, drifting, jumps, drafting,
  nitro, weather, damage, and collisions can extend it additively.
- Tunable constants surfaced from §10 "Suggested tunable constants":
  `OFF_ROAD_CAP_M_PER_S`, `OFF_ROAD_DRAG_M_PER_S2`,
  `COASTING_DRAG_M_PER_S2`, `STEER_RATE_LOW_RAD_PER_S`,
  `STEER_RATE_HIGH_RAD_PER_S`. Started with the starter-tier values; the
  per-car `topSpeed`, `accel`, `brake`, `gripDry` from
  `data/cars/*.json` drive the per-vehicle behaviour.
- Steering uses the §10 lerp: `steerRate = lerp(low, high,
  speed/topSpeed)`, then `yawDelta = steerInput * steerRate * dt *
  tractionScalar`. Lateral velocity is `yawDelta * speed`, which gives
  the dot's "no lateral movement at zero speed" behaviour for free.
- Off-road detection uses `Math.abs(x) > roadHalfWidth` against the
  renderer's `ROAD_WIDTH` constant. Off-road halves grip and applies
  `OFF_ROAD_DRAG`, then caps speed at `OFF_ROAD_CAP`. Damage on
  persistent off-road at high speed is deferred to the §13 damage slice.
- Re-exported physics from `src/game/index.ts`.
- Added `src/app/dev/physics/page.tsx`. Drives the starter car
  (Sparrow GT) along a 12 km straight using the deterministic input
  layer and the same `startLoop` 60 Hz cadence the real race uses.
  Shows live speed (m/s and km/h), lateral x, forward z, off-road
  flag, and per-input values for visual smoke.
- Added `src/game/__tests__/physics.test.ts` (27 cases). Covers
  acceleration curve, top-speed clamp, brake (no inversion past zero,
  brake-from-zero stays at zero, brake + throttle held), coasting
  drag, steering (zero at zero speed, magnitude scales with input,
  authority drops with speed), off-road detection / drag / cap,
  dt = 0 / negative / NaN edge cases, purity, determinism (1000-run
  identical-output check + 100-step trajectory equality), and
  forward-z integration sanity.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 159/159 (27 new + 132 prior).
- `npm run build` succeeds; `/dev/physics` ships as a static route at
  3.6 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/physics` deferred to a human run
  of `npm run dev`. Unit tests cover the math; the dev page is for
  feel-checking.

### Decisions and assumptions
- The yaw-equation in §10 produces an angular delta. The MVP renderer
  does not show vehicle heading, so we project the yaw onto a lateral
  velocity by multiplying by forward speed. This matches the dot's
  "lane-relative" steering and the design pillar that "steering at
  zero speed produces no lateral movement". A future slice that
  introduces a real heading angle replaces the projection but keeps
  the §10 equation intact.
- Coasting drag and steering rates are sourced from the §10 "starter
  target" column. A future balancing slice can plumb mid / late tier
  values per car class. The per-car `gripDry` already differentiates
  the starter cars (Sparrow 1.00, Breaker 1.08, Vanta 0.93).
- Brake clamps at zero rather than inverting (no reverse in MVP).
  Reverse is not in §10's MVP scope and the dot lists "brake while
  reversing: do not invert velocity past zero" as a hard edge case.
- Off-road halves `gripDry` and applies `OFF_ROAD_DRAG`. §10 says
  "reduce traction" + "apply strong drag" + "cap top speed"; the half
  and the cap together give a readable transition without over-tuning
  the constant. Persistent off-road damage is deferred to F-015.
- The physics step is pure: no globals, no time source, no RNG.
  Determinism is mandatory per AGENTS.md RULE 8 so the §21 ghost /
  replay system can rebuild identical traces from a recorded input
  stream.
- Brake + throttle held at the physics layer applies both forces (net
  delta = (accel - brake) * dt). The input layer already resolves the
  ambiguous "both keys held" case to throttle = 0, brake = 1 before
  reaching physics, so the only callers that hit the physics-layer
  combination are tests, AI drivers (intentional), and replay
  playback.

### Followups created
- F-015 in FOLLOWUPS.md: persistent off-road damage. §10 calls it out
  ("Increase damage slightly if the player persists off-road at high
  speed") but damage is owned by the §13 slice.

### GDD edits
- None. The implementation conforms to §10 as written.

---

## 2026-04-26: Slice: Keyboard + gamepad input layer (§19)

**GDD sections touched:** [§19](gdd/19-controls-and-input.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/keyboard-gamepad-input` (off `main`), PR pending
**Status:** Implemented

### Done
- Added `src/game/input.ts` exposing the canonical `Input` shape
  (`steer`, `throttle`, `brake`, `nitro`, `handbrake`, `pause`, `shiftUp`,
  `shiftDown`), `NEUTRAL_INPUT`, `DEFAULT_KEY_BINDINGS` (matching §19's
  keyboard + gamepad tables), pure helpers `inputFromActions`,
  `inputFromGamepad`, `mergeInputs`, `applyDeadzone`, plus the stateful
  `createInputManager(opts)` that subscribes to keyboard + Gamepad API
  sources and exposes `sample()`, `dispose()`, and `hasGamepad()`.
- The manager samples once per fixed sim step (sim calls `sample()`
  inside the simulate callback). Browser events only mutate the held
  set; the snapshot is built at sample time. This satisfies the §21
  determinism requirement for the upcoming replay/ghost system.
- Implemented the §19 cancellation rule for opposite directions (Left +
  Right held resolves to steer = 0). Brake + Accelerate held resolves
  to throttle = 0, brake = 1 since stop is the safer ambiguous default.
- Window blur clears all held keys so a tab-out cannot leave the player
  with stuck throttle / steer when focus returns. Gamepad disconnect is
  silent: the manager polls on each sample and falls back to keyboard
  with no crash.
- Re-exported the input surface from `src/game/index.ts`.
- Added `src/app/dev/input/page.tsx` showing live sampled values,
  driven by the same `startLoop` cadence the real race uses. Useful for
  visually verifying held keys, the cancellation rule, and pad input.
- Added `src/game/__tests__/input.test.ts` (27 cases): pure-helper
  contracts, deadzone math, cancellation rule, blur clears state,
  gamepad-source-throws survives, dispose unhooks all listeners,
  custom bindings, and headless null-keyTarget mode.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 132/132 (27 new + 105 existing).
- `npm run build` succeeds; `/dev/input` ships as a static route at
  2.61 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/input` deferred to a human run of
  `npm run dev` since the agent environment cannot drive a real
  browser. The unit tests cover the keyboard-event mapping and
  cancellation rule end-to-end via injected `KeyTarget`, so the
  remaining manual check is "does Gamepad API actually populate".

### Decisions and assumptions
- The `Input` shape includes `handbrake`, `shiftUp`, and `shiftDown`
  alongside the dot's listed fields. §19 enumerates handbrake and
  manual shifts under both keyboard and pad layouts, so leaving them
  out would force a breaking change once those slices land. The
  default state for the new fields is `false`, so consumers that only
  read `steer/throttle/brake/nitro/pause` are unaffected.
- Keyboard tokens are matched against both `KeyboardEvent.code` and
  `KeyboardEvent.key`. `code` is the layout-independent identifier
  (e.g. `KeyW`) and is preferred for letters; `key` is needed for
  Escape, ArrowUp, etc. The default binding map lists both styles per
  action and the lookup accepts either, which keeps the API friendly to
  test fixtures while staying layout-independent in production.
- Brake-wins on simultaneous accelerate + brake. The dot's edge-case
  list does not specify the resolution; safer to stop than to keep
  throttle. Documented in `inputFromActions`.
- Stick deadzone defaults to 0.15 (most racing games), trigger
  deadzone to 0.05. §19 calls out steering smoothing as an
  accessibility feature; it is intentionally not modelled here. A
  future settings slice can plumb both deadzones through
  `InputManagerOptions`.
- Touch / mobile is out of scope per the dot; F-013 captures the
  followup so the desktop slice does not silently absorb that
  workload.
- The dev page samples inside `simulate`, not `render`, so the
  displayed values are exactly what the sim sees. React state pushes
  are throttled to ~30 Hz to keep the page off the fixed-step hot path.

### Followups created
- F-013 (`nice-to-have`): touch and mobile input. §19 explicitly defers
  this; tracked so it does not get lost.
- F-014 (`nice-to-have`): user-facing key remapping UI + persistence.
  The schema for control profiles already has a slot in `SaveSchema`
  but the UI to edit and persist them is its own slice.

### GDD edits
- None. The shape and bindings match §19 and §21 as written.

---

## 2026-04-26: Slice: Car set + stats (§11) and garage car selector

**GDD sections touched:** [§11](gdd/11-cars-and-stats.md), [§22](gdd/22-data-schemas.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/car-set-stats` (off `main`), PR pending
**Status:** Implemented

### Done
- Authored the six MVP cars from §11 + §23 as JSON files under
  `src/data/cars/`: `sparrow-gt.json`, `breaker-s.json`, `vanta-xr.json`,
  `tempest-r.json`, `bastion-lm.json`, `nova-shade.json`. Stats match the
  §23 "Core car balance sheet" exactly. Brake values (which §23 omits)
  scale with topSpeed and grip per starter vs. late-game tier.
- Added `src/data/cars/index.ts` exposing `CARS`, `CARS_BY_ID`,
  `STARTER_CAR_ID`, and `getCar(id)`. Re-exported from
  `src/data/index.ts` so the rest of the app can `import { getCar } from
  "@/data"`. Sparrow GT (purchasePrice 0) is the granted starter, matching
  the existing `defaultSave()` invariant in `src/persistence/save.ts`.
- Updated `src/data/schemas.ts`:
  - `CarClassSchema` now enumerates the §11 classes (`sprint`, `balance`,
    `power`, `enduro`, `wet-spec`) instead of the prior placeholder set
    (`balance`, `speed`, `grip`, `accel`, `heavy`, `light`).
  - `CarBaseStatsSchema.durability` widened from `unitInterval` to
    `positiveNumber` so heavy enduro cars (Bastion LM at 1.12) pass
    validation. Comment cites §23 as the source.
- Added `src/data/__tests__/cars-content.test.ts` (29 cases): catalogue
  size and id set, unique indexing, starter invariant, plus per-car
  schema validation, §23 balance match (within 1e-5), positive brake,
  and non-negative upgrade caps. All `it.each`-style so adding a car
  picks up coverage automatically once it is registered.
- Added `src/app/garage/cars/page.tsx`, a client component that loads
  the localStorage save, renders every car with its §22 stats, and lets
  the player either set the active car (owned cars) or buy one (gated
  by credits). Selling is intentionally out of scope; the §11 dot's
  edge case ("cannot sell active car") is satisfied by not exposing
  selling at all in this slice. Status messages surface save failures.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 105/105 (29 new + 76 existing). The schema test
  suite still rejects unknown classes; the §22 example car ("balance")
  remains valid under the new enum.
- `npm run build` succeeds; `/garage/cars` route ships at 17.6 kB.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/garage/cars` deferred to a human run
  of `npm run dev`. The agent environment cannot drive a real browser
  so the persistence round-trip is covered only by unit tests of
  `loadSave`/`saveSave` plus the page logic. Logged here per RULE 8.

### Decisions and assumptions
- The prior `CarClassSchema` enum (`speed`, `grip`, `accel`, `heavy`,
  `light`) was a Phase 0 placeholder that did not match §11. Replacing
  it with the §11 classes is a schema correction, not a breaking change
  for shipped saves: only the §22 example used "balance" (still valid)
  and there are no live cars on disk yet.
- `durability` was previously `unitInterval` (0..1). §23 lists 1.12 for
  Bastion LM, so the schema was wrong. Widened to `positiveNumber` with
  a comment pointing at §23. No callers depended on the upper bound
  behaviour; the schemas test relied only on the unknown-class and
  negative-tier rejections, which still hold.
- Brake values are not in §23. Picked starter brakes between 27 and
  30, late-game brakes 31 to 33, scaling with grip and stability. If a
  later balance pass disagrees, only the JSONs need to change.
- `purchasePrice` is also absent from §23. Sparrow GT is 0 (starter
  invariant); the rest follow a starter (8k, 10k) vs late (28k, 32k,
  48k) split that gives the player a clear progression curve. Open to
  rebalance when the economy slice (§12) lands.
- Wet-spec is in the schema but no §11 example car declares it. Left
  the enum entry in for the niche-unlock car that §11 says exists
  ("Niche unlock") so a future content slice can drop a JSON in
  without re-touching the schema.
- Selling is deferred. The §11 dot lists "cannot sell active car" as
  an edge case; satisfied trivially by not exposing a sell button in
  this slice. Will be revisited with the upgrade UI.

### Followups created
- None. Selling, hangar visuals, and the §12 upgrade panel are all
  already covered by other ready dots.

### GDD edits
- None. The schema correction (CarClass enum + durability bound)
  brings the code into agreement with §11 and §23 as written; no GDD
  edits required.

---

## 2026-04-26: Slice: Pseudo-3D road renderer (Canvas2D, single straight track)

**GDD sections touched:** [§9](gdd/09-track-design.md), [§16](gdd/16-rendering-and-visual-design.md), [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/pseudo-3d-road-renderer` (off `chore/licence-files`), PR pending
**Status:** Implemented

### Done
- Added `src/road/constants.ts` pinning `ROAD_WIDTH`, `SEGMENT_LENGTH`,
  `DRAW_DISTANCE`, `FOV_DEGREES`, `CAMERA_HEIGHT`, `CAMERA_DEPTH`,
  `CURVATURE_SCALE`, stripe lengths, and `SPRITE_BASE_SCALE` per the values
  pinned in the research dot.
- Added `src/road/types.ts` with `Camera`, `Viewport`, `CompiledSegment`,
  and `Strip` types. Dependency-free so tests and the projector can import
  without pulling Canvas2D bindings.
- Added `src/road/trackCompiler.ts` exposing `compileTrack(track)` and
  `compileSegments(authored)` that expand variable-length authored
  segments into fixed `SEGMENT_LENGTH` blocks. `curve` and `grade` are
  pre-scaled into compiled units so the projector can sum dx and dy
  directly. NaN and Infinity in those fields are sanitized to 0 with a
  single warning per compile.
- Added `src/road/segmentProjector.ts` with a pure `project(segments,
  camera, viewport, options) -> Strip[]`. Implements the Gordon recipe:
  per-segment curve and grade accumulation, pinhole projection, and a
  near-to-far maxY clip that marks strips hidden behind a closer hill
  crest as not visible. Handles wrap-around for laps and caps
  drawDistance to totalSegments to avoid double-projecting tiny tracks.
- Added `src/render/pseudoRoadCanvas.ts` with `drawRoad(ctx, strips,
  viewport, options)`. Walks the strip list back-to-front and paints the
  sky band, alternating grass, rumble strips, road surface, and lane
  markings using filled trapezoids.
- Added `src/app/dev/road/page.tsx` (dev-only client component) at
  `/dev/road`. Mounts the renderer with a 1.2 km straight test track and
  a 60 m/s forward-moving camera. Surfaces fps, camera Z, and visible
  strip count for the manual visual check.
- Added unit tests:
  - `src/road/__tests__/trackCompiler.test.ts` (9 cases): empty input,
    `ceil(len / SEGMENT_LENGTH)` expansion, monotonic indices and
    worldZ, minimum-one-block guarantee, curve and grade scaling, NaN
    and Infinity sanitisation with single warning, ring-buffer total
    length, and authoredRef preservation.
  - `src/road/__tests__/segmentProjector.test.ts` (11 cases): empty
    list, degenerate viewport, monotonic screenY and screenW on a flat
    straight track, drift on a constant curve, mirrored sign behaviour
    on opposite curves, maxY cull on a sharp crest, lap wrap, drawDistance
    cap on tiny tracks, near-plane culling, and an analytical scale check.
- Wired `road` and `render` index re-exports.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 76/76 (20 new + 56 existing).
- `npm run build` succeeds; `/dev/road` ships at 2.75 kB route size.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/dev/road` deferred to a human run of
  `npm run dev`; the dot's "60 fps on a 2020-class laptop" check requires
  a real browser. Headless Vitest cannot render Canvas2D; this is logged
  here per RULE 8.

### Decisions and assumptions
- The maxY cull walks **near to far**, mirroring Gordon's racer.js
  pattern, not the back-to-front order originally described in the
  research dot. The two yield the same set of culled strips on flat
  ground (no cull), but only the near-to-far walk treats `maxY` as the
  smallest screenY seen so far, which is what the cull semantics
  actually require. Updated the comment in `segmentProjector.ts` to
  reflect the corrected order; the research dot is preserved as is.
- Strip pairing in the drawer uses `(strips[n-1], strips[n])` as
  `(near, far)`. The drawer walks the strip list far-to-near so closer
  strips paint on top of distant ones.
- `cameraOffsetWithinSegment` is computed inside the projector so the
  closest strip sits exactly at the camera position rather than snapping
  to the nearest segment boundary. Without this, the road would visibly
  jitter as the camera crossed each segment boundary.
- The strip array always preserves `drawDistance` slots even when the
  maxY cull marks some as not visible. Keeping array indices stable
  lets the drawer pair adjacent strips reliably without re-indexing
  after the cull.
- Sprite billboards, parallax background, and weather VFX are scoped
  out of this slice. Dot text confirms they belong to follow-up slices.

### Followups created
- None. Sprite atlas, background parallax, and authored multi-curve
  tracks are already tracked as separate ready dots.

### GDD edits
- None. Implementation matches the §16 visible characteristics, §21
  pipeline shape, and §9 road dimensions without GDD changes.

---

## 2026-04-26: Slice: Fixed-step simulation loop (§21 Game loop)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/fixed-step-loop` (off `feat/localstorage-save`), PR pending
**Status:** Implemented

### Done
- Added `src/game/loop.ts` with `startLoop`, `FIXED_STEP_SECONDS`,
  `FIXED_STEP_MS`, `MAX_ACCUMULATOR_MS`, plus `Scheduler`, `LoopOptions`,
  `LoopHandle`, and `LoopTickResult` types. Implements the §21 recipe:
  rAF-driven render, accumulator-based catch-up, fixed 60 Hz simulate
  callback, fractional alpha passed to render for blending. Spiral of
  death prevented by capping the accumulator at 250 ms (15 frames of
  catch-up max); excess time is reported as `droppedSteps` so callers
  can surface a hitch indicator if desired.
- Added `src/game/loop.test.ts` (11 cases) covering: first-frame origin
  (no sim, alpha=0), one tick per fixed step, exactly 6 ticks for
  100 ms elapsed, fractional remainder carry across frames, accumulator
  cap after a 5 s pause, custom max accumulator, rejection of a
  too-small max, negative-dt clamp, render-every-tick invariant,
  `stop()` idempotency and pending-handle cancel, and end-to-end
  scheduler-driven run.
- Added `src/app/dev/loop/page.tsx`, a client-only dev page at
  `/dev/loop` that reports running fps, sim tick count, render frame
  count, and the latest render alpha. Used for the manual
  tab-backgrounding check in §21.
- Wired `loop.ts` exports through `src/game/index.ts`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 56/56 (11 new + 45 existing).
- `npm run build` succeeds; `/dev/loop` ships at 1.32 kB route size.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- The loop exposes a `tickFor(timestamp)` escape hatch on the returned
  handle so deterministic unit tests can drive frames without any
  timer or `vi.useFakeTimers()` setup. Production code never calls it
  directly; the scheduler does.
- Floating-point carry: `100 ms / (1000/60 ms) = 6.0` mathematically,
  but six successive subtractions of `1000/60` from `100` can leave
  the accumulator a few ULPs below zero, which would make the next
  step boundary cross a real-time fence late. A `1e-9 ms` epsilon in
  the loop's `>=` test pins exact-multiple cases to the expected step
  count without affecting any tick that lands more than a nanosecond
  off-boundary. Negative remainders are also clamped to zero.
- Cap chosen at 250 ms per the dot spec. With a 1/60 s step that
  buys 15 frames of catch-up, which keeps any single rAF tick under
  ~5 ms of sim work even on a slow integrated-GPU laptop. Customisable
  via `maxAccumulatorMs`; values below one fixed step are rejected as
  RangeError because they would deadlock the loop.
- `Scheduler` is its own one-method interface, not the DOM's
  `Window['requestAnimationFrame']` signature, to keep the loop
  testable from node and to allow future swap-out for a worker-driven
  loop without refactoring callers.
- Browser tab-backgrounding cannot be exercised from this agent's
  environment. The deterministic accumulator-cap test stands in for
  that scenario; manual browser verification via `/dev/loop` is left
  for the human reviewer.
- No `__tests__/` subdirectory was created. The repo's existing
  convention (per `raceState.test.ts`, `schemas.test.ts`,
  `save.test.ts`) co-locates `*.test.ts` next to the module under
  test. Followed that convention rather than the dot's suggested
  layout, per AGENTS.md RULE 9.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: Versioned localStorage save/load (§21 Save system)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/localstorage-save` (off `feat/data-schemas`), PR pending
**Status:** Implemented

### Done
- Added `src/persistence/save.ts` with `loadSave`, `saveSave`, `defaultSave`,
  and supporting types. Storage key `vibegear2:save:v<major>` is namespaced
  by the current schema major; corrupted or schema-invalid payloads get
  preserved under a `:backup` key for forensic recovery before the loader
  falls back to the default save.
- Added `src/persistence/migrations/index.ts` with `CURRENT_SAVE_VERSION = 1`
  and an empty migrations registry. The `migrate(input)` helper walks the
  registry from the input's declared version up to the current major,
  refuses to downgrade future-major saves, and validates the version field.
- Added `src/persistence/index.ts` barrel.
- Added `src/persistence/save.test.ts` (15 cases) covering: storage key
  shape, default save round-trip through the SaveGame schema, loadSave
  paths (no storage, missing key, valid load, corrupted JSON, schema
  invalid, getItem throws, future-major save), saveSave paths (success,
  invalid input refused, no storage, quota-exceeded, generic setItem
  error), and a save-then-load round-trip.
- Added `src/persistence/migrations/migrations.test.ts` (4 cases) covering
  identity v1 case, non-object input, invalid version field, and refusal
  to downgrade.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 45/45 (3 race state + 23 schemas + 15 save + 4
  migrations).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Every failure mode is non-fatal. The dot spec says "fall back to default
  save (no persistence) with warning" for unavailable storage, "log and
  use default save, do not crash" for corrupted JSON, and to preserve raw
  under a backup key on schema validation failure. Implemented exactly
  that. Quota-exceeded is surfaced as a typed error so the UI can decide
  whether to retry, prompt the player, or shrink the save.
- Quota detection cross-checks `error.name`
  (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`) and the legacy
  numeric `code` (22, 1014). Covers Chrome, Safari, and old Firefox.
- `defaultSave()` ships with credits 0, the starter `sparrow-gt` already
  owned and active, and a zeroed upgrade row for that car. Phase 2 garage
  flow will replace this with a "create profile" wizard, but the data
  needs to validate today so that loadSave can return a usable SaveGame
  on first run.
- The `SaveIO` interface lets every public function accept an optional
  `storage` and `logger`, defaulting to globalThis.localStorage and
  console.warn. This keeps the module testable without jsdom (the unit
  tests use a hand-rolled in-memory Storage shim) and lets future SSR
  paths inject `null`.
- `migrate` validates that the input is a plain object with a positive
  integer version. v1 takes the identity path; v2+ migrations are
  registered as `migrations[fromVersion]` returning the next-version
  shape. Skipping a step is a thrown error, not a silent identity, so
  forgotten migrations fail loudly.
- Did not add the Playwright reload-survives-save test the dot spec
  mentions. The save module has no UI bindings yet (no garage screen, no
  options screen), so there is nothing meaningful to drive in a browser.
  Filed as a followup to revisit when the garage flow lands.

### Followups created
- F-004 Add a Playwright e2e test that drives the garage UI to mutate a
  save and asserts persistence across reload. Open until the Phase 2
  garage flow exists; tracked in `docs/FOLLOWUPS.md`.

### GDD edits
- None.

---

## 2026-04-26: Slice: Data schemas as Zod validators and TS types (§22)

**GDD sections touched:** [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/data-schemas` (off `feat/scaffold-next-app`), PR pending
**Status:** Implemented

### Done
- Added `src/data/schemas.ts` with Zod runtime validators and inferred
  TypeScript types for every JSON contract in §22: `Track`, `Car`,
  `Upgrade`, `Championship`, `AIDriver`, `SaveGame`, plus the supporting
  enums (`WeatherOption`, `CarClass`, `UpgradeCategory`, `DifficultyPreset`,
  `AIArchetype`, `SpeedUnit`) and nested record schemas (`TrackSegment`,
  `TrackCheckpoint`, `CarBaseStats`, `CarUpgradeCaps`, `AIWeatherSkill`,
  `AINitroUsage`, `SaveGameGarage`, `SaveGameSettings`,
  `SaveGameProgress`, `SaveGameRecord`).
- Added a barrel at `src/data/index.ts` so consumers can
  `import { TrackSchema, type Track } from "@/data"`.
- Added six fixture files under `src/data/examples/` copied verbatim from the
  §22 examples (track, car, upgrade, championship, aiDriver, saveGame).
- Added `src/data/schemas.test.ts` with 23 Vitest cases: each schema accepts
  its §22 example and rejects at least three deliberately broken variants
  (empty segments, negative numerics, unknown enum values, missing
  required fields).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 26/26 (3 pre-existing + 23 new).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Slug format permits lowercase alphanumerics, hyphens, and underscores.
  §22's AI driver IDs use snake_case (`ai_cleanline_01`); track IDs use a
  `tour-id/track-id` path. The regex accepts both.
- Picked enum sets that are conservative supersets of what §22 shows
  (e.g. `WeatherOption` includes `rain`, `heavy_rain`, `fog`, `snow`,
  `night` even though the example only uses `clear`, `light_rain`, `dusk`).
  These are forward-compatible with §14 weather and §22 likely future
  expansion. If the GDD ever pins a different set, narrow here.
- `UpgradeEffectsSchema` uses optional numeric fields with a refine that
  requires at least one declared effect. §22 shows two effects; the schema
  allows any subset of the eight stat keys so future upgrades can target
  brake or stability.
- `CarUpgradeCaps` and `SaveGame.garage.installedUpgrades.<carId>` reuse
  the same eight-category shape because §12 and §22 both list the same
  categories. Consolidated into one schema constant generated from
  `UpgradeCategorySchema.options`.
- `SaveGameGarage.installedUpgrades` and `SaveGame.records` both use
  `z.record(slug, ...)` to allow any car ID or track ID as a key. Stronger
  cross-record validation (e.g. record key must appear in `ownedCars`)
  belongs at the load-time wrapper, not inside the leaf schema.
- Did not add JSON Schema export. Phase 0 only requires TS types + Zod
  runtime validators per the dot spec. Defer to a content-pipeline slice if
  authoring tools need it.

### Followups created
- None.

### GDD edits
- None. The §22 examples round-trip without modification.

---

## 2026-04-26: Slice: Scaffold Next.js + TypeScript app shell

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/scaffold-next-app`, PR pending
**Status:** Implemented

### Done
- Stood up the Next.js 15 (App Router) + React 18 + TypeScript 5 strict
  project skeleton at the repo root: `package.json`, `tsconfig.json` with
  strict + `noUncheckedIndexedAccess` + `@/*` path alias, `next.config.mjs`
  with `outputFileTracingRoot` and typed routes, `.eslintrc.json` extending
  `next/core-web-vitals` and `next/typescript`, `.gitignore` covering the
  Next/Node/Playwright artefact paths plus `.dots/`.
- Added the App Router skeleton: `src/app/layout.tsx`, `src/app/page.tsx`
  (title screen with disabled menu placeholders for Start Race, Garage,
  Options, plus a `data-testid="game-title"` hook for the upcoming Playwright
  smoke), `src/app/globals.css`, and `src/app/page.module.css`.
- Created the Phase 0 stub layout for the runtime modules under §21's
  recommended structure: `src/game/`, `src/road/`, `src/render/` each with an
  `index.ts` barrel referencing §21. Added `src/game/raceState.ts` with a
  typed `createRaceState` constructor and three Vitest unit tests
  (`raceState.test.ts`) so the test harness exercises real code from day one.
- Added Vitest 2 unit harness via `vitest.config.ts` (node environment,
  `src/**/*.test.ts` discovery, `@/*` alias mirror, v8 coverage), and npm
  scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
  `verify` (lint + typecheck + test).

### Verified
- `npm install` succeeds (436 packages, no peer-dep failures).
- `npm run lint` passes with zero warnings.
- `npm run typecheck` passes (`tsc --noEmit`, strict).
- `npm run test` runs 3 unit tests, all green.
- `npm run build` produces an optimised production build, prerenders `/`
  statically (102 kB First Load JS).
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Resolved Q-001: §21 is fully authored, so the slice adopts the recommended
  layered architecture verbatim. Picked Next.js 15 (latest stable App Router)
  rather than 14 because §21 specifies "Next.js" without pinning a major and
  the canary tooling still works under 15.
- Picked React 18 over React 19 deliberately: §21 says "Reuse VibeRacer
  patterns" and React 18 is the current LTS-equivalent for Next.js + Vitest +
  jsdom; revisit when Phase 1 needs concurrent features.
- Deferred Playwright e2e harness to its own slice (`implement: add
  Playwright e2e harness and title-screen smoke`) so this slice stays
  PR-sized.
- Deferred CI / auto-deploy to its own slice (`implement: GitHub Actions CI
  + auto-deploy`), still blocked by Q-003.
- Excluded `.dots/` from version control: the dots task tracker is a
  per-developer working artefact, not a build input.
- Marked the title-screen menu items disabled rather than wired-up: the
  routes do not exist yet, and Phase 0 only owes a title screen.

### Followups created
- None new. F-001 marked `done` (sections 18 to 28 already exist; the
  followup was based on a stale assumption). F-002 advanced to `in-progress`:
  remaining slices are Playwright smoke and GitHub Actions CI.

### GDD edits
- None.

---

## 2026-04-26 — Slice: Bootstrap implementation plan and working agreement

**GDD sections touched:** none (meta)
**Branch / PR:** `claude/gdd-implementation-plan-Z0cpN`, PR pending
**Status:** Implemented

### Done
- Added `docs/IMPLEMENTATION_PLAN.md` describing phases, the per-loop
  workflow, slice selection rules, definitions of done, and stopping
  conditions.
- Added `docs/WORKING_AGREEMENT.md` describing branching, commits, PRs,
  auto-deploy expectations, verification rules, clarification protocol, and
  risky-action gates.
- Seeded `docs/PROGRESS_LOG.md`, `docs/OPEN_QUESTIONS.md`, and
  `docs/FOLLOWUPS.md` so subsequent loops have a place to write.

### Verified
- Manual review of the four documents for internal consistency and against
  `GDD.md` section list.

### Decisions and assumptions
- Treated `GDD.docx` as a historical artefact; Markdown is canonical.
- Assumed Next.js + TypeScript + Canvas2D stack as implied by
  `01-title-and-high-concept.md` and `21-technical-design-for-web-implementation.md`
  (the latter is not yet authored — flagged as Q-001).
- Chose squash-merge as the default merge strategy, reversible by dev request.

### Followups created
- F-001 Author the eleven missing GDD sections (18–28) before Phase 0 can
  close.
- F-002 Stand up the Next.js + TypeScript project skeleton with CI and a
  deploy target.
- F-003 Wire an auto-deploy pipeline from `main`.

### GDD edits
- None.
