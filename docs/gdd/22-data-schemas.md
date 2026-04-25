# 22. Data Schemas

These are implementation-oriented schema drafts. Final code should use TypeScript types plus runtime validation, such as Zod.

## Track JSON Schema

```json
{
  "schemaVersion": 1,
  "id": "string.unique",
  "title": "string",
  "author": "string",
  "license": "string",
  "regionId": "string",
  "difficulty": 0,
  "laps": 3,
  "segmentLength": 200,
  "roadWidth": 2200,
  "lanes": 3,
  "startTimeOfDay": "day",
  "weatherPool": [
    { "weatherId": "clear", "weight": 100 }
  ],
  "visualTheme": {
    "sky": "string",
    "roadPalette": "string",
    "scenerySet": "string",
    "musicCue": "string"
  },
  "segments": [
    {
      "length": 200,
      "curve": 0,
      "elevation": 0,
      "width": 1,
      "surface": "asphalt",
      "speedHint": 1,
      "scenery": [],
      "hazards": [],
      "pickups": []
    }
  ],
  "aiHints": {
    "basePace": 1,
    "preferredLaneBias": 0,
    "overtakeZones": [],
    "brakeZones": []
  }
}
```

## Car JSON Schema

```json
{
  "schemaVersion": 1,
  "id": "car.ember-compact",
  "displayName": "Ember Compact",
  "author": "VibeGear2 Team",
  "license": "CC-BY-4.0",
  "class": "compact-sprinter",
  "spriteSet": "sprites.cars.ember_compact",
  "baseStats": {
    "speed": 42,
    "acceleration": 58,
    "handling": 72,
    "grip": 68,
    "durability": 38,
    "boost": 45,
    "efficiency": 50
  },
  "physics": {
    "baseTopSpeedMph": 178,
    "baseAccel": 18,
    "baseBrake": 42,
    "baseSteerRate": 2.4,
    "massClass": 0.85,
    "collisionWidth": 180
  },
  "upgradeScaling": {
    "engine": 1,
    "transmission": 1,
    "dryTires": 1.05,
    "wetTires": 1,
    "suspension": 1.08,
    "pulseBoost": 0.95,
    "armor": 0.85
  },
  "unlock": { "type": "starter" }
}
```

## Upgrade JSON Schema

```json
{
  "schemaVersion": 1,
  "id": "upgrade.engine",
  "displayName": "Engine",
  "description": "Improves acceleration and top speed.",
  "levels": [
    {
      "level": 0,
      "label": "Stock",
      "cost": 0,
      "effects": {
        "accelerationMultiplier": 1,
        "topSpeedMultiplier": 1
      }
    },
    {
      "level": 1,
      "label": "Street",
      "cost": 12000,
      "effects": {
        "accelerationMultiplier": 1.08,
        "topSpeedMultiplier": 1.03
      }
    }
  ]
}
```

## Championship JSON Schema

```json
{
  "schemaVersion": 1,
  "id": "championship.main-tour",
  "title": "VibeGear2 Main Tour",
  "regions": [
    {
      "id": "neon-harbor",
      "title": "Neon Harbor",
      "unlockRequirement": { "type": "start" },
      "tracks": [
        "vg2.neon-harbor.pier-pulse",
        "vg2.neon-harbor.signpost-sprint",
        "vg2.neon-harbor.warehouse-loop",
        "vg2.neon-harbor.skyline-sbend"
      ],
      "aiPool": ["ai.vale", "ai.hex", "ai.mica"],
      "completionRequirement": {
        "qualifyAllRaces": true,
        "minimumTourPoints": 6
      },
      "rewards": {
        "credits": 5000,
        "unlocks": ["paint.harbor-neon"]
      }
    }
  ]
}
```

## AI Driver JSON Schema

```json
{
  "schemaVersion": 1,
  "id": "ai.vale",
  "displayName": "Vale",
  "archetype": "line-keeper",
  "carShell": "car.vector-hatch",
  "palette": "blue-white",
  "stats": {
    "pace": 55,
    "cornerSkill": 68,
    "aggression": 32,
    "consistency": 74,
    "weatherSkill": 50,
    "boostSkill": 45,
    "collisionAvoidance": 70
  },
  "dialogue": {
    "intro": "Keep it clean and you might keep up.",
    "win": "Smooth lines win long races.",
    "lose": "You found the faster rhythm."
  },
  "regionBias": ["neon-harbor", "redwood-circuit"]
}
```

## Save Game JSON Schema

```json
{
  "schemaVersion": 1,
  "saveId": "uuid",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "updatedAt": "2026-04-25T00:00:00.000Z",
  "profile": {
    "playerName": "AAA",
    "preferredUnits": "mph"
  },
  "career": {
    "currentRegionId": "neon-harbor",
    "currentTrackIndex": 1,
    "completedTracks": [],
    "regionPoints": {},
    "unlockedRegions": ["neon-harbor"]
  },
  "garage": {
    "credits": 0,
    "activeCarId": "car.ember-compact",
    "ownedCars": ["car.ember-compact"],
    "upgrades": {
      "engine": 0,
      "transmission": 0,
      "dryTires": 0,
      "wetTires": 0,
      "suspension": 0,
      "pulseBoost": 0,
      "armor": 0
    },
    "damage": {
      "front": 0,
      "rear": 0,
      "left": 0,
      "right": 0,
      "suspension": 0,
      "tires": 0,
      "powertrain": 0
    },
    "cosmetics": {
      "paint": "paint.default-red",
      "decal": null
    }
  },
  "records": {
    "bestRaceTimes": {},
    "bestLapTimes": {},
    "medals": {}
  },
  "settings": {
    "difficulty": "normal",
    "transmission": "automatic",
    "assists": {
      "steeringAssist": false,
      "reducedSpinouts": false,
      "weatherVisualReduction": false
    }
  }
}
```
