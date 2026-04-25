# 15. CPU Opponents and AI

## AI Design Goals

AI should feel like a competitive racing pack, not moving obstacles.

Goals:

- AI passes and blocks visibly.
- AI makes occasional readable mistakes.
- AI is affected by weather and hazards.
- AI difficulty rises by region.
- AI does not secretly ignore collisions.
- Rubber-banding is subtle and limited.

## CPU Driver Archetypes

| Archetype | Behavior |
|---|---|
| Line Keeper | Follows racing line, low aggression. |
| Blocker | Defends lane, slower in corners. |
| Sprinter | Strong acceleration, weak in weather. |
| Rain Specialist | Better grip and confidence in rain. |
| Boost Addict | Uses boost often, crashes more. |
| Veteran | Smooth, fast, few mistakes. |
| Rival | Named driver with custom behavior and dialogue. |

## AI Driver Stats

| Stat | Range | Meaning |
|---|---:|---|
| Pace | 0-100 | Baseline speed. |
| Corner Skill | 0-100 | How early AI slows for curves. |
| Aggression | 0-100 | Willingness to pass/block. |
| Consistency | 0-100 | Mistake frequency. |
| Weather Skill | 0-100 | Grip loss reduction. |
| Boost Skill | 0-100 | Timing quality. |
| Collision Avoidance | 0-100 | Ability to avoid contact. |

## Racing Lines

The track schema can provide optional AI hints:

```json
"aiHints": {
  "preferredLaneBias": 0,
  "overtakeZones": [12, 25, 48],
  "brakeZones": [
    { "segment": 44, "intensity": 0.6 }
  ],
  "hazardAvoidance": [
    { "segment": 72, "avoidLane": -1 }
  ]
}
```

If no hints exist, AI computes line from curvature:

```text
targetLane =
  -curve * cornerApexBias +
  overtakeOffset +
  hazardAvoidanceOffset +
  randomPersonalityOffset
```

## Rubber-Banding Philosophy

Rubber-banding is allowed only to preserve pack drama, not to steal wins.

| Situation | Allowed |
|---|---|
| AI far behind player | Small pace boost, capped at +5 percent. |
| AI far ahead | Small pace reduction, capped at -4 percent. |
| Final lap podium | Rubber-band fades out. |
| Directly visible AI | No sudden speed cheats. |
| Hard mode | Minimal rubber-band. |
| Time trial | No AI. |

## Aggression

| Aggression Level | Behavior |
|---|---|
| 0-25 | Holds lane, avoids player. |
| 26-50 | Passes on straights, mild blocking. |
| 51-75 | Defends, squeezes lanes, uses boost. |
| 76-100 | Risky passes, late braking, more mistakes. |

## Passing Behavior

AI chooses pass when:

- AI speed advantage is above 5 mph.
- Adjacent lane is clear.
- Road curvature is below safe threshold.
- Hazard does not block pass lane.
- Personality aggression allows it.

AI aborts pass when:

- Curve becomes sharp.
- Player or another AI blocks lane.
- Weather grip drops.
- Damage or panic event triggers.

## Mistakes

| Mistake | Trigger |
|---|---|
| Late brake | Low consistency, sharp curve, high speed. |
| Overboost | Boost Addict archetype, straight ending soon. |
| Lane wobble | Weather, collision, low skill. |
| Hazard hit | Low avoidance or crowded pack. |
| Wide turn | Poor corner skill or worn tires. |

Mistake rate should be low enough that success still requires player skill.

## Difficulty Tiers

| Tier | AI Pace | Aggression | Mistakes | Rubber-Band |
|---|---:|---:|---:|---:|
| Easy | 85 percent | Low | High | Helpful to player |
| Normal | 100 percent | Medium | Medium | Subtle |
| Hard | 112 percent | High | Low | Minimal |
| Expert | 122 percent | High | Very low | None near finish |

## Performance Scaling by Region

| Region | AI Upgrade Rating | AI Pace Bias |
|---|---:|---:|
| Neon Harbor | 0-15 | 0.88 |
| Redwood Circuit | 10-25 | 0.94 |
| Mirage Basin | 20-40 | 1.00 |
| Storm Coast | 30-50 | 1.04 |
| Alpine Static | 45-60 | 1.08 |
| Glass Canyon | 55-75 | 1.12 |
| Metro Midnight | 65-85 | 1.16 |
| Aurora Highway | 75-100 | 1.20 |

## Implementation Approach

AI should not use expensive world physics. Each AI car can be represented by:

```text
ai.trackZ
ai.laneX
ai.speed
ai.targetLaneX
ai.state
ai.damage
ai.boostCharges
ai.personality
```

Update order:

1. Find AI's current segment.
2. Compute desired speed from curve, weather, archetype, and traffic.
3. Choose target lane from racing line, pass logic, and hazard avoidance.
4. Apply acceleration/braking toward desired speed.
5. Move lateral position toward target lane.
6. Resolve collisions with nearby cars.
7. Decide boost use.
8. Update damage and mistake states.
9. Sort by `trackZ` for race placement.
