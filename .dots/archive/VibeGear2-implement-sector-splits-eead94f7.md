---
title: "implement: sector-splits HUD widget race-session wiring (sectorTimer state on RaceSessionState + drawSplitsWidget mount in /race) per §20"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T05:48:27.891060-05:00\\\"\""
closed-at: "2026-04-26T05:57:31.362564-05:00"
close-reason: verified
---

src/game/sectorTimer.ts and src/render/hudSplits.ts (drawSplitsWidget) are implemented but unwired. /race/page.tsx only calls drawHud. Add SectorTimerState to RaceSessionState in src/game/raceSession.ts, init at race-start using track.sectors metadata (or projected splits if absent), advance via tickSectorTimer each tick from player.car.z + lap, and call drawSplitsWidget(ctx, splitsState, viewport) right after drawHud in src/app/race/page.tsx. Tests: per-car sector tick determinism; first-lap delta is null until a baseline lap exists; widget receives well-formed SplitsState every frame after countdown. No em/en-dashes.
