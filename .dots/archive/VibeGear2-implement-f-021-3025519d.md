---
title: "implement: F-021 SaveGameSchema integration for ghost replays + v2 migration per GDD §22 §6"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:01:37.128637-05:00\\\"\""
closed-at: "2026-04-26T13:29:18.154349-05:00"
close-reason: verified
---

blocks: F-022 (ghost-render) and F-023 (time-trial-ui) are sibling consumers; F-021 adds the storage shape they read. The feat/ghost-replay-recorder slice ships src/game/ghost.ts as a producer (createRecorder, createPlayer, Replay, INPUT_FIELDS, RECORDER_SOFT_CAP_TICKS, RECORDER_HARD_CAP_TICKS). JSON-clean Replay shape is unwired into the §22 save schema today.

Land:
1. Add ghosts: z.record(slug, GhostReplaySchema).optional() to SaveGameSchema in src/data/schemas.ts. GhostReplaySchema mirrors the Replay type.
2. Bump CURRENT_SAVE_VERSION to 2.
3. Register a v1 to v2 migration that adds an empty ghosts: {} slot to existing saves.
4. Add a best-ghost comparison helper: replace stored ghost iff newReplay.finalTimeMs < currentReplay.finalTimeMs; tied times keep the older ghost to avoid churn (per dot stress-test item 8).
5. Update the cross-tab broadcast slice if needed to handle replay deltas in storage events.

Storage budget: ~1 KB per 10s lap deltas; a 5min PB ghost is ~30 KB. If on-wire size becomes a problem, switch to base64-packed Uint8Array deltas in REPLAY_FORMAT_VERSION 2 (additive; old replays migrate forward).

Affected files:
- src/data/schemas.ts (update): add GhostReplaySchema + ghosts slot.
- src/game/save.ts or migration registry (update): v1 to v2 migration.
- src/game/ghost.ts (update): bestGhostFor helper.
- src/data/__tests__/schemas.test.ts (update): ghost slot round-trip + migration test.
- docs/FOLLOWUPS.md: F-021 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- A v1 save loaded via migrateSave gains ghosts: {} and reports schema version 2.
- A new replay with smaller finalTimeMs replaces the old one; tied time keeps the old.
- No em-dashes in changed files.
