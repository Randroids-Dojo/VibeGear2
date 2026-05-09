---
title: Fix CPU opponent sprite scale inconsistency on hills
status: closed
priority: 0
issue-type: task
created-at: "\"\\\"2026-05-01T19:22:42.462199-05:00\\\"\""
closed-at: "2026-05-01T20:34:42.601722-05:00"
close-reason: "Merged PR #153, verified main CI, and production version b99f628"
---

Observed during live play: distant CPU cars sometimes render far too small or jump scale while climbing and cresting hills. Investigate sprite projection depth, grade-adjusted camera space, and occlusion sorting so rival car scale remains plausible across elevation changes.
