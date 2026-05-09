---
title: "research: Q-010 tourTierScale table for §12 repair-cost formula"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:03:57.115051-05:00\\\"\""
closed-at: "2026-04-26T13:35:00.407977-05:00"
close-reason: verified
---

blocks: F-033 (applyRepairCost) and transitively F-036 (cappedRepairCost consumer wiring).

Q-010 (docs/OPEN_QUESTIONS.md): §12 names a tourTierScale factor in repairCost = damagePercent * carRepairFactor * tourTierScale but §23 does not pin a tour-by-tour value table.

Options:
(a) Adopt the iter-19 placeholder: [1.00, 1.15, 1.30, 1.50, 1.75, 2.05, 2.40, 2.80] for tours 1..8. Geometric-ish ramp ending near 2.8x. Matches the dot proposal verbatim; callers can land immediately. (recommended default)
(b) Linear ramp: 1.0 + 0.2 * (tier - 1) -> [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4]. Easier to memorize; flatter late curve. Requires balancing-pass to confirm endgame still pressures armor upgrades.
(c) Steeper late curve: [1.00, 1.20, 1.50, 1.85, 2.30, 2.85, 3.55, 4.40] (~1.25x growth/tier). Matches §12 prize-pool multiplier cadence so repair eats a stable fraction of winnings. Bigger pain spike if player skips armor upgrades.
(d) Defer: land applyRepairCost against a single constant scale of 1.0 for all tiers. Safe but silently ignores §12's intent.

Recommended default: (a). The iter-19 table is the closest thing to a designed proposal already in the loop; freezing it lets F-033 and F-036 unblock with one sign-off. If a balancing pass later prefers (b) or (c), the table is one §23 edit plus one constant swap in economy.ts.

Action when answered:
1. Pin the chosen table to docs/gdd/23-balancing-tables.md.
2. Add TOUR_TIER_SCALE constant to src/data/balancing.ts.
3. Mark Q-010 answered with the chosen option and rationale.
4. Unblock F-033.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-010 marked answered.
- docs/gdd/23-balancing-tables.md: tourTierScale row added.
- src/data/balancing.ts: TOUR_TIER_SCALE export.

Verify:
- The chosen table is documented in §23.
- F-033 dot can proceed.
