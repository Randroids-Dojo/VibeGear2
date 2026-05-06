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

## Iteration 5 - pain point #5 diagnosed

### Diagnosis (numbers)

Walked the prop pipeline end to end. The current scale function lives
at `src/render/pseudoRoadCanvas.ts:304-316` (table) and
`pseudoRoadCanvas.ts:774-779` (use). Three independent things make
roadside props feel out of scale; the iter-1 quick read named one of
them but inverted the unit interpretation, so the conclusions need
correcting.

#### Correction to iter-1 quick read

Iter-1 said "trees render at 1.35x the road's pixel width in height,
which is taller than the road is wide near the camera". That read
treated `strip.screenW` as the FULL projected road width. It is the
HALF-width. `segmentProjector.ts:167` builds
`screenW = scale * ROAD_WIDTH * halfW`, where `ROAD_WIDTH = 4.5`
(the half-width of the drivable surface, per
`src/road/constants.ts:14`) and `halfW` is half the canvas width. The
strip drawer paints road trapezoids using `nearX +/- nearHalfW = screenX
+/- screenW`, so the road occupies `2 * screenW` pixels horizontally.
A `heightRoadFactor` of `f` therefore renders the prop at
`f / 2` of the road's full screen-width in height. Iter-1's
`heightRoadFactor: 1.35` for trees is 67.5% of full road width, not
135%. The implication: in pure ratio terms, current trees render
SHORTER than full road width, not taller.

#### Gap A. Per-kind ratios versus physical reality

Each `heightRoadFactor` corresponds to an implied physical prop
height in metres of `factor * ROAD_WIDTH = factor * 4.5`. Holding the
player car (~1.5 m visible) and lane (~3 m wide) as anchors:

| Prop id | factor | implied height (m) | physical target (m) | verdict |
| --- | --- | --- | --- | --- |
| `sign_marker` | 0.85 | 3.83 | 2.5 to 3.0 (highway sign) | slightly tall |
| `tree_pine` | 1.35 | 6.08 | 8 to 12 (mature pine) | too short |
| `fence_post` | 0.50 | 2.25 | 1.0 (post and rail) | 2x too tall |
| `rock_boulder` | 0.42 | 1.89 | 1.0 to 2.0 | OK |
| `light_pole` | 1.90 | 8.55 | 8 to 10 | OK |
| `palms_sparse` | 1.35 | 6.08 | 6 to 10 (palm) | OK to short |
| `marina_signs` | 0.85 | 3.83 | 2.5 to 4.0 (marina sign) | OK |
| `guardrail` | 0.50 | 2.25 | 0.7 (guardrail) | 3x too tall |
| `water_wall` | 0.42 | 1.89 | 1.0 (sea wall) | 2x too tall |
| `rock_spire` | 0.95 | 4.275 | 4 to 8 (spire) | OK to short |
| `heat_sign` | 0.80 | 3.60 | 3.0 (desert sign) | OK |

The two clear outliers are `fence_post` and `guardrail` at ~2x to 3x
the correct height. Anything else that reads as "wrongly proportioned"
is downstream of gap B (the maxHeight clamp).

#### Gap B. The `ROADSIDE_MAX_HEIGHT_FRACTION = 0.22` clamp dominates the near field

`pseudoRoadCanvas.ts:96`: `ROADSIDE_MAX_HEIGHT_FRACTION = 0.22`.
`pseudoRoadCanvas.ts:774-778`:

```
const maxHeight = viewport.height * ROADSIDE_MAX_HEIGHT_FRACTION;
const height = Math.max(
  style.minHeight,
  Math.min(maxHeight, strip.screenW * style.heightRoadFactor * SPRITE_BASE_SCALE),
);
```

A prop hits the maxHeight clamp at 22% viewport height once
`strip.screenW * heightRoadFactor >= viewport.height * 0.22`. Solving
for the road's projected half-width: `strip.screenW >=
viewport.height * 0.22 / heightRoadFactor`. For an 800x480 canvas
(`viewport.height = 480`) and `heightRoadFactor = 1.35` (tree),
strip.screenW >= 78 px clamp-engages at scale = 78/(4.5*400) = 0.0433,
so z = camera.depth/scale = 0.839/0.0433 = 19.4 m. For
`heightRoadFactor = 1.90` (pole): clamp at z <= 27.4 m.

So every tree closer than ~20 m and every pole closer than ~27 m draws
at exactly 22% of viewport height (105.6 px on an 800x480 canvas).
PLAYER_CAR_HEIGHT_FRACTION (`pseudoRoadCanvas.ts:92`) is 0.18, so the
player car renders at 86.4 px tall. In other words, every roadside
tree and pole within ~25 m of the camera draws TALLER on screen than
the player car. This is the dominant visual reading of "props feel
oversized": they are clamped at a fraction (22%) that exceeds the
player car's fixed fraction (18%).

The 22% number is also the test pin
(`pseudoRoadCanvas.test.ts:980`): `expect(draws[0]!.dh).toBeCloseTo(
VIEWPORT.height * 0.22, 6)`. So the maxHeight clamp is load-bearing
on the existing renderer test surface.

#### Gap C. Procedural fallback shapes are what the live route renders

`src/app/race/page.tsx` does not pass any `roadsideAtlas` to
`drawRoad`. (Confirmed by `grep -n roadsideAtlas
src/app/race/page.tsx`: zero matches.) The atlas image
`public/art/roadside/temperate.svg` and the per-region SVG files under
`public/art/roadside/<region>/*.svg` are loaded only on `/dev/road`
(`src/app/dev/road/page.tsx:15-77`). The live race renderer therefore
falls through `drawRoadsideAtlasSprite` (returns false because
`roadsideAtlas?.atlas.image` is undefined) and paints the procedural
shapes `drawTreeSprite`, `drawSignSprite`, `drawFenceSprite`,
`drawRockSprite`, `drawPoleSprite` (`pseudoRoadCanvas.ts:803-819`). The
"asset vs scale function" question therefore resolves to: the SCALE
FUNCTION is what users see in production, the ASSETS only show on
`/dev/road`. The fix is code-only.

#### Gap D. Prop placement is too close to the road

`pseudoRoadCanvas.ts:781`:
`const baseX = strip.screenX + sideSign * strip.screenW * 1.32;`

Props sit at 1.32 road-half-widths from the road centerline, which is
0.32 road-half-widths past the road edge (rumble strip). In meters
that is 4.5 * 0.32 = 1.44 m off the rumble. Real trees and poles sit
5 to 15 m off the shoulder. Closer placement makes a correctly-sized
tree look bigger than it would at a realistic offset. This is a
secondary contributor to the "props feel large" reading. Bumping
the offset to 1.7 to 2.0 of strip.screenW (i.e. 0.7 to 1.0 road half-
widths past the edge, 3.15 to 4.5 m off the rumble) is a small tuning
knob inside the calibration slice.

#### Schema verdict

`TrackSegmentSchema` (`src/data/schemas.ts:145-156`) carries
`roadsideLeft` and `roadsideRight` as string ids. There is no
physical-height field on the segment schema or on the
`ROADSIDE_SPRITE_STYLES` table itself. Prop physical height is
implicit in `heightRoadFactor` (multiplier on `strip.screenW`, which
is half the road width in pixels). For the calibration slice this is
fine. If a future slice wants real perspective, the cleanest
extension is to add an explicit `heightMeters` field to the renderer
table (NOT to the per-track JSON) and derive `heightRoadFactor =
heightMeters / ROAD_WIDTH` at draw time. That is the second slice
filed below.

#### Per-region differences

`public/art/roadside/<region>/` ships per-region SVGs (slim-tree,
wide-tree, low-building, tower-building, long-rail, short-rail, etc.)
but `src/data/atlas/roadside.json` only registers the global
`temperate.svg`. The renderer never sees the per-region SVGs in
production. So no region's PROP ART is broken differently; the
diagnosis converges back to gap A and gap B for every region.

#### Top Gear 2 reference

A roadside tree should never visually exceed the height of an
overpass. Light poles should look like light poles, not building-tall
pillars. The car's silhouette should fit comfortably under tunnel
arches and behind trees. Today gap B inverts this: every nearby tree
and pole is taller than the player car, breaking the depth cue. The
fix is to:

1. Drop `ROADSIDE_MAX_HEIGHT_FRACTION` from 0.22 to 0.18 so close-in
   props at most match the player car silhouette.
2. Tune per-kind `heightRoadFactor` to physical targets so the far
   field also reads correctly. `pine 1.35 -> 2.22` (10 m), `pole 1.90
   -> 2.00` (9 m), `sign 0.85 -> 0.67` (3 m), `fence 0.50 -> 0.16`
   (0.7 m guardrail; this is the worst current outlier), `boulder
   0.42 -> 0.33` (1.5 m), `palm 1.35 -> 1.78` (8 m), `rock_spire 0.95
   -> 1.33` (6 m), `water_wall 0.42 -> 0.22` (1 m), `marina_signs
   0.85 -> 0.78` (3.5 m), `heat_sign 0.80 -> 0.67` (3 m).
3. Bump prop placement to 1.7x strip.screenW so trees do not cling
   to the rumble strip.
4. Add a unit test pinning per-kind px-height at z=10, z=50, z=200 on
   an 800x480 canvas, plus a Playwright golden-image of a fixed
   `/dev/road` pose.

### Slices filed this iteration

- `VibeGear2-implement-calibrate-roadside-96e24f40` - calibrate
  roadside prop scale function. Touches
  `src/render/pseudoRoadCanvas.ts` only: rewrites
  `ROADSIDE_SPRITE_STYLES` per the table above, drops
  `ROADSIDE_MAX_HEIGHT_FRACTION` to 0.18, lifts the prop offset
  multiplier from 1.32 to 1.7. Adds an `assertPropScaleAt(z)`
  unit test (Vitest) that pins the px-height per kind at z=10, z=50,
  z=200 on an 800x480 canvas. Adds a Playwright golden-image at
  `/dev/road` for a fixed Velvet Coast pose. Updates the existing
  `dh ~= VIEWPORT.height * 0.22` test pin to the new 0.18 fraction.
  NO `after:` because the slice is renderer-only and ships
  independently of the iter 1 to 4 dependency chain. Pain point #5
  closes when this slice merges.
- `VibeGear2-implement-extend-roadside-e541c8a5` - prop schema
  migration. Promotes `ROADSIDE_SPRITE_STYLES` from `{kind,
  widthToHeight, heightRoadFactor, minHeight}` to `{kind,
  widthToHeight, heightMeters, minHeight}` and derives
  `heightRoadFactor = heightMeters / ROAD_WIDTH` at draw time. Pure
  refactor; the calibration values from the previous slice carry
  over verbatim. `after:`
  `VibeGear2-implement-calibrate-roadside-96e24f40` so the schema
  migration ships on top of correct numbers, not on top of the
  current ones. Optional polish; lower priority than the
  calibration slice.

### Open questions filed

- Q-017: per-kind physical heights (target metres for `tree_pine`,
  `light_pole`, `sign_marker`, `fence_post`, `rock_boulder`,
  `palms_sparse`, `marina_signs`, `guardrail`, `water_wall`,
  `rock_spire`, `heat_sign`) and the `ROADSIDE_MAX_HEIGHT_FRACTION`
  cap. Recommended defaults (pine 10 m, pole 9 m, sign 3 m,
  guardrail 0.7 m, boulder 1.5 m, palm 8 m, marina 3.5 m, water 1 m,
  rock spire 6 m, heat sign 3 m, fence 0.7 m, max fraction 0.18)
  unblock the calibration slice.

### Followups filed

None new. F-052 (parallax horizon and roadside sprites) is closed
and references the procedural fallback shapes that the calibration
slice tunes. The per-region SVG art in `public/art/roadside/<region>/`
is not reachable from `/race` today; loading those atlases is a
later content slice but is OUT OF SCOPE for pain point #5 because
the procedural fallbacks are what users see in production.

### Top-3 update

The original "Top 3 slices" block at the top of this document is
preserved. With iter-5 evidence in, the working order through the
next several iterations becomes:

1. `VibeGear2-implement-fix-lateral-b2503f6f` (iter-4, ready,
   ONE-LINE FIX). Still position 1: smallest src diff, biggest
   feel-impact.
2. `VibeGear2-implement-calibrate-roadside-96e24f40` (iter-5, ready).
   Promoted to position 2 because the slice is renderer-only, has
   no `after:` chain, runs in parallel with the iter-1 to iter-4
   work, and closes pain point #5 in a single PR.
3. `VibeGear2-implement-classify-tracks-b41307c8` (iter-1, ready).
4. `VibeGear2-implement-bump-prod-076ae7e7` (iter-1, blocked on 3).
5. `VibeGear2-implement-quick-race-78084a95` (iter-3, blocked on 4).
6. `VibeGear2-implement-stretch-the-be459bc4` (iter-3, blocked on 5).
7. `VibeGear2-implement-lift-opponent-8764ce5e` (iter-3, blocked on 5).
8. `VibeGear2-implement-re-author-47323741` (iter-2, blocked on 4).
9. `VibeGear2-implement-cornering-tuning-62491aea` (iter-4,
   blocked on 1).
10. `VibeGear2-implement-lap-rollover-7fcb891e` (iter-1, parallel).
11. `VibeGear2-implement-9-track-e22793ca` (iter-2, blocked on 8).
12. `VibeGear2-implement-racing-line-7b2cbd41` (iter-4,
    blocked on 9 and 8).
13. `VibeGear2-implement-extend-roadside-e541c8a5` (iter-5,
    blocked on 2). Optional schema polish.

The calibration slice jumps to position 2 because it is the only
remaining pain-point-closer that ships standalone. After iter-5 all
five user-named pain points have at least one ready or near-ready
slice on the chart, and the loop can hand off to implement mode.

### Hand-off summary (all 5 pain points diagnosed)

The implement-mode loop should pick up work in this order:

**FIRST slice to land:** `VibeGear2-implement-fix-lateral-b2503f6f`
(pain point #4 surgical fix).

- Files touched (smallest possible src diff):
  - `src/game/physics.ts` line 418: change
    `const nextX = state.x + lateralVelocity;` to
    `const nextX = state.x + lateralVelocity * dt;`.
  - `src/game/physics.ts` line 103 area: bump `PHYSICS_VERSION`
    from 3 to 4 (invalidates v3 ghost replays per the documented
    pattern).
  - `src/game/__tests__/physics.test.ts`: add two pinning unit tests
    for the time-to-cross and the `dt` linearity.
  - One Playwright spec under `tests-e2e/` that drives a 2 s full-
    steer hold at top speed and asserts the player car does not
    leave the road.
- Verify steps:
  - `npm run test` (Vitest), watching for the new pinning tests.
  - `npm run test:e2e` (Playwright), watching the steer-hold spec.
  - `npm run content-lint` (must stay clean).
  - Manual smoke: load `/race`, hold full right at top speed,
    confirm the car drifts toward the rumble in ~3 s rather than
    ~0.06 s.
- Q-NNN gates: none. Q-016 (lateral cap) is for the racing-line
  slice that comes later; the surgical fix lands without it.

**SECOND slice to land:**
`VibeGear2-implement-calibrate-roadside-96e24f40` (pain point #5,
parallel-able with the lateral fix).

- Files touched (renderer only):
  - `src/render/pseudoRoadCanvas.ts` line 96: drop
    `ROADSIDE_MAX_HEIGHT_FRACTION = 0.22` to `0.18`.
  - `src/render/pseudoRoadCanvas.ts` lines 304-316: rewrite
    `ROADSIDE_SPRITE_STYLES` per the table in the iter-5 diagnosis:
    `tree_pine` 1.35 -> 2.22, `light_pole` 1.90 -> 2.00,
    `sign_marker` 0.85 -> 0.67, `fence_post` 0.50 -> 0.16,
    `rock_boulder` 0.42 -> 0.33, `palms_sparse` 1.35 -> 1.78,
    `marina_signs` 0.85 -> 0.78, `guardrail` 0.50 -> 0.16,
    `water_wall` 0.42 -> 0.22, `rock_spire` 0.95 -> 1.33,
    `heat_sign` 0.80 -> 0.67.
  - `src/render/pseudoRoadCanvas.ts` line 781: lift the prop offset
    from `strip.screenW * 1.32` to `strip.screenW * 1.7`.
  - `src/render/__tests__/pseudoRoadCanvas.test.ts` line 980: update
    the `dh ~= VIEWPORT.height * 0.22` pin to `0.18`. Add an
    `assertPropScaleAt(z)` test that pins per-kind px-height at
    z=10, z=50, z=200.
  - One Playwright golden-image under `tests-e2e/` for a fixed
    `/dev/road` pose on Velvet Coast.
- Verify steps:
  - `npm run test` (Vitest), watching the new px-height pin and the
    updated `dh` assertion.
  - `npm run test:e2e` (Playwright), capturing the new golden.
  - `npm run content-lint` (must stay clean).
  - Manual smoke: load `/dev/road`, scroll a few segments, confirm
    no tree or pole renders taller on screen than the player car
    sprite at any depth.
- Q-NNN gates: Q-017 (prop physical heights). Recommended default
  is pinned in the question entry; the slice ships against the
  default unless playtest overrides it.

After these two slices, all five pain points (1 laps, 2 turns, 3
grid, 4 lateral fix, 5 props) have a ready or near-ready slice in
the chart. The remaining work is the iter-1 / iter-2 / iter-3 chain
to flesh the world out around the now-correct physics and props.

## Iteration 6 - plan validation and hand-off readiness

### Cross-iteration consistency check

Walked iters 1-5 end to end against the dot graph and the open-question
defaults. Findings:

#### Inconsistency #1 (corrected this iteration). Frontmatter dependency edges silently dropped on four dots.

The repo-wide dot CLI honours `blocks:` only (not `after:`) per the
2026-04-26 audit `VibeGear2-research-audit-and-d5dbe8d7`. Iters 1 and 3
filed four dots whose dependency edges did not survive the parser:

- `VibeGear2-implement-bump-prod-076ae7e7` carried `after:
  VibeGear2-implement-classify-tracks-b41307c8` in front-matter. `dot
  ready` was treating it as ready before the iter-1 classify slice
  shipped.
- `VibeGear2-implement-quick-race-78084a95` named "After: bump-prod" in
  body text only; no `blocks:` entry.
- `VibeGear2-implement-stretch-the-be459bc4` named "After: quick-race"
  in body text only.
- `VibeGear2-implement-lift-opponent-8764ce5e` named "After: quick-race"
  in body text only.

Iter 6 fix: converted the bump-prod front-matter to `blocks:` and added
`blocks:` arrays to the three iter-3 dots. After the fix `dot ready`
returns exactly four truly-unblocked dots: `fix-lateral`,
`classify-tracks`, `lap-rollover`, `calibrate-roadside`. Every other
implement dot is correctly gated behind its predecessor.

#### Inconsistency #2 (cosmetic, not corrected). Iter-3 plan paragraph and the dot file disagree on which AI-grid file the slice touches.

The iter-3 plan paragraph (above) says the renderer cull is at
`src/app/race/page.tsx:702-778`, and the iter-3 dot file says the same.
Both are correct. No fix needed; flagging only because the surrounding
prose elsewhere refers to "the renderer" as if it lived under
`src/render/`. The implementor should expect the cull math to live in
the `/race` page module, not in `pseudoRoadCanvas.ts`.

#### Q-013 to Q-017 cross-check.

- Q-013 (per-track archetype mapping): 4 short-sprint, 16 standard, 8
  long-scenic, 4 endurance. Numbers reconcile with the §7 default lap
  curve; no conflict with Q-014.
- Q-014 (corner-grade frequency budget): every track gets at least 1
  Sharp or Hairpin per §9 anatomy. Reconciles with iter-2's pain-point
  framing ("every track gets a real turn").
- Q-015 (Quick Race opponent count): 12 cars total = 11 AIs. The
  600 m draw-distance default + 400-600 m alpha fade reconciles with
  Q-016 (the racing-line cap is unrelated, no conflict).
- Q-016 (max lateral acceleration): `MAX_LATERAL_ACCEL_M_PER_S2 = 12`
  for `gripDry = 1.0`. The post-fix top-speed crossing time of 3.5 s
  named in iter 4 is computed without the cap; once Q-016 lands the
  number lifts toward 1.5 s (the TG2 reference). Iter-4 named this
  explicitly; no conflict.
- Q-017 (prop physical heights): `heightMeters / ROAD_WIDTH = factor`
  reconciles with the iter-5 corrected interpretation of `screenW` as
  half-width. The `0.18` max-height clamp matches the player car's
  `PLAYER_CAR_HEIGHT_FRACTION`. No conflict.

All five Q-NNN entries are mutually consistent and ship with
recommended defaults that unblock the implement loop.

### Dot quality audit (per the iter-6 rubric)

Walked all 13 open `implement:` dots filed by iters 1-5. Spec-quality
verdict per dot:

- `VibeGear2-implement-fix-lateral-b2503f6f`: rubric-clean. Compact
  paragraph format but names the line number, the formula change, two
  unit tests by phrase, and a Playwright spec by file path. PASSES.
- `VibeGear2-implement-calibrate-roadside-96e24f40`: rubric-clean.
  Names every per-kind value, the clamp number, the unit test name
  (`assertPropScaleAt(z)`), and a Playwright golden frame target.
  PASSES.
- `VibeGear2-implement-classify-tracks-b41307c8`: full structured dot
  with Description / Context / Affected / Implementation / Verify
  sections. Names the schema test path. PASSES.
- `VibeGear2-implement-bump-prod-076ae7e7`: full structured dot.
  Front-matter `after:` was dead; converted to `blocks:` this
  iteration. PASSES post-fix.
- `VibeGear2-implement-lap-rollover-7fcb891e`: full structured dot.
  Names the moment classifier test, the renderer file, and an e2e
  assertion. PASSES.
- `VibeGear2-implement-re-author-47323741`: full structured dot. Names
  per-region targets, authoring guardrails, and content-lint as the
  verify gate. PASSES (no Playwright spec because the slice is content
  only and the golden-image test is filed under F-083 explicitly).
- `VibeGear2-implement-9-track-e22793ca`: full structured dot. Names
  the failing-fixture pattern as the verify gate. PASSES.
- `VibeGear2-implement-quick-race-78084a95`: compact paragraph; was
  missing an explicit Playwright spec name. Fixed this iteration: now
  names `tests-e2e/quick-race-grid-density.spec.ts` and a unit test
  phrase (`resolveRaceAIDrivers honours gridSlots in non-tour mode`).
  PASSES post-fix.
- `VibeGear2-implement-stretch-the-be459bc4`: compact paragraph; was
  missing an explicit Playwright spec name. Fixed this iteration: now
  names `tests-e2e/quick-race-grid-stretch.spec.ts` and a unit test
  phrase. PASSES post-fix.
- `VibeGear2-implement-lift-opponent-8764ce5e`: compact paragraph but
  already named `e2e/projection-readability.spec.ts`. PASSES.
- `VibeGear2-implement-cornering-tuning-62491aea`: compact paragraph
  but names two unit tests by phrase and a Playwright spec by path.
  PASSES.
- `VibeGear2-implement-racing-line-7b2cbd41`: compact paragraph but
  names two unit tests by phrase and a Playwright spec by path. PASSES.
- `VibeGear2-implement-extend-roadside-e541c8a5`: compact paragraph;
  was missing the Q-017 number anchor and the unit test phrase. Fixed
  this iteration: now quotes Q-017 defaults verbatim and names the
  unit test by phrase. PASSES post-fix.

All 13 implement dots clear the iter-6 rubric after the fixes above.

### Top-3 final ordering with rationale

The implement-mode loop should land the following three slices first.
Each row is what the implementor needs in their own context to start
work without re-reading this plan.

#### Slice #1 - `VibeGear2-implement-fix-lateral-b2503f6f`

- Files: `src/game/physics.ts:418` (one-line change), `src/game/physics.ts:103`
  area (PHYSICS_VERSION 3 -> 4 bump), `src/game/__tests__/physics.test.ts`,
  `tests-e2e/race-feel-lateral-pace.spec.ts` (new).
- Verify: `npx vitest run src/game/__tests__/physics.test.ts` plus
  the new Playwright spec. Two new unit tests: `at top speed full
  steer crosses 4.5m road in >= 2s` and `lateral displacement scales
  linearly with dt`.
- Q-NNN gate: none. Q-016 is for the racing-line slice that comes
  later.
- Estimated `src/` LOC delta: +1 src line (the `* dt`), +5 lines for
  PHYSICS_VERSION bump and any defensive comments, +30 lines for the
  two new pinning unit tests.
- Fun-factor return per LOC: highest in the entire plan. One-line src
  diff that changes the felt skill ceiling of every race for the rest
  of the project's life.

#### Slice #2 - `VibeGear2-implement-calibrate-roadside-96e24f40`

- Files: `src/render/pseudoRoadCanvas.ts:96` (clamp 0.22 -> 0.18),
  `pseudoRoadCanvas.ts:304-316` (`ROADSIDE_SPRITE_STYLES` table per
  Q-017 defaults), `pseudoRoadCanvas.ts:781` (offset 1.32 -> 1.7),
  `src/render/__tests__/pseudoRoadCanvas.test.ts:980` (update the
  `dh ~= 0.22` pin to `0.18`, add `assertPropScaleAt(z)`),
  `tests-e2e/dev-road-prop-scale.spec.ts` (new golden-frame).
- Verify: `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts`,
  the new golden-frame Playwright spec, `npm run content-lint`.
- Q-NNN gate: Q-017 (recommended default unblocks).
- Estimated `src/` LOC delta: ~15 lines edited in
  `pseudoRoadCanvas.ts` (table values + clamp + offset), ~40 lines
  added to the test file, ~80 lines for the new golden-frame spec.
- Fun-factor return per LOC: closes pain point #5 in a single PR.
  Renderer-only, ships in parallel with slice #1.

#### Slice #3 - `VibeGear2-implement-classify-tracks-b41307c8`

- Files: `src/data/schemas.ts` (add `archetype` enum to
  `TrackSchema`), `src/data/tracks/*.json` (32 files; add the
  `"archetype": "<bucket>"` field per Q-013), `src/data/__tests__/schemas.test.ts`
  (extend the schema test), `docs/gdd/09-track-design.md` build log.
- Verify: `npm run typecheck`, `npm run test`, `npm run content-lint`,
  `npm run lint`. Schema test names added in the dot.
- Q-NNN gate: Q-013 (recommended default unblocks).
- Estimated `src/` LOC delta: ~6 lines in `schemas.ts`, 32 single-line
  JSON inserts, ~25 lines in the schema test.
- Fun-factor return per LOC: foundation slice for the iter-1 lap bump.
  No felt change in isolation, but unlocks pain point #1's closer
  (`bump-prod-076ae7e7`).

### Hand-off readiness check

For the implement loop to start with slice #1 today:

- `fix-lateral-b2503f6f` names a unit test by phrase
  (`at top speed full steer crosses 4.5m road in >= 2s`). PASSES.
- The §10 numbers the implementor needs are quoted in iter-4 above
  (`steerRateLow 2.3`, `steerRateHigh 1.25`, `gripDry 1.0` baseline,
  `topSpeed 61` for Sparrow GT). PASSES.
- Q-NNN gates: none for slice #1; Q-013 / Q-015 / Q-017 each ship
  recommended defaults that the dot files quote. The implementor does
  NOT need a separate dev signoff to unblock the slice. PASSES.

No new `research:` dots needed for slice #1. The implementor can
start.

### User-pain coverage

Mapping each user phrase to the slice that closes it.

- "Just a series of menus" - the menus do not need cutting. The race
  itself needs lengthening. Closed by
  `VibeGear2-implement-bump-prod-076ae7e7` (production tracks bump
  from 1 lap to the §7 archetype target, race window grows from
  30-50 s to 2-5 minutes). The classify slice
  (`classify-tracks-b41307c8`) is its prerequisite. The lap-rollover
  HUD (`lap-rollover-7fcb891e`) makes the multi-lap pacing visible.
- "Lacking any turns" - every production track misses §9 Sharp /
  Hairpin / Compound. Closed by
  `VibeGear2-implement-re-author-47323741` (every track gets at least
  one Sharp or Hairpin per the per-region tier targets named in the
  dot file). The §9 anatomy lint
  (`9-track-e22793ca`) protects the result from regressing.
- "No other cars to actually race against in a challenging way" - two
  independent gaps. Closed by
  `VibeGear2-implement-quick-race-78084a95` (Quick Race fields the
  full §7 12-car grid instead of 2 cars) and
  `VibeGear2-implement-lift-opponent-8764ce5e` (renderer draws
  opponents to 600 m so leaders and trailers are visible mid-pack).
  `stretch-the-be459bc4` makes the grid visible at the lights, and
  the AI-vs-AI overtake follow-ups (F-084 / F-085) close the
  "challenging" half once the visible grid lands.
- "Way too fast moving across the road" - the lateral-velocity unit
  error. Closed by `VibeGear2-implement-fix-lateral-b2503f6f`. The
  cornering-tuning slice (`cornering-tuning-62491aea`) re-pins the
  §10 steer-rate constants so the post-fix feel matches the §10
  feel goals; the racing-line tension slice
  (`racing-line-7b2cbd41`) adds the missing g-load cap so hairpins
  must be braked into.
- "Objects ... all proportioned wrong" - per-kind heightRoadFactor
  outliers plus a maxHeight clamp that exceeds the player car
  silhouette. Closed by
  `VibeGear2-implement-calibrate-roadside-96e24f40` (rewrite the
  per-kind table to physical heights, drop the clamp from 0.22 to
  0.18, lift the offset from 1.32 to 1.7).

Every user phrase has a named slice. The plan covers all five pain
points end to end.

## Iteration 8 - feel-of-a-racer secondary slices

Iters 1-7 cover the five user-named pain points end to end. The
underlying complaint "doesn't feel like a racer at all" is broader
than those five. This iteration looks for the next layer of
fun-factor slices that fall outside pain points 1-5 but land cheap
relative to the felt impact: audio cornering cues, camera language
under speed and brake, mid-race damage feedback, and speed-line FX.

### A. Audio cornering cues

#### Diagnosis

`src/audio/sfx.ts` ships `playTireSqueal`, `playBrakeScrub`, and
`playSurfaceHush` as ONE-SHOT tones (`durationSeconds 0.14 to 0.18`)
on the `ProceduralSfxRuntime` sibling pattern. The race session at
`src/game/raceSession.ts:1993-2042` (`buildPlayerSurfaceAudioEvents`)
emits a `tireSqueal` event ONCE on the false-to-true gate transition
(`!input.gates.tireSquealActive`), and the event is consumed at
`src/app/race/page.tsx:323-324` by playing the same 0.16 s tone.

So a sustained hairpin sequence reads in audio as:
- t=0 (gate flips to true at `|steer| >= 0.65 && speed >= 18`):
  one 0.16 s squeal tone.
- t=0.2 to t=2.0 (player still mid-corner, gate still true):
  silence.
- t=2.0 (player straightens, gate flips to false): silence.
- t=2.4 (player turns into the next bend, gate flips back to true):
  one new 0.16 s squeal tone.

The §18 "tire squeal" + §18 "Dynamic audio layers" lines explicitly
imply a continuous bed under cornering load, not a single edge chirp.
§18 reads: "Speed raises engine harmonic content. Nitro adds filtered
high layer. Off-road adds rumble and debris band. Weather adds
ambient pad or noise layer. Menu-to-race crossfades should be smooth."
The dynamic-layers framing is incompatible with one-shot edge events;
loops are the standard pattern.

The engine runtime (`src/audio/engineRuntime.ts`) already ships a
continuous-oscillator pattern with `setTargetAtTime`-based smoothing,
so the loop pattern is in the codebase. The tire-squeal and
brake-scrub paths just need to follow it.

The §18 spec does NOT pin the slip-angle / steer-magnitude onset
threshold or the intensity-vs-gain curve, so Q-018 was filed with a
recommended default that keeps the existing 0.65 steer threshold for
the gate-on edge (no breaking change to current sfx-test pins) and
specifies a `lerp(0.40, 0.85, intensity)` gain curve over the
cornering window.

Engine pitch under load: `enginePitchHz` reads
`speed / topSpeed` only, with no cornering-load term. Under braking
the pitch falls naturally because `speed` falls. That is good enough
for the §18 "Speed raises engine harmonic content" line; no slice
filed.

Tunnel reverb / ambience: `src/audio/tunnelBus.ts` exists and is
wired through `src/render/tunnelRenderer.ts` for visual adaptation.
That is in scope of pain-point #2 re-author work, not iter-8.

#### Slice filed

`VibeGear2-implement-convert-tiresqueal-d2fd1407` - convert the
`tireSqueal` and `brakeScrub` events from one-shot edge tones to
gated continuous loops with intensity = `clamp((|steer| - 0.65) /
0.35, 0, 1) * speedFactor` (Q-018 default). Mirrors the
`engineRuntime` smoothing pattern. The implementor adds three
methods to `ProceduralSfxRuntime` (`startTireSquealLoop`,
`updateTireSquealLoop`, `stopTireSquealLoop`) and the same trio for
brake-scrub. Verify: `src/audio/__tests__/tireSquealLoop.test.ts`
and `e2e/tire-squeal-loop.spec.ts`. Q-018 default unblocks.

### B. Camera language under speed and brake

#### Diagnosis

`src/road/constants.ts:33-45` ships `FOV_DEGREES = 100` and
`CAMERA_HEIGHT = 1.5` as constants. `src/road/types.ts:20-25` defines
`Camera = { x, y, z, depth }` as a plain struct. The race page builds
the camera at `src/app/race/page.tsx:1438-1440` with
`y: CAMERA_HEIGHT, depth: CAMERA_DEPTH` and updates only `x` and `z`
per tick. `cameraSmoothing` does not exist as a module; there is
NO per-frame modulation tied to speed, brake, throttle, damage, or
off-road on the camera struct. The camera is geometrically static.

`src/render/vfx.ts` ships `fireFlash` and `fireShake` with
deterministic per-tick offset hashing AND reduced-motion gating; the
flash and shake stack is implemented end to end. But: a global
`grep -rn "fireFlash\|fireShake" src/` outside of `vfx.ts` /
`__tests__/vfx.test.ts` returns ZERO call-sites in the race page or
session. `drawRoad(... { vfx: VfxState })` is plumbed through
(`src/render/pseudoRoadCanvas.ts:152, 397`) but the race page never
sets `vfx:` in the options object (verified at
`src/app/race/page.tsx:1932-1982`). So the entire impact-shake +
lap-flash module ships dead code in production.

§16 "Camera behavior" says verbatim:
- "Camera lowers slightly at high speed."
- "Crest lines should reveal horizon dramatically."
- "Collision shake and off-road rumble should be subtle and short."

§16 "Animation and effects" lists "Light camera shake on impact" and
"HUD flash on lap complete" verbatim under the recommended VFX set.
Both behaviors are coded in `vfx.ts`. Both are dormant.

#### Top Gear 2 reference

A subtle FOV widen at top speed sells "this car is going fast" without
a perspective skew that would re-tune projector goldens. A small
camera dip under brake reads as weight transfer. A sharp shake on
collision plus a yellow flash on lap rollover make every race feel
event-rich rather than continuous. All three are unique
"feels-like-a-racer" cues that fall outside the five named pain
points.

#### Slices filed

- `VibeGear2-implement-fire-camera-36ae8ff4` - wire the dormant
  `VfxState` into the race page. Own a `vfxRef`, fire `fireShake` on
  every `RaceSessionImpactAudioEvent` with amplitude scaled by
  hitKind, fire `fireFlash` on `lapComplete` (gold) and `raceFinish`
  (gold), tick the state in the rAF, pass `vfx:` to `drawRoad`. Net
  src diff: ~30 lines in `page.tsx` plus a small bridge module.
  Verify: `src/app/race/__tests__/vfxBridge.test.ts` and
  `e2e/vfx-impact-feedback.spec.ts`.
- `VibeGear2-implement-speed-coupled-3cc0838f` - speed-coupled FOV
  widen and brake-coupled camera dip. Per-frame compute
  `cameraDepth = 1 / tan((FOV + fovDelta) / 2 * pi/180)` with
  `fovDelta = lerp(0, 6 deg, speedNorm)` and
  `cameraHeight = CAMERA_HEIGHT - brake * 0.18`, smoothed at 6 Hz
  via a new `src/app/race/cameraSmoothing.ts` pure module. Crucially
  no projector-internal change: `segmentProjector` reads
  `camera.depth` and `camera.y` per call. `after:` the lateral-fix
  slice so the FOV widen lands once the player can actually hold top
  speed in a corner.

### C. Damage feedback during the race

#### Diagnosis

The HUD damage bar already paints continuously
(`src/render/uiRenderer.ts:361-383`, color thresholds 35% / 70% via
`damageGood / damageWarn / damageBad`). So damage state IS visible
mid-race; the gap is per-impact intensity. On a wall hit:
- `RaceSessionImpactAudioEvent` fires (`raceSession.ts:1586`) and the
  `playImpact` SFX plays (one-shot tone, 0.08 s for rub, 0.16 s for
  hard impacts).
- The HUD damage-bar color may flip as the new total crosses 35% /
  70%, but it does NOT pulse, fade, or otherwise call attention.
- No camera shake (gap B above).
- No screen flash.
- No car-sprite flash (`src/render/carSpriteCompositor.ts` has no
  `hitFlash` field; verified by grep).

So the player feels the speed loss and hears the chirp, but the
visual reading of "I just hit something" is the new value of the
damage bar a few px wider. That is too subtle for the §16 "subtle
and short" target; today the impact reads as nothing happened
visually.

#### Slice filed

`VibeGear2-implement-fire-camera-36ae8ff4` (named in section B
above) is the smallest mid-race damage-feedback slice that does NOT
re-architect damage. It fires both shake AND a brief white-tinted
flash on every impact event, with intensity scaled by hitKind. That
is the "smallest mid-race damage-feedback addition that makes
collisions feel costly without re-architecting damage" the iter-8
prompt asks for.

A larger optional polish slice (NOT filed this iteration; logged for
future iter): a 90 ms color-tint frame on the player car sprite at
the moment of impact, mirroring the `brakeLight` / `nitroGlow` frame
overlay pattern in `carSpriteCompositor.ts`. Out of scope today
because the dormant-VFX wiring closes 80% of the gap on its own.

### D. Speed-line / motion FX

#### Diagnosis

`src/render/pseudoRoadCanvas.ts` ships:
- Rain streaks (`drawWeatherEffects` paints 92 streaks in
  heavy-rain, downward-only, NEVER radial) per the test at
  `pseudoRoadCanvas.test.ts:1497`.
- Off-road dust pool (`src/render/dust.ts`, fires on grass surface
  past `EMIT_SPEED_THRESHOLD_M_PER_S`).
- Heat-shimmer (`tourId === "ember-steppe"` only, perspective wave).

There is NO radial speed-line module, NO dotted-line streak module,
and NO nitro-trail particle module. F-058 (closed) added weather-
specific car spray/snow trails behind the car sprite, but did NOT
add foreground motion lines. At 0.95 topSpeed on a clear-weather
track the player gets ZERO foreground motion cues; the road
itself moves but the rest of the frame is static.

§16 "Strong foreground speed cues" + §16 "Animation and effects -
Nitro bloom trail" both call for it. The bloom trail in particular
is named verbatim and unimplemented.

#### Slice filed

`VibeGear2-implement-radial-speed-02dc1556` - radial speed-line
streak module mirroring the `src/render/dust.ts` pure-PRNG pool
pattern. Emit threshold `speedNorm >= 0.7`; emission rate ramps to
24/s at top speed and lifts to 42/s under nitro (so nitro adds the
named "bloom"). Stroke width 1-2 px, alpha 0.6 -> 0 over 220 ms,
horizon-spawned, drift radially outward. Reduced-motion gates
emissions to 0. Determinism via seed-hashed jitter (no
`Math.random`). `after:` the lateral-fix slice so the FX only
fires when the player can hold top speed without scraping a
rumble.

### E. F-NNN backlog reconciliation

Walked the 9 currently-open followups (`F-077`, `F-079`, `F-080`,
`F-081`, `F-082`, `F-083`, `F-084`, `F-085`, `F-086`).

Verdict per F-NNN:

- F-086 (banked-corner cap lift): orthogonal to iter-8, blocked on
  F-082; named in iter-4 already. Leave as-is.
- F-085 (AI-vs-AI overtake awareness): named in iter-3 plan as
  land-after-iter-3. Leave as-is.
- F-084 (AI rubber-band lead compression): named in iter-3 plan as
  land-after-iter-3. Leave as-is.
- F-083 (golden-image regression for re-author): named in iter-2
  plan. Leave as-is.
- F-082 (renderer banking schema): named in iter-2 plan. Leave
  as-is.
- F-081 (cash and repair economics for multi-lap): named in iter-1
  follow-up surface. Leave as-is.
- F-080 (re-baseline release-fun playtest to multi-lap): tightly
  coupled to iter-1 lap-bump slice. Leave as-is; the lap-bump PR
  must update the playtest suite as part of its own change.
- F-079 (Feedback FAB rate limit move to Redis): orthogonal to the
  fun-factor plan entirely. Leave as-is.
- F-077 (Playwright coverage for FAB): orthogonal. Leave as-is.

None are obsolete. None are duplicated by the iter-8 slices.
`docs/FOLLOWUPS.md` not edited this iteration.

### F. User-pain coverage map (iter-8 update)

The user's underlying complaint "doesn't feel like a racer at all" =
pain points 1-5 PLUS audio cornering cues, camera language under
speed and brake, mid-race damage feedback, and speed-line FX. The
five named pain points are diagnosed; iter-8 names four more
secondary slices that close the residual feel-gap.

### Top-3 update (iter 8)

The iter-6 Top-3 ordering (`fix-lateral`, `calibrate-roadside`,
`classify-tracks`) is unchanged. None of the iter-8 slices jump that
queue: each iter-8 slice carries an `after:` chain on `fix-lateral`
or is soft-gated behind it because the FOV widen and the speed-lines
are only worth shipping after the lateral-fix lets the player hold
top speed. The iter-8 slices slot into the queue as follows:

1. `VibeGear2-implement-fix-lateral-b2503f6f` (iter-4, position 1).
2. `VibeGear2-implement-calibrate-roadside-96e24f40` (iter-5, 2).
3. `VibeGear2-implement-classify-tracks-b41307c8` (iter-1, 3).
4. `VibeGear2-implement-fire-camera-36ae8ff4` (iter-8, NEW). Ready
   today; no `after:` chain because the dormant VFX module is
   independent of the lateral-fix. Closes the dormant-VFX gap and
   delivers mid-race damage feedback as a side effect.
5. `VibeGear2-implement-bump-prod-076ae7e7` (iter-1, blocked on 3).
6. `VibeGear2-implement-quick-race-78084a95` (iter-3, blocked on 5).
7. `VibeGear2-implement-stretch-the-be459bc4` (iter-3, blocked on 6).
8. `VibeGear2-implement-lift-opponent-8764ce5e` (iter-3, blocked on 6).
9. `VibeGear2-implement-re-author-47323741` (iter-2, blocked on 5).
10. `VibeGear2-implement-cornering-tuning-62491aea` (iter-4, on 1).
11. `VibeGear2-implement-speed-coupled-3cc0838f` (iter-8, on 1).
12. `VibeGear2-implement-radial-speed-02dc1556` (iter-8, on 1).
13. `VibeGear2-implement-convert-tiresqueal-d2fd1407` (iter-8,
    parallel; no hard `after:` chain because the audio loop is
    independent of physics, but reads as best when the lateral-fix
    has landed so the cornering load is real).
14. `VibeGear2-implement-lap-rollover-7fcb891e` (iter-1, parallel).
15. `VibeGear2-implement-9-track-e22793ca` (iter-2, blocked on 9).
16. `VibeGear2-implement-racing-line-7b2cbd41` (iter-4, on 10 / 9).
17. `VibeGear2-implement-extend-roadside-e541c8a5` (iter-5, on 2).

The iter-8 slice `VibeGear2-implement-fire-camera-36ae8ff4` jumps to
position 4 because it is the only iter-8 slice that ships standalone
(no `after:` chain, no Q-NNN gate, no content prerequisite) AND
closes two named pain layers at once: "feels like a racer / collisions
should feel costly" (camera shake on impact + flash on lap) and
the dormant-VFX bug (an actual code-is-dead finding from the iter-8
diagnosis).

### Open questions

- Q-018: tire-scrub onset threshold and continuous-loop intensity
  curve. Recommended default unblocks the iter-8 audio loop slice.

### Followups

None new. Existing F-077 / F-079-086 stand.

