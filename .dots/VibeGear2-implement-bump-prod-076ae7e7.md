---
title: "implement: bump production track laps to GDD §7 archetype targets"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:13:23.260163-05:00"
blocks:
  - VibeGear2-implement-classify-tracks-b41307c8
---

## Description

Bump the `laps` field on every production track JSON from `1` to the
§7 archetype target. This is the highest-leverage single slice for
pain point #1 ("the race feels like a 30-50 s sprint"). The engine
already supports multi-lap races end-to-end; only the data is short.

Lap targets per `docs/gdd/07-race-rules-and-structure.md` "Number of
laps" - applied to the `archetype` label written by the previous
slice (`VibeGear2-implement-classify-tracks-b41307c8`):

- `short-sprint` -> `laps: 4`
- `standard` -> `laps: 3`
- `long-scenic` -> `laps: 2`
- `endurance` -> `laps: 2`

Pick the low end of each §7 range so the first ship lands a
conservative pacing increase. A balancing slice can push `short-sprint`
to 5 and `endurance` to 3 once playtest evidence is in.

## Context

`docs/RESEARCH_TOPGEAR_FUN_PLAN.md` and the research dot
`VibeGear2-research-top-gear-60152574` document the gap: every
production track is currently `"laps": 1`, which collapses §7's lap
structure entirely. Multi-lap support is wired through
`raceState.totalLaps`, `stepRaceSession` lap rollover at
`src/game/raceSession.ts:1703`, the rewards builder, and the §7
fastest-lap bonus, so this is a data-only slice.

This slice depends on `VibeGear2-implement-classify-tracks-b41307c8`
because it reads the new `archetype` field to choose the lap count.

## Affected files

- `src/data/tracks/*.json` - update `"laps": 1` to the §7 target on
  every one of the 32 production tracks. `test-*.json` and
  `_benchmark/` tracks remain `laps: 1` so the regression-suite
  fixtures stay deterministic.
- `src/data/__tests__/` - any track-loading test that hard-codes a lap
  count for a production track must be updated to read the JSON or use
  a test fixture. Avoid asserting `laps === 1` on production tracks.
- `e2e/` - any Playwright fixture that times out at the old single-lap
  duration should bump its timeout. Tests that assert finish-line
  routing inside 30 s on a production track must move to a `test-*`
  fixture.
- `docs/gdd/07-race-rules-and-structure.md` build log entry naming the
  bump and linking the PR.

## Implementation notes

- This is a pure data slice. Do not change physics, AI, rewards, or HUD.
- Cash bonus economics will shift because pickups respawn per lap;
  filed under F-081 for follow-up balancing once playtest data is in.
- The §15 fastest-lap bonus, drafting, rubber-banding, and damage band
  gradients all become meaningful for the first time after this lands;
  do not "while I'm here" tune them. They are separate slices.
- The `laps` field ships an integer in the JSON; do not introduce a
  half-lap or fractional value.
- F-080 covers updating playtest evidence to expect 2-5 minute race
  windows. Do not block this slice on F-080; it can re-baseline once
  multi-lap races are live.

## Verify

- [ ] `npm run typecheck` green.
- [ ] `npm run lint` green.
- [ ] `npm run test` green.
- [ ] `npm run content-lint` green.
- [ ] `npm run build` green.
- [ ] Every production track JSON reports `laps >= 2`. Verify with
      `for f in src/data/tracks/*.json; do grep -H '"laps":' "$f"; done
      | grep -v '"laps": 1' | wc -l` returning at least 32 (one line
      per production track).
- [ ] The `test-*.json` tracks and `_benchmark` tracks still ship with
      `"laps": 1` for fixture stability.
- [ ] A live race on Velvet Coast Harbor Run runs to lap 3 before the
      finish, both for the player car and the AI grid (manual smoke or
      Playwright trace). Race window is 2-5 minutes elapsed.
- [ ] §7 fastest-lap bonus visibly fires in the §20 results screen on
      at least one production track (the first race that has more than
      one timed lap).
- [ ] `docs/gdd/07-race-rules-and-structure.md` build log has a new
      entry naming the lap bump and linking the PR.
