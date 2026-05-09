---
title: implement audio engine and mixer primitives
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T17:36:43.347692-05:00\\\"\""
closed-at: "2026-04-28T18:18:00.838919-05:00"
close-reason: "shipped PR #64 and PR #65, review threads resolved, main CI and production smoke green"
---

Add pure §18 audio primitives for engine pitch and mixer gain resolution. Scope is code-only: no AudioContext hookup, no generated audio assets, no route playback. Cover pitch monotonicity, deterministic purity, disabled/no-op mix resolution, and persisted audio setting defaults.
