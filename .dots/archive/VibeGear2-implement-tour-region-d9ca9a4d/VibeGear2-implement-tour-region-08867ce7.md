---
title: "implement: tour-region pure championship.ts module (enterTour, recordResult, tourComplete, unlockNextTour) per §8"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T14:53:45.865661-05:00\\\"\""
closed-at: "2026-04-26T14:59:56.060326-05:00"
close-reason: verified
---

Slice 1 of the parent tour-region dot. Lands the pure src/game/championship.ts module exposing enterTour(save, championship, tourId), recordResult(activeTour, raceResult), tourComplete(activeTour, championship), unlockNextTour(save, completedTourId, championship). No UI surface (the /world page lands in a follow-up sub-slice). Lays the foundation that F-035 stipend, F-037 easyModeBonus, F-039 tourCompletionBonus need at the tour-clear and tour-entry call sites. Pure module, no Math.random, no Date.now, never mutates inputs. Reuses the existing src/data/championships/world-tour-standard.json content and the SaveGameProgress shape (unlockedTours/completedTours/stipendsClaimed already on the schema). Tests cover: enterTour rejects locked tour, accepts unlocked tour and seeds activeTour at raceIndex 0; recordResult appends and increments raceIndex without mutating; tourComplete aggregates standings per the §7 placement table and returns passed=true when standing<=requiredStanding; unlockNextTour adds the next tour id to unlockedTours and final tour unlocks nothing; DNF still aggregates as last place.
