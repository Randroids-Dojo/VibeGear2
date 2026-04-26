# 22. Data schemas

## Track JSON schema

```
{
  "id": "velvet-coast/harbor-run",
  "name": "Harbor Run",
  "tourId": "velvet-coast",
  "author": "core",
  "version": 1,
  "lengthMeters": 4280,
  "laps": 3,
  "laneCount": 3,
  "weatherOptions": ["clear", "light_rain", "dusk"],
  "difficulty": 2,
  "segments": [
    {
      "len": 180,
      "curve": 0.0,
      "grade": 0.0,
      "roadsideLeft": "palms_sparse",
      "roadsideRight": "marina_signs",
      "hazards": []
    },
    {
      "len": 140,
      "curve": 0.35,
      "grade": 0.02,
      "roadsideLeft": "guardrail",
      "roadsideRight": "water_wall",
      "hazards": ["puddle"]
    }
  ],
  "checkpoints": [
    { "segmentIndex": 0, "label": "start" },
    { "segmentIndex": 1, "label": "split-a" }
  ],
  "spawn": {
    "gridSlots": 12
  }
}
```

## Car JSON schema

```
{
  "id": "sparrow-gt",
  "name": "Sparrow GT",
  "class": "balance",
  "purchasePrice": 0,
  "repairFactor": 1.0,
  "baseStats": {
    "topSpeed": 61.0,
    "accel": 16.0,
    "brake": 28.0,
    "gripDry": 1.0,
    "gripWet": 0.82,
    "stability": 1.0,
    "durability": 0.95,
    "nitroEfficiency": 1.0
  },
  "upgradeCaps": {
    "engine": 4,
    "gearbox": 4,
    "dryTires": 4,
    "wetTires": 4,
    "nitro": 4,
    "armor": 4,
    "cooling": 4,
    "aero": 3
  },
  "visualProfile": {
    "spriteSet": "sparrow_gt",
    "paletteSet": "starter_a"
  }
}
```

## Upgrade JSON schema

```
{
  "id": "engine-2",
  "category": "engine",
  "tier": 2,
  "name": "Sport Engine Kit",
  "cost": 6000,
  "effects": {
    "accel": 1.8,
    "topSpeed": 2.0
  }
}
```

## Championship JSON schema

```
{
  "id": "world-tour-standard",
  "name": "World Tour",
  "difficultyPreset": "normal",
  "tours": [
    {
      "id": "velvet-coast",
      "requiredStanding": 4,
      "tracks": [
        "velvet-coast/harbor-run",
        "velvet-coast/sunpier-loop",
        "velvet-coast/cliffline-arc",
        "velvet-coast/lighthouse-fall"
      ]
    }
  ]
}
```

## AI driver JSON schema

```
{
  "id": "ai_cleanline_01",
  "displayName": "K. Vale",
  "archetype": "clean_line",
  "paceScalar": 1.02,
  "mistakeRate": 0.08,
  "aggression": 0.35,
  "weatherSkill": {
    "clear": 1.0,
    "rain": 1.04,
    "fog": 0.98,
    "snow": 1.01
  },
  "nitroUsage": {
    "launchBias": 0.6,
    "straightBias": 0.9,
    "panicBias": 0.1
  }
}
```

## Save-game JSON schema

Current schema major: **v2**. v1 saves migrate forward additively via
`src/persistence/migrations/v1ToV2.ts`; existing v1 fields keep their shape and
the new `audio`, `accessibility`, and `keyBindings` bundles are filled with
the §20 / §19 documented defaults.

```
{
  "version": 2,
  "profileName": "Player",
  "settings": {
    "displaySpeedUnit": "kph",
    "assists": {
      "steeringAssist": false,
      "autoNitro": false,
      "weatherVisualReduction": false
    },
    "difficultyPreset": "normal",
    "transmissionMode": "auto",
    "audio": {
      "master": 1,
      "music": 0.8,
      "sfx": 0.9
    },
    "accessibility": {
      "colorBlindMode": "off",
      "reducedMotion": false,
      "largeUiText": false,
      "screenShakeScale": 1
    },
    "keyBindings": {
      "accelerate": ["ArrowUp", "KeyW"],
      "brake": ["ArrowDown", "KeyS"],
      "left": ["ArrowLeft", "KeyA"],
      "right": ["ArrowRight", "KeyD"],
      "nitro": ["Space"],
      "handbrake": ["ShiftLeft", "ShiftRight"],
      "pause": ["Escape"],
      "shiftUp": ["KeyE"],
      "shiftDown": ["KeyQ"]
    }
  },
  "garage": {
    "credits": 18250,
    "ownedCars": ["sparrow-gt"],
    "activeCarId": "sparrow-gt",
    "installedUpgrades": {
      "sparrow-gt": {
        "engine": 2,
        "gearbox": 1,
        "dryTires": 2,
        "wetTires": 1,
        "nitro": 1,
        "armor": 1,
        "cooling": 0,
        "aero": 0
      }
    }
  },
  "progress": {
    "unlockedTours": ["velvet-coast", "iron-borough"],
    "completedTours": ["velvet-coast"]
  },
  "records": {
    "velvet-coast/harbor-run": {
      "bestLapMs": 67321,
      "bestRaceMs": 214555
    }
  }
}
```

`settings.audio`, `settings.accessibility`, and `settings.keyBindings` are
optional in the runtime schema so a v1 save mid-migration still validates.
Consumers that read settings should default missing fields to the documented
v2 defaults; the v1 -> v2 migration always populates them, so a fully
migrated save will never have them missing in practice.
