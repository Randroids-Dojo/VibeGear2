# Progress Log

Append a new entry at the **top** of this file at the end of every loop. Use
the template from `IMPLEMENTATION_PLAN.md` §6. Never delete past entries.
Correct them by adding a new entry that references the old one.

---

## 2026-04-26: Slice: race checkpoint pass tracking (RaceState fields, runtime detector, anti-shortcut guard)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) (lap counting, anti-shortcut),
[§22](gdd/22-data-schemas.md) (Track.checkpoints schema, now consumed at
runtime). The §22 schema declares `checkpoints: [{segmentIndex, label}]`
but the only runtime consumer was the §20 sector-splits widget; this
slice adds the per-tick detector that the §7 lap-credit guard, the §6
practice resetToCheckpoint, and the §15 AI recover-spawn all share.
**Branch / PR:** `feat/race-checkpoint-tracking` (stacked on
`feat/pure-race-rules-module`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/game/raceCheckpoints.ts` as a pure helpers module
  carrying `detectCheckpointPass`, `applyCheckpointPass`,
  `resetCheckpointsForNewLap`, and `hasPassedAllCheckpoints`. No
  `Math.random`, no `Date.now`; same inputs always produce the same
  output across runs (AGENTS.md RULE 8 determinism).
- Extended `RaceState` (`src/game/raceState.ts`) with two additive
  fields: `lastCheckpoint: LastCheckpointSnapshot | null` (the most
  recently forward-crossed checkpoint plus a defensive copy of the
  player's `CarState`) and `passedCheckpointsThisLap: ReadonlySet<number>`
  (the set of segment indices passed since the last start-line cross,
  cleared on lap rollover). Both default to the empty / null value at
  session creation.
- Updated `raceSession.ts` to construct the new fields when building
  the initial `RaceState`. Existing `...state.race` spreads in the
  countdown / racing branches preserve them automatically; no behaviour
  change for the active session.
- The detector pins forward-only pass detection, wrap-around handling
  for lap rollover (start-line checkpoint at `segmentIndex = 0` is
  detected on the wrap, not on the way up to `prevZ`), and a
  movement-window guard that returns `null` when the per-tick advance
  exceeds half the track length (the `loop`'s 250 ms accumulator cap
  makes this structurally impossible at 60 Hz, but the detector
  defends anyway).
- Multi-checkpoint per tick returns the LAST crossed (highest z)
  checkpoint with a stable lex-on-label tie-break for the rare
  same-z case; this keeps the API one event per tick and matches the
  iter-19 stress-test guidance.
- `EMPTY_PASSED_SET` is a frozen empty set shared across every fresh
  `RaceState` so a no-checkpoint-yet session does not allocate a new
  set per call. `addToFrozenSet` returns a fresh frozen set so the
  `RaceState` snapshot a downstream replay holds cannot be mutated.
- Test fixture `src/game/__tests__/raceCheckpoints.test.ts` (22 cases)
  pins the eight `detectCheckpointPass` cell-level cases from the dot
  (empty list, forward pass, no pass, wrap, reverse, multi-pass,
  half-track guard, non-finite inputs), the `applyCheckpointPass`
  purity / defensive-copy / idempotent behaviours, the
  `resetCheckpointsForNewLap` clear-but-preserve semantics, and the
  full `hasPassedAllCheckpoints` truth table for 0 / 1 / 2 / 5
  checkpoint counts.

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 987 / 987 (43 files), including the new
  `raceCheckpoints.test.ts` and all 44 existing
  `raceSession.test.ts` cases.
- `npm run build`: clean (Next.js static export of all 15 routes).
- `npm run test:e2e`: 28 / 28.
- `grep -P '[\x{2013}\x{2014}]'` over the new files: nothing.

### Followups
- The §7 lap-credit guard (`hasPassedAllCheckpoints`) is now exported
  but not yet wired into `raceSession.ts` lap detection. The parent
  race-rules dot (`VibeGear2-implement-race-rules-b30656ae`) will land
  the wire-up once it picks up the now-pinned helpers.
- The `raceSession` does not yet call `detectCheckpointPass` per tick
  so `lastCheckpoint` and `passedCheckpointsThisLap` stay at their
  initial values during a live race. Wiring these into the racing
  branch (alongside the existing sector-splits tick) is the
  follow-up wiring slice; the consumers (practice reset, AI recovery)
  will need it before this slice is fully load-bearing.

---

## 2026-04-26: Slice: pure raceRules.ts module (countdown labels, DNF timers, ranking, final-state builder)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) (race lifecycle, fail states,
tie handling). The §7 spec names DNF as a fail state but does not pin
timeout values; this slice pins them per the parent dot's iter-19
researcher stress-test.
**Branch / PR:** `feat/pure-race-rules-module` (stacked on
`feat/legal-safety-doc`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/game/raceRules.ts` as a pure-helpers module mirroring
  the `nitro.ts` / `damage.ts` / `drafting.ts` pattern: pure module
  first, race-session wiring second.
- Exported countdown HUD labels (`COUNTDOWN_TICK_LABELS`,
  `labelForCountdown`) re-using the existing `DEFAULT_COUNTDOWN_SEC`
  constant from `raceState.ts` so the countdown duration is single-
  sourced.
- Pinned the four DNF threshold constants (`DNF_OFF_TRACK_TIMEOUT_SEC`,
  `DNF_NO_PROGRESS_TIMEOUT_SEC`, `DNF_RACE_TIME_LIMIT_SEC`,
  `DNF_NO_PROGRESS_DELTA_M`, plus `DNF_OFF_TRACK_RESET_SPEED_M_PER_S`
  for the high-speed-grass-excursion guard) and shipped the per-car
  reducer `tickDnfTimers(prev, sample, dt)` returning a fresh
  `{ timers, dnf, reason }`. Reset semantics match the iter-19
  stress-test §4 "drove through grass for 28s, came back for one tick,
  drove off again" guard.
- Shipped `exceedsRaceTimeLimit(elapsedSec)` for the hard race-time
  cap.
- Shipped `rankCars(snapshots)` with the iter-19 §3 tie-break ladder
  (status partition `finished > racing > dnf`, then lap > z >
  totalDistance > carId lex). The iter-19 §8 ranking case
  `[(1,1500),(1,1900),(2,10),(1,800)]` ranks as
  `[carC, carB, carA, carD]`, asserted in the test file.
- Shipped the `FinalRaceState` shape and `buildFinalRaceState(input)`
  builder. Per-car `bestLapMs` derives from `Math.min` of the lap
  array; fastest lap scans every (car, lapIndex) cell with earliest-
  lap and lex-carId tie-breaks. Reward computation
  (`economy-upgrade-ff73b279`) consumes this output; the boundary
  matches the iter-19 §5 split.
- Authored `src/game/__tests__/raceRules.test.ts` with 31 unit cells
  covering countdown labels (parametric), DNF off-track / no-progress
  windows, the threshold-on-exact-tick edge cases, the off-track
  reason preference on simultaneous trip, race-time-limit edge cases,
  ranking ladder + status partition, and the full
  `buildFinalRaceState` happy path / DNF / no-laps / determinism
  matrix. Frozen-input invariant asserted; per-call fresh-object
  invariant asserted.
- Filed sub-dot `VibeGear2-implement-pure-racerules-6272a25e` under
  the parent composite `VibeGear2-implement-race-rules-b30656ae`.
  Pure-helpers slice is closed; the wiring slice (race-session
  integration, `RaceState.cars[]` extension, Playwright e2e for
  3-lap race) lands in a follow-up sub-dot. Parent composite stays
  open per the iter-30 HUD-UI tracking-parent pattern.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (965 tests, 42 files; 31 new in raceRules.test.ts).
- `npm run build` clean.
- `npm run test:e2e` green (28 specs).
- No em-dashes (U+2014) or en-dashes (U+2013) in any added file
  (`grep -P "[\x{2013}\x{2014}]"` returns nothing).

### Decisions and assumptions
- Re-exported `DEFAULT_COUNTDOWN_SEC` from `raceRules.ts` rather than
  duplicating. Single source of truth lives in `raceState.ts`; the
  re-export keeps `raceRules.ts` self-contained for downstream
  consumers without a module-graph cycle.
- `labelForCountdown` returns `"GO"` for non-finite or non-positive
  inputs (including `+Infinity`) as a defensive fallback. A caller
  that subtracts past zero before checking phase still renders a
  sensible label.
- `tickDnfTimers` off-track reset uses the two-condition rule:
  on-road OR moving-fast (`speed >= DNF_OFF_TRACK_RESET_SPEED_M_PER_S`,
  pinned at 5 m/s ~ 18 km/h). A car blasting through gravel at full
  speed is racing, not retired; only a slow off-road excursion
  accumulates the timeout.
- When both timers trip on the same tick, `tickDnfTimers` reports the
  off-track reason because that is the more informative outcome for
  the §20 results screen.
- Ranking inside the `finished` status partition uses carId lex
  order in this slice. The iter-19 stress-test pinned
  `finishedAtTick` as the canonical tie-break; that field belongs on
  the wiring slice's extended `CarRankSnapshot` shape, deferred to
  keep the pure-helpers surface minimal.
- The DNF threshold values (30s off-track, 60s no-progress, 600s race
  cap, 5m progress delta) are pinned per the iter-19 stress-test §4.
  No new GDD edits required; §7 explicitly defers the numbers to the
  implementer.
- `buildFinalRaceState`'s DNF ordering (descending laps, then
  ascending last-lap time, then carId lex) is a slice-local choice;
  the §7 standings table only specifies tour-aggregate tie-breaks,
  not per-race DNF ordering. Documented inline.

### Followups created
- (none) The wiring slice belongs to a follow-up sub-dot of the
  parent composite. The composite tracks the remaining work:
  `RaceState.cars[]` extension, race-session integration replacing
  the current `Math.floor(z / trackLength)` lap-detection stub, and
  the Playwright `e2e/race-finish.spec.ts` for a 3-lap race against
  AI.

### GDD edits
- None. §7 race-rules text is unchanged; the threshold values land
  as code-level constants per the parent dot's stress-test pin.

---

## 2026-04-26: Slice: LEGAL_SAFETY.md authoring per GDD §26

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) (the IP-contamination
rules and the suggested issue labels including `legal-review`),
[§27](gdd/27-risks-and-mitigations.md) (legal / IP drift named as a
primary risk; this document is the named mitigation), and the IP
perimeter from
[§1](gdd/01-title-and-high-concept.md) and
[§2](gdd/02-spiritual-successor-boundaries.md).
**Branch / PR:** `feat/legal-safety-doc` (stacked on
`feat/manual-transmission-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Authored `docs/LEGAL_SAFETY.md` with all 14 sections from the dot's
  binding outline: purpose and audience, the IP perimeter, safe content
  patterns with concrete examples, unsafe content patterns with concrete
  counter-examples, the grey-zone escalation surface, the asset
  manifest provenance contract, originality statement guidance, the PR
  checklist (reproduced verbatim from CONTRIBUTING for self-containment),
  the future content-lint denylist contract, the visual / audio review
  bar, the `legal-review` label protocol, the take-down request
  protocol, the issues / wiki rules, and the update-this-document
  protocol.
- Cross-linked the doc to `LICENSE`, `ASSETS-LICENSE`, the eventual
  `DATA-LICENSE`, `CONTRIBUTING.md`, the eventual `MODDING.md`, and the
  GDD sections that anchor the IP perimeter.
- Added a "Legal safety" one-liner to the README's "Reading order for
  new contributors" block so new contributors land on the doc before
  they ship art or audio.
- Filed `F-020` against the future `scripts/content-lint.ts`: the
  contract for what the lint enforces lives in LEGAL_SAFETY.md §9, the
  script that enforces it ships separately. `nice-to-have` priority,
  matches the dot's "Verify" bullet.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run build` clean.
- `npm run test:e2e` green.
- No em-dashes (U+2014) or en-dashes (U+2013) in
  `docs/LEGAL_SAFETY.md`, the `README.md` diff, or the `FOLLOWUPS.md`
  diff (`grep -P "[\x{2014}\x{2013}]"` returns nothing for each).

### Decisions and assumptions
- Cross-linked to `DATA-LICENSE` even though the file does not exist
  yet. The dot's "Edge Cases" allows forward links to as-yet-unwritten
  siblings; the licence-files slice will land the file shortly. Until
  then, the doc states the convention (track JSON is CC BY-SA 4.0 by
  GDD §26) so contributors are not blocked.
- Cross-linked to `docs/MODDING.md` even though that file is owned by a
  separate dot (`implement-modding-md-efbf1c83`). Same forward-link
  rationale.
- Reproduced the PR checklist verbatim from `docs/CONTRIBUTING.md`
  rather than cross-link only. The dot's outline §8 explicitly asked
  for reproduction so the file stays self-contained; the duplication
  is intentional and the maintainer keeps both copies in sync at
  edit time.
- Did not enumerate every conceivable real-circuit name in the
  denylist illustration; the doc states the lists are illustrative and
  the authoritative version lives in the lint script when it lands
  (F-020). This avoids false implication that the doc is the
  enforceable surface.
- Did not name any specific real driver, current Formula 1 team, or
  current racing organisation, even as a "do not use" example. The
  dot's "Edge Cases" forbade that pattern; the doc uses generic
  placeholders ("any real-world racing-circuit name") instead.

### Followups created
- `F-020`: `scripts/content-lint.ts` implementing the §9 denylist
  contract.

### GDD edits
- None. The doc cites GDD §26 §27 §1 §2 verbatim; no GDD changes
  required.

---

## 2026-04-26: Slice: manual transmission race-session wiring

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Gear shifting") and
[§19](gdd/19-controls-and-input.md) (E / Q for keyboard, RB / LB for
gamepad). The pure transmission state machine in
`src/game/transmission.ts` is now consumed by the race session each
tick, so the on-track behaviour matches the §10 torque curve plus the
§19 manual-shift rising-edge contract.
**Branch / PR:** `feat/manual-transmission-race-wiring` (stacked on
`feat/drafting-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Added `createTransmissionForCar(stats, options)` and a
  race-session-friendly alias `tickTransmission(state, ctx, dt)` to
  `src/game/transmission.ts`. The constructor reads the player-facing
  mode (`SaveGameSettings.transmissionMode`) plus the active car's
  installed gearbox upgrade tier so the per-race state machine starts
  with the right reducer branch wired up from tick zero.
- Extended `RaceSessionPlayer` with an optional `transmissionMode`
  field defaulting to `"auto"` (matching the §10 default and the
  schema's optional-for-legacy-saves shape).
- Extended `RaceSessionPlayerCar` and `RaceSessionAICar` with
  `transmission`, `lastShiftUpPressed`, and `lastShiftDownPressed`
  fields so the race session can detect the rising edge of the
  player's shift inputs and feed the resulting one-tap-one-shift
  signal into `tickTransmission`. AI cars are pinned to `"auto"` with
  the same edge-detection plumbing for parity (no AI archetype today
  emits shift inputs).
- `stepRaceSession` advances transmission state on the same tick as
  nitro and drafting, then composes
  `gearAccelMultiplier(transmission)` multiplicatively with the nitro
  `accelMultiplier` and feeds the composed value into `physics.step`
  so a manual driver who taps nitro mid-band benefits from both.
- `cloneSessionState` and the countdown / promoted-to-racing branches
  spread the new fields uniformly so every state path stays a fresh
  immutable object (no aliasing between ticks).
- Added 12 new tests under `stepRaceSession (transmission)` covering
  the dot's verify items: per-car transmission init at race start,
  honour `transmissionMode` setting, AI always auto, auto mode ignores
  shift inputs, manual rising-edge fires once per tap, held shift does
  not cascade, releasing re-arms the edge detector, manual shiftDown
  drops a gear, gearbox upgrade tier caps max gear, gear curve
  composes multiplicatively with nitro, auto mode upshifts on
  acceleration, and 1000-tick determinism under a mixed
  shift-tap / throttle input stream.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (917 tests, 41 files; +12 from this slice).
- `npm run build` clean.
- `npm run test:e2e` green (28 tests).

### Decisions and assumptions
- Composed gear multiplier with nitro multiplier multiplicatively. The
  §10 budget calls the manual peak a small expert advantage (under
  5%); composing multiplicatively keeps the §10 nitro thrust ceiling
  the dominant accel knob and lets the gear curve sit alongside as a
  feel modifier rather than a top-speed lever.
- Pinned AI cars to `"auto"` regardless of player settings. The
  `clean_line` archetype never raises shift inputs; future archetypes
  that want to opt in can pass `transmissionMode: "manual"` through a
  config-shape extension.
- Did not wire the race page (`src/app/race/page.tsx`) to read the
  transmission setting from `loadSave()` yet. The pure runtime is the
  scope of this dot; integrating the save-loaded settings into the
  page is a wider integration owned by the savegamesettings dot.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: drafting / slipstream race-session wiring

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Drafting" subsection):
the pure helpers in `src/game/drafting.ts` are now consumed by the
race session each tick, so the on-track behaviour matches the §10
"0.6 s engagement, break on side movement / brake" rules end to end.
**Branch / PR:** `feat/drafting-race-wiring` (stacked on
`feat/nitro-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Wired `computeWakeOffset` + `tickDraftWindow` into
  `src/game/raceSession.ts` so every car (player + AI) runs a per-tick
  draft scan and the resulting `accelMultiplier` flows into
  `physics.step` via `StepOptions.draftBonus`.
- Added `RaceSessionState.draftWindows` keyed by
  `<followerId>>>><leaderId>` (`draftPairKey`) so multiple parallel
  pairs in a full grid stay isolated. `PLAYER_CAR_ID` and `aiCarId`
  exports give callers a stable id mapping.
- Per-tick rule: each follower's `pickLeader` pass picks the closest
  in-wake leader (deterministic tiebreak by lexical leader id), then
  every existing pair entry for that follower is advanced through
  `tickDraftWindow`. Pairs whose geometry now reads `inWake: false`
  reset to `{ engagedMs: 0, accelMultiplier: 1 }` the same tick the
  side-step / brake / out-of-gap event happens, matching §10's "break
  instantly" rule.
- Only the actively-picked pair contributes to the physics bonus; the
  other windows persist for re-engagement bookkeeping but cannot stack
  with the active pick.
- Added 9 new tests under `stepRaceSession (drafting)` covering the
  dot's verify items: 1000-tick determinism with 2 cars in tandem,
  brake input zeroes the bonus, side-step zeroes the bonus,
  pair-isolation in a 4-car field, no bonus below the speed threshold,
  no advancement during countdown, and an end-to-end physics integration
  check (a drafting follower out-distances a solo runner over 120 ticks).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (905 tests, 41 files).
- `npm run build` clean.
- `npm run test:e2e` green (28 specs across chromium and
  mobile-chromium projects).
- No em-dashes / en-dashes in any touched file (grep U+2014 / U+2013).

### Decisions and assumptions
- Pair-isolation is enforced by writing every existing follower pair
  entry through `tickDraftWindow` each tick, not just the actively
  picked one. The alternative (only advance the active pair, leave
  others untouched) would let stale `engagedMs` linger across leader
  switches and fail the §10 "break instantly" rule when the follower
  swerves wide of one leader and into the wake of another.
- `pickLeader` ties break by lexical leader id so two leaders at the
  same `longitudinalGap` always resolve identically across runs. This
  matters at race start where the grid spacing puts AI cars exactly
  `AI_GRID_SPACING_M` apart.

### Followups
- None new. The §10 "Drafting" entry is now end-to-end wired; future
  HUD work (F-NNN) might surface the engaged multiplier as a small
  indicator next to the speedometer.

---

## 2026-04-26: Slice: deferred Playwright e2e specs (F-016, F-017, F-018)

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) (touch overlay verification),
[§20](gdd/20-hud-and-ui-ux.md) (pause overlay, error fallback,
loading screen affordances),
[§21](gdd/21-technical-design-for-web-implementation.md) (Testing
approach: Playwright spec coverage for the Phase 1 vertical slice).
**Branch / PR:** `feat/deferred-playwright-e2e` (stacked on
`feat/nitro-system`), PR pending.
**Status:** Implemented.

### Done
- Added three dev-only routes that give the e2e suite deterministic
  surfaces to drive without dragging in production wiring that other
  slices still own:
  - `src/app/dev/throw/page.tsx`: client component that throws a
    fixed message synchronously in render so the root
    `<ErrorBoundary>` catches and renders its fallback. The throw
    happens in render so `getDerivedStateFromError` runs, not in an
    effect (where the boundary cannot see it).
  - `src/app/dev/touch/page.tsx`: mounts `<TouchControls forceVisible />`
    over a surface div wired to
    `createInputManager({ touchTarget })`. Surfaces the latest sampled
    `Input` (steer, throttle, brake, nitro, pause) as
    `data-testid="touch-metric-*"` for the spec to read.
  - `src/app/dev/loading/page.tsx`: mounts `<LoadingGate>` against a
    synthetic in-page fetcher whose per-entry resolution delay is
    controlled by `?delay=<ms>` (default 200) and whose forced
    critical-failure path is opt-in via `?fail=1`. Children render a
    `data-testid="loading-dev-ready"` card on success.
- Added the four deferred specs:
  - `e2e/pause-overlay.spec.ts`: Escape opens the overlay, the
    speedometer is stable across a 500 ms gap (proving
    `LoopHandle.pause()` fires on the same edge), Escape and the
    Resume button each dismiss it, and the Retire entry is present
    but disabled (the race route does not pass `onRetire` until the
    results screen lands).
  - `e2e/error-boundary.spec.ts`: the fallback renders with
    `role="alert"`, the inline message matches the forced throw, the
    Reload button reloads the page (and the boundary catches the
    second throw on the reloaded route), and the Copy button does not
    crash with clipboard permissions granted.
  - `e2e/touch-input.spec.ts`: runs against a new `mobile-chromium`
    Playwright project (iPhone 13 emulation). Holds the GAS, BRK, and
    pause-corner zones with synthetic `PointerEvent`s and asserts the
    matching metric flips. Drags the steering stick past the
    `stickMaxRadius` and asserts `steer > 0.5`.
  - `e2e/loading-screen.spec.ts`: drives `/dev/loading?delay=300`,
    asserts the screen is visible with `data-phase="loading"` and
    text matching `Loading \d+ of 4`, then waits for `Loaded 4 of 4`
    and the ready card. The failure variant
    (`?delay=80&fail=1`) asserts `data-phase="failed-critical"` and
    that the Retry button mounts.
- Updated `playwright.config.ts` to add the `mobile-chromium` project
  (iPhone 13 emulation, scoped to `touch-input.spec.ts`) and to
  exclude that spec from the default chromium project so the desktop
  pointer profile does not try to drive the on-screen overlay.
- Marked F-016, F-017, F-018 `done` in `docs/FOLLOWUPS.md` with
  closing notes pointing at this branch.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (no new unit suites; touched code is e2e + dev
  pages; existing suites still pass).
- `npm run build` clean.
- `npm run test:e2e` green locally on both projects (chromium and
  mobile-chromium), including the four new specs and the existing
  title / options / race-demo coverage.

### Decisions and assumptions
- The race route (`/race`) does not yet wire `touchTarget` into
  `createInputManager`. Driving the touch spec against the race route
  would require either modifying the race wiring (out of scope for
  this dot) or adopting a `forceTouch` query-string side channel
  (rejected on the same grounds the dot rejects `?test_error=1`).
  The dev page is a clean fixture: it mounts the same source +
  overlay pair the race route will mount once that wiring lands, and
  the spec asserts the underlying input shape directly so it is
  immune to the future wiring change.
- The race route also does not yet wire `<LoadingGate>`. The race
  page comment already references `F-018` for that wiring (see
  `src/app/race/page.tsx`). The dev page lets the spec exercise the
  full state machine (loading, ready, failed-critical, retry) end to
  end without coupling it to the production manifest's currently
  empty asset pipeline.
- The error-boundary `Copy error` button reads `navigator.clipboard`
  which Playwright fronts with a permission prompt. The spec grants
  the read/write clipboard permissions before the click so the
  promise resolves cleanly; the button gracefully no-ops when the
  permission is denied (per `ErrorBoundary.tsx`'s `onCopy` guard).
- The pause overlay's Retire button is asserted as `disabled` rather
  than testing the retire flow, because no retire callback is wired
  in the race route yet. When the results screen lands the spec will
  flip the assertion to `toBeEnabled()` and follow the click through
  to the results route.

### Followups created
- None. F-016, F-017, F-018 closed by this slice.

### GDD edits
- None. The slice closes deferred test coverage; no design changes.

---

## 2026-04-26: Slice: nitro / boost system per §10 §12 §19

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Nitro system",
"Damage effects on performance", "Weather effects on handling"),
[§12](gdd/12-upgrade-and-economy-system.md) ("Nitro system" upgrade
category, §12 cost ladder),
[§19](gdd/19-controls-and-input.md) (Space + X / Square bindings).
**Branch / PR:** `feat/nitro-system` (stacked on
`feat/manual-transmission`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/nitro.ts`: pure state machine over
  `{ charges: number; activeRemainingSec: number }` with reducer
  `tickNitro(state, ctx, dt) -> { state, code, isActive }`. The
  reducer treats taps as rising-edge (`pressed && !wasPressed`) so a
  held key does not re-fire on every tick; it ignores taps while a
  charge is currently burning (no stacking, the dot's edge case);
  releasing the key mid-burn does not abort the charge; holding past
  the burn does not extend it.
- Pinned the §10 baselines: `DEFAULT_NITRO_CHARGES = 3`,
  `BASE_NITRO_DURATION_SEC = 1.1`,
  `BASE_NITRO_THRUST_MULTIPLIER = 1.5`. The thrust baseline reads as
  "noticeable, not dominant" and respects the
  `ACCEL_MULTIPLIER_MAX = 2` clamp the physics step already enforces.
- Pinned the §12 nitro upgrade ladder via `NITRO_UPGRADE_TIERS`
  (Stock through Extreme). Each tier scales `chargesBonus`,
  `durationMultiplier`, and `thrustMultiplier`. Stock is identity;
  Extreme grants `+1 charge`, `x1.25 duration`, `x1.235 thrust`. The
  worst-case stacked accel is `1.5 * 1.235 = 1.8525`, comfortably
  under the `2.0` physics ceiling. `nitroUpgradeTierFor(tier)` and
  `nitroUpgradeTierForUpgrades(obj)` read either form; out-of-range
  tiers clamp into the table.
- Added `getNitroAccelMultiplier(state, ctx)`: returns the
  per-tick multiplier the physics step's existing `accelMultiplier`
  slot consumes while a charge is burning, and `1.0` otherwise. The
  result is the product of the tier's thrust, the car's
  `nitroEfficiency` stat (§11), and the §10 damage band's
  `nitroEfficiency`. Clamped into `[1, 2]` so a damaged engine
  never makes the car slower than no boost, and stacked bonuses
  cannot turn the slot into a top-speed cheat.
- Added `getInstabilityMultiplier(state, surface, weather, band)`:
  returns `1.0` when no charge is burning, otherwise the product of
  three axes (`weather risk * surface * damage band`) clamped into
  `[1, INSTABILITY_MULTIPLIER_MAX = 8]`. The §10 weather risk
  table is reproduced via `NITRO_WEATHER_RISK` (8 schema weather
  values mapped onto the §10 6 risk buckets; `dusk` and `night`
  both map to Low; `rain` maps to Medium). Tables are exported so
  HUD and traction-loss consumers can introspect the per-axis
  multipliers without re-deriving them.
- Race-start helper `createNitroForCar(stats, upgrades?)` reads the
  nitro upgrade tier from the player's installed upgrades and
  returns a frozen baseline state with `DEFAULT_NITRO_CHARGES +
  tier.chargesBonus` charges. Re-exported from
  `src/game/index.ts`.
- Added `src/game/__tests__/nitro.test.ts` (52 tests): frozen
  initial state, charge clamps, upgrade ladder shape and curve
  monotonicity, tap rising-edge detection, no charge stacking,
  three-charge spend exhaustion path, hold-past-duration boundary,
  defensive `dt <= 0` and stale-charge clamp paths,
  thrust-multiplier integration with car stats and damage band,
  no-boost floor when damage drags the boost below 1.0, the
  full instability table cross-product (3 surface x 8 weather x 5
  damage bands = 120 cells), 1000-tick deterministic replay,
  immutability guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (52 new nitro tests on top of the prior suite).
- `npm run build` clean. No route-size delta (the new module is
  game-logic only and not yet consumed by the renderer or
  `raceSession.ts`; integration with the existing physics seam
  ships in a follow-on slice via the `accelMultiplier` slot
  already plumbed by the transmission slice).
- `npm run test:e2e` skipped: pure reducer module with no DOM
  surface; no e2e specs were added or broken.
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Time field renamed from the dot's `activeUntilMs` to
  `activeRemainingSec` so it reads in the same units (`dt` in
  seconds) as the rest of the sim. Folding nitro time into the
  same dt cadence keeps the §21 replay/ghost system safe; an
  absolute-ms accumulator would diverge across runs whenever the
  loop's start timestamp changed.
- Tap detection uses a `wasPressed` companion rather than
  edge-triggering inside the input layer. Passing the prior
  press state through the context keeps the reducer stateless and
  matches the same pattern the transmission slice's `shiftUp` /
  `shiftDown` use.
- The dot pins the instability table at "6 weather x 4 surface x 5
  damage" (120 cells). The §22 `WeatherOption` enum carries 8
  values (mapped onto the §10 6 risk buckets), and the physics
  `Surface` type carries 3 values (`road | rumble | grass`), so
  the implemented cross-product is 8 x 3 x 5 = 120 cells under
  test, just along different axes than the dot's stress-test had
  in mind. The `NITRO_WEATHER_RISK` map is the explicit bridge
  between the schema's 8 weather values and the §10's 6 risk
  buckets.
- `getNitroAccelMultiplier` clamps to a no-boost floor of `1.0`
  rather than allowing severe damage to drag the multiplier below
  the no-boost identity. The §10 narrative describes a "weaker"
  nitro under damage, not a punishing one; the floor keeps the
  player from being penalised for using a charge while wrecked.
- Per-tier numbers (Sport `+0`, Factory `+1`, Extreme `+1` charge)
  pinned without a §12 explicit table; the §12 narrative says
  "Raises boost thrust and burn duration" without pinning a curve.
  The implemented curve is monotonically non-decreasing across
  tiers (asserted by the unit tests) and the worst-case Extreme
  product stays under the physics `ACCEL_MULTIPLIER_MAX = 2`
  clamp; a future balancing slice can pick exact numbers without
  rewriting consumers.
- The race session integration (resetting nitro to baseline
  charges at race start, feeding `getNitroAccelMultiplier` into
  the physics call site) is a follow-on slice. This slice ships
  the pure module + the per-tier table; the integration is a
  one-line `accelMultiplier: getNitroAccelMultiplier(...)` plumb
  that fits cleanly in the next slice without a rewrite.

### Followups created
- None. The race-session integration is a Phase 1 / 5 follow-on
  that will consume the helpers added here; it does not need a
  net-new follow-up entry because the existing
  `implement-phase-1-7aef013d` and `implement-race-rules-b30656ae`
  dots are the natural homes.

### GDD edits
- None. The implementation pins are inside the code; the §10 and
  §12 narratives stand as written.

---

## 2026-04-26: Slice: manual transmission and gear shifting per §10 §19

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Gear shifting"),
[§12](gdd/12-upgrade-and-economy-system.md) (Gearbox upgrade ladder),
[§19](gdd/19-controls-and-input.md) (E / Q + RB / LB bindings).
**Branch / PR:** `feat/manual-transmission` (stacked on
`feat/damage-band`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/transmission.ts`: pure state machine over
  `{ mode: 'auto' | 'manual', gear: 1..7, rpm: 0..1 }` with reducer
  `stepTransmission(state, ctx)`. Auto upshifts when prior RPM
  exceeds `AUTO_UPSHIFT_RPM = 0.85` and a higher gear exists; auto
  downshifts when prior RPM drops below `AUTO_DOWNSHIFT_RPM = 0.4`
  or the brake is pressed in any gear above first. Manual ignores
  auto thresholds and consumes `shiftUp` / `shiftDown` directly,
  ignored at the per-tier max gear / first-gear edges. Auto mode
  ignores shift inputs entirely so a stray press does not toggle
  modes (the dot's edge case).
- Pinned the gearbox upgrade ladder: Stock 5, Street 5, Sport 6,
  Factory 6, Extreme 7 in `MAX_GEAR_BY_GEARBOX_UPGRADE`. Helpers
  `maxGearForGearboxUpgrade(tier)` and `maxGearForUpgrades(obj)`
  read either form; out-of-range tiers clamp into the table.
- Pinned the torque curve via `gearAccelMultiplier(state)`: floor
  at `TORQUE_CURVE_FLOOR = 0.55` below `0.15` RPM, linear ramp to
  the gear's peak at `REDLINE_SOFT_LIMIT_RPM = 0.95`, then redline
  taper down to `peak * REDLINE_PENALTY_MULTIPLIER = 0.85` at the
  hard limit `1.0`. Auto peak `1.0`; manual peak `1.04`. The
  `1.04 / 1.0 = 1.04` ratio is the §10 "small expert advantage"
  budget, well under the dot's 5% cap. RPM clamps defensively
  into `[0, 1]` so a stale or buggy speed cannot poison physics.
- Wired `accelMultiplier` through `physics.step()` as a new
  optional `StepOptions` field (alongside `draftBonus` and
  `damageScalars`). The throttle term is now `accel * throttle *
  draftBonus * accelMultiplier * dt`. Defaults to `1.0` so existing
  call sites (`raceSession.ts`, the dev page, AI loop) keep their
  behaviour bit-for-bit. The race-session integration with the
  transmission reducer is a follow-on slice (kept narrow per the
  one-slice-one-PR rule); this slice ships the pure module + the
  physics seam.
- Added `transmissionMode: 'auto' | 'manual'` to
  `SaveGameSettingsSchema` as an optional field (back-compat with
  v1 saves; treat `undefined` as `'auto'` per §10). `defaultSave()`
  always sets it to `'auto'`. The §22 `saveGame.example.json` now
  carries the field. Schema tests cover the manual case, the
  default-auto case, and the bad-enum case.
- Re-exported the new module from `src/game/index.ts`.
- Added `src/game/__tests__/transmission.test.ts` (34 tests):
  upgrade-tier table, RPM band conversion (clamps and degenerates),
  auto upshift / downshift / brake-downshift / no-toggle behaviour,
  manual shift edges (max gear ignored, first gear ignored),
  stale-upgrade clamp, redline limiter, torque-curve monotonicity,
  manual-vs-auto < 5% advantage check, 200-step deterministic
  replay, immutability guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (824 tests; 34 new in `transmission.test.ts`,
  3 new schema tests).
- `npm run build` clean. No route-size delta (the new module is
  game-logic only and not consumed by the renderer yet).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  transmission state is a pure reducer).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Gear count by upgrade tier pinned at Stock 5, Street 5, Sport 6,
  Factory 6, Extreme 7. The dot pins these; the underlying §12
  text is qualitative ("unlocks higher gearing") so the numeric
  cadence here is the canonical source until a balancing slice
  changes it.
- Torque curve pinned to a linear floor / ramp / penalty model.
  §10's "smooths high-speed pull" language is qualitative; pinning
  the shape in one frozen function keeps the math reviewable and
  lets a future balancing slice pick exact numbers without
  rewriting consumers.
- Manual peak set to 1.04 (4%). The dot caps the advantage at
  under 5%; 4% gives a noticeable but undominating expert margin.
  The `tests` enforce the cap so a future tweak past 5% trips a
  test rather than silently breaking the §10 design promise.
- `transmissionMode` is persisted as `optional()` at the schema
  layer (matching the `difficultyPreset` pattern) so v1 saves
  written before this field landed continue to load. The
  `defaultSave()` writer sets the field eagerly, and consumers
  (HUD, race session) can default to `'auto'` when reading from a
  loaded save without a migration.
- Auto-mode brake-downshift fires from any gear > 1, not just at
  low RPM. §10's "downshift on brake" cue describes the
  expectation; the implementation matches by allowing the brake to
  drop one gear per tick until first.

### Followups
- F-NNN: wire `stepTransmission` into `raceSession` so the player
  car's `accelMultiplier` actually consumes the gear curve at race
  time. Held as a separate slice because the race session also
  owns the input-edge debouncing for `shiftUp` / `shiftDown` and
  the HUD slice owns the gear / RPM widgets; bundling these would
  bust the one-slice-one-PR rule.
- F-NNN: Settings UI control to toggle `transmissionMode`. Out of
  scope for this slice; the §20 HUD slice is the natural home.
- F-NNN: gear-shift SFX hook (the dot mentions a "limit" SFX cue
  for blocked shifts at max gear). Lives with the §18 sound slice.

### GDD edits
- None. Implementation reads §10, §12, §19 verbatim; pinned
  numeric values are documented in the module header rather than
  in the GDD so the design text stays qualitative.

---

## 2026-04-26: Slice: damage band performance scaling per §10 §13

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md)
("Damage effects on performance"),
[§13](gdd/13-damage-repairs-and-risk.md) ("Mechanical effects").
**Branch / PR:** `feat/damage-band` (stacked on `feat/damage-model`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/game/damageBands.ts`: pure
  `getDamageScalars(damagePercent: number): DamageScalars` returning
  `{ stability, gripScalar, topSpeedScalar, nitroEfficiency,
  spinRiskMultiplier }` per the §10 "Damage effects on performance"
  table. Five bands: cosmetic (0..24, identity), light (25..49,
  stability and nitro hit), moderate (50..74, grip and top speed
  start to drop), severe (75..99, heavy power loss), catastrophic
  (100, limp). Boundary rule pinned to inclusive lower bound
  (`>= 25` enters light). `MAX_SPIN_RISK_MULTIPLIER = 4` ceiling.
  Companion `getDamageBand(percent)` returns the named band for HUD
  consumers. `DAMAGE_BANDS` constant frozen so the lookup is
  reviewable in one place.
- Wired `damageScalars` through `physics.step()` as a new optional
  `StepOptions` field (alongside the existing `draftBonus`). The
  step consumes `topSpeedScalar` (shrinks the cap) and `gripScalar`
  (derates traction); `stability`, `nitroEfficiency`, and
  `spinRiskMultiplier` are exposed for the future steering
  smoothing, nitro, and traction-loss slices to read off the same
  scalars without a second resolve. Defaults to `PRISTINE_SCALARS`
  when omitted (back-compat: existing call sites in
  `raceSession.ts` and the dev page keep their behaviour).
- Re-exported the new module from `src/game/index.ts`.
- Added `src/game/__tests__/damageBands.test.ts` (37 tests):
  the dot's nine boundary values (0, 24, 25, 49, 50, 74, 75, 99,
  100) snapshot the documented tuples; monotonic invariants walk
  every integer percent and assert non-increasing
  stability/grip/topSpeed/nitroEfficiency and non-decreasing
  spinRisk; out-of-range inputs (NaN, negatives, +/-Infinity)
  clamp without throwing; determinism (1000-iter and full-table
  re-snapshot) confirms no `Math.random` / `Date.now` leakage; the
  physics integration test confirms a car at 80% damage caps at
  `61 * 0.78 = 47.58 m/s` versus the pristine 61 m/s under
  identical inputs and drifts 70% as far laterally for the same
  steer input (matching the severe band's gripScalar = 0.7).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (787 tests, 37 new in `damageBands.test.ts`).
- `npm run build` clean. No route-size delta (the new field is
  optional and the renderer / race scene do not consume it yet).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  band lookup is pure game logic).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Bands are inclusive at the lower bound. The dot's edge case asks
  for the rounding rule to be explicit; `25.000` lives in the
  light band, not the cosmetic band. Lookup walks `DAMAGE_BANDS`
  highest-to-lowest and takes the first whose `min` is at most the
  clamped input, which encodes the same rule.
- Pinned numeric values per band (light: stability 0.92, nitro 0.9;
  moderate: stability 0.8, grip 0.85, topSpeed 0.92, nitro 0.8,
  spin 1.5; severe: stability 0.6, grip 0.7, topSpeed 0.78, nitro
  0.6, spin 2.5; catastrophic: stability 0.45, grip 0.55, topSpeed
  0.55, nitro 0.4, spin 4.0). §10 only pins the qualitative
  effects; numbers are picked to keep a fully-damaged car
  "limp but finishable" per the §13 "Balancing principle". A
  future balancing pass owns the final values.
- `spinRiskMultiplier` is exposed but no consumer reads it yet.
  The future traction-loss slice will multiply it against its base
  spin probability. `MAX_SPIN_RISK_MULTIPLIER = 4` pins the
  ceiling so a tweak to the table cannot accidentally turn the
  catastrophic band into "instant spin every tick".
- 100% pin: §10 says "catastrophic state, either limp mode or
  retire". This module owns only the limp side (the scalars). The
  retire (DNF) decision is owned by the damage state machine
  (`isWrecked()`) and the future race-rules engine.
- Out-of-range inputs (NaN, < 0, > 100, +/-Infinity) clamp into
  `[0, 100]` rather than throwing. Physics must not crash on a
  stale damage value.

### Followups created
- None new. The §15 traction-loss / spin slice will consume
  `spinRiskMultiplier` when it lands. The race session damage
  integration slice (still tracked under F-019) will resolve the
  band per-tick from `DamageState.total` and pass `damageScalars`
  into `physics.step()`.

### GDD edits
- None. The §10 "Damage effects on performance" narrative is the
  source; the per-band numeric pins live in the module's docstring
  and the test file's snapshots.

---

## 2026-04-26: Slice: damage model per §13

**GDD sections touched:** [§13](gdd/13-damage-repairs-and-risk.md)
("Damage sources", "Damage visualization", "Mechanical effects",
"Repair decisions", "Race-ending damage threshold"),
[§23](gdd/23-balancing-tables.md) ("Damage formula targets").
**Branch / PR:** `feat/damage-model` (stacked on
`feat/drafting-slipstream`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/damage.ts`: pure damage module with the public
  surface `applyHit`, `applyOffRoadDamage`, `performanceMultiplier`,
  `isWrecked`, `repairCostFor`, `totalRepairCost`, `createDamageState`,
  `PRISTINE_DAMAGE_STATE`, plus the constants surface
  (`DEFAULT_ZONE_DISTRIBUTION`, `DAMAGE_UNIT_SCALE = 100`,
  `PERFORMANCE_FLOOR = { engine: 0.55, tires: 0.65, body: 1.0 }`,
  `TOTAL_DAMAGE_WEIGHTS = { engine: 0.45, tires: 0.20, body: 0.35 }`,
  `WRECK_THRESHOLD = 0.95`, `OFF_ROAD_DAMAGE_PER_M = 0.000107`,
  `REPAIR_BASE_COST_CREDITS = { engine: 1500, tires: 600, body: 900 }`).
- Per-zone (`engine`, `tires`, `body`) accumulator with weighted total.
  Hits clamp at 1.0 per zone with no overflow bleed into other zones.
  No `Math.random` or `Date.now`; identical inputs return deep-equal
  outputs (1000-iteration deep-equal test).
- `applyOffRoadDamage(state, speed, dt)` ships the F-015 hand-off:
  body damage from 5 s of top-speed off-road equals one mid-speed
  carHit body share within 1%. F-015 marked `in-progress` (producer
  ready, consumer wiring deferred to the race-session damage
  integration slice tracked as F-019).
- Added `src/game/__tests__/damage.test.ts` (42 tests): verify items
  cell-by-cell (rub mid-range distribution, clamping no-bleed,
  performance falloff at engine=0.5 -> 0.775, body floor at 1.0,
  wreck threshold trip and tires-only no-trip, repair cost zero on
  clean, determinism, idempotent no-op hits, off-road accumulator
  matching the F-015 stress-test), plus distribution-row sums-to-1
  invariants and constants-surface sanity checks.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (750 tests, 42 new in `damage.test.ts`).
- `npm run build` clean. No route-size delta (damage is a game-logic
  module not yet wired into any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since damage
  is pure game logic and not yet wired into the race scene).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- The §23 magnitude ranges (e.g. `rubDamage = 2 to 4`) collapse to
  the mid-range value (caller-supplied) until the seeded-RNG slice
  lands. The damage module itself never consumes a PRNG so the
  determinism invariant holds regardless of how the caller picks
  magnitudes.
- `DEFAULT_ZONE_DISTRIBUTION` rows (per HitKind) are pinned per the
  iter-19 stress-test §4. Each row sums to 1.0 so `totalIncrement` is
  conserved across zones; balancing pass owns final values.
- `DAMAGE_UNIT_SCALE = 100` converts §23 raw magnitudes (where a wall
  hit at `24` is "serious but survivable") to the `[0, 1]` per-zone
  scale this module uses internally. A wall hit at 24 + speedFactor 1
  deposits 0.24 units across zones, matching the §13 design goal.
- `PERFORMANCE_FLOOR` keeps a fully damaged car limp-but-finishable
  per the §13 "Balancing principle". Body damage returns multiplier
  1.0 because §13 routes body penalties through the `rub` hit
  category (rubbing penalty surfaces as new tires-zone damage), not
  through a direct performance multiplier.
- `TOTAL_DAMAGE_WEIGHTS` weights engine highest because a holed
  engine ends a race; tires lowest because §13 says "side / rear
  damage cause handling effects" rather than DNF-class consequences.
- `WRECK_THRESHOLD = 0.95` (not 1.0) leaves room for a HUD
  "you're about to wreck" warning band before the §7 race-rules slice
  flips the car to `dnf`.
- `OFF_ROAD_DAMAGE_PER_M = 0.000107` is calibrated to the F-015
  stress-test target (5 s top-speed off-road body damage equals one
  mid-speed carHit body share within 1%).
- `REPAIR_BASE_COST_CREDITS` per-zone prices fit the §23 reward
  formula (a tier-3 race pays 1750, so a typical race's worth of
  damage costs roughly 100 to 300 credits to repair). Numbers are
  pinned in one place so the §12 economy / upgrade slice can read
  them directly.
- Module is intentionally state-free at the per-car level: `RaceSessionAICar`
  and `player` will own a `DamageState` field in the integration
  slice. Keeping the damage module decoupled from `physics.ts` keeps
  the kinematic step pristine (drafting also uses this pattern).

### Followups created
- F-019: Race session integration of the §13 damage model
  (consumer-side wiring deferred until the multi-car collision
  detection slice).
- F-015 transitioned `open -> in-progress` since the off-road damage
  helper exists; a `done` transition lands with the consumer wiring.

### GDD edits
- None. The module is a faithful implementation of §13 + §23. A
  future balancing pass may revisit `PERFORMANCE_FLOOR`,
  `TOTAL_DAMAGE_WEIGHTS`, and the per-kind zone distribution rows;
  those revisits will land as their own slices with the GDD edit in
  the same PR.

---

## 2026-04-26: Slice: drafting / slipstream per §10

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md)
("Drafting" subsection).
**Branch / PR:** `feat/drafting-slipstream` (stacked on
`feat/ai-driver-content`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/drafting.ts`: pure helpers `computeWakeOffset(leader,
  follower)` and `tickDraftWindow(state, wake, inputs, dt)` that produce
  an additive accel multiplier. Exposed pinned constants
  (`DRAFT_MIN_SPEED_M_PER_S = 30`, `DRAFT_ENGAGE_MS = 600`,
  `DRAFT_RAMP_MS = 400`, `DRAFT_MAX_ACCEL_MULTIPLIER = 1.05`,
  `DRAFT_LATERAL_TOLERANCE_M = 0.8`, `DRAFT_LATERAL_BREAK_M = 1.5`,
  `DRAFT_LONGITUDINAL_GAP_M = 25`) so the verify dot, future tuning
  passes, and a HUD widget can all read the same numbers.
- Updated `src/game/physics.ts` `step()` to accept an optional
  `StepOptions` argument with a `draftBonus` field. The bonus is a
  multiplicative scalar applied to throttle-driven acceleration only,
  clamped to `[1, DRAFT_BONUS_MAX = 1.5]` so a buggy caller cannot turn
  the bonus into a top-speed override. Default behaviour is unchanged
  (parameter is optional, defaults to `1`).
- Added `src/game/__tests__/drafting.test.ts` (33 tests): the dot's
  five verify items, plus geometric edge cases (lateral tolerance vs
  break threshold, in-front vs behind, longitudinal gap inclusivity),
  break conditions (geometric, brake, speed-threshold), ramp linearity
  (`multiplierForEngagedMs` half-ramp pinned), dt edge cases (zero,
  negative, NaN), purity (no input mutation), determinism (1000
  identical runs produce deep-equal output), intermittent-wake
  resilience, and a small physics integration block confirming the
  step honours `draftBonus` end-to-end.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (708 tests, 33 new in `drafting.test.ts`).
- `npm run build` clean. No route-size delta (drafting is a game-logic
  module not yet wired into any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since drafting
  is pure game logic and not yet wired into the race scene).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Speed threshold pinned to 30 m/s (about 108 km/h). §10 says "activate
  only above a speed threshold" without naming the value; 30 m/s keeps
  drafting a high-speed straight-line tactic rather than a low-speed
  crutch out of corners. Future tuning slice may adjust without editing
  call sites.
- Engagement model is a 0.6 s threshold (per §10) followed by a 0.4 s
  linear ramp to a 5 percent accel multiplier. The ramp avoids a
  discrete snap that would feel like an event rather than a steady
  bonus.
- `computeWakeOffset` is intentionally stateless; the `ageMs: 0` field
  in its return shape is a literal-typed placeholder so the dot's
  verify item ("returns `{ inWake: true, ageMs: 0 }`") reads as a
  shape-stable check. Real time accumulation lives in
  `DraftWindowState.engagedMs` and is advanced by `tickDraftWindow`.
- Lateral geometry uses two thresholds: `DRAFT_LATERAL_TOLERANCE_M`
  (0.8 m, the "small side step still counts as in wake" radius) and
  `DRAFT_LATERAL_BREAK_M` (1.5 m, the verify item's hard break
  threshold). Both are exported. The current implementation only uses
  the break threshold for the binary `inWake` check; the tolerance
  constant is staged for a later slice that may apply a tapered bonus
  near the edge of the cone.
- Physics accepts the bonus as an optional `options.draftBonus` field
  rather than a positional parameter so future modifiers (nitro,
  damage band, weather grip) can layer in additively without growing
  the call signature.

### Followups created
- None. The wiring slice (race scene chooses a leader, calls
  `computeWakeOffset` and `tickDraftWindow` per tick, threads the
  resulting multiplier into `physics.step()`) belongs to whichever
  upcoming slice introduces the multi-car race state. Until then this
  module is a producer waiting for a consumer.

---

## 2026-04-26: Slice: AI driver content registry (20 profiles)

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md) (CPU
archetypes, Difficulty tiers), [§22](gdd/22-data-schemas.md) (AI driver
JSON schema), [§24](gdd/24-content-plan.md) (Data asset list: 20 AI
driver profiles).
**Branch / PR:** `feat/ai-driver-content` (stacked on
`feat/championship-content`), PR pending.
**Status:** Implemented.

### Done
- Authored 20 AI driver JSON files under `src/data/ai/`. File naming
  follows the §22 example (`ai_cleanline_01`, `ai_bully_03`, etc.).
  Distribution: 4 `nitro_burst` (Rocket starter), 4 `clean_line`,
  3 `aggressive` (Bully), 3 `defender` (Cautious), 3 `wet_specialist`
  (Chaotic / weather-volatile), 3 `endurance` (Enduro). Stat shapes
  reflect each archetype: rocket starters carry high `launchBias` and
  weak weatherSkill, defenders/cautious lift `weatherSkill.fog/rain`,
  chaotic profiles spike `mistakeRate` and `panicBias`, enduro picks
  flatten weatherSkill and keep `straightBias` high.
- Added `src/data/ai/index.ts`: static-import barrel exposing
  `AI_DRIVERS`, `AI_DRIVERS_BY_ID`, and `getAIDriver(id)`. Mirrors the
  `getCar` shape (returns undefined on miss so the ai-grid spawner can
  decide policy). Top-of-file comment documents the archetype slot
  mapping between schema enum names and the §15 prose names.
- Re-exported `AI_DRIVERS`, `AI_DRIVERS_BY_ID`, and `getAIDriver` from
  `src/data/index.ts` so callers import via the data barrel.
- Added `src/data/__tests__/ai-content.test.ts` (105 tests): per-driver
  schema validation, archetype-enum coverage, weatherSkill key
  completeness (clear/rain/fog/snow + no extras), `paceScalar` envelope
  (0.9..1.1, derived from §15 difficulty bounds), unit-interval checks
  on mistakeRate/aggression/nitroUsage biases, plus catalogue-level
  invariants (20 drivers, unique ids, unique displayNames, archetype
  distribution pin).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (675 tests, 105 new in `ai-content.test.ts`).
- `npm run build` clean. No route-size delta (AI JSON is data only,
  not yet imported by any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the AI
  registry is data-layer only).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Schema enum (`clean_line, aggressive, defender, wet_specialist,
  nitro_burst, endurance`) and the §15 prose archetype names (Rocket
  starter, Clean line, Bully, Cautious, Chaotic, Enduro) are the same
  six slots under different labels. Documented the mapping in
  `src/data/ai/index.ts`. The `wet_specialist` slot stands in for the
  §15 "Chaotic" archetype until full-ai shapes per-archetype behaviour;
  the chaotic JSONs already lean on high `mistakeRate` and high
  `panicBias` to differentiate from cautious profiles in dry weather.
- `paceScalar` envelope of 0.9..1.1 comes from the §15 Difficulty
  tiers table (Master at +9%, easy at -8%). The roster keeps every
  scalar inside the envelope so ai-grid can layer difficulty modifiers
  without immediately blowing past the upper bound.
- Display names are original two-token call signs (single initial +
  surname, drawn from a deliberately diverse linguistic pool) so the
  legal-safety lint slice can wire its check without flagging any of
  the 20 against active or historical motorsport rosters.
- Distribution (4/4/3/3/3/3 = 20) follows the dot's "documented
  spread"; balancing-pass slice may rebalance, with the index header
  comment as the canonical record.

### Followups created
- None. The full-ai and ai-grid sibling dots will consume this
  registry; this slice intentionally stops at content + barrel.

---

## 2026-04-26: Slice: championship content registry (world-tour-standard)

**GDD sections touched:** [§22](gdd/22-data-schemas.md) (Championship JSON
schema), [§24](gdd/24-content-plan.md) (Suggested region and track list,
Full v1.0 content totals).
**Branch / PR:** `feat/championship-content` (stacked on
`feat/sector-splits`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/data/championships/world-tour-standard.json`: the canonical
  championship file with 8 tours of 4 tracks each, 32 tracks total, ids
  drawn verbatim from §24 "Suggested region and track list" and slugified
  (lowercased, hyphenated, slash-prefixed by tour). `requiredStanding`
  pinned monotonic non-increasing per the dot: 4, 4, 3, 3, 2, 2, 1, 1.
  `difficultyPreset` set to `normal` per §28-difficulty plumbing.
- Added `src/data/championships/index.ts`: static-import barrel exposing
  `CHAMPIONSHIPS`, `CHAMPIONSHIPS_BY_ID`, and a `getChampionship(id)`
  loader that mirrors the `loadTrack` shape (throws on unknown id or
  schema-validation failure for fail-fast loads). Top-of-file comment
  documents the MVP placeholder track ids since JSON cannot carry them.
- Re-exported `CHAMPIONSHIPS`, `CHAMPIONSHIPS_BY_ID`, and
  `getChampionship` from `src/data/index.ts` so callers import via the
  data barrel.
- Added `src/data/__tests__/championship-content.test.ts` (13 tests):
  schema-validation per championship, catalogue invariants, structural
  pins (8 tours, 4 tracks per tour, 32 total, unique ids, nested-id
  prefix), monotonic `requiredStanding`, and a phase-guarded cross-ref
  block. Default permissive mode passes during the MVP content window;
  set `STRICT_CHAMPIONSHIP_TRACKS=1` to enforce full resolution once the
  32-track set lands.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (570 tests, 13 new in `championship-content.test.ts`).
- `npm run build` clean. No route-size delta (championship JSON is data
  only, not yet imported by any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  championship is data-layer only and not yet wired into the title or
  garage flows).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Track ids are slash-nested under their tour id (e.g.
  `velvet-coast/harbor-run`) per the §22 schema example and the existing
  `test/straight`, `test/curve` precedent.
- `requiredStanding` cadence (4, 4, 3, 3, 2, 2, 1, 1) is taken verbatim
  from the dot. The §23-balancing slice may revise once the difficulty
  curve is play-tested.
- The cross-reference test defaults to permissive (no env var needed) so
  CI stays green during MVP. The dot's original
  `ALLOW_UNRESOLVED_CHAMPIONSHIP_TRACKS=1` shape was inverted to
  `STRICT_CHAMPIONSHIP_TRACKS=1` so the green-by-default path is the
  current MVP state, not a configured-CI state. The flag and permissive
  branch both go away once §24 ships in full.
- `getChampionship` throws on unknown id; the symmetric pattern in
  `loadTrack` returns the parsed object on success and throws otherwise.
  `CHAMPIONSHIPS_BY_ID` is exposed for callers (UI selectors) that
  prefer a `Map`-style lookup without the throw.

### Followups created
- None. The championship-content slice is structurally complete; track
  files are owned by sibling MVP-track and full-content slices.

---

## 2026-04-26: Slice: sector splits + ghost delta HUD widget

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Race HUD list:
"lap timer", "best lap"; wireframe: "Top-right: best lap / ghost delta"),
[§22](gdd/22-data-schemas.md) (Track checkpoints; SaveGame records).
**Branch / PR:** `feat/sector-splits` (stacked on `feat/difficulty-preset`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/game/sectorTimer.ts`: pure state machine for the §20 ghost
  delta widget. `createSectorState`, `onCheckpointPass`, `startNewLap`,
  `splitsForLap`, `sectorDeltaMs`, `bestSplitsForTrack`, and
  `shouldWriteBestSplits`. Sign convention pinned: positive delta = current
  is slower; negative = current is faster. Zero / one checkpoint tracks
  collapse to a single whole-lap sector and the widget reverts to lap-timer
  mode. Out-of-order labels are no-ops so the §7 anti-shortcut layer remains
  the single source of truth for correctness.
- Added `src/render/hudSplits.ts`: Canvas2D drawer for the top-right
  splits widget. At most three text drawcalls (timer, sector label, signed
  delta). `formatLapTime` and `formatDelta` (rounded to 100 ms granularity
  per the dot). Delta colour token picked by sign (red for slower, green
  for faster). Reduced-motion safe: no animation.
- Extended `HudState` in `src/game/hudState.ts` with optional
  `bestLapMs` and `sectorDeltaMs` fields so the §20 polish slice can wire
  them without a downstream contract break.
- Extended `SaveGameRecordSchema` in `src/data/schemas.ts` with optional
  `bestSplitsMs: z.array(z.number().nonnegative()).optional()`. Optional
  so v1 saves continue to validate; the dot pins "best-splits write only
  when the OVERALL bestLap improves" and `shouldWriteBestSplits` enforces
  it at the call site.
- Added `src/game/__tests__/sectorTimer.test.ts` (25 tests) covering the
  initial state shapes, sector advance, lap reset, ms formatting,
  cumulative split math, the pinned sign convention, the v1-backfill
  behaviour for `bestSplitsForTrack`, and replay-determinism.
- Added `src/render/__tests__/hudSplits.test.ts` (18 tests) with a
  mock-canvas drawcall snapshot per fixture: positive vs negative delta
  colour, two-vs-three drawcall count for null-vs-non-null delta,
  context-state restoration, and replay-determinism.
- Added three SaveGame schema cases in `src/data/schemas.test.ts`
  covering `bestSplitsMs` accepted, negative entries rejected, and v1
  records (no `bestSplitsMs`) still validate.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (557 tests, 46 new across the three suites).
- `npm run build` clean. No route-size delta (the new modules are
  pure / drawer surfaces and not yet imported by `/race`).
- `npm run test:e2e` passes (15 specs, no new e2e specs in this slice
  because the widget is not wired into `/race` yet; the §20 polish slice
  owns the wiring).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- The dot description names a `TrackRecordSchema`, but the actual schema
  surface in `src/data/schemas.ts` is `SaveGameRecordSchema`. Extended
  the existing surface rather than introducing a new schema name; the
  field shape (`bestSplitsMs?: readonly number[]`) matches the dot.
- The `currentSectorIdx` ascends as the player passes checkpoints; it
  does not wrap. `startNewLap` resets it to 0 explicitly so the displayed
  sector is the first sector after a lap-line crossing per the dot.
- Out-of-order or unknown checkpoint labels are silent no-ops in this
  module. The §7 anti-shortcut guard owns correctness; the widget never
  decides whether the player took a valid path.
- The drawer is not yet wired from `src/render/uiRenderer.ts` or the
  `/race` page. The §20 polish slice (`implement-hud-ui-6c1b130d`) owns
  full HUD composition; this slice ships the math + drawcall builder so
  that polish slice can call into it without re-deriving anything.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: difficulty preset selection in /options Difficulty pane

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md) (Difficulty
tiers table: Easy, Normal, Hard, Master with AI pace, rubber banding,
mistakes, economy pressure rows), [§20](gdd/20-hud-and-ui-ux.md) (Settings
six-pane list; Difficulty tab is the host),
[§28](gdd/28-appendices-and-research-references.md) (Beginner / Balanced /
Expert tuning table; Normal is the §28 baseline).
**Branch / PR:** `feat/difficulty-preset` (stacked on `feat/options-screen`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/components/options/difficultyPaneState.ts` with the pure
  §15 model: a four-entry `PRESETS` table (Easy / Normal / Hard /
  Master) carrying the verbatim §15 row values; `readPreset` falling
  back to `'normal'` for v1 saves missing the optional field;
  `isMasterUnlocked` (conservative `completedTours.length >= 1`
  approximation while championship-completion-at-difficulty tracking
  ships); `applyPresetSelection` returning a tagged `applied` /
  `noop:same-preset` / `noop:locked` result; and the
  `MASTER_UNLOCK_HINT` and `MID_TOUR_NOTE` string constants.
- Added `src/components/options/DifficultyPane.tsx`. Thin Client
  Component shell: hydrates from `loadSave()` after mount (mirrors
  `src/app/garage/cars/page.tsx`), renders a four-tile radio group
  with stable testids, and a detail panel (`difficulty-detail`) showing
  the §15 row for the active preset. Master tile is disabled until
  unlocked; the locked badge surfaces and the `<label>` `title`
  tooltip names the §15 unlock condition. A mid-tour caveat note sits
  above the radio group and explains that switching the preset only
  affects future tours.
- Updated `src/data/schemas.ts` to add `PlayerDifficultyPresetSchema`
  (`'easy' | 'normal' | 'hard' | 'master'`, matches §15 exactly) and
  an optional `difficultyPreset` field on `SaveGameSettings`. Optional
  so the v1 save shape continues to validate without a migration; the
  `readPreset` helper backfills `'normal'` for any save written before
  this slice.
- Updated `src/persistence/save.ts` `defaultSave()` to set
  `difficultyPreset: 'normal'` per the §28 dot default.
- Updated `src/data/examples/saveGame.example.json` to include
  `difficultyPreset: 'normal'` so the canonical example reflects the
  new field.
- Updated `src/app/options/page.tsx`: replaced the Difficulty tab's
  "coming soon" placeholder with `<DifficultyPane />`. The `TabSpec`
  type now carries an optional `pane` factory; placeholder tabs still
  render their headline / body / dot id triple, while shipped tabs
  render their pane component instead. The other five tabs are
  unchanged.
- Added `src/components/options/__tests__/difficultyPaneState.test.ts`
  (21 tests) covering the §15 table verbatim values, the locked /
  unlocked Master predicate, the pure mutation helper (applied,
  same-preset noop, locked noop, save immutability, side-fields
  preserved), the v1 backfill behaviour, and the no-em-dash project
  rule on every preset string and the two constants.
- Added `src/components/options/__tests__/DifficultyPane.test.tsx`
  (2 tests). SSR-shape contract: the pane renders the loading marker
  before hydration and never includes an em-dash. Interactive flows
  live in the e2e spec because RTL is not in the project.
- Added `e2e/options-difficulty.spec.ts` (4 tests): all four §15 tiles
  render with Normal selected by default, the detail panel shows the
  Normal row; Master is locked with the §15 unlock condition in its
  tooltip; selecting Hard updates the detail panel and persists to
  `vibegear2:save:v1` (and survives a reload); the mid-tour caveat
  note renders.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (511 tests; 23 new across the two suites).
- `npm run build` clean. `/options` route grew from 2.21 kB to 4.13 kB
  / 125 kB first-load (the DifficultyPane and its style block).
- `npm run test:e2e` passes (15 specs, 4 new).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns only the
  test-side regex literals (no em-dashes in actual copy).

### Decisions and assumptions
- Reused the §15 four-tier names (Easy / Normal / Hard / Master) for
  the player-facing preset enum, even though the §28 tuning table
  uses Beginner / Balanced / Expert. The dot description allows
  either; §15 is the more canonical source for the player-facing
  ladder, and the §28 dot ships the underlying tuning numbers. The
  championship-side `DifficultyPresetSchema` (novice / easy / normal /
  hard / extreme) is left unchanged: it is captured at tour-enter time
  and may use a wider taxonomy than the player picker.
- The new `difficultyPreset` save field is optional. Adding a required
  field would require a v2 schema bump and a migration; making it
  optional with a `'normal'` backfill at read time is additive per
  `WORKING_AGREEMENT.md` §11 ("dropping or renaming persisted save
  fields" is the gated case; adding fields is allowed).
- Master unlock predicate is conservative
  (`completedTours.length >= 1`) rather than the precise §15 condition
  ("complete one championship at Hard"). The save layer does not yet
  record championship-completion-at-difficulty. The locked tile's
  tooltip surfaces the canonical §15 wording so the player still sees
  the right condition; the predicate can tighten in a later slice
  without changing the UI contract.
- Followed the established `renderToStaticMarkup` test style for the
  `.tsx` shell test rather than pulling in React Testing Library.
  Interactive selection / persistence coverage lives in
  `difficultyPaneState.test.ts` (pure model) and the new Playwright
  spec (real browser). This matches how `e2e/options-screen.spec.ts`
  splits its concerns.

### Followups created
- None. The §28 dot still owes the underlying tuning numbers, but
  that is its own ready task and does not block this UI slice. Once
  championship-completion-at-difficulty tracking ships, tighten
  `isMasterUnlocked` to the precise §15 predicate.

---

## 2026-04-26: Slice: options screen route /options (settings UI scaffold)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Settings six-pane
list and pause-menu Settings entry point), [§19](gdd/19-controls-and-input.md)
(Remapping is a first-class feature; remap UI lives behind /options Controls
tab).
**Branch / PR:** `feat/options-screen` (stacked on `feat/minimap-module`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/app/options/page.tsx` as a Client Component scaffold with
  six tabs in §20 order (Display, Audio, Controls, Accessibility,
  Difficulty, Performance). Each pane renders a placeholder citing the
  exact dot id of the slice that ships its real content
  (`implement-visual-polish`, `implement-sound-music`,
  `implement-key-remap`, `implement-accessibility`,
  `implement-difficulty-preset`, `implement-performance-settings`).
  Tabs follow the WAI-ARIA Authoring Practices keyboard model: Left and
  Right cycle with wrap, Home and End jump to ends, focus follows
  selection. Esc on the page returns to the title via `history.back()`
  with a fall-through to `/`.
- Added `src/app/options/page.module.css` with the tab strip, panel,
  and footer styling. Reset to defaults button is rendered disabled
  with the SaveGameSettings v2 dot id in its title attribute so the
  next agent can grep.
- Added `src/app/options/tabNav.ts` with the pure `nextTabIndex`,
  `isTabNavKey`, and `TAB_ORDER` exports the page binds to. Lives
  outside `page.tsx` so the keyboard model is unit-testable in the
  default node Vitest env without RTL.
- Added `src/app/options/__tests__/tabNav.test.ts` (10 tests) covering
  the navigation table, wrap behaviour, Home/End jumps, non-nav-key
  pass-through, and the empty-tab-set guard.
- Added `src/app/options/__tests__/page.test.tsx` (9 tests) using the
  existing `renderToStaticMarkup` pattern. Asserts the six tab test
  ids, the active-tab `aria-selected` and `data-active` attributes, the
  Display panel placeholder dot id, the Reset button's disabled state,
  the back-to-title link, and the `tabIndex=0`/`-1` roving tabindex
  pattern.
- Added `e2e/options-screen.spec.ts` (6 tests) covering: all six tabs
  visible with Display selected, ArrowRight cycle plus wrap,
  ArrowLeft wrap from first to last, Reset to defaults disabled with
  the v2 schema dot id in its title, back-to-title link, and Esc
  returning to `/`.
- Updated `src/app/page.tsx` to enable the Options main-menu entry as a
  `Link` to `/options` with `data-testid="menu-options"`. Removed the
  prior `menu-options-pending` disabled placeholder.
- Updated `src/app/__tests__/page.test.tsx` to assert the new
  `menu-options` anchor and tab order. Updated
  `e2e/title-screen.spec.ts` to assert the link points at `/options`
  and added a navigation smoke.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (488 tests; 19 new across the two suites).
- `npm run build` clean. `/options` route reports 2.21 kB / 108 kB
  first-load.
- `npm run test:e2e` passes (11 specs).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Followed the established `renderToStaticMarkup` test style instead of
  pulling in React Testing Library. The dot description called for
  arrow-key navigation in the unit test; that interactive coverage
  lives in `tabNav.test.ts` (pure model) plus the Playwright spec
  (real browser keyboard events). Adding `@testing-library/react` here
  would be a one-off divergence from the rest of the suite.
- Title-screen test id changed from `menu-options-pending` to
  `menu-options`. The `WORKING_AGREEMENT` rule against
  backwards-compatibility shims for code with no users yet supports a
  rename here; both the unit test and the Playwright spec are updated
  in this slice.
- Esc handler uses `window.history.length > 1` as a heuristic for the
  presence of a referrer in this tab. Edge case: `length` can be 1
  even when entering via a fresh tab in some browsers, so the
  fallback is a hard navigation to `/` rather than nothing.
- Tabs use roving tabindex (active = 0, others = -1) per WAI-ARIA so
  Tab moves between regions instead of cycling tabs. Arrow keys cycle
  within the tablist as expected.

### Followups created
- None. The placeholder dots cited in each pane are already ready
  tasks, so no new tracking entry is needed.

---

## 2026-04-26: Slice: minimap projection + HUD overlay drawer (split from hud-ui)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Race HUD: simplified
minimap or progress strip; bottom-left wireframe slot),
[§21](gdd/21-technical-design-for-web-implementation.md) (Suggested module
structure: `src/road/minimap.ts`),
[§22](gdd/22-data-schemas.md) (Track data model: minimap points).
**Branch / PR:** `feat/minimap-module` (stacked on `feat/assets-license`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/road/minimap.ts` with three pure exports:
  `projectTrack(segments, options)` integrates per-segment heading into a
  unit-square footprint with closing-snap to keep loops visually shut;
  `projectCar(points, segmentIndex, segmentProgress)` linearly
  interpolates a car's marker along the precomputed point list;
  `fitToBox(points, box)` uniform-scales any point list into a target
  rectangle preserving aspect ratio with the short axis centred.
- Added `src/render/hudMinimap.ts` with `drawMinimap(ctx, points, cars,
  layout, options)` issuing a single closed stroke path for the track
  plus one filled circle (or square in colour-blind mode) per car. AI
  markers paint first so the player draws on top. Context state is
  restored on return.
- Added `src/road/__tests__/minimap.test.ts` (17 tests) covering the
  dot's verifies: 80-segment track returns 80 points within the unit
  rectangle, single-segment track returns one point, aspect preservation
  for a 20:1 long-thin track, author-override path, deterministic
  reruns, off-track car clamping without NaN, and `projectCar`
  midpoint / wrap / single-point cases.
- Added `src/render/__tests__/hudMinimap.test.ts` (10 tests) covering
  drawcall counts (one stroke path, one fill per car), AI-before-player
  ordering, colour-blind shape swap (square via `fillRect`), background
  fill, zero-area / empty-input no-ops, and context-state restoration.
- Extended `src/data/schemas.ts` with `MinimapPointAuthoredSchema` and
  an optional `Track.minimapPoints` field (length >= 2 required when
  present). Added three schema tests covering the optional field, the
  override accept path, and the length-rejection paths.
- Extended `src/road/types.ts` with `CompiledMinimapPoint` and a
  required `CompiledTrack.minimapPoints` field. `src/road/trackCompiler.ts`
  now calls `projectTrack` (honouring `track.minimapPoints` override
  when present) and stamps the result on the compiled output.
- Extended `src/game/hudState.ts` with optional `HudMinimapState`
  carried through `HudStateInput.minimap` and surfaced on `HudState.minimap`
  so the HUD path stays opt-in for owners that want to render the minimap.
- Wired both new modules into `src/road/index.ts` and
  `src/render/index.ts` barrels.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (469 tests; 27 new across the three suites). Existing
  trackCompiler golden snapshots unaffected because the snapshot
  projector excludes `minimapPoints`.
- `npm run build` clean (route sizes unchanged; minimap is opt-in).
- `npm run test:e2e` passes (title-screen + phase-1 race demo).
- `grep -rP "[\x{2013}\x{2014}]" src/road/minimap.ts
  src/road/__tests__/minimap.test.ts src/render/hudMinimap.ts
  src/render/__tests__/hudMinimap.test.ts` returns nothing.

### Decisions and assumptions
- `Track.minimapPoints` minimum length is 2 (not 1). A single point has
  no direction and the polyline drawer skips lone points anyway, so
  rejecting length-1 inputs at the schema layer prevents silent
  no-op overrides.
- Closing snap is implemented as a linear residual distribution across
  the polyline rather than a global rotation. Cheaper to compute and
  produces the same end-to-end "loop closes" guarantee for the cases
  the dot calls out (loops and intentional kinks).
- Colour-blind mode is wired as a per-call `colorBlindMode` boolean
  option on `drawMinimap`. The save-game settings field
  (`accessibility.colorBlindMode`) is not implemented yet; whoever lands
  the §19 accessibility slice will pipe the save bit into this option.
- `HudState.minimap` is optional. Existing HUD callers continue to work
  without minimap data; the §20 polish slice will be the first
  consumer.

---

## 2026-04-26: Slice: ASSETS-LICENSE + per-entry asset licence metadata (Q-002)

**GDD sections touched:** [§26](gdd/26-open-source-project-guidance.md) (no
text edit; this slice fulfils the "Suggested licenses" table and the
"Avoiding IP contamination" requirement that every shipped manifest entry
declares provenance).
**Branch / PR:** `feat/assets-license` (stacked on
`feat/github-actions-ci-recovery`), PR pending.
**Status:** Implemented.

### Done
- Added `ASSETS-LICENSE` at repo root with the CC BY 4.0 license body, the
  per-entry licence taxonomy (`CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`,
  `public-domain`), an attribution policy, and a restatement of GDD
  section 26's "Avoiding IP contamination" rules.
- `src/asset/preload.ts`: added `AssetLicense` type union and
  `ASSET_LICENSES` constant; required `license` on `AssetEntry`; added
  `AssetLicenseError` and `assertManifestLicenses` so the future mod
  loader (and any defensive caller) can reject manifests that omit
  provenance.
- `src/asset/manifest.ts`: added `DEFAULT_ASSET_LICENSES` (track JSON
  defaults to `CC-BY-SA-4.0` per GDD section 26 data row, art and audio
  default to `CC-BY-4.0`); `manifestForTrack` now stamps the licence on
  every emitted entry and accepts a `licenses` per-kind override hook for
  mods that ship under a different licence.
- `src/asset/__tests__/manifest.test.ts`: added five tests covering
  licence presence on every entry, the per-kind defaults, override
  behaviour, the validator round-trip, and a separate `describe` block
  for `assertManifestLicenses` (accept / missing / unknown / first-error
  rejection).
- `src/asset/__tests__/preload.test.ts`: updated the `entry()` helper
  default to set `license: "CC-BY-4.0"` so existing fixtures still build
  valid `AssetEntry` records under the stricter type.
- Marked `OPEN_QUESTIONS.md` Q-002 `answered` with the chosen licences,
  the per-entry taxonomy, and the implementation pointer.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (manifest + preload suites green; new licence tests
  pass; sibling suites unchanged).
- `npm run build` clean.
- `npm run test:e2e` passes against the existing suite (no UI surface
  changed).
- Grep for U+2014 and U+2013 across `ASSETS-LICENSE`, `src/asset/*.ts`,
  `src/asset/__tests__/*.ts`, the OPEN_QUESTIONS update, and this log
  entry returns nothing.

### Decisions and assumptions
- Track JSON ships under `CC-BY-SA-4.0`, not `CC-BY-4.0`. GDD section 26
  's "Suggested licenses" table assigns "Track/community data" to
  CC BY-SA 4.0 explicitly, so the data row picks that. Art and audio
  default to CC-BY-4.0 per Q-002's recommended default.
- The `license` field is required at the type level (not optional with a
  default fallback). A missing licence would defeat the point of the
  guard, so the type system enforces presence and the runtime validator
  exists for non-typed (mod-loaded) inputs.
- The per-entry licence is a small string union, not an open SPDX field.
  Section 26 names a small set of permitted licences, and a closed union
  surfaces accidental drift at compile time. Adding a new licence is a
  single-line edit.
- Did not add a `scripts/content-lint.ts` script. The dot lists it as
  "if present, else add to its dot"; no such script exists in the
  current tree, and the manifest builder + runtime validator already
  reject any code path that emits an entry without a licence. Filing as
  a polish followup if a separate authoring-time linter becomes useful.

### GDD edits
- None this slice; the GDD already specifies the licence policy.

### Followups created
- None.

### Open questions resolved
- Q-002 answered (licence choice for code and assets).

### Dot
- Closed `VibeGear2-implement-assets-license-3918e9cb` with reason
  "verified".

---

## 2026-04-26: Slice: GitHub Actions CI + Vercel auto-deploy (F-003) recovery

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md) (added "Deploy target" subsection)
**Branch / PR:** `feat/github-actions-ci-recovery` (stacked on `feat/render-perf-bench`), PR pending
**Status:** Implemented (workflow lands; first deploy waits on human prerequisites)

### Recovery context
- Re-applies the work that was originally written for the closed dot
  `VibeGear2-implement-github-actions-1780fc58` and committed as
  `934f5b6` on the orphan branch `feat/github-actions-ci`. That branch
  was never merged to `main`; the close-reason claimed shipped files
  that did not exist on `main`. The recovery dot
  `VibeGear2-implement-github-actions-388c5523` re-opened the work.
- Followed option 2 of the recovery dot (re-implement against the live
  trunk) rather than option 1 (rebase 934f5b6) so the iteration-17
  stress-test refinements (split concurrency for `deploy`, gated bench
  job) could land in the same commit. The original 934f5b6 had a single
  `concurrency` block with `cancel-in-progress: true` covering both
  jobs; this recovery splits them.

### Done
- Added `.github/workflows/ci.yml`: three jobs.
  - `verify` runs on every PR and on push to `main`. Steps: checkout,
    setup-node 20 with npm cache, `npm ci`, `npm run lint`, `npm run
    typecheck`, `npm run test`, install Playwright chromium with deps,
    `npm run build`, `npm run test:e2e`. Uploads `playwright-report/` as
    an artefact on failure (7-day retention). Concurrency group
    `ci-verify-${{ github.ref }}` with `cancel-in-progress: true`.
  - `bench` runs only on `workflow_dispatch` with `run_bench=true`. Runs
    `npm run bench:render` with `continue-on-error: true` so the
    informational bench can never gate a merge or deploy. Closes the
    follow-up noted in the previous PROGRESS_LOG entry.
  - `deploy` runs only on push to `main` after `verify` is green. Steps:
    checkout, setup-node, `npm ci`, `vercel pull` for production env,
    `vercel build --prod`, `vercel deploy --prebuilt --prod`. Surfaces
    the deploy URL via the GH `environment.url` field. Separate
    concurrency group `deploy-prod` with `cancel-in-progress: false` so
    a rapid second push to `main` queues behind the in-flight deploy
    instead of killing it (per iteration-17 stress test #5).
- Added `vercel.json` with `framework: nextjs`, `npm ci` install, `next
  build` build, region `iad1`, openapi.vercel.sh schema URL.
- Added `.vercel/` and `.claude/` to `.gitignore` so per-developer
  artefacts stay local.
- Updated `docs/gdd/21-technical-design-for-web-implementation.md` with
  a "Deploy target" subsection naming Vercel and pointing at the
  workflow.
- Updated `README.md` with a Deploy section that documents the CI gate,
  the Vercel preview behaviour, the bench dispatch toggle, and the
  one-time human setup steps.
- Marked `OPEN_QUESTIONS.md` Q-003 `answered` with the full resolution.
- Marked `FOLLOWUPS.md` F-003 `in-progress` with completion criteria
  (first green deploy + smoke of deployed URL); updated F-002 note that
  the CI slice has landed.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 passing (test count unchanged: no source files
  touched).
- `npm run build` clean.
- `npm run test:e2e` 4 of 4 passing.
- `npm run bench:render` runs to completion (sanity check that the
  bench script the new CI job gates on still works).
- `grep` for U+2014 and U+2013 across `.github/workflows/ci.yml`,
  `vercel.json`, and the new README + GDD additions returns nothing.
- The `verify` job will run against this PR; `deploy` will fail on
  first push to `main` until secrets are populated, which is the
  designed and documented behaviour.

### Decisions and assumptions
- Used the Vercel CLI from GitHub Actions for production deploys
  instead of the Vercel GitHub App's auto-prod, so production is
  strictly gated on the same CI run that runs the smoke. The GitHub
  App still handles PR preview URLs (with auto-prod toggled off, per
  the README setup notes).
- `--with-deps chromium` installs only chromium, matching
  `playwright.config.ts`'s projects array.
- Pinned Node 20 (LTS) in CI even though `engines.node` is `>=20`. Lets
  us bump in one place when 22 ships LTS.
- No separate `preview` deploy job. PR previews come from the Vercel
  GitHub App; running both an Actions preview and an App preview
  duplicates work without adding signal.
- Workflow file lands even though deploy secrets are not configured
  yet. The `verify` job is the meaningful gate; `deploy` will fail
  loudly with a clear error until the human steps complete, which is
  more discoverable than landing the workflow later.
- Bench job is `workflow_dispatch`-only with `continue-on-error: true`
  rather than the previously-suggested `RUN_BENCH=1` env switch
  because GH Actions has no built-in way to set repo-level env on a
  push, and dispatch inputs are first-class in the Actions UI.

### Followups created
- None. F-003 stays `in-progress` until the first green production
  deploy; that flip is a one-line edit in a follow-up commit, not a
  new dot.

### GDD edits
- Added "Deploy target" subsection to
  [`docs/gdd/21-technical-design-for-web-implementation.md`](gdd/21-technical-design-for-web-implementation.md). Naming the
  hosting choice in the GDD keeps the doc honest about the architecture.

---

## 2026-04-26: Slice: Render perf bench script (npm run bench:render)

**GDD sections touched:** none (tooling slice; informational bench only)
**Branch / PR:** `feat/render-perf-bench` (stacked on `feat/off-road-dust`), PR pending
**Status:** Implemented

### Done
- Added `scripts/bench-render.ts`: a manual frame-time bench that drives
  `pseudoRoadCanvas.drawRoad` against a stub Canvas2D context for 600
  frames with the parallax bands (sky / mountains / hills), a primed
  64-particle dust pool, and an active VFX shake. Prints a summary table
  with frame count, mean, p50, p95, and p99 in milliseconds, labelled
  "CPU canvas, indicative only" because jsdom's HTMLCanvasElement throws
  without the optional native `canvas` package and we deliberately do
  not pull that in.
- Added `vitest.bench.config.ts`: a standalone Vitest config whose
  include glob targets only `scripts/bench-render.ts`. The bench is
  invoked as a Vitest test so the `@/` aliases resolve and TypeScript
  is transpiled without an extra loader dep, but it stays out of the
  default `vitest.config.ts` glob so `npm test` and CI never run it.
- `npm run bench:render` script wired in `package.json`. Verified the
  bench prints the table and exits clean (~260 ms total). On this dev
  machine the first run reported mean 0.016 ms / p95 0.029 ms; numbers
  are not portable across machines, only useful for relative regression
  hunting on the same host.
- Authored `docs/CONTRIBUTING.md` covering the local check loop, the
  bench workflow ("paste the table into the PR body when touching the
  renderer"), the em-dash grep recipe, and the loop-logging
  expectations from `AGENTS.md` RULE 5.
- Per the dot's "CI does not run the bench by default" requirement: no
  CI workflow exists yet (CI is owned by the re-opened
  `implement-github-actions` dot). When that lands, the bench step
  should be gated on `if [ "$RUN_BENCH" = '1' ]` so the default
  pipeline stays deterministic per `AGENTS.md`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 tests passing (bench file is excluded from the unit
  glob; test count unchanged).
- `npm run build` clean. Route sizes unchanged (`/race` stays at
  7.49 kB / 130 kB; the bench only ships under `scripts/` and never
  reaches the bundle).
- `npm run test:e2e` 4 of 4 passing (no UI changes).
- `npm run bench:render` runs to completion and prints the summary
  table.

### Followups
- F-NNN (will be filed when the CI workflow dot lands): wire the
  optional `RUN_BENCH=1` step in CI so reviewers can request a bench
  comparison without touching the deterministic default pipeline.

---

## 2026-04-26: Slice: Off-road dust particles + physics surface flag

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md), [§16](gdd/16-rendering-and-visual-design.md)
**Branch / PR:** `feat/off-road-dust` (stacked on `feat/vfx-flash-shake`), PR pending
**Status:** Implemented

### Done
- Extended `src/game/physics.ts`: added `Surface = "road" | "rumble" | "grass"`
  type and a pure `surfaceAt(x, roadHalfWidth)` classifier. The road
  band is `|x| <= roadHalfWidth`, rumble is `|x| <= roadHalfWidth * 1.15`,
  grass is anything beyond. The 1.15 scalar matches the strip drawer's
  rumble trapezoid in `pseudoRoadCanvas.drawStrips` so physics and
  renderer stay in lockstep without inverting the dependency.
  `RUMBLE_HALF_WIDTH_SCALE` is exported so balancing slices can tune
  both layers from one place.
- `CarState` gained a `surface` field. `INITIAL_CAR_STATE.surface` is
  `"road"` so a fresh state at the centerline reads consistently before
  any tick has run. `step()` classifies the post-step lateral position
  via `surfaceAt` and returns the result on the new state. The
  `dt <= 0` early return preserves the prior `surface` field rather
  than re-deriving it (no input changed; no reason to recompute).
- Added `src/render/dust.ts`: pinned the API per stress-test item 8 of
  the visual-polish parent dot. Exports `INITIAL_DUST_STATE`,
  `tickDust(state, params)`, `drawDust(ctx, state, viewport)`, plus
  the tunables `MAX_DUST = 64`, `LIFETIME_MS = 600`,
  `EMIT_INTERVAL_TICKS = 2`, `EMIT_SPEED_THRESHOLD_M_PER_S = 8`,
  `PARTICLE_X_VELOCITY_PX_PER_S = 32`,
  `PARTICLE_Y_VELOCITY_PX_PER_S = -18`, `PARTICLE_RADIUS_PX = 4`,
  `DEFAULT_DUST_COLOR = "#c9b48a"`. Particles spawn at the caller's
  emit origin (typically the projected car position); horizontal
  velocity hashes off the (seed, particleIndex) integer pair via a
  Mulberry32-style hash so two replays paint identical particles.
- Pool-cap behaviour: when `state.particles.length` reaches `MAX_DUST`,
  the next emission overwrites slot `nextRecycleIdx` in place, then
  bumps the counter mod `MAX_DUST`. No allocation per emit once the
  pool is full; FIFO recycling order survives wrap-around.
- Lifetime: a particle is removed on the first tick whose post-add
  `elapsedMs >= LIFETIME_MS`. dt = 0 still bumps `tickIdx` so the "every
  2 ticks" cadence is dt-independent.
- Wired `DustState` into `pseudoRoadCanvas.drawRoad` via a new optional
  `DrawRoadOptions.dust`. The drawer paints dust AFTER the strip pass
  so particles sit over both road and grass; the pool is owned by the
  caller (read-only on the drawer side). Re-exported from
  `src/render/index.ts`.
- Added `src/render/__tests__/dust.test.ts`: 17 tests covering
  emission gating (road no-emit, rumble no-emit, grass + speed-at-or-
  under-threshold no-emit, grass + speed > threshold yields one
  emission per `EMIT_INTERVAL_TICKS`, surface flip road->grass starts
  emitting on the very tick); pool cap (65th emit recycles slot 0);
  lifetime (removed at exactly the 600 ms mark, dt = 0 preserves
  positions but advances tickIdx); determinism (two identical runs
  produce identical particles, different seeds diverge horizontal
  velocity); purity (input state never mutated); `drawDust` (one arc
  per active particle with alpha decaying from 1, radius attenuates
  linearly to 0 across lifetime, zero-area viewport short-circuits the
  draw, globalAlpha is restored after painting).
- Added 6 new tests to `src/game/__tests__/physics.test.ts`:
  `surfaceAt` classifies centerline / inclusive road edge / inclusive
  rumble edge / past-rumble; `step` emits the correct surface in each
  band; `dt = 0` preserves the prior surface field; surface
  transitions road -> grass on a single high-speed steering tick.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 tests passing (17 new in the dust suite, 6 new in
  physics surface tests, 23 total new).
- `npm run build` clean. Route sizes unchanged (`/race` stays at
  7.49 kB / 130 kB; the dust module ships in the render layer but has
  no runtime caller in this slice).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- `Surface` is an enum not a boolean because `rumble` is a distinct
  band per the strip drawer ("trapezoid 15% wider than the road"). A
  future tyre-rumble SFX slice can dispatch on `surface === "rumble"`
  without re-deriving the geometry; collapsing to `boolean` now would
  paint us into a corner.
- `INITIAL_CAR_STATE.surface = "road"` rather than computing from `x`.
  At `x = 0` both produce the same value, but pinning a literal keeps
  the singleton frozen at module init time and avoids importing
  `surfaceAt` into the constants file (which would create a
  cycle-of-readability between the type and the helper).
- The `dt <= 0` early-return path preserves the prior `surface` field
  rather than re-classifying. No input changed; matching the existing
  policy on `z`, `x`, `speed` (return verbatim) keeps the function's
  "nothing happened this frame" contract intact.
- Dust velocity hash is a separate copy of the Mulberry32-style chain
  in `vfx.ts` rather than a shared util. Sharing would couple two
  modules' deterministic outputs, so a tweak to the shake hash would
  silently shift dust particle positions across replays. Keeping
  per-module copies is a small DRY violation that buys per-system
  golden-test independence.
- `tickIdx` advances once per `tickDust` call regardless of dt or
  emission. This makes the "every 2 ticks" rule independent of
  wall-clock dt jitter, so a long-paused tab does not blast the pool
  on resume. Matches the §21 fixed-step model: ticks are the unit of
  time, not milliseconds.
- The drawer paints dust AFTER the strip loop so particles sit over
  the road / grass surfaces (matching the §16 "Dust roost" reference,
  where the plume rises above the surface). Painting before the strips
  would have the road occlude particles even at the spawn frame.
- `DEFAULT_DUST_COLOR = "#c9b48a"` is a sandy tan picked to read
  against both the dark grass (`#2f5a23` / `#3a6d2a`) and the light
  road (`#5a5a5a`). Tunable by callers via the `color` field on
  `tickDust` params for future weather variants (snow, mud).
- `PARTICLE_RADIUS_PX = 4` is small enough that a saturated 64-particle
  pool covers ~3 KB of overdraw at typical resolutions, well under the
  §16 60-FPS budget. The render-perf bench dot will measure this.
- No runtime integration with the race route in this slice. Wiring
  the dust pool into `/race` requires a screen-space car projector
  that the hud-ui-6c1b130d slice owns; doing it here would couple two
  open dots. The drawer accepts the optional `dust` field today so the
  follow-up slice can light it up without changing the renderer
  contract.

### Followups created
- None. The render-perf benchmark sibling dot
  (`implement-render-perf-f5492ef1`) covers measuring this module
  against the §16 60-FPS budget.

### GDD edits
- None.

---

## 2026-04-26: Slice: VFX flash + shake module with reduced-motion gate

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md), [§17](gdd/17-art-direction.md), [§19](gdd/19-controls-and-accessibility.md)
**Branch / PR:** `feat/vfx-flash-shake` (stacked on `feat/parallax-bands`), PR pending
**Status:** Implemented

### Done
- Added `src/render/vfx.ts`: pinned the API from stress-test items 6 / 7
  of the visual-polish parent dot, then split out into
  `implement-vfx-flash-3d33b035`. Exports `INITIAL_VFX_STATE`,
  `fireFlash(state, params)`, `fireShake(state, params)`,
  `tickVfx(state, dtMs)`, `drawVfx(ctx, state, viewport)`,
  `refreshReducedMotionPreference()`, and the pure
  `shakeOffsetAt(entry, elapsedMs)` helper. `MAX_SHAKE_AMPLITUDE_PX`
  caps stacked shakes at 24 px per axis; `DEFAULT_SHAKE_FREQUENCY_HZ`
  pins the snappy collision-shake frequency at 30 Hz per §16.
- Determinism: shake offsets derive from a Mulberry32-style integer
  hash on `(seed, tickIdx, axis)` so two replays with identical
  inputs paint identical pixels. The integer pair seed channels
  through the §22 RNG model (callers pass the seed; the module never
  consumes a global RNG).
- Reduced-motion gate: `fireShake` returns the input state unchanged
  when `prefers-reduced-motion: reduce` is set, per §19. `fireFlash`
  is NOT gated since the GDD treats HUD flash on lap complete as a
  navigation cue, not a motion effect.
- Hooked the renderer into `src/render/pseudoRoadCanvas.ts`: a new
  optional `DrawRoadOptions.vfx` paints the flash overlay between the
  parallax band and the road strips, then translates the canvas by
  the summed shake offset before the strip pass so the road shakes as
  one unit. The strip loop was extracted into a private `drawStrips`
  helper so the translate / restore wraps the entire road draw without
  duplicating the loop body.
- Re-exported `vfx` from `src/render/index.ts`.
- Added `src/render/__tests__/vfx.test.ts`: 27 tests covering
  `INITIAL_VFX_STATE` shape; `fireFlash` (push, invalid duration /
  intensity returns input state, works under reduced-motion, stacking);
  `fireShake` (push with seed and frequency, default frequency, invalid
  duration / amplitude, reduced-motion no-op,
  `refreshReducedMotionPreference` re-enables); `tickVfx` (zero / negative
  dt no-op, 4 ticks of 50 ms expire a 200 ms flash, shake removal at
  duration, immutability, independent flash + shake ticking);
  `shakeOffsetAt` (determinism across runs, different seeds diverge,
  zero-net-drift inside 1 px tolerance, returns zero past duration,
  linear amplitude attenuation); `drawVfx` (fillRect alpha decay
  envelope, MAX_SHAKE_AMPLITUDE_PX clamp, no-shake offset, zero-area
  viewport gates only the flash, two flashes paint in stack order,
  globalAlpha is restored after painting).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 402 tests passing (27 new in the vfx suite).
- `npm run build` clean. No route-size regression (`/race` stays at
  5.71 kB / 130 kB; the vfx module ships in the render layer but has
  no runtime caller in this slice).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- The flash overlay paints BEHIND the road strips, not on top. A
  HUD-style overlay flash belongs in the UI layer (where it should
  occlude the canvas); an in-world impact flash should not occlude the
  player car. Renderer callers that want a HUD flash can run a second
  drawVfx pass on the HUD layer after the road draws.
- `drawVfx` returns the shake offset rather than calling
  `ctx.translate` itself. Keeps the integration site explicit so the
  HUD layer can opt out of the shake (e.g. so the lap counter does not
  jitter during a collision).
- Each `ShakeEntry` carries its own `seed` and `frequencyHz`. Per-entry
  seeds let a future "off-road rumble" entry coexist with a "collision
  shake" entry without aliasing on shared sample points; per-entry
  frequency lets a slow rumble (5 Hz) coexist with a snap shake (30 Hz)
  in the same stack.
- `refreshReducedMotionPreference` exists for tests that flip the
  preference mid-suite. Production code does not need to call it
  because the accessibility setting does not change mid-session in
  practice (same reasoning as `TouchControls.usePointerCoarse` not
  subscribing to `change` events).
- The hash function is Mulberry32-style on the integer pair
  `(seed, tickIdx)` rather than a full PRNG state machine because the
  module needs random ACCESS by elapsed time, not a sequential stream.
  A stream PRNG would force callers to advance the state every frame
  even when nothing was drawing, which loses the "drawVfx is pure"
  property.
- `MAX_SHAKE_AMPLITUDE_PX = 24` is the chosen stack cap. Picked at the
  upper end of "subtle and short" per §16 so a degenerate stack still
  feels like a strong impact rather than a screen-clearing rumble.
- Zero-area viewport short-circuits the FLASH overlay only, not the
  shake offset computation. Tests that simulate a hidden tab or a
  resized canvas mid-tick still get the same offset they would with
  the canvas visible, so the deterministic-replay invariant survives a
  viewport collapse.

### Followups created
- None. The two remaining sibling visual-polish dots (off-road dust,
  render perf bench) remain open and ready.

### GDD edits
- None.

---

## 2026-04-26: Slice: Parallax bands renderer (sky / mountains / hills)

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md)
**Branch / PR:** `feat/parallax-bands` (stacked on `feat/sprite-atlas-loader`), PR pending
**Status:** Implemented

### Done
- Added `src/render/parallax.ts`: pinned the `drawParallax(ctx, layers,
  camera, viewport)` API from stress-test item 4 of the visual-polish
  parent dot. Exports `ParallaxLayer` (id `"sky" | "mountains" | "hills"`,
  `image: HTMLImageElement | null`, `scrollX`, `bandHeight`, `yAnchor`),
  pure helpers `parallaxOffsetFor(layer, camera)` and `bandRect(layer,
  viewport)`, the shared `PLACEHOLDER_FILL = "#ff00ff"`, and the
  `PARALLAX_PX_PER_WORLD_X = 1` tuning constant. Parallax derives only
  from `camera.x` per stress-test item 5 so the road's already-baked
  curvature does not double-shift the sky bands.
- Tiled horizontal scroll uses a `modPositive` helper so a camera
  arbitrarily far from world origin (positive or negative) still tiles
  across the viewport without gaps.
- Hooked the drawer into `src/render/pseudoRoadCanvas.ts` via an
  optional `DrawRoadOptions.parallax = { layers, camera }`. When
  present, the parallax bands replace the flat sky gradient; absent
  callers retain Phase 1 behaviour. No race / dev page is wired to
  parallax yet (placeholder PNG art is gated on a sibling dot); the
  hook is in place for the visual-polish landing slice.
- Added `src/render/__tests__/parallax.test.ts`: 14 tests covering
  `parallaxOffsetFor` (factors 0 / 0.25 / 0.6 / 1, scaling constant,
  determinism), `bandRect` (yAnchor 0 / 0.5 / 1), and `drawParallax`
  (back-to-front order across sky / mountains / hills, horizontal
  tiling at camera.x = 10000, placeholder fill when image is null,
  yAnchor=1 flush with viewport bottom, zero-area viewport short
  circuit, zero bandHeight short circuit, first-difference variance
  under a 600-frame curve fixture stays within 2 px, deterministic
  replay of a 30-frame camera path).
- Re-exported `parallax` from `src/render/index.ts`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 375 tests passing (14 new in the parallax suite).
- `npm run build` clean. No route-size regression (the parallax module
  is not yet imported by `/race` or `/dev/road`).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- Parallax derives from `camera.x` only; `camera.z` is in the signature
  for forward compatibility (e.g. depth-driven horizon lift in a later
  polish slice) but is not read today. This is the explicit pin from
  stress-test item 5: the road strip projector already bakes per-segment
  curvature into the centerline, so a parallax module that also
  responded to curvature would visibly double-shift.
- `PARALLAX_PX_PER_WORLD_X = 1` is the chosen world-x to pixel ratio.
  Lives in `parallax.ts` rather than `road/constants.ts` because
  parallax is a pure renderer concept the road compiler does not need
  to know about.
- The placeholder fill is `#ff00ff`, identical to the sprite atlas
  fallback fill. Magenta-on-missing-art is the project convention; the
  shared constant means a future palette tweak flips both renderers in
  one place.
- `ParallaxLayer.image` is `HTMLImageElement | null` so callers can
  pre-define their layer set without blocking on image load. The drawer
  gracefully degrades to placeholder fill per layer until the asset
  resolves, matching the `loadAtlas` `fallback: true` pattern.
- The drawer hook in `pseudoRoadCanvas.ts` REPLACES the sky gradient
  rather than layering on top of it. Layering would require either an
  alpha channel in the parallax PNG or a separate clear pass; the
  replacement keeps Phase 1 callers untouched and avoids a visible
  composite seam.
- The 600-frame variance test uses a synthetic sinusoidal camera path
  rather than driving the projector directly. The projector adds no
  curvature contribution to the parallax math by design, so the
  fixture isolates the parallax module's own jitter (zero) from the
  road's curvature behaviour (already covered by the projector tests).

### Followups created
- None. The three remaining sibling visual-polish dots (vfx flash +
  shake, off-road dust, render perf bench) remain open and ready.

### GDD edits
- None.

---

## 2026-04-26: Slice: Sprite atlas loader + frame index math

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md), [§17](gdd/17-art-direction.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/sprite-atlas-loader` (stacked on `feat/title-screen-menu-wiring`), PR pending
**Status:** Implemented

### Done
- Added `src/render/spriteAtlas.ts`: pinned the API from stress-test
  item 2 of `implement-visual-polish-7d31d112`. Exports `loadAtlas(meta,
  options)` (always resolves; image load failure surfaces as
  `{ image: null, fallback: true }` plus a single `console.error('[atlas]', path)`)
  and `frame(atlas, spriteId, frameIdx)` (modulo wraps out-of-range
  indices, throws `RangeError` on unknown sprite ids even in fallback
  mode). Re-exports the `AtlasFrame` / `AtlasMeta` types from
  `@/data/schemas` so render callers have one import surface. Ships a
  shared `FALLBACK_FRAME` (32x32 magenta, anchored at foot) and
  `FALLBACK_FILL = "#ff00ff"` so fallback rendering is reference-stable
  for memoisation.
- Added `AtlasMetaSchema` and `AtlasFrameSchema` to `src/data/schemas.ts`
  per stress-test item 3. Frames require positive `w` / `h`, anchors are
  optional and clamped to `[0, 1]`, and the sprites map plus every
  frame array must be non-empty so callers can index `[0]` without
  bounds checks.
- Added `src/data/atlas/cars.json`: one full atlas fixture for the
  Sparrow GT covering 12 directional frames across three damage
  variants (clean / dented / battered) plus brake-light and nitro-glow
  single frames per §17 "Car sprites".
- Added `src/data/atlas/roadside.json`: one regional roadside atlas with
  five prop categories (sign marker, pine tree, fence post, rock
  boulder, light pole) per §16 "Roadside objects".
- Added `src/render/__tests__/spriteAtlas.test.ts`: 16 tests covering
  the schema (4 fixtures + 3 broken variants), `loadAtlas` (success,
  error + log, leading-slash normalisation, missing Image constructor),
  and `frame` (in-range, modulo wrap, negative wrap, unknown sprite
  throws, fallback mode, fallback + unknown still throws, determinism).
  The Image stub fires `onload` / `onerror` on a queued microtask so the
  loader's promise behaves like real browser asynchrony.
- Re-exported `spriteAtlas` from `src/render/index.ts` alongside the
  existing road / UI renderer exports.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 361 tests passing (16 new in the sprite atlas suite).
- `npm run build` clean. No route-size regression (unchanged from prior
  slice; the atlas module is not yet imported by `/race`).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- `frame` returns `FALLBACK_FRAME` for known sprite ids when the atlas
  is in fallback mode, but still throws `RangeError` for unknown ids.
  The asymmetry is deliberate: a missing image is a runtime / network
  condition the renderer must survive, but an unknown sprite id is a
  programming error the test suite should catch even with a broken
  atlas.
- Image paths are stored relative to `public/` (e.g.
  `art/cars/sparrow.png`) and the loader prepends `/` at resolve time.
  Authors can also write the leading slash; both forms produce the
  same runtime URL.
- Tests stub `Image` with a queued-microtask shim rather than depending
  on jsdom so the suite stays in Vitest's node environment, matching
  the strategy already used in `src/asset/__tests__/preload.test.ts`.
- The atlas loader does not validate against `AtlasMetaSchema` itself.
  Validation belongs at the JSON-load boundary (the future asset
  preloader will run `AtlasMetaSchema.safeParse` before calling
  `loadAtlas`), so the loader trusts its `AtlasMeta` argument and stays
  side-effect-free apart from the image fetch.

### Followups created
- None. The four sibling visual-polish dots (parallax bands, vfx flash
  + shake, off-road dust, render perf bench) remain open and ready.

### GDD edits
- None.

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
