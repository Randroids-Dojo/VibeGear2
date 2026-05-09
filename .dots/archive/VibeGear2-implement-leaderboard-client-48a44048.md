---
title: "implement: leaderboard client adapter + Vercel KV store"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T08:14:12.157608-05:00\\\"\""
closed-at: "2026-04-26T08:29:56.534349-05:00"
close-reason: verified
---

Final slice of the optional online leaderboard. (1) src/leaderboard/client.ts with submitLap(token, lap) and getTop(trackId, n). Respects NEXT_PUBLIC_LEADERBOARD_ENABLED feature flag (when off, every method resolves to a documented sentinel without hitting the network). (2) src/leaderboard/store-vercel-kv.ts loaded dynamically when LEADERBOARD_BACKEND=vercel-kv so the bundle stays slim. Re-runs the runStoreContract suite from store-noop.test.ts. FOLLOWUPS.md entry: provision Vercel KV and swap LEADERBOARD_BACKEND in production (manual, post-merge).
