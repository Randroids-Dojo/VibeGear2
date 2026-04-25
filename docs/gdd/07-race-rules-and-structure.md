# 7. Race Rules and Structure

## Starting Grid

| Mode | Starting Position |
|---|---|
| Career race 1 of region | Player starts 18th of 20. |
| Career later races | Based on prior regional points, but never better than 8th without a medal bonus. |
| Quick race | Configurable. |
| Time trial | Rolling start or standing start. |
| Practice | Standing start, rolling start, or free drive. |

## Number of Racers

| Build Stage | Racer Count |
|---|---:|
| Prototype | 6 including player |
| Vertical slice | 12 including player |
| v1.0 target | 20 including player |
| Low-performance fallback | 10 including player |

## Laps

| Track Length | Target Laps |
|---|---:|
| Very short | 5-6 |
| Short | 4 |
| Medium | 3 |
| Long | 2 |
| Endurance challenge | 5-8, optional |

Target race duration should stay between **2 and 4 minutes** for most campaign races.

## Qualification Rules

| Placement | Career Result |
|---|---|
| 1st-3rd | Podium reward, strong points, unlock medal checks. |
| 4th-7th | Points, good reward, advances. |
| 8th-10th | Qualifies with low payout. |
| 11th or worse | Fails career race unless assist is used. |
| DNF | Fails, receives small consolation credits unless hard mode. |

## Fail States

| Fail State | Result |
|---|---|
| Finish below qualification | Retry, practice, or garage review. |
| Total mechanical failure | DNF, repair required. |
| Timeout after leader finishes | Finish position determined by distance. |
| Wrong-way exploit or invalid track bounds | Lap invalidation. |
| Save corruption | Fallback to last valid save snapshot. |

## Retry Flow

After failing:

1. Show exact failure reason.
2. Show `needed 10th, finished 12th by 3.2 seconds`.
3. Offer retry, repair and retry, practice, assist adjustment, or exit to tour map.

## Finish Rewards

| Placement | Base Credits | Tour Points |
|---|---:|---:|
| 1st | 12,000 | 12 |
| 2nd | 8,500 | 9 |
| 3rd | 6,500 | 7 |
| 4th | 4,800 | 5 |
| 5th | 3,600 | 3 |
| 6th | 2,700 | 2 |
| 7th | 2,000 | 1 |
| 8th | 1,500 | 0 |
| 9th | 1,100 | 0 |
| 10th | 800 | 0 |
| 11th-20th | 300 participation credits | 0 |

These are original VibeGear2 targets, not copied reward values.

## Tie Handling

| Tie Type | Resolution |
|---|---|
| Race finish time tie | Higher position goes to car farther along road at previous simulation tick. |
| Tour points tie | Better highest finish wins. |
| Still tied | Better total race time across region wins. |
| Still tied | Lower damage total wins. |
| Still tied | Player wins against AI for accessibility in normal difficulty. |
| Leaderboard tie | Earlier submission timestamp ranks higher, but display both. |
