---
title: "implement: F-022a projectGhostCar pure helper for §6 ghost overlay screen projection"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T15:59:00.553035-05:00\\\"\""
closed-at: "2026-04-26T16:04:05.534667-05:00"
close-reason: verified
---

Sub-slice of F-022. Pure helper exported from src/road/segmentProjector.ts (or new src/road/ghostProjection.ts) that takes (segments, camera, viewport, ghostZ, ghostX) and returns { screenX, screenY, screenW, visible } using the same pseudo-3D math as project(). Walks segments from the camera up to the ghost's z, accumulates curve/grade, applies pinhole projection. The full F-022 consumer (TT route + recorder lifecycle wiring) will call this to feed drawRoad's ghostCar prop. Verify: returns visible=false when ghost is behind camera or past draw distance; produces screenX==viewport.width/2 + scale*roadHalfX*halfW when curves accumulate to zero; matches the strip projector at integer segment boundaries; lint/typecheck/test/build/e2e all clean; no em/en-dashes.
