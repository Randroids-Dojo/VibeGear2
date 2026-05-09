---
title: "implement: weather state transitions per §14"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-28T09:33:30.837677-05:00\\\"\""
closed-at: "2026-04-28T10:21:12.990984-05:00"
close-reason: "Merged PR #51 with deterministic weather state transitions, green PR CI and Vercel preview, green main CI and production smoke."
---

Add deterministic WeatherState transitions constrained by track weatherOptions, default to no runtime change unless configured, and document/test the state-machine coverage.
