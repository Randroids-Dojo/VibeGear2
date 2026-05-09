---
title: "implement: leaderboard route handlers (POST /api/leaderboard/submit, GET /api/leaderboard/[trackId])"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T08:14:12.154248-05:00\\\"\""
closed-at: "2026-04-26T08:21:33.875754-05:00"
close-reason: verified
---

Continuation of VibeGear2-implement-optional-online-4b2341af. Pure primitives (types, sign/verify, noop store) shipped on feat/leaderboard-primitives. This slice adds the App Router route handlers that wire signSubmission + verifySubmission + LeaderboardStore together. POST: validate body, verify signature with LEADERBOARD_SIGNING_KEY env, reject lap times below the track minimum (length/topSpeed*1000), return 401/422/404/200. GET: return store.top(trackId, limit). Pick the store via process.env.LEADERBOARD_BACKEND (noop default). Tests: Vitest with fake Request for each status code; one Playwright smoke that the routes respond when LEADERBOARD_BACKEND=noop.
