---
title: implement audio options pane
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T18:51:26.897283-05:00\\\"\""
closed-at: "2026-04-28T19:31:47.275266-05:00"
close-reason: "shipped PR #67, Copilot review threads resolved, main CI and production smoke green"
---

Replace the /options Audio placeholder with persisted §20 master, music, and SFX sliders backed by SaveGameSettings.audio. Add pure state helpers, React pane, unit coverage, and Playwright persistence coverage. Update reset defaults now that audio is a shipped pane.
