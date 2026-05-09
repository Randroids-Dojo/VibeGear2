---
title: "implement: HUD damage and weather grip indicators per §20"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-28T13:24:55.294571-05:00\\\"\""
closed-at: "2026-04-28T14:01:21.368525-05:00"
close-reason: "Merged PR #57 with HUD damage, weather, and grip indicators, resolved Copilot review feedback, green PR and main CI, green production deploy, and smoke tested production."
---

Add bottom-left live damage, weather icon, and grip hint to HudState, drawHud, and race route wiring. Keep fields optional and renderer-guarded. Verify with hudState and uiRenderer tests plus focused race route coverage if available.
