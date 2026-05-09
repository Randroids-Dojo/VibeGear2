---
title: "implement: pure raceRules.ts module (countdown constants, DNF timers, ranking, final-state builder) per §7"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T06:37:10.686854-05:00\\\"\""
closed-at: "2026-04-26T06:43:00.827241-05:00"
close-reason: "verified: lint, typecheck, 965 unit tests, build, 28 e2e specs all green; PROGRESS_LOG entry added"
---

Pure-helpers slice that ships src/game/raceRules.ts as a side-effect-free module. Sits underneath the parent race-rules-b30656ae composite dot. Defers raceSession integration to a later wiring slice (mirrors the nitro / damage / drafting pattern: pure module first, race-session wiring after).

## Scope

Ship src/game/raceRules.ts exporting:

1. Countdown re-exports + tick labels.
   - re-export DEFAULT_COUNTDOWN_SEC from raceState (already pinned at 3).
   - export COUNTDOWN_TICK_LABELS = ['3','2','1','GO'].
   - export labelForCountdown(remainingSec): string returning the right label for the HUD.

2. DNF timer constants and pure tick helper.
   - DNF_OFF_TRACK_TIMEOUT_SEC = 30.
   - DNF_NO_PROGRESS_TIMEOUT_SEC = 60.
   - DNF_RACE_TIME_LIMIT_SEC = 600.
   - DNF_NO_PROGRESS_DELTA_M = 5 (per-window distance threshold).
   - DnfTimers shape: { offTrackSec: number; noProgressSec: number; lastProgressMark: number }.
   - INITIAL_DNF_TIMERS frozen.
   - tickDnfTimers(prev, sample, dt) where sample = { offTrack: boolean; speed: number; totalDistance: number }. Returns { timers, dnf: boolean, reason: 'off-track' | 'no-progress' | null }.
   - Per-car DNF reset on return-to-road / making-progress. Documented behaviour: a single tick of progress resets the no-progress window; a single tick on-road resets the off-track window. Matches the iter-19 stress-test rule.

3. Ranking helper.
   - CarRankSnapshot shape: { carId: string; lap: number; z: number; totalDistance: number; status: 'racing' | 'finished' | 'dnf' }.
   - rankCars(snapshots): readonly CarRankSnapshot[] applying the §7 / iter-19 tie-break ladder: higher lap > higher z > higher totalDistance > lex carId. Finished cars (sorted by carId for the slice; finishedAtTick tie-break is owned by the wiring slice) outrank racing; DNF sort to the back.

4. Race time limit checker.
   - exceedsRaceTimeLimit(elapsedSec): boolean.

5. Final-state builder.
   - FinalRaceState type per the iter-19 stress-test §5: { trackId; totalLaps; finishingOrder: [{ carId; status; raceTimeMs; bestLapMs }]; perLapTimes: Record<carId, number[]>; fastestLap: { carId; lapMs; lapNumber } | null }.
   - buildFinalRaceState(input) where input describes per-car finishing order, lap times, and status.

All pure. No imports from raceSession.ts; no DOM; no Math.random; no Date.now. The wiring slice (separate dot, file as F-NNN follow-up) consumes these helpers from raceSession.ts.

## Affected files

- src/game/raceRules.ts (new): the pure module described above.
- src/game/__tests__/raceRules.test.ts (new): full unit coverage of every helper + iter-19 verify cells.

## Out of scope (for the wiring sub-dot)

- Extending RaceState shape with cars[] / lastCheckpoint / etc.
- Replacing raceSession.ts lap-detection stub.
- Playwright e2e (depends on the wiring slice).
- Integration with race-checkpoint-81d86518 (depends on that dot).

## Verify

- All five helper groups covered by unit tests with iter-19 stress-test §8 cell-level assertions adapted to the pure-module shape (DNF threshold, DNF reset, ranking ladder, final-state shape).
- Determinism: same inputs produce deep-equal output across two runs.
- Frozen: INITIAL_DNF_TIMERS is Object.frozen; reducer never mutates input.
- No em-dashes in any added file.
- npm run lint && npm run typecheck && npm test && npm run build all green.
- PROGRESS_LOG.md entry added.

## References

- docs/gdd/07-race-rules-and-structure.md (race lifecycle).
- .dots/VibeGear2-implement-race-rules-b30656ae.md (parent composite, iter-19 stress-test).
- src/game/nitro.ts, src/game/damage.ts, src/game/drafting.ts (pure-module-then-wire pattern).
