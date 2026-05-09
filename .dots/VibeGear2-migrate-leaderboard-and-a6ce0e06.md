---
title: Migrate leaderboard/* and any KV plumbing to @randroids-dojo/vibekit/server
status: open
priority: 3
issue-type: task
created-at: "2026-05-08T23:29:09.665497-05:00"
---

VibeGear2 has a leaderboard/ folder and Upstash usage. Migrate to ../VibeKit/src/server (getKv / readKv / writeKv / removeKv / signToken / verifyToken / incrementWithExpiry). Leaderboard zrange parsing remains project-specific for now since each game's leaderboard shape differs; only the underlying KV plumbing is shared.
