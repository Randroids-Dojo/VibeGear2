---
title: "implement: procedural impact SFX runtime per §18"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T21:24:26.779671-05:00\\\"\""
closed-at: "2026-04-28T21:55:15.894100-05:00"
close-reason: "shipped PR #71, review threads checked, main CI and production smoke green"
---

Expose per-tick player impact events from the race session damage pass and add procedural SFX for car contact, wall or hazard hits, and rub-style low impacts. Wire live races to play the impact tone through the shared audio context and persisted SFX mixer, keep no-context and silent-mixer paths no-op, and cover the event producer plus runtime with deterministic tests.
