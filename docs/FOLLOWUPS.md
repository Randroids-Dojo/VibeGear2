# Followups

Known followup work that did not fit in the slice that surfaced it. Each
entry has an id (`F-NNN`), a one-line description, the loop that created it,
and a priority.

Priorities: `blocks-release`, `nice-to-have`, `polish`. Statuses: `open`,
`in-progress`, `done`, `obsolete`. Do not delete entries — mark them `done`
or `obsolete` so the trail is preserved.

---

## F-027: HUD assist badge renderer
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/accessibility-assists` slice ships
`HudState.assistBadge` as an optional snapshot field plus
`ASSIST_BADGE_LABELS` (`Auto accel`, `Brake assist`, `Steer smooth`,
`Toggle nitro`, `Reduced input`, `Visual weather`). The HUD renderer
does not yet consume it; the data plane is complete and the §20
"small badge when any assist is active" requirement reduces to "draw
a corner pip showing the primary label, with a count if more than one
assist is active". Lives with the rest of the §20 HUD polish slice.
Mirrors F-022 (ghost car renderer) and F-021 (ghost recorder save
slot) in the producer-without-consumer pattern.

## F-026: Wire `applyAssists` into the race session input pipeline
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** open
**Notes:** The `feat/accessibility-assists` slice ships
`src/game/assists.ts` as a producer module: `applyAssists`,
`AssistContext`, `AssistMemory`, the six per-assist transforms, and
the badge derivation. The producer is complete and unit-tested (37
tests, all paths). The consumer wiring lives in
`raceSession.stepRaceSession`: read the player's
`SaveGameSettings.assists`, build an `AssistContext`
(`{ speedMps, surface, weather, upcomingCurvature, dt }`), thread the
per-session `AssistMemory` (initialise via `INITIAL_ASSIST_MEMORY` on
green-light, advance each tick), and replace the call site that today
forwards `playerInput` with the rewritten `applyAssists(...).input`.
The `applyAssists(...).weatherVisualReductionActive` flag wires into
the future weather grip multiplier; the `assistBadge` field surfaces
through the existing `HudState.assistBadge` passthrough. Two
prerequisites: the track-segment projector must expose an
"upcoming curvature in the next N meters" lookup for brake-assist
(probably trivial; segments already carry `curve`), and the weather
state machine must respect the visual-reduction flag when computing
its grip scalar. Track this so the toggles in the new
`/options/accessibility` pane move from "persisted" to "actually
applied".

## F-024: Migrate `src/game/` randomness to `createRng` / `splitRng`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The PRNG slice (`feat(game): seeded deterministic PRNG
module`, `2fcc7be`) ships `src/game/rng.ts` with `createRng`,
`splitRng`, `serialiseRng`, `deserialiseRng`, and bans `Math.random`
inside `src/game/` via an ESLint `no-restricted-syntax` override plus
the `no-math-random.test.ts` static guard. As of this commit no
production module in `src/game/` imports the PRNG: comments in
`damage.ts`, `damageBands.ts`, `raceRules.ts`, `raceCheckpoints.ts`,
and `sectorTimer.ts` say "no Math.random" because those modules are
fully deterministic without randomness, and `ghost.ts` is replay
playback (input-driven, no PRNG draw). The producer is therefore a
pure module with no consumers yet, in the same shape as F-021/F-022/
F-023 around the ghost slice. The consumers will appear when the AI
slice (`VibeGear2-implement-full-ai-fab57b84`, archetype roll +
rubber-banding noise), the hazard runtime
(`VibeGear2-implement-hazards-runtime-6085799c`, debris scatter +
puddle-splash variation), and the weather slice
(`VibeGear2-implement-weather-38d61fc2`, wind gust schedule) land.
Each of those slices should call `splitRng(raceRng, "<subsystem>")`
on the green-light tick so sub-streams stay isolated and the replay
seed advances reproducibly. Until those slices wire up there is no
code that exercises `splitRng` end-to-end; the unit tests cover the
algorithm but not the integration. Track this so the PRNG does not
sit unused indefinitely.

## F-023: Time Trial UI wiring for the ghost recorder
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/ghost-replay-recorder` slice ships
`src/game/ghost.ts` as a producer module: `createRecorder`,
`createPlayer`, `Replay`, the `INPUT_FIELDS` mask order, and the cap
constants (`RECORDER_SOFT_CAP_TICKS`, `RECORDER_HARD_CAP_TICKS`). The
producer is complete and unit-tested (34 tests, all paths). The
consumer wiring lands with the time-trial dot
(`VibeGear2-implement-time-trial-5d65280a`): instantiate
`createRecorder` on the green-light tick of a Time Trial run, call
`record(input, tick)` from the same `simulate` callback that drives
physics, call `finalize()` on the finish-line tick, and compare
`replay.finalTimeMs` against the stored PB before deciding whether to
overwrite. Until then the module is a producer waiting for a consumer,
mirroring the F-019 (damage model) and the closed F-013 (touch input)
deferral pattern.

## F-022: Render the ghost car in `pseudoRoadCanvas.ts`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The ghost slice produces a `Player` whose `readNext(tick)`
returns the input the recorded driver pressed on each tick. The
consumer drives a second physics step from those inputs (same
`step()` call, separate `CarState`) to derive the ghost's `(z, x,
speed)` for the current tick, then passes that to
`pseudoRoadCanvas.drawRoad` as a `ghostCar?: { z: number; x: number;
alpha: number }` field. The drawer paints the ghost with `ctx
.globalAlpha = 0.5` (the dot stress-test item 9 default) using the
same player-car atlas frame the live car renders, optionally tinted
blue or desaturated to differentiate. The atlas frames land with the
visual-polish slice (`VibeGear2-implement-visual-polish-7d31d112`);
do this slice after that one.

## F-021: SaveGameSchema integration for ghost replays + v2 migration
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The ghost slice produces a JSON-clean `Replay` shape but
does not wire it into the §22 save schema. The save integration:
add `ghosts: z.record(slug, GhostReplaySchema).optional()` to
`SaveGameSchema` in `src/data/schemas.ts` (where `GhostReplaySchema`
mirrors the `Replay` type), bump `CURRENT_SAVE_VERSION` to 2,
register a v1 to v2 migration that adds the empty `ghosts: {}` slot,
and add a "best-ghost" comparison helper (replace stored ghost iff
`newReplay.finalTimeMs < currentReplay.finalTimeMs`; tied times keep
the older ghost to avoid churn) per the dot stress-test item 8. The
cross-tab broadcast slice (`VibeGear2-implement-cross-tab-fa8cb14c`)
may also need updating to handle replay deltas in storage events.
Storage budget concern: a 600-tick (10 s) lap deltas to ~1 KB JSON;
a 5-minute Time Trial PB ghost is on the order of 30 KB. If the
on-wire size becomes a problem, switch to base64-packed
`Uint8Array` deltas in a `REPLAY_FORMAT_VERSION` 2 bump (additive;
old replays migrate forward).

## F-020: `scripts/content-lint.ts` to enforce the LEGAL_SAFETY denylist
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** `docs/LEGAL_SAFETY.md` section 9 sets the contract for a future
content-lint script that runs as part of `npm run verify` and fails the
build on (a) any binary in `public/` missing an asset manifest entry,
(b) track JSON that references a real-circuit name from a denylist
(Nurburgring, Spa, Suzuka, Monza, Silverstone, Imola, Estoril, Le Mans,
Monaco, Daytona, Indianapolis), (c) car names matching a manufacturer
denylist (Skyline, Mustang, Civic, Camaro, Supra, Lancer), and (d) any
text content matching a Top Gear denylist (`Top Gear`, `topgear`,
`Kemco`, `Snowblind`). The denylists in the doc are illustrative; the
authoritative list lives in the script when it lands. Write the lint
under `scripts/content-lint.ts`, wire it into `npm run verify`, and
unit-test the denylist matcher with positive and negative cases.

## F-019: Race session integration of the §13 damage model
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/damage-model` slice ships `src/game/damage.ts` as a
pure module: `applyHit`, `applyOffRoadDamage`, `performanceMultiplier`,
`isWrecked`, `repairCostFor`, `totalRepairCost` and the constants
surface (`PERFORMANCE_FLOOR`, `TOTAL_DAMAGE_WEIGHTS`, `WRECK_THRESHOLD`,
`OFF_ROAD_DAMAGE_PER_M`, `REPAIR_BASE_COST_CREDITS`, etc). The producer
is complete and unit-tested (42 tests, all paths). The consumer wiring
is deferred to the next slice that wires multi-car collision detection
into the race session: per-car `DamageState` lives on
`RaceSessionAICar` and on `player`, the physics call site multiplies
`stats.topSpeed` and `stats.accel` by `performanceMultiplier("engine",
state.zones.engine)` and grip by `performanceMultiplier("tires",
state.zones.tires)`, the off-road branch calls `applyOffRoadDamage`
each tick `isOffRoad(x)`, and `isWrecked` flips the player to `dnf` in
the §7 race-rules slice. Until then the module is a producer waiting
for a consumer, mirroring the `feat/drafting-slipstream` deferral
pattern.

## F-018: Playwright e2e spec for the loading screen / preload gate
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** The asset preload slice unit-tested the pure loader (parallel
resolve, partial failures, abort cancellation, kind-mismatch guard, progress
events) and the loading-screen state machine (idle / loading /
failed-critical / ready transitions, formatted text, progress fraction).
The dot also asked for a Playwright spec (`e2e/loading-screen.spec.ts`)
that simulates a slow network and asserts the progress text advances
through partial-success states before the ready card mounts. Closed
2026-04-26 by `feat/deferred-playwright-e2e`: the dev page
`/dev/loading?delay=<ms>&fail=<0|1>` mounts `<LoadingGate />` against a
synthetic in-page fetcher that delays each entry's resolution by the
configured value. The new spec `e2e/loading-screen.spec.ts` drives the
happy path (text advances from "Loading 0 of 4" to "Loaded 4 of 4",
ready card mounts, screen unmounts) and the failure path (forced
critical failure surfaces the Retry button). The `/race` route does
not yet mount `<LoadingGate />` because the production manifest is not
wired; that wiring is owned by the visual-polish slice and is tracked
under the broader HUD / asset slice rather than re-opened here.

## F-017: Playwright e2e specs for touch / mobile input
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** The touch / mobile slice unit-tested the pure projector,
the stateful manager (cancellation, blur, multi-touch, dispose), the
`mergeWithTouch` precedence rule, and the `createInputManager`
integration (38 cases). Closed 2026-04-26 by
`feat/deferred-playwright-e2e`: the new dev page `/dev/touch` mounts
`<TouchControls forceVisible />` over a surface div wired to
`createInputManager({ touchTarget })`, and the spec
`e2e/touch-input.spec.ts` runs against a new `mobile-chromium`
Playwright project (iPhone 13 emulation). The spec asserts that
holding the GAS / BRK / pause-corner zones flips the corresponding
`Input` field and that dragging the steering stick to the right
drives `steer` past 0.5. The race route does not yet mount touch
itself; wiring `touchTarget` into `<RaceCanvas>` is owned by the
broader HUD / accessibility slice and is not re-opened here.

## F-016: Playwright e2e specs for pause overlay and error boundary
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** The pause overlay + error boundary slice unit-tested the
loop pause semantics, the key binding resolution, and the error report
formatter (16 cases, every path). Closed 2026-04-26 by
`feat/deferred-playwright-e2e`: the new spec
`e2e/pause-overlay.spec.ts` drives `/race`, asserts that Escape opens
the overlay and the speedometer is stable across a 500 ms gap, that a
second Escape resumes the race, that the Resume button dismisses the
overlay, and that the Retire entry is present (currently disabled
because `<RaceCanvas>` does not pass `onRetire` until the results
route lands). The new spec `e2e/error-boundary.spec.ts` drives a new
dev page `/dev/throw` whose render body throws synchronously; the spec
asserts the fallback renders with role=alert, the message text
matches, the Reload button reloads the page, and the Copy button does
not crash (clipboard permissions granted in setup).

## F-015: Persistent off-road damage at high speed
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** in-progress
**Notes:** §10 "Road edge and off-road slowdown" calls for "Increase
damage slightly if the player persists off-road at high speed". The
arcade physics slice ships drag and a top-speed cap when off-road but
defers damage to the §13 damage / repairs slice that owns the damage
state machine. The §13 damage module (`feat/damage-model`) ships the
`applyOffRoadDamage(state, speed, dt)` helper as a pure pair of zone
deltas with the chosen rate `OFF_ROAD_DAMAGE_PER_M = 0.000107` (5 s of
top-speed off-road equals one mid-speed carHit body share within 1%).
The producer is in place; the consumer wiring is deferred. When the
race-session damage integration slice lands, call `applyOffRoadDamage`
once per tick the player car satisfies `isOffRoad(x)` (from
`src/game/physics.ts`), feed the resulting `DamageState` back into the
physics call site as a `performanceMultiplier(zone, damage)` scalar on
`stats.topSpeed` and `stats.accel`, and mark this F-015 entry `done`.

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
**Status:** in-progress
**Notes:** Q-003 resolved to Vercel Hobby + GitHub Actions. The
`feat/github-actions-ci-recovery` slice landed `.github/workflows/ci.yml`
and `vercel.json` (re-applying the work originally on
`feat/github-actions-ci`, dot
`VibeGear2-implement-github-actions-1780fc58`). Verify job runs lint,
typecheck, Vitest, and Playwright; deploy job runs `vercel build --prod`
+ `vercel deploy --prebuilt --prod`. Concurrency groups split so deploy is
not cancellable mid-flight. Marked `done` once the first push to `main`
triggers a successful `deploy` job and the deployed URL serves the title
screen. Human prerequisites (vercel link, three repo secrets, branch
protection) are documented in `README.md` Deploy section.

## F-002 — Project skeleton (Next.js + TypeScript + CI)
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** in-progress
**Notes:** First implementation slice once Q-001 is answered. Must include
lint, type-check, unit tests, e2e harness, and a smoke test that the dev
server boots. App shell, lint (next lint), strict type-check, and the Vitest
unit harness landed in the `feat/scaffold-next-app` slice. The Playwright
e2e harness with title-screen smoke landed in the
`feat/playwright-smoke-recovery` slice (`npm run test:e2e`,
`npm run verify:full`). Remaining: GitHub Actions CI (own slice, blocked by
F-003 deploy target choice; landed in
`feat/github-actions-ci-recovery`).

## F-001 — Author GDD sections 18–28
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
**Notes:** Verified on 2026-04-26 during the scaffold slice: all 28 GDD section
files exist under `docs/gdd/` (01 through 28). The original assumption that
sections 18 to 28 were missing was incorrect at the time this followup was
filed (or had been resolved before any later loop saw it). No action required.
