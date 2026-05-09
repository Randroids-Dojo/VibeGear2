---
title: Implement per-car FX atlas routing
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-30T10:55:39.885234-05:00\\\"\""
closed-at: "2026-04-30T11:44:04.166478-05:00"
close-reason: "Merged PR #131 at a9f7580. Main CI, CodeQL, Vercel production verifier, and production smoke passed; F-068 closed with per-car FX atlas routing and coverage tests."
---

Close F-068 by completing bundled car FX sprite coverage, mapping each car visualProfile.spriteSet to atlas metadata, routing the selected car sprite set into the live race renderer, and covering the catalogue with tests.
