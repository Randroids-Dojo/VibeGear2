# Followups

Known followup work that did not fit in the slice that surfaced it. Each
entry has an id (`F-NNN`), a one-line description, the loop that created it,
and a priority.

Priorities: `blocks-release`, `nice-to-have`, `polish`. Statuses: `open`,
`in-progress`, `done`, `obsolete`. Do not delete entries. Mark them `done`
or `obsolete` so the trail is preserved.

---

## F-068: Add unique FX atlas sheets for all six playable cars
**Created:** 2026-04-29
**Priority:** polish
**Status:** open
**Notes:** The car FX compositor slice wires the live race renderer to an
explicit §16 frame contract and extends the original Sparrow atlas with
damage, brake, nitro, wet spray, and snow trail variants. The current
runtime still uses that shared Sparrow atlas for the live car overlay.
Add per-car atlas metadata or generated sheets for the full six-car
catalogue, route the active car's `visualProfile.spriteSet` into the
race renderer, and verify each car has equivalent FX coverage.

## F-067: Add weather particle intensity, glare, and fog readability settings
**Created:** 2026-04-28
**Priority:** polish
**Status:** done (2026-04-28)
**Notes:** The weather render-effects slice draws active rain, snow,
fog, and dusk or night bloom and wires the existing visual weather
assist to reduce intensity. §14 also calls for finer accessibility
controls: a weather particles intensity slider, reduced glare mode, fog
floor clamp for readability, and flash reduction for lightning or night
bloom. Add these settings to the options surface, persist them in
`SaveGameSettings.accessibility` or the successor display settings
bundle, and thread them into `drawRoad` so the renderer can scale or
disable the relevant effects independently.

Closed by `feat/weather-accessibility-settings`. The Accessibility pane
now persists weather particle intensity, fog readability floor, reduced
glare, and flash reduction settings. The live race renderer consumes
those settings for rain, snow, fog, and dusk or night bloom.

## F-066: Add pre-race tire selection and persist the active tire channel
**Created:** 2026-04-28
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The weather grip runtime slice applies §23 weather modifiers
through the existing dry handling path because no active tire-selection
state exists yet. Add the §14/§20 pre-race tire choice, persist the
active tire channel for the race, and pass `"wet"` into
`weatherGripScalar` when the player actually chooses wet tires. The AI
path can keep dry default until AI setup selection lands.

Closed by `feat/pre-race-tire-selection`. `/world` now routes tour
entry through `/race/prep`, the pre-race card shows the §20 race fields
and §14 forecast cells, the player can choose dry or wet tires, and
`/race` consumes the `tire` query as `RaceSessionConfig.playerTire`.
AI cars keep the dry default until AI setup selection lands.

## F-065: Persist active tour race progression through the four-race World Tour loop
**Created:** 2026-04-28
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The `/world` hub now renders the canonical championship,
normalizes a fresh save so Velvet Coast is enterable, persists tour
entry, and sends the selected tour's first track id to `/race`. The
active tour cursor still lives in memory inside `src/game/championship.ts`.
Wire the results screen to carry active tour state between races,
record each race result, show aggregate standings after race four,
call `unlockNextTour` on pass, and add `e2e/tour-flow.spec.ts` for the
full Velvet Coast to Iron Borough unlock path.

Closed by `feat/f-065-active-tour-progression`. Tour entry now persists
`progress.activeTour`, race finish advances or clears the active cursor,
the results screen links to the next tour race and reports tour-clear
state, passing the fourth Velvet Coast race unlocks Iron Borough, and
Playwright covers the final Velvet Coast to Iron Borough unlock path.

## F-064: Persist race damage into the garage repair queue
**Created:** 2026-04-28
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The F-061 repair shop consumes `garage.pendingDamage` and
persists full or essential repairs, but the live race finish path still
credits cash and records PBs without writing the player's final
`RaceSessionState.player.damage` into that queue. Wire the natural-finish
and retire paths in `src/app/race/page.tsx` so finished races store the
active car's pending damage and `lastRaceCashEarned`, then cover the
race to results to garage repair path in Playwright.

Closed by `feat/f-064-race-damage-persistence`. Race sessions now start
from the active car's queued garage damage, and both natural-finish and
retire paths write final player damage plus the actual credited payout
back into `garage.pendingDamage` and `lastRaceCashEarned`. Playwright
covers race finish to results to garage repair.

## F-063: Align starter selection content with the three §11 starter examples
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The garage summary starter recovery screen can pick from cars
with `purchasePrice: 0`, but the current catalogue only has Sparrow GT
as a free starter. §11 names Sparrow GT, Breaker S, and Vanta XR as the
starter examples. Decide whether all three should be free championship
starters or whether the GDD examples should be revised, then align the
catalogue, starter picker, save defaults, and tests in one slice.

Closed by `feat/f-063-starter-eligibility`. The car registry now exports
the three §11 starter-choice ids separately from `purchasePrice`, so
Breaker S and Vanta XR can appear in starter recovery without becoming
free purchases in the car shop. Content, garage state, and Playwright
tests pin the three-choice roster.

## F-062: Implement garage upgrade purchase surface
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The garage summary surface shows installed upgrade tiers and
links to `/garage/upgrade`, but the route is only a placeholder. Build
the §12 upgrade purchase flow with tier costs, eligibility checks,
credits persistence, installed tier updates, and save reload coverage.

Closed by `feat/f-062-garage-upgrades`. `/garage/upgrade` now loads the
active save, lists each §12 upgrade category with current tier, next
tier, cap, cost, and effect summary, and buys the next eligible tier via
`purchaseAndInstall`. The route persists wallet and installed tier
updates through `saveSave`; Playwright covers purchase and reload.

## F-061: Implement garage repair purchase surface
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-28)
**Notes:** The garage summary surface links to `/garage/repair`, but the
route is only a placeholder until the repair economy slice lands. Build
the §13 repair purchase flow once race damage persistence exists, then
show pending damage and repair cost in the garage summary.

Closed by `feat/f-061-garage-repairs`. `/garage/repair` now loads the
active save, reads `garage.pendingDamage` for the active car, shows
per-zone damage and full-service costs, quotes full and essential
repairs through `applyRepairCost`, applies the §12 essential-repair cap
from `lastRaceCashEarned`, debits credits, and persists the repaired
damage state. The garage hub now reflects active-car pending damage.
Race-finish production of `pendingDamage` is tracked separately as
F-064 so the purchase surface and the race handoff stay PR-sized.

## F-060: Correct live car turn sprite direction
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-27)
**Notes:** Manual race observation after F-059: the live car sprite still
turned visually backward. Moving right selected frames that looked like a
left turn, and moving left selected frames that looked like a right turn.

Closed by `fix/f-060-car-turn-direction`. The live car frame mapper now
matches the actual Sparrow atlas row: positive steering selects the
positive-skew frames near the start of the row, and negative steering
selects the negative-skew frames near the row end. Unit tests pin right,
left, and curve-influenced frame selection.

---

## F-059: Fix turn-at-crest road warp and reversed car sprite lean
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-27)
**Notes:** Manual race observation after F-057 and F-051: while turning
left or right near a crest, the foreground road could warp sideways as
if the near road edge was being pulled by distant curve projection. The
player car atlas also leaned the opposite direction from lateral input:
rightward movement selected left-looking frames and leftward movement
selected right-looking frames.

Closed by `fix/f-059-turn-crest-road-warp`. The projector now anchors
the foreground endpoint to the camera-local road plane at the bottom of
the viewport instead of extrapolating that endpoint from farther visible
strips. The live car frame mapper also reverses the Sparrow atlas
left/right indices so positive steer selects right-leaning frames and
negative steer selects left-leaning frames. Unit tests cover both
regressions.

---

## F-058: Add weather-specific car trail and spray variants
**Created:** 2026-04-27
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** F-051 ships the live and ghost car sprite atlas path with
directional, damage, brake, and nitro frames. §16 also calls for wet
spray and snow trail variants. Those are not frame rows in the current
Sparrow sheet and should land with the later weather VFX work so the
renderer can select them from actual weather state rather than a fake
always-on decoration. Add weather-specific atlas or effect assets,
thread weather state into the car overlay draw path, and cover clear,
wet, and snow cases in renderer tests.

Closed by `feat/f-058-weather-car-trails`. `drawRoad` now accepts active
weather on the live `playerCar` overlay, paints rain / heavy-rain spray
and snow mist behind the car, and draws no extra trail in clear weather.
Fog is explicitly treated as a no-trail condition. The race route passes
the active race weather from track/session setup, and renderer tests
cover clear, fog, wet, and snow cases.

---

## F-057: Fix turn-induced foreground road shear
**Created:** 2026-04-27
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** Manual race observation: steering left or right could make
the foreground road edge shear diagonally across the lower viewport. The
projector extended foreground road width to the screen bottom but kept
the bottom centerline pinned to the closest visible strip's `screenX`.
On turns or lateral camera offsets, that made the near edge follow a
different centerline than the next strip pair. `src/road/segmentProjector.ts`
now extrapolates the foreground centerline and half-width from the
nearest two visible strips. `src/road/__tests__/segmentProjector.test.ts`
pins the lateral-motion regression.

---

## F-056: Shorten lane dash duty cycle during uphill texture-phase rendering
**Created:** 2026-04-27
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** Manual race observation after F-055: uphill road markings were
still changing dramatically, but farther apart. The centerline and edge
context looked stable for longer spans, then popped into a very large
near-camera wedge while climbing. The issue was not segment-index phase;
it was that lane dashes used the full `LANE_STRIPE_LEN` period as the
visible dash span. `src/render/pseudoRoadCanvas.ts` now treats the lane
marking as a short visible duty inside the longer repeat cycle, so a dash
entering the foreground is physically short instead of filling an entire
48 m phase. `src/render/__tests__/pseudoRoadCanvas.test.ts` pins both an
in-strip duty boundary and the near-camera short-dash case.

---

## F-055: Replace temporary procedural road markings with texture-phase markings
**Created:** 2026-04-27
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** The F-054 hill-stutter slice stabilized uphill frames by
removing segment-index phase gates from the temporary procedural
centerline and rumble markings. That prevents visible snapping while the
projection fix is validated, but it is not the final road-art model.
Implement camera-phase-stable road markings driven by road distance,
not by the currently visible strip index. The solution should support
dashed lane lines, alternating rumble bands, grade changes, and segment
boundaries without popping from one uphill frame to the next. Add a
renderer regression that advances the camera through a climb and asserts
the marking phase changes smoothly rather than snapping.

Closed by `fix/f-054-hill-stutter`. `src/render/pseudoRoadCanvas.ts`
now draws rumble, road shade, and lane markings from road-distance
phase, splitting a projected strip when a phase boundary lands inside
it. `src/render/__tests__/pseudoRoadCanvas.test.ts` covers the in-strip
lane boundary split so uphill frames cannot flip an entire trapezoid at
once.

---

## F-054: Fix hill-bottom car stutter and repeated road collision bounce
**Created:** 2026-04-27
**Priority:** blocks-release
**Status:** done (2026-04-27)
**Notes:** Manual race observation: when the player reaches the bottom
of a hill and starts climbing the next grade, the player car appears to
stutter, bounce, or repeatedly collide with the road. This likely sits
at the seam between authored grade projection, camera road-height
sampling, and physics / damage collision feedback. Reproduce on the
default `/race` elevation track, then add a deterministic regression
test that drives through the dip-to-climb transition and asserts the
player car does not receive repeated ground-collision impulses or
visible vertical jitter. Inspect `src/road/segmentProjector.ts`,
`src/game/physics.ts`, `src/game/raceSession.ts`, and the camera setup
in `src/app/race/page.tsx`.

Closed by `fix/f-054-hill-stutter`. The issue was in the renderer
projection path, not the physics collision path: `project` restarted
curve and grade accumulation from zero at the active camera segment, so
the road could jump when the player crossed segment boundaries near a
grade reversal. `src/road/segmentProjector.ts` now blends the bounded
local projection window toward the next segment window as the camera
approaches a segment boundary, preserving the existing hill scale while
removing boundary pops. The regression tests in
`src/road/__tests__/segmentProjector.test.ts` drive through a
dip-to-climb transition and assert long climbs do not accumulate into a
full-screen road wall.

---

## F-053: Add a machine-checkable GDD coverage ledger
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done (2026-04-26)
**Notes:** The current loop relies on each agent reading the relevant
GDD sections and remembering to file followups for adjacent required
behaviour. Add a coverage ledger that maps each concrete GDD requirement
to one of: implemented code, automated test, open followup, or open
question. Add a CI or content-lint check that fails when a progress log
entry claims GDD coverage without listing the remaining uncovered
requirements. This should catch gaps like road elevation proof before a
visual slice reaches review.

Closed by `feat/f-053-gdd-coverage-ledger`. `docs/GDD_COVERAGE.json`
now records requirement-level coverage ids, and `content-lint` validates
ledger shape, code refs, test refs, open followup refs, open question
refs, plus the latest progress-log entry's coverage-ledger section.

---

## F-052: Add parallax horizon and roadside sprites to the race renderer
**Created:** 2026-04-26
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** §16 and §21 call for layered horizon art, parallax
backgrounds, and roadside sprites drawn from compiled track segment
content. The current race view renders flat sky, grass, and road strips
only. Wire the race renderer to consume region background layers and
roadside sprite ids from compiled track data, then verify that the
assets move at distinct depths in a browser smoke.

Closed by `feat/f-052-parallax-roadside`. The live race route now
builds three procedural temperate parallax layers (sky, mountains,
hills) and passes them to `drawRoad` with the live camera so each layer
uses its own scroll depth. `drawRoad` now reads `roadsideLeftId` and
`roadsideRightId` from compiled strips and paints original procedural
billboards for sign, tree, fence, rock, and light-pole ids. The bundled
`test/elevation` smoke track now authors non-default roadside ids so
the default `/race` path proves both elevation and track-driven scenery.
Unit tests cover parallax fallback fills and roadside id drawing; the
race Playwright smoke samples canvas pixels for the horizon layer and
roadside sign colour.

---

## F-051: Replace live and ghost car placeholders with atlas sprites
**Created:** 2026-04-26
**Priority:** polish
**Status:** done (2026-04-27)
**Notes:** The live player car and Time Trial ghost still use original
Canvas2D placeholder shapes. §16 expects 12 to 16 directional car
frames, damage variants, brake lights, nitro effects, and weather
variants. Replace the live `playerCar` overlay and the F-022 ghost
rectangle with frames from the same loaded sprite atlas, selected from
steering and road curve state. Keep the current Canvas2D shape only as
a missing-asset fallback.

Closed by `feat/f-051-car-atlas-sprites`. `public/art/cars/sparrow.svg`
now supplies an original 12-frame clean row plus dented, battered,
brake, and nitro frames behind the existing `src/data/atlas/cars.json`
metadata. The race route loads that atlas once per mount and passes it
to `drawRoad`; live and ghost overlays draw atlas frames when the image
is available, with the old procedural live car and blue ghost rectangle
kept as missing-asset fallbacks. The live frame selection combines
current steering input with upcoming road curve so the car sprite leans
with driver intent and track shape. Renderer tests cover both atlas
draw paths and existing fallback paths.

---

## F-050: Prove authored elevation in the live race view
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done (2026-04-26)
**Notes:** §9 defines mild crests, aggressive crests, dips, and
plateaus, while §16 and §21 say segment `grade` drives hills through
the pseudo-3D projection pipeline. The bundled `/race` content used in
the smoke path currently has zero grade everywhere, so the live view
does not prove Top Gear-style elevation changes yet. Add or route to a
small representative track with non-zero grade, validate it through the
track schema and compiler, and add a browser smoke that confirms the
projected road and horizon shift as the car advances through the
grade-bearing segments.

Closed by `fix/f-050-live-elevation-proof`. `/race` now defaults to
`test/elevation`, a bundled smoke track with authored flat launch,
crest, dip, plateau, and recovery segments. Track content tests assert
the JSON validates and compiles with non-zero grade. The race demo
Playwright smoke samples the center canvas column before and after
accelerating and asserts the top of the projected road rises as the
player reaches the grade-bearing segment.

---

## F-049: Implement options reset persistence wiring
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-27)
**Notes:** The `/options` footer renders a disabled "Reset to defaults"
button. SaveGameSettings v2 has shipped, so the remaining blocker is not
schema allocation; it is reset semantics across panes that now ship at
different times. Implement the button once each mounted pane has a clear
default source and persistence path. The action should reset only fields
owned by shipped panes, leave placeholder-pane fields untouched, write
through `saveSave`, and keep the existing disabled state until that full
path is wired and tested.

Closed by `feat/f-049-options-reset`. The footer button now resets shipped
options fields only: `settings.assists` and `settings.difficultyPreset`.
Profile data and placeholder-owned settings such as display units, audio,
accessibility presentation prefs, and transmission mode are preserved. At
the time F-049 landed, key bindings were still preserved because Controls
was a placeholder; F-014 later made key bindings a shipped pane and added
them to reset defaults. Unit tests cover the pure reset helper and Playwright
covers the full localStorage round-trip.

---

## F-048: Apply `CPU_DIFFICULTY_MODIFIERS` scalars in the AI runtime
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-27)
**Notes:** `src/game/aiDifficulty.ts` exposes
`CPU_DIFFICULTY_MODIFIERS` keyed by `PlayerDifficultyPreset` (Easy /
Normal / Hard / Master). The runtime side of the §23 wiring needs
three call-sites; the `paceScalar` slice landed in
`feat/cpu-tier-pace-scalar-in-tickai`:

- `tickAI` in `src/game/ai.ts`: **done.** A new optional
  `cpuModifiers` parameter (defaults to identity) stacks
  `cpuModifiers.paceScalar` on the per-driver
  `driver.paceScalar` at the targetSpeed compute site.
  `raceSession.stepRaceSession` resolves the tier once per tick
  via `resolveCpuModifiers(config.player.difficultyPreset)` and
  forwards the cached frozen reference into every `tickAI` call so
  the AI tick sees both the archetype identity (per-driver) and
  the player-facing difficulty (per-tier). The composed target
  is re-clamped at `stats.topSpeed` so a Master-tier driver with
  an authored `paceScalar > 1` still cannot exceed the chassis
  ceiling. Tests cover Hard > Easy under matched inputs, the
  per-driver composition, the topSpeed clamp, and the
  identity-default byte-equivalence with the omitted-arg path.
- `mistakeScalar`: **done.** Closed by
  `feat/f-048-ai-difficulty-scalars`. `tickAI` now stacks
  `cpuModifiers.mistakeScalar` on top of `AIDriver.mistakeRate` and
  feeds a deterministic lane-target mistake hook from `AIState.seed`.
  The hook is intentionally generic; archetype-specific mistake shapes
  remain owned by the full-AI dot.
- `recoveryScalar`: **done.** Closed by
  `feat/f-048-ai-difficulty-scalars`. `tickAI` now stacks
  `cpuModifiers.recoveryScalar` on a light trailing-gap pace lift when
  the AI is behind the player. The term stays bounded and remains under
  the chassis top-speed clamp so it cannot create impossible pace.

F-048 is closed. Remaining broader AI work stays in
`VibeGear2-implement-full-ai-fab57b84`: overtake / lane-shift
behavior, archetype-specific mistakes, nitro usage, weather skill, and
full grid behavior.

---

## F-047: Thread per-car `DamageState` through `raceSession` and feed `applyHit`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (`feat/race-session-damage-state`)
**Notes:** `applyHit` (and `applyOffRoadDamage`) now accept the
`assistScalars` and `nitroActiveOnDamagedCar` knobs but `raceSession`
did not yet own a per-car `DamageState`. The wiring slice
(`feat/race-session-damage-state`) added a `damage: DamageState`
field to `RaceSessionPlayerCar` / `RaceSessionAICar`, initialised it
to `PRISTINE_DAMAGE_STATE` in `createRaceSession`, and added a
per-tick damage pass that:

1. Calls `applyOffRoadDamage(damage, speed, dt, assistScalars)` for
   each still-racing car whose post-step position is off the
   drivable surface (`isOffRoad(x, roadHalfWidth) && speed > 0`).
2. Runs an ordered-pair (`i < j`) collision scan over the post-step
   field. Two cars are in contact when `|dz| < CAR_LENGTH_M (4)` and
   `|dx| < CAR_WIDTH_M (1.8)`. On a hit both cars receive a
   `carHit` event (`baseMagnitude = midpoint(6, 12)`,
   `speedFactor = avg(speedA, speedB) / 60`).
3. For each event, sets `nitroOnDamagedCar = nitro.activeRemainingSec > 0
   && (getDamageBand(state.damage.total * 100) === "severe" ||
   "catastrophic")` so the §23 `NITRO_WHILE_SEVERELY_DAMAGED_BONUS`
   stacks when the player burns nitro on a wreck-band car.
4. Calls `isWrecked(damage)` after each per-car update; a true
   reading flips the car to `status: "dnf"` with a new
   `dnfReason: "wrecked"` (added to the `DnfReason` union in
   `raceRules.ts`). The wreck flip beats the lap-completion branch on
   the same tick so a car that wrecks while crossing the line cannot
   also pick up a finish.

`raceSession` resolves the player's `AssistScalars` once per tick
(matching the existing F-042 pattern); AI cars take the identity
scalars (the §28 narrative pins the preset as a player-facing knob).
Tests cover: pristine fields at session start, pristine after a clean
single-lap run, off-road body damage growth, frozen physics on wreck,
collision damages both cars, lateral separation suppresses contact,
non-racing cars do not deposit fresh hits, the nitro+severe bonus
strictly increases the post-hit total, and 600-tick determinism with
the wiring active. F-019 (parent followup for §13 race-session
damage integration) collapses into this slice for the §13 expectations
the wiring covers; the remaining hazard-damage emitter (per-tick
puddle / cone / debris hits) is filed as an out-of-scope dependency
on the hazards-runtime dot.

---

## F-045: Wire `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` into the damage path
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** Pinned by the §23 balancing-pass slice in
`src/game/damage.ts` as a documented constant (`+15%`). The wiring
slice (`feat/nitro-damaged-bonus`) added an optional
`nitroActiveOnDamagedCar` flag to `applyHit`: when true the per-event
`totalIncrement` scales by `(1 + NITRO_WHILE_SEVERELY_DAMAGED_BONUS)`,
stacking multiplicatively with `damageSeverity`. Unit tests cover the
+15% bonus on a severe-band car, identity preservation when the flag
is omitted, the multiplicative stack with `damageSeverity`, and
no-op safety. The `raceSession` side cannot set the flag yet because
per-car `DamageState` is not threaded into the session loop; the band
check (`getDamageBand(state.total * 100) === "severe"` or
`"catastrophic"`) lands in the same slice that wires per-car damage
into `RaceSessionPlayerCar` / `RaceSessionAICar`. Tracked as F-047.

---

## F-044: Wire §23 CPU difficulty modifiers into the AI / catch-up pipeline
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** §23 "CPU difficulty modifiers" gives a per-tier table of
`paceScalar / recoveryScalar / mistakeScalar` for the
`Easy / Normal / Hard / Master` ladder. The wiring slice
(`feat/cpu-difficulty-modifiers`) added
`src/game/aiDifficulty.ts` with a frozen `CPU_DIFFICULTY_MODIFIERS`
lookup keyed by `PlayerDifficultyPreset`, plus `getCpuModifiers` /
`resolveCpuModifiers` helpers mirroring the §28 preset module.
The balancing test now imports the constant and asserts every cell
against the §23 source rather than re-pinning literals.
The runtime consumers (apply `paceScalar` in `tickAI`, apply
`mistakeScalar` to `AIDriver.mistakeRate` once mistake injection
lands, apply `recoveryScalar` once rubber-banding lands) still need
wiring. Tracked as F-048.

---

## F-046: Wire `BASE_REWARDS_BY_TRACK_DIFFICULTY` consumers in track JSON
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26)
**Notes:** Pinned by the §23 balancing-pass slice in
`src/game/economy.ts` as a frozen lookup keyed by difficulty rating
`1..5`. The bundled track JSON under `src/data/tracks/` already
declared the per-track `difficulty` field (validated by `TrackSchema`),
so the wiring slice took a different path than the original plan: the
consumer is `buildRaceResult` in `src/game/raceResult.ts`, which now
defaults `baseTrackReward` to
`baseRewardForTrackDifficulty(track.difficulty)` whenever the caller
does not supply an explicit override. The race-finish wiring at
`src/app/race/page.tsx` threads the compiled track's `difficulty` into
the Track stand-in fed to the builder. The championship slice
(`VibeGear2-implement-tour-region-d9ca9a4d`) can still pass an explicit
per-tour table via the existing `baseTrackReward` parameter; the §23
lookup is the runtime default until that lands. Mirror field
`difficulty` added to `CompiledTrack` so the page accesses the value
off the compiled output rather than re-parsing JSON.

---

## F-043: Pin §23 weather modifiers into `weather.ts`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26)
**Notes:** Landed in `feat/weather-tire-modifiers`. `src/game/weather.ts`
exposes `WEATHER_TIRE_MODIFIERS` (frozen `Record<WeatherTireModifierKey,
WeatherTireModifier>`), `WEATHER_TIRE_MODIFIER_KEYS` (frozen iteration
order), `isWeatherTireModifierKey` (type guard onto the §23-row subset
of `WeatherOption`), and `getWeatherTireModifier` (lookup that returns
`undefined` for the three §23-uncovered weathers). The balancing test
in `src/data/__tests__/balancing.test.ts` now imports the constant and
asserts every cell rather than re-pinning literals, so a §23 retune
has exactly one place to edit. The §23 row labels (Clear, Rain, Heavy
rain, Snow, Fog) cover five of the eight `WeatherOption` values; the
treatment of `light_rain`, `dusk`, and `night` is filed as Q-008 for
the parent dot to resolve when the runtime consumer lands.

The runtime consumers (apply the additive offset on top of
`baseStats.gripDry / gripWet` inside `physics.step`, surface the row
in the §14 pre-race UI grip-rating pill) are owned by the parent
weather dot `VibeGear2-implement-weather-38d61fc2`.

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
**Status:** done (`feat/race-bonus-multiplier-rates`)
**Notes:** Replaced the four fixed-credit placeholders with
multiplier-of-base rate constants in `src/game/raceBonuses.ts`:
`PODIUM_BONUS_RATES` (`[0, 0.10, 0.05, 0.02]`),
`FASTEST_LAP_BONUS_RATE = 0.08`, `CLEAN_RACE_BONUS_RATE = 0.05`,
`UNDERDOG_BONUS_RATE_PER_RANK = 0.10`. `ComputeBonusesInput` gained a
required `baseTrackReward` field so each chip's `cashCredits` is
`Math.round(baseTrackReward * rate)`; the underdog payout scales with
grid-rank improvement. `raceResult.buildRaceResult` threads
`resolvedBaseTrackReward` (the same value already fed into
`computeRaceReward`) into `computeBonuses`, so the §20 chip strip and
the wallet credit stay in lockstep. Re-exports on `raceResult.ts`
swapped from the four `*_BONUS_CREDITS` constants to the matching
rate constants; all in-tree callers updated. Verified: a
`baseTrackReward` of 1,000 yields P1=100, P2=50, P3=20, fastest=80,
clean=50, and underdog=100 per grid rank improved (covered by the new
`computeBonuses: §23 rate pin` cells in `raceBonuses.test.ts`).

---

## F-040: Wire `sponsorBonus` into the race-finish flow with a per-race sponsor picker
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/sponsor-bonus-wiring`)
**Notes:** The `feat/race-bonuses` slice landed
`sponsorBonus(input)` and `evaluateSponsorObjective(input)` in
`src/game/raceBonuses.ts` plus a five-entry MVP catalogue at
`src/data/sponsors.json` (and the `SponsorObjective` schema in
`src/data/schemas.ts`). The wiring slice
(`feat/sponsor-bonus-wiring`) made `buildRaceResult` the
consumer:

1. `ChampionshipTourSchema` now carries an optional
   `sponsors: string[]` roster keyed by `SponsorObjective.id`.
   Every tour in `world-tour-standard.json` declares a
   non-empty roster (option (a) per the dot description); a new
   `championship-content` cross-reference test asserts every
   roster id resolves via `SPONSOR_OBJECTIVES_BY_ID`.
2. `BuildRaceResultInput` gained optional `sponsor:
   SponsorObjective | null` and `sponsorContext:
   SponsorEvaluationContext | null` fields. When both are
   non-null, `buildRaceResult` calls `sponsorBonus(...)` and
   appends the resulting chip to `result.bonuses` after the
   per-race four-chip baseline (`podium / fastestLap /
   cleanRace / underdog / sponsor` order). The chip's
   `cashCredits` rolls into `cashEarned` so the §20 receipt and
   the wallet stay in lockstep.
3. `pickSponsorForTourRace({ tour, raceIndex, lookup })` lives
   in `src/game/raceResult.ts` and rotates through the roster
   by `raceIndex % roster.length`. Empty rosters / unresolved
   ids surface as `null` so a content rename never crashes the
   race-finish flow. The picker is the natural call site for
   the tour-region surface (`tour-region-d9ca9a4d`) once the
   per-race index becomes available; the §20 page wiring at
   `src/app/race/page.tsx` does not yet have championship
   context, so it continues to pass no sponsor (the chip strip
   stays at the four-chip baseline outside a tour).

The race-page integration follow-up: thread the active
championship + tour + raceIndex through the page once the
tour-region surface lands, build a `SponsorEvaluationContext`
from the live `RaceState` (player top speed, nitro-fired flag,
weather at finish; none are tracked on `RaceState` yet), and
pass both into `buildRaceResult`. Tracked alongside
`tour-region-d9ca9a4d`; the producer side of this dot is now
complete.

---

## F-039: Wire `tourCompletionBonus` into the tour-clear payout
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/f-039-tour-completion-bonus`)
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

**Resolution (2026-04-26, `feat/f-039-tour-completion-bonus`):**
`tourComplete(activeTour, championship, playerCarId?, raceRewards?)`
in `src/game/championship.ts` now accepts an optional `raceRewards`
list and exposes a new `bonuses: ReadonlyArray<RaceBonus>` field on
`TourCompletionSummary`. When the tour passed and `raceRewards` is
non-empty / non-zero-sum, the helper appends the
`tourCompletionBonus({ raceRewards, tourPassed })` `RaceBonus` to
the list; failed tours, omitted / empty `raceRewards`, and zero-sum
rewards yield an empty list. The wallet credit stays the §20 page
surface's responsibility: the future `/world` tour-clear screen
sums `bonuses` `cashCredits` into a single `awardCredits` call so
the chip strip and the wallet delta line up with the per-race
pipeline. F-037 will append `easyModeBonus(save, raceRewards)` to
the same `bonuses` list once its consumer wires here. Eight new
unit cases pin: passed-tour positive bonus, failed-tour empty,
omitted-rewards default empty, empty-list empty, zero-sum empty,
negative-entry clamp, unknown-tour empty, raceRewards purity, and
determinism.

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
**Status:** done (2026-04-26, `feat/f-037-easy-mode-tour-bonus`)
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

**Resolution:** Closed by `feat/f-037-easy-mode-tour-bonus`.
`tourComplete(activeTour, championship, playerCarId?, raceRewards?, save?)`
now accepts an optional save and appends an `easyModeTourComplete`
bonus when the tour passed, race rewards produce a positive sum, and
`save.settings.difficultyPreset === "easy"`. Existing callers that
omit the save keep the previous bonus list exactly: the standard
`tourComplete` chip only. The easy-mode chip uses the already-pinned
`easyModeBonus(save, raceRewards)` helper, so negative reward entries
are clamped consistently with the standard tour-clear bonus. The
future `/world` surface can sum `summary.bonuses` and credit both
tour-clear bonuses through the same wallet path.

---

## F-036: Wire `cappedRepairCost` into `applyRepairCost`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/wire-capped-repair-cost`)
**Notes:** The `feat/economy-catch-up` slice landed
`cappedRepairCost(rawCost, raceCashEarned, kind, difficulty)` in
`src/game/catchUp.ts` with eleven cell-by-cell unit tests. F-033
landed `applyRepairCost(save, { carId, damage, tourTier, zones? })`
in `src/game/economy.ts` (`feat/apply-repair-cost`); the raw cost
flow is now in place but the §12 essential-repair cap is not yet
applied. The natural shape:
1. The garage / results-screen repair surface picks `kind`
   (essential vs full) and `zones` (subset of `engine`/`tires`/`body`).
2. The surface calls `applyRepairCost` for the dry-run total
   (`cashSpent` from the ok result).
3. The surface passes the raw cost plus the player's last race cash
   to `cappedRepairCost(raw, raceIncome, kind, difficulty)`.
4. If the cap collapsed the cost, the surface either prompts the
   player or calls a future `applyRepairCost(save, { ..., overrideCost })`
   variant; today there is no override slot, so the simplest landing
   is: derive the cap, debit the wallet directly via a small helper
   in `src/game/catchUp.ts`, and zero the damage state via the same
   `createDamageState` path `applyRepairCost` uses internally.
The `kind` argument comes from the garage UI's repair-button
selection (essential vs full); the surface itself is owned by the
parent §20 results-screen / garage dot.

**Resolution (2026-04-26, `feat/wire-capped-repair-cost`):** Wiring
landed in `src/game/economy.ts`. `applyRepairCost` now accepts three
optional fields on `ApplyRepairCostInput` -- `repairKind`
(`"essential" | "full"`, defaults to `"full"`),
`lastRaceCashEarned` (defaults to `0`), and `difficulty` (defaults
to `save.settings.difficultyPreset`) -- and passes the summed raw
cost through `cappedRepairCost(rawTotal, raceCash, kind,
difficulty)` from `catchUp.ts` before the wallet check and debit.
When the cap engages, a new `redistributeBreakdown` helper applies
largest-remainder rounding to the per-zone breakdown so receipt
rows still sum exactly to the deducted total, and the result
returns a new `cashSaved` field carrying `rawTotal - cashSpent` for
the §20 "Discount applied" line. Defaults preserve the F-033
back-compat contract: callers that omit the new fields keep the
existing raw-cost behaviour byte-for-byte. Eleven new
`describe("essential-repair cap")` tests in
`src/game/__tests__/economy.test.ts` pin the back-compat default,
the normal-difficulty cap math, the largest-remainder breakdown
allocation, the under-cap pass-through, the full-repair / hard-tier
exclusions, the free-essential-on-zero-income edge case, the
save-default and explicit-override difficulty resolution, the
`REPAIR_CAP_FRACTION` knob coupling, and purity. The garage UI
that picks `repairKind` is still owned by the §20 / garage slice
(`implement-garage-flow-07f26703`); the wiring lands in
`applyRepairCost` so the surface only has to thread the new
optional fields when it ships the essential / full toggle.

---

## F-035: Wire stipend lever into the tour-entry flow
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/f-035-stipend-at-tour-entry`)
**Notes:** Closed by `feat/f-035-stipend-at-tour-entry`. The pure
`enterTour(save, championship, tourId)` in `src/game/championship.ts`
now resolves the tour's 0-indexed position in `championship.tours`,
calls `computeStipend(save, { id: tourId, index: position + 1 })` with
the 1-based index, and on a non-zero amount credits
`save.garage.credits` and calls `recordStipendClaim` before returning
the merged `SaveGame`. `EnterTourResult.ok` gained a `stipend: number`
field so the future `/world` page surface can render a one-shot
"+N credits stipend" toast without re-deriving the delta. Six new
unit cases in `src/game/__tests__/championship.test.ts` cover the
first-tour gate, the threshold gate (strict less-than, including the
boundary), the happy-path grant on a non-first tour with a low wallet,
the idempotent re-entry, the input-save purity contract on the
stipend-firing path, and the rejected-`tour_locked` no-op path. The
`/world` page wiring (consume the stipend field, render the toast,
persist via `saveSave`) lands as part of the parent
`VibeGear2-implement-tour-region-d9ca9a4d` dot's page slice; the
pure-module side of F-035 is closed here so the page can wire the
stipend without a second module change.

---

## F-034: Wire `awardCredits` into the race-finish flow
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26)
**Notes:** Landed in `feat/wire-award-credits-race-finish`. The
race-finish wiring at `src/app/race/page.tsx` now calls a new
`commitRaceCredits` helper from both the natural-finish and the
retire branches. The helper resolves the §23 base reward via
`baseRewardForTrackDifficulty(track.compiled.difficulty)` (F-046),
calls `awardCredits(save, { placement, status, baseTrackReward,
difficulty, bonuses })` against the persisted save (or
`defaultSave()` when no profile exists), persists the merged save
via `saveSave`, and stamps the wallet delta onto a fresh
`RaceResult.creditsAwarded` clone before handing it to
`saveRaceResult`. The §20 results screen surfaces the new row
(`data-testid="results-credits-awarded"`) so the player sees the
cash that actually landed in their garage, distinct from the
receipt rows. DNF cars receive the §12 participation cash
(`DNF_PARTICIPATION_CREDITS`) and the same row reflects it.
`creditsAwarded` defaults to `0` on the builder so non-economy
modes (Practice / Time Trial) can ship a legitimate zero without
calling the helper. Three new unit tests in
`src/game/__tests__/raceResult.test.ts` pin the P1 + Hard,
DNF-participation, and bonus-mirror contracts; the
`results-screen.spec.ts` seed grew a `creditsAwarded` field and
the `race-finish.spec.ts` natural-finish spec now asserts the
wallet row renders a non-zero credit count.

## F-033: Implement `applyRepairCost` once §23 ships `tourTierScale`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/apply-repair-cost`)
**Notes:** The `feat/economy-upgrade` slice intentionally deferred
`applyRepairCost` because §12 names a `tourTierScale` factor in the
formula `repairCost = damagePercent * carRepairFactor *
tourTierScale` that had no §23 column. Q-010 resolved with option (a)
in `feat/q-010-tour-tier-scale`: §23 carries the "Repair cost tour
tier scale" table and `src/game/economy.ts` exports `TOUR_TIER_SCALE`
plus the `tourTierScale(tour)` resolver (clamping out-of-range / NaN
to the in-table extremes).

Closed by `feat/apply-repair-cost`. `applyRepairCost(save, input)`
now lives in `src/game/economy.ts` with the input shape
`{ carId, damage, tourTier, zones? }`. The function reads per-zone
damage from the in-flight `DamageState`, scales each zone by the
catalogue car's `repairFactor`, multiplies by `tourTierScale(tourTier)`,
rounds per-zone before summing so the §20 receipt's line items add up
exactly to the deducted total, and returns a fresh `SaveGame` with
`garage.credits` debited plus a fresh `DamageState` with the requested
zones zeroed. Off-road accumulator survives the repair so the per-race
"time spent off-road" counter is not reset by a credit transaction.

Result type extended additively: the existing `EconomyResult.ok`
variant gains optional `cashSpent`, `damage`, and `repairBreakdown`
fields; `EconomyFailure` gains an `unknown_zone` code. Sixteen new
unit cases in `src/game/__tests__/economy.test.ts` cover the
zero-damage idempotent path, every-zone default, the §23 tier-1 vs
tier-8 scale ramp, the hand-computed example for tour 3 + tempest-r
(`round(0.5 * 1500 * 1.15 * 1.30) = 1121`), per-zone repair leaving
other zones untouched, off-road accumulator preservation, dedupe of
duplicate zones, `insufficient_credits` / `unknown_car` /
`unknown_zone` rejections, purity on success and failure paths,
out-of-range tour clamping, determinism, the §13 weighted-total
recomputation, and the per-catalogue-car `repairFactor` cross-check.

The caller (the §20 results-screen "Repair" button or a future garage
repair surface) is the natural consumer; the wiring is filed as F-036
(`cappedRepairCost` consumer) which can now plug straight into the
returned `cashSpent` against `cappedRepairCost(rawCost, raceCashEarned,
kind, difficulty)`.

## F-032: Wire leaderboard client into race results surface
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done
**Notes:** Closed by `feat/leaderboard-panel-on-results`. The §20 race
results page now renders `<LeaderboardPanel />` from
`src/components/results/LeaderboardPanel.tsx`. The panel is hidden
when `NEXT_PUBLIC_LEADERBOARD_ENABLED` is unset (the bundled MVP
default per AGENTS.md RULE 7); when enabled it fires `submitLap` once
on a clean finish and `getTop(trackId, 10)` for the top-N read,
mapping every client sentinel (`stored`, `rejected`, `network-error`,
`disabled`) to a stable status pill via the pure model in
`src/components/results/leaderboardPanelState.ts`. DNF rows skip the
network call and surface a `Lap not submitted (DNF).` pill so the
receipt is honest. The panel uses a placeholder raceToken / signature
because the client never holds the `LEADERBOARD_SIGNING_KEY` (server
secret per §21); a real signed submission lands with the raceToken
issuance route owned by F-030. Coverage: 16 unit cases against the
state model, 4 SSR-shape cases against the React shell, plus an e2e
assertion that the panel is hidden when the env flag is off.

Original notes: The `feat/leaderboard-client` slice landed
`src/leaderboard/client.ts` with `submitLap` and `getTop`, gated by
`NEXT_PUBLIC_LEADERBOARD_ENABLED`. The dot was marked `verified` but
the adapter had zero in-app callers; the expected consumer was the
post-race results surface owned by
`VibeGear2-implement-race-results-7b0abfaa`. Distinct from F-030
(Vercel KV provisioning) which is the deploy-side gap.

## F-031: Source map workspace paths leak in Next.js framework chunks
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/scrub-source-maps`)
**Notes:** Closed by `feat/scrub-source-maps`. F-031 fix path (a)
landed: `scripts/scrub-source-maps.ts` walks
`.next/static/chunks/**/*.js.map`, parses each map as JSON, and
rewrites every entry of `sources` and `sourcesContent` to replace the
absolute workspace prefix (`process.cwd()` at scrub time) with the
stable sentinel `vibegear2://`. The script writes back only when the
scrubbed contents differ so file mtimes stay stable for unchanged
maps; a second run is a no-op.

Wired into `package.json` as a `postbuild` hook
(`vite-node --script scripts/scrub-source-maps.ts`) so every
`npm run build` automatically scrubs the framework maps before the
artefact leaves the developer machine or the CI worker. The CLI
prints a one-line summary
(`scrub-source-maps: scrubbed=N unchanged=M skipped=K bytesDelta=D`)
and exits non-zero if any file fails to read / parse / write or if
`.next/static/chunks` is missing (i.e. someone invoked the postbuild
without a prior build).

Coverage: 26 unit cases in `scripts/__tests__/scrub-source-maps.test.ts`
covering the pure rewriters (`scrubWorkspaceFromString`,
`scrubSourceMapJson`), file-level scrub (`scrubSourceMapFile`),
directory walk (`walkFiles`, `scrubChunksDir`), CLI summary
(`summariseResults`), idempotence on the second pass, defensive
handling of malformed JSON / missing files / non-array `sources`,
plus a read-only smoke against the live `.next/static/chunks` that
asserts no map carries `process.cwd()` after the postbuild ran.

Verified the original repro: the verify-step grep
`grep -E '/Users/|/home/' .next/static/chunks/*.js.map` now returns no
hits across all 32 generated maps (including
`main-app-*.js.map` and `main-*.js.map` which were the original
flagged framework maps). The `webpack://_N_E/` prefixes inside our
own chunks are preserved because the workspace-prefix scrub is a
strict literal replace, not a path rewrite.

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
**Status:** done (2026-04-28)
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

Closed by `feat/f-024-rng-consumers`. Current production consumers now
use the owned PRNG surface: `src/game/aiGrid.ts` splits roster shuffle
and per-slot seed derivation from labelled streams, `src/game/ai.ts`
resumes the AI mistake stream with `deserializeRng`, and
`src/game/raceSession.ts` derives default per-AI streams from the
race-level seed unless a grid entry supplies an explicit seed. Hazards
and weather remain deterministic without random draws today; any future
debris scatter, splash variation, wind gust schedule, or damage
magnitude roll must add its own labelled `splitRng` consumer in that
feature slice.

## F-023: Time Trial UI wiring for the ghost recorder
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/f-023-timetrial-recorder-lifecycle`)
**Notes:** Closed by `feat/f-023-timetrial-recorder-lifecycle`. The
recorder lifecycle now ships as a separate producer module in
`src/game/timeTrial.ts`: `createTimeTrialRecorder(options)` returns a
stateful orchestrator with an `idle` -> `recording` -> `finished`
phase machine that observes per-tick `(phase, tick, input)` snapshots
from the race-session reducer. The orchestrator spawns the inner
`createRecorder` from `src/game/ghost.ts` on the first racing tick
(so the recorder's tick clock lines up with the race-session `tick`
clock that resets to 0 on the green-light tick), records every
subsequent racing tick, and finalises when the race phase flips to
`finished`. An optional `onFinalize` callback fires exactly once with
the finalised `Replay` so the call site can route the result into
`saveSave` without holding an orchestrator reference; callback errors
are swallowed so a failing persistence pipeline cannot crash the
simulation tick. `applyTimeTrialResult(currentGhost, replay)` is a
thin intent-named wrapper around `bestGhostFor` so the Time Trial
route slice can funnel the candidate replay through one PB-decision
helper. Coverage: 19 unit tests in
`src/game/__tests__/timeTrial.test.ts` pin spawn-on-green-light,
ignore-during-countdown, finalise-on-finish, single `onFinalize`
fire, post-finished tick no-op, duplicate-tick swallow, callback
error swallow, `reset()` reuse, defensive idle-on-skip-racing, the
PB selector's strict-less / equal-keep / null-keep / both-null
branches, and an integration scenario where a longer recording
(strictly higher `finalTimeMs`) does not displace the stored PB but
a shorter one does. The Next.js Time Trial route under `src/app/`
remains owned by `VibeGear2-implement-time-trial-5d65280a`; this
module is the producer that route will wire on top of (mirroring the
F-021 / F-022 producer-then-consumer split around the ghost slice).

## F-022: Render the ghost car in `pseudoRoadCanvas.ts`
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/f-022-time-trial-ghost-consumer`)
**Notes:** The ghost slice produces a `Player` whose `readNext(tick)`
returns the input the recorded driver pressed on each tick. The
consumer drives a second physics step from those inputs (same
`step()` call, separate `CarState`) to derive the ghost's `(z, x,
speed)` for the current tick, then passes that to
`pseudoRoadCanvas.drawRoad`.

**Drawer side (landed in `feat/f-022-ghost-car-render`):**
`drawRoad` now accepts an optional `ghostCar?: { screenX: number;
screenY: number; screenW: number; alpha?: number; fill?: string }`
field. The drawer paints a translucent placeholder rectangle at the
projected ground point using `ctx.globalAlpha = GHOST_CAR_DEFAULT_ALPHA`
(0.5 per the F-022 stress-test item 9) and `GHOST_CAR_DEFAULT_FILL`
(blue tint, `#5fb6ff`) so the ghost reads as "other player" without
the §17 sprite atlas being wired in. The rect lands AFTER the road
strips (so the ghost reads as on the road) and BEFORE the dust pool
(so off-road dust the live car kicks up still occludes the ghost).
Shake offset is intentionally not applied so a §16 impact shake does
not drag the recorded path with the live car. Coordinate convention
shifted from world `(z, x)` (in the original dot text) to screen-space
`(screenX, screenY, screenW)` so the projection happens once at the
caller, mirroring the §20 minimap and HUD overlay convention. Unit
tests in `src/render/__tests__/pseudoRoadCanvas.test.ts` cover the
default alpha, explicit alpha override, alpha clamp to `[0, 1]`, fill
override, omitted prop no-op, `null` prop no-op, non-positive
`screenW` short-circuit, non-finite coordinate short-circuit,
`globalAlpha` restoration, and zero-area viewport.

**Consumer side (deferred):**
The §6 Time Trial route still needs to (1) compile a `Replay` from
`save.ghosts[track.id]` via `bestGhostFor`, (2) instantiate
`createPlayer(replay)` on the green-light tick, (3) drive a second
`step()` call per tick from `player.readNext(tick)` against a separate
`CarState`, (4) project the ghost's `(z, x)` to screen via the same
`segmentProjector.project` strip math the road draw uses, and (5) pass
the projected `(screenX, screenY, screenW)` plus alpha into the
`ghostCar` prop. Lands alongside the time-trial slice
(`VibeGear2-implement-time-trial-5d65280a`) since that slice owns the
recorder lifecycle as well.

**F-022a sub-slice (landed in `feat/f-022a-project-ghost-car`):**
Step (4) above (project the ghost's `(z, x)` to screen) now has a
pure helper companion in `src/road/segmentProjector.ts`:
`projectGhostCar(segments, camera, viewport, ghostZ, ghostX, options?)`
returns `{ visible, screenX, screenY, screenW, scale, worldX, worldY }`
using the same pseudo-3D pinhole math as `project`. Walks segments
forward from the camera up to the ghost's segment, accumulates curve
and grade with the same dx / x and dy / y integrators the strip
projector uses, then applies the standard pinhole projection. Hidden
when the ghost is behind the near plane, past the draw distance, or
fed non-finite coordinates; ring-wraps cameraZ / ghostZ so a
lap-rolling player still sees a next-lap ghost ahead. Tests in
`src/road/__tests__/segmentProjector.test.ts` pin (a) screenX matches
the strip projector at integer segment boundaries on flat and
constant-curve tracks, (b) lateral `ghostX` shifts the projection
right of centerline on a flat straight, (c) hidden branches for
empty segments, degenerate viewport, non-finite inputs, near-plane,
and past-draw-distance, and (d) ring wrap semantics. Lets the
eventual TT-route slice call one helper for the screen prop instead
of re-implementing the curve / grade walk at the route site.

**F-022b sub-slice (landed in `feat/f-022b-ghost-driver-helper`):**
Steps (2) + (3) above (instantiate `createPlayer` and drive the per-tick
`step` from the recorded inputs) now have a pure helper companion in
`src/game/ghostDriver.ts`:
`createGhostDriver({ replay, stats, trackContext?, initial?, stepOptions?,
alpha?, fill? })` returns a stateful driver whose `tick({ tick, dt,
camera, viewport, segments, projector? })` advances the internal
`CarState` via the same `step(...)` the live car uses, projects the
result via `projectGhostCar(...)`, and returns the drop-in shape
`drawRoad`'s `ghostCar` prop expects (`{ screenX, screenY, screenW,
alpha, fill? } | null`). A `null` replay (no PB recorded) and a
version-mismatched replay both surface as `tick(...) === null` from
every call so the route can wire the driver unconditionally; the
`mismatchReason` field mirrors the underlying `Player.mismatchReason`
for debug surfaces. The driver latches `finished` once the recorded
replay is exhausted and returns `null` from subsequent calls. Tests in
`src/game/__tests__/ghostDriver.test.ts` pin (a) null-replay and
version-drifted-replay paths each return `null` without throwing,
(b) the per-tick `step` advance matches a reference `step(...)` invocation
bit-for-bit on the same starter stats and default track context,
(c) the overlay shape carries the §6 default alpha (0.5) when no override
is set, (d) `alpha` and `fill` overrides are forwarded to the overlay,
(e) an off-screen ghost (forwardZ < camera.depth) returns `null` while
exposing the underlying `lastProjection` for debug, (f) `finished`
latches on the tick the replay is exhausted, and (g) two drivers fed the
same replay + ticks produce JSON-equal overlay sequences. The eventual
TT-route slice now wires three lines (one `createGhostDriver` at session
creation, one `driver.tick(ctx)` per render frame, one `ghostCar:`
field on the `drawRoad` call) instead of re-implementing the
`createPlayer` + `step` + `projectGhostCar` plumbing at the route site.

**Atlas-frame upgrade (deferred):**
The placeholder rect ships today; the `LoadedAtlas` integration that
samples the same player-car atlas frame the live car renders (per the
original dot text) lands in the same slice that wires `LoadedAtlas`
into the renderer for the live player car (currently the live car is
also a placeholder; both upgrades land together). Until then the
`fill` override on the prop lets the consumer pin a per-car tint without
touching the renderer.

**Resolution:** Closed by `feat/f-022-time-trial-ghost-consumer`.
The race shell now supports `?mode=timeTrial`, and `/time-trial`
redirects into that mode. Time Trial sessions create a
`createGhostDriver` from `save.ghosts[track.id]`, advance the driver
once per simulation tick, and pass the resulting `ghostCar` overlay to
`drawRoad`. The same mode wires `createTimeTrialRecorder` to the
post-step race-session tick stream and persists a faster PB through
`applyTimeTrialResult` + `saveSave` when the recorder finalises.
Time Trial finishes skip economy credit commits so the ghost write is
not overwritten by a stale race-reward save. The title screen now
links to `/time-trial`.

## F-021: SaveGameSchema integration for ghost replays + v3 migration
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/ghost-replay-schema`)
**Notes:** Closed by `feat/ghost-replay-schema`. `GhostReplaySchema`
and `GhostReplayDeltaSchema` are now exported from
`src/data/schemas.ts`, and `SaveGameSchema` carries an optional
`ghosts: z.record(slug, GhostReplaySchema).optional()` slot that
mirrors the runtime `Replay` shape in `src/game/ghost.ts`. The save
schema bumped from v2 to v3 (the v1 to v2 migration had already
shipped); the new `migrateV2ToV3` step in
`src/persistence/migrations/v2ToV3.ts` is purely additive and seeds
an empty `ghosts: {}` while preserving any pre-existing bundle a
hand-edited save might carry. `defaultSave()` now returns the slot
seeded as `{}` so a fresh save and a migrated save are byte-identical
at this field. The PB selector landed as `bestGhostFor(current,
candidate)` in `src/game/ghost.ts`: it returns the strictly faster
replay and keeps the older ghost on a tie so the cross-tab storage
event does not churn on a neutral-result re-run. The cross-tab
broadcast slice already routes foreign-tab payloads through
`safeMigrate`, so the v2 to v3 migration runs there too without an
additional change. Storage budget concern (a 600-tick (10 s) lap
deltas to ~1 KB JSON; a 5-minute Time Trial PB ghost is on the
order of 30 KB) is unchanged; if the on-wire size becomes a problem,
switch to base64-packed `Uint8Array` deltas in a
`REPLAY_FORMAT_VERSION` 2 bump (additive; old replays migrate
forward).

## F-020: `scripts/content-lint.ts` to enforce the LEGAL_SAFETY denylist
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-26, `feat/content-lint-script`)
**Notes:** Closed by `feat/content-lint-script`. The new script
`scripts/content-lint.ts` ships four passes wired into `npm run verify`
via `npm run content-lint` (which calls `vite-node --script` against
the script). The script exports four pure pass functions
(`lintBinaryManifest`, `lintTrackNames`, `lintCarNames`,
`lintTopGearText`) plus `runContentLint` and the matcher helpers
(`buildDenylistRegex`, `findDenylistHit`, `formatHit`,
`isBinaryAssetPath`). The four denylists live as `readonly`
exports (`TRACK_REAL_CIRCUIT_DENYLIST`, `CAR_MANUFACTURER_DENYLIST`,
`TOPGEAR_TEXT_DENYLIST`, `BINARY_EXTENSIONS`) so a future term gets
appended in one place.

Scope decisions:
- (a) `public/` does not exist today, so the binary-without-manifest
  pass no-ops; once the asset pipeline ships its first binary, every
  entry must be declared via a `*.manifest.json` listing under
  `public/` (array of strings or array of `{ src }` entries) or the
  caller injects an explicit `manifestEntries` array.
- (b) and (c) match whole-word case-insensitively via
  `buildDenylistRegex` so generic words ("space", "spaceport",
  "uncivic") do not false-positive. The track pass restricts itself to
  JSON that looks like a track (carries `segments` and `laps` keys) so
  a future sponsor or championship JSON does not trip the rule on a
  mention.
- (d) is scoped to data JSON only (`src/data/**/*.json` and
  `public/**/*.json`). Source code, README, page copy, and `docs/`
  legitimately describe the project as a spiritual successor to Top
  Gear 2 per `docs/gdd/01-title-and-high-concept.md`; scoping the
  trademark scan to data files avoids tripping on those references.

Coverage: 45 unit cases in `scripts/__tests__/content-lint.test.ts`
covering each matcher, every pass on positive and negative fixtures
written to a temp directory, the cross-pass `runContentLint` ordering,
and a smoke check that runs the lint against the live repo and
asserts zero hits.

## F-019: Race session integration of the §13 damage model
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-28)
**Notes:** The `feat/damage-model` slice ships `src/game/damage.ts` as a
pure module: `applyHit`, `applyOffRoadDamage`, `performanceMultiplier`,
`isWrecked`, `repairCostFor`, `totalRepairCost` and the constants
surface (`PERFORMANCE_FLOOR`, `TOTAL_DAMAGE_WEIGHTS`, `WRECK_THRESHOLD`,
`OFF_ROAD_DAMAGE_PER_M`, `REPAIR_BASE_COST_CREDITS`, etc). The producer
is complete and unit-tested (42 tests, all paths). F-047
(`feat/race-session-damage-state`) wired the per-car `DamageState`
into `raceSession`: every car in the field carries a `damage` field
that accumulates off-road persistent damage, takes per-pair `carHit`
events on the §13 contact box, applies the §23 nitro+severe bonus,
and flips the car to `dnf` with reason `wrecked` once `isWrecked`
trips.

The `feat/wire-damage-scalars-into-physics` slice closes the physics
consumer call site. `stepRaceSession` now resolves
`getDamageScalars(state.player.damage.total * 100)` from
`damageBands.ts` and forwards the result on the player's `step()`
call as `StepOptions.damageScalars`; the same path lands on every AI
car using `entry.damage.total * 100`. The physics step already read
`damageScalars.topSpeedScalar` and `damageScalars.gripScalar` (added
in the original `feat/damage-band` slice as a producer-side
deferral), so the §10 narrative "engine damage reduces top speed"
and "tire damage reduces grip" now bites end-to-end. Pre-step damage
is the source of truth: scalars are resolved once per tick before
the physics integration, so a tick that pushes the player across a
band boundary still bills physics at the prior band (and the next
tick reads the new band). PRISTINE damage collapses the multipliers
to identity, so an undamaged car's behaviour is bit-for-bit
identical to the pre-binding pipeline.

Closed by `feat/hazards-runtime`. The hazards runtime now resolves
authored track hazard ids through `src/data/hazards.json`, evaluates
overlap per compiled segment, applies grip multipliers to the physics
step, forwards hazard damage through `applyHit`, and records breakable
hazards in race state so a cone or sign damages only once per race.
Tunnel entries remain registry metadata for the dedicated tunnel slice.

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
**Status:** done (2026-04-26, feat/f-015-off-road-damage-tests)
**Notes:** §10 "Road edge and off-road slowdown" calls for "Increase
damage slightly if the player persists off-road at high speed". The
arcade physics slice ships drag and a top-speed cap when off-road but
defers damage to the §13 damage / repairs slice that owns the damage
state machine. The §13 damage module (`feat/damage-model`) ships the
`applyOffRoadDamage(state, speed, dt)` helper as a pure pair of zone
deltas with the chosen rate `OFF_ROAD_DAMAGE_PER_M = 0.000107` (5 s of
top-speed off-road equals one mid-speed carHit body share within 1%).

The consumer wiring landed across F-047 (race-session per-car damage
state) and F-019 (damage scalars threaded into the physics call site):
`stepRaceSession` calls `applyOffRoadDamage(state, postStepSpeed, dt,
playerAssistScalars)` for the player and `(..., undefined)` for each
AI car whenever the post-step `isOffRoad(car.x, roadHalfWidth)` returns
true and `car.speed > 0`, then feeds `state.player.damage.total * 100`
through `getDamageScalars` on the next tick so persistent off-road
damage shows up as `topSpeedScalar < 1` and `gripScalar < 1` in the
following physics step.

This slice (`feat/f-015-off-road-damage-tests`) closes F-015 by adding
the F-015-specific integration pins to `src/game/__tests__/raceSession.test.ts`
under a new `describe("stepRaceSession (§10/§13 off-road persistent
damage wiring, F-015)")` block: per-tick body emit matches
`OFF_ROAD_DAMAGE_PER_M * postStepSpeed * dt * 0.7` exactly (post-step
speed is the §10 off-road cap `OFF_ROAD_CAP_M_PER_S = 24` because the
physics step clamps before the damage path reads it); 5 s of off-road
holding accumulates `300 * (per-tick body emit)` units with no drift;
on-road ticks leave the damage state at `PRISTINE`; AI cars run the
same gate as the player; the §28 `damageSeverity` scalar attenuates
the player emit at the Easy / Hard ratio (0.75 / 1.20); a hand-built
`damageSeverity = 0` preset zeros the emit at the producer level; and
persistent off-road damage feeds the next tick's band lookup,
clamping the player's top speed to the severe-band scalar (0.78) once
the accumulated damage crosses the `total = 0.75` boundary.

## F-014: Key remapping UI and persistence
**Created:** 2026-04-26
**Priority:** nice-to-have
**Status:** done (2026-04-27)
**Notes:** `createInputManager` already accepts a `bindings` override and
the §22 SaveSchema reserves a slot for control profiles, but there is no
UI to edit or persist them. Build a settings screen that shows each action,
prompts for a key, validates against conflicts, and writes back to the
save file. §19 lists this as a first-class feature on desktop.

Closed by `feat/f-014-key-remapping`. The `/options` Controls tab now
renders a real remapping pane, captures one primary key per action, rejects
conflicts against other actions, persists to `settings.keyBindings`, and
offers a reset for bindings. `/race` now reads persisted key bindings when
creating the input manager, so a custom binding applies at race start.

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
**Status:** done
**Notes:** The `feat/localstorage-save` slice unit-tested the persistence
module against an in-memory Storage shim (15 cases, all paths). The dot spec
also asked for a Playwright reload-survives-save test, but the save module
has no UI bindings yet (no garage screen, no options screen), so there is
nothing meaningful to drive in a browser. Land this once the Phase 2 garage
flow exists: navigate to the garage, mutate a value (e.g. swap car or buy an
upgrade), reload, assert the value persisted. **Closed by `feat/f-004-garage-save-load-e2e`** with `e2e/save-persistence.spec.ts`. Two specs: (1) seed two owned cars, switch active car, reload, assert the new active id survives both in localStorage and in the rendered indicator; (2) seed credits, buy an unowned car, reload, assert credits + ownedCars + installedUpgrades all persist. The localStorage-disabled branch skips via `test.skip(!hasStorage)`. Upgrade-installation and units-toggle round-trips remain a follow-up for when `/garage/upgrade` and the Settings Display pane ship.

## F-003: Auto-deploy pipeline from `main`
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done (2026-04-26)
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
protection) are documented in `README.md` Deploy section. Closed after the
main pipeline and production Vercel deploy passed for build `71166d0`; the
production title URL served the expected build and `/race` returned HTTP 200.

## F-002: Project skeleton (Next.js + TypeScript + CI)
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done (2026-04-26)
**Notes:** First implementation slice once Q-001 is answered. Must include
lint, type-check, unit tests, e2e harness, and a smoke test that the dev
server boots. App shell, lint (next lint), strict type-check, and the Vitest
unit harness landed in the `feat/scaffold-next-app` slice. The Playwright
e2e harness with title-screen smoke landed in the
`feat/playwright-smoke-recovery` slice (`npm run test:e2e`,
`npm run verify:full`). Remaining: GitHub Actions CI (own slice, blocked by
F-003 deploy target choice; landed in
`feat/github-actions-ci-recovery`). Closed after the app shell, lint,
strict typecheck, Vitest, Playwright e2e, content lint, GitHub Actions CI,
and Vercel production deploy path were all present and green on `main`.

## F-001 — Author GDD sections 18–28
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
**Notes:** Verified on 2026-04-26 during the scaffold slice: all 28 GDD section
files exist under `docs/gdd/` (01 through 28). The original assumption that
sections 18 to 28 were missing was incorrect at the time this followup was
filed (or had been resolved before any later loop saw it). No action required.
