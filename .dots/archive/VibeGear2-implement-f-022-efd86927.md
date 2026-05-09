---
title: "implement: F-022 render the ghost car in pseudoRoadCanvas.ts per §6 §16"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:01:49.804211-05:00\\\"\""
closed-at: "2026-04-26T14:32:06.159519-05:00"
close-reason: verified
---

blocks: F-021 (save-schema integration) so the ghost can be retrieved per-track; visual-polish slice (atlas frames). The ghost slice produces a Player whose readNext(tick) returns the input the recorded driver pressed on each tick.

Wiring:
1. Consumer drives a second physics step from those inputs (same step() call, separate CarState) to derive the ghost's (z, x, speed) for the current tick.
2. Pass that to pseudoRoadCanvas.drawRoad as a ghostCar?: { z: number; x: number; alpha: number } field.
3. Drawer paints the ghost with ctx.globalAlpha = 0.5 (default per dot stress-test item 9) using the same player-car atlas frame the live car renders, optionally tinted blue or desaturated to differentiate.

Atlas frames land with the visual-polish slice (VibeGear2-implement-visual-polish-7d31d112); do this slice after that one.

Affected files:
- src/road/pseudoRoadCanvas.ts (update): ghostCar prop + alpha render path.
- src/game/raceSession.ts or time-trial driver (update): step ghost physics from Player.readNext, surface ghost (z, x, alpha) to the renderer.
- src/road/__tests__/pseudoRoadCanvas.test.ts (update): ghost is rendered with reduced alpha when ghostCar prop is present; absent when undefined.
- docs/FOLLOWUPS.md: F-022 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- A time-trial run with a stored ghost shows a translucent second car following the recorded path.
- No em-dashes in changed files.
