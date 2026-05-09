---
title: "research: Top Gear feel pain point #1 - race length and lap structure"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-05-05T23:13:17.353911-05:00\\\"\""
closed-at: "2026-05-05T23:18:29.434695-05:00"
close-reason: "Diagnosed pain point #1 (race feels like 30-50s sprint = data-only: every production track ships laps:1). Filed 3 implement dots in dependency order, Q-013 with recommended default mapping, F-080 + F-081 followups, and docs/RESEARCH_TOPGEAR_FUN_PLAN.md pinning the top-3 slices."
---

Diagnose why every race feels like a 30-50 s sprint with no lap pacing.
Compare GDD §7/§9 to actual track data and the Top Gear 2 reference, then
file the PR-sized implementation slices that close the gap.

## Findings

**Track data**

- All 32 production tracks (the four Velvet Coast, Iron Borough, Ember
  Steppe, Breakwater Isles, Glass Ridge, Neon Meridian, Moss Frontier and
  Crown Circuit tracks under `src/data/tracks/*.json`) ship with
  `"laps": 1`. Verified by:
  `for f in src/data/tracks/*.json; do grep -o '"laps":[^,]*' "$f"; done`
  returns `"laps": 1` for every entry.
- Track lengths sit between 1500 m (`velvet-coast/harbor-run`) and
  2600 m (`crown-circuit/final-horizon`) at single-lap distance.
- At the §10 Starter top speed of 61 m/s the average competitive pace is
  around 50-55 m/s, so a 1500-2600 m single-lap race finishes in
  roughly 27-52 s of actual driving plus the §7 3-second countdown.

**GDD targets**

- `docs/gdd/07-race-rules-and-structure.md` "Number of laps" pins:
  - Short sprint: 4-5 laps.
  - Standard circuit: 3 laps.
  - Long scenic: 2 laps.
  - Final-tour endurance: 2-3 long laps.
- `docs/gdd/09-track-design.md` "Track length targets" pins competitive
  pace targets per lap: short 50-75 s, medium 75-105 s, long
  105-150 s. So a §7 standard 3-lap circuit with a medium lap should
  read as roughly 4-5 minutes of actual racing - the Top Gear 2 feel
  the user is asking for.
- `docs/gdd/24-content-plan.md` and `docs/gdd/08-world-and-progression-design.md`
  agree on 32 production tracks across 8 tours with a sequential unlock
  rhythm.

**Top Gear 2 reference**

- The 1993 SNES title shipped multi-lap circuits with race times that
  ran 2-4 minutes per race. Pace pressure was built across multiple
  laps, not in one straight sprint. The §7 lap targets in the GDD are
  the deliberate VibeGear2 echo of that pacing.

**The gap**

- The `Track.laps` field is wired end-to-end (`raceState.totalLaps`,
  `stepRaceSession` lap rollover at `raceSession.ts:1703`, results
  builder, championship reducer). There is no engine work to unblock.
- The miss is in the *content data*: every authored track ships with
  `laps: 1`. So the engine's multi-lap support is dormant and the user
  experiences a 30-50 s sprint instead of a 2-5 minute race.
- The GDD does not pin which production track maps to which
  archetype, so a slice that bumps `laps` in bulk needs an explicit
  archetype label per track (see Q-013 below).

**Race-feel knock-ons of "1 lap"**

- The §15 rubber-banding model and §7 fastest-lap bonus only meaningfully
  fire across multiple laps. A single-lap race cannot reward "fastest lap"
  because there is exactly one lap.
- The §13 damage-band gradient (cosmetic at 0-24%, escalating to limp
  mode at 100%) does not have time to play out inside one lap; players
  rarely visit the moderate band before the chequered flag.
- The §9 "one signature feature, one recovery zone, one high-speed
  gamble, one late-race tension section" track anatomy assumes the
  player drives the track more than once so they can read those beats.
  Single-lap races collapse the anatomy into "the track".
- AI personality (P1 in `docs/ARCADE_RACER_PRIORITY_STACK.md`) produces
  most of its texture across multiple laps where pace decay, mistake
  cadence and weather skill compound. One lap is barely enough for an
  archetype to express itself.

**Decisions still owed**

- The GDD does not pin which production track maps to which archetype,
  so we file `Q-013` with a recommended default.
- The GDD does not pin a default lap count for `Track.laps` when an
  authored track omits the field; the schema currently requires the
  field but a future authoring slice may want a default. Out of scope
  for this pain point.

## Implementation slices created

In dependency order:

1. `VibeGear2-implement-classify-tracks-b41307c8` -
   add an `archetype` enum to `Track` schema and label every production
   track. Independent foundation slice.
2. `VibeGear2-implement-bump-prod-076ae7e7` -
   bump `laps` on every production track JSON to the §7 target for its
   archetype. Depends on #1 so the archetype label exists in source.
3. `VibeGear2-implement-lap-rollover-7fcb891e` -
   surface lap rollover on the HUD with a "LAP 2/3" pulse plus an audio
   cue so the player feels the lap structure. Independent of #1 and #2,
   improves multi-lap feel either way.

## Followups filed

- F-080 - update playtest evidence to expect 2-5 minute race windows
  instead of the current sub-minute window.
- F-081 - re-tune economy/repair caps if multi-lap races shift expected
  cash earned per race.

## Open questions filed

- Q-013 - which Velvet Coast / Iron Borough / Ember Steppe / Breakwater
  Isles / Glass Ridge / Neon Meridian / Moss Frontier / Crown Circuit
  tracks map to which §7 archetype.

## Verify (research-side)

- [ ] Each implementation dot is independent or has explicit `after:`
  ordering documented.
- [ ] Each implementation dot has Description, Context, Affected Files
  and Verify sections.
- [ ] Q-013 has a Recommended default so the implementor is not blocked
  if the dev does not answer.
- [ ] FOLLOWUPS.md F-080 and F-081 are filed as ledger entries (no edits
  to past entries).
- [ ] PROGRESS_LOG.md has a research entry at the top documenting this
  pass with Coverage ledger and Followups created sections.
