# 12. Upgrade and Economy System

## Economy Goals

The economy should create decisions, not grind.

The player should often ask:

- Repair now or save for upgrade?
- Buy wet tires before a rain region?
- Improve acceleration or top speed?
- Upgrade boost for passing or armor for survival?
- Retry for better payout or move on?

## Currency

Use fictional currency: **Credits**.

| Source | Type |
|---|---|
| Placement reward | Repeatable |
| Pickup chips | Repeatable |
| Clean race bonus | Repeatable |
| Rival bounty | Repeatable, once per race per rival |
| Medal reward | One-time |
| Tour completion bonus | One-time |
| Daily challenge | Cosmetic or small credit reward, capped |

## Repair Costs

```text
repairCost = damagePoints * repairRate * regionMultiplier * armorDiscount
```

Initial values:

| Item | Value |
|---|---:|
| Base repair rate | 45 credits per point |
| Critical repair surcharge | +25 percent above 75 percent damage |
| Armor discount level 1 | 5 percent |
| Armor discount level 2 | 10 percent |
| Armor discount level 3 | 15 percent |
| Armor discount level 4 | 20 percent |

## Upgrade Categories

| Category | Primary Effect | Secondary Effect |
|---|---|---|
| Engine | Acceleration, top speed | Boost efficiency |
| Transmission | Higher speed range, manual advantage | Lower high-speed drag |
| Dry Tires | Dry grip and cornering | Lower tire wear |
| Wet Tires | Rain/snow grip | Reduced puddle slip |
| Suspension | Steering recovery, hill stability | Less collision wobble |
| Pulse Boost | More charges, stronger boost | Better boost control |
| Armor | Damage resistance | Lower repair cost |
| Cooling | Optional endurance stat | Reduces performance decay |

## Upgrade Levels

| Level | Label | Design Role |
|---:|---|---|
| 0 | Stock | Baseline. |
| 1 | Street | Cheap early improvement. |
| 2 | Tuned | Region 2-4 target. |
| 3 | Pro | Region 5-7 target. |
| 4 | Elite | Late-game and hard mode. |

## Pricing Curves

Initial original cost table:

| Upgrade | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---:|---:|---:|---:|
| Engine | 12,000 | 28,000 | 55,000 | 90,000 |
| Transmission | 8,000 | 22,000 | 46,000 | 76,000 |
| Dry Tires | 2,500 | 6,000 | 12,000 | 22,000 |
| Wet Tires | 2,500 | 6,000 | 11,000 | 20,000 |
| Suspension | 4,000 | 10,000 | 22,000 | 42,000 |
| Pulse Boost | 9,000 | 21,000 | 45,000 | 78,000 |
| Armor | 6,000 | 15,000 | 32,000 | 58,000 |
| Cooling | 5,000 | 13,000 | 28,000 | 50,000 |

## Strategic Tradeoffs

| Choice | Tradeoff |
|---|---|
| Engine first | Faster, but more dangerous if tires/armor are weak. |
| Tires first | Safer curves, less exciting on straights. |
| Boost first | Great passing power, risky in bad weather. |
| Armor first | Lower repair cost, slower progression in speed. |
| Transmission first | Better top speed but limited if engine is weak. |
| Save credits | Can buy expensive upgrades sooner but risks poor race results. |

## Catch-Up Mechanisms

| Mechanism | Rule |
|---|---|
| Participation credits | Even failed races pay small credits. |
| Underdog bonus | Lower upgrade rating earns bonus if finishing high. |
| Retry ghost hint | Game shows better driving line after repeated failures. |
| Region sponsor | After 3 failed attempts, offer small one-time credit loan. |
| Assist mode | Optional `tour assist` lowers qualification to 12th, disables some medals. |
| Resale | Downgraded upgrades refund 65 percent in casual mode only. |

## Avoiding Grind

1. A player who qualifies consistently should afford key upgrades.
2. A player should rarely need to replay the same race more than twice for money.
3. Placement improvement should be more profitable than pickup farming.
4. Repair costs should punish collisions, not bankrupt the player.
5. Optional medals should provide one-time boosts, not required progression.

## Example Upgrade Effect Table

| Upgrade | L1 | L2 | L3 | L4 |
|---|---:|---:|---:|---:|
| Engine acceleration multiplier | 1.08 | 1.18 | 1.32 | 1.48 |
| Engine top speed multiplier | 1.03 | 1.07 | 1.12 | 1.18 |
| Transmission top speed multiplier | 1.04 | 1.09 | 1.15 | 1.22 |
| Dry tire grip multiplier | 1.05 | 1.10 | 1.17 | 1.24 |
| Wet tire wet-grip recovery | +8 percent | +16 percent | +25 percent | +35 percent |
| Suspension slip recovery | +8 percent | +17 percent | +28 percent | +40 percent |
| Pulse Boost charges | 3 | 3 | 4 | 5 |
| Armor damage reduction | 8 percent | 17 percent | 28 percent | 40 percent |
| Cooling performance decay reduction | 10 percent | 20 percent | 32 percent | 45 percent |
