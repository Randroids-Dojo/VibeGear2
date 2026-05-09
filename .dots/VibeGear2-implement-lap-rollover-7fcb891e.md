---
title: "implement: lap-rollover HUD moment so multi-lap pacing reads on screen"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:13:26.887771-05:00"
---

## Description

When the player crosses the start/finish line and `race.lap`
increments, surface a brief HUD moment: a centered "LAP n / N" badge
that fades in for ~1.5 s plus a short audio cue. On the final-lap
crossing the badge reads "FINAL LAP" instead. This is what makes a
multi-lap race feel like progression rather than aimless looping.

## Context

`docs/gdd/20-hud-and-ui-ux.md` "HUD flash on lap complete" already
calls for a lap-flash visual effect. The `lapEvents` and §20 race
moment system (`src/game/raceMoments.ts`) already emits position
gain/loss / rival pressure moments via the same canvas pipe. This
slice extends the moment list with `lap-rollover` and `final-lap`
entries, then plumbs them into the HUD overlay.

The lap rollover is detected today inside `stepRaceSession` at
`src/game/raceSession.ts:1703` (search "nextLap > state.race.totalLaps").
That is the right hook point: emit a `RaceMoment` whose kind is
`"lap-rollover"` (or `"final-lap"` when `nextLap === state.race.totalLaps`)
and let the HUD layer consume it.

This slice complements `VibeGear2-implement-bump-prod-076ae7e7` -
multi-lap races without lap-rollover feedback feel like the same race
played twice. Independent of the lap-bump slice, but its value is
unlocked once `laps >= 2` ships.

## Affected files

- `src/game/raceMoments.ts` - extend the `RaceMoment` discriminated
  union with `lap-rollover` (carries `nextLap`, `totalLaps`) and
  `final-lap` (carries `totalLaps`). Add the pure helper that picks
  one of the two given the lap delta.
- `src/game/raceSession.ts` - in the lap-rollover branch (around
  line 1700-1740), push the appropriate moment to the moments queue.
  Player car only - AI lap rollovers do not get HUD moments in v1.
- `src/render/uiRenderer.ts` (or whichever file owns the moment-toast
  draw) - render the `lap-rollover` and `final-lap` badges with their
  copy and 1.5 s fade-in / fade-out.
- `src/audio/` - reuse the existing lap-complete SFX cue if present;
  if not, add a single short cue under the procedural-audio bank
  introduced by PR #168. Final-lap uses a distinct cue (slightly
  higher pitch / longer tail) to read as climax.
- `src/game/__tests__/raceMoments.test.ts` (or equivalent) - new pure
  tests asserting the moment classifier (mid-race lap -> `lap-rollover`,
  penultimate-to-final -> `final-lap`, final-lap-finish -> no moment
  because the race ends instead).
- `e2e/` - extend the release-fun playtest to assert that on a
  multi-lap track, a lap-rollover badge appears at least once during
  the race.

## Implementation notes

- Do not change `Track.laps` or any track JSON; that is the data
  slice's job.
- Do not refactor the existing race-moment renderer "while I'm here";
  if the moment-toast layout needs work, file a separate slice.
- `final-lap` fires on the crossing that begins the final lap, not on
  the chequered flag. The chequered flag has its own §20 finish moment.
- Players who retry a race in §7 retry mode should see a fresh sequence;
  the moments queue is per-race, so this is automatic, but verify in
  test that retries do not inherit stale entries.
- Determinism: the moment is emitted from the pure session reducer; it
  must not read `Date.now` or `Math.random` (AGENTS.md RULE 8).

## Verify

- [ ] `npm run typecheck` green.
- [ ] `npm run lint` green.
- [ ] `npm run test` green; new pure tests cover `lap-rollover` vs
      `final-lap` classification and the no-emit case on the
      chequered-flag crossing.
- [ ] `npm run build` green.
- [ ] Manual smoke: on a production track with `laps >= 3`, a
      "LAP 2 / 3" badge appears for ~1.5 s when the player crosses
      start/finish at the end of lap 1, and a "FINAL LAP" badge appears
      at the end of lap 2. The chequered flag fires its existing finish
      moment and not the lap-rollover badge.
- [ ] The lap-rollover SFX is audible above the engine and weather
      ambience without masking the existing pickup / nitro / pass
      cues.
- [ ] `docs/gdd/20-hud-and-ui-ux.md` build log has a new entry naming
      the lap-rollover moment and linking the PR.
