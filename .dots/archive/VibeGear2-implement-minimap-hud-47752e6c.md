---
title: "implement: minimap HUD overlay race-session wiring (drawMinimap mount in /race using compiled.minimapPoints + car positions) per §20"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T05:48:33.497025-05:00\\\"\""
closed-at: "2026-04-26T06:02:07.110132-05:00"
close-reason: verified
---

src/road/minimap.ts (projectTrack) and src/render/hudMinimap.ts (drawMinimap) are implemented; trackCompiler already populates compiled.minimapPoints. But /race/page.tsx never calls drawMinimap, so the HUD widget never paints. Wire by computing per-car normalised footprint positions each frame (player + AI list -> normalised x/z onto minimap unit square using compiled.totalLengthMeters and ROAD_WIDTH) and calling drawMinimap(ctx, minimapPoints, carPositions, viewport) inside the loop's render branch right after drawHud. Tests: pure projection matches existing test fixtures; widget receives stable input across frames during countdown; player dot stays inside the unit square even at maxX. No em/en-dashes.
