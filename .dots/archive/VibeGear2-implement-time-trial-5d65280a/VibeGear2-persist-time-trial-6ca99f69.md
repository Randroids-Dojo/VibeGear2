---
title: persist Time Trial PB records
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T17:00:21.514793-05:00\\\"\""
closed-at: "2026-04-28T17:36:10.246791-05:00"
close-reason: "shipped PR #63, Copilot threads resolved, main CI and production smoke green"
---

Persist Time Trial personal best records from the existing result-builder recordsUpdated patch while keeping creditsAwarded at 0 and not persisting damage. Update results UI or tests as needed so a finished time trial writes save.records[trackId].bestLapMs and a slower run preserves the existing PB.
