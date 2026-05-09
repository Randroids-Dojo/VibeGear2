---
title: "implement: F-023 Time Trial UI wiring for the ghost recorder per §6"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T13:02:01.298878-05:00\""
closed-at: "2026-04-26T15:55:31.277536-05:00"
close-reason: "verified: src/game/timeTrial.ts orchestrator + 19 unit tests; lint, typecheck, test, build, e2e all green; FOLLOWUPS + PROGRESS_LOG updated; F-023 closed"
---

blocks: F-021 (save-schema for ghost storage) and the time-trial mode slice (VibeGear2-implement-time-trial-5d65280a). The feat/ghost-replay-recorder slice ships src/game/ghost.ts as a producer module: createRecorder, createPlayer, Replay, INPUT_FIELDS mask order, cap constants (RECORDER_SOFT_CAP_TICKS, RECORDER_HARD_CAP_TICKS). 34 unit tests cover all paths.

Consumer wiring:
1. Instantiate createRecorder on the green-light tick of a Time Trial run.
2. Call record(input, tick) from the same simulate callback that drives physics.
3. Call finalize() on the finish-line tick.
4. Compare replay.finalTimeMs against the stored PB before deciding whether to overwrite (use bestGhostFor helper from F-021).
5. Persist the new PB ghost via the §22 save slot.

Until F-021 lands, the module is a producer waiting for a consumer (mirroring F-019 / F-013 deferral pattern).

Affected files:
- src/app/time-trial/page.tsx or equivalent (new/update): Time Trial run wires recorder.
- src/game/timeTrial.ts (new/update): orchestrates recorder lifecycle alongside physics step.
- src/game/__tests__/timeTrial.test.ts (new): green-light tick spawns recorder, finish tick finalizes, faster time replaces stored PB.
- docs/FOLLOWUPS.md: F-023 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- A Time Trial finish below stored PB persists the new ghost; a slower run does not overwrite.
- No em-dashes in changed files.
