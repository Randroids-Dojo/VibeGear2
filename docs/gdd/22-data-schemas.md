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

`weatherOptions` entries are the §14 weather ids:
`clear`, `overcast`, `light_rain`, `rain`, `heavy_rain`, `fog`, `snow`,
`dusk`, and `night`.

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
      ],
      "sponsors": ["velvet-coast-co-op", "cleanline-insurance"],
      "aiDrivers": [
        "ai_rocket_01",
        "ai_cleanline_01",
        "ai_bully_01"
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

## Hazard registry JSON schema

```
{
  "id": "traffic_cone",
  "kind": "traffic_cone",
  "displayName": "Traffic Cone",
  "defaultWidth": 1.8,
  "defaultLength": 8,
  "laneOffset": 0,
  "gripMultiplier": 1.0,
  "damageKind": "offRoadObject",
  "damageMagnitude": 6,
  "breakable": true
}
```

`Track.segments[].hazards` entries reference these hazard ids. Tunnel
entries are valid registry metadata but their light and audio transition
effects are owned by the tunnel segment slice.

## Mod manifest JSON schema

Data mods live under `/mods/<mod-id>/` and load through a manifest file:

```
{
  "id": "community-pack",
  "name": "Community Pack",
  "version": 1,
  "author": "A. Contributor",
  "license": "CC-BY-SA-4.0",
  "originality": "Original data authored from scratch for this project.",
  "description": "Optional player-facing summary.",
  "data": {
    "tracks": ["tracks/harbor-day.json"],
    "cars": ["cars/local-starter.json"],
    "upgrades": ["upgrades/local-upgrades.json"],
    "aiDrivers": ["ai/local-rivals.json"],
    "championships": ["championships/local-cup.json"]
  },
  "assets": {
    "art": ["art/roadside.local.manifest.json"],
    "audio": ["audio/weather.local.manifest.json"]
  }
}
```

`id` must match the folder name in `/mods/<mod-id>/`. Mod manifests are
strict data: no executable plugin files, no URL schemes, no absolute paths,
and no `..` path escapes. The loader accepts the approved project data
licenses (`CC-BY-SA-4.0`, `CC-BY-4.0`, `CC0-1.0`, and `public-domain`) and
requires an originality statement for legal review. The `data` object must
reference at least one JSON file, and every referenced file validates against
the matching schema in this section.

## Save-game JSON schema

Current schema major: **v3**. v1 saves migrate forward additively via
`src/persistence/migrations/v1ToV2.ts`; existing v1 fields keep their shape and
the new `audio`, `accessibility`, and `keyBindings` bundles are filled with
the §20 / §19 documented defaults. v2 saves migrate forward additively via
`src/persistence/migrations/v2ToV3.ts`; existing v2 fields keep their shape and
the new `ghosts` map is filled with `{}`.

```
{
  "version": 3,
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
    },
    "pendingDamage": {
      "sparrow-gt": {
        "zones": {
          "engine": 0.2,
          "tires": 0.1,
          "body": 0.25
        },
        "total": 0.1975,
        "offRoadAccumSeconds": 0
      }
    },
    "lastRaceCashEarned": 2200
  },
  "progress": {
    "unlockedTours": ["velvet-coast", "iron-borough"],
    "completedTours": ["velvet-coast"],
    "activeTour": {
      "tourId": "iron-borough",
      "raceIndex": 1,
      "results": [
        {
          "trackId": "iron-borough/freightline-ring",
          "placement": 2,
          "dnf": false,
          "cashEarned": 1800
        }
      ]
    }
  },
  "records": {
    "velvet-coast/harbor-run": {
      "bestLapMs": 67321,
      "bestRaceMs": 214555
    }
  },
  "ghosts": {},
  "writeCounter": 12
}
```

`settings.audio`, `settings.accessibility`, and `settings.keyBindings` are
optional in the runtime schema so a v1 save mid-migration still validates.
Consumers that read settings should default missing fields to the documented
v2 defaults; the v1 -> v2 migration always populates them, so a fully
migrated save will never have them missing in practice.

`garage.pendingDamage` is the repair queue keyed by car id. It stores
per-zone damage values in `[0, 1]`, a weighted `total`, and the
off-road accumulator used by the §13 damage model. It is optional so
older v3 saves still validate; a fully fresh save seeds it to `{}`.
`garage.lastRaceCashEarned` is the previous credited race payout used by
the §12 essential-repair cap. It is optional for older saves and seeded
to `0` on fresh saves.

`progress.activeTour` is optional and exists only while a four-race tour
is in progress. `raceIndex` points at the next tour race to run, and
`results` stores completed race outcomes in order, including the cash
receipt used by the tour-clear bonus, so the results screen can resume,
aggregate standings, unlock the next tour on pass, and clear the cursor
after the fourth race.

`writeCounter` is the cross-tab last-write-wins advisory described in
`docs/gdd/21-technical-design-for-web-implementation.md` "Cross-tab
consistency". It is independent of the schema `version`, optional so v1
saves and pre-counter v2 saves still validate (the loader treats
`undefined` as `0`), and incremented by `saveSave` on every persist. The
v1 -> v2 migrator seeds it to `0` if absent.

`ghosts` is the §6 Time Trial PB replay map keyed by track id. It is optional
in the runtime schema so v1 / v2 saves still validate before migration, but a
fully migrated v3 save carries at least an empty map. Each stored entry uses
the Ghost replay schema below.
