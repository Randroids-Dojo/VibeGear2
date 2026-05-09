---
title: "implement: reduce tour-flow e2e runtime after real track content"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T02:46:15.487630-05:00\\\"\""
closed-at: "2026-04-28T15:37:23.428990-05:00"
close-reason: "shipped PR #60, main CI and production smoke green"
---

Main CI now reports e2e/tour-flow.spec.ts at about 5.1m and full browser CI at about 11m after the MVP track-set merge. Add a focused optimization slice to keep full CI comfortably under the deploy gate by using shorter deterministic test fixtures, faster race completion helpers, or splitting long campaign progression coverage without weakening the production route smoke. Verify with npm run test:e2e and main CI timing.
