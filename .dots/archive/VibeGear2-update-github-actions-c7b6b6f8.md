---
title: Update GitHub Actions workflow for Node 24 action runtime
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-30T05:21:52.315651-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-30T05:55:48.567561-05:00"
close-reason: "PR #123 merged. Main CI and CodeQL green. Production smoke reports b8194e4."
---

Main CI now warns that actions/checkout@v4 and actions/setup-node@v4 run on Node.js 20, which GitHub will force to Node 24 by default on 2026-06-02 and remove from the runner on 2026-09-16. Add a CI maintenance slice to verify current action versions under Node 24 or update workflow/action versions before the default changes.
