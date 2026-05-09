---
title: "implement: fix lateral-velocity unit error so steering integrates as m/s, not m/tick"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:36:21.861120-05:00"
---

PHYSICS BUG FIX. src/game/physics.ts:418 currently does state.x + lateralVelocity (no * dt) so lateral motion is 60x too fast at 60Hz. At top speed (61 m/s, full steer, gripDry 1.0, steerRate 1.25 rad/s) the car crosses the 9m drivable width in ~118 ms; GDD §10 + small-angle physics says it should take ~7 s. Fix: change line to nextX = state.x + lateralVelocity * dt, since lateralVelocity = yawDelta * nextSpeed already has units rad*m/s = m/s. Bumps PHYSICS_VERSION 3 -> 4 (invalidates v3 ghost replays per the existing pattern in src/game/physics.ts:103). Affected: src/game/physics.ts step() lateral integration; src/game/physics.ts PHYSICS_VERSION; src/game/__tests__/physics.test.ts (existing 'respects analog steer magnitude', 'steering authority decreases with speed' tests stay green; add 'top speed full steer crosses 4.5m road in >= 2s' and 'lateral displacement scales linearly with dt'). Verify: npx vitest run src/game/__tests__/physics.test.ts. Plus a Playwright spec e2e/race-feel-lateral-pace.spec.ts that drives full steer at top speed for 1 s on a straight Velvet Coast track and asserts the player car moved less than 4 m laterally.

## Implementation Notes (iter-7 pre-flight)

The implementor should not need to derive any of the math below.
Copy the test block verbatim, swap names if the local fixture helper
names differ, and ship.

### Source equation, replayed exactly as iter-4 captured

`src/game/physics.ts:401-418` (current code):

    const steerInput  = clamp(input.steer, -1, 1);
    const steerRate   = steerRateForSpeed(nextSpeed, stats.topSpeed);
    const yawDelta    = steerInput * steerRate * dt * tractionScalar;
    let lateralVelocity = yawDelta * nextSpeed;
    lateralVelocity = lateralVelocity * (1 - steeringAssistScale);
    const nextX      = state.x + lateralVelocity;          // BUG (no * dt)
    // FIX:           = state.x + lateralVelocity * dt

`steerRateForSpeed` (`physics.ts:172-176`) returns
`lerp(STEER_RATE_LOW_RAD_PER_S=2.3, STEER_RATE_HIGH_RAD_PER_S=1.25,
clamp(speed/topSpeed, 0, 1))`.

STARTER_STATS (the test fixture) ships `topSpeed = 61`, `gripDry = 1.0`
per the §23 starter row. With no weather and no off-road, `tractionScalar
= 1`. With no assist, `steeringAssistScale = 0` so the multiplier `(1 -
steeringAssistScale) = 1`.

### Per-tick numerical expectations after the fix

For a single `step()` call with `dt = 1/60`:

| input                        | speedNorm | steerRate (rad/s) | yawDelta (rad) | lateralVelocity (m/s) | nextX (m)  |
| --                           | --        | --                | --             | --                    | --         |
| x=0, steer=-1, speed=60      | 0.98361   | 1.26721           | -0.02112023    | -1.267214             | -0.0211202 |
| x=0, steer=+1, speed=30      | 0.49180   | 1.78361           |  0.02972681    |  0.891803             |  0.0148634 |
| x=0, steer=0,  speed=60      | 0.98361   | 1.26721           |  0             |  0                    |  0         |
| x=0.5, steer=-1, speed=0     | 0         | 2.30000           | -0.03833333    |  0  (lat = yaw * 0)   |  0.5       |

speedNorm = clamp(speed/61, 0, 1). The numbers above use exact fractions
all the way through; floating point round-off may alter the last digit.

### Vitest block (paste into src/game/__tests__/physics.test.ts)

The existing `describe("step (steering)", ...)` block is the right home.
Add the four new cases below. Each one names the dot fix it pins so the
audit trail survives a future test refactor.

    // iter-4 fix pin: post-fix lateralVelocity is m/s, integrated over dt.
    it("steer = -1 at speed 60 m/s nudges x by -1.267 m/s * dt (post-fix)", () => {
      const start = freshState({ speed: 60 });
      const s = step(start, withInput({ steer: -1 }), STARTER_STATS, ROAD, DT);
      // Tolerance allows §10 trapezoidal upgrades; 1e-3 m is sub-pixel
      // at our projection scale.
      expect(s.x).toBeCloseTo(-0.02112, 4);
    });

    it("steer = +1 at speed 30 m/s nudges x by 0.892 m/s * dt (post-fix)", () => {
      const start = freshState({ speed: 30 });
      const s = step(start, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
      expect(s.x).toBeCloseTo(0.014863, 4);
    });

    it("steer = -1 at speed 0 m/s leaves x unchanged (lateralVelocity = 0)", () => {
      const start = freshState({ speed: 0, x: 0.5 });
      const s = step(start, withInput({ steer: -1 }), STARTER_STATS, ROAD, DT);
      expect(s.x).toBe(0.5);
    });

    // iter-4 hand-off: top-speed full steer must take >= 2s to cross
    // half-road. Pre-fix value was ~0.06s (60x over-shoot). Post-fix
    // with current §10 constants is ~3.5s; the cornering-tuning slice
    // (62491aea) lifts steerRateHigh later to bring this toward the
    // §10 / TG2 target of ~1.5s, but the bound here is a regression
    // pin, not a feel pin.
    it("at top speed full steer crosses 4.5m half-road in >= 2s", () => {
      let s = freshState({ speed: STARTER_STATS.topSpeed });
      const TICKS = 60 * 2; // 2 seconds at 60Hz
      for (let i = 0; i < TICKS; i += 1) {
        s = step(s, withInput({ steer: 1 }), STARTER_STATS, ROAD, DT);
      }
      expect(s.x).toBeLessThan(ROAD.roadHalfWidth);
    });

    // iter-4 hand-off: dt linearity. Halving dt and doubling tick
    // count should converge on the same final x (Euler integrator,
    // first-order). Tolerance loose enough to allow small numerical
    // drift across step boundaries.
    it("lateral displacement scales linearly with dt", () => {
      let coarse = freshState({ speed: 40 });
      let fine = freshState({ speed: 40 });
      for (let i = 0; i < 30; i += 1) {
        coarse = step(coarse, withInput({ steer: 1 }), STARTER_STATS, ROAD, 1 / 60);
      }
      for (let i = 0; i < 60; i += 1) {
        fine = step(fine, withInput({ steer: 1 }), STARTER_STATS, ROAD, 1 / 120);
      }
      // Same elapsed time (0.5s) at different dt; final x should match
      // within 5% (Euler error scales with dt).
      expect(fine.x).toBeCloseTo(coarse.x, 2);
    });

### TG2 reference replay (iter-4)

iter-4 cited "~3 m/s lateral at 250 km/h on dry" as the TG2 target. At
69.4 m/s top speed, 3 m/s lateral velocity gives a 4.5 m cross in 1.5 s.
With current STARTER_STATS (61 m/s top, 1.25 rad/s high steer rate,
gripDry 1.0), lateralVelocity = 1.25 * 1 * 61 = 76.25... no, that's the
yawDelta-bug shape. Post-fix lateralVelocity per second at top speed
full steer = steerRate * tractionScalar * speed = 1.25 * 1 * 61 = 76.25
CONTRADICTS the m/s reading. Re-derive: steerRate is rad/s, speed is
m/s, so steerRate * speed = rad * m/s2 -> dimensionally m/s2, an
acceleration; the variable named lateralVelocity in code is actually
the small-angle linearization v * sin(yawDelta) ~= v * yawDelta where
yawDelta is rad PER TICK. So lateralVelocity = v * (steerRate * dt) =
61 * 1.25 * (1/60) = 1.27 m PER TICK, equivalent to 76.2 m/s if
treated as m/s, but in fact m/tick. The fix multiplies by dt one more
time so the per-tick displacement = 1.27 * (1/60) = 0.0212 m, which
implies a steady-state 1.27 m/s lateral. Time to cross 4.5 m at
1.27 m/s = 3.54 s. Iter-4 names this as the post-fix order-of-magnitude
result; the cornering-tuning slice tunes it toward the 1.5 s TG2
reference.

The unit-test pin `>= 2s` is therefore loose-but-correct: it catches
the bug (which would cross in 0.06 s) without coupling to the steer-rate
constants (which the cornering-tuning slice will tune). The implementor
does NOT need to lift steerRateHigh in this slice.

### Regression-risk audit (iter-7)

Walked every steering / lateral assertion in the repo against the
post-fix formula. Files audited:

- `src/game/__tests__/physics.test.ts`
- `src/game/__tests__/raceSession.test.ts`
- every spec under `e2e/`

#### Assertions that PASS unchanged

All of the following are sign-only or relative-ratio assertions. The
fix scales every lateral term by the same `* dt` so signs and ratios
are preserved verbatim. None of them pin an absolute pixel or metre
value for `state.x`.

- `step (steering)` block (`physics.test.ts:161-203`):
  - "produces no lateral movement at zero speed" - asserts `s.x === 0`.
    Post-fix `lateralVelocity * dt = 0 * dt = 0`. PASS.
  - "steers right at moderate speed" - asserts `s.x > 0`. Sign only.
    PASS.
  - "steers left at moderate speed" - asserts `s.x < 0`. Sign only.
    PASS.
  - "steering authority decreases with speed (low > high)" - asserts
    `slowResult.x / slow.speed > fastResult.x / fast.speed`. Both sides
    scale by the same `* dt` so the ratio is preserved. PASS.
  - "steer = 0 leaves x unchanged at any speed" - asserts `s.x ===
    start.x`. Post-fix `lateralVelocity * dt = 0`. PASS.
  - "respects analog steer magnitude" - asserts `half.x ≈ full.x * 0.5`
    with `toBeCloseTo(..., 6)`. Both sides scale by the same `* dt`
    factor; the 0.5 ratio is preserved exactly. PASS.
- `step (weather grip scalar)` block (`physics.test.ts:206-225`):
  - "lower weather grip reduces lateral authority" - relative
    `Math.abs(rain.x) < Math.abs(clear.x)`. PASS.
  - "omitting weatherGripScalar preserves prior output" - asserts
    `b === a` (deep equal). Both runs share the same `* dt`. PASS.
- `step (assists)` block (`physics.test.ts:461-524`):
  - "steeringAssistScale 0.25 (Beginner) reduces lateral drift" -
    asserts `Math.abs(beginner.x) ≈ Math.abs(identity.x) * 0.75` with
    `toBeCloseTo(..., 6)`. The `(1 - steeringAssistScale)` multiplier
    applies BEFORE the `* dt` multiplication, so the ratio identity
    survives. PASS.
  - "steeringAssistScale 0.0 (Expert) preserves identity steering" -
    `expert.x ≈ identity.x` with `toBeCloseTo(..., 6)`. PASS.
  - "Balanced scalars apply a small steering assist (§28 default)" -
    `Math.abs(balanced.x) ≈ Math.abs(identity.x) * 0.9`. Same ratio
    argument. PASS.
  - "omitting assistScalars preserves the pre-§28 behaviour" - deep
    equal. PASS.
- `raceSession.test.ts`:
  - "applies active weather grip to player steering" (`L249-251`) -
    relative `Math.abs(rain.player.car.x) < Math.abs(clear.player.car.x)`.
    PASS.
  - "applies the selected player tire channel to weather grip" (`L342-
    344`) - relative `Math.abs(wet) > Math.abs(dry)`. PASS.
  - "session lifecycle resets assist memory when the lights go green"
    (`L1672-1699`) - asserts `smoothedSteer` is in `(-1, 0)` after one
    tick of left steer. Smoothing memory is upstream of the lateral
    integrator and unaffected by the fix. PASS.

#### Assertions that PIN THE BUG

None. Walked every assertion in physics.test.ts and raceSession.test.ts
that mentions `x`, `state.x`, `player.car.x`, `lateral`, or `steer`.
None encode a literal "59 ms full traverse" or any other absolute
metre/second value that would only be true with the buggy 60x over-
shoot. The fix slice does NOT need to update any existing test.

#### e2e specs

`grep -rln "lateral\|player.x\|carX\|drift\|cross.*road\|lane" e2e/`
returned three matches: `race-demo.spec.ts`, `race-finish.spec.ts`,
`pause-overlay.spec.ts`. Inspected each: the only actual lateral
references are paint-colour scans (`lanePaint = r >= 220 && g >= 220
&& b >= 220` in `race-demo.spec.ts`). No e2e spec asserts a player x
value or a road-cross duration. PASS.

#### Verdict

Zero existing assertions need updating. Fix plus the four new pinning
unit tests above ship as a single PR. The PHYSICS_VERSION bump and
ghost replay invalidation are the only externally-visible regressions,
and both are documented in the dot body.
