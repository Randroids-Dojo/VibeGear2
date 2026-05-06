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

### How this plan changes per iteration

Each future research iteration appends a new section ("Iteration 2 -
pain point #2 diagnosed") below this one. The "Top 3 slices" block
above is updated only when the diagnosis evidence justifies a re-rank.
Old iteration sections stay in place to preserve the audit trail; that
is the same append-only discipline used in the four ledger files.
