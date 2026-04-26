# 21. Technical design for web implementation

## Recommended architecture

VibeRacer’s architecture is already cleanly separated enough to suggest the right migration path:

- Game.tsx owns session flow, pause, countdown, HUD state, and server submissions.
- RaceCanvas.tsx owns rendering, the rAF loop, audio driving, and per-frame HUD updates.
- tick.ts owns deterministic state progression and lap completion logic.
- physics.ts owns arcade driving parameters.
- track.ts, trackPath.ts, and editor.ts own track data and validation.
- API routes persist tracks and lap submissions using Upstash-backed keys, signed race tokens, and simple anti-cheat checks. [23]

Recommended VibeGear2 layers

| Layer | Responsibility |
| --- | --- |
| App shell | Next.js routes, menus, save/profile pages, garage pages |
| Runtime core | Fixed-step simulation, AI, race rules, economy |
| Renderer | Pseudo-3D road, sprites, weather, HUD |
| Audio | Procedural or stem-based music and SFX |
| Data | JSON for tracks, cars, tours, upgrades, AI |
| Persistence | Local saves, optional leaderboard/ghost backend |
| Mod layer | Content packs, validation, manifest loading |

## How this should build on VibeRacer

Reuse as-is or nearly as-is

- Next.js app routing
- localStorage-backed control settings patterns
- tuning persistence patterns
- signed lap submission concept
- leaderboard back end concept
- procedural audio scaffolding
- testing stack
- results / HUD / pause ownership boundaries

Replace or heavily refactor

- current piece-grid track model
- flat 3D mesh scene builder
- current top-down-like driving assumptions
- current editor UX

## Game loop

Use a fixed-step sim inside a render loop:

```
renderLoop (rAF):
  accumulate dt
  while accumulator >= fixedStep:
    simulateRace(1/60)
  renderFrame(interpolatedState)
```

## Suggested module structure

```
src/game/
  raceState.ts
  raceRules.ts
  physics.ts
  ai.ts
  economy.ts
  damage.ts
  weather.ts
  ghost.ts

src/road/
  trackFormat.ts
  trackCompiler.ts
  segmentProjector.ts
  roadside.ts
  minimap.ts

src/render/
  pseudoRoadCanvas.ts
  spriteAtlas.ts
  uiRenderer.ts
  vfx.ts
```

## Track data model

Use authored segments instead of piece loops:

- segment length
- curve amount
- grade amount
- lane count
- deco set
- hazard set
- weather support
- checkpoints
- minimap points

## Physics update model

- Fixed 60 Hz simulation
- Deterministic inputs
- Track-relative collision samples
- Lane-relative AI
- Damage and weather modifiers applied inside sim step

## Rendering pipeline

Recommended pipeline:

- Determine visible segment window.
- Project far-to-near road strips.
- Draw sky and parallax backgrounds.
- Draw roadside sprites back-to-front.
- Draw opponent cars by projected depth.
- Draw player car overlay.
- Draw HUD.
- Apply optional screen-space flashes and shake.

## Asset pipeline

- Source art in layered PSD/Krita or vector where appropriate
- Sprite export scripts
- JSON atlas generation
- Build-time checksum versioning
- Content folder separate from code for easier mods

## Audio pipeline

- Support both procedural and sample-stem modes
- Music stems authored per region
- SFX bank grouped by system
- Metadata-driven mixing levels

## Save system

The current repo already stores controls and tuning in local storage and uses backend persistence for tracks and leaderboards. VibeGear2 should extend that pattern into a versioned local save with optional cloud sync later. [24]

## Modding support

- Mods live in /mods/<mod-id>/
- Each mod includes manifest, track JSON, optional car JSON, optional art/audio references
- Safe mode validates licenses, naming, and schema compliance
- Official builds can ignore untrusted executable code and load data assets only

## Performance constraints

- Cap draw distance adaptively
- Allow sprite-density reduction
- Use offscreen buffers only where helpful
- Keep AI update lightweight by using progress-space logic
- Avoid layout thrash by rendering HUD mostly in canvas or memoized overlays

## Testing approach

- Unit tests for physics, AI decisions, damage, economy
- Golden-master tests for track compilation
- Deterministic replay tests for ghosts
- Playwright flows for title → race → results → garage → next race
- Performance bench on representative desktop hardware

## Deploy target

Production deploys go to **Vercel Hobby** (free tier, region `iad1`). The deploy
is gated by GitHub Actions: every push to `main` runs the full `verify` job
(lint, type-check, Vitest, Playwright e2e against a production build) and only
on green does the `deploy` job run `vercel build --prod` + `vercel deploy
--prebuilt --prod`. The Vercel GitHub App handles PR preview URLs; production
deploys are CLI-driven from `.github/workflows/ci.yml` so they share the same
job log as CI. The `verify` and `deploy` jobs sit in separate concurrency
groups so a rapid second push to `main` cannot cancel an in-flight production
deploy. The render perf bench (`npm run bench:render`) is wired as an opt-in
`workflow_dispatch` job with `continue-on-error: true` so it never gates a
merge or deploy. Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`. See `.github/workflows/ci.yml` and `vercel.json`.
