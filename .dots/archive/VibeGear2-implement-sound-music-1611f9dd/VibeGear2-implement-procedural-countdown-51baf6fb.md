---
title: "implement: procedural countdown SFX runtime per §18"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T20:42:34.824103-05:00\\\"\""
closed-at: "2026-04-28T21:22:45.523990-05:00"
close-reason: "shipped PR #70, refreshed Vercel token, reran main CI deploy, and production smoke is green"
---

Add a procedural Web Audio countdown tick/go SFX runtime using the shared audio context and persisted SFX mixer gain. Wire it into live races without audio assets, keep no-context and silent mixer paths no-op, stop scheduled one-shots on race teardown, and cover countdown playback behavior with unit tests plus race smoke coverage.
