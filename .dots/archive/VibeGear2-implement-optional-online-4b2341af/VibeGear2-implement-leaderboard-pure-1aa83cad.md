---
title: "implement: leaderboard pure primitives (types + sign/verify + noop store)"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T08:13:36.734528-05:00\""
closed-at: "2026-04-26T08:13:39.932020-05:00"
close-reason: verified
---

Sub-slice of optional online leaderboard. Ships the pure server-side primitives so the route-handler and client-adapter slices can be small follow-ups. Files: src/leaderboard/types.ts, src/leaderboard/sign.ts, src/leaderboard/store-noop.ts, plus 22 tests across sign.test.ts and store-noop.test.ts. Reference HMAC-SHA-256 pinned in tests.
