---
title: "implement: e2e race-finish Playwright spec (multi-lap race vs AI -> assert results overlay) per §7 §20 F-029"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T07:54:56.992008-05:00\""
closed-at: "2026-04-26T09:53:53.713095-05:00"
close-reason: verified
---

Land e2e/race-finish.spec.ts that runs a full multi-lap race against AI and asserts the results overlay appears. Blocked on the §7 results screen (race-results-7b0abfaa) landing data-testid='race-results' and the lap-completion path surfacing a finish UI. Today the unit-level coverage in stepRaceSession (lap-completion + time-limit) stands alone. Closes F-029. See docs/FOLLOWUPS.md F-029.
