# 14. Weather and Environmental Systems

## Weather Design Goal

Weather should create strategic variety across regions and meaningful upgrade choices.

Weather must affect:

- Visual readability
- Grip
- AI pace
- Pickup risk
- Braking distance
- Roadside atmosphere
- Audio ambience

## Weather Types

| Weather | Visual | Physics | Best Counter |
|---|---|---|---|
| Clear | Bright road, clean horizon | Baseline | Any |
| Overcast | Muted palette | Slight visibility loss | None |
| Light Rain | Rain streaks, wet road shine | Lower grip | Wet tires |
| Heavy Rain | Dark road, puddles, spray | Major grip and visibility loss | Wet tires, suspension |
| Fog | Fog bands, faded sprites | Visibility loss | Track knowledge |
| Snow | Snow shoulders, flurries | Grip loss, snowbank hazards | Wet tires, suspension |
| Dust | Dust haze, wind streaks | Grip and visibility loss | Suspension |
| Night | Headlight emphasis, glowing signs | Lower visibility | Memorization, signs |
| Storm | Rain plus flashes and wind | Grip loss, visibility pulses | Wet tires, cautious boost |

## Visual Effects

| Effect | Implementation |
|---|---|
| Rain streaks | Screen-space particles with adjustable opacity. |
| Road shine | Alternate road palette and highlights. |
| Spray | Small sprites behind cars. |
| Fog | Alpha bands near horizon and sprite fade by depth. |
| Snow | Slow particles plus white shoulder palette. |
| Dust | Low-opacity scrolling texture overlay. |
| Lightning | Rare palette flash, no strobe by default. |
| Headlights | Cone overlay and reflective road markers. |

## Physics Effects

| Weather | Grip | Drag | AI Pace | Hazard Frequency |
|---|---:|---:|---:|---:|
| Clear | 1.00 | 1.00 | 1.00 | 1.00 |
| Light Rain | 0.86 | 1.01 | 0.96 | 1.25 |
| Heavy Rain | 0.76 | 1.03 | 0.90 | 1.60 |
| Fog | 0.96 | 1.00 | 0.92 | 1.00 |
| Snow | 0.68 | 1.06 | 0.84 | 1.40 |
| Dust | 0.82 | 1.04 | 0.90 | 1.20 |
| Night | 1.00 | 1.00 | 0.96 | 1.00 |
| Storm | 0.72 | 1.06 | 0.86 | 1.70 |

## Track-Specific Weather

Each track has a weather pool.

```json
"weatherPool": [
  { "weatherId": "clear", "weight": 50 },
  { "weatherId": "light-rain", "weight": 35 },
  { "weatherId": "heavy-rain", "weight": 15 }
]
```

Career mode should usually use authored weather for major races, not pure random selection. Random weather is better for quick race and daily challenges.

## Forecasting in Pre-Race UI

Forecast fields:

| Field | Meaning |
|---|---|
| Weather | Clear, Rain, Snow, etc. |
| Confidence | Certain, Likely, or Variable. |
| Grip warning | Estimated grip penalty. |
| Visibility warning | Estimated draw-distance penalty. |
| Recommended upgrades | Tires, suspension, armor, etc. |
| AI note | Example: `Local rivals are strong in rain.` |

## Accessibility Options for Weather Visuals

| Option | Effect |
|---|---|
| Reduce weather opacity | Lowers rain/snow/dust overlay. |
| Disable lightning flash | Removes sudden bright flashes. |
| High-contrast road edge | Adds clearer lane and shoulder markers. |
| Simplified fog | Replaces dense fog with distance tint. |
| Weather physics assist | Reduces extreme grip penalties. |
| Stable horizon | Reduces camera shake in storms. |
