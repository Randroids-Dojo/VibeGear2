---
title: Fix WebKit keyboard smoke flake
status: closed
priority: 0
issue-type: task
created-at: "\"\\\"2026-04-30T12:33:55.610487-05:00\\\"\""
closed-at: "2026-04-30T13:13:51.853630-05:00"
close-reason: "Merged PR #133 at 19ce1dc. Main CI, CodeQL, Vercel production verifier, and production smoke passed; WebKit keyboard cross-browser smoke restored main."
---

Main CI failed after PR #132 merge in the WebKit keyboard-only cross-browser smoke with page closed during Tab and Enter navigation. Harden the smoke path, verify locally, open a hotfix PR, and restore main.
