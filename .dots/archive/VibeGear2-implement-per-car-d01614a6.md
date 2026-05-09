---
title: "implement: per-car DNF runtime tracking (off-track / no-progress timers + multi-car finishing order) per §7 F-028"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T07:54:49.664607-05:00\\\"\""
closed-at: "2026-04-26T08:06:45.272677-05:00"
close-reason: verified
---

Wire the pure helpers tickDnfTimers + DNF_OFF_TRACK_TIMEOUT_SEC + DNF_NO_PROGRESS_TIMEOUT_SEC + DNF_OFF_TRACK_RESET_SPEED_M_PER_S from src/game/raceRules.ts into stepRaceSession. Requires shape changes: per-car status / offTrackSec / noProgressSec / lastProgressMark fields on RaceState (or parallel carDnf map on RaceSessionState) + per-car AI lap counter so a DNF'd AI is no longer integrated. Land alongside multi-car finishing order (currently player-only). Closes F-028. See docs/FOLLOWUPS.md F-028.
