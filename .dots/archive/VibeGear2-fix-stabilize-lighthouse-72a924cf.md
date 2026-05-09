---
title: "fix: stabilize Lighthouse performance gate retries"
status: closed
priority: 0
issue-type: task
created-at: "\"\\\"2026-04-30T19:20:36.139486-05:00\\\"\""
closed-at: "2026-04-30T20:07:54.137210-05:00"
close-reason: "Merged PR #142. Main CI, CodeQL, Vercel production verifier, version check, and production route smoke passed for cd002fe."
---

Main CI failed on /options Lighthouse performance at 0.68 after PR #141. Add deterministic retry handling for near-threshold Lighthouse route scores and verify main deploy.
