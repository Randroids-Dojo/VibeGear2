---
title: "implement: F-045 wire NITRO_WHILE_SEVERELY_DAMAGED_BONUS into damage path per §13 §23"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T10:58:53.757429-05:00\""
closed-at: "2026-04-26T11:26:54.055350-05:00"
close-reason: verified
---

Multiply baseMagnitude by (1 + NITRO_WHILE_SEVERELY_DAMAGED_BONUS) when nitro is active on a severe / catastrophic-band car. Thread nitroActiveOnDamagedCar flag from raceSession (knows burn state and band) into applyHit. Add unit test: wallHit on severe-band car with active nitro deposits 15% more total damage than same hit without nitro. Constant already pinned in src/game/damage.ts; balancing.test.ts cell will move from documented-pin to import-and-assert once consumer lands. blocks: none
