---
title: "implement: F-044 wire §23 CPU difficulty modifiers (paceScalar / recoveryScalar / mistakeScalar) per §15 §23"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T10:58:59.034116-05:00\""
closed-at: "2026-04-26T11:34:30.674922-05:00"
close-reason: verified
---

Today AI ladder is per-driver via AIDriver.paceScalar in src/data/ai/*.json. §23 CPU difficulty modifier table pins per-tier (Easy / Normal / Hard / Master) paceScalar / recoveryScalar / mistakeScalar with no consumer for recoveryScalar (catch-up) or mistakeScalar (mistake-rate multiplier). Add a frozen CPU_DIFFICULTY_MODIFIERS lookup (likely src/game/ai.ts or new src/game/aiDifficulty.ts), copy table verbatim from src/data/__tests__/balancing.test.ts §23 pin, replace placeholder block in balancing test with import-and-assert cross-check. blocks: none
