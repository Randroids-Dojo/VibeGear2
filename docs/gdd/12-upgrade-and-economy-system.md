# 12. Upgrade and economy system

## Currency rewards

Use a single currency: credits.

Base formula

```
raceReward = baseTrackReward * finishMultiplier * difficultyMultiplier
tourBonus = sum(raceRewards) * 0.15 on successful tour clear
```

Finish multipliers

| Place | Multiplier |
| --- | --- |
| 1 | 1.00 |
| 2 | 0.82 |
| 3 | 0.70 |
| 4 | 0.58 |
| 5 | 0.48 |
| 6 | 0.40 |
| 7 | 0.32 |
| 8 | 0.24 |
| 9 to 12 | 0.14 |

## Repair costs

Repair cost should scale by damage and car repair class.

```
repairCost = damagePercent * carRepairFactor * tourTierScale
```

## Upgrade categories

This category list is intentionally analogous in function to the original’s engine, tires, gearbox, nitro, and armor setup, but it is reorganized for a clearer modern garage. The Top Gear 2 guide’s documented categories and prices are the historical inspiration, not a template to duplicate. [9]

| Category | Function |
| --- | --- |
| Engine | Raises acceleration and small top-speed increments |
| Gearbox | Unlocks higher gearing and smooths high-speed pull |
| Dry tires | Raises dry grip and braking |
| Wet tires | Raises wet/snow grip and stability |
| Nitro system | Raises boost thrust and burn duration |
| Chassis armor | Raises collision resilience |
| Cooling | Reduces late-race damage penalties and nitro heat loss |
| Aero kit | Small high-speed stability gain |

## Upgrade levels

Use 4 levels per category:

- Stock
- Street
- Sport
- Factory
- Extreme

## Pricing curves

Pricing should escalate, but not geometrically to the point of grind.

| Upgrade tier | Cost multiplier over previous |
| --- | --- |
| Street | 1.0 |
| Sport | 1.8 |
| Factory | 2.2 |
| Extreme | 2.7 |

## Strategic tradeoffs

The garage should create real decisions:

- Speed now versus durability later.
- Wet tires now versus saving for engine.
- Partial repair versus full repair.
- Nitro power versus gearbox ceiling.
- New car purchase versus maxing current car.

## Catch-up mechanisms

To avoid grind:

- Players below a cash threshold receive a tour stipend.
- Essential repairs are capped at a low percentage of race income.
- Easy mode grants bonus cash for tour clears.
- Practice mode can preview track weather so bad setup choices feel fair, not hidden.

## Example upgrade table

| Upgrade | Street | Sport | Factory | Extreme |
| --- | --- | --- | --- | --- |
| Engine | 3,000 | 6,000 | 11,000 | 18,000 |
| Gearbox | 2,500 | 5,000 | 9,000 | 15,000 |
| Dry tires | 1,200 | 2,400 | 4,200 | 6,400 |
| Wet tires | 1,200 | 2,400 | 4,200 | 6,400 |
| Nitro | 2,000 | 4,500 | 8,000 | 13,000 |
| Chassis armor | 1,800 | 3,600 | 6,200 | 9,600 |
| Cooling | 1,000 | 2,200 | 4,000 | 6,500 |
| Aero kit | 1,600 | 3,000 | 5,200 | 8,800 |
