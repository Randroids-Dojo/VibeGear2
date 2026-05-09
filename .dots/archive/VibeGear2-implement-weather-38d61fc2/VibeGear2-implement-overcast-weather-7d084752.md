---
title: "implement: overcast weather option per §14"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-28T07:56:56.841987-05:00\\\"\""
closed-at: "2026-04-28T08:39:36.005321-05:00"
close-reason: "Merged PR #49 with overcast weather support, resolved Copilot review threads, green PR CI, and ready Vercel preview."
---

Add overcast to WeatherOptionSchema and runtime weather tables. Treat it as a visibility-only, grip-neutral clear-adjacent condition for tire grip, AI skill, nitro risk, pre-race labels, and rendering. Update schema/docs/tests and log coverage.
