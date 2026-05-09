---
title: Implement Daily Challenge UTC fake-clock e2e
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-30T08:44:35.779497-05:00\\\"\""
closed-at: "2026-04-30T09:17:18.172942-05:00"
close-reason: "PR #128 merged. Main CI, CodeQL, Vercel verifier, and production smoke green for 2ee0e56."
---

Add browser-driven Playwright coverage proving the Daily Challenge page uses UTC day selection under a fake clock. Keep the selected daily marker stable after clicking into a run across UTC midnight.
