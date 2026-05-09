---
title: implement procedural engine runtime
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-28T19:33:54.872681-05:00\\\"\""
closed-at: "2026-04-28T20:41:03.468848-05:00"
close-reason: "shipped PR #68 plus review follow-up PR #69, Copilot threads resolved, main CI and production smoke green"
---

Wire the shipped §18 engine pitch and mixer primitives into a procedural Web Audio engine runtime for live races. Start only after a user gesture resumes the shared audio context, update oscillator pitch and SFX-bus gain from player speed and persisted audio settings, stop on pause teardown, route changes, retire, and race finish, and add unit coverage for no-context, silent-mixer, start, update, and stop behavior.
