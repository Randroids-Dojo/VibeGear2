# VibeGear2 - Game Design Document

VibeGear2 is a fast, retro-modern, pseudo-3D web racing game where players survive aggressive road races, manage damage, earn credits, upgrade their ride, and climb through original themed racing tours.

**Document version:** 0.1  
**Project type:** Open-source, browser-based arcade racing game  
**Primary inspiration:** The design feel of 16-bit upgrade-driven arcade racers, especially *Top Gear 2* for SNES  
**Important IP rule:** VibeGear2 must be original. It must not copy protected names, tracks, sprites, music, UI text, car designs, passwords, maps, or proprietary content from *Top Gear 2* or any other commercial game.

---

## 1. Title and High Concept

### Game Title

**VibeGear2**

### One-Sentence Pitch

**VibeGear2 is a fast, retro-modern, pseudo-3D web racing game where players survive aggressive road races, manage damage, earn credits, upgrade their ride, and climb through original themed racing tours.**

### High Concept

VibeGear2 captures the emotional loop of a 16-bit arcade road racer:

- Start near the back of a crowded pack.
- Thread through traffic at high speed.
- Survive weather, hazards, and tight curves.
- Collect boost and cash pickups.
- Finish high enough to advance.
- Spend winnings on meaningful upgrades.
- Return to the track feeling faster, riskier, and more capable.

The game is not a remake. It is a new open-source web game with original cars, tracks, music, visuals, UI, progression, and content.

### Design Pillars

| Pillar | Meaning | Implementation Target |
|---|---|---|
| **Instant velocity** | Racing should feel fast within 5 seconds. | Quick countdown, high starting speed, short time to first overtake. |
| **Arcade clarity** | Handling should be readable, responsive, and forgiving. | Simple controls, visible road curvature, clear collision feedback. |
| **Upgrade tension** | Every race should create a money decision. | Repairs vs upgrades, weather prep, boost stock, and strategic purchases. |
| **Retro-modern style** | The game should evoke 16-bit spectacle without copying. | Low-res inspired sprites, palette discipline, parallax, modern readability. |
| **Mod-first content** | Tracks, cars, tours, AI, and balance should be data-driven. | JSON schemas, validation, clear authoring rules, local mods. |
| **Open-source practicality** | The design must be buildable by a small team. | MVP-first scope, reusable VibeRacer architecture patterns, automated tests. |

### Target Audience

| Audience | What They Want |
|---|---|
| Retro racing fans | Fast arcade handling, music, upgrade progression, nostalgic presentation. |
| Web game players | Instant play, no install, short sessions, keyboard support. |
| Modders | Simple track files, visible schemas, community content rules. |
| Open-source contributors | Clean TypeScript architecture, testable systems, limited asset lock-in. |
| Speedrunners and leaderboard players | Time trial, ghosts, daily challenges, deterministic physics. |

### Platform and Technology Assumptions

| Area | Assumption |
|---|---|
| Primary platform | Desktop browsers. |
| Future platform | Mobile browser or PWA, after desktop feel is stable. |
| Input | Keyboard first, gamepad second, touch later. |
| Rendering | Canvas2D pseudo-3D road renderer for MVP, with optional Three.js use for garage/editor previews. |
| Framework | Reuse VibeRacer patterns: Next.js, React, TypeScript, custom math, Web Audio, local storage, schema validation, and automated tests. |
| Multiplayer | Solo first. Ghost racing and local split-screen are stretch goals. |
| Persistence | Local save for MVP. Optional server leaderboard later. |
| Licensing | Code under a permissive open-source license. Assets under original permissive asset licenses. |

---

## 2. Spiritual Successor Boundaries

### What Should Be Inspired by *Top Gear 2*

VibeGear2 may be inspired by broad, non-proprietary design patterns:

| Inspiration Area | Safe Design Interpretation |
|---|---|
| Upgrade-driven racing | The player earns credits and improves performance over a campaign. |
| Fast pseudo-3D road racing | The camera faces down a winding road with scaling sprites and parallax. |
| Crowded arcade races | Large packs create passing, blocking, and collision tension. |
| Regional progression | Groups of races form themed tours. |
| Weather strategy | Pre-race information influences tire and upgrade decisions. |
| Boost management | Limited speed bursts reward timing and risk. |
| Damage pressure | Crashes create mechanical consequences and repair costs. |
| Local competition | Optional split-screen or ghost play can echo couch racing energy. |
| Memorable soundtrack energy | Original high-energy synth, breakbeat, rock, or chiptune-inspired music. |

### What Must Be Original

VibeGear2 must create original versions of all expressive content:

| Content Type | Rule |
|---|---|
| Game title | Must not use *Top Gear*, Gremlin, Kemco, Lotus, or related marks. |
| Tracks | Must not copy country/city/track names, order, layouts, hazards, passwords, or progression map. |
| Cars | Must not copy car silhouettes, names, colors as identity, sprites, stats, or fictional equivalents. |
| Music | Must be newly composed or properly licensed. No melodies, arrangements, samples, or soundalikes. |
| UI | Must not copy HUD layout pixel-for-pixel, icons, menu wording, fonts, or screen composition. |
| Sprites | Must be original or open-license, not traced or ripped. |
| Mechanics | General arcade racing systems are acceptable, but exact numeric tables and content structures should be redesigned. |
| Text | No manual text, in-game text, race names, password text, or copied descriptions. |

### Legal and IP Safety Guidelines

This document is not legal advice. The project should follow conservative creative boundaries:

1. **No ROM-derived material.** Do not inspect, rip, decompile, trace, or include data from commercial game ROMs.
2. **No asset substitution from commercial games.** Placeholders must be generated, drawn from scratch, or sourced from permissive asset libraries.
3. **No exact recreation of tracks.** Even if a track name is changed, do not recreate its curves, hazards, weather, length, or order.
4. **No side-by-side cloning.** Do not build by comparing screenshots frame by frame.
5. **No replacement messaging.** Public materials should describe VibeGear2 as an original arcade racer, not as a remake.
6. **No trademark confusion.** Do not imply endorsement by the owners of *Top Gear 2*.
7. **Clean-room friendly process.** Use publicly available design research for broad understanding, then create new specs, names, assets, and numbers.

### Naming, Art, Music, and Track Originality Rules

| Domain | Required Rule |
|---|---|
| Region names | Use fictional or stylized names such as `Neon Harbor` or `Glass Canyon`, not the original game's country/city list. |
| Track names | Use original names based on the region theme. |
| Cars | Use invented body styles and fictional manufacturer names, or no manufacturers at all. |
| Music | Compose original tracks with references such as `high-energy synth arcade racing`, not `like this exact song`. |
| UI | Use a new visual hierarchy. The HUD may show common racing info but must not duplicate the original arrangement. |
| Pickups | Use original iconography and behavior names such as `Pulse Charge`, `Credit Chip`, or `Grip Token`. |
| Passwords | Prefer modern save files. If retro passwords are included as a novelty, use a new encoding and visual style. |

---
