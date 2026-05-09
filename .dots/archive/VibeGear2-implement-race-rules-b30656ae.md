---
title: "implement: race rules engine (countdown, laps, placement, DNF) per §7"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:51.842696-05:00\\\"\""
closed-at: "2026-04-26T07:49:18.434648-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-phase-1-7aef013d
---

## Description

Build `src/game/raceRules.ts`. Implement the full race lifecycle: pre-race countdown, lap detection, placement ordering each tick, finish criteria, DNF (did-not-finish) rules, and timeout. Output is an immutable `RaceResult` consumed by the garage flow.

## Context

Phase 2 anchor task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/07-race-rules-and-structure.md`. Phase 1 had a one-lap stub; this slice replaces that stub with the full rules.

## Affected Files

- `src/game/raceRules.ts` (new): pure functions for countdown, lap, placement, DNF, finish
- `src/game/__tests__/raceRules.test.ts` (new): full lifecycle scripted with deterministic state
- `src/game/raceSession.ts` (update): replace lap-detection stub with the new module
- `e2e/race-finish.spec.ts` (new): Playwright test runs a full 3-lap race against AI and asserts finish overlay

## Edge Cases

- Two cars cross the line on the same tick: stable ordering by sub-tick progress.
- Player exits the track and gives up: DNF after configured timeout.
- Player finishes during the lap of another driver: standings update mid-tick.
- Pause during countdown: countdown resumes from where it stopped.

## Verify

- [ ] Unit tests cover countdown timing, lap detection, placement, DNF, finish.
- [ ] Determinism: two runs from the same seed produce identical `RaceResult`.
- [ ] Playwright e2e: 3-lap race finishes and shows results screen.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Researcher Stress-Test (iter-19)

The 39-line spec names the surface but pins almost no shapes. Before any implementer can hold a line on this slice, the following decisions have to be in the dot rather than negotiated mid-slice.

### 1. Countdown duration is undefined. Pin it.

§7 does not name a countdown length. Phase 1 stubbed countdown without timing. Pin:

```ts
export const COUNTDOWN_DURATION_SECONDS = 3.0;
export const COUNTDOWN_TICK_LABELS = ["3", "2", "1", "GO"];
```

`tickRaceRules(state, dt)` advances `state.elapsed` while `phase === "countdown"`. When `elapsed >= COUNTDOWN_DURATION_SECONDS` the phase transitions to `"racing"`, `elapsed` resets to 0, and the `lap` stays at 1. The `"GO"` label fires at the same tick the transition happens (label window: `(2.0, 3.0]` reads "1", `(3.0, 3.05]` reads "GO" then phase changes; pin the label window to the tick rate so the HUD never skips a beat).

Edge case: pause during countdown. `LoopHandle.pause()` already halts `elapsed` advance because the loop holds the timing origin. No raceRules change needed beyond a test.

### 2. Lap detection has a hidden contract on RaceState shape.

`RaceState` today only carries `{phase, elapsed, lap, totalLaps}` (`src/game/raceState.ts:11`). Lap detection requires per-car `(z, prevZ, lap)` triples, which the current state does not have. Pin the new shape additions:

```ts
export interface CarRaceProgress {
  carId: string;
  lap: number;             // 1-indexed during racing, totalLaps + 1 once finished
  z: number;               // current forward distance along the track in meters
  prevZ: number;           // last tick's z (for wrap detection)
  totalDistance: number;   // monotonic distance for placement ordering
  finishedAtTick: number | null;
  status: "racing" | "finished" | "dnf";
}

export interface RaceState {
  phase: RacePhase;
  tick: number;             // monotonic tick count, for replay alignment
  elapsed: number;
  lap: number;              // player's lap (preserved for HUD compat)
  totalLaps: number;
  trackLengthMeters: number;
  cars: ReadonlyArray<CarRaceProgress>;
  lastCheckpointPasses: ReadonlyMap<string, number>; // see race-checkpoint dot
}
```

The `cars` array is the source of truth; `state.lap` becomes a derived mirror of `cars[playerIndex].lap` for HUD consumers that have not migrated yet. Phase 1 dot already lists `raceSession.ts` as glue; this dot must extend `createRaceState` to accept the field.

Coupling: this dot depends on `race-checkpoint-81d86518` for anti-shortcut lap credit. If that dot lands first (recommended), `hasPassedAllCheckpoints` gates the lap increment here. If raceRules lands first, ship without the guard and add `// TODO(race-checkpoint): gate lap credit` so the future dot is a one-line wire-up.

### 3. Placement ordering rule needs a tie-break ladder.

§7 "Tie handling" lists standings tie-breaks (best finish, fastest lap, repair spend, unlock order) but those apply across a tour, not within a single race. For per-tick placement within one race the dot must pin a tighter rule. Recommend:

1. Higher `lap` wins.
2. Higher `z` (within the same lap) wins.
3. Higher `totalDistance` wins (handles wrap edge cases where two cars are split across a lap boundary on the same tick).
4. Lex order on `carId` as the deterministic floor.

The `totalDistance` field is necessary because `(lap, z)` alone cannot break ties when one car has wrapped and the other has not on the same physics tick (rare but possible at >300km/h). Document in the type comment.

### 4. DNF timeout: configured by what?

Spec says "DNF after configured timeout" but does not name where the constant lives. Pin:

```ts
export const DNF_OFF_TRACK_TIMEOUT_SECONDS = 30.0; // 30s continuously off-track at low speed
export const DNF_NO_PROGRESS_TIMEOUT_SECONDS = 60.0; // 60s with totalDistance delta < 5m
export const DNF_RACE_TIME_LIMIT_SECONDS = 10 * 60; // hard cap, 10 minutes
```

`tickRaceRules` accumulates per-car `offTrackSeconds` and `noProgressSeconds` counters. When either crosses the threshold, the car's `status` flips to `"dnf"` and `finishedAtTick` is set. The race ends when all non-DNF cars have `status === "finished"` OR when `state.elapsed > DNF_RACE_TIME_LIMIT_SECONDS`.

Per-car DNF timers reset to 0 on the tick the car returns to the road and is making progress; this prevents "drove through grass for 28s, came back for one tick, drove off again" from accidentally banking the timer.

### 5. RaceResult shape was pinned by race-results dot. Mirror it.

`race-results-7b0abfaa` already pins `RaceResult = { finishingOrder, pointsEarned, cashEarned, bonuses[], damageTaken, fastestLap, nextRace? }`. This dot ships the **race-final** half (finishingOrder, fastestLap from `min(perCarLapTimes[])`, perCarStatus). Reward computation (cash, points, bonuses) belongs to economy-upgrade-ff73b279 and consumes this output. Pin the boundary in the dot so the next implementer does not stumble across it:

```ts
export interface FinalRaceState {
  trackId: string;
  totalLaps: number;
  finishingOrder: ReadonlyArray<{ carId: string; status: "finished" | "dnf"; raceTimeMs: number | null; bestLapMs: number | null }>;
  perLapTimes: ReadonlyMap<string, ReadonlyArray<number>>; // carId -> [lap1ms, lap2ms, ...]
  fastestLap: { carId: string; lapMs: number; lapNumber: number } | null;
}
```

`buildRaceResult(finalRaceState, save, track)` lives in `race-results-7b0abfaa`'s dot; this dot owns `buildFinalRaceState(state)` only.

### 6. Function surface to land in raceRules.ts.

```ts
export function startCountdown(state: RaceState): RaceState;
export function tickRaceRules(state: RaceState, dt: number, carPositions: ReadonlyArray<{ carId: string; z: number; speed: number; offTrack: boolean }>): RaceState;
export function rankCars(state: RaceState): ReadonlyArray<CarRaceProgress>; // applies the §3 tie-break ladder
export function isRaceOver(state: RaceState): boolean;
export function buildFinalRaceState(state: RaceState, trackId: string): FinalRaceState;
```

All pure. No reads outside the arguments. No `Math.random` (nothing in this module needs randomness).

### 7. Affected Files clarifications.

- `src/game/raceState.ts` (modify, NOT just raceRules.ts): the type extensions in (2) live here so existing imports (`hudState.ts`, `loop.test.ts`, `raceState.test.ts`) keep working. Run `npx tsc --noEmit` after extending and chase the type errors; HUD's `RankedCar[]` may already be a partial mirror of `CarRaceProgress`, fold them in the same slice.
- `src/game/__tests__/raceState.test.ts` (modify): add cases for the new fields.
- `src/data/schemas.ts` (no change): no save-game shape touched here.

### 8. Verify steps that would actually catch a regression.

Replace the loose Verify list with cell-level assertions:

- [ ] `startCountdown(createRaceState(3))` returns a state with `phase === "countdown"`, `elapsed === 0`, `tick === 0`.
- [ ] After `Math.ceil(COUNTDOWN_DURATION_SECONDS / FIXED_DT) + 1` calls to `tickRaceRules` with a constant `dt = FIXED_DT`, `phase === "racing"` and `elapsed` is reset to a value within `[0, FIXED_DT]`.
- [ ] Lap detection: scripted progress `[ {z: 1900, lap: 1}, {z: 50, lap: ?} ]` on a 2000m track produces `lap === 2` after the wrap tick.
- [ ] Placement: 4-car field with progress `[(1,1500), (1,1900), (2,10), (1,800)]` returns `[carC, carB, carA, carD]` after `rankCars`.
- [ ] DNF: car held off-track at 0 speed for `DNF_OFF_TRACK_TIMEOUT_SECONDS` flips to `status === "dnf"` on exactly the tick threshold is crossed (not the next tick).
- [ ] DNF reset: car off-track 25s, returns for 6s, off-track again: `offTrackSeconds` reads near 6s on the second exit (single-cycle reset), not 25s + new accumulation.
- [ ] Race time limit: `state.elapsed` set to `DNF_RACE_TIME_LIMIT_SECONDS - dt` and one more tick flips all non-finished cars to DNF and `phase === "finished"`.
- [ ] Determinism: two runs from the same seeded input array produce deep-equal `FinalRaceState` (use `expect(a).toEqual(b)` not reference equality).
- [ ] No em-dashes (`grep -P '[\x{2013}\x{2014}]' src/game/raceRules.ts src/game/__tests__/raceRules.test.ts` returns nothing).
- [ ] Playwright `e2e/race-finish.spec.ts`: navigate to `/race?track=test-curve&laps=3`, hold ArrowUp from countdown end, assert results overlay appears within `(track.lengthMeters * laps / topSpeed) * 1.5` seconds and DOM contains `data-testid="race-results"`. Skip if Phase-1 demo route is not yet wired; the race-rules unit tests stand alone.
