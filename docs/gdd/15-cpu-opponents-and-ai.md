# 15. CPU opponents and AI

## AI design goals

AI must feel like real competitors, not moving obstacles.

## CPU archetypes

| Archetype | Behavior |
| --- | --- |
| Rocket starter | Aggressive launch, fades late |
| Clean line | Stable pace, hard to unsettle |
| Bully | Defends and rubs more often |
| Cautious | Brakes early, good in poor weather |
| Chaotic | Mistake-prone but occasionally brilliant |
| Enduro | Consistent tour scorer |

## Racing line model

Use lane-relative driving on top of a center spline:

- Track defines a center path and suggested racing line bias curves.
- AI chooses a lane offset target.
- Overtake logic temporarily shifts target offset.
- Hazard avoidance inserts micro-goals ahead of the current progress index.

## Rubber-banding philosophy

Use light rubber banding only.

Allowed:

- Small pace bonuses to keep midfield relevant.
- Mild lead compression in easy mode.
- Better catch-up in lower difficulties.

Not allowed:

- Teleporting pace.
- Impossible final-lap boosts.
- Rubber-banding that invalidates upgrades.

## Passing behavior

- AI checks overlap windows and threat zones.
- Outside passes preferred in sweepers.
- Inside passes preferred under braking.
- Bully archetypes may force suboptimal lines.
- Cautious archetypes back out in rain or fog.

## Mistakes

AI should occasionally:

- Miss an apex.
- Waste nitro.
- Rub traffic.
- Brake too early in fog.
- Suffer from weather mismatch.

## Difficulty tiers

| Tier | AI pace | Rubber banding | Mistakes | Economy pressure |
| --- | --- | --- | --- | --- |
| Easy | -8% | Medium assist | Frequent | Low |
| Normal | baseline | Mild | Occasional | Moderate |
| Hard | +5% | Minimal | Rare | High |
| Master | +9% | None | Very rare | High |

## Implementation approach

For a pseudo-3D arcade racer, AI should be simulated in track-progress space, not as free-driving 3D rigid bodies:

```
ai.progress       // scalar position along lap spline
ai.laneOffset     // signed lateral position in road width
ai.speed          // target / current
ai.intent         // defend / overtake / recover / conserve
```

This keeps collisions, passing, and ghost replay deterministic and cheap.
