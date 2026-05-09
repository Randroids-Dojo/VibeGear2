---
title: Disable text/UI element selection in-game
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-28T22:21:34.551278-05:00\\\"\""
closed-at: "2026-04-29T00:06:40.201912-05:00"
close-reason: "shipped PR #76, review thread resolved, main CI, CodeQL, production deploy, and production smoke green"
---

This is a game so users should not be able to highlight or select text/UI elements (standard browser text selection behavior). Apply user-select: none globally to game UI to prevent selection highlighting.
