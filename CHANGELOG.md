# Changelog

All notable changes to VibeGear2 are tracked here. The canonical slice-by-slice
audit trail remains `docs/PROGRESS_LOG.md`.

## 0.2.0 - 2026-04-30

Content-complete World Tour release candidate.

### Highlights

- Expanded the bundled World Tour catalogue from the original release build to
  all 32 planned v1.0 tracks across eight regions.
- Added Ember Steppe, Breakwater Isles, Glass Ridge, Neon Meridian, Moss
  Frontier, and Crown Circuit track sets after the `v0.1.0` tag.
- Enforced strict championship track resolution now that every planned World
  Tour track id resolves in the browser-safe catalogue.
- Added per-car FX atlas routing for all six playable cars.
- Added Time Trial downloaded ghost selection, Daily Challenge share text, and
  pause-menu Settings and Ghosts actions.
- Kept production verification green on main after every merged content slice.

## 0.1.0 - 2026-04-30

Initial playable web release candidate.

### Highlights

- Playable pseudo-3D race loop with keyboard, gamepad, touch, pause, finish,
  results, and garage flows.
- World Tour progression, MVP track set, quick race, practice, time trial,
  daily challenge seed selection, and local save persistence.
- Arcade driving model with damage, nitro, manual transmission, drafting,
  weather grip, hazards, elevation, roadside art, car sprite overlays, and HUD
  indicators.
- Garage economy with cars, upgrades, repairs, starter recovery, race payouts,
  and catch-up mechanisms.
- Weather, audio, visual polish, region placeholder art, mod loading, track
  editor gate, and release quality gates.
- CI, Vercel deploy verification, browser compatibility smoke, bundle budget,
  Lighthouse, axe, content lint, docs parity, art, and audio checks.

### Shipped Slices

- 2026-04-26: Slice: Bootstrap implementation plan and working agreement
- 2026-04-26: Slice: Scaffold Next.js + TypeScript app shell
- 2026-04-26: Slice: Data schemas as Zod validators and TS types (§22)
- 2026-04-26: Slice: Versioned localStorage save/load (§21 Save system)
- 2026-04-26: Slice: Fixed-step simulation loop (§21 Game loop)
- 2026-04-26: Slice: Pseudo-3D road renderer (Canvas2D, single straight track)
- 2026-04-26: Slice: Car set + stats (§11) and garage car selector
- 2026-04-26: Slice: Keyboard + gamepad input layer (§19)
- 2026-04-26: Slice: Arcade physics step for player car (§10)
- 2026-04-26: Slice: Minimal HUD for speed, lap, and position (§20)
- 2026-04-26: Slice: Pause overlay + global error boundary (§20, §21)
- 2026-04-26: Slice: Touch / mobile input source (§19, closes F-013)
- 2026-04-26: Slice: Asset preload + loading screen (§21)
- 2026-04-26: Slice: Single AI driver, clean_line archetype (§15)
- 2026-04-26: Slice: Track compiler + golden-master tests (§9, §22)
- 2026-04-26: Slice: Recover Playwright e2e harness + title-screen smoke
- 2026-04-26: Slice: Phase 1 vertical slice integration (drivable /race)
- 2026-04-26: Slice: Title-screen menu wiring (Start Race, Garage, Options pending)
- 2026-04-26: Slice: Sprite atlas loader + frame index math
- 2026-04-26: Slice: Parallax bands renderer (sky / mountains / hills)
- 2026-04-26: Slice: VFX flash + shake module with reduced-motion gate
- 2026-04-26: Slice: Off-road dust particles + physics surface flag
- 2026-04-26: Slice: Render perf bench script (npm run bench:render)
- 2026-04-26: Slice: GitHub Actions CI + Vercel auto-deploy (F-003) recovery
- 2026-04-26: Slice: ASSETS-LICENSE + per-entry asset licence metadata (Q-002)
- 2026-04-26: Slice: minimap projection + HUD overlay drawer (split from hud-ui)
- 2026-04-26: Slice: options screen route /options (settings UI scaffold)
- 2026-04-26: Slice: difficulty preset selection in /options Difficulty pane
- 2026-04-26: Slice: sector splits + ghost delta HUD widget
- 2026-04-26: Slice: championship content registry (world-tour-standard)
- 2026-04-26: Slice: AI driver content registry (20 profiles)
- 2026-04-26: Slice: drafting / slipstream per §10
- 2026-04-26: Slice: damage model per §13
- 2026-04-26: Slice: damage band performance scaling per §10 §13
- 2026-04-26: Slice: manual transmission and gear shifting per §10 §19
- 2026-04-26: Slice: nitro / boost system per §10 §12 §19
- 2026-04-26: Slice: deferred Playwright e2e specs (F-016, F-017, F-018)
- 2026-04-26: Slice: drafting / slipstream race-session wiring
- 2026-04-26: Slice: manual transmission race-session wiring
- 2026-04-26: Slice: LEGAL_SAFETY.md authoring per GDD §26
- 2026-04-26: Slice: pure raceRules.ts module (countdown labels, DNF timers, ranking, final-state builder)
- 2026-04-26: Slice: race checkpoint pass tracking (RaceState fields, runtime detector, anti-shortcut guard)
- 2026-04-26: Slice: seeded deterministic PRNG module (rng.ts, mulberry32, splitRng) + Math.random ban
- 2026-04-26: Slice: ghost replay recorder + player module (ghost.ts, delta-encoded inputs, version stamps)
- 2026-04-26: Slice: accessibility assists pure module + /options Accessibility pane
- 2026-04-26: Slice: content budget cap + enforcement test (32 tracks / 6 cars)
- 2026-04-26: Slice: F-026 wire applyAssists into the race-session input pipeline
- 2026-04-26: Slice: F-027 HUD accessibility-assist badge renderer
- 2026-04-26: Slice: §7 race rules hard time limit wired into raceSession
- 2026-04-26: Slice: §20 HUD lap-timer + best-lap widget
- 2026-04-26: Slice: §21 leaderboard pure primitives (sign + noop store)
- 2026-04-26: Slice: §21 build version stamping (git SHA + version + sourcemaps)
- 2026-04-26: Slice: §12 economy + upgrade catalogue (awardCredits, purchaseUpgrade, tourBonus, 32-entry catalogue)
- 2026-04-26: Slice: §12 catch-up mechanisms (stipend, repair cap, easy-mode bonus, weather preview)
- 2026-04-26: Slice: §20 race results screen (buildRaceResult, /race/results page, components)
- 2026-04-26: Slice: §20 pause-menu actions (restart, retire, exit-to-title)
- 2026-04-26: Slice: §5 race reward bonuses (raceBonuses.ts owner module + sponsors)
- 2026-04-26: Slice: F-038 wire natural race-finish into `/race/results`
- 2026-04-26: Slice: F-029 multi-lap race-finish e2e
- 2026-04-26: Slice: SaveGameSettings v2 schema expansion
- 2026-04-26: Slice: profile export / import (JSON download + upload)
- 2026-04-26: Slice: §28 difficulty preset tuning scalars (pure binding)
- 2026-04-26: Slice: F-042 wire §28 difficulty preset scalars into physics, damage, nitro, raceSession
- 2026-04-26: Slice: §23 balancing pass (pin tables + `balancing.test.ts`)
- 2026-04-26: Slice: F-045 wire `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` into `applyHit`
- 2026-04-26: Slice: F-044 wire §23 CPU difficulty modifiers (`CPU_DIFFICULTY_MODIFIERS`)
- 2026-04-26: Slice: F-046 wire `BASE_REWARDS_BY_TRACK_DIFFICULTY` into the race-finish builder
- 2026-04-26: Slice: F-043 pin §23 weather modifiers into `src/game/weather.ts`
- 2026-04-26: Slice: cross-tab save consistency (writeCounter, storage subscribe, focus revalidate)
- 2026-04-26: Slice: F-032 wire leaderboard client into race results surface
- 2026-04-26: Slice: F-020 content-lint script enforces LEGAL_SAFETY denylist
- 2026-04-26: Slice: Q-010 pin §23 `tourTierScale` table
- 2026-04-26: Slice: F-031 scrub workspace paths from Next.js source maps
- 2026-04-26: Slice: F-015 pin race-session integration tests for off-road persistent damage
- 2026-04-26: Slice: F-022 ghost car overlay (drawer side) in `pseudoRoadCanvas.ts`
- 2026-04-26: Slice: F-004 Playwright save/load round-trip via the garage cars UI
- 2026-04-26: Slice: Q-009 confirm last-write-wins cross-tab save protocol
- 2026-04-26: Slice: pure championship.ts module (enterTour, recordResult, tourComplete, unlockNextTour)
- 2026-04-26: Slice: Q-007 confirm practice-mode weather preview surface
- 2026-04-26: Slice: Q-004 confirm tour stipend threshold and amount
- 2026-04-26: Slice: Q-005 confirm essential-repair cap fraction
- 2026-04-26: Slice: Q-006 confirm easy-mode tour-clear bonus rate
- 2026-04-26: Slice: F-023 Time Trial recorder lifecycle producer
- 2026-04-26: Slice: Review fixes for save and lap timing
- 2026-04-26: Slice: PR #5 review comment fixes
- 2026-04-26: Slice: Docs accuracy audit after PR #5 fixes
- 2026-04-26: Slice: Main CI mobile browser fix
- 2026-04-26: Slice: F-037 easy-mode tour-clear bonus wiring
- 2026-04-26: Slice: Licence files finalisation
- 2026-04-26: Slice: F-022 Time Trial ghost consumer
- 2026-04-26: Slice: Race start player car overlay
- 2026-04-26: Slice: Vercel local link ignores
- 2026-04-26: Slice: F-050 live elevation proof
- 2026-04-26: Slice: F-053 GDD coverage ledger
- 2026-04-26: Slice: F-002/F-003 foundation followup closure
- 2026-04-27: Slice: F-049 options reset persistence
- 2026-04-27: Slice: F-014 key remapping UI and persistence
- 2026-04-27: Slice: F-052 parallax horizon and roadside sprites
- 2026-04-27: Slice: F-054 hill-bottom projection continuity
- 2026-04-27: Slice: F-055 distance-phase road markings
- 2026-04-27: Slice: CONTRIBUTING.md guide
- 2026-04-27: Slice: F-056 uphill lane-marking duty cycle
- 2026-04-27: Slice: F-057 turn foreground projection continuity
- 2026-04-27: Slice: F-051 car atlas sprite overlays
- 2026-04-27: Slice: F-059 turn crest road warp
- 2026-04-27: Slice: F-060 car turn direction
- 2026-04-27: Slice: F-058 weather car trails
- 2026-04-27: Slice: F-048 AI difficulty scalars
- 2026-04-27: Slice: Garage summary surface
- 2026-04-27: Slice: Garage summary review fixes
- 2026-04-28: Slice: F-063 starter eligibility
- 2026-04-28: Slice: F-062 garage upgrade purchase surface
- 2026-04-28: Slice: F-061 garage repair purchase surface
- 2026-04-28: Slice: F-064 race damage garage persistence
- 2026-04-28: Slice: Garage results handoff
- 2026-04-28: Slice: World tour entry hub
- 2026-04-28: Slice: F-065 active tour progression
- 2026-04-28: Slice: Full World Tour flow coverage
- 2026-04-28: Slice: CONTRIBUTING.md guidance
- 2026-04-28: Slice: Mobile race playability
- 2026-04-28: Slice: MVP track set
- 2026-04-28: Slice: AI grid spawner
- 2026-04-28: Slice: Hazards runtime
- 2026-04-28: Slice: F-024 RNG consumers
- 2026-04-28: Slice: Weather grip runtime
- 2026-04-28: Slice: Weather AI allocation hotfix
- 2026-04-28: Slice: Pre-race tire selection
- 2026-04-28: Slice: Weather render effects
- 2026-04-28: Slice: Weather accessibility settings
- 2026-04-28: Slice: Overcast weather option
- 2026-04-28: Slice: High-contrast roadside signs
- 2026-04-28: Slice: Weather state transitions
- 2026-04-28: Slice: Tunnel light adaptation
- 2026-04-28: Slice: Heat shimmer renderer
- 2026-04-28: Slice: Rain road sheen renderer
- 2026-04-28: Slice: Snow roadside whitening renderer
- 2026-04-28: Slice: Weather visibility AI risk
- 2026-04-28: Slice: HUD damage and weather grip indicators
- 2026-04-28: Slice: HUD gear and nitro meter
- 2026-04-28: Slice: HUD cash delta
- 2026-04-28: Slice: reduce tour-flow e2e runtime
- 2026-04-28: Slice: Daily Challenge seed selection
- 2026-04-28: Slice: Mobile touch controls
- 2026-04-28: Slice: Time Trial PB records
- 2026-04-28: Slice: Audio engine and mixer primitives
- 2026-04-28: Slice: Audio context lifecycle primitives
- 2026-04-28: Slice: Audio options pane
- 2026-04-28: Slice: Procedural engine runtime
- 2026-04-28: Slice: Procedural countdown SFX runtime
- 2026-04-28: Slice: Procedural impact SFX runtime
- 2026-04-28: Slice: Procedural nitro engage SFX runtime
- 2026-04-28: Slice: Grass restart physics fix
- 2026-04-28: Slice: Garage next race layout fix
- 2026-04-28: Slice: Garage next race review cleanup
- 2026-04-28: Slice: Disable game UI text selection
- 2026-04-28: Slice: Mobile title screen centering
- 2026-04-28: Slice: Depth-aware weather particles
- 2026-04-29: Slice: Placeholder region art and manifest check
- 2026-04-29: Slice: Placeholder car sprite sheet bank
- 2026-04-29: Slice: Placeholder roadside prop bank
- 2026-04-29: Slice: Placeholder menu backgrounds
- 2026-04-29: Slice: Placeholder audio bank
- 2026-04-29: Slice: Sound and music runtime
- 2026-04-29: Slice: Race milestone SFX events
- 2026-04-29: Slice: Surface SFX cues
- 2026-04-29: Slice: Weather music stems
- 2026-04-29: Slice: Music intensity stem assets
- 2026-04-29: Slice: Music intensity stem runtime
- 2026-04-29: Slice: Visual polish coverage closeout
- 2026-04-29: Slice: Display options pane
- 2026-04-29: Slice: Quick Race mode
- 2026-04-29: Slice: Practice mode
- 2026-04-29: Slice: Tunnel segments
- 2026-04-29: Slice: Dev track editor
- 2026-04-29: Slice: Vercel Git deploy check hotfix
- 2026-04-29: Slice: Data mod loader
- 2026-04-29: Slice: Starter mod sample pack
- 2026-04-29: Slice: Car FX sprite compositor
- 2026-04-29: Slice: GitHub issue labels and starter tasks
- 2026-04-29: Slice: Leaderboard storage provider gate
- 2026-04-29: Slice: Contributor dev experience docs
- 2026-04-29: Slice: Contributor dev experience review follow-up
- 2026-04-29: Slice: Performance settings
- 2026-04-29: Slice: Cross-browser verification
- 2026-04-29: Slice: Browser compatibility matrix
- 2026-04-30: Slice: CI quality gates
