# 9. Track Design

## Track Anatomy

A VibeGear2 track is a sequence of road segments. Each segment has:

- Length
- Curvature
- Elevation
- Width
- Lane count
- Surface type
- Weather compatibility
- Roadside scenery
- Hazards
- Pickups
- AI hints
- Visual palette cues
- Optional checkpoint markers

## Segment Types

| Segment Type | Use |
|---|---|
| Straight | Speed, boost, passing, recovery. |
| Gentle curve | Teaches reading road shape. |
| Sweeper | Long high-speed curve, tests throttle control. |
| Hairpin | Rare, slows pace, creates passing mistakes. |
| Crest | Brief visibility reduction, possible light air. |
| Dip | Compression feel, speed illusion. |
| Chicane | Alternating curves, tests steering rhythm. |
| Narrow gate | Raises collision risk. |
| Hazard lane | Encourages lane choice. |
| Pickup line | Optional risk-reward route. |

## Road Curvature

Curvature is stored as a numeric value per segment.

| Curve Value | Meaning |
|---|---|
| 0.00 | Straight |
| 0.20 | Gentle curve |
| 0.45 | Medium curve |
| 0.70 | Sharp curve |
| 1.00 | Extreme curve, use sparingly |
| Negative value | Left curve |
| Positive value | Right curve |

Initial tuning target:

```text
Segment length: 200 world units
Typical curve duration: 3-12 segments
Extreme curve duration: 1-4 segments
Safe early-game max curve: 0.55
Late-game max curve: 0.90
```

## Elevation and Hills

Elevation is a signed grade value.

| Elevation Value | Meaning |
|---|---|
| 0.00 | Flat |
| 0.20 | Gentle rise |
| 0.45 | Noticeable hill |
| 0.70 | Steep climb |
| -0.45 | Noticeable descent |
| -0.70 | Steep descent |

Rules:

- Hills should affect visibility and speed perception more than physics.
- Crests can hide upcoming turns, but signage must warn the player.
- Big jumps are rare and optional. They should not be required for progression.

## Lane Width

| Track Type | Width Multiplier | Lanes |
|---|---:|---:|
| Tutorial | 1.25 | 4 |
| Standard road | 1.00 | 3 |
| Narrow mountain | 0.82 | 2 |
| Highway | 1.30 | 4 |
| Tunnel | 0.90 | 2-3 |
| Challenge track | 0.75 | 2 |

## Forks and Shortcuts

Forks are stretch content. They increase renderer, AI, and minimap complexity.

MVP rule:

- No true forks.
- Use lane-based risk-reward instead.

v1.1 optional rule:

- Shortcuts must be data-defined.
- AI must understand shortcut probability.
- Shortcut must not bypass checkpoints unfairly.
- Shortcut must have a visible drawback such as dirt grip, hazard density, or damage risk.

## Hazards

| Hazard | Effect | Design Rule |
|---|---|---|
| Puddle | Wet grip penalty for 0.8 seconds | Use in rain regions. |
| Oil sheen | Short lateral slip | Rare, visible, avoid at blind crest. |
| Gravel patch | Off-road style decel | Teaches surface changes. |
| Debris cone | Minor damage and lane disruption | Must be avoidable. |
| Barrier drum | Medium collision, strong speed loss | Use near edges. |
| Roadwork gate | Narrowing obstacle | Clear signage required. |
| Snow drift | Grip loss and speed cap | Snow tracks only. |
| Wind burst | Slight lateral push | Late-game only. |

## Roadside Scenery

Roadside objects create speed and theme but must not hide hazards.

| Layer | Examples |
|---|---|
| Far background | Skyline, mountains, forest wall, aurora, storm clouds. |
| Mid parallax | Bridges, cranes, cliffs, trees, towers. |
| Roadside sprites | Signs, lamps, posts, guardrails, fans, markers. |
| Track hazards | Barrels, debris, puddles, snowbanks. |
| Dynamic effects | Rain streaks, fog bands, dust, light flashes. |

## Track Length Targets

| Track Size | Segment Count | Race Duration |
|---|---:|---:|
| Short | 120-160 | 2:00-2:40 |
| Medium | 170-230 | 2:45-3:30 |
| Long | 240-320 | 3:30-4:45 |
| Challenge | 320-450 | 4:30-7:00 |

## Track Difficulty Rating

Track difficulty is computed from:

```text
difficulty =
  curveScore * 0.30 +
  elevationScore * 0.15 +
  widthScore * 0.15 +
  hazardScore * 0.15 +
  weatherScore * 0.15 +
  visibilityScore * 0.10
```

Ratings:

| Score | Label |
|---:|---|
| 0-20 | Beginner |
| 21-40 | Easy |
| 41-60 | Medium |
| 61-80 | Hard |
| 81-100 | Expert |

## Procedural or Data-Driven Track Format

Official tracks should be hand-authored in JSON. Procedural tools may generate drafts, but the final campaign tracks should be curated.

Track files must include unique ID, title, author, license, schema version, difficulty rating, region assignment, segment list, weather pool, AI speed hints, pickup/hazard placement, visual theme, and validation hash.

## Example Track Schema

```json
{
  "schemaVersion": 1,
  "id": "vg2.neon-harbor.pier-pulse",
  "title": "Pier Pulse",
  "author": "VibeGear2 Team",
  "license": "CC-BY-4.0",
  "regionId": "neon-harbor",
  "difficulty": 18,
  "laps": 3,
  "segmentLength": 200,
  "roadWidth": 2200,
  "lanes": 3,
  "startTimeOfDay": "sunset",
  "weatherPool": [
    { "weatherId": "clear", "weight": 70 },
    { "weatherId": "light-rain", "weight": 30 }
  ],
  "visualTheme": {
    "sky": "harbor_sunset",
    "roadPalette": "neon_asphalt",
    "scenerySet": "harbor_intro"
  },
  "segments": [
    {
      "length": 200,
      "curve": 0,
      "elevation": 0,
      "width": 1,
      "surface": "asphalt",
      "scenery": [
        { "sprite": "lamp_post_a", "side": "left", "offset": 1.25 }
      ],
      "hazards": [],
      "pickups": []
    }
  ],
  "aiHints": {
    "basePace": 0.42,
    "preferredLaneBias": 0,
    "overtakeZones": [12, 25, 48]
  },
  "musicCue": "race_neon_01"
}
```

## Guidelines for Community-Created Tracks

| Rule | Reason |
|---|---|
| Must use original names and assets. | Avoid IP contamination. |
| Must include license metadata. | Allows safe distribution. |
| Must pass schema validation. | Prevents broken tracks. |
| Must pass playability validation. | Ensures finishable races. |
| Must not use slurs, hate symbols, illegal content, or trademark abuse. | Community safety. |
| Must not recreate commercial tracks. | Legal safety. |
| Must define author and contact field. | Attribution and moderation. |
| Must be hashable. | Leaderboard integrity. |

Validation checks:

- Segment list exists and length is within limits.
- No unavoidable hazard immediately after blind crest.
- Minimum road width does not fall below allowed threshold.
- Race can be completed by baseline AI.
- Pickups are not placed inside hard obstacles.
- Weather pool is compatible with surfaces.
- Track hash changes when meaningful data changes.
