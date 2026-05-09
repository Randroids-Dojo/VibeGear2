---
title: "fix(ci): raise verify timeout for cross-browser smoke"
status: closed
priority: 1
issue-type: task
created-at: "\"2026-05-02T01:47:30.874455-05:00\""
closed-at: "2026-05-02T02:32:44.980164-05:00"
close-reason: "Merged PR #159 and verified main CI with extended timeout."
---

Main CI for 762cf51 completed lint, typecheck, unit, Chromium e2e, and quality gates, then hit the 30 minute verify timeout while installing Firefox and WebKit for cross-browser smoke. Raise the verify job timeout so main can finish the required smoke.
