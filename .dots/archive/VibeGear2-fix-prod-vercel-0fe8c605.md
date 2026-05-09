---
title: "fix: production Vercel deploy token"
status: closed
priority: 0
issue-type: task
created-at: "\"\\\"2026-04-28T12:41:45.061041-05:00\\\"\""
closed-at: "2026-04-28T12:45:30.158356-05:00"
close-reason: Refreshed GitHub Actions VERCEL_TOKEN from local Vercel CLI auth, reran main deploy, and smoke tested production routes.
---

Restore main production deploy after Vercel CLI rejected the GitHub Actions token during vercel pull.
