---
title: "implement: procedural nitro engage SFX runtime per §18"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T21:58:02.449222-05:00\\\"\""
closed-at: "2026-04-28T22:26:48.187430-05:00"
close-reason: "shipped PR #72, review threads checked, main CI and production smoke green"
---

Add a procedural SFX cue for player nitro charge start. Wire live races to play it once when the player nitro burn rises from inactive to active, through the shared AudioContext and persisted SFX mixer. Keep no-context and silent mixer no-op and cover runtime behavior with unit tests plus race wiring coverage.
