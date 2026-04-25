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

## 3. *Top Gear 2* Research Summary

### Research Status

This section summarizes source research into *Top Gear 2* as design context. It separates verified facts from inferred behavior. VibeGear2 uses these observations to identify what made the experience memorable, then creates original systems.

### Verified Core Structure

*Top Gear 2* is an SNES arcade racing game built around career progression, upgrades, and repeated races across real-world themed locations. The [official SNES manual](https://ia600702.us.archive.org/27/items/SNESManuals/Top%20Gear%202%20%28USA%29.pdf) describes race setup, player options, car setup, race information, HUD elements, upgrades, money, points, pickups, and passwords. [MobyGames](https://www.mobygames.com/game/6910/top-gear-2/) and other historical references describe the campaign as 16 countries with 4 circuits each, for 64 total circuits, with four-race blocks acting as local championships.

| System | Verified Behavior |
|---|---|
| Campaign | 16 countries, 4 races each, 64 races total. |
| Race pack | Player races against a large field. MobyGames describes 19 opponent cars. |
| Advancement | Top 10 finish was required to continue. |
| Scoring | Top 6 earned championship-style points. |
| Money | Placement payouts and track pickups funded upgrades. |
| Passwords | Passwords allowed continuation after completing a country. |
| Race info | Pre-race information showed current location, circuit length, laps, weather, and race start time. |
| HUD | Displayed tachometer, speed, gear, nitros, stopwatch, track diagram, fuel, damage, position, and lap. |
| Upgrades | Engine, gearbox, tires, nitro, armor, and paint customization were available. |
| Weather | Rain and snow mattered enough that the manual recommended wet tires for rain/snow. |
| Multiplayer | Two-player mode used top and bottom split-screen. |

### Core Systems and Why They Mattered

| System | Why It Worked | VibeGear2 Design Takeaway |
|---|---|---|
| Four-race regions | Short arcs gave players medium-term goals. | Use 4-race original regions with clear standings. |
| Top-10 qualification | A race could matter even without winning. | Let players advance by surviving, but reward podium pushing. |
| Upgrade economy | Winnings created meaningful garage decisions. | Make repairs vs upgrades a recurring tension. |
| Weather previews | The player could prepare before the race. | Forecasts should clearly inform tire and risk choices. |
| Damage | Crashes mattered beyond temporary speed loss. | Damage should create pressure without making one mistake fatal. |
| Pickups | Lane choice mattered moment to moment. | Use optional pickups as risk-reward, not mandatory chores. |
| Dense HUD | Racing, money, damage, and boost information stayed visible. | Keep high-information arcade HUD, but redesign it. |

### Race Structure and Progression

The game grouped races into country-based sets. Each set contained four races, and completing the set produced a password to continue. The top finishing positions received points and cash, while failing to qualify blocked progression. This made every race matter, even when the player was not racing for first place.

**Design takeaway for VibeGear2:** Use regional tours of 4 races, but avoid copying the original world list, names, order, and exact reward table. Make `just qualify` and `push for podium money` both valid goals.

### Controls, HUD, and Transmission

The manual describes steering, acceleration, braking, nitro, pausing, and manual gear shifting. It also includes multiple controller layouts and automatic/manual transmission selection. The race HUD was dense, showing speed, gear, nitro, fuel, damage, position, lap, and track information.

**Design takeaway for VibeGear2:** Support keyboard and gamepad remapping, automatic transmission by default, and manual shifting for players who want mastery. Keep a dense arcade HUD, but redesign the layout, iconography, and color language.

### Upgrade System

*Top Gear 2* centered long-term progression on a single upgradeable car rather than a large car roster. The manual and fan documentation describe engine, wet tires, dry tires, gearboxes, nitro systems, armor, and paint customization. [GameFAQs player documentation](https://gamefaqs.gamespot.com/snes/588781-top-gear-2/faqs/7599) and [TASVideos notes](https://tasvideos.org/4384M) show that upgrade routing is strategically meaningful for both casual progression and optimized play.

**Design takeaway for VibeGear2:** The garage should be strategic and readable. Upgrades should change the feel of the car, not just increase numbers.

### Damage, Weather, and Risk

The manual states that crashes can reduce performance or break down the player's car, and that the damage meter communicates condition. Rain and snow were meaningful enough that pre-race setup mattered. Community and review sources, including [SNES Central](https://snescentral.com/reviews/topgear2.php) and [GameFAQs reviews](https://gamefaqs.gamespot.com/snes/588781-top-gear-2/reviews/166481), note that damage and difficulty could feel harsh.

**Design takeaway for VibeGear2:** Damage and weather should create tension, not unavoidable frustration. Repairs must be meaningful, but the game should rarely make a race feel hopeless after one mistake.

### Visual and Technical Feel

*Top Gear 2* belongs to the pseudo-3D arcade road-racing tradition associated with scaling sprites, road color bands, horizon backgrounds, roadside objects, and a fixed chase camera. Modern JavaScript pseudo-3D racing references, especially Jake Gordon's [JavaScript Racer](https://jakesgordon.com/writing/javascript-racer/) and [Code inComplete tutorial](https://codeincomplete.com/articles/javascript-racer-v1-straight/), describe implementing this feel with projected road segments, sprite scaling, `requestAnimationFrame` loops, draw distance, camera depth, and tunable acceleration/braking/off-road values.

**Design takeaway for VibeGear2:** Build a deterministic pseudo-3D segment renderer. Do not attempt a literal hardware recreation. Use modern browser tools to capture the readable, fast, layered road illusion.

### Differences Between Related Games

| Game | Relevant Difference |
|---|---|
| *Top Gear* | Earlier structure included pit stops and fuel pressure as major race concerns. See [MobyGames: Top Gear](https://www.mobygames.com/game/940/top-gear/). |
| *Top Gear 2* | Moves strongly into upgrade-driven career progression, weather prep, damage, pickups, and a single customized player car. |
| *Top Gear 3000* | Later futuristic direction expanded upgrades and moved the series farther from grounded road racing. See [Top Gear 3000 overview](https://en.wikipedia.org/wiki/Top_Gear_3000). |

### Known Limitations to Improve On

| Limitation Observed in Sources or Player Discussion | VibeGear2 Improvement |
|---|---|
| Harsh damage could make a race feel unwinnable. | Add graded damage, accessibility options, and partial recovery. |
| Late game may become too easy after full upgrades. | Scale AI, track complexity, hazards, and optional medals beyond basic completion. |
| Limited music variety can become repetitive. | Use more race themes, adaptive layers, and unlockable playlists. |
| Tire squeal/effects can fight music. | Mix audio dynamically and expose separate volume sliders. |
| Password continuation is dated. | Use local saves, optional retro code export as novelty. |
| Exact progression was fixed. | Support official tours plus modded tours. |
| Two-player split-screen is technically demanding. | MVP solo first, ghost racing next, split-screen later. |

---
