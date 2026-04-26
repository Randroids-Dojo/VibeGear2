# 23. Balancing tables

## Core car balance sheet

| Car | Top speed | Accel | Grip dry | Grip wet | Stability | Durability | Nitro eff. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sparrow GT | 61 | 16 | 1.00 | 0.82 | 1.00 | 0.95 | 1.00 |
| Breaker S | 58 | 16.5 | 1.08 | 0.90 | 1.05 | 0.92 | 0.95 |
| Vanta XR | 64 | 17.5 | 0.93 | 0.76 | 0.90 | 0.88 | 1.08 |
| Tempest R | 76 | 20 | 1.02 | 0.84 | 1.00 | 0.96 | 1.05 |
| Bastion LM | 72 | 18 | 1.00 | 0.86 | 1.08 | 1.12 | 0.96 |
| Nova Shade | 82 | 22 | 0.95 | 0.78 | 0.92 | 0.90 | 1.12 |

## Reward formula targets

| Track difficulty | Base reward |
| --- | --- |
| 1 | 1,000 |
| 2 | 1,350 |
| 3 | 1,750 |
| 4 | 2,250 |
| 5 | 2,900 |

## Repair cost tour tier scale

Per §12 the repair cost formula is
`repairCost = damagePercent * carRepairFactor * tourTierScale`.
The `tourTierScale` factor scales raw repair credits with championship
progression so the late tours pressure armor upgrades. Tour index is
1-based; tours beyond 8 reuse the tour-8 value until a future content
slice extends the championship past the MVP eight tours.

| Tour | tourTierScale |
| --- | --- |
| 1 | 1.00 |
| 2 | 1.15 |
| 3 | 1.30 |
| 4 | 1.50 |
| 5 | 1.75 |
| 6 | 2.05 |
| 7 | 2.40 |
| 8 | 2.80 |

## Tour stipend (catch-up mechanism #1)

Per §12 catch-up mechanism #1 a player below a cash threshold receives
a one-shot tour stipend at tour entry. The lever fires only when the
tour index is 2 or higher (the first tour reuses the starter cash) and
only once per `(save, tour)` pair (claims are recorded in
`save.progress.stipendsClaimed`). The pinned values live in
`STIPEND_THRESHOLD_CREDITS` and `STIPEND_AMOUNT` in
`src/game/catchUp.ts` and are consumed by `enterTour` via the F-035
slice (see `feat/f-035-stipend-at-tour-entry`).

| Lever | Value | Notes |
| --- | --- | --- |
| Stipend threshold (credits) | 1,500 | Buys roughly two tier-1 cooling upgrades. |
| Stipend amount (credits) | 1,000 | Matches a mid-table finish at base 2,000 / normal so the lever is a catch-up not a free win. |
| First-tour gate | Tour index >= 2 | Tour 1 reuses the starter cash; no double-dip on a fresh save. |
| Per-tour claim cap | 1 claim per `(save, tour)` | Recorded in `save.progress.stipendsClaimed[tour.id]`. |

## Repair cap (catch-up mechanism #2)

Per §12 catch-up mechanism #2 essential repairs are capped at a low
percentage of the previous race's cash income so an unlucky run
cannot drain the wallet below upgrade-purchase budget. The cap fires
only on essential (minimum-to-keep-racing) repairs; cosmetic / "full"
repairs always pay full price. The cap is also gated on the
player-facing difficulty: easy and normal tiers receive the cap,
hard / master / extreme always pay full price so the higher tiers
keep the full §12 economic risk surface. The pinned fraction lives in
`REPAIR_CAP_FRACTION` in `src/game/catchUp.ts` and is consumed by
`applyRepairCost` (see `feat/wire-capped-repair-cost`, commit
`3ed8720`).

| Lever | Value | Notes |
| --- | --- | --- |
| Essential-repair cap fraction | 0.40 | Capped cost is `min(rawCost, round(lastRaceCashEarned * 0.40))` so a minimum-repair player keeps the majority of their winnings. |
| Repair-kind gate | `essential` only | `full` / cosmetic repairs always pay raw cost. |
| Difficulty gate | `easy`, `normal`, `novice` only | `hard`, `master`, `extreme` always pay raw cost. |
| Zero-income clamp | Cap collapses to 0 | A player with no race income gets a free essential repair (a future loss-leader race format clamps to 0 here). |

## Damage formula targets

```
rubDamage = 2 to 4
carHitDamage = 6 to 12
wallDamage = 12 to 24
offRoadObjectDamage = 10 to 20
nitroWhileSeverelyDamagedBonus = +15%
```

## Weather modifiers

| Weather | Dry tire modifier | Wet tire modifier |
| --- | --- | --- |
| Clear | +0.08 | 0.00 |
| Rain | -0.12 | +0.10 |
| Heavy rain | -0.20 | +0.16 |
| Snow | -0.18 | +0.14 |
| Fog | 0.00 | 0.00 |

## CPU difficulty modifiers

| Difficulty | Pace scalar | Recovery scalar | Mistake scalar |
| --- | --- | --- | --- |
| Easy | 0.92 | 0.95 | 1.40 |
| Normal | 1.00 | 1.00 | 1.00 |
| Hard | 1.05 | 1.03 | 0.70 |
| Master | 1.09 | 1.05 | 0.45 |

## Track difficulty rating rubric

| Factor | Weight |
| --- | --- |
| Sharp corner density | 30% |
| Visibility reduction | 20% |
| Average speed | 20% |
| Traffic compression zones | 15% |
| Weather severity | 15% |
