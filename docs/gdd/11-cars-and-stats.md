# 11. Cars and Stats

## Car Design Philosophy

VibeGear2 should avoid licensed-car realism. Cars should be fictional, stylized, and readable as sprites at multiple scales.

The default campaign should support:

- A primary upgradeable garage car.
- Unlockable body shells with small base-stat differences.
- Cosmetic paint and decal options.
- No real manufacturer references.
- No traced silhouettes from real vehicles.

## Car Classes / Archetypes

| Archetype | Description | Strength | Weakness |
|---|---|---|---|
| Compact Sprinter | Small, agile, easy to recover. | Handling | Low top speed |
| Balanced Coupe | Default all-rounder. | Consistency | No standout stat |
| Heavy GT | Stable and durable. | Top speed, armor | Acceleration |
| Rally Wedge | Great in bad weather. | Grip, off-road recovery | Highway speed |
| Boost Phantom | Built around Pulse Boost. | Boost power | Damage resistance |
| Endurance Brick | Efficient and tough. | Reliability | Steering response |

## Stat Categories

Stats use 0-100 for player-facing UI.

| Stat | Meaning |
|---|---|
| Speed | Top speed potential. |
| Acceleration | Time to reach speed. |
| Handling | Steering response and recovery. |
| Grip | Weather and curve stability. |
| Durability | Damage resistance. |
| Boost | Pulse Boost strength and recharge compatibility. |
| Efficiency | Fuel/cooling/reliability abstraction, if used. |

## Upgrade Compatibility

| Upgrade | Compatible With |
|---|---|
| Engine | All cars. |
| Transmission | All cars, with class-specific final ratio. |
| Dry Tires | All cars. |
| Wet Tires | All cars. |
| Suspension | All cars. |
| Pulse Boost | All cars, Boost Phantom scales better. |
| Armor | All cars, Heavy GT and Endurance Brick scale better. |
| Cooling | Optional late system, all cars. |

## Visual Customization

| Customization | MVP | v1.0 | Stretch |
|---|---:|---:|---:|
| Paint color | Yes | Yes | Yes |
| Secondary stripe | No | Yes | Yes |
| Decals | No | Basic | Community |
| Wheel color | No | Yes | Yes |
| Body shell | 1 | 6 | 12+ |
| Damage visuals | Basic | Full | Per-panel |

## Example Starting Cars

| Car Shell | Speed | Accel | Handling | Grip | Durability | Boost | Intended Player |
|---|---:|---:|---:|---:|---:|---:|---|
| Ember Compact | 42 | 58 | 72 | 68 | 38 | 45 | Beginners who want control. |
| Vector Hatch | 48 | 64 | 60 | 58 | 42 | 52 | Aggressive players. |
| Brickline GT | 62 | 44 | 46 | 52 | 70 | 40 | Players who like stability. |

## Example Late-Game Cars

| Car Shell | Speed | Accel | Handling | Grip | Durability | Boost | Unlock |
|---|---:|---:|---:|---:|---:|---:|---|
| Arc Comet | 76 | 74 | 68 | 62 | 48 | 72 | Complete Metro Midnight. |
| Dune Pulse | 64 | 62 | 70 | 78 | 58 | 64 | Complete Mirage Basin medal set. |
| Night Warden | 82 | 58 | 52 | 60 | 82 | 50 | Complete Aurora Highway. |

## Balance Rules

1. No car may dominate all stats.
2. Upgrade levels should matter more than shell choice in career.
3. Car shells should influence feel, not hard-lock progression.
4. Switching car shells should not force re-buying all upgrades.
5. Cosmetic unlocks should not affect leaderboard categories unless marked.
6. Any car can finish the campaign with reasonable upgrades.
