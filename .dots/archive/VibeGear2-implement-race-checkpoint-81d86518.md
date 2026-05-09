---
title: "implement: race checkpoint pass tracking (RaceState.lastCheckpoint, runtime detector) per §7 §22"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:37:50.077851-05:00\\\"\""
closed-at: "2026-04-26T06:50:39.000625-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-race-rules-b30656ae
  - VibeGear2-implement-practice-quick-ad3ba399
  - VibeGear2-implement-time-trial-5d65280a
  - VibeGear2-implement-full-ai-fab57b84
---

## Description

Add per-tick checkpoint-pass detection to the race lifecycle. The Track
schema already declares `checkpoints: [{segmentIndex, label}]` in
`docs/gdd/22-data-schemas.md` and `src/data/schemas.ts:67`, but no runtime
code reads them. `RaceState` (`src/game/raceState.ts`) carries only
`{phase, elapsed, lap, totalLaps}` with no checkpoint memory.

Several downstream dots assume checkpoint-pass tracking exists:

- `practice-quick-ad3ba399`: "resetToCheckpoint rewinds tick and lap to the
  last checkpoints[] entry the player passed".
- `time-trial-5d65280a`: sector splits between checkpoints.
- `full-ai-fab57b84`: AI "recover" intent ("rejoin the racing line after a
  spin") needs to know which checkpoint to spawn back at.
- `race-rules-b30656ae`: the dot mentions DNF timeout but timeouts since
  last checkpoint pass are the natural rule per §7.

Without this dot, each consumer would either invent its own per-tick
detection (duplicated, drift-prone) or skip the feature.

## Context

Phase 2 / Phase 3 task. The §22 Track schema's `checkpoints` field is the
source of truth for the segment indices; the runtime needs to:

1. Track which checkpoints the player has passed during the current lap.
2. Reset the per-lap pass set when the start/finish line is crossed.
3. Surface `lastCheckpoint: {tick, segmentIndex, carState} | null` for
   `practice.resetToCheckpoint`, time-trial splits, and AI recovery spawn.
4. Compute "all checkpoints passed?" before crediting a lap (anti-shortcut
   guard per §7).

This is a small, well-shaped slice that unblocks several downstream dots.

## Affected Files

- `src/game/raceState.ts` (modify):
  - Add `lastCheckpoint: { tick: number; segmentIndex: number; label: string; carState: CarState } | null` to the `RaceState` interface.
  - Add `passedCheckpointsThisLap: ReadonlySet<number>` (set of segment indices passed since the last start-line cross).
  - `createRaceState(totalLaps)` initialises both to `null` / empty.
- `src/game/raceCheckpoints.ts` (new): pure helpers
  - `detectCheckpointPass(prevZ: number, currZ: number, segmentLengthMeters: number, checkpoints: TrackCheckpoint[]): TrackCheckpoint | null` — returns the checkpoint crossed in this tick, or null. Handles wrap-around for laps (`prevZ` near end, `currZ` near zero).
  - `applyCheckpointPass(state: RaceState, checkpoint: TrackCheckpoint, tick: number, carState: CarState): RaceState` — pure, returns a new state with the checkpoint added to `passedCheckpointsThisLap` and `lastCheckpoint` updated.
  - `resetCheckpointsForNewLap(state: RaceState): RaceState` — pure, called by lap detection when start line crossed.
  - `hasPassedAllCheckpoints(state: RaceState, track: Track): boolean` — true iff every checkpoint segmentIndex is in `passedCheckpointsThisLap`. Used by lap-credit guard (§7 anti-shortcut).
- `src/game/__tests__/raceCheckpoints.test.ts` (new): ~20 cases
  - Empty checkpoints: detectCheckpointPass returns null always.
  - Forward pass: `prevZ < segIndex * SEG_LEN < currZ` returns the checkpoint.
  - Lap wrap: `prevZ` at 5800m, `currZ` at 30m, track length 5820m, checkpoint at 0: returns the start checkpoint.
  - No pass: `prevZ` and `currZ` between two checkpoints.
  - Multi-pass per tick (high speed): returns the latest crossed (guard against returning a pre-current checkpoint).
  - applyCheckpointPass purity: input not mutated, output deep-equal expected.
  - resetCheckpointsForNewLap clears set but preserves lastCheckpoint.
  - hasPassedAllCheckpoints true iff every seg index covered.
  - Anti-shortcut: hasPassedAllCheckpoints returns false when one is missing.
- `src/road/constants.ts` (no change): `SEGMENT_LENGTH` already defines the per-segment length. Helpers consume it.

## Edge Cases

- `prevZ` and `currZ` differ by more than half the track (rAF drop or pause skip): treat as no-op rather than asserting all crossed checkpoints. The fixed-step loop's MAX_ACCUMULATOR cap (250 ms / 15 ticks) already bounds this; add a sanity check in tests.
- A checkpoint at `segmentIndex = 0` (the start/finish line itself, common pattern): pass is detected on `currZ < prevZ` (wrap), not on `prevZ < 0 < currZ`.
- Two checkpoints adjacent within one tick distance: detector returns both in order. Decision: return only the **latest** crossed in this tick to keep the API simple; the tick rate is high enough (60 Hz) that two checkpoints in one tick implies misconfigured authoring.
- Reverse (going backwards through a checkpoint): does not register a pass. Pass detection is unidirectional (forward only). Tests pin this.
- Track with 0 checkpoints: `hasPassedAllCheckpoints` returns true vacuously (so lap-credit doesn't deadlock). Note: a track with zero checkpoints has no anti-shortcut guard; `TrackSchema` allows this today.

## Verify

- [ ] `detectCheckpointPass` test fixtures cover the 8 cases above.
- [ ] Pure: `applyCheckpointPass` and `resetCheckpointsForNewLap` do not mutate input.
- [ ] `hasPassedAllCheckpoints` truth table holds for 0, 1, 2, 5 checkpoints with various pass states.
- [ ] Anti-shortcut: scripted physics inputs that skip a checkpoint produce a `lap` increment of 0 when checked under the lap-credit guard (this verify lives in `race-rules-b30656ae`'s test, but this dot exposes the helper).
- [ ] Determinism: same tick sequence produces the same `lastCheckpoint` across two runs (deep-equal).
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/07-race-rules-and-structure.md` (lap counting, DNF rules).
- `docs/gdd/22-data-schemas.md` (Track.checkpoints schema).
- `src/game/raceState.ts` (existing minimal state).
- `src/road/constants.ts` (SEGMENT_LENGTH).
- `.dots/VibeGear2-implement-race-rules-b30656ae.md` (consumer).
- `.dots/VibeGear2-implement-practice-quick-ad3ba399.md` (resetToCheckpoint consumer).
- `.dots/VibeGear2-implement-time-trial-5d65280a.md` (sector splits consumer).
- `.dots/VibeGear2-implement-full-ai-fab57b84.md` (AI recover spawn consumer).
