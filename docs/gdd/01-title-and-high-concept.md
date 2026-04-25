# 1. Title and High Concept

## Game Title

**VibeGear2**

## One-Sentence Pitch

**VibeGear2 is a fast, retro-modern, pseudo-3D web racing game where players survive aggressive road races, manage damage, earn credits, upgrade their ride, and climb through original themed racing tours.**

## High Concept

VibeGear2 captures the emotional loop of a 16-bit arcade road racer:

- Start near the back of a crowded pack.
- Thread through traffic at high speed.
- Survive weather, hazards, and tight curves.
- Collect boost and cash pickups.
- Finish high enough to advance.
- Spend winnings on meaningful upgrades.
- Return to the track feeling faster, riskier, and more capable.

The game is not a remake. It is a new open-source web game with original cars, tracks, music, visuals, UI, progression, and content.

## Design Pillars

| Pillar | Meaning | Implementation Target |
|---|---|---|
| **Instant velocity** | Racing should feel fast within 5 seconds. | Quick countdown, high starting speed, short time to first overtake. |
| **Arcade clarity** | Handling should be readable, responsive, and forgiving. | Simple controls, visible road curvature, clear collision feedback. |
| **Upgrade tension** | Every race should create a money decision. | Repairs vs upgrades, weather prep, boost stock, and strategic purchases. |
| **Retro-modern style** | The game should evoke 16-bit spectacle without copying. | Low-res inspired sprites, palette discipline, parallax, modern readability. |
| **Mod-first content** | Tracks, cars, tours, AI, and balance should be data-driven. | JSON schemas, validation, clear authoring rules, local mods. |
| **Open-source practicality** | The design must be buildable by a small team. | MVP-first scope, reusable VibeRacer architecture patterns, automated tests. |

## Target Audience

| Audience | What They Want |
|---|---|
| Retro racing fans | Fast arcade handling, music, upgrade progression, nostalgic presentation. |
| Web game players | Instant play, no install, short sessions, keyboard support. |
| Modders | Simple track files, visible schemas, community content rules. |
| Open-source contributors | Clean TypeScript architecture, testable systems, limited asset lock-in. |
| Speedrunners and leaderboard players | Time trial, ghosts, daily challenges, deterministic physics. |

## Platform and Technology Assumptions

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
