---
title: "implement: racing-line tension via max-lateral-acceleration cap so hairpins must be braked into"
status: open
priority: 3
issue-type: task
created-at: "2026-05-05T23:36:48.531210-05:00"
blocks:
  - VibeGear2-implement-cornering-tuning-62491aea
  - VibeGear2-implement-re-author-47323741
---

RACING-LINE FEEL slice. Adds the missing g-load cap so the player has to brake before §9 Sharp / Hairpin corners instead of holding throttle through them. After the lateral fix and tuning pass land, the §10 'enough authority to place the car, not enough to zig-zag unrealistically' line is met for steering input but the integrator still allows arbitrary lateral acceleration: a tap of full steer at top speed produces an instantaneous v_lat that no real tyre patch could deliver. Add a per-tick cap a_lat_max (recommended default 12 m/s^2 / ~1.2 g for grip 1.0, scales with stats.gripDry per Q-016 default) so the lateralVelocity delta this tick is clamped to a_lat_max * dt; over-cap input bleeds forward speed via a quadratic understeer term so a player who pushes a hairpin too hot scrubs speed instead of teleporting through. Affected: src/game/physics.ts step() lateral block (add cap, add scrub term); add MAX_LATERAL_ACCEL_M_PER_S2 + UNDERSTEER_SCRUB_K constants; src/game/__tests__/physics.test.ts adds 'lateral velocity is capped at MAX_LATERAL_ACCEL_M_PER_S2 * dt at full steer' and 'speed scrubs by understeer term when steer demand exceeds cap'. Verify: npx vitest run src/game/__tests__/physics.test.ts plus tests-e2e/race-feel-hairpin-must-brake.spec.ts which loads a re-authored hairpin track (after the iter-2 re-author slice) and asserts that holding throttle through it loses placement vs braking-then-throttle. After: VibeGear2-implement-cornering-tuning-62491aea AND VibeGear2-implement-re-author-47323741 so the hairpin geometry exists to feel the cap.
