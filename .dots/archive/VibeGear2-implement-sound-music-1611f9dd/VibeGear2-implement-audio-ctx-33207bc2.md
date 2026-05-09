---
title: implement audio context lifecycle primitives
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-28T18:19:32.864990-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-28T18:50:58.782242-05:00"
close-reason: "shipped PR #66, review thread resolved, main CI and production smoke green"
---

Add Web Audio context singleton primitives for §18/§21: lazy creation after an explicit caller gesture, safe no-op path when Web Audio is unavailable, resume and suspend helpers, and document visibility suspension. Cover with unit tests before later engine, SFX, and music playback slices consume it.
