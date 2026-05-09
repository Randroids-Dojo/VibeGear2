---
title: "implement: sector splits + ghost delta HUD widget per §20 race HUD"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:32:49.011579-05:00\\\"\""
closed-at: "2026-04-26T04:42:39.557936-05:00"
close-reason: verified
---

## Description

Implement the sector-split timer and ghost-delta widget pair from `docs/gdd/20-hud-and-ui-ux.md` ("lap timer", "best lap", "Top-right: best lap / ghost delta"). Currently no dot owns the timer logic that derives sector deltas from `raceCheckpoints` or the +/- delta-vs-ghost display.

## Context

`docs/gdd/20-hud-and-ui-ux.md` lists "lap timer" and "best lap" as required Race HUD fields and pins "Top-right: best lap / ghost delta" in the wireframe. The `implement-race-checkpoint-81d86518` dot ships per-tick checkpoint-pass detection but explicitly defers "sector splits between checkpoints" to a downstream consumer. The `implement-time-trial-5d65280a` dot persists best-lap times but does not own the per-sector split UI. The `implement-ghost-replay-7ea6ffaa` dot ships ghost playback but does not pin the delta-display widget. The `implement-hud-ui-6c1b130d` dot lists splits as part of a too-broad bundle. This dot pins the missing piece: the pure split-time math, the HUD-state extension, and the small drawcall.

## Affected Files

- `src/game/sectorTimer.ts` (new): pure functions
  - `SectorState = { sectors: ReadonlyArray<{label: string; segmentIndex: number; tickEntered: number; tickExited: number | null}>; currentSectorIdx: number }`
  - `createSectorState(checkpoints) => SectorState` (initial state at race start)
  - `onCheckpointPass(state, checkpoint, tick) => SectorState` (pure update)
  - `sectorDeltaMs(currentSplitsMs, ghostSplitsMs) => number[]` (per-sector +/- in ms)
  - `bestSplitsForTrack(save, trackId) => readonly number[] | null` (read from persistence; pure given input)
- `src/game/__tests__/sectorTimer.test.ts` (new): cell-level fixtures
- `src/game/hudState.ts` (modify): add optional `sectorDeltaMs?: number | null` (current-sector delta-vs-best, signed) and `bestLapMs?: number | null` (already pinned in hud-ui stress-test as optional).
- `src/render/hudSplits.ts` (new): pure drawcall builder
  - `drawSplitsWidget(ctx, state: {currentSectorIdx, lapTimerMs, sectorDeltaMs}, layout)` issues at most three text drawcalls (lap timer, sector label, delta in green/red)
- `src/render/__tests__/hudSplits.test.ts` (new): mock-canvas drawcall snapshot per fixture (positive delta red, negative delta green, null delta blank)
- `src/persistence/save.ts` (modify): `records[trackId]` extends to `{bestLapMs, bestSplitsMs?: readonly number[]}` (backwards-compat: optional, default undefined).
- `src/data/schemas.ts` (modify): `TrackRecordSchema.bestSplitsMs: z.array(z.number().nonnegative()).optional()`.

## Pinned widget contract

- The widget renders only when `save.records[trackId].bestSplitsMs` exists. First-ever run on a track shows the lap timer alone; no delta.
- Delta color: green for negative (faster than best), red for positive (slower), neutral for null.
- Delta text format: `+/-MM:SS.mmm` rounded to 100 ms granularity.
- After the player crosses the start line for a new lap, the displayed sector is the FIRST sector and the delta is null until the first checkpoint pass of the new lap.

## Edge Cases

- Track with zero checkpoints: widget reverts to lap-timer-only mode; never throws.
- Track with one checkpoint (start line only): single sector covers the whole lap; delta is computed against `bestLapMs`, not against per-sector splits.
- Player passes a checkpoint twice within a single lap (out of order): ignore subsequent passes; the §7 anti-shortcut guard already covers correctness.
- Ghost replay active and ghost has different split structure (track schema changed): hide delta; surface a single console.warn("[splits] ghost schema mismatch").
- Mid-lap pause: lap timer freezes (driven by raceState elapsed, not wall-clock); sector splits already record `tickEntered` so they survive resume.
- Reduced-motion: no animation (color flash on improvement is gated on `settings.reducedMotion === false`).
- Best-splits update: only after a lap improves the OVERALL bestLap; never write per-sector regressions.

## Verify

- [ ] `onCheckpointPass` advances `currentSectorIdx` and records `tickExited` on the previous sector.
- [ ] `sectorDeltaMs([10000, 20000, 30000], [9800, 19500, 29000])` returns `[+200, +500, +1000]` (positive = current is slower, matching pinned sign convention).
- [ ] First-run case: `bestSplitsForTrack(emptySave, trackId)` returns null; widget hides delta.
- [ ] Zero-checkpoint track: `createSectorState([])` returns one whole-lap sector; `onCheckpointPass` is never called; widget shows lap timer only.
- [ ] One-checkpoint track: delta uses `bestLapMs` not splits.
- [ ] HUD drawcall snapshot: positive delta uses the red color token, negative uses green, null draws no delta text.
- [ ] Schema migration: an existing v2 save without `bestSplitsMs` loads without error.
- [ ] Schema validation: `TrackRecordSchema.safeParse({bestLapMs: 60000, bestSplitsMs: [20000, 40000, 60000]})` succeeds; negative entries reject.
- [ ] Best-splits write gate: a faster lap with worse mid-sectors still overwrites bestSplitsMs (overall improvement is the only gate); a slower lap with better mid-sectors does NOT overwrite.
- [ ] Pure: no Math.random, no Date.now (tick-driven).
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/sectorTimer.ts src/render/hudSplits.ts src/data/schemas.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/20-hud-and-ui-ux.md` Race HUD (best lap / ghost delta), Wireframe (Top-right)
- `docs/gdd/06-game-modes.md` Time trial (developer benchmark, downloaded ghost)
- `docs/gdd/22-data-schemas.md` Track checkpoints (label, segmentIndex)
