---
title: "implement: nitro race-session wiring (PlayerCarState.nitro, race-start init, physics multiplier consumption) per §10"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T05:35:02.717496-05:00\\\"\""
closed-at: "2026-04-26T06:08:16.157059-05:00"
close-reason: verified
---

src/game/nitro.ts is implemented but unwired. Add NitroState to PlayerCarState in src/game/raceState.ts, initialise via createNitroForCar at race start in src/game/raceSession.ts, advance via tickNitro from the input.nitro action each tick, and pass getNitroAccelMultiplier into physics step accelMultiplier. Reset to 3 charges (or upgraded charge count) on race start. No em-dashes. Tests: nitro state on every car at race start; input.nitro tap drains a charge; full race tick determinism.
