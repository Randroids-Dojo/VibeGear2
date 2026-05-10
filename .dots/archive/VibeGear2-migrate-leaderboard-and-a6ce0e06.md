---
title: Migrate leaderboard/* and any KV plumbing to @randroids-dojo/vibekit/server
status: closed
priority: 3
issue-type: task
created-at: "\"2026-05-08T23:29:09.665497-05:00\""
closed-at: "2026-05-09T15:11:08.780693-05:00"
close-reason: deferred to VibeKit v0.2.0; see VibeKit-widen-srv-kv-813da181
---

VibeGear2 has a leaderboard/ folder and Upstash usage. Migrate to ../VibeKit/src/server (getKv / readKv / writeKv / removeKv / signToken / verifyToken / incrementWithExpiry). Leaderboard zrange parsing remains project-specific for now since each game's leaderboard shape differs; only the underlying KV plumbing is shared.
