# Followups

Known followup work that did not fit in the slice that surfaced it. Each
entry has an id (`F-NNN`), a one-line description, the loop that created it,
and a priority.

Priorities: `blocks-release`, `nice-to-have`, `polish`. Statuses: `open`,
`in-progress`, `done`, `obsolete`. Do not delete entries — mark them `done`
or `obsolete` so the trail is preserved.

---

## F-042: Wire §28 difficulty preset scalars into physics, damage, and nitro
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** Landed in `feat/wire-difficulty-preset-scalars`. Per the
original plan:
1. `src/game/physics.ts`: `StepOptions.assistScalars` consumes
   `offRoadDragScale` against `OFF_ROAD_DRAG_M_PER_S2` and
   `steeringAssistScale` as a `(1 - scale)` multiplier on the lateral
   velocity contribution. Identity (no `assistScalars`) preserves
   pre-binding behaviour. `PHYSICS_VERSION` bumped from `1` to `2`
   so any v1 ghost is rejected by `tryRehydrateGhost`.
2. `src/game/damage.ts`: `applyHit` and `applyOffRoadDamage` each
   accept an optional `assistScalars` argument and multiply the
   per-event total by `damageSeverity` before the per-zone split.
   Identity (no `assistScalars`) preserves pre-binding behaviour.
3. `src/game/nitro.ts`: `getInstabilityMultiplier` accepts an
   optional `assistScalars` argument and composes
   `nitroStabilityPenalty` into the final clamp. The §10
   downward floor at 1.0 still holds. The damage-band stability
   axis is already a multiplier in this function so no separate
   wiring is needed.
4. `src/game/raceSession.ts`: `RaceSessionConfig.player`
   carries an optional `difficultyPreset`. The session resolves it
   once per tick via `resolvePresetScalars` (frozen-table lookup
   is allocation-free) and forwards the cached `AssistScalars`
   reference to `step()`. AI cars deliberately do not consume the
   player's preset (the §28 narrative is "player-facing").
   `src/app/race/page.tsx` reads
   `loadSave().settings.difficultyPreset` and threads it into the
   config. Tests cover all four consumer points; bench / benchmark
   suites and existing call sites unchanged because the new field
   is optional with an identity default.

## F-041: Swap fixed-credit bonus placeholders for multiplier-based rates per dot pin
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/race-bonuses` slice preserved the legacy
fixed-credit placeholders for the four per-race bonuses
(`PODIUM_BONUS_CREDITS = 250`, `FASTEST_LAP_BONUS_CREDITS = 200`,
`CLEAN_RACE_BONUS_CREDITS = 150`, `UNDERDOG_BONUS_CREDITS = 200`) so
the §20 chip rendering, `BonusChip.tsx`, the `raceResult` builder
tests, and the `e2e/results-screen.spec.ts` fixture stayed
numerically stable. The dot
`VibeGear2-implement-race-reward-3eb9b609` spec stress-test pinned
multiplier-of-base values instead (podium 0.10 / 0.05 / 0.02 of
base, fastest 0.08, clean 0.05, underdog 0.10 per grid-rank
improvement). Swap is mechanical: change the constants in
`src/game/raceBonuses.ts` to compute against the per-race
`baseTrackReward`, update the four `expect(... cashCredits).toBe(...)`
cases in `src/game/__tests__/raceBonuses.test.ts` and the matching
cells in `src/game/__tests__/raceResult.test.ts`, and refresh the
hardcoded `cashCredits` numbers in `e2e/results-screen.spec.ts`.
Owner: `balancing-pass-71a57fd5`.

---

## F-040: Wire `sponsorBonus` into the race-finish flow with a per-race sponsor picker
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/race-bonuses` slice landed
`sponsorBonus(input)` and `evaluateSponsorObjective(input)` in
`src/game/raceBonuses.ts` plus a five-entry MVP catalogue at
`src/data/sponsors.json` (and the `SponsorObjective` schema in
`src/data/schemas.ts`). The function has no in-app caller yet: the
race-finish wiring would need to (1) pick which sponsor is active
for the race (per-tour roster owned by the championship slice
`tour-region-d9ca9a4d` or a dedicated sponsor-selection module),
(2) build the `SponsorEvaluationContext` from the live
`RaceState` (player top speed, nitro-fired flag, weather at
finish), (3) call `sponsorBonus`, and (4) append the resulting
`RaceBonus` (when non-null) to the `bonuses` list passed into
`awardCredits` and surfaced on `RaceResult.bonuses`. Mirrors the
F-026 / F-032 / F-034 / F-035 / F-036 / F-037 / F-039
producer-without-consumer pattern.

---

## F-039: Wire `tourCompletionBonus` into the tour-clear payout
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/race-bonuses` slice landed
`tourCompletionBonus({ raceRewards, tourPassed })` in
`src/game/raceBonuses.ts` returning a `RaceBonus` of kind
`tourComplete` (or `null` on a failed tour / empty rewards). The
function has no in-app caller yet: the tour-clear surface owned
by `VibeGear2-implement-tour-region-d9ca9a4d` is the natural
consumer. At tour-clear, the wiring should call
`tourCompletionBonus(...)` alongside the existing `tourBonus(...)`
helper (see F-037 for the easyModeBonus parallel) and credit the
combined amount via `awardCredits` (or a new `creditFlat(save,
amount)` helper if that path lands first). Mirrors the F-037
producer-without-consumer pattern.

---

## F-038: Wire `buildRaceResult` into the race-finish flow + push to `/race/results`
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
**Notes:** The `feat/race-results-screen` slice (commit `e1129b7`)
landed the pure builder `buildRaceResult(state, save, track)` in
`src/game/raceResult.ts` (33 unit tests) and the standalone
`/race/results` page that reads a session-storage handoff via
`src/components/results/raceResultStorage.ts`. The commit message
itself files the wiring as a follow-up: today nothing on the race
route calls `buildRaceResult`, writes the storage payload, or
pushes the router to `/race/results`, so the screen is unreachable
from gameplay. The wiring should happen at race-finish in
`src/game/raceSession.ts` (or its caller in `src/app/race/page.tsx`)
and reuse the same handoff for Practice / Quick Race / Time Trial
per the dot's "each surface decides whether to apply the patch"
contract. Mirrors the F-026 / F-032 / F-034 / F-035 / F-036 / F-037
producer-without-consumer pattern. Promoted to `blocks-release`
because the results screen is on the GDD §5 inter-race path; the
race loop cannot complete without it.

**Resolution (2026-04-26, `feat/race-finish-wiring`):** Retire-path
wiring landed in commit `8756804` (`feat/pause-actions`). The
natural-finish branch is now wired in
`src/app/race/page.tsx`: the render callback's `phase ===
"finished"` arm builds the `RaceResult` via
`buildFinalRaceState` + `buildRaceResult`, calls
`saveRaceResult`, tears down the loop / input manager, and
pushes the router to `/race/results`. A `routedRef` latch
guards against per-frame re-fires and re-arms on restart. PB
recording is gated on `session.player.status === "finished"`
so a §7 hard-time-limit DNF skips the records patch. New e2e
spec `e2e/race-finish.spec.ts` drives a single-lap race on
`test/straight` and asserts the route hop and the player row.
Practice / Quick Race / Time Trial reuse will land alongside
the §6 mode wiring (separate dots own those surfaces).

---

## F-037: Wire `easyModeBonus` into the tour-clear bonus payout
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/economy-catch-up` slice landed
`easyModeBonus(save, sumRewards)` in `src/game/catchUp.ts` and proved
the rate with eight unit tests. The function has no in-app caller
yet: the tour-clear surface owned by
`VibeGear2-implement-tour-region-d9ca9a4d` is the natural consumer.
At tour-clear, the wiring should call
`tourBonus(rewards) + easyModeBonus(save, rewards)` and credit the
combined amount via `awardCredits` (or a new
`creditFlat(save, amount)` helper if that path lands first).
Mirrors the F-026 / F-032 / F-034 producer-without-consumer
pattern.

---

## F-036: Wire `cappedRepairCost` into `applyRepairCost`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/economy-catch-up` slice landed
`cappedRepairCost(rawCost, raceCashEarned, kind, difficulty)` in
`src/game/catchUp.ts` with eleven cell-by-cell unit tests. The
function has no in-app caller because `applyRepairCost` itself does
not exist yet (F-033 owns it, blocked on §23 `tourTierScale`). When
F-033 lands, `applyRepairCost` should:
1. Compute the raw cost from the §12 formula
   `damagePercent * carRepairFactor * tourTierScale`.
2. Pass the raw cost plus the player's last race cash to
   `cappedRepairCost(raw, raceIncome, kind, difficulty)`.
3. Deduct the capped result from `save.garage.credits`.
The `kind` argument comes from the garage UI's repair-button
selection (essential vs full).

---

## F-035: Wire stipend lever into the tour-entry flow
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/economy-catch-up` slice landed
`computeStipend(save, tour)`, `getStipendClaimed(save, tourId)`, and
`recordStipendClaim(save, tourId)` in `src/game/catchUp.ts`. The
functions have no in-app caller yet: the tour-entry surface owned
by `VibeGear2-implement-tour-region-d9ca9a4d` is the natural
consumer. At the moment the player selects a tour and confirms
entry, the wiring should:
1. Call `computeStipend(save, { id: tour.id, index: tour.index })`.
2. If the result is non-zero, credit the wallet via the equivalent
   of `awardCredits` (or a new `creditFlat(save, amount)` helper if
   that path lands first) and then call `recordStipendClaim` so a
   second tour-entry does not double-pay.
3. Persist the merged save via `saveSave`.
The `tour.index` is 1-based (first tour in a championship is
index 1) per `StipendTourContext` in `src/game/catchUp.ts`.

---

## F-034: Wire `awardCredits` into the race-finish flow
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/economy-upgrade` slice landed
`awardCredits(save, { placement, status, baseTrackReward, difficulty })`
plus `tourBonus(rewards)` in `src/game/economy.ts` and proved the
formula with 33 unit tests. The function has no in-app caller yet:
the post-race results screen owned by
`VibeGear2-implement-race-results-7b0abfaa` is the natural consumer
and should call `awardCredits` at the moment the player car crosses
the final finish line, then merge the new save via `saveSave`. The
caller also needs to pass `baseTrackReward`; until the track JSON
schema gains a `baseReward` field, the wiring slice can pin a
per-tour table in `src/data/championships/baseRewards.ts` (one row
per tour, matching §23 Race Reward column). Mirrors the
F-026 / F-032 producer-without-consumer pattern. Distinct from
F-033 (repair-cost wiring) which is the next economy-side gap.

## F-033: Implement `applyRepairCost` once §23 ships `tourTierScale`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/economy-upgrade` slice intentionally deferred
`applyRepairCost` because §12 names a `tourTierScale` factor in the
formula `repairCost = damagePercent * carRepairFactor *
tourTierScale` that has no §23 column today. The iter-19 stress-test
on `VibeGear2-implement-economy-upgrade-ff73b279` proposed a
placeholder table (1.0, 1.15, 1.30, 1.50, 1.75, 2.05, 2.40, 2.80 for
tours 1..8) but flagged that the implementer must NOT freeze it
without dev sign-off. File `Q-NNN` in `docs/OPEN_QUESTIONS.md` first
asking the dev to confirm or replace the table; once answered, add
`applyRepairCost(save, { carId, zoneRepairs, tourTier })` to
`src/game/economy.ts` reading per-zone damage from the in-flight
`DamageState`, computing the credit cost via `repairCostFor` from
`damage.ts`, multiplying by the resolved scale, and returning a
fresh `SaveGame` with `garage.credits` decremented and (separately)
the post-race damage zeroed. The caller (the §20 results-screen
"Repair" button) is the natural consumer; until that surface lands,
land the function with unit tests and leave the wiring as a follow-on.

## F-032: Wire leaderboard client into race results surface
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/leaderboard-client` slice landed
`src/leaderboard/client.ts` with `submitLap` and `getTop`, gated by
`NEXT_PUBLIC_LEADERBOARD_ENABLED`. The dot was marked `verified` but
the adapter currently has zero in-app callers (`grep -rn "submitLap\|getTop"
src/` outside `src/leaderboard/` returns nothing). The expected consumer
is the post-race results surface owned by
`VibeGear2-implement-race-results-7b0abfaa`: when the player crosses the
finish line cleanly the results page should call `submitLap` with the
signed token, render the `stored | rejected | disabled | error` outcome
inline, and (optionally) show a top-N leaderboard read via `getTop`. Until
that slice lands the client adapter is a producer waiting for a consumer,
mirroring the F-015 / F-026 deferral pattern. Close this followup as part
of the race-results dot, not as a standalone slice. Distinct from F-030
(Vercel KV provisioning) which is the deploy-side gap.

## F-031: Source map workspace paths leak in Next.js framework chunks
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/build-version-stamping` slice enabled
`productionBrowserSourceMaps: true` in `next.config.mjs` so the future
opt-in error reporter can map minified frames back to source. The
verify step `grep -E '/Users/|/home/' .next/static/chunks/*.js.map`
flags two framework maps (`main-app-*.js.map`, `main-*.js.map`) whose
sources reference `/Users/<dev>/.../node_modules/next/dist/...` paths.
These leaks are inside Next.js framework code, not our own source, so
the privacy impact is minimal: the paths only reveal that the build
ran from a workspace whose absolute prefix matches the dev's
filesystem layout, and our own chunks (where stack traces would point
in any real bug) carry the expected webpack:// prefixes. Revisit when
the opt-in error reporter slice lands and decide whether to scrub the
absolute prefix during the source-map upload step rather than at
build time. Workaround: the deploy host (Vercel / Cloudflare Pages)
only serves `.map` files on explicit request, so the maps stay a
build-only artefact in normal browsing.

## F-030: Provision Vercel KV and swap LEADERBOARD_BACKEND in production
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** open
**Notes:** The `feat/leaderboard-client` slice ships
`src/leaderboard/client.ts` (gated by `NEXT_PUBLIC_LEADERBOARD_ENABLED`)
and `src/leaderboard/store-vercel-kv.ts` (loaded dynamically via
`resolveLeaderboardStore` only when `LEADERBOARD_BACKEND=vercel-kv`).
The Vercel KV adapter is a producer waiting on three manual steps that
cannot land inside an autonomous slice: (1) `vercel kv create
leaderboard-prod` against the production Vercel project, (2) link the
KV instance which auto-provisions `KV_REST_API_URL` and
`KV_REST_API_TOKEN` env vars, (3) `npm i @vercel/kv` and set
`LEADERBOARD_BACKEND=vercel-kv` plus `NEXT_PUBLIC_LEADERBOARD_ENABLED=true`
in the production env. Verify by submitting one signed lap from the
deployed `/race` flow and reading it back via `GET
/api/leaderboard/test%2Fstraight`. Until this lands, the production
deploy continues to use the noop store and `submitLap` short-circuits
to the `disabled` sentinel client-side. The `KvLike` interface in
`store-vercel-kv.ts` is narrow enough that an Upstash Redis swap is a
one-line change if the KV pricing tier shifts before launch.

## F-029: Playwright e2e race-finish spec
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** The iter-19 stress-test on dot
`VibeGear2-implement-race-rules-b30656ae` calls for an `e2e/race-finish.spec.ts`
that runs a full multi-lap race against AI and asserts the results overlay
appears. The current `/race` demo route does not yet render a results overlay
(no `data-testid="race-results"` target), and the lap-completion path stops
physics integration but does not surface a finish UI. Land this once the
§7 results screen lands (likely the `economy-upgrade-ff73b279` slice or its
HUD sibling). Until then, the `stepRaceSession` lap-completion and time-limit
unit tests stand alone.

**Resolution:** Closed by `feat/e2e-race-finish-multilap`. The race page
now honours an optional `?laps=N` URL override (clamped to `[1, 50]`) so
the bundled single-lap `test/straight` track can be coerced into a
multi-lap run without shipping a dedicated fixture or mutating the data
file's `laps: 1`. `e2e/race-finish.spec.ts` gained a second `describe`
("F-029 multi-lap") that drives a three-lap race vs the bundled
clean-line AI, asserts `hud-lap` reads `1 / 3` so the override actually
threaded through, holds throttle until the natural-finish wiring routes
to `/race/results`, and asserts both the player row and the `ai-0` row
render with the §20 testids. Spec runs in ~1.1m on the local box; the
prior F-038 single-lap spec is preserved untouched.

## F-028: Per-car DNF tracking in raceSession
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** The `feat/per-car-dnf-tracking` slice wired
`tickDnfTimers` + `DNF_OFF_TRACK_TIMEOUT_SEC` +
`DNF_NO_PROGRESS_TIMEOUT_SEC` + `DNF_OFF_TRACK_RESET_SPEED_M_PER_S`
into `stepRaceSession`. Per-car `status`, `dnfTimers`, `dnfReason`,
`lap` (AI), `lapTimes`, and `finishedAtMs` now live on
`RaceSessionPlayerCar` / `RaceSessionAICar` so a DNF'd car (player or
AI) freezes its physics integration on the same tick its threshold
trips. The race phase additionally flips to `"finished"` once every
car has stopped racing, mirroring the §7 hard-cap safety net. The
§20 results screen and the §12 reward-builder slice can now consume
the per-car arrays without further shape changes; only the renderer
plumbing is left and falls under `race-results-7b0abfaa`.

## F-027: HUD assist badge renderer
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
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

**Resolution:** Closed by `feat/hud-assist-badge`. `drawHud` now reads
`HudState.assistBadge` and, when `active`, paints a tinted pill plus a
shadowed label below the splits widget at `(viewport.width - padding,
padding + 64)`. The label uses `ASSIST_BADGE_LABELS[primary]` for the
single-assist case and appends a plain ASCII `xN` suffix when
`badge.count > 1` so the §20 monospace stack renders the count without
falling back to a Unicode glyph. New `assistBadgeFill` /
`assistBadgeText` fields on `HudColors` keep the palette overridable.
14 new render tests cover the omitted / inactive / single / multi /
override / determinism / state-restoration paths plus a
`formatAssistBadgeLabel` direct test for the count-suffix rule.

## F-026: Wire `applyAssists` into the race session input pipeline
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
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

**Resolution:** Closed by `feat/wire-applyassists-into-race-session`.
Added `assists?: AssistSettingsRuntime` and `weather?: WeatherOption`
to the race-session config, threaded a per-session `AssistMemory`
through `RaceSessionPlayerCar`, called `applyAssists` once per tick
ahead of nitro / transmission / drafting / physics so all downstream
reducers consume the post-assist `Input`, reset `AssistMemory` on the
green-light promotion tick, surfaced `assistBadge` and
`weatherVisualReductionActive` on the player snapshot, exposed a new
`upcomingCurvature(segments, cameraZ, lookahead)` helper from
`src/road/segmentProjector.ts`, and wired the `/race` page to read
`SaveGameSettings.assists` from `loadSave()` (or `defaultSave()` when
no save exists) at session creation. New unit coverage: 7 race-session
assist tests (toggle-nitro latch, reduced-input lockout, brake-assist
firing on a curve, lifecycle reset on green-light, visual-only-weather
flag passthrough, two determinism shapes) plus 7 segment-projector
tests for the upcoming-curvature helper. The
`weatherVisualReductionActive` flag is plumbed through the player
snapshot with a `TODO(F-026/weather)` marker; the §14 weather slice
will read it from there when it lands.

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
