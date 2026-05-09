---
title: "implement: F-046 wire BASE_REWARDS_BY_TRACK_DIFFICULTY consumers in track JSON per §23 §8"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T11:10:33.630219-05:00\\\"\""
closed-at: "2026-04-26T11:43:39.094467-05:00"
close-reason: verified
---

blocks: F-046 follow-up. §23 balancing-pass pinned BASE_REWARDS_BY_TRACK_DIFFICULTY in src/game/economy.ts as a frozen lookup keyed by difficulty rating 1..5. Track JSON files under src/data/tracks/ do not yet declare a per-track difficulty rating that consumes the table. Natural home is the championship slice (VibeGear2-implement-tour-region-d9ca9a4d): each track entry resolves baseRewardForTrackDifficulty(track.difficulty) and feeds the result into awardCredits.input.baseTrackReward. Until that lands, the helper is a no-op for the runtime; the constant is authoritative for the future wiring slice. Add per-track difficulty ratings to existing track JSON, thread baseTrackReward into the race-finish awardCredits call, and replace the F-046 placeholder with an import-and-assert balancing test.
