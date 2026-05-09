---
title: "implement: F-043 pin §23 weather modifiers into src/game/weather.ts"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T11:52:44.371046-05:00\\\"\""
closed-at: "2026-04-26T11:59:24.998698-05:00"
close-reason: "verified: F-043 pinned §23 weather tire modifiers in src/game/weather.ts (frozen lookup keyed by §23-row subset of WeatherOption); balancing.test.ts now imports and asserts the constant; lint+typecheck+1769 unit tests+build+47 e2e all pass; Q-008 filed for the three §23-uncovered WeatherOption values"
---

Create src/game/weather.ts with frozen WEATHER_TIRE_MODIFIERS keyed by WeatherOption, copy the §23 table verbatim from balancing.test.ts, replace the placeholder block in balancing.test.ts with an import-and-assert cross-check, mark F-043 done in FOLLOWUPS.md. Pure-data slice; no physics or vfx wiring (those are owned by VibeGear2-implement-weather-38d61fc2).
