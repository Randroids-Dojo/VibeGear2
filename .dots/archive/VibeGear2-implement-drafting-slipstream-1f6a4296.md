---
title: "implement: drafting / slipstream race-session wiring (computeWakeOffset + tickDraftWindow + physics.step draftBonus per pair) per §10"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T05:48:22.678778-05:00\\\"\""
closed-at: "2026-04-26T06:16:55.939429-05:00"
close-reason: verified
---

src/game/drafting.ts ships pure helpers (computeWakeOffset, tickDraftWindow, INITIAL_DRAFT_WINDOW) but no consumer calls them. Wire into src/game/raceSession.ts: hold a per-follower DraftWindow keyed by (followerId, leaderId), each tick scan the field for a leader within wake range using computeWakeOffset on player+each AI, advance with tickDraftWindow consuming brake/side-step inputs, and pass the resulting accel multiplier as physics.step's draftBonus arg. Mirrors the pattern f-019 calls out for damage. Tests: 1000-tick determinism with 2 cars in tandem; brake input zeroes the bonus; side-step zeroes the bonus; pair-isolation (multiple pairs do not contaminate each other). No em/en-dashes.
