# 1. Title and high concept

Game title: VibeGear2

One-sentence pitch:  
A stylish browser racer where players blast through four-race tours, earn cash, repair damage, tune their machine, and chase podiums across an original world of weather-heavy pseudo-3D tracks.

High concept:  
VibeGear2 is not a remake. It is an original game designed to evoke the emotional loop that made Top Gear 2 memorable: prepare for the next race, survive a difficult field, earn just enough money for a meaningful upgrade, and immediately want to run the next event. The intended feel is “16-bit arcade pressure with modern readability and open-source extensibility.”

## Design pillars

| Pillar | Practical meaning |
| --- | --- |
| Fast readable arcade racing | Controls must feel immediate on keyboard and gamepad. The player should understand grip, danger, and reward at a glance. |
| Upgrade-driven momentum | Every race should either unlock, repair, or improve something. Progression should matter every 5 to 10 minutes. |
| Weather changes decisions | Tires, setup, and driving line should all matter more when conditions change. |
| Tour-based progression | Four linked races create mini-arcs and make aggregate standings exciting. |
| Retro presentation, original content | The game should feel era-inspired without copying proprietary assets, names, layouts, or audiovisual content. |
| Moddable data-first architecture | Tracks, cars, AI profiles, and tours should be JSON-driven so the community can extend the game safely. |

## Target audience

VibeGear2 is for players who enjoy retro racers, score attack loops, garage progression, and games that feel good on a keyboard. The primary audience is desktop players using keyboard or controller. Secondary audiences include speedrunners, retro game fans, open-source contributors, and creators who want to add custom tracks or visual packs.

## Platform and technology assumptions

The current VibeRacer repository uses TypeScript with Next.js 15, React 19, Three.js, Zod, Vitest, Playwright, and Upstash Redis, and it already includes a game page flow, editor flow, local control settings, tuning storage, audio systems, and server-backed track and leaderboard routes. The repo’s current shipped concept is “every URL is a track,” with a browser-based 3D arcade racer, track editing, and a tuning-lab workflow. [2]

Assumed VibeGear2 platform targets

| Item | Target |
| --- | --- |
| Primary platform | Modern desktop browsers |
| Secondary platform | Steam Deck class handheld browsers / web wrappers |
| Future platform | Mobile browsers after v1.0 stabilization |
| Input | Keyboard first, gamepad fully supported, touch later |
| Rendering | Pseudo-3D road renderer in Canvas 2D or hybrid Canvas/WebGL |
| Persistence | Local save first, optional server-backed leaderboards and ghosts |
| Distribution | Static web app plus optional wrapper builds |
