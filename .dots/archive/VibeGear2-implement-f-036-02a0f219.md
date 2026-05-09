---
title: "implement: F-036 wire cappedRepairCost into applyRepairCost per GDD §12 catch-up #2"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:52:22.906816-05:00\\\"\""
closed-at: "2026-04-26T14:07:55.717504-05:00"
close-reason: verified
---

blocks: F-033 (applyRepairCost itself) must land first. Chain after F-033's dot.

The feat/economy-catch-up slice landed cappedRepairCost(rawCost, raceCashEarned, kind, difficulty) in src/game/catchUp.ts with eleven cell-by-cell unit tests. The function has no in-app caller because applyRepairCost itself does not exist yet. Once F-033 lands, the cap must wrap the §12 raw cost.

Land:
1. In src/game/economy.ts applyRepairCost (added by F-033), after computing raw = damagePercent * carRepairFactor * TOUR_TIER_SCALE[tourTier - 1]:
   a. Pull the player's last race cash from save (save.lastRaceCashEarned or the equivalent field; if absent, thread it through the call signature).
   b. Pull the kind ('essential' | 'full') from the call args (garage UI's Repair button selection).
   c. Pull difficulty from save.settings.difficultyPreset.
   d. Call cappedRepairCost(raw, raceIncome, kind, difficulty).
2. Deduct the capped result (not the raw) from save.garage.credits.
3. Unit tests pin: raw above the cap is clamped (essential vs full caps differ by §12 catch-up #2); raw below the cap passes through unchanged; difficulty preset shifts the cap per CPU_DIFFICULTY_MODIFIERS (or whichever knob §12 names).

Affected files:
- src/game/economy.ts (update): applyRepairCost wraps cappedRepairCost.
- src/game/__tests__/economy.test.ts (update): cap cases.
- docs/FOLLOWUPS.md: F-036 marked done.
