## Top Gear Fun-Factor Slice Plan

Date: 2026-05-05
Owner: research loop
Status: iteration 1 of N - seeded with pain point #1 only.

This document pins the top-3 implementation slices that close the
biggest fun-factor gaps between the current VibeGear2 build and the
Top Gear 2 feel the user named as the bar. It is a planning companion
to `docs/ARCADE_RACER_PRIORITY_STACK.md` (which ranks polish work) and
`docs/FUN_FACTOR_AUDIT.md` (which ranked the v0.1 release work). It
focuses specifically on the five pain points from the
`/randroid-loop` user-directions block:

1. The whole experience is menus + a 30-50 s race.
2. Tracks are missing real turns: S-curves, hairpins, elevation
   changes, tunnels.
3. Opponent grid is missing or insufficient.
4. Turn physics make the player car translate across the road instead
   of fighting through a banked corner.
5. Roadside objects are wrongly proportioned.

## Iteration 1 - pain point #1 diagnosed

### Diagnosis (one paragraph)

Every one of the 32 production tracks under `src/data/tracks/*.json`
ships with `"laps": 1`, so the player's actual race time is one
1500-2600 m straight-shot of driving (roughly 30-50 s at competitive
pace). The §7 lap targets (4-5 / 3 / 2 / 2-3 laps depending on
archetype) and the §9 50-150 s lap-time targets are intact in the
GDD; the engine wires `Track.laps` through `raceState.totalLaps`,
the lap rollover at `src/game/raceSession.ts:1703`, the §7 fastest-lap
bonus, and the results builder. The miss is data, not engine.

### Top 3 slices (in order)

#### Slice 1 - Bump production track laps to §7 archetype targets

- Dot: `VibeGear2-implement-bump-prod-076ae7e7`.
- Depends on: `VibeGear2-implement-classify-tracks-b41307c8` (the
  archetype field).
- Rationale - biggest fun-factor return per unit of risk: this is a
  pure data slice that flips every production race from a 30-50 s
  sprint into a 2-5 minute race window, which is the headline pain
  point. The engine, AI, rewards, and §15 personality model all
  unlock their intended texture only across multiple laps, so this
  slice is also a multiplier on every previous P1 polish slice. Risk
  is bounded - revertible by a single PR.
- GDD sections touched: §7 lap structure, §9 lap-time targets, §24
  content plan.
- Q-NNN blocking: Q-013 (per-track archetype mapping) - recommended
  default landed, so the slice is unblocked.

#### Slice 2 - Classify tracks by archetype

- Dot: `VibeGear2-implement-classify-tracks-b41307c8`.
- Depends on: nothing.
- Rationale - foundation slice for slice 1 and for the future §9
  authoring lint. Adds a single enum field with a non-breaking default,
  so it ships independently of any feel work and unblocks the lap
  bump.
- GDD sections touched: §9 track design (build log), §22 data schemas.
- Q-NNN blocking: Q-013.

#### Slice 3 - Lap-rollover HUD moment

- Dot: `VibeGear2-implement-lap-rollover-7fcb891e`.
- Depends on: nothing strictly, but its value is unlocked by slice 1.
- Rationale - the visible "LAP 2 / 3" pulse is what makes a multi-lap
  race feel like progression instead of repetition. It is a small
  HUD slice that compounds with every multi-lap track. Without it,
  slice 1 ships a longer race that still feels like one continuous
  blob.
- GDD sections touched: §20 HUD, §18 sound and music (lap SFX cue).
- Q-NNN blocking: none.

### Deferred to future iterations

Pain points #2-#5 are surveyed below so the next research pass has a
short list to drill into. None have implementation dots yet; they are
each their own diagnosis cycle.

#### Pain point #2 - Real turns and elevation

Quick survey: track JSON `curve` values span -0.3 to +0.3, with most
production segments at 0 / +-0.04 / +-0.08. No segment ships a
+-0.5 hairpin or a sustained `grade` above 0.09. Tunnels exist on
4 production tracks (Hollow Crest, Rivet Tunnel, Afterglow Run, Prism
Cut). Velvet Coast (the onboarding tour) has zero tunnels. The §9
"Hairpin" and "Compound" curve grades are not represented in
production data.

Likely slices when the diagnosis lands:
- Authoring: extend `src/data/tracks/*.json` with §9 corner grades
  (Sweep / Medium / Sharp / Hairpin / Compound) and reshape at least
  one Velvet Coast track to ship a signature hairpin.
- Lint: enforce that every track ships at least one corner per the §9
  "one signature feature, one recovery zone, one high-speed gamble,
  one late-race tension section" anatomy.
- Renderer: confirm the segment projector behaves at hairpin curvature
  values (current data hasn't stressed it).

#### Pain point #3 - Opponent grid

Quick survey: every production track has `spawn.gridSlots: 12` and the
session reads it correctly, so the data and schema are aligned with
§7 "Default field size: 12". `src/game/aiGrid.ts` spawns
`gridSlots - 1 = 11` AI cars and lays them out across the road in
rows. The likely surface area for the user's "missing or insufficient
grid" complaint is rendering and AI personality:
- §7 says 12 cars on screen but the renderer's draw distance and
  sprite culling may be hiding the back rows from the player's view
  most of the race.
- §15 personality work is partial (`feat-ai-add-573f4cda` is open),
  so the grid that does spawn may read as homogeneous filler rather
  than a field of competitors.

Likely slices when the diagnosis lands:
- Renderer: verify all 11 AI cars are drawable simultaneously in
  `src/render/pseudoRoadCanvas.ts` and that the standings strip shows
  them.
- AI: ship `VibeGear2-feat-ai-add-573f4cda` (already pinned in the
  arcade racer priority stack).

#### Pain point #4 - Turn physics translate too fast

Quick read of `src/game/physics.ts:389-418`:

```
const yawDelta = steerInput * steerRate * dt * tractionScalar;
let lateralVelocity = yawDelta * nextSpeed;
const nextX = state.x + lateralVelocity;
```

`yawDelta` is rad-per-tick (`dt` is baked in). `lateralVelocity =
yawDelta * nextSpeed` is then in metres - a per-tick lateral
displacement masquerading as a velocity. At 60 m/s with full steer
input this evaluates to roughly 1.25 m per tick (so 75 m/s of effective
lateral motion at 60 Hz). `ROAD_WIDTH = 4.5 m`, so the player crosses
the entire drivable surface in about 60 ms. That matches the user's
description that "a turn feels like a translation, not a controlled
drift through a banked corner".

Likely slices when the diagnosis lands:
- Physics: rewrite the lateral integration so `lateralVelocity` is in
  m/s and the position update is `state.x + lateralVelocity * dt`.
  This bumps `PHYSICS_VERSION` and invalidates ghost replays;
  acceptable.
- Tuning: re-derive the §10 starter / mid / late steer-rate values so
  the new physics still hits the §10 "tight at low speed, expressive
  at high speed" feel goals.
- Tests: extend the physics fuzz test to assert "no full-road lateral
  cross under 0.5 s at 60 m/s with full steer".

#### Pain point #5 - Roadside prop scale

Quick read of `src/render/pseudoRoadCanvas.ts:304-316`:

```
sign_marker:  heightRoadFactor: 0.85
tree_pine:    heightRoadFactor: 1.35
fence_post:   heightRoadFactor: 0.50
rock_boulder: heightRoadFactor: 0.42
light_pole:   heightRoadFactor: 1.90
```

`heightRoadFactor` is a multiplier on the projected road *width* (full
diameter). Trees thus render at 1.35x the road's pixel width in
height, which is taller than the road is wide near the camera. Light
poles render at 1.9x. Both read as oversized props and break the
pseudo-3D illusion the user named as pain point #5.

Likely slices when the diagnosis lands:
- Renderer: re-derive `heightRoadFactor` from a real-world prop height
  divided by the §16 ROAD_WIDTH, then express it as a multiplier on
  road *full-diameter screen width* with the math made explicit.
- Tuning: adjust per-prop factors so trees ~0.6x, light poles ~0.85x,
  fences ~0.25x. Validate against §17 "asset resolution" guidance.
- Tests: add a renderer golden-image test for one Velvet Coast frame
  so the prop scale can't regress silently.

### Backlog of research dots needed

Each future iteration of this research loop should produce one of the
following research dots (and the implementation slices it spawns):

- `research: Top Gear feel pain point #2 - real turns and elevation`
- `research: Top Gear feel pain point #3 - opponent grid density and readability`
- `research: Top Gear feel pain point #4 - lateral velocity bug and steer feel`
- `research: Top Gear feel pain point #5 - roadside prop scale`

Pain point #4 is the highest-leverage of the deferred set because it
is a single-line bug fix that changes the felt skill ceiling of every
race; expect it to overtake slices 1-3 in the next plan revision once
diagnosed.

## Iteration 2 - pain point #2 diagnosed

### Diagnosis (numbers)

Sampled all 32 production track JSONs under `src/data/tracks/*.json`
(215 authored segments total):

- `|curve|` max across the entire production set is **0.220**.
  Schema cap is 1.0 (`src/data/schemas.ts:147`). The renderer and
  compiler accept the full range; data uses 22% of it.
- `|grade|` max is **0.080**. Schema cap is 0.3
  (`src/data/schemas.ts:148`). Data uses 27% of it.
- §9 corner grade buckets across 215 authored segments:
  - straight (|c| < 0.05): **71**
  - Sweep (0.05-0.15): **87**
  - Medium (0.15-0.30): **57**
  - Sharp (0.30-0.50): **0**
  - Hairpin (>= 0.50): **0**
- §9 elevation buckets:
  - flat (|g| < 0.02): **85**
  - mild crest (0.02-0.05): **110**
  - moderate (0.05-0.10): **20**
  - aggressive (>= 0.10): **0**
- Tunnel coverage: **4 of 32** tracks ship at least one tunnel
  segment (Hollow Crest, Rivet Tunnel, Afterglow Run, Prism Cut).
  **7 tunnel segments** total. Velvet Coast (onboarding) has 0.

### Schema vocabulary the engine accepts

- `TrackSegmentSchema` (`src/data/schemas.ts:145-156`):
  `curve` in [-1, 1], `grade` in [-0.3, 0.3], optional `inTunnel`
  bool, optional `tunnelMaterial` slug. No `bank`, no `camber`.
- `compileTrack` (`src/road/trackCompiler.ts:130-312`) divides
  authored `curve` by `CURVATURE_SCALE = 100` and multiplies
  `grade` by `SEGMENT_LENGTH = 6` so the projector can sum dx and
  dy directly.
- `segmentProjector.project`
  (`src/road/segmentProjector.ts:92-203`) walks a 300-segment
  window forward, accumulates dx and dy in a bounded local hill
  window, and applies a maxY cull for crest occlusion. The
  projector handles the full schema range cleanly.
- `tunnelRenderer.drawTunnelAdaptation`
  (`src/render/tunnelRenderer.ts`, called from
  `src/render/pseudoRoadCanvas.ts:457`) paints the dark adaptation
  gradient on `inTunnel` strips. Renderer is wired; data does not
  exercise it.

### Engine-vs-data verdict

- Sharp and Hairpin corners (|curve| 0.30-0.85): **engine ready,
  data missing.** Schema, compiler, and projector all accept the
  range; the projector has a packed-hairpin authoring warning at
  |curve| > 0.6 with combined len < 80 m. No production track
  ships a single Sharp corner.
- S-curves (Compound runs of two adjacent grades): **engine
  ready, data missing.** Production data tends to space curves
  across 200 m+ straights between them, killing the §9 "linked
  grades" anatomy.
- Aggressive crests (|grade| >= 0.10): **engine ready, data
  missing.** The projector's local-window blend handles strong
  grade reversals without horizon pops.
- Tunnels: **engine ready, data sparse.** 4/32 tracks; Velvet
  Coast (the onboarding tour) has zero.
- Banked corners: **engine and schema both miss.** Filed as
  F-082; not on the iter-2 critical path because content reshape
  alone closes most of pain point #2.

### Top Gear 2 reference cornering archetypes

§3 already pins the broad TG2 lessons. For pain point #2
specifically the relevant archetypes are: long sweeping bends on
desert and coastal stages (maps to §9 Sweep, already in the data),
tight urban hairpins on European tracks (maps to §9 Hairpin, NOT
in the data), banked tunnel exits on the Switzerland/Germany
stages (maps to §9 Hairpin + tunnel; data ships neither), and
crest-then-corner reveals on Scandinavia/India (maps to §9
aggressive crest into Medium, NOT in the data). The schema we
already have covers four of those five archetypes verbatim. Only
banking sits outside it.

### Slices filed this iteration

- `VibeGear2-implement-re-author-47323741` - re-author the 32
  production track JSONs to exercise the full §9 corner-grade and
  elevation vocabulary per region tier. CONTENT-ONLY slice.
  `after:` the iter-1 lap-bump
  (`VibeGear2-implement-bump-prod-076ae7e7`) so the geometry and
  pacing slices ship in the right order.
- `VibeGear2-implement-9-track-e22793ca` - add a §9 track-anatomy
  lint to the content-lint pipeline so the re-authored geometry
  cannot regress silently. `after:` the re-author slice.

### Open questions filed

- Q-014: §9 corner-grade frequency budget per track length.
  Recommended default lands a per-length budget so the re-author
  slice is unblocked.

### Followups filed

- F-082: renderer support for road camber and banked corners
  (engine extension, deferred behind the content slice).
- F-083: renderer golden-image regression test for the re-authored
  tracks (lands after the re-author slice).

### Top-3 update

The original "Top 3 slices" block above is preserved. With the
iter-2 evidence in, the working order through the next two
iterations becomes:

1. `VibeGear2-implement-classify-tracks-b41307c8` (iter-1, ready).
2. `VibeGear2-implement-bump-prod-076ae7e7` (iter-1, blocked on 1).
3. `VibeGear2-implement-re-author-47323741` (iter-2, blocked on 2).
4. `VibeGear2-implement-lap-rollover-7fcb891e` (iter-1, parallel).
5. `VibeGear2-implement-9-track-e22793ca` (iter-2, blocked on 3).

Pain point #4 (the lateral-velocity bug) is still expected to
overtake this list once diagnosed because it is a one-line physics
fix that changes the felt skill ceiling of every race; the iter-2
re-author slice still ships first because it is purely content and
runs in parallel with any physics work.

## Iteration 3 - pain point #3 diagnosed

### Diagnosis (numbers)

Walked the spawn pipeline and the renderer cull. Three independent
gaps make the field "feel missing or insufficient" today:

#### Gap A. Quick Race ships a 2-car field

`resolveRaceAIDrivers` at `src/app/race/page.tsx:672` returns
`AI_DRIVERS.slice(0, 1)` when `tourContext === null`. Every entry
into the race route that is not a championship-tour link
(Quick Race menu, Time Trial without ghost, Practice mode) hits
this branch. The track JSON declares `spawn.gridSlots: 12` on all
32 production tracks; `spawnGrid` ignores `gridSlots` and just
reads the supplied roster, so the field is **2 cars (player + 1
AI)** in Quick Race, not 12. Tour mode reads
`tour.aiDrivers` (11 entries per tour in
`src/data/championships/world-tour-standard.json`) and ships the
intended 12-car field.

#### Gap B. Starting grid is stacked into 15 m of depth

`spawnGrid` (`src/game/aiGrid.ts:31-58`) places AIs at
`startZ = -row * rowSpacingMeters` with `row = floor(index / laneCount) + 1`
and `DEFAULT_ROW_SPACING_METERS = 5`. With `laneCount = 3` (every
production track) and 11 AIs the rows are 1, 2, 3, 4, so all 11
cars land between `z = -5 m` and `z = -20 m` (a 15 m window
behind the player). `raceSession.ts:781-787` then redundantly
sets `z = -(5 + index * 5)` before being overridden by
`entry.initial.z`, so the truth is 15 m of depth across 4 rows
of 3 cars. Top Gear 2's reference grid stretches the pack across
the full start straight (~80-120 m) so the player can see the
entire field at the lights.

#### Gap C. Renderer culls anything past 200 m

`projectOpponentCar` at `src/app/race/page.tsx:702-778` returns
`null` when `depthMeters > 200`. There is also a hard width floor
(`AI_MIN_PROJECTED_WIDTH_DESKTOP = 20` px,
`AI_MIN_PROJECTED_WIDTH_MOBILE = 12` px) that culls under-sized
sprites. Once the iter-1 lap-bump lands and races run 2-5 minutes
across multiple laps, the field will routinely stretch past 200 m;
mid-pack the player will see only the rival immediately in front
or behind, never the leaders or trailers. The §16 segment
projector itself draws to 600 m+, so 200 m for opponent sprites
is a renderer-imposed clamp, not a projector limit.

#### AI archetype variety: already wired

`src/game/aiArchetypes.ts` ships all six §15 archetypes
(`nitro_burst`, `clean_line`, `aggressive`, `defender`,
`wet_specialist`, `endurance`) with distinct behaviour rows
(`targetSpeedScalar`, `curveBrakeScalar`, `racingLineScalar`,
`mistakeScalar`, `recoveryScalar`, `launchPaceBonus`,
`fadePacePenalty`, `lowVisibilityBrakeScalar`, `brilliantChance`,
`brilliantPaceBonus`, `trafficLanePressure`). `tickAI` consumes
each row and the readability cue ladder
(`readabilityCueFor`) emits per-archetype telemetry tags. The
20-driver content roster under `src/data/ai/` covers each
archetype with at least 3 drivers (4 nitro_burst, 4 clean_line,
3 aggressive, 3 defender, 3 wet_specialist, 3 endurance). So
the archetype layer is engine-and-content complete; the gap is
not personality, it is grid density and visibility.

What is still partial in §15 (filed as F-084 / F-085 follow-ups):
inter-AI overtake decisions (today only AI-vs-player overtake
fires) and AI-vs-AI mild rubber-band lead compression. Both are
deferred behind the iter-3 grid slices because mid-pack churn
cannot read on screen until the grid renders past 200 m.

### Top Gear 2 reference

20 cars on the grid stretched across the start straight; the
whole pack visible at race start; the player fights up from the
back; near the end of a 2-minute race the player is mid-pack
and can SEE both the leaders and the trailers. §7 explicitly
chose 12 instead of 20 because of "browser readability and
solo-dev AI scope". The iter-3 evidence says the bottleneck is
not a render budget, it is the cull threshold and the start-line
formation.

### Slices filed this iteration

Three implementation dots filed in dependency order:

- `VibeGear2-implement-quick-race-78084a95` - Quick Race (and
  Time Trial / Practice) honour `track.spawn.gridSlots` so the
  non-tour entry path fields the same 12-car §7 grid that Tour
  mode does. CONTENT-AND-WIRING slice. `after:` the iter-1
  lap-bump (`VibeGear2-implement-bump-prod-076ae7e7`) so the
  longer race window is the natural place to feel the larger
  pack.
- `VibeGear2-implement-stretch-the-be459bc4` - bump the grid
  formation so 11 AIs stretch across ~80-120 m of start straight
  instead of 15 m. ENGINE TUNING + DATA slice. `after:` the
  Quick Race grid-density slice so the formation stretch is
  visible in non-tour modes too.
- `VibeGear2-implement-lift-opponent-8764ce5e` - move the
  opponent draw cull from 200 m to 600 m with an alpha fade
  between 400-600 m, plus a render test that catches a
  re-clamp regression. RENDERER slice. `after:` the Quick Race
  grid-density slice.

### Open questions filed

- Q-015: Quick Race opponent count and pack-stretch limits.
  Recommended default unblocks all three iter-3 slices: Quick
  Race honours `gridSlots`, default field size stays at 12 for
  now, opponent draw distance moves to 600 m with alpha fade.

### Followups filed

- F-084: AI rubber-band lead compression for visible mid-pack
  churn. Land after the iter-3 grid slices so the visible
  effect is observable on screen.
- F-085: Late-race overtake decisions and racing-line overtake
  awareness for AI-vs-AI passing. Land after the iter-3 grid
  slices so mid-pack movement is observable from the player's
  car.

### Top-3 update

The top-3 ordering above evolves again. With the iter-3 evidence
in, the working order through the next three iterations becomes:

1. `VibeGear2-implement-classify-tracks-b41307c8` (iter-1, ready).
2. `VibeGear2-implement-bump-prod-076ae7e7` (iter-1, blocked on 1).
3. `VibeGear2-implement-quick-race-78084a95` (iter-3, blocked on 2).
4. `VibeGear2-implement-stretch-the-be459bc4` (iter-3, blocked on 3).
5. `VibeGear2-implement-lift-opponent-8764ce5e` (iter-3, blocked on 3).
6. `VibeGear2-implement-re-author-47323741` (iter-2, blocked on 2).
7. `VibeGear2-implement-lap-rollover-7fcb891e` (iter-1, parallel).
8. `VibeGear2-implement-9-track-e22793ca` (iter-2, blocked on 6).

The Quick Race grid-density slice jumps to position 3 because it
is the highest-leverage single line change in the entire plan
(replaces an `.slice(0, 1)` with `.slice(0, gridSlots - 1)`) and
unlocks the visible value of every other §7 / §15 / §20 system
that already ships. Pain point #4 (the lateral-velocity bug) is
still expected to overtake this list once diagnosed, because it
is a one-line physics fix that changes the felt skill ceiling of
every race; the iter-3 grid slice still ships first because it is
mode-wiring and runs in parallel with any physics work.

## Iteration 4 - pain point #4 diagnosed

### Diagnosis (numbers)

Read `src/game/physics.ts` line by line. The lateral integration ends
at lines 401-418:

```
const yawDelta = steerInput * steerRate * dt * tractionScalar;   // L402
let lateralVelocity = yawDelta * nextSpeed;                       // L405
lateralVelocity = lateralVelocity * (1 - steeringAssistScale);    // L417
const nextX = state.x + lateralVelocity;                          // L418
```

The variable `yawDelta` already has `dt` baked in (rad per tick). The
product `yawDelta * nextSpeed` therefore has units `rad * m/s = m/s` and
is correctly named `lateralVelocity`. The bug is on the next line:
`state.x + lateralVelocity` adds a velocity (m/s) directly to a position
(m) without integrating over `dt`. Equivalently: the line treats
`lateralVelocity` as a per-tick displacement, so the displacement-per-
tick equals the m/s value. At 60 Hz that is 60x too much lateral motion
per second.

#### Plain-physics derivation

For steer input `s in [-1, 1]`, forward speed `v` in m/s, time step
`dt` in seconds, traction scalar `T`, steerRate band `r(v)`:

- yaw rate (rad/s) = `r(v) * s * T`
- yaw delta over dt (rad) = `r(v) * s * T * dt` (matches §10 verbatim)
- lateral velocity at this instant (m/s) = `yawRate * v = r(v) * s * T * v`
- correct displacement over dt (m) = `lateralVelocity * dt =
  r(v) * s * T * v * dt`

The current code computes `yawDelta * v = r(v) * s * T * dt * v` and
adds it directly to `x`. That is a displacement of
`r(v) * s * T * v * dt` per tick, but the time interval over which it
applies is `dt`, so the IMPLIED velocity is
`(r(v) * s * T * v * dt) / dt = r(v) * s * T * v` per second. Compare
to the physical lateral velocity `r(v) * s * T * v * dt` per second
(once heading state is added back in for a proper bicycle model, the
`* dt` factor falls out as the first-order linearization of
`v * sin(heading)` for a heading that builds up over time). The result:
the code applies the lateral velocity as if `dt = 1 second`, regardless
of frame rate.

The minimum correct fix is the literal line change:

```
const nextX = state.x + lateralVelocity * dt;
```

#### Time-to-cross numbers

`ROAD_WIDTH = 4.5` (`src/road/constants.ts:14`) is the half-width;
the drivable surface spans `[-4.5, +4.5]` for total 9 m. Using the
Sparrow GT starter (`baseStats.topSpeed = 61`,
`baseStats.gripDry = 1.0` from §23) at full steer with
`steerRateHigh = 1.25 rad/s`:

| Speed | Steer | Code today (per tick) | Code today (per s) | Time to cross 4.5 m | Top Gear 2 reference |
| --- | --- | --- | --- | --- | --- |
| 5 m/s | 1.0 | 0.192 m | 11.5 m/s | 0.39 s | ~1.5 s |
| 30 m/s | 1.0 | 0.658 m | 39.5 m/s | 0.114 s | ~1.5 s |
| 61 m/s | 1.0 | 1.27 m | 76.2 m/s | 0.059 s | ~1.5 s |

After the surgical fix (`+ lateralVelocity * dt`):

| Speed | Steer | Per-tick displacement | Per-s lateral velocity | Time to cross 4.5 m |
| --- | --- | --- | --- | --- |
| 5 m/s | 1.0 | 0.0032 m | 0.19 m/s | 23.6 s |
| 30 m/s | 1.0 | 0.0110 m | 0.66 m/s | 6.8 s |
| 61 m/s | 1.0 | 0.0212 m | 1.27 m/s | 3.5 s |

The post-fix top-speed crossing time (3.5 s) is too slow vs the
~1.5 s TG2 reference. That confirms two things:

1. The surgical fix lands the code in the right order of magnitude,
   removing the 60x over-shoot.
2. The §10 starter steer-rate constants (low 2.3 / high 1.25 rad/s)
   were authored to read correctly on a buggy integrator that ran
   60x hot, so the cornering tuning slice has to re-pin them once
   the integrator is correct. A factor-of-2 lift on `steerRateHigh`
   (`1.25 -> 2.5 rad/s`) restores ~1.7 s top-speed cross which is
   inside the TG2 band, but is a tuning judgement that wants
   playtest evidence in the cornering-tuning slice.

#### §10 quotes

§10 "Steering model" pins the formula verbatim:

> ```
> steerRate = lerp(steerRateLow, steerRateHigh, speedNorm)
> yawDelta = steerInput * steerRate * dt * tractionScalar
> ```

§10 "Steering model" desired behaviour:

> - Low speed: tight, confident rotation.
> - Mid speed: stable but expressive.
> - High speed: enough authority to place the car, not enough to
>   zig-zag unrealistically.

§10 says nothing about how `yawDelta` becomes lateral motion. The
current code's fork-in-the-road interpretation ("lateralVelocity =
yawDelta * nextSpeed; nextX = state.x + lateralVelocity") only matches
§10's intent if the integration step is multiplied by `dt`. Today it is
not. §10's "max lateral acceleration" / "g-load" is also silent;
filed as Q-016.

#### Other physics gaps surfaced during the read

1. **No g-load cap.** The integrator allows `lateralVelocity` to
   spike to `yawRate * topSpeed` within one tick (~2.6 g
   instantaneously even after the surgical fix). Real tyres saturate
   around 1.0-1.1 g; arcade targets sit ~1.2 g. Filed as the
   racing-line tension slice with Q-016 defaults.
2. **No centripetal coupling.** When the road curves
   (`CompiledSegment.curve`), the player car does not feel an
   outward push proportional to `v^2 / r`. The renderer projects
   curvature, but the physics step never reads it. The car can be
   driven through a 0.22 curve at top speed without any lateral bias,
   so the player feels they steer in vacuum. Out of scope for the
   surgical fix; the racing-line tension slice handles part of this
   indirectly via the over-cap scrub when the player demands more
   lateral acceleration than grip allows.
3. **No understeer at high speed.** §10 "Mild lateral slip appears
   at high steer + high speed" is not implemented; once the cap
   lands, the over-cap scrub term is the smallest correct slice.
4. **No banking response.** Schema has no `bank` field (F-082).
   F-086 lifts the cap once F-082 ships.
5. **Heading state.** The state shape (`CarState`) has no `heading`
   field. The lateral integration linearizes around heading=0 each
   tick, which is the same simplification arcade pseudo-3D racers
   ship with; full bicycle / yaw modelling is out of scope.

#### Tests that would have caught this

The existing physics test file
(`src/game/__tests__/physics.test.ts`) has six steering tests but
each one only asserts a sign or a relative ordering (e.g. "steers
right at moderate speed", "lower weather grip reduces lateral
authority"). None of them pin the absolute magnitude of `state.x`
after a tick or assert that lateral displacement scales linearly with
`dt`. A single test of the form

```ts
it("at top speed full steer crosses 4.5m road in >= 2s", () => {
  const start = freshState({ speed: STARTER_STATS.topSpeed });
  let s = start;
  for (let i = 0; i < 60 * 2; i++) {
    s = step(s, withInput({ steer: 1 }), STARTER_STATS, ROAD, 1 / 60);
  }
  expect(s.x).toBeLessThan(ROAD.roadHalfWidth);
});
```

would have failed since iteration 1 of the engine. Add it as part
of the surgical fix slice.

### Slices filed this iteration

- `VibeGear2-implement-fix-lateral-b2503f6f` - surgical fix to the
  lateral integration unit error. One-line src diff (`+ lateralVelocity
  * dt` on `physics.ts:418`) plus the new pinning unit tests and a
  Playwright spec. Bumps `PHYSICS_VERSION` 3 -> 4 (invalidates v3
  ghost replays per the existing pattern at `physics.ts:103`). NO
  `after:` because the bug is dimensional and lands without any
  prerequisite content or tuning work.
- `VibeGear2-implement-cornering-tuning-62491aea` - cornering tuning
  pass that re-pins the §10 starter / mid / late steer-rate band and
  the §23 per-car `gripDry` numbers against the corrected integrator
  feel. `after:` `VibeGear2-implement-fix-lateral-b2503f6f` because
  the tuning is dimensional-only after the bug is gone.
- `VibeGear2-implement-racing-line-7b2cbd41` - racing-line tension
  slice. Adds `MAX_LATERAL_ACCEL_M_PER_S2 = 12` cap and a quadratic
  understeer scrub so hairpins must be braked into. `after:`
  `VibeGear2-implement-cornering-tuning-62491aea` AND
  `VibeGear2-implement-re-author-47323741` so the §9 hairpin geometry
  exists to feel the cap.

### Open questions filed

- Q-016: max lateral acceleration cap, understeer onset, and banking
  response for the §10 racing-line slice. Recommended default
  (`MAX_LATERAL_ACCEL_M_PER_S2 = 12`, quadratic scrub
  `UNDERSTEER_SCRUB_K = 6 m/s^2`, banking deferred to F-086) unblocks
  the iter-4 racing-line tension slice.

### Followups filed

- F-086: banked-corner cap lift; lands after F-082 (per-segment
  banking schema + renderer).

### Top-3 update

The original "Top 3 slices" block at the top of this document is
preserved. With the iter-4 evidence in, the working order through the
next four iterations becomes:

1. `VibeGear2-implement-fix-lateral-b2503f6f` (iter-4, ready, ONE-LINE
   FIX). Promoted to position 1 because it is a one-line diff that
   changes the felt skill ceiling of every race.
2. `VibeGear2-implement-classify-tracks-b41307c8` (iter-1, ready).
3. `VibeGear2-implement-bump-prod-076ae7e7` (iter-1, blocked on 2).
4. `VibeGear2-implement-quick-race-78084a95` (iter-3, blocked on 3).
5. `VibeGear2-implement-stretch-the-be459bc4` (iter-3, blocked on 4).
6. `VibeGear2-implement-lift-opponent-8764ce5e` (iter-3, blocked on 4).
7. `VibeGear2-implement-re-author-47323741` (iter-2, blocked on 3).
8. `VibeGear2-implement-cornering-tuning-62491aea` (iter-4, blocked on 1).
9. `VibeGear2-implement-lap-rollover-7fcb891e` (iter-1, parallel).
10. `VibeGear2-implement-9-track-e22793ca` (iter-2, blocked on 7).
11. `VibeGear2-implement-racing-line-7b2cbd41` (iter-4, blocked on 8 and 7).

The lateral-fix slice jumps to position 1: it is the smallest src
diff in the entire plan (a single `* dt` on a single line) and has no
content prerequisites. It is also the only slice that addresses pain
point #4 directly. The iter-1 ordering (1: classify, 2: bump-prod,
3: lap-rollover) survives behind it; the iter-3 grid slices keep
their relative position; the iter-2 re-author moves up so the
racing-line slice can land on the §9 hairpin geometry it needs.
After iter-4 the only deferred pain point is #5 (roadside prop
scale).

### How this plan changes per iteration

Each future research iteration appends a new section ("Iteration 2 -
pain point #2 diagnosed") below this one. The "Top 3 slices" block
above is updated only when the diagnosis evidence justifies a re-rank.
Old iteration sections stay in place to preserve the audit trail; that
is the same append-only discipline used in the four ledger files.
