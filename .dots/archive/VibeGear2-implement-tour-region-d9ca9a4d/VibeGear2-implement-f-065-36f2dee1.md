---
title: "implement: F-065 active tour progression"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-27T23:01:59.239005-05:00\\\"\""
closed-at: "2026-04-27T23:43:05.205647-05:00"
close-reason: "Implemented in PR #35 and verified on main production deploy."
---

Persist active tour state across the four-race World Tour loop. Wire race results to record each race, advance to next race, complete the tour, unlock the next tour on pass, and cover the flow with tests. Mirrors F-065 in docs/FOLLOWUPS.md.
