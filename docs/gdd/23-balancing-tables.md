# 23. Balancing Tables

## Car Stats

| Car | Speed | Accel | Handling | Grip | Durability | Boost | Efficiency |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember Compact | 42 | 58 | 72 | 68 | 38 | 45 | 50 |
| Vector Hatch | 48 | 64 | 60 | 58 | 42 | 52 | 48 |
| Brickline GT | 62 | 44 | 46 | 52 | 70 | 40 | 58 |
| Dune Pulse | 64 | 62 | 70 | 78 | 58 | 64 | 62 |
| Arc Comet | 76 | 74 | 68 | 62 | 48 | 72 | 54 |
| Night Warden | 82 | 58 | 52 | 60 | 82 | 50 | 66 |

## Upgrade Costs

| Upgrade | L1 | L2 | L3 | L4 |
|---|---:|---:|---:|---:|
| Engine | 12k | 28k | 55k | 90k |
| Transmission | 8k | 22k | 46k | 76k |
| Tires | 2.5k | 6k | 12k | 22k |
| Boost | 9k | 21k | 45k | 78k |
| Armor | 6k | 15k | 32k | 58k |

## Reward Formula

```text
gross = placement + pickups + bonuses
net = gross - repairs
```

## Damage Formula

```text
damage = speed * hardness * angle * (1 - armor)
```

## Weather Modifiers

| Weather | Grip | Visibility | Drag |
|---|---:|---:|---:|
| Clear | 1.0 | 1.0 | 1.0 |
| Rain | 0.8 | 0.85 | 1.02 |
| Snow | 0.7 | 0.8 | 1.05 |
| Fog | 0.95 | 0.6 | 1.0 |

## CPU Difficulty

| Difficulty | Pace | Mistakes |
|---|---:|---:|
| Easy | 0.85 | High |
| Normal | 1.0 | Medium |
| Hard | 1.12 | Low |
| Expert | 1.22 | Very low |
