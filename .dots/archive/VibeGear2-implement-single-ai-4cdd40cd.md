---
title: "implement: single AI car (clean_line archetype) per §15"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:44.558185-05:00\\\"\""
closed-at: "2026-04-26T02:41:10.926865-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-arcade-physics-2efae8b6
---

## Description

Implement one AI car using the `clean_line` archetype from `docs/gdd/15-cpu-opponents-and-ai.md`. The AI uses progress-space logic (ideal lane and target speed per segment) to drive without colliding with the player. Pure function: `(aiState, raceState, dt) -> Input`.

## Context

Phase 1 vertical slice goal: a single AI car that proves the AI shape works end to end. Later slices add archetypes (aggressive, mistake-prone, weather-skilled) and full grid behaviour.

## Affected Files

- `src/game/ai.ts` (new): `tickAI(driver, aiState, raceState, dt) -> Input`
- `src/game/__tests__/ai.test.ts` (new): given a known race state, the AI returns expected throttle / steer
- `src/data/examples/ai-cleanline.json` (new): the example AI driver from §22

## Edge Cases

- AI behind player (no immediate threat): drive ideal line.
- AI in same lane as player ahead: brief out-of-lane to overtake.
- AI off-track: corrective steer back to the racing line.
- Race not yet started (countdown): output zero input.

## Verify

- [ ] Unit tests pass: deterministic outputs for known inputs.
- [ ] Visual smoke at `/dev/road` shows one AI car driving the track without crashing into walls.
- [ ] Replay determinism test: feeding the same race state to AI 1000 times yields the same `Input`.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 14, researcher pass)

The current spec underspecifies the call-site contract. An implementer trying to write `tickAI` would have to invent several types not pinned anywhere. Concrete decisions to add to this dot before implementation begins:

1. **`AIState` is undefined.** The dot's signature mentions `aiState` but the codebase has no `AIState` type. GDD §15 "Implementation approach" lists the four runtime fields:
   ```
   ai.progress       // scalar position along lap spline (compiled-segment index, fractional)
   ai.laneOffset     // signed lateral position in road width, in meters
   ai.speed          // current speed m/s
   ai.intent         // "defend" | "overtake" | "recover" | "conserve"
   ```
   Pin this as `interface AIState` in `src/game/ai.ts`. Add a fifth field: `targetSpeed: number` (the AI's requested speed for this segment, used by the throttle/brake controller). Add a sixth: `seed: number` for the per-AI PRNG channel (mistakes, nitro decisions). Even the `clean_line` slice needs `seed` because §15 says clean_line is "stable pace" but archetypes share infrastructure and adding `seed` later would force a breaking signature change.

2. **`RaceState` does not carry track or car-position info.** `src/game/raceState.ts` currently exposes `{phase, elapsed, lap, totalLaps}`. The AI cannot compute "ideal lane and target speed per segment" from that alone. The AI needs at minimum:
   - The compiled track (for segment curve, grade, lane count).
   - The player's position (z, x, speed) to detect "AI behind player" / "same lane ahead".
   - The AI's own car state.

   Resolve by changing the signature to:
   ```ts
   tickAI(
     driver: AIDriver,             // §22 schema
     aiState: AIState,
     aiCar: CarState,              // physics.CarState; the AI's own kinematic state
     player: { car: CarState },    // minimal player view; expand later for ghost/replay
     track: CompiledTrack,         // the lap data
     race: RaceState,              // phase + elapsed for countdown gating
     dt: number,
   ): { input: Input; nextAiState: AIState }
   ```
   Returning `nextAiState` alongside `input` keeps the function pure and makes determinism tests trivial (deep-equal two runs).

3. **`Input` is the right output type but it constrains AI behaviour.** `src/game/input.ts` `Input` carries discrete `nitro: boolean` and `handbrake: boolean`. The AI must trigger these from continuous decisions; pin a "nitro is fired when `targetSpeed - aiCar.speed > NITRO_TRIGGER_GAP` AND `nitroBudget >= 1` AND segment is straight (`|curve| < CLEAN_LINE_NITRO_CURVE_LIMIT`)" rule. For the clean_line single-AI slice, set `nitro = false` always and defer nitro to the full-AI dot. Document this explicitly so the test does not assert nitro behaviour the slice does not implement.

4. **"Ideal lane" needs a concrete formula.** §15 describes "Track defines a center path and suggested racing line bias curves" but no track field encodes a per-segment racing-line bias. For the clean_line slice, derive ideal lateral offset from the segment curve directly:
   ```
   idealLateralOffset = -segment.curve * MAX_RACING_LINE_OFFSET
   // Rationale: drive to the inside of curves. Sign matches segment.curve sign convention.
   // MAX_RACING_LINE_OFFSET = roadHalfWidth * 0.7 to keep margin.
   ```
   This is a Phase-1-acceptable approximation. The track-bias-curve field can be added later for tighter racing lines without breaking the AI signature.

5. **"Target speed per segment" needs a concrete formula.** Pin:
   ```
   targetSpeed = clamp(
     car.topSpeed * (1 - CLEAN_LINE_CURVE_DECEL * |segment.curve|) * driver.paceScalar,
     MIN_AI_SPEED,
     car.topSpeed,
   )
   ```
   Constants: `CLEAN_LINE_CURVE_DECEL = 0.6` (a curve of 0.5 cuts target speed by 30% before paceScalar). `MIN_AI_SPEED = 8 m/s` so the AI never stops on pathological corners.

6. **Throttle / brake mapping from `targetSpeed` to `Input`.** Pin:
   ```
   const speedError = targetSpeed - aiCar.speed;
   if (speedError > SPEED_HYSTERESIS) {
     throttle = 1; brake = 0;
   } else if (speedError < -SPEED_HYSTERESIS) {
     throttle = 0; brake = clamp(-speedError / BRAKE_RAMP, 0, 1);
   } else {
     throttle = clamp(speedError / SPEED_HYSTERESIS, 0, 1); brake = 0;
   }
   ```
   `SPEED_HYSTERESIS = 1.5 m/s`, `BRAKE_RAMP = 6 m/s` (full brake at 6 m/s over).

7. **Steer mapping from `idealLateralOffset` to `Input.steer`.** Pin a P-controller:
   ```
   const lateralError = idealLateralOffset - aiCar.x;
   steer = clamp(lateralError / STEER_GAIN, -1, 1);
   ```
   `STEER_GAIN = 1.5 m`. The car steers full left/right when error exceeds 1.5 m. Smoothing not required for clean_line.

8. **"Brief out-of-lane to overtake" is OUT OF SCOPE for this dot.** §15 lists overtake as a behaviour, but the dot's Description says "single AI car that proves the AI shape works end to end". Defer overtake logic to `implement-full-ai-fab57b84` and update this dot's Edge Cases to remove the "AI in same lane as player ahead: brief out-of-lane to overtake" bullet. The clean_line single-AI slice MAY collide with the player; later AI-grid + overtake slices land collision avoidance.

9. **"Ai off-track" recovery.** The same steer P-controller already pulls the AI back toward `idealLateralOffset` when off-track because lateral error grows. Document this as the recovery mechanism; no separate state needed.

10. **Countdown gating.** Pin: `if (race.phase !== "racing") return { input: NEUTRAL_INPUT, nextAiState: aiState }`. The AI does NOT integrate during countdown.

11. **Determinism.** No `Math.random`, no `Date.now`. The clean_line implementation uses zero randomness. Tests that assert "1000 calls return identical input" should `expect(input).toEqual(input2)` for two calls with deep-cloned state, not actually run a 1000-loop (CPU waste).

12. **Files list refinement.**
    - `src/game/ai.ts` (new). Exports: `interface AIState`, `tickAI(...)`, `AI_TUNING` constants object (hysteresis, gains, etc), `cleanLineConstants`.
    - `src/game/__tests__/ai.test.ts` (new). Tests:
      a. Countdown phase returns `NEUTRAL_INPUT`.
      b. Straight segment + below target speed: `throttle = 1, brake = 0, steer ~ 0`.
      c. Curve segment + at target speed: `throttle in (0, 1), brake = 0, |steer| > 0`.
      d. Off-track (aiCar.x = 6 m, road half-width = 4 m): `steer < 0` (pulls back to center).
      e. At target speed exactly: throttle low, brake zero (hysteresis).
      f. Determinism: same input twice, deep-equal output.
    - `src/data/examples/ai-cleanline.json`: this file ALREADY exists at `src/data/examples/aiDriver.example.json`. Either rename or reuse; recommend reusing the existing example and dropping the new file from this dot.

13. **The `blocks: implement-arcade-physics-2efae8b6` link is suspicious.** Physics is a foundational dependency of AI; AI consumes physics. AI cannot block physics. Suggest this dot's `blocks` field should be empty or list `implement-phase-1-7aef013d` (the vertical slice integration). Audit before activating.

### Pre-flight required before implementer starts

Implementer should pin item 2 (the new `tickAI` signature) and item 12 (file list) in a quick spec-update commit before writing code. Items 4-7 are concrete enough to encode directly. Items 8 and 13 should be reflected in the dot description so reviewers know overtake / collision avoidance is intentionally deferred.
