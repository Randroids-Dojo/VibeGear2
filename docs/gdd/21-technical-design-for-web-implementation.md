# 21. Technical Design for Web Implementation

## Recommended Architecture

VibeGear2 should be built as a deterministic TypeScript game inside a modern web app.

Recommended layers:

```text
app shell
 -> input layer
 -> simulation tick
 -> race state
 -> renderer
 -> audio
 -> UI overlay
 -> persistence
 -> mod/content loader
```

## How This Could Build on VibeRacer

The [VibeRacer repository](https://github.com/Randroids-Dojo/VibeRacer) is a useful technical base, but VibeGear2 should not simply reskin it.

Relevant VibeRacer findings:

- The repository is a browser racing project with folders for `src`, `docs`, `public/models`, tests, Next, TypeScript, Vitest, and Playwright configuration.
- Its [AGENTS.md](https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/AGENTS.md) favors Next.js App Router, React, TypeScript, raw Three.js, a custom math integrator, Web Audio API, Zod validation, and Vitest/Playwright tests.
- Its [existing GDD](https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/docs/GDD.md) describes a `Game.tsx` orchestrator, pure `tick.ts` update loop, `requestAnimationFrame` rendering, throttled HUD updates, keyboard control hooks, localStorage settings, and an arcade physics model.
- Its [physics source](https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/game/physics.ts) uses scalar speed and heading rather than a heavy physics engine.
- Its [schema source](https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/lib/schemas.ts) uses validated track schemas, track width constants, checkpoints, and hash-based versioning.
- Its [music source](https://raw.githubusercontent.com/Randroids-Dojo/VibeRacer/main/src/game/music.ts) uses the Web Audio API with procedural scheduling, music states, crossfades, intensity, and countdown beeps.

## Reusable VibeRacer Patterns

| VibeRacer Pattern | VibeGear2 Use |
|---|---|
| Pure tick function | Deterministic race simulation. |
| Custom physics | Pseudo-3D arcade model. |
| Keyboard hook | Input layer foundation. |
| LocalStorage controls | Remapping and accessibility settings. |
| Zod schemas | Track, car, save, AI, upgrade validation. |
| Track hash | Mod and leaderboard integrity. |
| Web Audio scheduler | Race music, engine loops, countdown. |
| Vitest | Physics, economy, track validation tests. |
| Playwright | End-to-end race start, garage, save tests. |
| URL share concept | Mod track sharing and challenges. |

## Major Changes from VibeRacer

| VibeRacer | VibeGear2 |
|---|---|
| 3D top-down or chase loop track | Pseudo-3D road segment racer. |
| Every URL is a track | Career-first with optional mod URLs. |
| Flat ribbon geometry | Projected road segments and sprite scaling. |
| Lap time leaderboard focus | Career, upgrades, damage, and AI racing. |
| Small vehicle physics | Segment-based lane, grip, damage, and traffic model. |
| Toy-like snap track editor | Road segment editor with curves/elevation/weather. |

## Game Loop

Use a fixed simulation step.

```text
accumulator += frameDelta
while accumulator >= fixedDt:
  read input snapshot
  tickRace(state, input, fixedDt)
  accumulator -= fixedDt

render(interpolatedState)
```

Suggested:

| Setting | Value |
|---|---:|
| Fixed step | 1/60 sec |
| Max catch-up steps | 5 |
| Render | requestAnimationFrame |
| HUD updates | 10-20 Hz unless critical |
| Audio update | 20 Hz scheduler with lookahead |

## Entity Structure

Avoid a heavyweight ECS for MVP. Use typed modules.

```text
RaceState
  player: PlayerCarState
  opponents: AiCarState[]
  track: TrackRuntime
  weather: WeatherState
  pickups: PickupState[]
  hazards: HazardState[]
  raceClock: RaceClock
  standings: StandingsState
  rng: SeededRngState
```

## Track Data Model

Two forms:

| Form | Purpose |
|---|---|
| Authoring JSON | Human editable. |
| Runtime track | Precomputed segments, cumulative z, projection metadata, AI hints. |

Precompute:

- Segment start/end z
- Curve accumulation
- Elevation accumulation
- Road width per segment
- Hazard lookup
- Pickup lookup
- Scenery buckets
- Minimap polyline
- AI brake zones
- Validation hash

## Physics Update Model

Update order:

1. Resolve input.
2. Determine current track segment and surface.
3. Calculate weather and upgrade modifiers.
4. Update throttle/brake/gear/RPM.
5. Update speed.
6. Update steering/lateral movement.
7. Apply road curve force.
8. Update slip.
9. Resolve off-road state.
10. Update boost.
11. Update AI.
12. Resolve collisions.
13. Update pickups/hazards.
14. Update damage.
15. Update lap and race finish.
16. Update standings.

## Rendering Pipeline

MVP renderer: Canvas2D.

```text
clear
draw sky
draw far background
draw mid background
for visible segments far-to-near:
  project segment
  draw grass/shoulder/road/rumble/lane bands
  collect sprites
sort sprites by depth
draw sprites
draw player car
draw weather overlay
draw HUD canvas or React overlay
```

Optional:

- Use OffscreenCanvas if supported.
- Use WebGL or Three.js only if Canvas2D cannot meet performance.
- Keep renderer interface abstract.

## Asset Pipeline

Recommended folders:

```text
/public/content/tracks
/public/content/regions
/public/content/cars
/public/content/upgrades
/public/content/ai
/public/assets/sprites
/public/assets/backgrounds
/public/assets/audio/music
/public/assets/audio/sfx
/src/game
/src/game/physics
/src/game/render
/src/game/audio
/src/game/content
/src/game/ui
/src/game/save
/src/game/testing
```

## Save System

MVP local save:

```text
localStorage key: vibegear2.save.v1
backup key: vibegear2.save.v1.backup
settings key: vibegear2.settings.v1
controls key: vibegear2.controls.v1
```

Save must include version, career progression, credits, garage upgrades, car shell and cosmetics, best times, medals, settings, unlocked content, mod permissions, and timestamp.

## Modding Support

Mod content should be loaded from built-in content, local import files, URL-encoded track files if size permits, or a future curated catalog.

Validation stages:

| Stage | Checks |
|---|---|
| Schema | JSON shape and types. |
| License | Metadata present. |
| Safety | Names and text moderation. |
| Playability | Track length, hazards, road width, finishability. |
| Performance | Sprite counts, segment counts. |
| Integrity | Hash generated. |

## Performance Constraints

| Constraint | Target |
|---|---|
| Per-frame allocations | Avoid in hot loops. |
| Visible AI | Cap by distance. |
| Sprite draw count | Budget by quality setting. |
| Track segments | Precompute projection source data. |
| Audio nodes | Pool one-shots when possible. |
| React updates | Avoid per-frame React state for simulation. |
| Save writes | Debounce except after purchases/results. |

## Testing Approach

| Test Type | Example |
|---|---|
| Unit | Acceleration formula reaches expected speed. |
| Unit | Wet tires improve rain grip. |
| Unit | Damage reduces top speed after threshold. |
| Unit | Track schema rejects missing license. |
| Unit | AI does not exceed max rubber-band cap. |
| Simulation | Player baseline can complete tutorial track. |
| Snapshot | Track hash stable for same content. |
| E2E | Start race, finish, earn credits, buy upgrade. |
| E2E | Import mod track, validate, quick race. |
| Performance | 20 AI cars at 60 FPS on reference machine. |
