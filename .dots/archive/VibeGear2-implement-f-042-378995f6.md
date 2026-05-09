---
title: "implement: F-042 wire §28 difficulty preset scalars into physics, damage, nitro, and raceSession + bump PHYSICS_VERSION"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T10:25:34.053909-05:00\""
closed-at: "2026-04-26T10:40:31.406732-05:00"
close-reason: "verified: F-042 wired §28 difficulty preset scalars (offRoadDragScale, steeringAssistScale, damageSeverity, nitroStabilityPenalty) into physics, damage, nitro, raceSession; bumped PHYSICS_VERSION to 2; race page reads save.settings.difficultyPreset; lint+typecheck+1666 unit tests+build+47 e2e all pass"
---

blocks: pure module landed in feat/difficulty-presets-tuning (b55f06e+). Read difficultyPreset off save in raceSession, resolve once via resolvePresetScalars, pass cached AssistScalars into step / applyContactDamage / tickNitro. Bump PHYSICS_VERSION so old ghosts under unscaled math are rejected. See docs/FOLLOWUPS.md F-042 for the four scalar consumer points.
