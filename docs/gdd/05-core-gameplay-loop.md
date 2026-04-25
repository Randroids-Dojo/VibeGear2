# 5. Core Gameplay Loop

## Primary Loop

```text
Choose tour or race
 -> View pre-race briefing
 -> Configure car and repairs
 -> Race
 -> Finish or fail
 -> Receive credits, points, pickups, and damage report
 -> Repair, upgrade, or save money
 -> Unlock next race, retry, or change mode
```

## Race Preparation

Before each career race, the player sees:

| Information | Purpose |
|---|---|
| Region and track name | Flavor and progression context. |
| Track length | Helps estimate race duration. |
| Lap count | Indicates pacing. |
| Weather forecast | Informs tire and risk choices. |
| Surface type | Asphalt, gravel-edge, snow-edge, wet city, desert road, etc. |
| Curve rating | Warns about handling demand. |
| Elevation rating | Warns about crests, visibility, and jumps. |
| Rival focus | Shows 1-3 AI drivers likely to matter. |
| Recommended upgrade | Non-binding hint for new players. |
| Repair estimate | Shows consequences of entering damaged. |

## Garage Flow

```text
Results
 -> Damage assessment
 -> Auto-repair suggestion
 -> Manual repair slider
 -> Upgrade shop
 -> Paint/body cosmetic screen
 -> Start next race
```

The player can skip the garage and continue with current setup, but the game should warn if:

- Damage exceeds 60 percent.
- Weather requires tires the player has not upgraded.
- Boost charges are empty and the player owns refillable boost capacity.
- The next race has a high curve or hazard rating.

## Race

During a race, the player:

1. Starts in the back third of the grid.
2. Accelerates through a countdown start.
3. Reads upcoming curvature through road shape, signage, minimap, and AI behavior.
4. Passes AI cars while avoiding collisions.
5. Uses boost on straights, exits, or desperate qualification pushes.
6. Collects optional pickups.
7. Manages damage and traction.
8. Finishes as high as possible.

## Rewards

| Reward Source | Notes |
|---|---|
| Placement credits | Main income. |
| Tour points | Determines regional standings. |
| Track pickups | Small risk-reward bonuses. |
| Clean race bonus | Encourages skillful play. |
| Rival bonus | Beat named rival for extra payout. |
| Underdog bonus | Extra credits for finishing well with lower upgrade rating. |
| Medal bonus | One-time rewards for optional goals. |

## Repairs

After the race:

- Damage is separated into **body**, **powertrain**, and **tire wear**.
- Auto-repair defaults to safe minimum for next race, not full repair.
- Player can pay for full repair, partial repair, or risk entering damaged.
- Severe damage can reduce upgrade efficiency until repaired.

## Upgrades

Upgrade categories:

1. Engine
2. Transmission
3. Dry Tires
4. Wet Tires
5. Suspension
6. Pulse Boost
7. Armor
8. Cooling and Reliability, optional after MVP

## Progression Unlocks

| Unlock | Trigger |
|---|---|
| Next race | Finish top 10 or use assist retry token. |
| Next region | Complete 4-race regional tour. |
| New car shell | Finish specific region or earn medals. |
| New paint palette | Earn clean race or beat rival. |
| Hard mode | Complete full tour. |
| Daily challenge | Available from start after tutorial. |
| Track editor | Available from start or after first region. |
