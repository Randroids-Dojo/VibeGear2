---
title: "implement: F-033 applyRepairCost in src/game/economy.ts once §23 ships tourTierScale per GDD §12"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T13:02:53.255454-05:00\""
closed-at: "2026-04-26T13:57:34.043080-05:00"
close-reason: verified
---

blocks: Q-010 (the tourTierScale table) must answer first. Q-010 default recommends option (a): the iter-19 placeholder table [1.00, 1.15, 1.30, 1.50, 1.75, 2.05, 2.40, 2.80] for tours 1..8. F-036 (cappedRepairCost consumer wiring) chains on this dot.

The feat/economy-upgrade slice intentionally deferred applyRepairCost because §12 names a tourTierScale factor in the formula:
  repairCost = damagePercent * carRepairFactor * tourTierScale
that has no §23 column today.

Land:
1. Add the resolved tourTierScale table to src/data/balancing.ts (named TOUR_TIER_SCALE per §23 column convention) once Q-010 is answered.
2. Add applyRepairCost(save, { carId, zoneRepairs, tourTier }) to src/game/economy.ts:
   - Read per-zone damage from the in-flight DamageState.
   - Compute the credit cost via repairCostFor from damage.ts.
   - Multiply by the resolved scale (TOUR_TIER_SCALE[tourTier - 1]).
   - Return a fresh SaveGame with garage.credits decremented and (separately) the post-race damage zeroed for the repaired zones.
3. Unit tests pin: zone-by-zone repair costs, tier-1 vs tier-8 scale, idempotent repair (zero damage costs zero credits).

The caller (the §20 results-screen Repair button) is the natural consumer; until that surface lands, land the function with unit tests and leave the wiring as a follow-on (mirrors the F-019 pattern).

Affected files:
- src/data/balancing.ts (update): TOUR_TIER_SCALE constant.
- src/game/economy.ts (update): applyRepairCost.
- src/game/__tests__/economy.test.ts (update): repair-cost cases.
- docs/gdd/23-balancing-tables.md (update): pin tourTierScale per Q-010.
- docs/FOLLOWUPS.md: F-033 marked done.
- docs/OPEN_QUESTIONS.md: Q-010 marked answered with chosen table.

Verify:
- npm run lint, typecheck, test, build all clean.
- Repair-cost rounds match a hand-computed example for tour 3, mid-engine damage, mid-tier repair factor.
- No em-dashes in changed files.
