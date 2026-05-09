---
title: "implement: F-022b ghost driver helper (createGhostDriver per §6)"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T16:18:01.507348-05:00\""
closed-at: "2026-04-26T16:18:43.015886-05:00"
close-reason: "verified: lint+typecheck+test (2106)+build+e2e (50) all green; landed in feat/f-022b-ghost-driver-helper as commit 0af08d5; FOLLOWUPS F-022 entry updated with sub-slice note"
---

Sub-slice of F-022. Adds src/game/ghostDriver.ts: createGhostDriver({replay, stats, ...}) returns a stateful per-tick driver that wraps createPlayer + step + projectGhostCar so the eventual Time Trial route slice can wire ghost overlay in three lines. Null replay and version-mismatched replay both surface as tick(...) returns null so the route does not need a guard. Tests pin null-replay no-op, version-mismatch no-op, per-tick step bit-equality with reference step, default and override alpha/fill, off-screen null + lastProjection debug surface, finished latching, and determinism across two drivers.
