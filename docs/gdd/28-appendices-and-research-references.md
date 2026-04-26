# 28. Appendices

## Glossary

| Term | Meaning |
| --- | --- |
| Tour | A four-race progression block |
| Setup | Tires plus tuning values applied to a car |
| Grip | Traction multiplier that affects steering and braking authority |
| Limp mode | Severely damaged but still drivable state |
| Segment | One authored piece of road data used by the renderer |
| Ghost | Playback of a previous best lap |
| Weather profile | Visual and handling modifier bundle |
| Pace scalar | AI multiplier applied to target speed behavior |

## Example tuning values

| Setting | Beginner preset | Balanced preset | Expert preset |
| --- | --- | --- | --- |
| Steering assist | 0.25 | 0.10 | 0.00 |
| Nitro stability penalty | 0.70 | 1.00 | 1.15 |
| Damage severity | 0.75 | 1.00 | 1.20 |
| Off-road drag | 1.20 | 1.00 | 0.95 |

## Example track file

```
{
  "id": "glass-ridge/whitepass",
  "name": "Whitepass",
  "tourId": "glass-ridge",
  "lengthMeters": 5020,
  "laps": 2,
  "laneCount": 3,
  "weatherOptions": ["snow", "fog"],
  "difficulty": 4,
  "segments": [
    { "len": 200, "curve": 0.0,  "grade": 0.04, "roadsideLeft": "snow_pines", "roadsideRight": "snow_pines", "hazards": [] },
    { "len": 120, "curve": 0.55, "grade": 0.02, "roadsideLeft": "rock_wall",  "roadsideRight": "guardrail",  "hazards": ["snow_patch"] },
    { "len": 160, "curve": -0.18, "grade": -0.06, "roadsideLeft": "tunnel", "roadsideRight": "rock_wall", "hazards": [] }
  ],
  "checkpoints": [
    { "segmentIndex": 0, "label": "start" },
    { "segmentIndex": 11, "label": "ridge" },
    { "segmentIndex": 24, "label": "tunnel" }
  ]
}
```

## Example car file

```
{
  "id": "tempest-r",
  "name": "Tempest R",
  "class": "power",
  "purchasePrice": 32000,
  "repairFactor": 1.15,
  "baseStats": {
    "topSpeed": 76.0,
    "accel": 20.0,
    "brake": 31.0,
    "gripDry": 1.02,
    "gripWet": 0.84,
    "stability": 1.0,
    "durability": 0.96,
    "nitroEfficiency": 1.05
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
  }
}
```

## Open questions and limitations

The research base is strong on Top Gear 2’s structure, upgrade categories, country sequence, weather significance, and community memory, but weaker on a few exact internals: I did not independently verify the precise SNES opponent count from a primary manual source, the exact stock nitro charge count, or the exact single-player viewport behavior across all versions and recordings. Where this document needed those specifics for implementation, it chooses original values rather than pretending the original is fully documented. [25]

## Research references

- Top Gear 2 manual scan — primary evidence for championship scoring, passwords, and advice to buy wet tires for rain and snow. [5]
- MobyGames Top Gear 2 page — release metadata, credits, critical average, and a useful player-review summary of speed feel, track variety, and turbo tactics. [26]
- GameFAQs cheats/password page — reliable country progression order through the password system. [6]
- GameFAQs FAQ by cnick — strongest practical reference for controls, upgrade categories, upgrade prices, and strategy implications of weather, armor, gearbox, and nitro. [27]
- Wikipedia / Top Gear 2 overview — broad confirmation of the 64-track, 16-country structure and the sequel’s emphasis on damage, upgrades, and weather. [28]
- Top Gear 1 GameFAQs guide — useful comparison point for what changed between the first game and Top Gear 2. [29]
- Top Gear 3000 GameFAQs FAQ and MobyGames page — useful comparison point for the series’ later evolution into credits, weapons, route splits, and full-screen single-player options. [30]
- Community sentiment snippets on Reddit and MobyGames — player memory around soundtrack love, speed feel, and some criticism of repetition during long runs. [31]
- Sega-16 retrospective — useful reminder that weather overlays, fog, and visibility reduction were part of the remembered presentation, while also illustrating how port differences can distort perception. [32]
- Speedrun/TAS references — useful for confirming that the game is still actively studied at the track level and for surfacing quirks/glitches that VibeGear2 should avoid reproducing accidentally. [33]
- Jake Gordon JavaScript racer repo and curves article — strongest modern web reference for segment-based pseudo-3D road rendering, center-line curve offsets, hills, and practical web implementation tradeoffs. [34]
- Lou’s Pseudo-3D page search result — concise supporting reference for the raster-road framing of pseudo-3D racing visuals. [35]
- VibeRacer repository README and docs index — confirms current project goals, URL-as-track concept, and expectation that the design can be reimplemented across stacks. [36]
- VibeRacer package.json — confirms stack: Next.js, React, Three.js, Zod, Upstash Redis, Vitest, and Playwright. [37]
- VibeRacer source files — key evidence for the current architecture: React session orchestration in Game.tsx, the rAF-driven renderer loop in RaceCanvas.tsx, deterministic simulation in tick.ts, physics parameters in physics.ts, track validation/editor systems, local control/tuning persistence, and signed leaderboard submissions. [38]

[1] [3] [28] Top Gear 2

https://en.wikipedia.org/wiki/Top_Gear_2?utm_source=chatgpt.com

[2] [37] https://github.com/Randroids-Dojo/VibeRacer/blob/main/package.json

https://github.com/Randroids-Dojo/VibeRacer/blob/main/package.json

[4] [8] [26] Top Gear 2 (1993)

https://www.mobygames.com/game/15505/top-gear-2/?utm_source=chatgpt.com

[5] [10] https://ia600702.us.archive.org/27/items/SNESManuals/Top%20Gear%202%20%28USA%29.pdf

https://ia600702.us.archive.org/27/items/SNESManuals/Top%20Gear%202%20%28USA%29.pdf

[6] [25] https://gamefaqs.gamespot.com/snes/588804-top-gear-2/cheats

https://gamefaqs.gamespot.com/snes/588804-top-gear-2/cheats

[7] [9] [11] [17] [27] https://gamefaqs.gamespot.com/snes/588804-top-gear-2/faqs/7418

https://gamefaqs.gamespot.com/snes/588804-top-gear-2/faqs/7418

[12] https://www.reddit.com/r/retrogaming/comments/ac871i/in_2018_i_have_played_and_finished_50_mega/

https://www.reddit.com/r/retrogaming/comments/ac871i/in_2018_i_have_played_and_finished_50_mega/

[13] https://www.sega-16.com/2011/02/top-gear-2/

https://www.sega-16.com/2011/02/top-gear-2/

[14] Top Gear 2 Longplay (SNES) [60 FPS]

https://www.youtube.com/watch?v=_Q-xLf2NvPU&utm_source=chatgpt.com

[15] [29] https://gamefaqs.gamespot.com/snes/588802-top-gear/faqs/38181

https://gamefaqs.gamespot.com/snes/588802-top-gear/faqs/38181

[16] [34] https://github.com/jakesgordon/javascript-racer

https://github.com/jakesgordon/javascript-racer

[18] https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/components/RaceCanvas.tsx

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/components/RaceCanvas.tsx

[19] [31] https://www.reddit.com/r/snes/comments/1o2b8cf/any_top_gear_2_racers/

https://www.reddit.com/r/snes/comments/1o2b8cf/any_top_gear_2_racers/

[20] https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/game/audio.ts

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/game/audio.ts

[21] https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/hooks/useKeyboard.ts

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/hooks/useKeyboard.ts

[22] raw.githubusercontent.com

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/components/TouchControls.tsx

[23] [38] https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/components/Game.tsx

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/components/Game.tsx

[24] https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/hooks/useControlSettings.ts

https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/hooks/useControlSettings.ts

[30] https://gamefaqs.gamespot.com/snes/588803-top-gear-3000/faqs/11921

https://gamefaqs.gamespot.com/snes/588803-top-gear-3000/faqs/11921

[32] Top Gear 2

https://www.sega-16.com/2011/02/top-gear-2/?utm_source=chatgpt.com

[33] Technickle's SNES Top Gear 2 "all tracks" in 1:55:55.91

https://tasvideos.org/8904S?utm_source=chatgpt.com

[35] https://www.extentofthejam.com/pseudo/

https://www.extentofthejam.com/pseudo/

[36] https://github.com/Randroids-Dojo/VibeRacer

https://github.com/Randroids-Dojo/VibeRacer
