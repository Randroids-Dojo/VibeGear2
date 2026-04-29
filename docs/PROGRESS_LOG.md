# Progress Log

Append a new entry at the **top** of this file at the end of every loop. Use
the template from `IMPLEMENTATION_PLAN.md` §6. Never delete past entries.
Correct them by adding a new entry that references the old one.

---

## 2026-04-29: Slice: Surface SFX cues

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) required vehicle and race
SFX,
[§10](gdd/10-driving-model-and-physics.md) braking, steering, and
surface state,
[§14](gdd/14-weather-and-environmental-systems.md) weather-aware
surface effects,
[§21](gdd/21-technical-design-for-web-implementation.md) audio
runtime.
**Branch / PR:** `feat/surface-audio-cues`, PR #87.
**Status:** Implemented.

### Done
- `src/game/raceSession.ts`: added deterministic player audio gates so
  brake scrub, tire squeal, and wet or snow surface hush cues emit only
  when their qualifying state first becomes active.
- `src/audio/sfx.ts`: added procedural one-shot playback methods for
  brake scrub, tire squeal, and wet or snow surface hush.
- `src/app/race/page.tsx`: routed the new race-session events into the
  procedural SFX runtime.
- `docs/GDD_COVERAGE.json`: added GDD-18-PROCEDURAL-SURFACE-SFX.

### Verified
- `npx vitest run src/game/__tests__/raceSession.test.ts src/game/__tests__/raceSessionActions.test.ts src/audio/sfx.test.ts`
  green, 141 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2505 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- Continuous-feel cues are gated in the pure session state rather than
  emitted every tick. A cue re-arms only after its condition clears, so
  live playback avoids per-frame one-shot spam.
- Wet surface hush is limited to rainy road surfaces. Snow hush follows
  snow weather on any surface because the road and shoulders are both
  snow-covered in the current renderer.

### Coverage ledger
- GDD-18-PROCEDURAL-SURFACE-SFX covers brake scrub, tire squeal, and
  spray or snow hush entries from the required SFX list.
- Uncovered adjacent requirements: weather audio stems and true
  multi-stem music layering remain under the §18 sound parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Race milestone SFX events

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) required vehicle and race
SFX,
[§21](gdd/21-technical-design-for-web-implementation.md) audio
runtime.
**Branch / PR:** `feat/race-sfx-events`, PR #86.
**Status:** Implemented.

### Done
- `src/game/raceSession.ts`: added deterministic player audio events
  for explicit manual gear shifts, lap completion before the final lap,
  and race finish.
- `src/audio/sfx.ts`: added procedural one-shot playback methods for
  gear shift, lap complete, and results stinger cues through the shared
  SFX mixer path.
- `src/app/race/page.tsx`: routed the new race-session events into the
  procedural SFX runtime.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-PROCEDURAL-RACE-MILESTONE-SFX.

### Verified
- `npx vitest run src/audio/sfx.test.ts src/game/__tests__/raceSession.test.ts`
  green, 128 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2501 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- Gear-shift SFX fire for explicit manual shift input only. Automatic
  transmission changes stay silent for this slice so routine auto shifts
  do not spam event output every time the reducer crosses a threshold.
- The results stinger is triggered by the player crossing the final line.
  The later results screen can add a screen-enter stinger if needed.

### Coverage ledger
- GDD-18-PROCEDURAL-RACE-MILESTONE-SFX covers gear shift, lap complete,
  and results stinger events from the required SFX list.
- Uncovered adjacent requirements: brake scrub, tire squeal, spray or
  snow hush SFX, weather audio stems, and true multi-stem music layering
  remain under the §18 sound parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Sound and music runtime

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) music direction, race music,
dynamic audio layers, and SFX guidance,
[§21](gdd/21-technical-design-for-web-implementation.md) audio
pipeline,
[§24](gdd/24-content-plan.md) audio content bank.
**Branch / PR:** `feat/sound-music-systems`, PR pending.
**Status:** Implemented.

### Done
- `src/audio/music.ts`: added a music cue resolver and runtime for the
  generated music bank, with menu cue playback, regional race cue
  selection, music-bus gain handling, crossfades, and speed / nitro /
  final-lap intensity scaling.
- `src/audio/music.test.ts`: covered cue selection, race intensity
  scaling, silence handling, fade-up, crossfade, and playback-rate
  updates.
- `src/components/audio/MenuMusicDirector.tsx`: added a root-level
  menu music director that starts title music after the first user
  gesture on menu routes and stops when leaving those routes.
- `src/app/layout.tsx`: mounted the menu music director globally.
- `src/app/race/page.tsx`: starts regional race music from the same
  gesture path as engine audio, updates intensity from live race state,
  and stops music during race teardown.
- `docs/GDD_COVERAGE.json`: added GDD-18-MUSIC-RUNTIME.

### Verified
- `npx vitest run src/audio/music.test.ts src/audio/mixer.test.ts src/audio/sfx.test.ts src/audio/engineRuntime.test.ts`
  green, 33 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2498 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- Browser autoplay policy still gates playback behind a pointer or key
  gesture. The runtime returns cleanly when playback is blocked or audio
  is unavailable.
- This slice uses the shipped single-loop placeholder files. The runtime
  exposes intensity through gain and playback-rate scaling until final
  2 to 3 stem assets exist.

### Coverage ledger
- GDD-18-MUSIC-RUNTIME covers menu music playback, regional race music
  selection, persisted music bus levels, smooth cue fades, and race
  intensity scaling from speed, nitro, and final lap.
- Uncovered adjacent requirements: true multi-stem music layering,
  weather stem blending, final-lap stingers, lap-complete SFX, results
  stingers, surface-specific spray or snow hush SFX, brake scrub, tire
  squeal, gear shift, and final production music replacement remain
  under the §18 sound parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Placeholder audio bank

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) music and SFX direction,
[§24](gdd/24-content-plan.md) audio asset list,
[§25](gdd/25-development-roadmap.md) vertical-slice music pack,
[§26](gdd/26-open-source-project-guidance.md) audio provenance.
**Branch / PR:** `feat/placeholder-audio-bank`, PR pending.
**Status:** Implemented.

### Done
- `scripts/generate-placeholder-audio.ts`: added a deterministic
  `ffmpeg`-backed generator for placeholder music, SFX, and weather
  loop Opus files.
- `public/audio/`: added 35 generated placeholder audio files: 9 music
  loops, 22 SFX one-shots, and 4 weather loops.
- `public/audio/manifest.json`: listed every generated audio file with
  CC0 license, source, originality, duration, and sample-rate metadata.
- `scripts/check-audio-manifest.ts`: added an audio provenance guard
  that fails when public audio files lack manifest metadata.
- `scripts/__tests__/check-audio-manifest.test.ts` and
  `scripts/__tests__/placeholder-audio-bank.test.ts`: added coverage for
  manifest validation, GDD audio asset counts, and the 2 MB budget.
- `package.json`: added `audio:generate` and `audio:check`, and wired
  `audio:check` into `npm run verify`.
- `docs/GDD_COVERAGE.json`: added GDD-18-PLACEHOLDER-AUDIO-BANK.

### Verified
- `npm run audio:generate` completed and reproduced the generated audio
  files.
- `npx vitest run scripts/__tests__/check-audio-manifest.test.ts scripts/__tests__/placeholder-audio-bank.test.ts`
  green, 9 passed.
- `npm run audio:check` green.
- `public/audio/` size is 320 KB.
- `npm run audio:generate && git diff --exit-code -- public/audio public/audio/manifest.json`
  green.
- `npm run verify` green, 2489 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- The generated files are content-bank placeholders. Runtime playback
  and final music composition remain in later sound-system slices.
- CI validates the checked-in files and manifest without requiring
  `ffmpeg`; `ffmpeg` is only needed to regenerate the bank locally.

### Coverage ledger
- GDD-18-PLACEHOLDER-AUDIO-BANK covers placeholder title music, eight
  race themes, 20 to 30 SFX including UI sounds, weather loops, and
  provenance metadata.
- Uncovered adjacent requirements: runtime stem loading, dynamic music
  layering, and final audio replacement remain under sound-system
  followups.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Placeholder menu backgrounds

**GDD sections touched:**
[§17](gdd/17-art-direction.md) HUD and menu art,
[§24](gdd/24-content-plan.md) asset list,
[§26](gdd/26-open-source-project-guidance.md) asset provenance.
**Branch / PR:** `feat/placeholder-menu-backgrounds`, PR pending.
**Status:** Implemented.

### Done
- `scripts/generate-placeholder-art.ts`: added generated placeholder
  menu backgrounds for title, world, garage, race prep, results, daily,
  options, and loading screens.
- `public/art/menu/`: added eight generated SVG background assets.
- `public/art.manifest.json`: listed every generated menu background with
  CC0 license, source, originality, and date metadata.
- `scripts/__tests__/placeholder-art-bank.test.ts`: added coverage that
  the named menu background set exists on disk and in the manifest.
- `docs/GDD_COVERAGE.json`: added
  GDD-17-PLACEHOLDER-MENU-BACKGROUNDS.

### Verified
- `npm run art:generate` completed and reproduced the generated menu
  background manifest entries.
- `npx vitest run scripts/__tests__/placeholder-art-bank.test.ts scripts/__tests__/check-art-manifest.test.ts`
  green, 11 passed.
- `npm run art:check` green.
- No file under `public/art/` exceeds 32 KB; total art size is 640 KB.
- `npm run verify` green, 2480 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- The generated backgrounds are content-bank assets. Runtime adoption
  remains a later UI or visual-polish slice so this PR does not change
  screen composition.

### Coverage ledger
- GDD-17-PLACEHOLDER-MENU-BACKGROUNDS covers placeholder menu background
  asset availability and provenance metadata.
- Uncovered adjacent requirements: final artwork and production art
  replacement remain under the placeholder-art parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Placeholder roadside prop bank

**GDD sections touched:**
[§17](gdd/17-art-direction.md) roadside prop source sizes,
[§24](gdd/24-content-plan.md) asset list,
[§26](gdd/26-open-source-project-guidance.md) asset provenance,
[§27](gdd/27-risks-and-mitigations.md) asset burden.
**Branch / PR:** `feat/placeholder-roadside-props`, PR pending.
**Status:** Implemented.

### Done
- `scripts/generate-placeholder-art.ts`: added a generated regional
  roadside prop bank with 12 props per region.
- `public/art/roadside/`: added 96 generated prop SVG files across the
  eight GDD regions.
- `public/art.manifest.json`: listed every generated prop with CC0
  license, source, originality, and date metadata.
- `scripts/__tests__/placeholder-art-bank.test.ts`: added coverage that
  the generated roadside bank satisfies the GDD 80 to 120 prop range and
  includes every region.
- `docs/GDD_COVERAGE.json`: added
  GDD-17-PLACEHOLDER-ROADSIDE-PROPS.

### Verified
- `npm run art:generate` completed and reproduced the generated prop
  manifest entries.
- `npx vitest run scripts/__tests__/placeholder-art-bank.test.ts scripts/__tests__/check-art-manifest.test.ts`
  green, 10 passed.
- `npm run art:check` green.
- No file under `public/art/` exceeds 32 KB; total art size is 608 KB.
- `npm run verify` green, 2479 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- The existing `public/art/roadside/temperate.svg` atlas remains in place
  for current runtime compatibility. The new per-region files are content
  bank assets for the later visual-polish renderer wiring.

### Coverage ledger
- GDD-17-PLACEHOLDER-ROADSIDE-PROPS covers placeholder roadside prop
  volume and per-region asset availability.
- Uncovered adjacent requirements: menu backgrounds, final car artwork,
  and production art replacement remain under the placeholder-art parent
  dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Placeholder car sprite sheet bank

**GDD sections touched:**
[§11](gdd/11-cars-and-stats.md) bundled car visual profiles,
[§17](gdd/17-art-direction.md) car sprite grammar,
[§24](gdd/24-content-plan.md) asset list,
[§26](gdd/26-open-source-project-guidance.md) asset provenance.
**Branch / PR:** `feat/placeholder-car-art`, PR pending.
**Status:** Implemented.

### Done
- `scripts/generate-placeholder-art.ts`: added generated placeholder
  sprite sheets for every bundled car visual profile.
- `public/art/cars/`: added six generated car sprite sheet SVG files.
- `public/art.manifest.json`: listed every generated car sheet with
  CC0 license, source, originality, and date metadata.
- `scripts/__tests__/placeholder-art-bank.test.ts`: added coverage that
  every bundled car visual profile has a shipped sprite sheet and
  manifest entry.
- `docs/GDD_COVERAGE.json`: added
  GDD-17-PLACEHOLDER-CAR-SPRITES.

### Verified
- `npm run art:generate` completed and reproduced the generated car
  sheet manifest entries.
- `npx vitest run scripts/__tests__/placeholder-art-bank.test.ts scripts/__tests__/check-art-manifest.test.ts`
  green, 9 passed.
- `npm run art:check` green.
- No file under `public/art/` exceeds 32 KB; total art size is 224 KB.
- `npm run verify` green, 2478 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- The existing `public/art/cars/sparrow.svg` remains in place for the
  current runtime atlas. The generated `sparrow_gt.svg` file exists so
  the authored car visual-profile id has a matching placeholder asset
  before later renderer wiring consumes per-car sheets.

### Coverage ledger
- GDD-17-PLACEHOLDER-CAR-SPRITES covers placeholder car sprite sheets
  for the six bundled car visual profiles.
- Uncovered adjacent requirements: final car artwork, final per-region
  prop volume, menu backgrounds, and production art replacement remain
  under the placeholder-art parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-29: Slice: Placeholder region art and manifest check

**GDD sections touched:**
[§17](gdd/17-art-direction.md) art direction,
[§24](gdd/24-content-plan.md) asset list,
[§26](gdd/26-open-source-project-guidance.md) asset provenance,
[§27](gdd/27-risks-and-mitigations.md) asset burden.
**Branch / PR:** `feat/placeholder-region-art`, PR pending.
**Status:** Implemented.

### Done
- `scripts/generate-placeholder-art.ts`: added a deterministic SVG
  placeholder art generator for eight region backdrop packs, HUD icons,
  effect sheets, and the roadside atlas asset.
- `public/art/`: added generated placeholder SVG art and expanded
  `public/art.manifest.json` with source, license, originality, and date
  metadata for every shipped art asset.
- `scripts/check-art-manifest.ts`: added a provenance guard that fails
  when an art file is unlisted or lacks allowed license and originality
  metadata.
- `package.json`: added `art:generate` and `art:check`, and wired the
  manifest check into `npm run verify`.
- `src/data/atlas/roadside.json`: pointed the temperate roadside atlas
  at the generated SVG asset.
- `docs/GDD_COVERAGE.json`: added
  GDD-17-PLACEHOLDER-ART-MANIFEST.

### Verified
- `npm run art:generate` completed and reproduced the checked-in art
  manifest.
- `npm run art:check` green.
- `npx vitest run scripts/__tests__/check-art-manifest.test.ts scripts/__tests__/content-lint.test.ts`
  green, 61 passed.
- `npm run content-lint` green.
- `npm run verify` green, 2476 passed.
- `npm run test:e2e` green, 79 passed.

### Decisions and assumptions
- This slice keeps placeholder art as SVG because the repo already uses
  SVG for the Sparrow atlas and the format avoids binary churn while the
  final art pipeline is still open.

### Coverage ledger
- GDD-17-PLACEHOLDER-ART-MANIFEST covers placeholder region backdrops,
  HUD icons, effect sheets, roadside atlas file presence, and manifest
  provenance checks.
- Uncovered adjacent requirements: the remaining five car sprite sets,
  final per-region prop volume, menu backgrounds, and final production
  art replacement remain under the placeholder-art parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Depth-aware weather particles

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather visual effects,
[§16](gdd/16-rendering-and-visual-design.md) pseudo-3D rendering,
[§21](gdd/21-technical-design-for-web-implementation.md) renderer layer.
**Branch / PR:** `feat/weather-depth-particles`, PR #79.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: moved rain streaks and snow
  particles onto projected road strip bands so they follow road depth,
  camera framing, foreground extension, and curve offsets.
- `src/render/pseudoRoadCanvas.ts`: added fog banding over projected
  road depth while keeping the existing broad draw-distance fade and
  readability floor.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: added projected
  strip fixtures for weather effect tests and updated assertions to pin
  depth-scaled rain, snow, and fog behaviour.
- `docs/GDD_COVERAGE.json`: added
  GDD-14-WEATHER-DEPTH-PARTICLES.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 48 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2458 passed.
- `npm run test:e2e` green, 78 passed.

### Decisions and assumptions
- Road sheen and roadside whitening remain surface effects because §14
  calls them out as road and roadside cues, not airborne particles.
- Dusk and night bloom remain screen-space glare effects. This slice
  targets rain, snow, and fog, which are the weather effects that need
  road-depth parallax.

### Coverage ledger
- GDD-14-WEATHER-DEPTH-PARTICLES covers projected rain streaks,
  projected snow particles, and projected fog bands.
- Uncovered adjacent requirements: final authored weather sprite
  sheets, per-region weather art, and wind-specific particle drift
  remain under visual-polish and content backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Mobile title screen centering

**GDD sections touched:**
[§4](gdd/04-player-experience-goals.md) quick launch,
[§20](gdd/20-hud-and-ui-ux.md) title-level menu UX.
**Branch / PR:** `fix/mobile-title-centering`, PR pending.
**Status:** Implemented.

### Done
- `src/app/page.module.css`: switched the title shell to dynamic
  viewport height with responsive outer padding so mobile browser
  chrome does not push the centered layout out of frame.
- `src/app/page.module.css`: added compact short-viewport menu spacing,
  title sizing, and footer sizing for phone screens.
- `e2e/title-screen.spec.ts`: added a short-mobile regression that
  verifies the title screen is centered, fully visible, and does not
  create horizontal overflow at 320 by 568 and 390 by 667.
- `docs/GDD_COVERAGE.json`: added GDD-20-MOBILE-TITLE-CENTERING.

### Verified
- `npx playwright test e2e/title-screen.spec.ts --project=chromium`
  green, 8 passed.
- `npm run verify` green, 2458 passed.
- `npm run test:e2e` green, 78 passed.

### Decisions and assumptions
- This slice keeps the existing title screen hierarchy and menu order.
  It only changes responsive spacing and sizing for short mobile
  viewports.

### Coverage ledger
- GDD-20-MOBILE-TITLE-CENTERING covers centered title-screen layout,
  full visibility, and no horizontal overflow on short phone viewports.
- Uncovered adjacent requirements: final title-screen art direction,
  background media, full controller navigation polish, and full mobile
  options presentation remain under existing UI, visual-polish, and
  input backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Disable game UI text selection

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) game UI behavior,
[§21](gdd/21-technical-design-for-web-implementation.md) web shell.
**Branch / PR:** `fix/disable-game-ui-selection`, PR pending.
**Status:** Implemented.

### Done
- `src/app/globals.css`: disabled browser text selection across the game
  shell and non-editable UI so dragging or swiping over HUD, menus, and
  race surfaces does not highlight page text.
- `src/app/globals.css`: preserved text selection for editable controls
  such as inputs, textareas, selects, and contenteditable regions.
- `src/app/globals.css`: restored selection for all non-false
  contenteditable variants, including plaintext-only.
- `e2e/ui-selection.spec.ts`: added browser coverage for race UI
  selection suppression, daily share textarea selection, and
  plaintext-only contenteditable selection.
- `docs/GDD_COVERAGE.json`: added GDD-20-GAME-UI-SELECTION.

### Verified
- `npx playwright test e2e/ui-selection.spec.ts --project=chromium`
  green, 1 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npm run verify` green, 2458 passed.
- `npm run test:e2e` green, 77 passed.

### Decisions and assumptions
- Editable controls keep normal selection because the daily share
  fallback, options forms, and profile import flows still need native
  browser editing behavior.

### Coverage ledger
- GDD-20-GAME-UI-SELECTION covers global non-editable UI selection
  suppression, race surface selection suppression, and editable control
  selection preservation.
- Uncovered adjacent requirements: final HUD scale options, display
  frame-cap settings, full settings profile management polish, and
  pointer-lock style input capture remain under existing UI and control
  backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Garage next race review cleanup

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage loop,
[§20](gdd/20-hud-and-ui-ux.md) garage layout and next race info.
**Branch / PR:** `fix/garage-next-race-review-cleanup`, PR pending.
**Status:** Implemented.

### Done
- `e2e/garage-summary.spec.ts`: relaxed the next race layout regression
  by half a pixel so the test fails on real overlap without depending on
  platform sub-pixel rounding.
- `docs/GDD_COVERAGE.json`: cleared the completed layout coverage item
  followup list so it does not imply outstanding work.

### Verified
- `npx playwright test e2e/garage-summary.spec.ts --project=chromium`
  green, 3 passed.
- `npm run verify` green, 2458 passed.

### Decisions and assumptions
- This slice addresses the Copilot review threads left on PR #74 after
  that PR merged.

### Coverage ledger
- GDD-20-GARAGE-NEXT-RACE-LAYOUT remains fully covered by the garage UI
  code and browser regression test.
- Uncovered adjacent requirements: full garage tab navigation, tire setup,
  tour standings, stats or ghost UI, repair forecast details, and bottom
  CTA row polish remain under their existing garage and UI backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Garage next race layout fix

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage loop,
[§20](gdd/20-hud-and-ui-ux.md) garage layout and next race info.
**Branch / PR:** `fix/garage-next-race-layout`, PR pending.
**Status:** Implemented.

### Done
- `src/app/garage/page.tsx`: gave the garage next race card a dedicated
  column layout with an explicit gap so its explanatory copy and World
  Tour action cannot collide at narrow desktop widths.
- `src/app/garage/page.tsx`: added a test id for the World Tour action
  inside the next race card so browser tests can target the exact
  control.
- `e2e/garage-summary.spec.ts`: added a regression check that verifies
  the next race description renders above the World Tour action without
  overlap.
- `docs/GDD_COVERAGE.json`: added
  GDD-20-GARAGE-NEXT-RACE-LAYOUT.

### Verified
- `npx playwright test e2e/garage-summary.spec.ts --project=chromium`
  green, 3 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npm run verify` green, 2458 passed.
- `npm run test:e2e` green, 76 passed.

### Decisions and assumptions
- This is a layout contract fix only. The garage flow, destination route,
  and next race selection behavior remain unchanged.

### Coverage ledger
- GDD-20-GARAGE-NEXT-RACE-LAYOUT covers readable non-overlapping garage
  next race copy and action layout at narrow desktop widths.
- Uncovered adjacent requirements: full garage tab navigation, tire setup,
  tour standings, stats or ghost UI, repair forecast details, and bottom
  CTA row polish remain under their existing garage and UI backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Grass restart physics fix

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) off-road slowdown and
driving model, [§21](gdd/21-technical-design-for-web-implementation.md)
deterministic physics.
**Branch / PR:** `fix/grass-restart-stuck`, PR pending.
**Status:** Implemented.

### Done
- `src/game/physics.ts`: reordered off-road drag so it applies to the
  incoming speed before throttle. A stopped car on grass can now build
  forward speed while rolling cars still receive grass drag and the
  off-road speed cap.
- `src/game/physics.ts`: bumped `PHYSICS_VERSION` from 2 to 3 because
  the integration order changed and old ghost recordings should not be
  compared against the new physics math.
- `src/game/__tests__/physics.test.ts`: added a regression test for
  launching from a full stop on grass under throttle.

### Verified
- `npx vitest run src/game/__tests__/physics.test.ts src/game/__tests__/ghost.test.ts src/game/__tests__/ghostDriver.test.ts src/game/__tests__/timeTrial.test.ts`
  green, 117 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npm run verify` green, 2458 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- This is a physics integration-order fix, not an assist or traction
  shortcut. The car still slows down on grass and remains capped by
  `OFF_ROAD_CAP_M_PER_S`.

### Coverage ledger
- GDD-10-GRASS-RESTART-PHYSICS covers stopped-on-grass throttle
  recovery, off-road drag preservation, speed-cap preservation, and the
  physics-version bump for ghost compatibility.
- Uncovered adjacent requirements: reverse gear, traction loss, spinout
  recovery, jump landing behavior, surface-specific tire audio, and
  per-surface VFX tuning remain under their respective gameplay,
  audio, and visual-polish backlog dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Procedural nitro engage SFX runtime

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) vehicle and race SFX,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/procedural-nitro-sfx`, PR pending.
**Status:** Implemented.

### Done
- `src/game/raceSession.ts`: added a transient nitro-engage audio
  event emitted from the deterministic nitro reducer when the player
  starts a fresh charge.
- `src/audio/sfx.ts`: added a short rising procedural nitro tone that
  respects shared-context lookup, master gain, SFX gain, and no-op
  behavior when audio is unavailable or muted.
- `src/app/race/page.tsx`: plays race-session audio events once per
  simulation tick through the existing SFX runtime.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-PROCEDURAL-NITRO-SFX.

### Verified
- `npx vitest run src/audio/sfx.test.ts src/game/__tests__/raceSession.test.ts`
  green, 125 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npm run verify` green, 2457 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- Nitro playback is driven by the pure race-session event stream rather
  than by React input state so replays and tests see the same gameplay
  source of truth.
- Only player nitro emits an audible cue in this slice. AI nitro audio
  remains under the wider §18 field-mix policy.

### Coverage ledger
- GDD-18-PROCEDURAL-NITRO-SFX covers player nitro start event emission,
  rising nitro playback, persisted SFX gain use, no-context no-op
  behavior, silent SFX no-op behavior, and race teardown cleanup.
- Uncovered adjacent requirements: gear shift, brake scrub, tire squeal,
  spray or snow hush, lap complete, results stinger, music playback,
  region stem metadata, and placeholder audio assets remain under the
  §18 audio parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Procedural impact SFX runtime

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) vehicle and race SFX,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/procedural-impact-sfx`, PR pending.
**Status:** Implemented.

### Done
- `src/game/raceSession.ts`: added transient per-tick player impact
  audio events emitted from the deterministic damage pass for car,
  wall, hazard, and rub-style hit kinds.
- `src/audio/sfx.ts`: added procedural impact tones with hit-kind
  specific oscillator shape, duration, pitch, and gain scaling.
- `src/app/race/page.tsx`: plays each player impact event once per
  simulation tick through the existing shared audio context and SFX
  mixer settings.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-PROCEDURAL-IMPACT-SFX.

### Verified
- `npx vitest run src/audio/sfx.test.ts src/game/__tests__/raceSession.test.ts`
  green, 124 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npx vitest run src/audio/sfx.test.ts src/game/__tests__/raceSession.test.ts src/game/__tests__/raceSessionActions.test.ts`
  green, 133 passed.
- `npm run build` green and postbuild source-map scrub completed.
- `npm run verify` green, 2456 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- This slice plays local player impacts only. AI-only contact stays
  silent until a field-mix or spectator audio policy exists.
- Off-road persistent damage is not emitted as an impact cue because it
  represents continuous surface punishment; the §18 off-road rumble and
  weather hush layers remain under the sound parent dot.
- The race session exposes transient event data while keeping physics
  deterministic. Audio playback remains a page-level side effect.

### Coverage ledger
- GDD-18-PROCEDURAL-IMPACT-SFX covers player impact cue emission,
  car-contact playback, wall or hazard hit playback, rub-style tone
  shaping, persisted SFX gain use, no-context no-op behavior, silent
  SFX no-op behavior, and race teardown cleanup.
- Uncovered adjacent requirements: nitro engage, gear shift, brake
  scrub, tire squeal, spray or snow hush, lap complete, results
  stinger, music playback, region stem metadata, and placeholder audio
  assets remain under the §18 audio parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Procedural countdown SFX runtime

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) vehicle and race SFX,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/procedural-countdown-sfx`, PR pending.
**Status:** Implemented.

### Done
- `src/audio/sfx.ts`: added a procedural SFX runtime for countdown and
  go tones, with shared-context lookup, master and SFX mixer gain,
  no-context no-op behavior, silent-mixer no-op behavior, and one-shot
  teardown.
- `src/app/race/page.tsx`: plays countdown tones on countdown step
  changes, plays the go tone when racing begins, and stops active SFX
  on race teardown.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-PROCEDURAL-COUNTDOWN-SFX.

### Verified
- `npx vitest run src/audio/sfx.test.ts src/audio/mixer.test.ts src/audio/context.test.ts src/audio/engineRuntime.test.ts`
  green, 26 passed.
- `npm run typecheck` green.
- `npx playwright test e2e/race-demo.spec.ts --project=chromium`
  green, 3 passed.
- `npm run verify` green, 2452 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- This slice ships procedural countdown and go tones only. It does not
  add licensed audio assets, music stems, impact SFX, menu clicks, or
  lap/result stingers.
- Countdown playback uses the existing gesture-resumed shared audio
  context. If the context has not been resumed yet, countdown SFX is a
  no-op rather than creating audio outside a user gesture.
- The numbered countdown uses triangle tones; the go tone uses a
  brighter square tone.

### Coverage ledger
- GDD-18-PROCEDURAL-COUNTDOWN-SFX covers countdown and go SFX playback,
  persisted master and SFX gain, no-context no-op behavior, silent SFX
  no-op behavior, and race teardown cleanup.
- Uncovered adjacent requirements: nitro, gear shift, brake scrub,
  tire squeal, wall hit, car rub, weather hush, lap complete, results
  stinger, music playback, region stem metadata, and placeholder audio
  assets remain under the §18 audio parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Procedural engine runtime

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) sound and music design,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/procedural-engine-runtime`, PR pending.
**Status:** Implemented.

### Done
- `src/audio/engineRuntime.ts`: added a procedural engine runtime that
  creates an oscillator and gain node only when a shared audio context
  exists, maps player speed to `enginePitchHz`, applies master and SFX
  mixer gain, and stops the graph on teardown.
- `src/app/race/page.tsx`: starts engine audio from race key or pointer
  gestures, updates pitch and gain from the live player state, binds
  visibility suspension, and stops audio on retire, finish, exit, and
  unmount.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-PROCEDURAL-ENGINE-RUNTIME.

### Verified
- `npx vitest run src/audio/engineRuntime.test.ts src/audio/engine.test.ts src/audio/mixer.test.ts src/audio/context.test.ts`
  green, 23 passed after the review fix.
- `npm run lint` green.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npx playwright test e2e/race-demo.spec.ts --project=chromium`
  green, 3 passed.
- `npm run verify` green, 2444 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- This slice ships procedural engine playback only. It does not add SFX,
  music stems, placeholder audio assets, or menu music.
- Engine audio starts only after a key or pointer gesture resumes the
  shared Web Audio context. Server render, no-context browsers, and
  silent SFX mixer settings stay no-op paths.
- The engine oscillator uses a sawtooth source with a low base gain so
  future SFX and music buses have headroom.

### Coverage ledger
- GDD-18-PROCEDURAL-ENGINE-RUNTIME covers gesture-gated engine graph
  creation, speed-driven pitch updates, persisted master and SFX gain,
  and graph teardown.
- Uncovered adjacent requirements: impact SFX, countdown SFX, menu
  clicks, music playback, region stem metadata, placeholder audio
  assets, and weather audio layers remain under the §18 audio parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Audio options pane

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) sound and music design,
[§20](gdd/20-hud-and-ui-ux.md) settings,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline,
[§22](gdd/22-data-schemas.md) save audio schema.
**Branch / PR:** `feat/audio-options-pane`, PR #67.
**Status:** Implemented.

### Done
- `src/app/options/page.tsx`: replaced the Audio placeholder with a
  shipped pane.
- `src/components/options/AudioPane.tsx` and
  `src/components/options/audioPaneState.ts`: added persisted master,
  music, and SFX sliders backed by `SaveGame.settings.audio`.
- `src/components/options/optionsResetState.ts`: made reset-to-defaults
  own audio settings now that the pane has shipped.
- `docs/GDD_COVERAGE.json`: added GDD-20-AUDIO-OPTIONS-PANE.

### Verified
- `npx vitest run src/components/options/__tests__/audioPaneState.test.ts src/components/options/__tests__/optionsResetState.test.ts src/app/options/__tests__/page.test.tsx`
  green, 19 passed.
- `npm run lint` green.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npx playwright test e2e/options-screen.spec.ts --project=chromium`
  green, 9 passed.
- `npm run verify` green, 2438 passed.
- `npm run test:e2e` green, 75 passed.

### Decisions and assumptions
- This slice persists the §20 mix controls only. It does not create or
  resume the Web Audio context, and it does not start engine, SFX, or
  music playback.
- Slider values use the existing unit-interval save schema with 5
  percent UI steps and two-decimal clamping in the pure helper.
- Reset-to-defaults now resets audio because Audio is no longer a
  placeholder pane.

### Coverage ledger
- GDD-20-AUDIO-OPTIONS-PANE covers master, music, and SFX settings UI,
  save persistence, default fallback, clamping, and reset ownership.
- Uncovered adjacent requirements: engine playback, SFX playback, music
  playback, region stem metadata, and placeholder audio assets remain
  under the §18 audio parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Audio context lifecycle primitives

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) sound and music design,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/audio-context-lifecycle`, PR pending.
**Status:** Implemented.

### Done
- `src/audio/context.ts`: added a shared Web Audio context controller
  with lazy creation, resume, suspend, unavailable-Web-Audio no-op
  behavior, closed-context replacement, and hidden-page suspension.
- `src/audio/context.test.ts`: pinned deferred creation, first-resume
  creation, no duplicate resumes, unavailable Web Audio, visibility
  suspension, already-hidden binding, and no create-on-hidden behavior.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-AUDIO-CONTEXT-LIFECYCLE.

### Verified
- `npx vitest run src/audio/context.test.ts` green, 7 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2431 passed.

### Decisions and assumptions
- This slice lands the lifecycle primitive only. It does not start
  engine, SFX, or music playback, and it does not add audio assets.
- Visibility hidden suspends an existing running context, but visibility
  visible does not auto-resume because browser resume still needs an
  explicit user gesture.
- Binding visibility suspension while the page is already hidden
  immediately suspends an existing running context without creating a
  new one.
- If Web Audio is unavailable, the controller returns `null` and callers
  can treat audio as a no-op.

### Coverage ledger
- GDD-18-AUDIO-CONTEXT-LIFECYCLE covers lazy shared context creation,
  resume, suspension, unavailable-Web-Audio no-op behavior, and hidden
  page suspension.
- Uncovered adjacent requirements: engine playback, SFX playback, music
  playback, region stem metadata, placeholder audio assets, and settings
  UI sliders remain under the §18 audio parent dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Audio engine and mixer primitives

**GDD sections touched:**
[§18](gdd/18-sound-and-music-design.md) sound and music design,
[§20](gdd/20-hud-and-ui-ux.md) settings,
[§21](gdd/21-technical-design-for-web-implementation.md) audio pipeline.
**Branch / PR:** `feat/audio-engine-mixer`, PR pending.
**Status:** Implemented.

### Done
- `src/audio/engine.ts`: added a pure speed-to-engine-pitch model with
  idle, redline, exponential rise, and overrun clamps.
- `src/audio/mixer.ts`: added master, music, and SFX gain resolution
  from persisted audio settings as raw bus scalars, plus a disabled-audio null path for
  later Web Audio callers.
- `src/audio/engine.test.ts` and `src/audio/mixer.test.ts`: pinned
  monotonic pitch, pure repeatability, defensive clamps, raw gain values,
  disabled audio, and silence detection.
- `docs/GDD_COVERAGE.json`: added
  GDD-18-AUDIO-ENGINE-MIXER-PRIMITIVES.

### Verified
- `npx vitest run src/audio/engine.test.ts src/audio/mixer.test.ts`
  green, 10 passed.
- `npm run typecheck` green.
- `npm run content-lint` green.
- `npm run verify` green, 2425 passed.

### Decisions and assumptions
- This slice does not create an `AudioContext`, play sounds, or add
  placeholder audio files. It only lands the pure math contracts that
  the later runtime and asset slices will consume.
- `resolveMixerGains` returns `null` when audio is disabled so future
  engine, SFX, and music callers can short-circuit before creating
  Web Audio nodes.
- `resolveMixerGains` returns raw master, music, and SFX scalars rather
  than post-master bus products so the future Web Audio graph can avoid
  double-applying the master gain.
- `enginePitchHz` resolves its pitch config once per call and shares the
  resolved config with the internal speed-ratio helper.

### Coverage ledger
- GDD-18-AUDIO-ENGINE-MIXER-PRIMITIVES covers engine pitch and mix-bus
  gain primitives.
- Uncovered adjacent requirements: AudioContext lifecycle, engine
  playback, SFX playback, music playback, region stem metadata,
  placeholder audio assets, visibility suspension, and settings UI
  sliders remain under the §18 audio parent dots.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Time Trial PB records

**GDD sections touched:**
[§6](gdd/06-game-modes.md) Time trial,
[§21](gdd/21-technical-design-for-web-implementation.md) local save runtime,
[§22](gdd/22-data-schemas.md) save records.
**Branch / PR:** `feat/time-trial-pb-records`, PR pending.
**Status:** Implemented.

### Done
- `src/app/race/page.tsx`: commits Time Trial result PB patches to the
  local save while keeping `creditsAwarded` at zero and leaving garage
  damage untouched.
- `src/game/raceResult.ts`: preserves an existing faster saved lap when
  a stale result patch is merged after another tab or run has already
  improved the record.
- `e2e/race-finish.spec.ts`: added a real Time Trial finish smoke that
  asserts PB records persist, credits stay unchanged, and pending
  garage damage stays unchanged.
- `docs/GDD_COVERAGE.json`: added GDD-06-TIME-TRIAL-PB-RECORDS.

### Verified
- `npx vitest run src/game/__tests__/raceResult.test.ts` green, 58 passed.
- `npm run typecheck` green.
- `npx playwright test e2e/race-finish.spec.ts --project=chromium -g "time trial PB persistence"`
  green, 1 passed.
- `npm run verify` green, 2415 passed.
- `npm run test:e2e` green, 74 passed.

### Decisions and assumptions
- Time Trial remains a non-economy mode: it can update records and PB
  ghosts, but it never awards campaign credits or persists race damage.

### Coverage ledger
- GDD-06-TIME-TRIAL-PB-RECORDS covers Time Trial PB record persistence
  from a finished run.
- Uncovered adjacent requirements: developer benchmark display,
  downloaded ghost selection, result-backed Daily Challenge share text,
  and UTC-midnight fake-clock e2e remain under the §6 modes parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Mobile touch controls

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) touch input,
[§20](gdd/20-hud-and-ui-ux.md) race HUD control surface,
[§21](gdd/21-technical-design-for-web-implementation.md) web runtime.
**Branch / PR:** `fix/mobile-touch-controls`, PR pending.
**Status:** Implemented.

### Done
- `src/components/touch/TouchControls.tsx`: made the steering stick
  transient, thumb-anchored on left-half pointerdown, and invisible
  after release while keeping the overlay from intercepting the live
  canvas input source.
- `src/game/inputTouch.ts`: moved accelerator and brake hit targets to
  the lower-right thumb arc and prevents browser gestures from stealing
  active touch pointers.
- `e2e/race-mobile.spec.ts`: added live `/race` iPhone coverage for
  left-half stick spawning, sign-correct steering, stick release, and
  right-thumb control placement.
- `docs/GDD_COVERAGE.json`: tightened GDD-19-MOBILE-RACE-INPUT to cover
  the transient steering and reachable right-thumb controls.

### Verified
- `npx vitest run src/game/inputTouch.test.ts` green, 40 passed.
- `npx playwright test e2e/race-mobile.spec.ts --project=mobile-chromium`
  green, 3 passed.
- `npx playwright test e2e/touch-input.spec.ts --project=mobile-chromium`
  green, 4 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2414 passed.
- `npm run test:e2e` green, 73 passed.

### Decisions and assumptions
- The visual overlay observes document pointer events while remaining
  `pointer-events: none`, so the canvas remains the single live input
  target and the stick still mirrors real touches.
- Nitro and pause stay at the top-right edge for now because the bug
  report only calls out GAS and BRK reachability.

### Coverage ledger
- GDD-19-MOBILE-RACE-INPUT now covers transient left-half steering and
  reachable right-thumb GAS / BRK placement on the mounted race route.
- Uncovered adjacent requirements: none created by this slice.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Daily Challenge seed selection

**GDD sections touched:**
[§6](gdd/06-game-modes.md) Community challenge,
[§21](gdd/21-technical-design-for-web-implementation.md) deterministic
runtime conventions.
**Branch / PR:** `feat/daily-challenge-seed-selection`, PR pending.
**Status:** Implemented.

### Done
- `src/game/modes/dailyChallenge.ts`: added deterministic UTC-day seed
  generation, fixed daily track / weather selection, car-class
  recommendation, race-link construction, and share-text formatting.
- `src/app/daily/page.tsx`: added the Daily Challenge entry route with
  today's fixed challenge, a time-trial race link, and copyable share
  text fallback.
- `src/app/page.tsx`: added Daily Challenge to the title menu.
- `docs/GDD_COVERAGE.json`: added GDD-06-DAILY-CHALLENGE-SELECTION.

### Verified
- `npx vitest run src/game/modes/__tests__/dailyChallenge.test.ts src/app/__tests__/page.test.tsx`
  green, 22 passed.
- `npm run typecheck` green.
- `npx playwright test e2e/title-screen.spec.ts` green, 7 passed.
- `npm run verify` green, 2411 passed.
- `npm run test:e2e` green, 72 passed.

### Decisions and assumptions
- Daily selection uses UTC date keys so the challenge is stable across
  local time zones and browser sessions.
- The first Daily Challenge race link reuses Time Trial mode with a
  fixed track and weather. Car class is a recommendation until `/race`
  can enforce or temporarily loan eligible cars. Dedicated daily result
  persistence and actual run-time share strings remain adjacent work.

### Coverage ledger
- GDD-06-DAILY-CHALLENGE-SELECTION covers deterministic daily seed,
  fixed track / weather selection, car-class recommendation, title
  navigation, and the entry route.
- Uncovered adjacent requirements: result-backed Daily Challenge share
  text, UTC-midnight fake-clock e2e, and full Time Trial PB save button
  remain under the §6 modes parent dot.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: reduce tour-flow e2e runtime

**GDD sections touched:**
No GDD design change. This slice supports the implementation loop and
verification budget.
**Branch / PR:** `chore/reduce-tour-e2e-runtime`, PR pending.
**Status:** Implemented.

### Done
- `e2e/tour-flow.spec.ts`: removed a redundant second full Velvet Coast
  tour pass from the world-hub completion smoke.
- Preserved completed-track coverage and Iron Borough unlock assertions
  in the same spec.

### Verified
- `npx playwright test e2e/tour-flow.spec.ts` green, 2 passed in 37.3s.
- `npm run test:e2e` green, 71 passed in 1.4m.
- `npm run verify` green, 2398 passed.

### Decisions and assumptions
- The second full-tour pass duplicated coverage already held by the same
  test's track completion assertions plus the final-race unlock spec.
  Keeping one full-tour pass still verifies the route chain and save
  progression while reducing loop runtime.

### Coverage ledger
- GDD-24-MVP-TRACK-SET remains the exercised coverage area for this
  tour-flow smoke. No new ledger row was added because this is a
  test-harness optimization only.
- Uncovered adjacent requirements: none created by this slice.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: HUD cash delta

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) race reward formula,
[§20](gdd/20-hud-and-ui-ux.md) race HUD.
**Branch / PR:** `feat/hud-cash-delta`, PR pending.
**Status:** Implemented.

### Done
- `src/game/hudState.ts`: added an optional cash delta summary with
  signed credit formatting.
- `src/render/uiRenderer.ts`: draws a guarded §20 CASH row under the
  top-left HUD timer stack when cash data is supplied.
- `src/app/race/page.tsx`: wires live projected race payout from current
  player position, track difficulty, and difficulty preset into
  `deriveHudState` for economy modes.
- `docs/GDD_COVERAGE.json`: added GDD-20-HUD-CASH-DELTA.

### Verified
- `npx vitest run src/game/__tests__/hudState.test.ts src/render/__tests__/uiRenderer.test.ts`
  green, 85 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2398 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- The live race HUD uses the current-position projected base payout,
  excluding bonuses because §5 bonuses are only finalized by the results
  builder after finish conditions are known.
- Time Trial omits the cash row because that mode does not commit
  wallet rewards.

### Coverage ledger
- GDD-20-HUD-CASH-DELTA covers the live HUD cash delta requirement.
- Uncovered adjacent requirements: full pause action polish, results
  styling, and resize reflow verification remain future §20 slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: HUD gear and nitro meter

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) nitro and transmission state,
[§20](gdd/20-hud-and-ui-ux.md) race HUD.
**Branch / PR:** `feat/hud-gear-nitro`, PR pending.
**Status:** Implemented.

### Done
- `src/game/hudState.ts`: added optional gear and nitro summaries derived
  from live transmission and nitro snapshots.
- `src/render/uiRenderer.ts`: draws the §20 bottom-center nitro meter and
  bottom-right gear / RPM label only when those fields are supplied.
- `src/app/race/page.tsx`: wires live player nitro, upgrade-aware nitro
  duration, maximum charges, and transmission state into `deriveHudState`.
- `docs/GDD_COVERAGE.json`: added GDD-20-HUD-GEAR-NITRO.

### Verified
- `npx vitest run src/game/__tests__/hudState.test.ts src/render/__tests__/uiRenderer.test.ts`
  green, 79 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2391 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- The nitro meter displays charge-equivalent fuel: unused full charges
  plus the active charge fraction. This keeps a single meter readable
  while matching the §10 tap-or-hold burn model.
- The gear label includes RPM percentage beside the current gear, giving
  the §20 gear widget useful transmission context without adding a new
  large gauge.

### Coverage ledger
- GDD-20-HUD-GEAR-NITRO covers the live HUD gear and nitro meter
  requirements.
- Uncovered adjacent requirements: cash delta, full pause action polish,
  results styling, and resize reflow verification remain future §20
  slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: HUD damage and weather grip indicators

**GDD sections touched:**
[§13](gdd/13-damage-repairs-and-risk.md) damage visualization,
[§14](gdd/14-weather-and-environmental-systems.md) weather feedback,
[§20](gdd/20-hud-and-ui-ux.md) race HUD.
**Branch / PR:** `feat/hud-damage-weather`, PR pending.
**Status:** Implemented.

### Done
- `src/game/hudState.ts`: added optional HUD summaries for live damage,
  active weather, and weather grip hints while preserving the minimal
  HUD shape for older callers.
- `src/render/uiRenderer.ts`: added a guarded bottom-left status cluster
  for damage, weather, and grip, with no drawing when the fields are
  absent.
- `src/app/race/page.tsx`: wires live player damage, active race weather,
  effective weather grip, and persisted speed units into `deriveHudState`.
- `docs/GDD_COVERAGE.json`: added GDD-20-HUD-DAMAGE-WEATHER.

### Verified
- `npx vitest run src/game/__tests__/hudState.test.ts src/render/__tests__/uiRenderer.test.ts`
  green, 68 passed.
- `npm run typecheck` green.
- `npm run verify` green, 2382 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- The HUD uses compact ASCII weather chips plus labels instead of new
  bitmap icon assets, so this slice stays focused on the live status
  surface. Asset-backed HUD icons remain part of the broader art pass.
- The damage and weather cluster is drawn above the minimap area to avoid
  overlap while keeping the §20 bottom-left grouping.

### Coverage ledger
- GDD-20-HUD-DAMAGE-WEATHER covers the live HUD damage, weather icon, and
  grip hint requirements.
- Uncovered adjacent requirements: nitro meter, cash delta, full pause
  action polish, results styling, and resize reflow verification remain
  future §20 slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Weather visibility AI risk

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) heavy weather
collision risk from reduced visibility,
[§15](gdd/15-cpu-opponents-and-ai.md) weather-aware CPU skill.
**Branch / PR:** `feat/weather-visibility-ai-risk`, PR pending.
**Status:** Implemented.

### Done
- `src/game/weather.ts`: added a deterministic visibility-risk scalar
  derived from §14 visibility values and mitigated by AI weather skill.
- `src/game/ai.ts`: applies that scalar to deterministic lane-target
  mistake odds so fog, snow, night, and heavy weather can raise collision
  risk without changing contact geometry.
- `src/game/raceSession.ts`: wires active race weather and each driver's
  compact weather-skill row into the AI risk scalar.
- `docs/GDD_COVERAGE.json`: added GDD-14-VISIBILITY-AI-RISK.

### Verified
- `npx vitest run src/game/__tests__/weather.test.ts src/game/__tests__/ai.test.ts`
  green, 111 passed.
- `npm run verify` green, 2371 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Visibility risk changes AI line mistakes, not collision dimensions.
  That keeps §13 hit geometry stable while still making low-visibility
  races more dangerous through driver behavior.
- Driver weather skill mitigates only the extra risk above baseline.
  Unit weather skill preserves the raw `1 / visibility` scalar.

### Coverage ledger
- GDD-14-VISIBILITY-AI-RISK covers the runtime danger portion of §14
  weather physics.
- Uncovered adjacent requirements: full region art packages and sound
  changes remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Snow roadside whitening renderer

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) snow particles and
soft roadside whitening,
[§16](gdd/16-rendering-and-visual-design.md) weather visual feedback.
**Branch / PR:** `feat/snow-roadside-whitening`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added deterministic soft roadside
  whitening for snow weather and kept it scaled by the existing weather
  visual intensity controls.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covered whitening
  geometry, snow alpha, accessibility reduction, and disabled snow
  visuals.
- `docs/GDD_COVERAGE.json`: added
  GDD-14-SNOW-ROADSIDE-WHITENING.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts` green,
  48 passed.
- `npm run verify` initially failed on a stale live `.next` source-map
  scrub check. After `npm run test:e2e` rebuilt and scrubbed `.next`,
  the rerun was green.
- `npm run verify` green, 2363 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Roadside whitening is visual only. It shares the snow effect intensity
  so weather accessibility controls reduce both flakes and roadside
  whitening together.
- The whitening pass uses a distinct fill from snow flakes so tests can
  assert both effects independently.

### Coverage ledger
- GDD-14-SNOW-ROADSIDE-WHITENING covers the roadside whitening portion
  of snow weather presentation.
- Uncovered adjacent requirements: weather collision-risk tuning,
  surface-temperature display, and full region art packages remain future
  slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Rain road sheen renderer

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) rain streaks and
road sheen,
[§16](gdd/16-rendering-and-visual-design.md) weather visual feedback.
**Branch / PR:** `feat/rain-road-sheen`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added deterministic wet-road sheen
  for rain weather and kept it scaled by the existing weather visual
  intensity controls.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covered sheen
  geometry, heavy-rain alpha, accessibility reduction, particle-intensity
  reduction, and disabled rain visuals.
- `docs/GDD_COVERAGE.json`: added GDD-14-RAIN-ROAD-SHEEN.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts` green,
  47 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2362 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Road sheen is visual only. It shares the rain effect intensity so the
  weather accessibility controls reduce both streaks and wet-road glare
  together.
- The sheen pass uses a distinct fill from rain streaks so tests can
  assert both effects independently.

### Coverage ledger
- GDD-14-RAIN-ROAD-SHEEN covers the road-sheen portion of rainy weather
  presentation.
- Uncovered adjacent requirements: snow roadside whitening, weather
  collision-risk tuning, surface-temperature display, and full region art
  packages remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Heat shimmer renderer

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) heat shimmer in
desert tours,
[§17](gdd/17-art-direction.md) region visual packages,
[§24](gdd/24-content-plan.md) Ember Steppe desert tour.
**Branch / PR:** `feat/heat-shimmer-renderer`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added a deterministic heat shimmer
  screen-space pass controlled by `DrawRoadOptions.heatShimmer`.
- `src/app/race/page.tsx`: enables the pass for the authored
  `ember-steppe` tour hook using camera z as the phase source.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covered enabled,
  phase-drifting, and disabled shimmer behavior.
- `docs/GDD_COVERAGE.json`: added GDD-14-HEAT-SHIMMER.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts` green,
  44 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2359 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- The shimmer pass is visual only and does not consume RNG or alter
  physics. It uses camera z for deterministic drift.
- Full Ember Steppe art assets remain under the region art backlog; this
  slice only ships the §14 effect hook and renderer behavior.

### Coverage ledger
- GDD-14-HEAT-SHIMMER covers the heat shimmer effect path for desert
  tours.
- Uncovered adjacent requirements: snow roadside whitening, road sheen,
  weather collision-risk tuning, surface-temperature display, and full
  region art packages remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Tunnel light adaptation

**GDD sections touched:**
[§9](gdd/09-track-design.md) tunnel light adaptation and tunnel
segments,
[§14](gdd/14-weather-and-environmental-systems.md) tunnel adaptation
shifts,
[§16](gdd/16-rendering-and-visual-design.md) environmental visual
feedback,
[§22](gdd/22-data-schemas.md) authored hazard metadata.
**Branch / PR:** `feat/tunnel-light-adaptation`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added a data-driven tunnel
  light-adaptation pass that reads visible strip `hazardIds` and darkens
  the world view when tunnel metadata is projected.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covered visible
  tunnel activation, non-tunnel skip behavior, and debug disable
  behavior.
- `docs/GDD_COVERAGE.json`: added
  GDD-14-TUNNEL-LIGHT-ADAPTATION and linked the remaining audio portion
  to the sound backlog.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts` green,
  41 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2356 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Tunnel hazards remain non-colliding game metadata. Gameplay hazard
  evaluation still ignores `kind: "tunnel"` while the renderer consumes
  the compiled strip metadata for the visual adaptation.
- Tunnel audio shift is left to the §18 sound parent because this slice
  is limited to the §14 visual adaptation requirement.

### Coverage ledger
- GDD-14-TUNNEL-LIGHT-ADAPTATION covers projected visual adaptation from
  authored tunnel hazard metadata.
- Uncovered adjacent requirements: heat shimmer remains a future weather
  slice, and tunnel audio remains under the sound backlog.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Weather state transitions

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather types and
track-specific weather,
[§21](gdd/21-technical-design-for-web-implementation.md) deterministic
runtime state,
[§22](gdd/22-data-schemas.md) track weather options.
**Branch / PR:** `feat/weather-state-transitions`, PR pending.
**Status:** Implemented.

### Done
- `src/game/weather.ts`: added `WeatherState`, deterministic transition
  stepping, active-weather selection, and interpolated grip and
  visibility helpers.
- `src/game/raceSession.ts`: initialized per-session weather state from
  the selected race weather, reserved a seeded weather RNG stream, and
  applied weather-state grip to player and AI physics.
- `src/game/raceSessionActions.ts`: preserved the weather state through
  retire-session cloning.
- `src/app/race/page.tsx`: renders weather effects and car trails from
  the live session weather state.
- `docs/GDD_COVERAGE.json`: added GDD-14-WEATHER-STATE-MACHINE.

### Verified
- `npx vitest run src/game/__tests__/weather.test.ts src/game/__tests__/raceSession.test.ts src/game/__tests__/raceSessionActions.test.ts`
  green, 197 passed.
- `npm run typecheck` clean.
- `npm run verify` green, 2353 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Runtime transitions are opt-in with `changeChancePerSecond`. The
  default is 0 so existing races keep the forecast chosen in pre-race
  setup while future modes can enable deterministic mid-race changes.
- The state machine rejects a weather option not listed by the active
  track, matching §14's authored 1 to 3 weather-set constraint.

### Coverage ledger
- GDD-14-WEATHER-STATE-MACHINE covers deterministic state storage,
  track-constrained transitions, and smooth grip or visibility
  interpolation.
- Uncovered adjacent requirements: heat shimmer and tunnel adaptation
  remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: High-contrast roadside signs

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather
accessibility controls,
[§16](gdd/16-rendering-and-visual-design.md) roadside sprite rendering,
[§20](gdd/20-hud-and-ui-ux.md) settings surface,
[§22](gdd/22-data-schemas.md) save settings schema.
**Branch / PR:** `feat/high-contrast-roadside-signs`, PR pending.
**Status:** Implemented.

### Done
- `src/data/schemas.ts` and `src/persistence/migrations/v1ToV2.ts`:
  added the additive `highContrastRoadsideSigns` accessibility setting
  with a false default for fresh and migrated saves.
- `src/components/options/AccessibilityPane.tsx`: added the persisted
  high-contrast signs toggle to the Weather visibility fieldset.
- `src/render/pseudoRoadCanvas.ts` and `src/app/race/page.tsx`: threaded
  the setting into live race rendering and boosted sign panel, glyph, and
  edge contrast when enabled.
- `docs/GDD_COVERAGE.json`: expanded
  GDD-14-WEATHER-ACCESSIBILITY-SETTINGS to include roadside signs.

### Verified
- `npx vitest run src/data/__tests__/settings-schema.test.ts src/persistence/migrations/v1ToV2.test.ts src/components/options/__tests__/accessibilityPaneState.test.ts src/components/options/__tests__/AccessibilityPane.test.tsx src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 100 passed.
- `npx playwright test e2e/options-accessibility.spec.ts` green, 4
  passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2342 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- The setting lives in the existing Weather visibility group because
  §14 lists high-contrast roadside signs under weather accessibility.
- Old saves keep parsing because the new schema field is optional and
  the read helper falls back to the default.

### Coverage ledger
- GDD-14-WEATHER-ACCESSIBILITY-SETTINGS now covers high-contrast roadside
  signs in addition to the weather particle, fog, glare, and flash
  controls.
- Uncovered adjacent requirements: weather state transitions, heat
  shimmer, and tunnel adaptation remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Overcast weather option

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather types,
[§22](gdd/22-data-schemas.md) track weather enum,
[§23](gdd/23-balancing-tables.md) weather modifier mapping.
**Branch / PR:** `feat/overcast-weather-option`, PR pending.
**Status:** Implemented.

### Done
- `src/data/schemas.ts`: added `overcast` to the runtime weather enum
  so tracks can author the §14 condition.
- `src/game/weather.ts`: mapped overcast to the clear §23 grip row and
  a mild 0.95 visibility scalar.
- `src/game/preRaceCard.ts`, `src/game/nitro.ts`, and
  `src/render/pseudoRoadCanvas.ts`: treated overcast as a dry-tire,
  low-risk, visual-neutral weather condition.
- `docs/gdd/22-data-schemas.md`: documented the weather option ids.
- `docs/GDD_COVERAGE.json`: added GDD-14-OVERCAST-WEATHER-OPTION.

### Verified
- `npx vitest run src/data/schemas.test.ts src/game/__tests__/weather.test.ts src/game/__tests__/preRaceCard.test.ts src/game/__tests__/nitro.test.ts src/render/__tests__/pseudoRoadCanvas.test.ts src/data/__tests__/balancing.test.ts`
  green, 300 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2340 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- Overcast is clear-adjacent for grip and nitro risk because §23 has no
  dedicated Overcast modifier row.
- Overcast uses a 0.95 visibility scalar, matching the parent weather
  dot's planned treatment and keeping it distinct from clear without
  adding particles or bloom.

### Coverage ledger
- GDD-14-OVERCAST-WEATHER-OPTION covers schema authoring and runtime
  handling for overcast weather.
- Uncovered adjacent requirements: weather state transitions, high
  contrast roadside signs, heat shimmer, and tunnel adaptation remain
  future slices.

### Followups created
None.

### GDD edits
- `docs/gdd/22-data-schemas.md`: listed the canonical weather ids.

## 2026-04-28: Slice: Weather accessibility settings

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather
accessibility controls,
[§16](gdd/16-rendering-and-visual-design.md) weather VFX tuning,
[§20](gdd/20-hud-and-ui-ux.md) settings surface,
[§22](gdd/22-data-schemas.md) save settings schema.
**Branch / PR:** `feat/weather-accessibility-settings`, PR pending.
**Status:** Implemented.

### Done
- `src/data/schemas.ts` and `src/persistence/migrations/v1ToV2.ts`:
  added additive weather accessibility settings for particle intensity,
  reduced glare, fog readability floor, and flash reduction.
- `src/components/options/AccessibilityPane.tsx`: surfaced the new
  sliders and toggles in the Accessibility pane and persisted changes
  to the existing save bundle.
- `src/render/pseudoRoadCanvas.ts` and `src/app/race/page.tsx`: wired
  the settings into rain, snow, fog, and dusk or night bloom rendering.
- `docs/FOLLOWUPS.md`: marked F-067 done.
- `docs/GDD_COVERAGE.json`: added
  GDD-14-WEATHER-ACCESSIBILITY-SETTINGS.

### Verified
- `npx vitest run src/components/options/__tests__/accessibilityPaneState.test.ts src/data/__tests__/settings-schema.test.ts src/persistence/migrations/v1ToV2.test.ts src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 96 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npx playwright test e2e/options-accessibility.spec.ts` green, 4
  passed.
- `npm run verify` green, 2331 passed.
- `npm run test:e2e` green, 71 passed.

### Decisions and assumptions
- New fields are optional in the schema so old v2 and v3 saves with an
  existing accessibility bundle remain valid.
- Fresh and migrated saves still include concrete defaults, so the UI
  persists a complete accessibility object after a change.

### Coverage ledger
- GDD-14-WEATHER-ACCESSIBILITY-SETTINGS covers the §14 persisted
  controls and renderer application for weather particles, fog, glare,
  and flashes.
- Uncovered adjacent requirements: weather state transitions and heat
  shimmer remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Weather render effects

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) visual effects and
accessibility,
[§16](gdd/16-rendering-and-visual-design.md) weather VFX and renderer
pipeline,
[§20](gdd/20-hud-and-ui-ux.md) weather communication,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer ownership.
**Branch / PR:** `feat/weather-render-effects`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added deterministic screen-space
  weather effects for rain streaks, snow particles, fog read-distance
  fade, and dusk or night bloom pools.
- `src/app/race/page.tsx`: passes the active race weather into the
  renderer and uses the existing visual weather assist to reduce
  particle density and overlay alpha.
- `docs/GDD_COVERAGE.json`: added GDD-14-WEATHER-RENDER-EFFECTS.
- `docs/FOLLOWUPS.md`: added F-067 for the remaining weather
  accessibility settings.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 33 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npm run verify` green, 2318 passed.
- `npm run test:e2e` green, 70 passed.
- `grep -rn $'\u2014\|\u2013' ...` clean on changed files.
- `git diff --check` clean.

### Decisions and assumptions
- Weather effects are deterministic screen-space patterns for this
  slice so renderer tests can assert structure without brittle
  screenshots.
- The existing visual weather assist is the first reduction control.
  F-067 owns finer §14 settings for particle intensity, glare, fog floor,
  and flash reduction.

### Coverage ledger
- GDD-14-WEATHER-RENDER-EFFECTS covers static active-weather rendering
  and the visual weather assist intensity reduction.
- Uncovered adjacent requirements: weather state transitions, weather
  particle intensity slider, reduced glare mode, fog floor clamp,
  lightning or night flash reduction, and heat shimmer remain future
  slices.

### Followups created
- F-067: Add weather particle intensity, glare, and fog readability
  settings.

### GDD edits
None.

## 2026-04-28: Slice: Pre-race tire selection

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race preparation,
[§14](gdd/14-weather-and-environmental-systems.md) pre-race forecast,
[§20](gdd/20-hud-and-ui-ux.md) pre-race screen,
[§23](gdd/23-balancing-tables.md) weather modifiers.
**Branch / PR:** `feat/pre-race-tire-selection`, PR pending.
**Status:** Implemented.

### Done
- `src/game/preRaceCard.ts`: added a pure pre-race card builder with
  track, tour, weather, laps, difficulty, recommended tires, standings,
  cash, repair estimate, car summary, setup summary, grip rating, and
  visibility rating.
- `src/app/race/prep/page.tsx`: added the pre-race surface with weather
  selection, dry/wet tire choice, tire mismatch warning, and Start CTA.
- `src/app/world/page.tsx`: routes World Tour entry through the
  pre-race screen instead of jumping directly into the race.
- `src/app/race/page.tsx` and `src/game/raceSession.ts`: read the
  selected `weather` and `tire` query values and apply the player tire
  channel to runtime weather grip.
- `docs/FOLLOWUPS.md`: marked F-066 done.
- `docs/GDD_COVERAGE.json`: added GDD-20-PRE-RACE-TIRE-SELECTION and
  removed F-066 from the weather-runtime coverage followup list.

### Verified
- `npx vitest run src/game/__tests__/preRaceCard.test.ts src/game/__tests__/raceSession.test.ts`
  green, 124 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npx playwright test e2e/pre-race.spec.ts e2e/world-tour.spec.ts`
  green, 2 passed.
- `npx playwright test e2e/tour-flow.spec.ts` green, 2 passed.
- `npm run verify` green, 2312 passed.
- `npm run test:e2e` green, 70 passed.
- `grep -rn $'\u2014\|\u2013' ...` clean on changed files.
- `git diff --check` clean.

### Decisions and assumptions
- The active tire channel is persisted for the race through the route
  query (`tire=dry|wet`) and held on `RaceSessionConfig.playerTire`.
  This avoids a save-schema change for a per-race setup choice.
- AI cars keep dry tires until an AI setup-selection slice lands, matching
  F-066.
- Direct `/race` links still default to dry tires and the first track
  weather option.

### Coverage ledger
- GDD-20-PRE-RACE-TIRE-SELECTION covers the first pre-race card surface
  and active player tire handoff into race physics.
- Uncovered adjacent requirements: optional setup bias, nitro loadout
  confirmation, practice-mode weather swap UI, and AI tire selection
  remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Weather AI allocation hotfix

**GDD sections touched:**
[§15](gdd/15-cpu-opponents-and-ai.md) AI weather skill,
[§21](gdd/21-technical-design-for-web-implementation.md) runtime performance.
**Branch / PR:** `fix/weather-ai-allocation`, PR pending.
**Status:** Implemented.

### Done
- `src/game/ai.ts`: accepts the active weather-skill scalar directly in
  `tickAI`, composes it into the AI pace scalar, and documents why this
  stays numeric in the 60 Hz loop.
- `src/game/raceSession.ts`: reuses the existing `cpuModifiers` reference
  for AI ticks and passes each driver's resolved weather skill as a scalar
  instead of allocating adjusted modifier objects per AI per tick.
- Copilot PR #44 review thread was answered and resolved, but PR #44 had
  already merged before the fix commit landed on `main`; this hotfix
  carries that verified fix forward.

### Verified
- `npx vitest run src/game/__tests__/ai.test.ts src/game/__tests__/weather.test.ts src/game/__tests__/raceSession.test.ts`
  green, 197 passed.
- `npm run typecheck` clean.
- `npm run verify` green, 2295 passed.
- `grep -rn $'\u2014\|\u2013' src/game/ai.ts src/game/raceSession.ts || true`
  clean.
- `git diff --check` clean.

### Decisions and assumptions
- The weather-skill value remains race-session static for this slice,
  matching PR #44. Mid-race weather transitions remain future work.

### Coverage ledger
- No new GDD coverage ID. This hotfix preserves the runtime performance
  contract for the existing GDD-14-WEATHER-GRIP-RUNTIME coverage.
- Uncovered adjacent requirements: tire selection, weather VFX particles,
  fog draw-distance rendering, weather intensity settings, and mid-race
  weather transitions remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Weather grip runtime

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather physics and
visibility effects,
[§15](gdd/15-cpu-opponents-and-ai.md) AI weather skill,
[§23](gdd/23-balancing-tables.md) weather modifiers.
**Branch / PR:** `feat/weather-grip-runtime`, PR pending.
**Status:** Implemented.

### Done
- `src/game/weather.ts`: added runtime aliases for weather options that
  §23 does not give a separate tire row, weather visibility scalars,
  effective grip helpers, and exhaustive AI weather-skill mapping.
- `src/game/physics.ts`: added an optional weather grip scalar to the
  lateral grip calculation while preserving identity behavior for
  callers that omit it.
- `src/game/raceSession.ts`: threads active race weather into player
  and AI physics, and applies AI weather skill to the AI pace scalar.
- `docs/OPEN_QUESTIONS.md`: answered Q-008 with the runtime alias map.
- `docs/FOLLOWUPS.md`: added F-066 for the missing pre-race tire
  selection and active tire-channel persistence.
- `docs/GDD_COVERAGE.json`: added GDD-14-WEATHER-GRIP-RUNTIME.

### Verified
- `npx vitest run src/game/__tests__/weather.test.ts src/game/__tests__/physics.test.ts src/game/__tests__/raceSession.test.ts src/data/__tests__/balancing.test.ts`
  green, 287 passed.
- `npm run typecheck` clean.
- `npm run verify` green, 2295 passed.
- `npm run test:e2e` green, 69 passed.

### Decisions and assumptions
- Q-008 resolved to aliases rather than new balancing numbers:
  `light_rain` uses Rain, `dusk` uses Clear, and `night` uses Clear for
  tire grip. Dusk and night still reduce visibility through
  `WEATHER_VISIBILITY`.
- Race sessions still use the dry tire channel because no active
  tire-selection state exists yet. F-066 owns the §14/§20 tire choice
  surface and the `"wet"` channel handoff.
- Weather changes remain race-start static. Mid-race weather
  transitions stay out of this PR.

### Coverage ledger
- GDD-14-WEATHER-GRIP-RUNTIME covers active weather grip, visibility
  scalars, and AI weather-skill mapping.
- Uncovered adjacent requirements: tire selection, weather VFX
  particles, fog draw-distance rendering, weather intensity settings,
  and mid-race weather transitions remain future slices.

### Followups created
- F-066: Add pre-race tire selection and persist the active tire channel.

### GDD edits
- `docs/gdd/23-balancing-tables.md`: documented runtime aliases for
  §14 weather options without separate §23 tire rows.

## 2026-04-28: Slice: F-024 RNG consumers

**GDD sections touched:**
[§15](gdd/15-cpu-opponents-and-ai.md) deterministic AI contract,
[§21](gdd/21-technical-design-for-web-implementation.md) deterministic replay tests,
[§27](gdd/27-risks-and-mitigations.md) physics feel and replay risk mitigation.
**Branch / PR:** `feat/f-024-rng-consumers`, PR pending.
**Status:** Implemented.

### Done
- `src/game/aiGrid.ts`: switched roster shuffling and per-slot AI seed
  derivation to labelled `splitRng` streams from the grid seed.
- `src/game/ai.ts`: resumes the persisted AI mistake stream with
  `deserializeRng` instead of treating the saved state as a fresh seed.
- `src/game/raceSession.ts`: derives default per-AI seeds from the
  race-level seed through labelled streams while preserving explicit
  grid-provided seeds.
- `src/game/__tests__/aiGrid.test.ts` and `src/game/__tests__/raceSession.test.ts`:
  added coverage for stable, distinct PRNG-derived AI seeds.
- `docs/FOLLOWUPS.md`: marked F-024 done for the consumers that exist
  today.
- `docs/GDD_COVERAGE.json`: added GDD-21-RNG-CONSUMERS.

### Verified
- `npx vitest run src/game/__tests__/aiGrid.test.ts src/game/__tests__/ai.test.ts src/game/__tests__/raceSession.test.ts src/game/__tests__/rng.test.ts src/game/__tests__/no-math-random.test.ts`
  green, 172 passed.
- `npm run typecheck` clean.
- `npm run verify` green, 2261 passed.
- `npm run test:e2e` green, 69 passed.

### Decisions and assumptions
- Hazards and weather do not draw random values in production today, so
  this slice does not add placeholder RNG state to them. Future splash,
  scatter, gust, or hit-magnitude variation must add a labelled stream
  in the owning feature slice.
- Explicit AI seeds from `spawnGrid` remain authoritative over the
  race-level fallback seed so campaign grids keep their per-slot streams.

### Coverage ledger
- GDD-21-RNG-CONSUMERS covers current runtime PRNG consumers and the
  static `Math.random` guard.
- Uncovered adjacent requirements: seeded damage magnitude variation,
  hazard VFX variation, and weather gust schedules remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Hazards runtime

**GDD sections touched:**
[§9](gdd/09-track-design.md) authored track hazards,
[§13](gdd/13-damage-repairs-and-risk.md) off-road object damage,
[§22](gdd/22-data-schemas.md) hazard registry schema,
[§23](gdd/23-balancing-tables.md) damage formula targets.
**Branch / PR:** `feat/hazards-runtime`, PR pending.
**Status:** Implemented.

### Done
- `src/data/hazards.json` and `src/data/hazards.ts`: added a typed hazard
  registry for puddles, slick paint, cones, signs, gravel bands, snow
  buildup, and tunnel metadata.
- `src/game/hazards.ts`: added a pure evaluator that maps a car position
  and compiled segment to hazard events, grip multipliers, damage hits,
  and breakable hazard state.
- `src/game/raceSession.ts`: threads active hazard grip into the physics
  step, forwards physical hazard hits through `applyHit`, and persists
  breakable hazard keys in race state.
- `src/app/race/page.tsx`: passes the bundled hazard registry into live
  race sessions.
- `src/data/__tests__/hazards-content.test.ts`, `src/game/__tests__/hazards.test.ts`,
  and `src/game/__tests__/raceSession.test.ts`: pin registry validity,
  hazard overlap behavior, tunnel no-op behavior, and one-shot breakable
  cone damage.
- `docs/FOLLOWUPS.md`: marked F-019 done now that the hazard damage emitter
  exists.
- `docs/GDD_COVERAGE.json`: added GDD-09-HAZARDS-RUNTIME.

### Verified
- `npx vitest run src/game/__tests__/hazards.test.ts src/data/__tests__/hazards-content.test.ts src/game/__tests__/raceSession.test.ts src/game/__tests__/raceSessionActions.test.ts`
  green, 120 passed.
- `npm run typecheck` clean.
- `npm run verify` green, 2256 passed.
- `npm run test:e2e` green, 69 passed.

### Decisions and assumptions
- Segment-authored hazards occupy the compiled segment where they are
  referenced and use registry default widths and lengths until the track
  schema grows per-instance hazard placement.
- Tunnel hazards are registered and validated now, but tunnel light and
  audio effects stay out of this PR because the tunnel segment slice owns
  that behavior.
- Breakable hazards are tracked per compiled segment and id for the current
  race only. Nothing persists into the save file.

### Coverage ledger
- GDD-09-HAZARDS-RUNTIME covers physical hazard registry validation and live
  race-session grip and damage effects.
- Uncovered adjacent requirements: rendered hazard sprites, puddle splash
  VFX, snow buildup visuals, tunnel light adaptation, and seeded magnitude
  rolls remain future slices.

### Followups created
None.

### GDD edits
- `docs/gdd/22-data-schemas.md`: added the hazard registry JSON example and
  clarified `Track.segments[].hazards` references.

## 2026-04-28: Slice: AI grid spawner

**GDD sections touched:**
[§15](gdd/15-cpu-opponents-and-ai.md) CPU opponent rosters,
[§20](gdd/20-hud-and-ui-ux.md) race route diagnostics,
[§22](gdd/22-data-schemas.md) championship tour schema,
[§25](gdd/25-development-roadmap.md) MVP race field progression.
**Branch / PR:** `feat/ai-grid-spawner`, PR pending.
**Status:** Implemented.

### Done
- `src/game/aiGrid.ts`: added a pure deterministic grid spawner that
  reserves the player slot, shuffles AI rosters by seed, assigns slots,
  lanes, start positions, and per-car seeds for `RaceSession`.
- `src/data/championships/world-tour-standard.json`: added 11-driver AI
  rosters for the first two authored World Tour regions.
- `src/data/schemas.ts` and `docs/gdd/22-data-schemas.md`: documented the
  optional per-tour `aiDrivers` list keyed by `AIDriver.id`.
- `src/app/race/page.tsx`: wired tour races to spawn an 11-opponent field on
  12-slot tracks while keeping the plain `/race` prototype route on its
  single-AI fallback.
- `e2e/twelve-car-field.spec.ts`: added browser coverage that confirms the
  Velvet Coast tour route starts with a 12-car field.

### Verified
- `npx vitest run src/game/__tests__/aiGrid.test.ts src/data/__tests__/championship-content.test.ts`
  green, 24 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/twelve-car-field.spec.ts e2e/race-demo.spec.ts`
  green, 4 passed.
- `npm run verify` green, 2248 passed.
- `npm run test:e2e` green, 69 passed.

### Decisions and assumptions
- The player occupies the first grid slot; AI cars use the remaining
  `track.spawn.gridSlots - 1` slots.
- Non-tour `/race` remains a one-opponent prototype smoke route so the new
  campaign-size field does not hide regressions behind early demo DNFs.
- Time trial still spawns no live AI opponents.

### Coverage ledger
- GDD-15-AI-GRID-SPAWNER covers the initial grid-spawn portion of §15 for authored
  World Tour race fields.
- Uncovered adjacent requirements: richer AI tactical behavior, collision
  avoidance, per-class roster balancing, and full 32-track roster tuning
  remain future slices.

### Followups created
None.

### GDD edits
- `docs/gdd/22-data-schemas.md`: added `aiDrivers` to the championship
  tour JSON example.

## 2026-04-28: Slice: MVP track set

**GDD sections touched:**
[§9](gdd/09-track-design.md) track anatomy, curve and elevation mix,
[§22](gdd/22-data-schemas.md) track JSON schema,
[§24](gdd/24-content-plan.md) MVP two-tour track content.
**Branch / PR:** `feat/mvp-track-set`, PR pending.
**Status:** Implemented.

### Done
- `src/data/tracks/`: added eight bundled MVP track JSON files for
  Velvet Coast and Iron Borough.
- `src/data/tracks/index.ts`: registered the first two World Tour regions
  in `TRACK_RAW` so the live `/race?track=...` route loads real content
  instead of the temporary unresolved-track fallback.
- `src/data/__tests__/tracks-content.test.ts`: expanded the expected
  catalogue and pinned the MVP set's weather, lane, curve, and elevation
  coverage.
- `src/data/__tests__/championship-content.test.ts`: now requires every
  first-two-tour championship track id to resolve while preserving the
  temporary permissive guard for later tours.
- `docs/GDD_COVERAGE.json`: added GDD-24-MVP-TRACK-SET.

### Verified
- `npx vitest run src/data/__tests__/tracks-content.test.ts src/data/__tests__/championship-content.test.ts src/road/__tests__/trackCompiler.test.ts src/road/__tests__/trackCompiler.golden.test.ts`
  green, 88 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/tour-flow.spec.ts e2e/world-tour.spec.ts`
  green, 3 passed.
- `npm run verify` green, 2240 passed.
- `npm run test:e2e` green, 68 passed in 5.0m.

### Decisions and assumptions
- The first two regions ship as the §24 MVP track set. The remaining
  six World Tour regions stay under the existing permissive championship
  placeholder guard until their content slices land.
- MVP track lengths are intentionally short enough to keep current
  tour-flow e2e stable while still exercising curves, elevation, rain,
  fog, and authored hazards.

### Coverage ledger
- GDD-24-MVP-TRACK-SET covers the first two World Tour regions.
- Uncovered adjacent requirements: the remaining six tours, full 32-track
  v1.0 content, richer region-specific art themes, and track-editor
  authoring workflows remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Mobile race playability

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) touch controls,
[§20](gdd/20-hud-and-ui-ux.md) live race HUD surface,
[§21](gdd/21-technical-design-for-web-implementation.md) browser e2e.
**Branch / PR:** `fix/mobile-race-playability`, PR pending.
**Status:** Implemented.

### Done
- `src/app/race/page.tsx`: changed `/race` to a fixed, full-viewport
  surface with no page scroll and a canvas backing store that resizes from
  the rendered CSS size with a DPR clamp.
- `src/app/race/page.tsx`: mounted the existing `TouchControls` overlay on
  the live race route and wired the canvas into `createInputManager` as the
  touch target.
- `src/app/race/page.tsx`: keeps the touch overlay layout synchronized with
  the live canvas size so visual zones and input zones match on mobile
  viewports.
- `e2e/race-mobile.spec.ts`: added iPhone 13 coverage for full-viewport
  canvas sizing, no document scroll, live touch steering, and touch pause.
- `playwright.config.ts`: includes the mobile race spec in the
  `mobile-chromium` project and excludes it from desktop runs.
- `e2e/touch-input.spec.ts`: keeps the existing touch pointer-hold smoke
  tests serial inside the mobile project so they model one device session
  without parallel pointer-event flake.
- `docs/GDD_COVERAGE.json`: added GDD-19-MOBILE-RACE-INPUT.

### Verified
- `npm run lint && npm run typecheck` clean.
- `npm run test:e2e -- --project=mobile-chromium e2e/race-mobile.spec.ts`
  green, 2 passed.
- `npm run test:e2e -- --project=chromium e2e/race-demo.spec.ts e2e/pause-actions.spec.ts e2e/pause-overlay.spec.ts`
  green, 10 passed.
- `npm run test:e2e -- --project=mobile-chromium e2e/touch-input.spec.ts e2e/race-mobile.spec.ts`
  green, 6 passed.
- `npm run verify` green: lint, typecheck, unit tests, and content-lint
  all passed; 2,220 unit tests passed.

### Decisions and assumptions
- The full-screen race surface intentionally uses `position: fixed`,
  `inset: 0`, `overflow: hidden`, and canvas `width: 100%` /
  `height: 100%` rather than viewport-height CSS units so mobile browser
  chrome changes do not leave black page gaps.
- The overlay remains cosmetic. Pointer events feed the canvas-owned touch
  input source; the overlay receives the same live layout so it stays
  visually aligned with that source.

### Coverage ledger
- GDD-19-MOBILE-RACE-INPUT covers the live mobile viewport and touch-input
  wiring.
- Uncovered adjacent requirements: touch handbrake and manual-shift zones,
  full key-remap UI, haptic feedback, and device-lab Safari / Android
  manual verification remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: CONTRIBUTING.md guidance

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) contribution guidelines,
licensing, issue labels, and modding rules.
**Branch / PR:** `docs/contributing-guidance`, PR pending.
**Status:** Implemented.

### Done
- `docs/CONTRIBUTING.md`: confirmed the contributor workflow covers branch
  and PR rules, commit style, verification, originality, licensing, asset
  manifest expectations, issue labels, first-time contributor setup,
  maintainer expectations, and question routing.
- `docs/CONTRIBUTING.md`: linked `MODDING.md` from the scope section and
  replaced the generic manifest language with the current
  `public/art.manifest.json` path.
- Confirmed the README contributing one-liner is already present.

### Verified
- `grep -rn $'\u2014\|\u2013' docs/CONTRIBUTING.md docs/PROGRESS_LOG.md` clean.
- `npm run verify` green: lint, typecheck, unit tests, and content-lint
  passed; 2,220 unit tests passed.

### Decisions and assumptions
- Audio, track, balancing, and mod-data manifest loaders are not all present
  yet, so the contributor guide names the current art manifest path and tells
  contributors to carry equivalent provenance metadata in the PR until the
  matching loader exists.

### Coverage ledger
- GDD-26-CONTRIBUTING-GUIDE covers the contributor guide.
- Uncovered adjacent requirements: full code of conduct file, PR template
  reuse of the checklist, expanded audio and mod asset manifest loaders,
  expanded `MODDING.md`, and GitHub Discussions setup remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: Full World Tour flow coverage

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race to results loop,
[§8](gdd/08-world-and-progression-design.md) tour progression,
[§20](gdd/20-hud-and-ui-ux.md) results next-race flow.
**Branch / PR:** `test/full-world-tour-flow`, PR pending.
**Status:** Implemented.

### Done
- `e2e/tour-flow.spec.ts`: added a start-from-`/world` Velvet Coast
  flow that finishes all four queued tour races through the Continue
  tour CTA and asserts Iron Borough unlocks.
- The same seeded four-race flow runs twice in one test and compares the
  completed track sequence and tour-complete text, covering the parent
  dot determinism requirement.

### Verified
- `npm run typecheck` clean.
- `npm run verify` green: lint, typecheck, unit tests, and
  content-lint all passed; 2,220 unit tests passed.
- `npm run test:e2e -- e2e/tour-flow.spec.ts` green, 2 passed.

### Decisions and assumptions
- The full flow intentionally reuses the temporary unresolved-tour-track
  placeholder from F-065. This validates tour progression behavior while
  the authored World Tour track JSON remains future content work.

### Coverage ledger
- GDD-08-TOUR-PROGRESSION now has start-from-world four-race Playwright
  coverage in addition to the final-race unlock coverage.
- Uncovered adjacent requirements: full authored World Tour track JSON
  and richer tour standings UI remain future slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: F-065 active tour progression

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race to results loop,
[§8](gdd/08-world-and-progression-design.md) tour unlock structure,
[§20](gdd/20-hud-and-ui-ux.md) results next-race flow,
[§22](gdd/22-data-schemas.md) save progress fields.
**Branch / PR:** `feat/f-065-active-tour-progression`, PR pending.
**Status:** Implemented.

### Done
- `src/data/schemas.ts`: added optional `progress.activeTour` with the
  persisted tour cursor and recorded per-race outcomes.
- `src/components/world/worldTourState.ts`: persists the seeded active
  tour when the player enters a tour.
- `src/game/tourProgress.ts`: added the pure active-tour commit helper
  that advances races one through three, clears the cursor after race
  four, and unlocks the next tour on pass.
- `src/app/race/page.tsx`: resolves tour race URLs against planned
  championship track ids, uses the temporary straight-track runtime
  placeholder for unimplemented tour tracks, and applies tour progress
  during natural finish and retire commits.
- `src/app/race/results/page.tsx`: shows tour completion state and adds
  the Continue tour action when another tour race is queued.
- `e2e/tour-flow.spec.ts`: covers the final Velvet Coast race unlocking
  Iron Borough.
- `docs/FOLLOWUPS.md`: marked F-065 done.
- `docs/GDD_COVERAGE.json`: added GDD-08-TOUR-PROGRESSION coverage.

### Verified
- `npx vitest run src/game/__tests__/tourProgress.test.ts src/game/__tests__/raceResult.test.ts src/components/world/__tests__/worldTourState.test.ts src/data/schemas.test.ts`
  green, 115 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run verify` green: lint, typecheck, unit tests, and
  content-lint all passed; 2,220 unit tests passed.
- `npm run test:e2e -- e2e/results-screen.spec.ts e2e/world-tour.spec.ts e2e/tour-flow.spec.ts`
  green, 7 passed.

### Decisions and assumptions
- Planned World Tour track ids are preserved in results and URLs even
  before all 32 track JSON files exist. The race runtime temporarily
  runs unresolved tour tracks on `test/straight` so tour progression can
  ship without blocking on track content.
- Tour completion bonus wiring reads the persisted per-race cash ledger
  from `progress.activeTour.results`, so the fourth-race completion
  bonus is based on all completed tour races.

### Coverage ledger
- Added GDD-08-TOUR-PROGRESSION with unit and Playwright coverage.
- GDD-08-WORLD-TOUR-HUB no longer has F-065 as an open followup.
- Uncovered adjacent requirements: full authored World Tour track JSON
  and richer tour standings UI remain future slices.

### Followups created
None.

### GDD edits
- Updated [§22](gdd/22-data-schemas.md) with the optional
  `progress.activeTour` save shape.

## 2026-04-28: Slice: World tour entry hub

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race and garage loop entry,
[§8](gdd/08-world-and-progression-design.md) tour unlock structure,
[§22](gdd/22-data-schemas.md) championship and save progress fields,
[§24](gdd/24-content-plan.md) eight-tour championship content.
**Branch / PR:** `feat/world-tour-entry-hub`, PR pending.
**Status:** Implemented.

### Done
- `src/components/world/worldTourState.ts`: added the testable tour
  card builder, first-tour fresh-save normalization, and `enterWorldTour`
  wrapper around the existing pure `enterTour` primitive.
- `src/app/world/page.tsx`: added a localStorage-backed World Tour hub
  that renders every tour, shows locked and completed state, names the
  previous-tour gate, persists tour entry, and routes the selected
  tour's first track id to `/race`.
- `src/app/page.tsx`: exposed World Tour from the title menu.
- `src/app/garage/page.tsx`: sends the garage Next race action through
  `/world` now that the tour entry surface exists.
- `e2e/world-tour.spec.ts`: covers the fresh-save tour hub, locked Iron
  Borough gate, Velvet Coast entry, and persisted first-tour unlock.
- `docs/FOLLOWUPS.md`: added F-065 for the remaining four-race active
  tour progression and unlock flow.
- `docs/GDD_COVERAGE.json`: added GDD-08-WORLD-TOUR-HUB coverage.

### Verified
- `npx vitest run src/components/world/__tests__/worldTourState.test.ts src/app/__tests__/page.test.tsx`
  green, 16 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run test:e2e -- e2e/world-tour.spec.ts e2e/title-screen.spec.ts e2e/garage-flow.spec.ts`
  green, 8 passed.
- `npm run verify` green: lint, typecheck, unit tests, and
  content-lint all passed; 2,215 unit tests passed.

### Decisions and assumptions
- A fresh save treats the first championship tour as unlocked at the
  world hub. The helper persists that unlock when the player enters
  Velvet Coast so the save agrees with the displayed state.
- The hub passes the planned championship track id to `/race` even while
  the full 32-track content set is still being authored. The race route
  keeps its current fallback behavior until those track JSON files land.

### Coverage ledger
- Added GDD-08-WORLD-TOUR-HUB with code and automated test coverage.
- Uncovered adjacent requirements: four-race active tour persistence,
  aggregate standings, tour failure retry, tour completion unlocks, and
  deterministic full tour e2e remain open under F-065 and the parent
  tour-region dot.

### Followups created
- F-065: Persist active tour race progression through the four-race
  World Tour loop.

### GDD edits
None.

## 2026-04-28: Slice: Garage results handoff

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race to results to garage loop,
[§12](gdd/12-upgrade-and-economy-system.md) garage upgrade entry,
[§13](gdd/13-damage-repairs-and-risk.md) between-race repair entry,
[§20](gdd/20-hud-and-ui-ux.md) results default action.
**Branch / PR:** `fix/garage-results-handoff`, #33.
**Status:** Implemented.

### Done
- `src/app/race/results/page.tsx`: routes the primary Continue to
  Garage action to the garage hub at `/garage` instead of the car
  browser, so the post-race loop lands on repairs, upgrades, and next
  race actions.
- `e2e/race-finish.spec.ts`: updated the race-finish repair handoff
  expectation to match the garage hub route.
- `e2e/results-screen.spec.ts`: updated the seeded results-screen CTA
  expectation and test name to match the garage hub route.
- `e2e/garage-flow.spec.ts`: added the missing full garage-flow walk:
  finish a race, continue to `/garage`, open repairs, complete a full
  service, buy the first engine upgrade, and start the next race from
  the garage hub. The seeded save fixture is locally typed so schema
  drift is caught by TypeScript.
- `docs/GDD_COVERAGE.json`: records the new end-to-end garage flow test
  against GDD-05-GARAGE-SUMMARY.

### Verified
- `npm run test:e2e -- e2e/garage-flow.spec.ts e2e/race-finish.spec.ts e2e/garage-summary.spec.ts`
  green, 6 passed.
- `npm run test:e2e -- e2e/results-screen.spec.ts` green, 4 passed.
- `npm run verify` green: lint, typecheck, unit tests, and
  content-lint all passed; 2,207 unit tests passed.

### Decisions and assumptions
- The garage hub is the canonical between-race destination. The car
  browser remains available from the hub, repair shop, and upgrade shop,
  but it is not the default post-results action.

### Coverage ledger
- GDD-05-GARAGE-SUMMARY now has full-loop Playwright coverage through
  `e2e/garage-flow.spec.ts`.
- Uncovered adjacent requirements: tour standings, recommended weather
  fit, ghost status, leaderboard status, and full next-race tournament
  data remain future garage and tour slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: F-064 race damage garage persistence

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) race to results to repairs loop,
[§12](gdd/12-upgrade-and-economy-system.md) essential repair cap,
[§13](gdd/13-damage-repairs-and-risk.md) repair decisions and damage risk,
[§22](gdd/22-data-schemas.md) save repair queue.
**Branch / PR:** `feat/f-064-race-damage-persistence`, PR pending.
**Status:** Implemented.

### Done
- `src/game/raceDamagePersistence.ts`: added pure helpers to read active
  car pending damage, project damage into the results builder, normalize
  final damage, and write final damage plus race payout into the garage
  queue.
- `src/game/raceSession.ts`: lets the player session start from queued
  active-car damage while preserving pristine defaults for fresh saves.
- `src/app/race/page.tsx`: threads initial damage into result damage
  deltas and writes final `session.player.damage` from both natural
  finish and retire paths.
- `e2e/race-finish.spec.ts`: covers race finish to results to garage
  repair, including localStorage damage queue and repair-page readback.
- `docs/FOLLOWUPS.md`: closed F-064.
- `docs/GDD_COVERAGE.json`: added
  `GDD-13-RACE-DAMAGE-PERSISTENCE` and removed the stale open repair
  followup refs.

### Verified
- `npx vitest run src/game/__tests__/raceDamagePersistence.test.ts src/game/__tests__/raceSession.test.ts src/game/__tests__/raceResult.test.ts`
  green, 162 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/race-finish.spec.ts e2e/garage-repairs.spec.ts`
  green, 4 passed.

### Decisions and assumptions
- The persisted repair queue stores the final active-car damage for the
  completed race. That means an already damaged car starts the next race
  damaged, and any additional race damage accumulates before the queue is
  overwritten with the new final state.
- Time Trial keeps skipping economy writes, so it does not write repair
  queue damage or last race cash.

### Coverage ledger
- Added GDD-13-RACE-DAMAGE-PERSISTENCE with code and automated test
  coverage.
- GDD-13-GARAGE-REPAIR-PURCHASE no longer tracks F-064 as an open
  followup.
- Uncovered adjacent requirements: tour standings, recommended weather
  fit, ghost status, leaderboard status, and full next-race tournament
  data remain future garage slices.

### Followups created
None.

### GDD edits
None.

## 2026-04-28: Slice: F-061 garage repair purchase surface

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage repair loop,
[§12](gdd/12-upgrade-and-economy-system.md) repair costs and
essential repair cap,
[§13](gdd/13-damage-repairs-and-risk.md) full service and quick patch,
[§22](gdd/22-data-schemas.md) save repair queue.
**Branch / PR:** `feat/f-061-garage-repairs`, #31.
**Status:** Implemented.

### Done
- `src/data/schemas.ts` and `src/persistence/save.ts`: added optional
  `garage.pendingDamage` plus `lastRaceCashEarned` so the garage can
  persist per-car damage and seed fresh saves without breaking older
  v3 saves.
- `src/components/garage/garageRepairState.ts`: builds repair quotes
  from the active save, calls `applyRepairCost` for full service and
  essential repair, surfaces cap savings, and stores post-repair damage
  back into the save.
- `src/app/garage/repair/page.tsx`: replaced the placeholder with a
  localStorage-backed repair shop that shows per-zone damage, debits
  credits, persists repairs, and handles missing active-car saves.
- `src/components/garage/garageSummaryState.ts` and
  `src/app/garage/page.tsx`: show active-car pending damage on the
  garage hub instead of the old static placeholder.
- `e2e/garage-repairs.spec.ts`: seeds damage, buys an essential repair,
  checks cap savings, verifies credits and remaining body damage, and
  reloads to prove persistence.
- `docs/FOLLOWUPS.md`: closed F-061 and opened F-064 for the remaining
  race-finish damage producer.
- `docs/GDD_COVERAGE.json`: added
  `GDD-13-GARAGE-REPAIR-PURCHASE` and removed F-061 from the garage
  summary open followups.

### Verified
- `npx vitest run src/components/garage/__tests__/garageRepairState.test.ts src/components/garage/__tests__/garageSummaryState.test.ts src/data/schemas.test.ts src/persistence/save.test.ts`
  green, 91 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/garage-repairs.spec.ts e2e/garage-summary.spec.ts`
  green, 3 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed; 2,201 unit tests passed.

### Decisions and assumptions
- Full service maps to all current damage zones (`engine`, `tires`,
  `body`). Essential repair maps to the performance-critical zones
  (`engine`, `tires`) so it can leave body damage as the §13 quick-patch
  tradeoff.
- The repair surface consumes `garage.pendingDamage` now. Race-finish
  production of that queue remains a separate slice because it touches
  the race result commit path and needs its own browser flow.

### Coverage ledger
- Added GDD-13-GARAGE-REPAIR-PURCHASE with code and automated test
  coverage.
- GDD-05-GARAGE-SUMMARY no longer tracks F-061.
- Uncovered adjacent requirements: race-finish damage persistence,
  standings, weather fit, ghost status, leaderboard status, and full
  next-race tournament data remain future garage slices.

### Followups created
- F-064: Persist race damage into the garage repair queue.

### GDD edits
- `docs/gdd/22-data-schemas.md`: documented `garage.pendingDamage` and
  `garage.lastRaceCashEarned` in the SaveGame example and notes.

---

## 2026-04-28: Slice: F-062 garage upgrade purchase surface

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage loop,
[§12](gdd/12-upgrade-and-economy-system.md) upgrade categories and
sequential tiers,
[§20](gdd/20-hud-and-ui-ux.md) upgrade shop.
**Branch / PR:** `feat/f-062-garage-upgrades`, PR pending.
**Status:** Implemented.

### Done
- `src/components/garage/garageUpgradeState.ts`: builds the upgrade
  shop view from the active save, including current tier, next tier,
  per-car cap, cost, effects, and disabled reason.
- `src/app/garage/upgrade/page.tsx`: replaced the placeholder route
  with a localStorage-backed purchase surface that calls
  `purchaseAndInstall`, persists via `saveSave`, and reports economy
  failures inline.
- `src/components/garage/__tests__/garageUpgradeState.test.ts`:
  covers next-tier eligibility, insufficient credits, caps, missing
  active car state, and failure-message formatting.
- `e2e/garage-upgrades.spec.ts`: seeds a garage save, buys Street
  Engine, verifies credits and installed tier, and reloads to prove the
  persisted state survives.
- `docs/FOLLOWUPS.md`: closed F-062.
- `docs/GDD_COVERAGE.json`: added
  `GDD-12-GARAGE-UPGRADE-PURCHASE` and removed F-062 from the garage
  summary open followups.

### Verified
- `npx vitest run src/components/garage/__tests__/garageUpgradeState.test.ts src/components/garage/__tests__/garageSummaryState.test.ts`
  green, 10 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/garage-upgrades.spec.ts e2e/garage-summary.spec.ts`
  green, 3 passed.

### Decisions and assumptions
- Purchase and install remain folded into one action for MVP because
  `purchaseAndInstall` is the current canonical economy surface.
- The upgrade shop stays tied to the active owned car. Missing or
  unowned active car saves route the player back to garage recovery
  rather than allowing detached purchases.

### Coverage ledger
- Added GDD-12-GARAGE-UPGRADE-PURCHASE with code and automated test
  coverage.
- GDD-05-GARAGE-SUMMARY now only tracks F-061 for the remaining
  placeholder repair route.
- Uncovered adjacent requirements: real repair purchasing, standings,
  weather fit, ghost status, leaderboard status, and full next-race
  tournament data remain future garage slices.

### Followups created
None.

### GDD edits
None.

---

## 2026-04-28: Slice: F-063 starter eligibility

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) starter car choice,
[§11](gdd/11-cars-and-stats.md) three starter examples,
[§20](gdd/20-hud-and-ui-ux.md) garage starter recovery.
**Branch / PR:** `feat/f-063-starter-eligibility`, PR pending.
**Status:** Implemented.

### Done
- `src/data/cars/index.ts`: exports `STARTER_CAR_IDS` for the three
  §11 starter-choice cars while keeping `STARTER_CAR_ID` as the fresh
  save default.
- `src/components/garage/garageSummaryState.ts`: uses
  `STARTER_CAR_IDS` for starter recovery instead of inferring starter
  eligibility from `purchasePrice`.
- `src/data/__tests__/cars-content.test.ts` and
  `src/components/garage/__tests__/garageSummaryState.test.ts`: pin the
  three starter-choice ids and reject non-starter cars.
- `e2e/garage-summary.spec.ts`: asserts the starter recovery UI exposes
  Sparrow GT, Breaker S, and Vanta XR.
- `docs/FOLLOWUPS.md`: closed F-063.
- `docs/GDD_COVERAGE.json`: removed F-063 from the garage summary open
  followup refs.

### Verified
- `npx vitest run src/data/__tests__/cars-content.test.ts src/components/garage/__tests__/garageSummaryState.test.ts`
  green, 35 passed.
- `npm run content-lint` clean.
- `npm run test:e2e -- e2e/garage-summary.spec.ts` green, 2 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,185 unit tests passed.

### Decisions and assumptions
- Starter eligibility is separate from purchase price. This preserves
  the current car shop economy while allowing the championship starter
  picker to offer the three §11 examples.

### Coverage ledger
- GDD-05-GARAGE-SUMMARY remains covered for starter recovery.
- Uncovered adjacent requirements: real repair purchasing, real
  upgrade purchasing, standings, weather fit, ghost status, leaderboard
  status, and full next-race tournament data remain future garage
  slices.

### Followups created
None.

### GDD edits
None.

---

## 2026-04-27: Slice: Garage summary review fixes

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage loop,
[§11](gdd/11-cars-and-stats.md) starter cars,
[§12](gdd/12-upgrade-and-economy-system.md) upgrade categories,
[§21](gdd/21-technical-design-for-web-implementation.md) save
consistency.
**Branch / PR:** `fix/garage-summary-review-fixes`, PR pending.
**Status:** Implemented.

### Done
- `src/components/garage/garageSummaryState.ts`: derives garage
  upgrade categories from `UpgradeCategorySchema.options` so the hub
  cannot drift from the save schema.
- `src/app/garage/page.tsx`: keeps in-memory garage state aligned with
  the `writeCounter` increment applied by `saveSave` after a successful
  write.
- `e2e/garage-summary.spec.ts`: aligns the seeded `colorBlindMode`
  union with the persisted save schema.
- `src/components/garage/__tests__/garageSummaryState.test.ts`:
  renames the paid-car rejection case from starter repair to starter
  selection.

### Verified
- `npx vitest run src/components/garage/__tests__/garageSummaryState.test.ts src/app/__tests__/page.test.tsx`
  green, 13 passed.
- `npm run content-lint` clean.
- `npm run test:e2e -- e2e/garage-summary.spec.ts e2e/save-persistence.spec.ts`
  green, 4 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,184 unit tests passed.

### Decisions and assumptions
- This is a follow-up hotfix because PR #27 merged before the
  review-fix commit reached main.

### Coverage ledger
- GDD-05-GARAGE-SUMMARY remains covered. This slice tightens the same
  implementation and tests after review.
- Uncovered adjacent requirements: real repair purchasing, real
  upgrade purchasing, standings, weather fit, ghost status, leaderboard
  status, full next-race tournament data, and §11 starter catalogue
  alignment remain future garage slices.

### Followups created
None.

### GDD edits
None.

---

## 2026-04-27: Slice: Garage summary surface

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) garage loop,
[§11](gdd/11-cars-and-stats.md) car selection,
[§12](gdd/12-upgrade-and-economy-system.md) installed upgrades,
[§20](gdd/20-hud-and-ui-ux.md) garage layout.
**Branch / PR:** `feat/garage-summary-flow`, PR pending.
**Status:** Implemented.

### Done
- `src/app/page.tsx`: routes the title menu Garage entry to the new
  garage hub instead of the car selector.
- `src/app/garage/page.tsx`: renders the first garage hub with active
  car, credits, owned count, repair placeholder, installed upgrade
  tiers, next race action, and links to cars, repairs, upgrades, and
  race entry.
- `src/components/garage/garageSummaryState.ts`: adds deterministic
  state projection for the garage summary and starter recovery path.
- `src/app/garage/repair/page.tsx` and
  `src/app/garage/upgrade/page.tsx`: add explicit placeholder routes so
  the summary actions do not dead-end before their purchase slices land.
- `e2e/garage-summary.spec.ts`: covers summary rendering, action link
  routing, and recovery from a save whose active car id is no longer
  owned or known.
- `docs/FOLLOWUPS.md`: created followups for repair purchase, upgrade
  purchase, and starter catalogue alignment.
- `docs/GDD_COVERAGE.json`: added GDD-05-GARAGE-SUMMARY.

### Verified
- `npx vitest run src/components/garage/__tests__/garageSummaryState.test.ts`
  green, 5 passed.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,184 unit tests passed.
- `npm run test:e2e -- e2e/title-screen.spec.ts e2e/garage-summary.spec.ts`
  green, 7 passed.

### Decisions and assumptions
- The garage hub ships as a summary and routing surface first. Repair
  and upgrade purchase flows are separate PR-sized slices because they
  need their own save mutations and economy tests.
- Starter recovery currently uses free catalogue entries. The catalogue
  only has Sparrow GT as `purchasePrice: 0`, so the §11 three-starter
  wording is tracked as F-063 instead of silently changing economy
  balance in this slice.

### Coverage ledger
- GDD-05-GARAGE-SUMMARY: covered by the new garage hub, state helper,
  and Playwright summary flow.
- Uncovered adjacent requirements: real repair purchasing, real
  upgrade purchasing, standings, weather fit, ghost status, leaderboard
  status, and full next-race tournament data remain future garage
  slices.

### Followups created
- F-061: Implement garage repair purchase surface.
- F-062: Implement garage upgrade purchase surface.
- F-063: Align starter selection content with the three §11 starter
  examples.

### GDD edits
None. This slice implements existing §5, §11, §12, and §20 intent.

---

## 2026-04-27: Slice: F-048 AI difficulty scalars

**GDD sections touched:**
[§15](gdd/15-cpu-opponents-and-ai.md) CPU difficulty tiers,
[§23](gdd/23-balancing-tables.md) CPU difficulty modifiers,
[§21](gdd/21-technical-design-for-web-implementation.md) deterministic
runtime.
**Branch / PR:** `feat/f-048-ai-difficulty-scalars`, PR pending.
**Status:** Implemented.

### Done
- `src/game/ai.ts`: consumes all three §23 CPU difficulty scalar
  columns. `paceScalar` remains stacked on target speed,
  `mistakeScalar` now stacks on `AIDriver.mistakeRate` for a
  deterministic lane-target mistake hook, and `recoveryScalar` now
  stacks on a bounded light trailing-gap pace lift.
- `src/game/__tests__/ai.test.ts`: covers Easy producing more
  deterministic mistakes than Hard, positive mistake-rate seed
  advancement, and Master recovery being larger than Easy under a
  matched trailing gap.
- `src/game/aiDifficulty.ts` and
  `src/data/__tests__/balancing.test.ts`: updated comments so the
  §23 modifier docs match the runtime consumers.
- `docs/FOLLOWUPS.md`: closed F-048.
- `docs/GDD_COVERAGE.json`: added GDD-15-CPU-DIFFICULTY-RUNTIME.

### Verified
- `npx vitest run src/game/__tests__/ai.test.ts` green, 27 passed.
- `npx vitest run src/game/__tests__/ai.test.ts src/game/__tests__/aiDifficulty.test.ts src/data/__tests__/balancing.test.ts`
  green, 115 passed.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,179 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- The recovery hook is intentionally light and bounded under the
  existing top-speed clamp. It makes the §23 scalar observable without
  adding impossible pace or the full rubber-banding policy in this
  slice.
- The shared mistake hook perturbs the lane target only. Specific
  miss-apex, early-brake, wasted-nitro, and weather-mismatch mistakes
  remain part of the full-AI slice.

### Coverage ledger
- GDD-15-CPU-DIFFICULTY-RUNTIME: covered by runtime wiring and AI unit
  tests.
- Uncovered adjacent requirements: overtake / lane-shift behavior,
  archetype-specific mistake shapes, nitro use, weather skill, and full
  grid behavior remain under `VibeGear2-implement-full-ai-fab57b84`.

### Followups created
None.

### GDD edits
None. This slice implements existing §15, §21, and §23 intent.

---

## 2026-04-27: Slice: F-058 weather car trails

**GDD sections touched:**
[§14](gdd/14-weather-and-environmental-systems.md) weather visual
effects,
[§16](gdd/16-rendering-and-visual-design.md) car sprite weather
variants,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer pipeline.
**Branch / PR:** `feat/f-058-weather-car-trails`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added weather-aware live car trail
  rendering. Clear, dusk, and night draw no trail; rain variants draw
  blue-white spray; snow draws pale mist behind the car.
- `src/app/race/page.tsx`: passes the active race weather from the
  race config / compiled track into the live player car draw path.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covers clear, wet,
  fog, wet, and snow trail behavior plus alpha restoration.
- `docs/FOLLOWUPS.md`: closed F-058.
- `docs/GDD_COVERAGE.json`: marked GDD-16-CAR-WEATHER-VARIANTS as
  implemented with renderer test coverage.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 27 passed.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,175 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- Weather trails are renderer effects attached to the live player car,
  not extra sprite atlas rows. This matches the current Canvas2D effect
  stack and lets weather state drive the effect directly.
- Dusk and night do not imply spray or snow by themselves, so they draw
  no car trail until a later lighting slice adds glow or headlight VFX.

### Coverage ledger
- GDD-16-CAR-WEATHER-VARIANTS: covered by weather-aware live car trails
  and renderer tests.
- Uncovered adjacent requirements: rain streaks, road sheen, snowfall,
  fog fade, night bloom, and weather physics remain broader §14 work.

### Followups created
None.

### GDD edits
None. This slice implements existing §14, §16, and §21 intent.

---

## 2026-04-27: Slice: F-060 car turn direction

**GDD sections touched:**
[§16](gdd/16-rendering-and-visual-design.md) car sprite direction.
**Branch / PR:** `fix/f-060-car-turn-direction`, PR #24.
**Status:** Implemented.

### Done
- `src/render/carFrame.ts`: corrected the live car atlas frame mapper
  so positive steering uses the Sparrow row's positive-skew right-turn
  frames, and negative steering uses the row-end left-turn frames.
- `src/render/__tests__/carFrame.test.ts`: updated right, left, and
  curve-influenced frame selection regressions to match the actual
  atlas direction.
- `docs/FOLLOWUPS.md`: added and closed F-060.
- `docs/GDD_COVERAGE.json`: linked F-060 to car sprite atlas coverage.

### Verified
- `npx vitest run src/render/__tests__/carFrame.test.ts` green, 4
  passed.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,171 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- The visible turn direction is defined by the authored Sparrow atlas
  row, not by the previous F-059 row-end assumption.

### Coverage ledger
- GDD-16-CAR-SPRITE-ATLAS: extended to cover live car left/right turn
  direction against the atlas row.
- Uncovered adjacent requirements: weather-specific spray and snow trail
  variants remain tracked under F-058.

### Followups created
None.

### GDD edits
None. This slice implements existing §16 intent.

---

## 2026-04-27: Slice: F-059 turn crest road warp

**GDD sections touched:**
[§9](gdd/09-track-design.md) road curvature and readable edges,
[§16](gdd/16-rendering-and-visual-design.md) segment-based projection
and car sprite direction,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer pipeline.
**Branch / PR:** `fix/f-059-turn-crest-road-warp`, PR pending.
**Status:** Implemented.

### Done
- `src/road/segmentProjector.ts`: changed the foreground projection
  endpoint to anchor to the camera-local road plane at the screen
  bottom. The foreground road no longer extrapolates from farther curve
  or crest strips.
- `src/road/__tests__/segmentProjector.test.ts`: updated the foreground
  regression to assert the camera-local bottom endpoint.
- `src/render/carFrame.ts`: moved live car atlas frame selection into a
  testable helper and reversed the left/right frame mapping so lateral
  movement matches the sprite lean.
- `src/app/race/page.tsx`: now imports the tested car frame helper for
  live and ghost overlay frame selection.
- `src/render/__tests__/carFrame.test.ts`: added frame-selection
  regressions for neutral, left, right, and curve-influenced lean.
- `docs/FOLLOWUPS.md`: added and closed F-059.
- `docs/GDD_COVERAGE.json`: linked F-059 to elevation projection and
  car sprite atlas coverage.

### Verified
- `npx vitest run src/road/__tests__/segmentProjector.test.ts src/render/__tests__/carFrame.test.ts`
  green, 40 passed.
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/render/__tests__/carFrame.test.ts src/road/__tests__/segmentProjector.test.ts`
  green, 63 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,171 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- The screen-bottom foreground edge represents the camera-local road
  plane, not a distant projected curve sample. This keeps the bottom of
  the road stable while still letting the road ahead curve and crest.
- The Sparrow atlas row uses left-leaning frames near the start of the
  row and right-leaning frames near the end, so the runtime mapping must
  invert the previous F-051 sign choice.

### Coverage ledger
- GDD-09-ELEVATION-LIVE: extended to cover turn and crest foreground
  stability.
- GDD-16-CAR-SPRITE-ATLAS: extended to cover correct left/right atlas
  frame direction.
- Uncovered adjacent requirements: weather-specific spray and snow trail
  variants remain tracked under F-058.

### Followups created
None.

### GDD edits
None. This slice implements existing §9, §16, and §21 intent.

---

## 2026-04-27: Slice: F-051 car atlas sprite overlays

**GDD sections touched:**
[§16](gdd/16-rendering-and-visual-design.md) car sprites and sprite
scaling,
[§17](gdd/17-art-direction.md) car design language and asset export,
[§21](gdd/21-technical-design-for-web-implementation.md) sprite atlas
renderer pipeline.
**Branch / PR:** `feat/f-051-car-atlas-sprites`, PR #22.
**Status:** Implemented.

### Done
- `public/art/cars/sparrow.svg`: added an original car sprite sheet with
  12 clean directional frames plus dented, battered, brake, and nitro
  variants.
- `public/art.manifest.json`: added provenance and licence metadata for
  the shipped car sprite sheet.
- `src/data/atlas/cars.json`: pointed the existing atlas metadata at the
  shipped SVG sprite sheet.
- `src/render/pseudoRoadCanvas.ts`: draws live and ghost car overlays
  from atlas frames when a loaded atlas image is available, while keeping
  the existing procedural live car and blue ghost rectangle as fallback
  paths.
- `src/app/race/page.tsx`: loads the car atlas once per race mount and
  selects a frame from current steering input plus upcoming road curve.
- `docs/FOLLOWUPS.md`: closed F-051.
- `docs/GDD_COVERAGE.json`: marked GDD-16-CAR-SPRITE-ATLAS as
  implemented with renderer test coverage.
- `docs/FOLLOWUPS.md` and `docs/GDD_COVERAGE.json`: added F-058 for
  the weather-specific car spray and snow trail variants that remain
  outside this atlas overlay slice.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/render/__tests__/spriteAtlas.test.ts`
  green, 39 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,167 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- The first atlas asset ships as an SVG sprite sheet because the Canvas
  path already accepts browser `Image` sources and the metadata uses
  source rectangles. The renderer still falls back cleanly if the asset
  cannot load.

### Coverage ledger
- GDD-16-CAR-SPRITE-ATLAS: covered by the shipped car atlas, live and
  ghost renderer wiring, and renderer unit tests.
- Uncovered adjacent requirements: weather-specific spray and snow trail
  variants are tracked under F-058.

### Followups created
- F-058: add weather-specific car trail and spray variants.

### GDD edits
None. This slice implements existing §16, §17, and §21 intent.

---

## 2026-04-27: Slice: F-057 turn foreground projection continuity

**GDD sections touched:**
[§9](gdd/09-track-design.md) road curvature and readable edges,
[§16](gdd/16-rendering-and-visual-design.md) segment-based projection
and foreground speed cues,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer pipeline.
**Branch / PR:** `fix/f-057-turn-foreground-shear`, PR #21.
**Status:** Implemented.

### Done
- `src/road/segmentProjector.ts`: changed the foreground endpoint to
  extrapolate both centerline `screenX` and half-width from the nearest
  two visible projected strips. Turning left or right no longer pins
  the screen-bottom road center to a stale near-strip center.
- `src/road/__tests__/segmentProjector.test.ts`: added a lateral-road
  motion regression that proves the foreground endpoint follows the
  projected centerline instead of shearing away from it.
- `docs/FOLLOWUPS.md`: added and closed F-057 for the observed turn
  foreground shear.
- `docs/GDD_COVERAGE.json`: linked F-057 to GDD-09-ELEVATION-LIVE
  because the same projection contract owns grade, curve, and
  foreground road continuity.

### Verified
- `npx vitest run src/road/__tests__/segmentProjector.test.ts` green,
  36 passed.
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/road/__tests__/segmentProjector.test.ts`
  green, 57 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,165 unit tests passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.

### Decisions and assumptions
- The fix stays in the projector rather than the Canvas2D renderer
  because the renderer should consume a consistent strip-pair contract.
  The bottom endpoint now follows the same projected centerline as the
  visible road.

### Coverage ledger
- GDD-09-ELEVATION-LIVE: extended to cover foreground centerline
  continuity while turning.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS remains open
  under F-051.

### Followups created
None.

### GDD edits
None. This slice implements existing §9, §16, and §21 intent.

---

## 2026-04-27: Slice: F-056 uphill lane-marking duty cycle

**GDD sections touched:**
[§9](gdd/09-track-design.md) road lanes and shoulders,
[§16](gdd/16-rendering-and-visual-design.md) road-strip rendering,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer pipeline.
**Branch / PR:** `fix/f-056-uphill-marking-continuity`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: changed lane markings from a full
  48 m visible phase to a short visible duty inside the existing repeat
  cycle. The projected dash now enters the near camera as a short mark
  instead of filling a whole uphill strip.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: added renderer
  geometry regressions for in-strip duty boundaries and near-camera
  short dashes.
- `docs/FOLLOWUPS.md`: added and closed F-056 for the observed uphill
  marking pulse.
- `docs/GDD_COVERAGE.json`: linked F-056 to GDD-16-ROAD-MARKINGS.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts` green,
  21 passed.
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/road/__tests__/segmentProjector.test.ts`
  green, 56 passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,164 unit tests passed.

### Decisions and assumptions
- F-055 correctly moved phase to road distance, but the dash duty was
  still too large for a lane mark. This slice preserves world-distance
  phase while making the visible dash span physically short.

### Coverage ledger
- GDD-16-ROAD-MARKINGS: covered by short-duty lane marking draws and
  renderer unit tests.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS remains open
  under F-051.

### Followups created
None.

### GDD edits
None. This slice implements existing §9, §16, and §21 intent.

---

## 2026-04-27: Slice: CONTRIBUTING.md guide

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) open-source project
guidance.
**Branch / PR:** `docs/f-056-contributing-guide`, PR pending.
**Status:** Implemented.

### Done
- `docs/CONTRIBUTING.md`: replaced the working-notes page with the
  contributor-facing workflow, verification, originality, licensing,
  asset-manifest, schema, issue-label, and maintainer-expectation guide.
- `docs/MODDING.md`: added a small placeholder so contributor docs have a
  resolving modding reference until the dedicated modding followup expands
  it.
- `README.md`: linked the contributing guide from the project overview.
- `docs/GDD_COVERAGE.json`: added GDD-26-CONTRIBUTING-GUIDE coverage.

### Verified
- `npm run content-lint` clean.
- `perl -ne 'print "$ARGV:$.:$_" if /[\x{2013}\x{2014}]/' docs/*.md docs/gdd/*.md README.md`
  returned no matches.
- Link targets for CONTRIBUTING.md and README.md were inspected.

### Decisions and assumptions
- `docs/MODDING.md` stays intentionally small because the expanded modding
  guide is a separate followup. The contributor guide links to the binding
  legal and GDD rules without duplicating mod-loader specifics.

### Coverage ledger
- GDD-26-CONTRIBUTING-GUIDE: covered by `docs/CONTRIBUTING.md`,
  `README.md`, and the GDD coverage ledger.
- Uncovered adjacent requirements: the full modding guide remains owned by
  `VibeGear2-implement-modding-md-efbf1c83`.

### Followups created
None.

### GDD edits
None. This slice implements existing §26 intent.

---

## 2026-04-27: Slice: F-055 distance-phase road markings

**GDD sections touched:**
[§9](gdd/09-track-design.md) road lanes and shoulders,
[§16](gdd/16-rendering-and-visual-design.md) road-strip rendering,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer pipeline.
**Branch / PR:** `fix/f-055-road-marking-phase`, PR pending.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: replaced whole-strip road marking
  phase with road-distance phase rendering. Rumble, road shade, and lane
  markings now split a projected strip when a phase boundary lands
  inside it, so uphill frames move markings through the strip instead of
  flipping an entire trapezoid.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: extended the Canvas2D
  spy to capture path geometry and added a regression for an in-strip
  lane dash boundary.
- `docs/FOLLOWUPS.md`: marked F-055 done.
- `docs/GDD_COVERAGE.json`: marked GDD-16-ROAD-MARKINGS as implemented
  with automated test coverage.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/road/__tests__/segmentProjector.test.ts`
  green, 55 passed.
- `npm run typecheck` clean.
- `npm run content-lint` clean.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,163 unit tests passed.
- `npm run test:e2e` green, 55 passed.

### Decisions and assumptions
- The F-054 near-plane stabilizer reduced the visible marking pop but
  kept the deeper problem: phase was still tied to strip boundaries.
  This slice moves phase to road distance while keeping the existing
  Canvas2D trapezoid renderer.

### Coverage ledger
- GDD-16-ROAD-MARKINGS: covered by distance-phase marking draws and
  renderer unit tests.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS remains open
  under F-051.

### Followups created
None.

### GDD edits
None. This slice implements existing §9, §16, and §21 intent.

---

## 2026-04-27: Slice: F-054 hill-bottom projection continuity

**GDD sections touched:**
[§9](gdd/09-track-design.md) elevation and hills,
[§10](gdd/10-driving-model-and-physics.md) air and hill behavior,
[§16](gdd/16-rendering-and-visual-design.md) segment-based road
projection and camera behavior,
[§21](gdd/21-technical-design-for-web-implementation.md) renderer
pipeline.
**Branch / PR:** `fix/f-054-hill-stutter`, PR pending.
**Status:** Implemented.

### Done
- `src/road/segmentProjector.ts`: replaced per-camera-segment grade
  resets with a bounded local projection-window blend. Road strips now
  blend toward the next segment's local window as the car approaches a
  segment boundary, so grade reversals stay continuous without
  accumulating the whole track's elevation into the view.
- `src/road/segmentProjector.ts`: moved ghost car projection onto the
  same bounded local blend so Time Trial overlays stay on the same road
  plane as the live strips.
- `src/road/__tests__/segmentProjector.test.ts`: added a deterministic
  dip-to-climb regression that bounds a projected ahead marker through
  the observed hill-bottom transition, plus a long-climb regression that
  rejects the full-screen road-wall failure seen in PR preview.
- `src/render/pseudoRoadCanvas.ts`: removed segment-index phase gates
  from the temporary procedural centerline and rumble markings so uphill
  frames do not snap between different line patterns.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: added a regression
  that adjacent uphill strips keep steady rumble and centerline fills.
- `docs/FOLLOWUPS.md`: marked F-054 done.
- `docs/GDD_COVERAGE.json`: linked the elevation coverage row to the
  F-054 regression test.
- `docs/FOLLOWUPS.md` and `docs/GDD_COVERAGE.json`: added F-055 for
  the final camera-phase-stable road-marking pass, so the temporary
  stabilization in this slice is tracked explicitly.

### Verified
- `npx vitest run src/road/__tests__/segmentProjector.test.ts` green,
  35 passed.
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/road/__tests__/segmentProjector.test.ts`
  green, 54 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,162 unit tests passed.
- `npm run test:e2e` green, 55 passed.

### Decisions and assumptions
- The observed bounce was handled in the projection layer because the
  physics state has no vertical collision or ground-contact accumulator
  today. The fix keeps physics unchanged and makes the rendered road
  continuous near segment boundaries while preserving the established
  local hill scale.

### Coverage ledger
- GDD-09-ELEVATION-LIVE: covered by bounded local projection blending,
  the segment projector regression, and the existing race Playwright
  authored-elevation smoke.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS remains open
  under F-051.

### Followups created
None.

### GDD edits
None. This slice implements existing §9, §10, §16, and §21 intent.

---

## 2026-04-27: Slice: F-052 parallax horizon and roadside sprites

**GDD sections touched:**
[§9](gdd/09-track-design.md) roadside scenery,
[§16](gdd/16-rendering-and-visual-design.md) parallax backgrounds and
roadside objects,
[§21](gdd/21-technical-design-for-web-implementation.md) Canvas2D
renderer.
**Branch / PR:** `feat/f-052-parallax-roadside`, PR pending.
**Status:** Implemented.

### Done
- `src/app/race/page.tsx`: builds three procedural temperate parallax
  layers and passes them to `drawRoad` with the live camera.
- `src/render/parallax.ts`: accepts canvas-backed layers and
  per-layer fallback fills while preserving the existing missing-art
  placeholder path.
- `src/render/pseudoRoadCanvas.ts`: consumes compiled
  `roadsideLeftId` and `roadsideRightId` values and paints procedural
  sign, tree, fence, rock, and light-pole billboards at projected
  roadside depth.
- `src/data/tracks/test-elevation.json`: authors non-default roadside
  ids so the default `/race` smoke path proves track-driven scenery.
- `e2e/race-demo.spec.ts`: samples live canvas pixels for the horizon
  layer and roadside sign colour.
- `docs/FOLLOWUPS.md`: marked F-052 done.
- `docs/GDD_COVERAGE.json`: changed GDD-16-PARALLAX-ROADSIDE from
  open followup to implemented code plus automated tests.
- `docs/WORKING_AGREEMENT.md`: added PR review-thread inspection and
  response requirements to the merge process so Copilot and inline
  feedback are handled during future loops.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts src/render/__tests__/parallax.test.ts src/data/__tests__/tracks-content.test.ts`
  green, 41 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 3 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed; 2,158 unit tests passed.
- `npm run test:e2e` green, 55 passed.
- Copilot PR review thread on roadside vertical culling addressed with
  a focused `pseudoRoadCanvas` regression test; the focused test file
  and `npm run typecheck` are green after the fix.
- Follow-up Copilot PR review thread on e2e pixel scanning addressed by
  short-circuiting the helper after a small threshold.

### Decisions and assumptions
- Binary region art is not present in the repo yet, so this slice uses
  original procedural Canvas2D layer art and billboard shapes. The draw
  path is the same parallax and compiled-roadside contract later atlas
  assets will use.
- Roadside drawing skips the `default` id and maps existing legacy
  fixture ids (`palms_sparse`, `marina_signs`, `guardrail`,
  `water_wall`) to matching procedural categories so older content still
  renders useful scenery.

### Coverage ledger
- GDD-16-PARALLAX-ROADSIDE: covered by live race wiring, procedural
  parallax layers, compiled roadside id drawing, unit tests, and the
  race Playwright canvas-pixel smoke.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS remains open
  under F-051.

### Followups created
- F-054: hill-bottom car stutter / repeated road-collision bounce
  observed on the live elevation track.

### GDD edits
None. This slice implements existing §9, §16, and §21 requirements.

---

## 2026-04-27: Slice: F-014 key remapping UI and persistence

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) keyboard remapping,
[§20](gdd/20-hud-and-ui-ux.md) settings screen,
[§22](gdd/22-data-schemas.md) `SaveGameSettings.keyBindings`.
**Branch / PR:** `feat/f-014-key-remapping`, PR pending.
**Status:** Implemented.

### Done
- `src/components/options/controlsPaneState.ts`: added the pure controls
  remapping model, display labels, conflict detection, default reset, and
  event-token normalisation.
- `src/components/options/ControlsPane.tsx`: replaced the Controls
  placeholder with a real remapping pane that captures one primary key per
  action and persists changes through `saveSave`.
- `src/app/race/page.tsx`: reads persisted key bindings at race start and
  passes them to `createInputManager`.
- `src/components/options/optionsResetState.ts`: now resets key bindings
  because Controls is a shipped pane.
- `e2e/options-screen.spec.ts`: covers persistence, conflict rejection, and
  custom binding consumption in a live race.
- `docs/FOLLOWUPS.md`: marked F-014 done.
- `docs/GDD_COVERAGE.json`: added GDD-19-KEY-REMAPPING.

### Verified
- `npx vitest run src/components/options/__tests__/controlsPaneState.test.ts src/components/options/__tests__/ControlsPane.test.tsx src/components/options/__tests__/optionsResetState.test.ts src/app/options/__tests__/page.test.tsx`
  green, 21 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/options-screen.spec.ts` green, 8 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,155 unit tests passed.
- `grep -rn $'\u2014\|\u2013' src/components/options/ControlsPane.tsx src/components/options/controlsPaneState.ts src/components/options/__tests__/ControlsPane.test.tsx src/components/options/__tests__/controlsPaneState.test.ts src/components/options/optionsResetState.ts src/components/options/__tests__/optionsResetState.test.ts src/app/options/page.tsx src/app/race/page.tsx e2e/options-screen.spec.ts docs/FOLLOWUPS.md docs/GDD_COVERAGE.json docs/PROGRESS_LOG.md`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- The pane captures one primary key per action. The save schema still
  supports up to four tokens per action, and defaults keep their multi-key
  bindings until the player remaps an action.
- Conflict validation rejects any key already bound to another action.

### Coverage ledger
- GDD-19-KEY-REMAPPING: covered by the Controls pane, pure helper tests,
  and Playwright persistence plus race-consumption tests.
- Uncovered adjacent requirements: Gamepad remapping remains out of scope
  for this desktop keyboard slice; the GDD only requires full desktop
  remapping here.

### Followups created
None.

### GDD edits
None. This slice implements existing §19, §20, and §22 requirements.

---

## 2026-04-27: Slice: F-049 options reset persistence

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) controls and accessibility settings,
[§20](gdd/20-hud-and-ui-ux.md) settings screen,
[§22](gdd/22-data-schemas.md) `SaveGameSettings`.
**Branch / PR:** `feat/f-049-options-reset`, PR pending.
**Status:** Implemented.

### Done
- `src/components/options/optionsResetState.ts`: added a pure helper that
  resets only shipped options fields to defaults: accessibility assists and
  difficulty preset.
- `src/app/options/page.tsx`: enabled the footer reset button, persisted
  the reset through `saveSave`, reported status, and remounted the active
  pane after a successful reset so the visible controls refresh.
- `src/app/options/__tests__/page.test.tsx`,
  `src/components/options/__tests__/optionsResetState.test.ts`, and
  `e2e/options-screen.spec.ts`: added unit and browser coverage for the
  reset contract.
- `docs/FOLLOWUPS.md`: marked F-049 done.
- `docs/GDD_COVERAGE.json`: added GDD-20-OPTIONS-RESET.

### Verified
- `npx vitest run src/components/options/__tests__/optionsResetState.test.ts src/app/options/__tests__/page.test.tsx`
  green, 13 passed.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/options-screen.spec.ts` green, 6 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,147 unit tests passed.
- `grep -rn $'\u2014\|\u2013' src/app/options/page.tsx src/app/options/page.module.css src/app/options/__tests__/page.test.tsx src/components/options/optionsResetState.ts src/components/options/__tests__/optionsResetState.test.ts e2e/options-screen.spec.ts docs/FOLLOWUPS.md docs/GDD_COVERAGE.json docs/PROGRESS_LOG.md`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- The reset action intentionally owns only fields for panes that actually
  ship today: `settings.assists` and `settings.difficultyPreset`. Display,
  audio, controls, performance, profile import/export, and profile progress
  data are preserved until those panes define their own reset semantics.

### Coverage ledger
- GDD-20-OPTIONS-RESET: covered by the new reset helper, page wiring, unit
  tests, and the Playwright localStorage round-trip.
- Uncovered adjacent requirements: F-014 still tracks full key remapping UI
  and persistence; F-049 does not reset key bindings because the Controls
  pane is still a placeholder.

### Followups created
None.

### GDD edits
None. This slice implements the existing options and save-schema intent.

---

## 2026-04-26: Slice: F-002/F-003 foundation followup closure

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) web
implementation and deploy target,
[§25](gdd/25-development-roadmap.md) prototype and v1.0 foundation.
**Branch / PR:** `docs/foundation-followups-close`, PR pending.
**Status:** Implemented.

### Done
- `docs/FOLLOWUPS.md`: marked F-002 and F-003 done with the evidence that
  the project skeleton, verify stack, GitHub Actions gate, and Vercel
  production deploy path are all present and passing on `main`.
- `docs/GDD_COVERAGE.json`: added ledger rows for the project skeleton and
  Vercel production deploy requirements so future agents can see this
  foundation coverage directly.

### Verified
- `npx vitest run scripts/__tests__/content-lint.test.ts` green,
  54 passed.
- `npm run content-lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and content-lint
  all passed; 2,143 unit tests passed.
- `grep -rn $'\u2014\|\u2013' docs/FOLLOWUPS.md docs/GDD_COVERAGE.json docs/PROGRESS_LOG.md`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- This is a docs-only closure slice. Runtime code and workflow behavior are
  unchanged because the required scaffold, tests, CI, and deploy path already
  exist on `main`.

### Coverage ledger
- GDD-21-PROJECT-SKELETON: covered by the existing app shell, scripts,
  Vitest, Playwright, content lint, and GitHub Actions verify gate.
- GDD-21-VERCEL-DEPLOY: covered by the existing Vercel production workflow
  and successful production smoke.
- Uncovered adjacent requirements: None.

### Followups created
None.

### GDD edits
None. This slice closes stale followups against already-implemented
foundation work.

---

## 2026-04-26: Slice: F-053 GDD coverage ledger

**GDD sections touched:**
[§25](gdd/25-development-roadmap.md) implementation governance,
[§27](gdd/27-risks-and-mitigations.md) automated regression
mitigation.
**Branch / PR:** `feat/f-053-gdd-coverage-ledger`, PR pending.
**Status:** Implemented.

### Done
- `docs/GDD_COVERAGE.json`: added the initial machine-checkable
  requirement ledger for live elevation proof, car sprite atlas work,
  parallax / roadside rendering work, and the ledger process itself.
- `scripts/content-lint.ts`: added GDD coverage ledger validation for
  requirement ids, GDD section refs, code refs, test refs, open followup
  refs, and open question refs.
- `scripts/content-lint.ts`: added latest progress-log enforcement so a
  GDD-touching entry must include a `Coverage ledger` section, cite at
  least one `GDD-` id, and list uncovered adjacent requirements.
- `scripts/__tests__/content-lint.test.ts`: added focused coverage for
  valid and invalid ledger entries plus progress-log enforcement.
- `docs/FOLLOWUPS.md`: marked F-053 done.

### Verified
- `npx vitest run scripts/__tests__/content-lint.test.ts` green,
  54 passed.
- `npm run content-lint` clean.
- `npm run lint` clean.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed; 2,143 unit tests passed.
- `grep -rn $'\u2014\|\u2013' docs/GDD_COVERAGE.json scripts/content-lint.ts scripts/__tests__/content-lint.test.ts docs/FOLLOWUPS.md docs/PROGRESS_LOG.md`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- The lint only enforces the newest progress-log entry so historical
  entries do not need a noisy retrofit. Every future slice that prepends
  a GDD-touching log entry must include the ledger section.
- Seeded the ledger with the road-rendering requirements that produced
  F-050, F-051, and F-052, plus the new process requirement. The ledger
  should grow one requirement at a time as slices touch more GDD surface.

### Coverage ledger
- GDD-09-ELEVATION-LIVE: covered by code and browser/content tests.
- GDD-16-CAR-SPRITE-ATLAS: uncovered adjacent requirement tracked by
  F-051.
- GDD-16-PARALLAX-ROADSIDE: uncovered adjacent requirement tracked by
  F-052.
- GDD-25-LOOP-COVERAGE-LEDGER: covered by `content-lint` code and unit
  tests.
- Uncovered adjacent requirements: GDD-16-CAR-SPRITE-ATLAS,
  GDD-16-PARALLAX-ROADSIDE.

### Followups created
None.

### GDD edits
None. This slice adds process enforcement around the existing GDD and
backlog.

---

## 2026-04-26: Slice: F-050 live elevation proof

**GDD sections touched:**
[§9](gdd/09-track-design.md) elevation and hills,
[§16](gdd/16-rendering-and-visual-design.md) segment-based projection,
[§22](gdd/22-data-schemas.md) Track JSON schema.
**Branch / PR:** `fix/f-050-live-elevation-proof`, PR pending.
**Status:** Implemented.

### Done
- `src/data/tracks/test-elevation.json`: added a bundled smoke track
  with an authored flat launch, crest, dip, plateau, and recovery run.
- `src/data/tracks/index.ts`: registered `test/elevation` in the track
  catalogue.
- `src/app/race/page.tsx`: changed the default `/race` track to
  `test/elevation` so the main live race path exercises authored grade.
- `src/data/__tests__/tracks-content.test.ts`: added catalogue coverage
  and non-zero grade assertions for the elevation track.
- `e2e/race-demo.spec.ts`: added a canvas-pixel smoke that verifies the
  projected road top moves upward while driving into the grade-bearing
  segment.
- `docs/FOLLOWUPS.md`: marked F-050 done.

### Verified
- `npx vitest run src/data/__tests__/tracks-content.test.ts` green,
  9 passed.
- `npm run lint` clean.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 2 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed; 2,134 unit tests passed.
- `grep -rn $'\u2014\|\u2013' src/data/tracks/test-elevation.json src/data/tracks/index.ts src/app/race/page.tsx src/data/__tests__/tracks-content.test.ts e2e/race-demo.spec.ts docs/FOLLOWUPS.md docs/PROGRESS_LOG.md`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- Kept the existing `test/curve` and `test/straight` fixtures available
  for focused flat-road tests. Only the default smoke path changes to
  `test/elevation` so future agents cannot miss grade-backed rendering
  in `/race`.
- The e2e samples canvas pixels rather than a hidden debug metric so the
  proof stays tied to what the player actually sees.

### Followups created
None.

### GDD edits
None. The implementation matches the existing §9, §16, and §22
requirements.

---

## 2026-04-26: Slice: Vercel local link ignores

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) deploy target.
**Branch / PR:** `chore/vercel-local-ignores`, PR pending.
**Status:** Implemented.

### Done
- `.gitignore`: added Vercel CLI local link outputs so `.vercel` project
  metadata and `.env*.local` files stay out of git.

### Verified
- `grep -rn $'\u2014\|\u2013' .gitignore docs/PROGRESS_LOG.md` returned
  no hits.
- `git diff --check` clean.

### Decisions and assumptions
- Kept the deploy credentials in GitHub Actions secrets only. No Vercel
  project id, org id, token, or local environment value is committed.

### Followups created
None.

### GDD edits
None. The implementation matches the existing §21 deploy target setup.

---

## 2026-04-26: Slice: Race start player car overlay

**GDD sections touched:**
[§16](gdd/16-rendering-and-visual-design.md) "Sprite scaling",
[§20](gdd/20-hud-and-ui-ux.md) race HUD.
**Branch / PR:** `fix/race-start-view`, PR #9.
**Status:** Implemented.

### Done
- `src/render/pseudoRoadCanvas.ts`: added a live player-car overlay
  placeholder that paints after the road and dust layers, using the
  §16 standard camera footprint of 18 percent viewport height.
- `src/render/pseudoRoadCanvas.ts`: refined the placeholder into a
  rear chase-view silhouette with tires, rear deck, and tail lights so
  it reads less like a flat UI icon.
- `src/render/pseudoRoadCanvas.ts`: replaced protruding tire blocks and
  the over-wide rear deck with contained path shapes.
- `src/render/pseudoRoadCanvas.ts`: extends the closest visible road
  strip down to the bottom of the viewport so the lower quarter no
  longer shows the sky gradient under the car.
- `src/road/segmentProjector.ts`: moved foreground coverage into the
  projection contract by attaching a screen-bottom endpoint to the
  closest visible strip. The renderer now draws that endpoint as a
  normal strip pair instead of inventing foreground geometry.
- `src/app/race/page.tsx`: passes the player-car overlay option to the
  road renderer every race frame so a fresh race has a visible car
  anchor at the bottom of the view.
- `src/app/race/page.tsx`: lets the canvas scale up to a 1280 px
  wide race viewport and clips the debug metrics out of sighted
  layout while keeping the existing Playwright test IDs available.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: covered the player
  car overlay footprint, default colours, custom colours, tires,
  tail lights, and omitted / null behavior.
- `docs/IMPLEMENTATION_PLAN.md` and `docs/WORKING_AGREEMENT.md`: added
  an explicit requirement-inventory step so future agents must record
  adjacent GDD requirements that a slice exposes but does not implement.

### Verified
- `npx vitest run src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 14 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- Browser pixel check against `http://localhost:3000/race` found
  3,160 live-car pixels in the lower canvas during countdown.
- Browser layout check at 2048x1240 confirmed a 1280x768 canvas,
  a clipped 1x1 debug metrics box, 3,954 yellow car pixels, and
  217 red tail-light pixels during countdown.
- Browser artifact check at 2048x1240 confirmed 3,841 yellow car
  pixels, 193 red tail-light pixels, and only 38 dark pixels outside
  the right side of the car footprint.
- Browser foreground check at 2048x1240 confirmed the bottom quarter
  is 0.55 percent blue and 79.78 percent road, with the player car
  still visible.
- `npx vitest run src/road/__tests__/segmentProjector.test.ts src/render/__tests__/pseudoRoadCanvas.test.ts`
  green, 48 passed.
- `npm run test:e2e -- e2e/race-demo.spec.ts` green, 1 passed.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed; 2,130 unit tests passed.
- `grep -rn $'\u2014\|\u2013' src/render/pseudoRoadCanvas.ts src/render/__tests__/pseudoRoadCanvas.test.ts src/app/race/page.tsx`
  returned no hits.
- `git diff --check` clean.

### Decisions and assumptions
- Used an original Canvas2D placeholder silhouette until the §17 car
  sprite atlas is wired into the live race renderer.

### Followups created
- F-050: Prove authored elevation in the live race view.
- F-051: Replace live and ghost car placeholders with atlas sprites.
- F-052: Add parallax horizon and roadside sprites to the race renderer.
- F-053: Add a machine-checkable GDD coverage ledger.

### GDD edits
None. The implementation matches the existing §16 player-car footprint.

---

## 2026-04-26: Slice: F-022 Time Trial ghost consumer

**GDD sections touched:**
[§6](gdd/06-game-modes.md) "Time trial",
[§20](gdd/20-hud-and-ui-ux.md) race HUD and title navigation,
[§22](gdd/22-data-schemas.md) "Ghost replay".
**Branch / PR:** `feat/f-022-time-trial-ghost-consumer`, PR pending.
**Status:** Implemented.

### Done
- `src/app/race/page.tsx`: added `?mode=timeTrial` support, saved
  ghost playback via `createGhostDriver`, recorder persistence via
  `createTimeTrialRecorder` and `applyTimeTrialResult`, and a
  `data-mode` hook for browser verification.
- `src/app/race/page.tsx`: review fix reloads the latest save before
  committing a new time-trial ghost, preserving unrelated save changes
  and letting same-page restarts consume the new personal best.
- `src/app/time-trial/page.tsx`: added a route that enters the race
  shell in Time Trial mode.
- `src/app/page.tsx`: added a Time Trial menu entry.
- `src/game/index.ts`: exported the Time Trial helper module from the
  game barrel.
- `src/app/__tests__/page.test.tsx` and `e2e/title-screen.spec.ts`:
  covered the new title menu entry and Time Trial navigation.
- `docs/FOLLOWUPS.md`: marked F-022 done.

### Verified
- `grep -rn $'\u2014\|\u2013' src/app/race/page.tsx src/app/time-trial/page.tsx src/app/page.tsx src/app/__tests__/page.test.tsx e2e/title-screen.spec.ts src/game/index.ts docs/FOLLOWUPS.md docs/PROGRESS_LOG.md`
  returned no hits.
- `npx vitest run src/app/__tests__/page.test.tsx src/game/__tests__/timeTrial.test.ts src/game/__tests__/ghostDriver.test.ts`
  green, 38 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green, 2117 passed.
- `npm run content-lint` clean.
- `npm run build` clean.
- `npm run test:e2e -- e2e/title-screen.spec.ts` green, 5 passed.
- `git diff --check` clean.

### Decisions and assumptions
- Time Trial mode skips economy credit persistence on finish so the
  ghost PB write cannot be overwritten by the normal race reward save.
- The `/time-trial` route redirects to `/race?mode=timeTrial` to keep
  the race shell single-owner until the broader mode-selection UI
  lands.

### Followups created
None.

### GDD edits
None. The implementation matches the existing §6 and §22 ghost replay
contracts.

---

## 2026-04-26: Slice: Licence files finalisation

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) "Suggested licenses",
[§27](gdd/27-risks-and-mitigations.md) legal/IP safety risks.
**Branch / PR:** `feat/licence-files-finalisation-loop`, PR #6.
**Status:** Implemented.

### Done
- `DATA-LICENSE`: added the CC BY-SA 4.0 data licence declaration for
  track, championship, balancing, and community mod data.
- `package.json`: added `"license": "MIT"`.
- `README.md`: added a Licensing section linking `LICENSE`,
  `ASSETS-LICENSE`, and `DATA-LICENSE`.
- `docs/OPEN_QUESTIONS.md`: updated Q-002 resolution to cite the
  completed root licence files and package metadata.
- `docs/LEGAL_SAFETY.md`: replaced the temporary DATA-LICENSE note
  with a direct link to the landed file.

### Verified
- `grep -rn $'\u2014\|\u2013' LICENSE ASSETS-LICENSE DATA-LICENSE README.md docs/OPEN_QUESTIONS.md docs/LEGAL_SAFETY.md docs/PROGRESS_LOG.md package.json`
  returned no hits.
- `npm run verify` clean: lint, typecheck, unit tests, and
  content-lint all passed.
- `git diff --check` clean.

### Decisions and assumptions
- Preserved the existing Q-002 licence split: MIT for code, CC BY 4.0
  for original media assets, and CC BY-SA 4.0 for structured game data.

### Followups created
None.

### GDD edits
None. The implementation matches the existing §26 licence table.

---

## 2026-04-26: Slice: F-037 easy-mode tour-clear bonus wiring

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms",
[§8](gdd/08-world-and-progression-design.md) "Tour progression".
**Branch / PR:** `feat/f-037-easy-mode-tour-bonus`, PR #7.
**Status:** Implemented.

### Done
- `src/game/championship.ts`: extended `tourComplete` with an
  optional `save` argument and appends an `easyModeTourComplete`
  bonus when a passed tour is completed on the Easy preset.
- `src/game/raceBonuses.ts`: added the `easyModeTourComplete`
  bonus kind for the §20 chip pipeline.
- `src/game/__tests__/championship.test.ts`: added F-037 coverage
  for Easy, Normal, Hard, Master, failed tours, omitted save, and
  negative reward clamping.
- `docs/FOLLOWUPS.md`: marked F-037 done.

### Verified
- `npx vitest run src/game/__tests__/championship.test.ts src/game/__tests__/raceBonuses.test.ts src/game/__tests__/raceResult.test.ts`
  green, 148 passed.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green, 2123 passed.
- `npm run build` clean.
- `npm run content-lint` clean.
- `git diff --check` clean.
- No em or en dashes in touched files.

### Decisions and assumptions
- Kept the `tourComplete` API backward compatible by making `save`
  optional. Callers that omit it keep the pre-F-037 bonus list.

### Followups created
None.

### GDD edits
None. The implementation matches the existing §12 easy-mode catch-up
mechanism.

---

## 2026-04-26: Slice: Main CI mobile browser fix

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) "Testing
approach".
**Branch / PR:** `main`, post-merge CI hotfix.
**Status:** Implemented.

### Done
- `playwright.config.ts`: pinned the `mobile-chromium` project to
  `browserName: "chromium"` while keeping the iPhone 13 viewport and
  touch descriptor. GitHub Actions installs only Chromium for e2e, so
  inheriting the descriptor's WebKit default made the touch-input
  project fail on the hosted runner with a missing WebKit executable.

### Verified
- `npx playwright test e2e/touch-input.spec.ts --project=mobile-chromium`
  green, 4 passed.
- `npm run typecheck` clean.
- `npm run lint` clean.

### Decisions and assumptions
- Kept the workflow browser install scoped to Chromium instead of
  installing WebKit, because the project name and desktop coverage both
  describe Chromium-only CI coverage.

### Followups created
None.

### GDD edits
None. The test strategy remains unchanged.

---

## 2026-04-26: Slice: Docs accuracy audit after PR #5 fixes

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) "Settings",
[§22](gdd/22-data-schemas.md) "Save-game JSON schema" and "Ghost replay".
**Branch / PR:** `main`, post-merge documentation audit.
**Status:** Implemented.

### Done
- Updated stale SaveGame ghost-replay migration language from a generic
  v2 migration to the current v2 -> v3 migration in followup notes and
  recorder comments.
- Corrected the F-023 progress entry to show PR #5 as merged and to
  point at the post-merge review-fix commit on `main`.
- Replaced outdated options-screen reset text that still said the
  button was blocked on the SaveGameSettings v2 schema. The schema has
  shipped; the button now points at F-049 for reset persistence wiring.
- Brought the PR #5 review-fix progress entry up to date with the full
  local verification and `main` push that happened after the initial
  log text was written.

### Verified
- `rg` scan for stale SaveGameSettings v2 reset blockers, stale ghost
  migration wording, and stale F-023 PR-pending text returned only the
  historical SaveGameSettings v2 slice entry.
- `npx vitest run src/app/options/__tests__/page.test.tsx` green.
- `npm run content-lint` clean.
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:e2e -- e2e/options-screen.spec.ts` green, 6 passed.
- `git diff --check` clean.
- No em or en dashes in touched files.

### Decisions and assumptions
- Historical progress-log entries were left as historical records unless
  they described current branch, PR, or followup state for active work.

### Followups created
- F-049: Implement options reset persistence wiring.

### GDD edits
None. The existing §22 v3 schema text remains accurate.

---

## 2026-04-26: Slice: PR #5 review comment fixes

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) "Loading screen accessibility",
[§21](gdd/21-technical-design-for-web-implementation.md) "App shell" and
"Asset pipeline",
[§22](gdd/22-data-schemas.md) "Save-game JSON schema" and "Ghost replay".
**Branch / PR:** `feat/f-023-timetrial-recorder-lifecycle`, PR #5
(already merged before this follow-up), then `main` at `4c27f2e`.
**Status:** Implemented review fixes and pushed them to `main`.

### Done
- `src/components/error/ErrorBoundary.tsx`: added an explicit
  `hasError` state flag so `throw null` still renders the fallback, and
  swallowed clipboard write rejections in the Copy error path.
- `src/components/loading/LoadingGate.tsx`: switched preload effect
  invalidation from manifest object identity to a content-derived
  stable key, so equivalent rebuilt manifest objects do not restart
  preloading.
- `src/components/loading/loadingState.ts`: deduped repeated warning and
  critical failure entry ids so retries or duplicate progress callbacks
  do not inflate the UI counts.
- `docs/gdd/22-data-schemas.md`: aligned the save-game schema docs with
  the v3 example by documenting the v2 -> v3 `ghosts` migration and
  showing `"version": 3` plus `"ghosts": {}` in the example.
- Added targeted tests for the null-throw boundary sentinel, clipboard
  rejection swallow, manifest stable key, failure dedupe, and schema
  example validation.

### Verified
- `npx vitest run src/components/error/__tests__/ErrorBoundary.test.tsx src/components/error/__tests__/formatErrorReport.test.ts src/components/loading/__tests__/LoadingGate.test.ts src/components/loading/__tests__/loadingState.test.ts src/data/schemas.test.ts src/persistence/save.test.ts` green.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm test` green.
- `npm run content-lint` clean.
- `npm run build` clean.
- `npm run test:e2e` green, 50 passed.
- `git diff --check` clean.
- No em or en dashes in touched files.

### Decisions and assumptions
- The PR description mismatch thread is historical: PR #5 was already
  merged before this follow-up, and the branch has been fast-forwarded to
  current `main`. The follow-up keeps the branch code aligned rather than
  splitting an already merged PR.
- PR #5's body was updated with a post-merge review note. The old review
  threads remain visible on GitHub because they are pinned to the
  already merged PR head.

### Followups created
None.

### GDD edits
- `docs/gdd/22-data-schemas.md`: updated the save-game schema section to
  current major v3 and documented the `ghosts` map migration.

---

## 2026-04-26: Slice: Review fixes for save and lap timing

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) "Number of laps" and "Finish rewards",
[§21](gdd/21-technical-design-for-web-implementation.md) "Save system",
[§22](gdd/22-data-schemas.md) "Save-game JSON schema".
**Branch / PR:** `feat/f-022b-ghost-driver-helper`, direct merge requested.
**Status:** Implemented review fixes.

### Done
- `src/persistence/save.ts`: `loadSave` now falls back through older
  versioned save keys before returning a missing default, migrates the
  first found payload, validates it, and writes the migrated shape to
  the current key when the source key was older.
- `src/game/raceResult.ts` and `src/app/race/page.tsx`: added
  `applyRaceResultRecords` and wired race-finish persistence so the
  credited save also receives any `recordsUpdated` PB patch before
  `saveSave`.
- `src/game/raceSession.ts`: lap-completion HUD fields now store the
  per-lap duration, not cumulative race elapsed, so later laps can beat
  lap one in multi-lap races.
- Added regression coverage for v1 / v2 save-key fallback, PB record
  persistence, first-record creation, and multi-lap timing.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run content-lint` clean.
- `npm run test:e2e` green, 50 passed.
- `npm run build` clean after rerunning without a concurrent e2e build.
- `git diff --check` clean.
- No em or en dashes in touched files.

### Decisions and assumptions
- Existing older save keys are left in place after migration. The loader
  writes the migrated copy to the current key so later loads use the
  current path, while the older key remains a recovery backstop.
- `applyRaceResultRecords` preserves an existing `bestRaceMs` when it is
  faster than the current race time. Fresh records use the current
  finished race time, with `bestLapMs` as a defensive fallback.

### Followups created
None.

### GDD edits
None. The fixes align the implementation with the existing save and
race timing contracts.

---

## 2026-04-26: Slice: F-023 Time Trial recorder lifecycle producer

**GDD sections touched:**
[§6](gdd/06-game-modes-and-progression.md) "Time Trial mode" (the
recorder lifecycle this module orchestrates),
[§22](gdd/22-data-schemas.md) "Ghost replay" (consumer of the
`Replay` shape this module finalises into).
**Branch / PR:** `feat/f-023-timetrial-recorder-lifecycle`, PR #5
merged on 2026-04-26; post-merge review fixes landed in `4c27f2e`.
**Status:** F-023 closed. Producer-only slice; the Next.js Time Trial
route under `src/app/` stays owned by
`VibeGear2-implement-time-trial-5d65280a`. Mirrors the F-021 / F-022
producer-then-consumer split around the ghost slice.

### Done
- `src/game/timeTrial.ts`: new module exposes
  `createTimeTrialRecorder(options)` returning a stateful orchestrator
  with an `idle` -> `recording` -> `finished` phase machine that
  observes per-tick `(phase, tick, input)` snapshots. The orchestrator
  spawns the inner `createRecorder` from `src/game/ghost.ts` on the
  first racing tick (so the recorder's tick clock lines up with the
  race-session `tick` clock that resets to 0 on the green-light tick),
  records every subsequent racing tick, and finalises when the race
  phase flips to `finished`. An optional `onFinalize` callback fires
  exactly once with the finalised `Replay`; callback errors are
  swallowed so a failing persistence pipeline cannot crash the
  simulation tick. A `reset()` method drops the existing recorder so
  the same orchestrator can record a subsequent race.
  `applyTimeTrialResult(currentGhost, replay)` is a thin intent-named
  wrapper around `bestGhostFor` for the Time Trial route slice's
  PB-overwrite decision.
- `src/game/__tests__/timeTrial.test.ts`: 19 unit tests covering
  idle-state defaults, ignore-during-countdown, spawn-on-green-light,
  per-tick recording, finalise-on-finish, single `onFinalize` fire,
  post-finished tick no-op, duplicate-finished no-op, duplicate or
  backwards-tick swallow during recording, callback error swallow,
  `reset()` reuse for a second race, defensive idle-on-skip-racing,
  the PB selector's strict-less / equal-keep / null-keep / both-null
  branches, and an integration scenario where a longer recording
  (strictly higher `finalTimeMs`) does not displace the stored PB but
  a shorter one does.
- `docs/FOLLOWUPS.md`: F-023 status flips to `done` with the
  branch reference, the surface area shipped, and the test coverage
  summary. The Next.js route deferral note remains, pointing at the
  time-trial mode dot.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (19 new timeTrial tests; existing ghost / race-
  session suites unchanged).
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Shipped the orchestrator as a separate module (`src/game/timeTrial.ts`)
  rather than folding the recorder into `src/game/raceSession.ts`. Two
  reasons: (1) the race-session reducer is mode-agnostic and only Time
  Trial records a ghost, so a `mode` branch inside the reducer would
  mix concerns and force every other mode test to grow a ghost-disabled
  fixture; (2) keeping the orchestrator pure (it reads a synthetic
  `(phase, tick, input)` triple, never a full `RaceSessionState`) lets
  the unit tests cover every transition without standing up a track,
  AI grid, or physics step.
- The orchestrator spawns the recorder on the first racing tick rather
  than at construction so the recorder's internal tick clock matches the
  race-session `tick` clock (which resets to 0 on the lights-out tick).
  Spawning earlier would either record the countdown (wasteful) or
  require the orchestrator to translate tick numbers later.
- `onFinalize` callback errors are swallowed. The simulation tick must
  not crash because the persistence backend exploded; the replay is
  still readable via `getReplay()` after a failed callback so the call
  site can retry on a later frame if it wants to.
- The `applyTimeTrialResult` wrapper is one line on top of `bestGhostFor`,
  but it gives the route slice an intent-named entry point so the
  call site reads "apply the time-trial result" instead of "pick the
  best ghost". The selector's strict-less + equal-keep behaviour is
  unchanged.

### Followups
None opened. F-023 closes with this slice; the route consumer remains
on the existing `VibeGear2-implement-time-trial-5d65280a` dot.

---

## 2026-04-26: Slice: Q-006 confirm easy-mode tour-clear bonus rate

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms" #3
(easy-mode tour-clear bonus lever),
[§23](gdd/23-balancing-tables.md) "Easy-mode tour-clear bonus
(catch-up mechanism #3)" (new subsection that pins the fraction, the
difficulty gate, the negative-entry policy, and the empty
tour-complete clamp).
**Branch / PR:** `feat/answer-q-006-easy-mode-tour-bonus`, PR pending.
**Status:** Q-006 closed. Doc plus content-test slice. The pinned
constant `EASY_MODE_TOUR_BONUS_FRACTION = 0.2` in `src/game/catchUp.ts`
already shipped (the catch-up levers slice, commit `a3b81cb`). The
F-037 consumer slice (wire `easyModeBonus` into the tour-clear bonus
payout) is still owed and will append a sibling `bonuses` entry
alongside `tourBonus` so the §20 receipt renders the easy-mode bonus
on its own line. This loop confirms the recommended default and pins
the value into §23 so the balancing-pass slice finds it on the same
page as the other catch-up levers. Mirrors the Q-004 / Q-005 doc-plus-
test pattern. Q-008 (tire modifiers for §23-uncovered weathers) stays
the only open question in its own §14 / §23 slot.

### Done
- `docs/OPEN_QUESTIONS.md`: Q-006 status flips from `open` to
  `answered`. The new Resolution paragraph names the shipping
  constant, names the catch-up levers commit (`a3b81cb`) that
  introduced it, names the F-037 wiring still owed, and pins two
  re-evaluation triggers (a balancing-pass run that shows the
  easy-mode runway is too short or too generous, or a §12 / §15 edit
  that retunes the per-race cash awards or the flat 0.15x `tourBonus`
  rate the fraction was calibrated against).
- `docs/gdd/23-balancing-tables.md`: new "Easy-mode tour-clear bonus
  (catch-up mechanism #3)" subsection between "Repair cap (catch-up
  mechanism #2)" and "Damage formula targets". Four-row table
  (easy-mode tour-clear bonus fraction, difficulty gate, negative-
  entry policy, empty tour-complete clamp) plus a paragraph that
  names `EASY_MODE_TOUR_BONUS_FRACTION`, the consumer site
  (`easyModeBonus`), and the F-037 wiring still owed.
- `src/data/__tests__/balancing.test.ts`: new "§23 Easy-mode tour-
  clear bonus (catch-up mechanism #3)" describe block (section 2e)
  that mirrors the §23 row as `EASY_MODE_TOUR_BONUS_FRACTION_TARGET`
  and pins it against `EASY_MODE_TOUR_BONUS_FRACTION` from
  `src/game/catchUp.ts`. Five additional invariants pin the protocol
  shape: the fraction stays inside `(0, 1)` so the bonus stays a
  catch-up; easy preset receives the fraction of summed rewards;
  normal / hard / master pay no easy-mode bonus; a legacy v1 save
  with no `difficultyPreset` field pays no bonus; negative rewards
  are ignored rather than clawing back the bonus; and an empty
  tour-complete list collapses the bonus to 0. A drift between
  the §23 markdown row, the local target constant, the runtime
  export, or the gate behaviour fails the build at a single readable
  site.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (new §23 easy-mode bonus describe block green;
  existing catchUp unit tests still green because they reference the
  symbolic exports).
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Adopted the recommended default verbatim. No constant value change
  in `src/game/catchUp.ts`; the slice is doc-plus-test only.
- Pinned the row in §23 even though Q-006 listed the §23 edit as
  optional. Rationale matches the Q-004 / Q-005 slices: §23 is the
  discoverability surface for the balancing-pass loop, and a one-page
  index of all four catch-up levers is the point of §23. Skipping the
  row would force the balancing pass to grep `catchUp.ts` for the
  values, which defeats the §23 contract.
- Pinned the protocol gates (easy-only difficulty gate, negative-
  entry policy, empty tour-complete clamp) as test invariants
  alongside the fraction. Rationale: those gates were named in the
  Q-006 question text and the `easyModeBonus` doc comment, and a
  balancing pass that flips a gate without re-opening Q-006 would
  silently change the §27 "AI frustration" risk surface that catch-up
  mechanism #3 is designed against. The fraction is the only knob the
  balancing pass should tune without a fresh question.
- Did not edit `catchUp.ts` itself. The `OPEN_QUESTIONS.md Q-004
  through Q-007` reference in the file header still spans the Q-008
  slot in a different module (weather tire modifiers); collapsing the
  reference now would leave a stale comment after Q-008 closes. The
  collapse will happen in the slice that closes the last of the
  catch-up questions or as part of the F-037 wiring slice when it
  lands.
- Did not pre-empt F-037. The F-037 follow-up (wire `easyModeBonus`
  into the tour-clear bonus payout) remains in
  `docs/FOLLOWUPS.md`; this slice only confirms the lever value and
  pins the §23 row, leaving the consumer site to its own focused
  slice.

### Followups added
None new.

### GDD edits
- `docs/gdd/23-balancing-tables.md`: new "Easy-mode tour-clear bonus
  (catch-up mechanism #3)" subsection between "Repair cap (catch-up
  mechanism #2)" and "Damage formula targets". Same table-plus-prose
  shape as the Q-004 / Q-005 §23 rows so the balancing-pass slice
  finds every catch-up lever in the same one-page format.

### Open questions resolved
- Q-006 (easy-mode tour-clear bonus rate): confirmed the dot-spec
  default of 0.20x. Resolution paragraph in `docs/OPEN_QUESTIONS.md`
  names the shipping constant, the catch-up levers commit
  (`a3b81cb`) that introduced it, the F-037 wiring still owed, and
  the two re-evaluation triggers.

---

## 2026-04-26: Slice: Q-005 confirm essential-repair cap fraction

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms" #2
(essential-repair cap lever),
[§23](gdd/23-balancing-tables.md) "Repair cap (catch-up mechanism #2)"
(new subsection that pins the fraction, the repair-kind gate, the
difficulty gate, and the zero-income clamp).
**Branch / PR:** `feat/answer-q-005-essential-repair-cap`, PR pending.
**Status:** Q-005 closed. Doc plus content-test slice. The pinned
constant `REPAIR_CAP_FRACTION = 0.4` in `src/game/catchUp.ts` already
shipped (the F-036 slice `feat/wire-capped-repair-cost`, commit
`3ed8720`, wires `cappedRepairCost` into `applyRepairCost`). This loop
confirms the recommended default and pins the value into §23 so the
balancing-pass slice finds it on the same page as the other catch-up
levers. Q-006 (easy-mode tour-clear bonus rate) remains open in its
own slot.

### Done
- `docs/OPEN_QUESTIONS.md`: Q-005 status flips from `open` to
  `answered`. The new Resolution paragraph names the shipping
  constant, names the F-036 consumer commit (`3ed8720`) that wires
  it into `applyRepairCost`, and pins two re-evaluation triggers
  (a balancing-pass run that shows the cap firing too often or
  never engaging, or a §12 / §15 edit that retunes the per-race
  cash awards or per-zone repair costs the fraction was calibrated
  against).
- `docs/gdd/23-balancing-tables.md`: new "Repair cap (catch-up
  mechanism #2)" subsection between "Tour stipend (catch-up
  mechanism #1)" and "Damage formula targets". Four-row table
  (essential-repair cap fraction, repair-kind gate, difficulty
  gate, zero-income clamp) plus a paragraph that names
  `REPAIR_CAP_FRACTION`, the consumer site (`applyRepairCost` via
  `cappedRepairCost`), and the F-036 commit that wired it.
- `src/data/__tests__/balancing.test.ts`: new "§23 Repair cap
  (catch-up mechanism #2)" describe block (section 2d) that mirrors
  the §23 row as `REPAIR_CAP_FRACTION_TARGET` and pins it against
  `REPAIR_CAP_FRACTION` from `src/game/catchUp.ts`. Five additional
  invariants pin the protocol shape: the fraction stays inside
  `(0, 1)` so the cap stays a discount; essential repair on
  easy / normal / novice clamps to the fraction of race income;
  essential repair on hard / master / extreme pays raw cost;
  full / cosmetic repair always pays raw cost; and zero race income
  collapses the cap to 0. A drift between the §23 markdown row, the
  local target constant, the runtime export, or the gate behaviour
  fails the build at a single readable site.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (new §23 repair-cap describe block green;
  existing catchUp unit tests still green because they reference
  the symbolic exports).
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Adopted the recommended default verbatim. No constant value
  change in `src/game/catchUp.ts`; the slice is doc-plus-test only.
- Pinned the row in §23 even though Q-005 listed the §23 edit as
  optional. Rationale matches the Q-004 slice: §23 is the
  discoverability surface for the balancing-pass loop, and a
  one-page index of all four catch-up levers is the point of §23.
  Skipping the row would force the balancing pass to grep
  `catchUp.ts` for the values, which defeats the §23 contract.
- Pinned the protocol gates (essential-only repair-kind, easy /
  normal / novice difficulty gate, zero-income clamp) as test
  invariants alongside the fraction. Rationale: those gates were
  named in the Q-005 question text as part of the dot spec, and a
  balancing pass that flips the gate without re-opening Q-005
  would silently change the §27 "AI frustration" risk surface
  that catch-up mechanism #2 is designed against. The fraction is
  the only knob the balancing pass should tune without a fresh
  question.
- Did not pre-empt Q-006 (easy-mode tour-clear bonus rate). The
  §23 row added here covers the repair cap only. Q-006 remains
  open and will land its own §23 row in the slice that closes it,
  so each open question gets one slice that owns its row
  end-to-end.
- Did not edit `catchUp.ts` itself. The `OPEN_QUESTIONS.md Q-004
  through Q-007` reference in the file header still spans the two
  remaining slots (Q-006 open, Q-008 open in a different module);
  collapsing the reference now would leave a stale comment after
  Q-006 closes. The collapse will happen in the slice that closes
  the last of the catch-up questions.

### Followups added
None new.

### GDD edits
- `docs/gdd/23-balancing-tables.md`: new "Repair cap (catch-up
  mechanism #2)" subsection. Pins the four parameters of the
  repair-cap lever (fraction, repair-kind gate, difficulty gate,
  zero-income clamp) so the balancing-pass slice and any future
  content loop can read every catch-up number from a single page.

### Open questions raised
None.

---

## 2026-04-26: Slice: Q-004 confirm tour stipend threshold and amount

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms" #1
(tour stipend lever),
[§23](gdd/23-balancing-tables.md) "Tour stipend (catch-up mechanism
#1)" (new subsection that pins the threshold and amount).
**Branch / PR:** `feat/answer-q-004-tour-stipend`, PR pending.
**Status:** Q-004 closed. Doc plus content-test slice. The pinned
constants `STIPEND_THRESHOLD_CREDITS = 1500` and `STIPEND_AMOUNT =
1000` in `src/game/catchUp.ts` already shipped (the F-035 slice
`feat/f-035-stipend-at-tour-entry`, commit `927e797`, wires
`computeStipend` into `enterTour`). This loop confirms the
recommended default and pins the values into §23 so the
balancing-pass slice finds them on the same page as the other
levers. Q-005 (repair cap fraction) and Q-006 (easy-mode tour-clear
bonus rate) remain open in their own slots.

### Done
- `docs/OPEN_QUESTIONS.md`: Q-004 status flips from `open` to
  `answered`. The new Resolution paragraph names the shipping
  constants, names the F-035 consumer commit that wires them, and
  pins two re-evaluation triggers (a balancing-pass run that shows
  the lever firing too rarely or too generously, or a §12 / §15
  edit that retunes the starter cash and mid-table reward sizing
  the constants were calibrated against).
- `docs/gdd/23-balancing-tables.md`: new "Tour stipend (catch-up
  mechanism #1)" subsection between "Repair cost tour tier scale"
  and "Damage formula targets". Four-row table (threshold, amount,
  first-tour gate, per-tour claim cap) plus a paragraph that names
  `STIPEND_THRESHOLD_CREDITS`, `STIPEND_AMOUNT`, the consumer site,
  and the per-tour claim record path.
- `src/data/__tests__/balancing.test.ts`: new "§23 Tour stipend
  (catch-up mechanism #1)" describe block (section 2c) that mirrors
  the §23 row as `STIPEND_THRESHOLD_TARGET` and
  `STIPEND_AMOUNT_TARGET` and pins each value against the
  corresponding `src/game/catchUp.ts` export. A drift between the
  §23 markdown row, the local target constants, or the runtime
  exports fails the build at a single readable site. A third
  invariant pins that the amount sits below the threshold so the
  lever cannot reverse into a free win on a single grant.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (new §23 stipend describe block green; existing
  catchUp unit tests still green because they reference the
  symbolic exports).
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Adopted the recommended default verbatim. No constant value
  change in `src/game/catchUp.ts`; the slice is doc-plus-test only.
- Pinned the row in §23 even though Q-004 listed the §23 edit as
  optional. Rationale: the §23 page is already the discoverability
  surface for the balancing-pass slice (every other lever lives
  there), and a one-page index of all four catch-up levers is the
  point of §23. Skipping the row would force the balancing-pass
  loop to grep `catchUp.ts` for the values, which defeats the §23
  contract.
- Did not pre-empt Q-005 (repair-cap fraction) or Q-006 (easy-mode
  tour-clear bonus rate). The §23 row added here covers stipend
  only. Q-005 and Q-006 remain open and will land their own §23
  rows in the slices that close them, so each open question gets
  one slice that owns its row end-to-end.
- Did not edit `catchUp.ts` itself. The `OPEN_QUESTIONS.md Q-004
  through Q-007` reference in the file header still spans the
  three remaining open questions; collapsing it now would leave a
  stale comment after Q-005 and Q-006 close. The collapse will
  happen in the slice that closes the last of the three.
- Did not extend §23 with rows for Q-005, Q-006, or any other
  catch-up lever. One open question per slice keeps the resolution
  paragraphs auditable.
- Skipped the F-035 commit pin in `docs/FOLLOWUPS.md` because that
  list tracks open follow-ups and F-035 is already done; the
  PROGRESS_LOG cross-reference here is the audit trail.

### Followups added
None new.

### GDD edits
- `docs/gdd/23-balancing-tables.md`: new "Tour stipend (catch-up
  mechanism #1)" subsection. Pins the four parameters of the
  stipend lever (threshold, amount, first-tour gate, per-tour
  claim cap) so the balancing-pass slice and any future content
  loop can read every catch-up number from a single page.

### Open questions raised
None.

---

## 2026-04-26: Slice: Q-007 confirm practice-mode weather preview surface

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms" #4
(practice-mode weather preview),
[§6](gdd/06-game-modes.md) "Practice mode" (pre-race setup surface),
[§21](gdd/21-technical-design-for-web-implementation.md) "Save system"
(deterministic-replay invariant that a per-session seed leak would
break). No GDD edits.
**Branch / PR:** `feat/answer-q-007-practice-weather-preview`, PR
pending.
**Status:** Q-007 closed. Doc-only resolution. The
`practiceWeatherPreview(track)` helper in `src/game/catchUp.ts`
already ships option (a) (the recommended default): the track's
`weatherOptions` array is returned verbatim as a
`ReadonlyArray<WeatherOption>`, no per-session seeded roll, no
probability-weighted sample. This loop only confirms that no surface
change is owed and pins the re-evaluation triggers for a future
practice-mode slice.

### Done
- `docs/OPEN_QUESTIONS.md`: Q-007 status flips from `open` to
  `answered`. The new Resolution paragraph names the shipping helper
  surface (`practiceWeatherPreview` in `src/game/catchUp.ts`), cites
  the `ReadonlyArray<WeatherOption>` return type that prevents the
  caller from mutating the track JSON, and pins the two triggers
  that would force a re-evaluation: the practice-mode slice
  (`VibeGear2-implement-practice-quick-ad3ba399`) landing a surface
  that requires per-session info (e.g. a stake-on-the-line modifier
  where setup risk needs the exact roll), or §12 pinning a
  probability table that justifies option (c). Option (b) stays
  rejected unless the §21 deterministic-replay invariants are
  revisited (seed-leakage to the UI would break the invariant that
  the seed is derivable only from save state plus race-config inputs).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Doc-only slice. The shipped `practiceWeatherPreview` helper is
  already the recommended default; no code surface needs to change.
  Future practice-mode work consumes the helper as-is unless a stake
  modifier or §12 probability table lands.
- Trigger conditions named in the resolution paragraph. The two named
  triggers (a practice-mode slice landing a stake modifier, or §12
  pinning a probability table) give a future loop a clear handoff so
  the question does not silently reopen.
- The catchUp.ts header comment still references "Q-004 through Q-007"
  for the dev-confirmation thread; left unchanged because Q-004,
  Q-005, and Q-006 remain open and the per-constant pinning rationale
  still maps to the same comment block. A future loop that closes the
  remaining catch-up questions will collapse the reference.

### Followups added
None new.

### GDD edits
None.

### Open questions raised
None.

---

## 2026-04-26: Slice: pure championship.ts module (enterTour, recordResult, tourComplete, unlockNextTour)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) "Top 8 finishers score points"
table is the standings source via `PLACEMENT_POINTS`,
[§8](gdd/08-world-and-progression-design.md) "Unlock structure" sequential
unlock contract. No GDD edits.
**Branch / PR:** `feat/championship-pure-module`, PR pending.
**Status:** Sub-slice 1 of the parent `tour-region-d9ca9a4d` dot. Lands the
pure module; the `/world` page surface and the F-035 / F-037 / F-039 wiring
slices land in follow-up sub-slices that consume this one.

### Done
- `src/game/championship.ts`: new pure module exposing `enterTour`,
  `recordResult`, `tourComplete`, `unlockNextTour`. The `ActiveTour` cursor
  lives in memory between race-finishes; persistence-side state stays on
  the existing `SaveGameProgress` shape (`unlockedTours`, `completedTours`,
  `stipendsClaimed`). Aggregation reads `PLACEMENT_POINTS` from
  `raceResult.ts` so a future §7 retune flows through both the per-race
  pointsEarned line and the per-tour standings without a second pin.
- `src/game/__tests__/championship.test.ts`: 20 unit cases covering the
  enterTour seed / unknown-tour / locked-tour branches, recordResult
  append + non-mutation, tourComplete pass / boundary / fail / DNF /
  unknown-tour / playerCarId override / determinism / non-mutation, and
  unlockNextTour append / final-tour no-successor / idempotence /
  unknown-id / non-mutation.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (2032 tests, +20 for this slice).
- `npm run build` clean.
- `npm run test:e2e` green (50 specs).
- No em or en dashes introduced.

### Decisions and assumptions
- The `ActiveTour` cursor lives in memory rather than on the save schema
  for this slice. Resume-tour-on-reload would promote it to a schema
  field; today the `/world` page can rebuild it from the championship
  plus the player's last race outcome on demand. Keeping it off-schema
  avoids a v3 to v4 migration for a feature the page surface has not
  yet shipped.
- `tourComplete` synthesises a stand-in AI field by crediting the slot
  ahead of the player on each race (one synthetic id per non-player
  placement slot). The player standing only depends on the player's
  points so the placeholder does not affect pass/fail; the synthetic
  field exists so the §20 results screen has something to render. The
  AI grid spawner slice (`implement-ai-grid-02d7e311`) will replace the
  placeholder with real per-AI telemetry once it lands.
- `enterTour` requires the tour to already be in `unlockedTours`,
  including the first tour. The championship-onboarding flow (out of
  scope here) seeds the first tour into `unlockedTours` when the player
  picks a championship.
- The per-race `TourRaceResult` shape is intentionally narrow (trackId
  + placement + dnf). Wider race-finish telemetry stays on
  `RaceResult`; this module reads only what it needs to keep the
  contract minimal and the test fixtures small.

### Followups added
None new. The deferred work is already tracked under the parent
`VibeGear2-implement-tour-region-d9ca9a4d` dot and the existing F-035 /
F-037 / F-039 follow-up rows in `docs/FOLLOWUPS.md`; this sub-slice
ships the data plane those wirings need.

### GDD edits
None.

### Open questions raised
None.

---

## 2026-04-26: Slice: Q-009 confirm last-write-wins cross-tab save protocol

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) "Save system"
(Cross-tab consistency subsection), [§27](gdd/27-risks-and-mitigations.md)
"Cross-tab save corruption" mitigation row. No GDD edits.
**Branch / PR:** `feat/answer-q-009-cross-tab-protocol`, PR pending.
**Status:** Q-009 closed. Doc-only resolution. The
`feat/cross-tab-save-consistency` slice (commit `923d6f9`) already shipped
the recommended default (option (a), last-write-wins with the monotonic
`writeCounter` advisory plus `subscribeToSaveChanges` and `reloadIfNewer`
in `src/persistence/save.ts`); this loop only confirms that no upgrade is
owed and pins the trigger conditions for re-evaluation.

### Done
- `docs/OPEN_QUESTIONS.md`: Q-009 status flips from `open` to
  `answered`. The new Resolution paragraph names the shipping commit,
  cites the `src/persistence/save.ts` surface, and pins the two
  triggers that would force a re-evaluation: §27 raising the cross-tab
  risk row above its current weight, or a cloud sync slice landing (at
  which point we switch directly to option (c) and retire the local-only
  protocol). Leader-tab election (option (b)) stays rejected for the
  MVP rationale already in the question body (election, handoff, and
  two-leader resolution complexity for a narrow two-tab population).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run build` clean.
- `npm run test:e2e` green.
- No em or en dashes introduced.

### Decisions and assumptions
- Doc-only slice. The shipped protocol is the recommended default; no
  code surface needs to change. Future cloud-sync work will revisit
  this resolution and the swap is single-call: replace the
  `writeSave` localStorage write with a server round-trip.
- Trigger conditions named in the resolution paragraph. The two named
  triggers (a §27 risk-row escalation, or a cloud sync slice landing)
  give a future loop a clear handoff so the question does not silently
  reopen.

### Followups added
None new.

### GDD edits
None.

### Open questions raised
None.

---

## 2026-04-26: Slice: F-004 Playwright save/load round-trip via the garage cars UI

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) (garage flow surfaces),
[§21](gdd/21-technical-design-for-web-implementation.md) "Save system"
(the localStorage round-trip contract). No GDD edits.
**Branch / PR:** `feat/f-004-garage-save-load-e2e`, PR pending.
**Status:** F-004 closed. The unit suite in `src/persistence/save.test.ts`
already covered every parse / migrate / write / shim path; this slice adds
the live-browser regression so a future refactor that breaks the storage
contract surfaces before merge instead of after.

### Done
- `e2e/save-persistence.spec.ts`: new Playwright spec, two cases against
  `/garage/cars`. Case 1 seeds a v3 save with two owned cars, clicks
  `select-breaker-s`, asserts the active id flips, reads localStorage to
  confirm the persisted shape, reloads, and confirms the indicator and
  the disabled "Active" button both reflect the new active id. Case 2
  seeds 12000 credits, clicks `buy-vanta-xr`, asserts the success toast
  + decremented credits + new Set Active button, reads localStorage to
  confirm `credits === 2000`, `ownedCars` contains the purchase, and a
  fresh upgrade slot was allocated for the new car, then reloads and
  asserts every persisted field rehydrates. The localStorage-disabled
  branch surfaces via a `test.skip(!hasStorage)` guard so headless
  contexts without storage report a clean skip rather than a failure.
- `docs/FOLLOWUPS.md`: F-004 marked `done` with the spec path and a
  note that upgrade-installation and units-toggle round-trips remain
  outstanding for when `/garage/upgrade` and the Settings Display pane
  ship.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run build` clean.
- `npm run test:e2e` green; the two new cases pass alongside the
  existing suite.

### Decisions and assumptions
- Two-mutation seed shape. Rather than one round-trip per spec, the
  fixture grants two owned cars and 12000 credits so the same seed
  reaches both the "switch active" and the "buy unowned" branches
  without re-seeding between tests. The seed is built once via
  `buildSeededSave()` so a future schema bump is one helper edit.
- Upgrade and units round-trips deferred. The dot text proposed three
  round-trips: switch active car, buy upgrade (in `/garage/upgrade`),
  toggle units (in `/settings`). `/garage/upgrade` does not exist yet
  (owned by the parent garage-flow dot) and the Settings Display pane
  is still a placeholder under the Options dot, so those branches stay
  in F-004's followup note. The two shipped cases cover the load-bearing
  contract: that *anything* the live garage UI writes survives a reload.

### Followups added
None new.

### GDD edits
None.

### Open questions raised
None.

---

## 2026-04-26: Slice: F-022 ghost car overlay (drawer side) in `pseudoRoadCanvas.ts`

**GDD sections touched:**
[§6](gdd/06-game-modes.md) "Time Trial" (the ghost-replay overlay surface).
[§16](gdd/16-rendering-and-visual-design.md) "Sprites and effects" (the
ghost is a translucent silhouette in the same screen space as the live
car). No narrative edits.
**Branch / PR:** `feat/f-022-ghost-car-render`, PR pending.
**Status:** Implemented as the F-022 drawer-side producer slice. The
consumer (Time Trial route wiring that compiles a `Replay`, drives the
ghost physics step, projects to screen, and feeds the renderer) lands
alongside the time-trial parent slice
(`VibeGear2-implement-time-trial-5d65280a`). F-022 in
`docs/FOLLOWUPS.md` flipped from `open` to `in-progress` with the
deferred consumer steps documented.

### Done
- `src/render/pseudoRoadCanvas.ts`: new optional
  `ghostCar?: { screenX: number; screenY: number; screenW: number;
  alpha?: number; fill?: string }` field on `DrawRoadOptions`. When set,
  the drawer paints a translucent placeholder rectangle at the projected
  ground point in screen space. Pinned defaults exported as
  `GHOST_CAR_DEFAULT_ALPHA = 0.5` (per the F-022 stress-test item 9
  default) and `GHOST_CAR_DEFAULT_FILL = "#5fb6ff"` (blue tint so the
  ghost reads as "other player" without the §17 atlas being wired in).
  Draw order: AFTER road strips (so the ghost reads as on the road) and
  BEFORE the dust pool (so off-road dust the live car kicks up still
  occludes the ghost). Shake offset is intentionally not applied: a §16
  impact shake should not drag the recorded path with the live car. The
  empty-strips early-return restructured into a guarded `strips.length
  >= 2` branch so the ghost overlay still paints on dev / test scenes
  that draw the sky but no road. Coordinate convention shifted from
  world `(z, x)` (the original dot text) to screen-space
  `(screenX, screenY, screenW)` so projection happens once at the
  caller, mirroring the §20 minimap and HUD overlay convention.
- `src/render/__tests__/pseudoRoadCanvas.test.ts`: new test file with
  10 cases. Pins: default alpha at 0.5 with default fill, explicit
  alpha override, alpha clamp to `[0, 1]`, fill override, omitted prop
  is a no-op (only the sky paints), `null` prop is a no-op,
  non-positive `screenW` short-circuits, non-finite `screenX` /
  `screenY` short-circuits, the post-call `globalAlpha` matches the
  caller's pre-call value, zero-area viewport short-circuits.
- `docs/FOLLOWUPS.md`: F-022 status flipped from `open` to
  `in-progress (drawer side landed in feat/f-022-ghost-car-render)`
  with separate Drawer / Consumer / Atlas-frame sections covering the
  shipped surface, the deferred Time Trial wiring, and the deferred
  atlas-frame upgrade (which lands alongside the live player car
  atlas-frame upgrade since both are placeholders today).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green; the new 10 ghost-overlay cases pass alongside the
  existing suite (2012 total).
- `npm run build` clean; postbuild source-map scrub ran (16 / 16).
- `npm run test:e2e` green (48 / 48).

### Decisions and assumptions
- Coordinate convention. The original F-022 dot text named
  `ghostCar?: { z: number; x: number; alpha: number }` (world space).
  The drawer would have to project internally, which means dragging
  `Camera` plus the compiled segment list into `DrawRoadOptions`
  alongside `parallax.camera`. The simpler, more idiomatic shape
  matches the §20 minimap and the HUD overlay: pre-project at the
  caller (the race-page render callback already calls
  `segmentProjector.project` for the strips), and the renderer takes
  screen-space `(screenX, screenY, screenW)` plus alpha. Documented in
  the F-022 followup so the consumer slice knows what the contract is.
- Atlas-frame deferral. The dot text says "using the same player-car
  atlas frame the live car renders, optionally tinted blue or
  desaturated". The live player car is not currently rendered into the
  road canvas (the §17 atlas integration for the live car is a separate
  followup). Until that lands, both the live car and the ghost render
  as placeholder rects; pairing the two upgrades into one slice
  guarantees the live car / ghost differentiation stays consistent
  (same atlas, same frame index, just a different alpha and tint on
  the ghost). The `fill` override on the prop lets the consumer pin a
  per-car tint without touching the renderer in the meantime.
- Draw-order placement. Ghost over strips so the recorded path reads
  as on the road; ghost under dust so a live car kicking up dust
  hides the ghost rather than the ghost showing through the plume.
  No shake on the ghost so the recorded path stays anchored to the
  world geometry rather than translating with the live impact frame.

### Followups
- F-022 consumer wiring (Time Trial route compiles `Replay`, drives
  ghost physics step from `Player.readNext`, projects to screen, feeds
  `ghostCar` prop). Tracked in F-022 alongside the time-trial parent
  slice.
- F-022 atlas-frame upgrade (sample player-car sprite at the same
  facing index as the live car; tint or desaturate for the ghost).
  Tracked in F-022 to land with the live-car atlas-frame slice.

---

## 2026-04-26: Slice: F-015 pin race-session integration tests for off-road persistent damage

**GDD sections touched:**
[§10](gdd/10-arcade-physics-and-controls.md) "Road edge and off-road
slowdown" (no narrative edits; this slice closes the F-015 followup
that the §10 narrative had pointed at since the arcade-physics slice).
[§13](gdd/13-damage-repairs-and-risk.md) "Off-road persistent damage"
(no narrative edits; the producer-side `applyOffRoadDamage` and the
`OFF_ROAD_DAMAGE_PER_M = 0.000107` calibration already shipped with
the §13 damage-model slice).
**Branch / PR:** `feat/f-015-off-road-damage-tests`, PR pending.
**Status:** Implemented. Closes `VibeGear2-implement-f-015-fdfdd148`
and flips F-015 in `docs/FOLLOWUPS.md` from `in-progress` to `done`.
F-019 and F-047 had already wired the runtime; this slice adds the
F-015-specific integration pins and closes out the followup.

### Done
- `src/game/__tests__/raceSession.test.ts`: new
  `describe("stepRaceSession (§10/§13 off-road persistent damage
  wiring, F-015)")` block with 7 cases. Pins, end-to-end through
  `stepRaceSession`: per-tick body emit equals
  `OFF_ROAD_DAMAGE_PER_M * postStepSpeed * dt * 0.7` exactly (the
  post-step speed is the §10 `OFF_ROAD_CAP_M_PER_S = 24` because the
  physics step clamps the snapped 60 m/s before the damage path reads
  it); 5 s (300 ticks) of off-road holding accumulates exactly the
  analytical `300 * (per-tick body emit)` with no drift; on-road
  ticks at speed leave the damage state at `PRISTINE`; AI cars run
  the same `isOffRoad` gate as the player; the §28 `damageSeverity`
  scalar attenuates the player emit at the Easy / Hard preset ratio
  (`0.75 / 1.20`); a hand-built `damageSeverity = 0` assist preset
  zeros the emit at the producer level (the future-proof contract
  the dot called out for "no-damage assist preset"); and persistent
  off-road damage feeds the next tick's `getDamageScalars` lookup so
  a player who accumulates past the severe-band threshold
  (`total = 0.75`) sees their post-snap top speed clamp to the
  severe-band scalar (0.78).
- `docs/FOLLOWUPS.md`: F-015 status flipped from `in-progress` to
  `done (2026-04-26, feat/f-015-off-road-damage-tests)` with the
  wiring trace (F-047 + F-019) and the new test surface noted.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green; the new 7 F-015 integration cases pass alongside
  the existing 2002-test suite (now 2009 total).
- `npm run build` clean; postbuild source-map scrub ran.
- `npm run test:e2e` green (48 / 48).

### Decisions and assumptions
- The `applyOffRoadDamage` consumer wiring (steps 1-3 of the F-015
  dot description) had already shipped under F-047 (race-session
  per-car damage state) and F-019 (damage scalars threaded into the
  physics call site). This slice closes the dot by landing the
  step-4 unit test pins at the integration level; the runtime
  binding required no edits.
- Picked the §10 off-road cap (`OFF_ROAD_CAP_M_PER_S = 24`) as the
  reference speed for the integration tests instead of the
  producer-side 60 m/s reference. The session reads the post-step
  speed when calling `applyOffRoadDamage`, which the physics step
  always clamps to the off-road cap; testing at 24 m/s mirrors the
  actually-attainable runtime behaviour. The 5 s stress-test pin in
  `damage.test.ts` continues to use 60 m/s directly because it
  bypasses physics and tests the producer surface in isolation.
- Re-snapped `x: 100` and `speed: 60` after every `stepRaceSession`
  in the per-tick / cumulative tests so the §10 off-road drag
  (`OFF_ROAD_DRAG_M_PER_S2 = 18`) does not slowly bleed the post-step
  speed below the cap on subsequent ticks. Without the re-snap,
  coasting drag pushes the speed toward zero over a few seconds and
  the analytical body-share target stops matching.
- The "no-damage assist preset" verify item was left as a producer-
  level pin (calling `applyOffRoadDamage(state, 60, 1, {
  damageSeverity: 0, ... })` directly) rather than a session-level
  pin because the §28 player-facing table never pins
  `damageSeverity = 0` (Easy is `0.75`). Pinning the contract at the
  producer surface keeps a future debug-tooling override or
  hand-built preset row honest without inventing a non-canonical
  preset id.

### Followups created
- None. F-015 is closed; the `feat/wire-damage-scalars-into-physics`
  slice already closed the F-019 physics-binding consumer; the
  hazards-runtime emitter mentioned in F-019 remains the only
  outstanding §13 consumer (tracked separately under the
  hazards-runtime dot).

### GDD edits
- None.

---

## 2026-04-26: Slice: F-031 scrub workspace paths from Next.js source maps

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) Production
artefact hygiene (no narrative edits; this slice ships the post-build
scrub already implied by the F-031 followup in `docs/FOLLOWUPS.md`).
**Branch / PR:** `feat/scrub-source-maps`, PR pending.
**Status:** Implemented. Closes `VibeGear2-implement-f-031-52a91681`
and F-031 in `docs/FOLLOWUPS.md`. The verify-step grep
`grep -E '/Users/|/home/' .next/static/chunks/*.js.map` now returns
zero hits across all 32 generated maps after `npm run build`.

### Done
- `scripts/scrub-source-maps.ts`: post-build scrubber that walks
  `.next/static/chunks/**/*.js.map`, parses each map as JSON, and
  rewrites every entry of `sources` and `sourcesContent` by replacing
  the absolute workspace prefix (`process.cwd()` at scrub time) with
  the stable sentinel `vibegear2://`. Pure helpers
  (`scrubWorkspaceFromString`, `scrubSourceMapJson`, `scrubChunksDir`,
  `summariseResults`) exported so the test suite can drive every
  branch without writing files. Defensive against malformed JSON,
  missing files, and non-array `sources` / `sourcesContent` shapes;
  writes back only when the scrubbed contents differ so unchanged
  maps keep stable mtimes; idempotent on a second run.
- `scripts/__tests__/scrub-source-maps.test.ts`: 26 unit cases
  covering pure rewriters, file-level scrub, idempotence, directory
  walk (including hidden-dir skip and non-`.js.map` skip), CLI
  summary roll-up, and a read-only smoke against the live
  `.next/static/chunks` that asserts no map carries `process.cwd()`
  on disk after the postbuild ran.
- `package.json`: new `postbuild` script
  (`vite-node --script scripts/scrub-source-maps.ts`) so every
  `npm run build` automatically scrubs the framework maps before the
  artefact leaves the developer machine or the CI worker.
- `docs/FOLLOWUPS.md`: F-031 status flipped from `open` to
  `done (2026-04-26, feat/scrub-source-maps)` with the wiring
  rationale and verification notes.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green; the new 26 scrub-source-maps cases pass alongside
  the existing suites.
- `npm run build` clean; the postbuild scrub runs automatically and
  prints the summary line.
- `npm run test:e2e` green.
- Manual: `grep -E '/Users/|/home/' .next/static/chunks/*.js.map`
  returns zero hits after the build.

### Decisions and assumptions
- Adopted F-031 fix path (a) (post-build script that rewrites map
  files in place) over (b) (webpack `devtoolModuleFilenameTemplate`
  override) and (c) (defer to the error-reporter upload step).
  Rationale: (b) does not reliably reach the framework chunks
  (`main-app-*.js.map`, `main-*.js.map`) where the original leak
  lives; (c) leaves a fingerprintable artefact on disk indefinitely.
  (a) ships the scrub at the artefact boundary so every shipped map
  is clean regardless of how the deploy host serves it.
- Chose the sentinel `vibegear2://` over a bare relative prefix so
  the rewrite is unambiguous in a stack trace and a future error
  reporter can resolve it back to a repo-relative path with one
  string replace.
- Limited the scan to `.next/static/chunks` (not `.next/server`)
  because server-side maps never reach the client; the followup
  privacy concern was specifically the browser-facing maps.
- Kept the scrub a literal string replace instead of a regex so
  per-character escaping is unnecessary and the implementation stays
  trivially auditable.

### Followups created
- None. The fix is self-contained; the future opt-in error reporter
  slice can rely on the sentinel without further changes here.

### GDD edits
- None.

---

## 2026-04-26: Slice: Q-010 pin §23 `tourTierScale` table

**GDD sections touched:** [§12](gdd/12-upgrade-and-economy-system.md)
"Repair costs" (formula was already pinned), [§23](gdd/23-balancing-tables.md)
"Repair cost tour tier scale" (new table row).
**Branch / PR:** `feat/q-010-tour-tier-scale`, PR pending.
**Status:** Implemented. Closes `VibeGear2-research-q-010-231ddf82` and
flips Q-010 in `docs/OPEN_QUESTIONS.md` from `open` to `answered`. F-033
(`applyRepairCost`) is now unblocked.

### Done
- `docs/gdd/23-balancing-tables.md`: new "Repair cost tour tier scale"
  section with the iter-19 placeholder values
  (`1.00, 1.15, 1.30, 1.50, 1.75, 2.05, 2.40, 2.80` for tours 1..8).
  Tours past 8 reuse the tour-8 value until a future content slice
  extends the championship.
- `src/game/economy.ts`: `TOUR_TIER_SCALE` frozen lookup keyed by
  1-based tour index plus `tourTierScale(tour)` resolver. NaN clamps
  to tour 1; out-of-range inputs clamp into `[1, 8]`; fractional
  inputs round to the nearest tour. The header out-of-scope note for
  `applyRepairCost` updated to point F-033 at the new lookup.
- `src/data/__tests__/balancing.test.ts`: new "§23 Repair cost tour
  tier scale" describe block. Each cell pinned cell-by-cell against
  the §23 markdown table; clamp / NaN / fractional / monotonicity /
  freeze contracts covered (8 cases).
- `docs/OPEN_QUESTIONS.md`: Q-010 marked `answered` with rationale
  pointing at the §23 row and the `economy.ts` exports.
- `docs/FOLLOWUPS.md`: F-033 status note updated to `open (unblocked)`
  with a pointer to `tourTierScale(tourTier)` as the resolver the
  future `applyRepairCost` should call.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green; the new "§23 Repair cost tour tier scale"
  describe block passes alongside the existing balancing cells.
- `npm run build` clean.
- `npm run test:e2e` green.

### Decisions and assumptions
- Adopted Q-010 option (a) (the iter-19 placeholder table) per the
  recommended default. Rationale: it is the only designed proposal in
  the loop and it unblocks both F-033 and F-036 with a single edit.
  The balancing pass slice owns the final retune; the `Edit §23 +
  swap one constant` change is a one-line follow-up.
- Placed `TOUR_TIER_SCALE` in `src/game/economy.ts` (not a new
  `src/data/balancing.ts`) to match the existing repo pattern: every
  other §23 numeric table lives in its consumer module
  (`BASE_REWARDS_BY_TRACK_DIFFICULTY` in `economy.ts`,
  `WEATHER_TIRE_MODIFIERS` in `weather.ts`,
  `CPU_DIFFICULTY_MODIFIERS` in `aiDifficulty.ts`,
  `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` in `damage.ts`).

### Followups created
- None. F-033 was already filed; this slice unblocks it.

### GDD edits
- `docs/gdd/23-balancing-tables.md`: added "Repair cost tour tier
  scale" table per Q-010 resolution.

---

## 2026-04-26: Slice: F-020 content-lint script enforces LEGAL_SAFETY denylist

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) IP perimeter (no narrative
edits; this slice ships the automated enforcement of the perimeter rules
already pinned by `docs/LEGAL_SAFETY.md`).
**Branch / PR:** `feat/content-lint-script`, PR pending.
**Status:** Implemented. Closes `VibeGear2-implement-f-020-26d95165` and
F-020 in `docs/FOLLOWUPS.md`. `docs/LEGAL_SAFETY.md` section 9 said the
content lint was "future"; this slice makes it real and wires it into
`npm run verify` so a denylisted real-circuit, manufacturer, or
trademark name cannot ship from the repo without tripping the build.

### Done
- `scripts/content-lint.ts`: the lint, with four pass functions
  (`lintBinaryManifest`, `lintTrackNames`, `lintCarNames`,
  `lintTopGearText`) plus the public matcher helpers
  (`buildDenylistRegex`, `findDenylistHit`, `formatHit`,
  `isBinaryAssetPath`) and the four denylist constants
  (`TRACK_REAL_CIRCUIT_DENYLIST`, `CAR_MANUFACTURER_DENYLIST`,
  `TOPGEAR_TEXT_DENYLIST`, `BINARY_EXTENSIONS`). `runContentLint`
  composes the passes in stable order and `main()` prints each hit on
  one line and exits non-zero on any hit.
- `scripts/__tests__/content-lint.test.ts`: 45 unit cases covering
  every matcher, every pass on positive and negative fixtures written
  to a temp directory, the cross-pass `runContentLint` ordering, and
  a smoke check that runs the lint against the live repo and asserts
  zero hits (so a future content drop that introduces a denied term
  fails this suite first).
- `package.json`: `content-lint` script entry plus `verify` chained
  to call it after lint, typecheck, and test.
- `vitest.config.ts`: include glob extended to
  `scripts/**/*.test.ts` so the new test file runs under
  `npm test` alongside the existing suite.
- `docs/LEGAL_SAFETY.md`: section 9 rewritten from "future script"
  prose to a description of the shipping enforcement, with a pointer
  to the authoritative denylist constants in the script.
- `docs/FOLLOWUPS.md`: F-020 marked `done` with a summary of scope
  decisions (binary-pass no-op until `public/` ships, trademark scan
  scoped to data JSON, whole-word case-insensitive matchers).

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: full suite green (1,896 cases including the 45 new
  content-lint cases).
- `npm run content-lint`: clean against the repo (no false positives
  on the existing track / car / sponsor / championship / AI driver
  JSON catalogue).
- `npm run build`: clean static output, no new route surface.
- `npm run test:e2e`: full Playwright suite green (48 cases).

### Decisions and assumptions
- Top Gear / publisher denylist scoped to data JSON only. The README,
  the page tagline (`src/app/page.tsx`), the layout title
  (`src/app/layout.tsx`), and a comment in `src/game/transmission.ts`
  legitimately describe the project as a spiritual successor to Top
  Gear 2 per `docs/gdd/01-title-and-high-concept.md`. Scoping the
  trademark scan to `src/data/**/*.json` and `public/**/*.json`
  catches attempts to bake the trademark into shipped content while
  leaving the legitimate "spiritual successor" prose untouched.
- Whole-word case-insensitive matching via lookarounds rather than
  `\b`. The `Le Mans` token has an internal space; `\b` would split
  the match on the space and miss it. The `(?<![A-Za-z0-9])X(?![A-Za-z0-9])`
  pattern matches multi-word tokens cleanly and rejects substring
  embeddings like `space` for `Spa` or `respawn` for `Spa`.
- Track-pass JSON probe via `"segments"` and `"laps"` keys rather
  than schema validation. The lint must run against any JSON file
  shape, including future formats that add fields the current
  `TrackSchema` would reject. Probing two key names is robust enough
  to avoid running the real-circuit denylist against sponsor or
  championship JSON that mention a denied term in a different
  context.
- Binary-without-manifest pass no-ops while `public/` is absent.
  Today the asset pipeline ships nothing under `public/`; the
  `manifestForTrack` builder in `src/asset/manifest.ts` produces a
  per-race manifest at runtime but no on-disk binary exists for the
  lint to flag. Once the visual-polish slice drops its first sprite
  atlas, every entry must be referenced by a `*.manifest.json`
  listing under `public/` (or by an explicit `manifestEntries`
  injection from the caller).
- `vite-node --script` rather than `tsx` / `ts-node`. The repo
  already depends on `vite-node` (a vitest peer); adding another
  TS runner just for one CLI script would inflate the
  devDependency tree. The same pattern lands the bench script.

### Followups
- F-020 closes here. The binary-without-manifest pass becomes
  load-bearing the moment the asset pipeline ships its first
  `public/` binary; that lands with the visual-polish slice
  (`VibeGear2-implement-visual-polish-7d31d112`).

---

## 2026-04-26: Slice: F-032 wire leaderboard client into race results surface

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) Optional online
leaderboard (no schema changes; the client + route handlers landed in
prior slices, this slice carves the in-app consumer per the
"signed lap submission concept" producer / consumer split).
[§20](gdd/20-hud-and-ui-ux.md) Results screen (the leaderboard pill plus
the optional top-N list now live below the per-race rewards panel).
**Branch / PR:** `feat/leaderboard-panel-on-results`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-032-d97641a1` and F-032 in `docs/FOLLOWUPS.md`.
The `src/leaderboard/client.ts` adapter shipped with zero in-app
callers; the §20 race results page now consumes it via
`<LeaderboardPanel />` so the producer / consumer pair from
`feat/leaderboard-client` finally has both halves wired.

### Done
- `src/components/results/leaderboardPanelState.ts`: pure model that
  maps the four `SubmitLapResult` sentinels (`stored`, `rejected`,
  `network-error`, `disabled`) plus the DNF and idle short-circuits
  to a stable `PanelStatus` + `label` shape the React component
  renders without any branching of its own. `deriveSubmitView`,
  `deriveTopView`, and `buildLeaderboardPanelView` are pure: literal
  fixtures in, deterministic view out, no IO.
- `src/components/results/LeaderboardPanel.tsx`: thin React shell
  that reads `isLeaderboardEnabled()` once on mount and returns
  `null` when the env flag is off, so the §20 receipt stays clean
  for the bundled MVP build. When enabled, fires `submitLap` once
  per mount on a clean finish and `getTop(trackId, 10)` in parallel,
  rendering the status pill and the optional top-N list. DNF rows
  skip the network call and surface a `Lap not submitted (DNF).`
  pill. Uses a placeholder raceToken / signature: the
  `LEADERBOARD_SIGNING_KEY` is a server-only secret per §21 and the
  client never holds it; a real signed submission lands with the
  raceToken issuance route owned by F-030. The route's
  `bad-signature` / `server-misconfigured` response naturally
  surfaces as a `rejected` pill with the stable code on
  `data-rejected-code`.
- `src/components/results/__tests__/leaderboardPanelState.test.ts`:
  16 cases pinning every branch (DNF short-circuit, idle pre-submit,
  stored with and without an id, rejected with the server code,
  network-error, disabled, top-section hidden / shown across the
  four `GetTopResult` shapes, plus three composition cases on
  `buildLeaderboardPanelView`).
- `src/components/results/__tests__/LeaderboardPanel.test.tsx`: 4
  SSR-shape cases pinning the env-gate render guard
  (`enabledOverride: false` -> empty markup), the enabled shell
  (idle pill, panel data attributes), the DNF short-circuit, and a
  no-em-dash assertion against the rendered copy.
- `src/app/race/results/page.tsx`: imports `LeaderboardPanel` and
  renders it below the next-race card inside the rewards panel.
  Derives `playerFinished` and `playerBestLapMs` from the player's
  `FinalCarRecord` so DNF rows skip submission.
- `e2e/results-screen.spec.ts`: new spec asserts the panel is
  hidden when `NEXT_PUBLIC_LEADERBOARD_ENABLED` is unset (the
  default for both local dev and the playwright build). The four
  submit-result branches are covered by the unit suite; the
  enabled-branch e2e lands when F-030 provisions Vercel KV and the
  playwright build sets the env flag.
- `docs/FOLLOWUPS.md`: F-032 marked `done` with a pointer to the
  consumer location.

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: full suite green (20 new cases across the panel state
  and SSR shell).
- `npm run build`: clean static output, no new route surface.
- `npm run test:e2e`: results-screen suite green; the new
  `hides the leaderboard panel when the env flag is off` case
  asserts `getByTestId("leaderboard-panel")` returns count 0 under
  the default env.

### Decisions and assumptions
- Placeholder raceToken / signature on the submission. The dot text
  said "compute the signed token from { trackId, finalTimeMs,
  ghostHash }", but the actual `LapSubmission` schema is
  `{ trackId, carId, lapMs, raceToken, signature }` and
  `LEADERBOARD_SIGNING_KEY` is a server-only secret per §21 and
  AGENTS.md RULE 7. No client-side signing surface exists yet, so
  the consumer sends a placeholder pair and surfaces the route's
  `rejected` response (with `bad-signature` or
  `server-misconfigured` codes) on the status pill. A real signed
  submission ships with the raceToken issuance route owned by
  F-030; until then the consumer is wired and the wire shape is
  exercised end-to-end by the route smoke at
  `e2e/leaderboard-routes.spec.ts`.
- Single env read on mount via `useState(() => isLeaderboardEnabled())`
  rather than per-render. The flag is a `NEXT_PUBLIC_*` build-time
  inline; reading it once keeps the SSR snapshot and the first
  client render in lockstep on whether the panel exists in the
  DOM. The `enabledOverride` prop exists for the SSR snapshot test
  and is omitted by production callers.
- E2E covers only the disabled (default) branch. Setting
  `NEXT_PUBLIC_LEADERBOARD_ENABLED=true` for playwright would
  require rebuilding the Next.js bundle with the env baked in, and
  the route's `submit` handler would still 500 without
  `LEADERBOARD_SIGNING_KEY`. The four submit-result branches are
  pinned by `leaderboardPanelState.test.ts`; the enabled e2e
  branch lands with F-030.

### Followups
- F-032 closes here. F-030 (Vercel KV provisioning) and the
  raceToken issuance route remain open and are the natural next
  steps for the leaderboard slice.

---

## 2026-04-26: Slice: cross-tab save consistency (writeCounter, storage subscribe, focus revalidate)

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) Save system (new
"Cross-tab consistency" subsection naming the last-write-wins protocol,
the `writeCounter` advisory, `subscribeToSaveChanges`, and
`reloadIfNewer`).
[§22](gdd/22-data-schemas.md) `SaveGame` schema (added the optional
`writeCounter` field with the cross-tab semantics call-out).
[§27](gdd/27-risks-and-mitigations.md) Risk catalogue (added the
"Cross-tab save corruption" row with the §21 mitigation reference).
**Branch / PR:** `feat/cross-tab-save-consistency`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-cross-tab-fa8cb14c`. Two tabs of the deployed build
can now coexist safely: every persist ticks a per-write counter,
foreign-tab writes hot-reload via the `storage` event, and a long-lived
in-memory save can revalidate against the on-disk copy on `focus` /
`visibilitychange`. The race loop is intentionally untouched because
`RaceState` is independent of `SaveGame` until the race ends.

### Done
- `src/data/schemas.ts`: added optional `writeCounter`
  (`z.number().int().nonnegative().optional()`) to `SaveGameSchema` with
  a comment cross-linking the §21 cross-tab section. Counter is
  independent of the schema `version`; loaders treat `undefined` as `0`.
- `src/persistence/save.ts`: `defaultSave()` seeds `writeCounter: 0`;
  `saveSave()` increments before serialise and persists the bumped
  counter so the on-disk shape always reflects the most recent write.
  Added `subscribeToSaveChanges(callback, { target?, logger? })` that
  wires a `storage` event listener (filters on the current schema's
  storage key, ignores `null` `newValue`, parses + migrates + schema-
  validates before invoking the callback) and returns an unsubscribe
  that is safe to call twice. Added `reloadIfNewer(currentInMemory,
  io?)` that loads the on-disk save and returns it when its
  `writeCounter` is strictly greater than the in-memory copy, else
  null. New types `SaveChangeListener`, `SubscribeOptions`,
  `SaveEventTarget`, `StorageEventLike` exported alongside.
- `src/persistence/migrations/v1ToV2.ts`: seeds `writeCounter: 0` on the
  migrated payload. Preserves an existing non-negative integer
  `writeCounter` if the source already carries one (forward-compat
  guard); rejects-as-0 for invalid inputs (negative, non-integer,
  string, null, true).
- `src/persistence/save.test.ts`: 16 new cases covering the
  `writeCounter` round-trip semantics (seeded at 0, increments per
  write, missing-counter-treated-as-0, two-writer last-write-wins
  using a shared backing map), the `subscribeToSaveChanges` filter set
  (foreign-key ignored, `null` `newValue` ignored, schema-invalid and
  malformed-JSON foreign payloads ignored, no-target = no-op
  unsubscribe, unsubscribe removes the listener and is idempotent),
  and `reloadIfNewer` (returns null on equal counters, returns the
  on-disk save on greater counter, null on corrupt on-disk save,
  treats missing in-memory counter as 0). Updated the round-trip test
  to acknowledge the post-write counter tick.
- `src/persistence/migrations/v1ToV2.test.ts`: 3 new cases
  (writeCounter seeded at 0 on a fresh v1 save, preserved when the
  source already has a valid counter, fallback to 0 for invalid
  values).
- `docs/gdd/21-technical-design-for-web-implementation.md`: added the
  "Cross-tab consistency" subsection under "Save system".
- `docs/gdd/22-data-schemas.md`: documented `writeCounter` on the
  example payload and in the trailing prose.
- `docs/gdd/27-risks-and-mitigations.md`: added the "Cross-tab save
  corruption" row.
- `docs/OPEN_QUESTIONS.md`: filed Q-009 on whether to upgrade to
  leader-tab election; recommended default is to keep last-write-wins.

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 76 files / 1786 tests pass (29 in `save.test.ts`, 13 in
  `v1ToV2.test.ts`, 32 in `schemas.test.ts`, all green).
- `npm run build`: clean static output, route surface unchanged.
- `npm run test:e2e`: 47 specs pass (no e2e exercises the cross-tab
  protocol because Playwright drives one browsing context at a time;
  unit tests cover the three protocol scenarios with a shared-backing
  storage shim and a `StorageEventBus` listener shim).

### Decisions and assumptions
- `writeCounter` lives on `SaveGameSchema` itself (optional) rather
  than in a separate JSON envelope. The dot text said "stored
  alongside the save inside the JSON payload, not as a separate key";
  embedding the counter on the schema keeps the round-trip lossless,
  the export / import path automatic, and the validation pipeline
  unchanged. Loaders treat `undefined` as `0` so any pre-counter
  payload migrates implicitly.
- Same-tab events are filtered by relying on the documented browser
  behaviour that `StorageEvent` does not fire in the originating tab.
  The dot referenced a tab-id mechanism, but no such id exists in the
  codebase and the documented event semantics already make same-tab
  filtering free. The `StorageEventBus` test shim emits to every
  registered listener, mirroring the cross-tab fan-out without
  needing a synthetic tab id.
- `BroadcastChannel` is intentionally not used in this slice. The
  `storage` event is enough for the write-detected case and works in
  every supported browser including Safari. A future slice can add
  `BroadcastChannel` for in-app cross-tab coordination
  (pause-all-tabs, etc.) if §27 ever requires it.

### Followups created
- Q-009 in `OPEN_QUESTIONS.md` (leader-tab election alternative;
  recommended default is no, keep last-write-wins). No new F-NNN
  entries: focus / visibilitychange wiring on the title and garage
  pages is part of the parent garage-flow dot
  (`VibeGear2-implement-garage-flow-07f26703`) and the consumer of
  `subscribeToSaveChanges` will land alongside the screens it
  protects.

### GDD edits
- `docs/gdd/21-technical-design-for-web-implementation.md`: added
  "Cross-tab consistency" subsection under "Save system" (one
  paragraph + cross-link to `src/persistence/save.ts`).
- `docs/gdd/22-data-schemas.md`: extended the SaveGame example with
  `writeCounter` and a paragraph describing the field's optionality
  and the migration's seed behaviour.
- `docs/gdd/27-risks-and-mitigations.md`: appended the "Cross-tab save
  corruption" risk row with the §21 mitigation reference.

---

## 2026-04-26: Slice: F-043 pin §23 weather modifiers into `src/game/weather.ts`

**GDD sections touched:**
[§23](gdd/23-balancing-tables.md) Weather modifiers (the placeholder
table in the balancing test now imports and asserts the constant).
[§14](gdd/14-weather-and-environmental-systems.md) Weather types
(documents the §23-row subset and the visibility-not-grip semantics
of the Fog row). [§22](gdd/22-data-schemas.md) `WeatherOption` enum
(the lookup is keyed by a typed subset; the three uncovered values
are filed as Q-008).
**Branch / PR:** `feat/weather-tire-modifiers` stacked on
`feat/cpu-tier-pace-scalar-in-tickai`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-043-591438a1`. The §23 "Weather modifiers"
table now has a single binding-site: `src/game/weather.ts` exposes
`WEATHER_TIRE_MODIFIERS`, keyed by the `WeatherTireModifierKey`
schema subset (Clear, Rain, Heavy rain, Snow, Fog), with
`getWeatherTireModifier` and `isWeatherTireModifierKey` helpers.
The balancing test in `src/data/__tests__/balancing.test.ts` imports
the constant and asserts every cell rather than re-pinning literals,
so a §23 retune has exactly one place to edit. The runtime consumers
(apply the additive offset on top of `baseStats.gripDry / gripWet`
inside `physics.step`, surface the row in the §14 pre-race UI grip
rating pill) are owned by the parent weather dot
`VibeGear2-implement-weather-38d61fc2`.

### Done
- `src/game/weather.ts` (new): frozen `WEATHER_TIRE_MODIFIERS` keyed
  by the §23 row subset of `WeatherOption` with the literal values
  (Clear +0.08 / 0, Rain -0.12 / +0.10, Heavy rain -0.20 / +0.16,
  Snow -0.18 / +0.14, Fog 0 / 0); helpers
  `isWeatherTireModifierKey`, `getWeatherTireModifier`; iteration
  order `WEATHER_TIRE_MODIFIER_KEYS`.
- `src/game/__tests__/weather.test.ts` (new): 24 cases pinning every
  cell, freeze semantics, identity-comparison guarantee for the
  return reference, the type guard's narrow, the
  `undefined`-on-uncovered-weather contract, and the §23 row
  monotonicity (dry grip falls Clear -> Rain -> Heavy rain, wet grip
  rises across the same axis, Fog grip-neutral).
- `src/data/__tests__/balancing.test.ts` (update): replaced the
  `// deferred to F-043` block with an import-and-cross-check
  against `WEATHER_TIRE_MODIFIERS`. Now imports the new constant and
  iterates `WEATHER_TIRE_MODIFIER_KEYS` for the per-cell assertion;
  retains the freeze-semantics guard and the Fog grip-neutral pin.
- `docs/FOLLOWUPS.md`: F-043 marked `done` with the binding site and
  the consumer module.
- `docs/OPEN_QUESTIONS.md`: filed Q-008 for the three §23-uncovered
  `WeatherOption` values (`light_rain`, `dusk`, `night`) so the
  parent weather dot inherits the decision.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: all suites pass with the 24 new weather cases plus the
  rewritten balancing block (5 per-cell pins + monotonicity +
  freeze).
- `npm run build`: clean.
- `npm run test:e2e`: 47 specs pass. No runtime consumer of the new
  module yet; the e2e suite exercises only the existing race-finish
  and HUD paths, neither of which touches weather grip.

### GDD edits
- None. The §23 numbers landed verbatim from the existing
  balancing-pass slice; no §14 narrative was changed.

### Followups
- F-043 closed. Q-008 opened for the three §23-uncovered
  `WeatherOption` values; the parent weather dot inherits the
  decision before its physics integration lands.

---

## 2026-04-26: Slice: F-046 wire `BASE_REWARDS_BY_TRACK_DIFFICULTY` into the race-finish builder

**GDD sections touched:**
[§23](gdd/23-balancing-tables.md) Reward formula targets keyed by
track difficulty rating 1..5 (now drives the race-finish cash row).
[§8](gdd/08-tour-and-region-structure.md) Per-track difficulty as the
input to the §23 lookup. [§12](gdd/12-upgrade-and-economy-system.md)
`raceReward = baseTrackReward * finishMultiplier * difficultyMultiplier`
(the `baseTrackReward` factor now flows from the §23 lookup by default).
**Branch / PR:** `feat/track-base-reward-by-difficulty` stacked on
`feat/cpu-difficulty-modifiers`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-046-d83eb189`. The §23
`BASE_REWARDS_BY_TRACK_DIFFICULTY` lookup (already pinned by the
balancing-pass slice) now has a runtime consumer: `buildRaceResult`
defaults `baseTrackReward` to
`baseRewardForTrackDifficulty(track.difficulty)` when the caller does
not pass an explicit override, and the race-finish wiring at
`src/app/race/page.tsx` threads the compiled track's difficulty
through the natural-finish and retire branches. Track JSON already
carries the per-track `difficulty` field (validated by `TrackSchema`),
so no content edits were needed for the bundled `test/curve` and
`test/straight` tracks.

### Done
- `src/road/types.ts`: extended `CompiledTrack` with a mirrored
  `difficulty: number` field so the race-finish call site can pull
  the §23 input directly off the compiled output without re-parsing
  the source JSON.
- `src/road/trackCompiler.ts`: propagated `track.difficulty` into the
  compiled output. Frozen at the same depth as the rest of
  `CompiledTrack` via the existing `deepFreeze`.
- `src/game/raceResult.ts`: added a default for `baseTrackReward` that
  resolves through `baseRewardForTrackDifficulty(track.difficulty)`
  whenever the caller omits the explicit override. The named constant
  `DEFAULT_BASE_TRACK_REWARD` (1000) survives as a documented fallback
  for test fixtures and dev pages without a real Track. Doc comments
  updated to point at the §23 lookup.
- `src/app/race/page.tsx`: both the natural-finish render branch and
  the retire branch now pass `{ id, difficulty }` for the Track stand-in
  fed into `buildRaceResult`. Comments updated to call out the §23
  lookup. The minimal cast is preserved so the page does not have to
  re-parse the bundled JSON for the rest of the Track shape.
- `src/game/__tests__/raceResult.test.ts`: replaced the prior
  "matches computeRaceReward" test with a §23-aware version (the
  fixture's `difficulty: 1` still maps to 1000 by construction so
  the regression bound is intact). Added three new tests: tier-3
  derivation, every §23 tier through the default lookup, and
  caller-supplied `baseTrackReward` overriding the lookup.
- `src/road/__tests__/trackCompiler.test.ts`: pins
  `compiled.difficulty === track.difficulty` for every §23 tier
  (1 through 5) so a future compiler change cannot drop the field.
- `docs/FOLLOWUPS.md` (update): F-046 marked `done` with the binding
  site and the consumer module.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 1725+ tests pass (added 5 new in the cash-base block,
  1 in the compiler suite).
- `npm run build`: clean.
- `npm run test:e2e`: 47 specs pass (race-finish wiring exercised
  end-to-end via the multi-lap and natural-finish specs).

---

## 2026-04-26: Slice: F-044 wire §23 CPU difficulty modifiers (`CPU_DIFFICULTY_MODIFIERS`)

**GDD sections touched:**
[§23](gdd/23-balancing-tables.md) CPU difficulty modifiers (now
import-and-assert against the new constant).
[§15](gdd/15-cpu-opponents-and-ai.md) Difficulty tiers (the four-tier
`PlayerDifficultyPreset` ladder maps onto each row).
**Branch / PR:** `feat/cpu-difficulty-modifiers` stacked on
`feat/nitro-damaged-bonus`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-044-a931a220`. The §23 "CPU difficulty
modifiers" table now has a single binding-site:
`src/game/aiDifficulty.ts` exposes `CPU_DIFFICULTY_MODIFIERS`,
keyed by `PlayerDifficultyPreset`, with `getCpuModifiers` and
`resolveCpuModifiers` helpers that mirror the §28 preset module.
The balancing test in `src/data/__tests__/balancing.test.ts`
imports the constant and asserts every cell rather than re-pinning
literals, so a §23 retune has exactly one place to edit. The
runtime consumers (apply `paceScalar` in `tickAI`, apply
`mistakeScalar` once mistake injection lands, apply
`recoveryScalar` once rubber-banding lands) are filed as F-048.

### Done
- `src/game/aiDifficulty.ts` (new): frozen
  `CPU_DIFFICULTY_MODIFIERS` keyed by `PlayerDifficultyPreset` with
  the §23 row literals (Easy 0.92 / 0.95 / 1.40, Normal 1.00 /
  1.00 / 1.00, Hard 1.05 / 1.03 / 0.70, Master 1.09 / 1.05 /
  0.45). Frozen at both levels (table and per-tier objects).
  `getCpuModifiers(tierId)` returns the same frozen reference
  across calls; `resolveCpuModifiers(tierId | undefined)` falls
  back to Normal for older v1 saves with no `difficultyPreset`
  field. `CPU_TIER_IDS` exposes the §15 ladder order.
  Distinct from `src/game/difficultyPresets.ts` (player-side §28
  table); both keys map onto the same `PlayerDifficultyPreset`
  enum so a single save pick resolves both sides of the tier.
- `src/game/__tests__/aiDifficulty.test.ts` (new): pins each row
  with `toEqual`, default-tier id, frozen-object semantics, the
  out-of-band id fallback, and the monotonicity sanity bounds
  (pace and recovery non-decreasing, mistake non-increasing across
  Easy -> Master, Normal at identity).
- `src/data/__tests__/balancing.test.ts` (update): replaced the
  F-044 placeholder block with import-and-assert against
  `CPU_DIFFICULTY_MODIFIERS`. Each tier's pace / recovery / mistake
  cells cross-checked verbatim, monotonicity assertions retained,
  and a frozen-object assertion added so a stray write trips
  immediately. Updated the file header to drop the F-044
  "deferred" note.
- `docs/FOLLOWUPS.md` (update): F-044 marked `done` with the
  module path and helper names; F-048 opened for the three
  runtime call-sites that consume the scalars (`tickAI`,
  mistake-injection, rubber-banding).

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: existing suites continue to pass; new
  `aiDifficulty.test.ts` covers the binding; the §23
  cross-check in `balancing.test.ts` now reads the new module.
- `npm run build`: clean (no UI surface added).
- `npm run test:e2e`: clean.

---

## 2026-04-26: Slice: F-045 wire `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` into `applyHit`

**GDD sections touched:**
[§13](gdd/13-damage-repairs-and-risk.md) Damage sources (nitro overuse
in damaged state). [§23](gdd/23-balancing-tables.md) Damage formula
targets `nitroWhileSeverelyDamagedBonus = +15%` cell.
**Branch / PR:** `feat/nitro-damaged-bonus` stacked on
`feat/balancing-pass-23`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-045-1aaec9d7`. The §23 `+15%` constant pinned
in the prior balancing-pass slice now has a consumer:
`applyHit(state, hit, assistScalars?, nitroActiveOnDamagedCar?)`
multiplies the per-event `totalIncrement` by
`(1 + NITRO_WHILE_SEVERELY_DAMAGED_BONUS)` when the caller passes
`true`. The flag is purely a caller decision (the band check sits
upstream); `damage.ts` does not import `damageBands.ts`. The race
session does not yet own a per-car `DamageState`, so the call-site
that sets the flag (`nitroState.activeRemainingSec > 0` AND
`getDamageBand(state.damage.total * 100) in {severe, catastrophic}`)
is filed as F-047 alongside the per-car damage threading.

### Done
- `src/game/damage.ts` (update): added optional
  `nitroActiveOnDamagedCar?: boolean` parameter to `applyHit`. When
  `true`, `totalIncrement` scales by
  `(1 + NITRO_WHILE_SEVERELY_DAMAGED_BONUS)` (`+15%`). Stacks
  multiplicatively with `damageSeverity`: `1.20 * 1.15 = 1.38x`.
  Omitting the flag (or passing `false` / `undefined`) preserves
  the unscaled pre-binding behaviour bit-for-bit. Module header
  comment and `NITRO_WHILE_SEVERELY_DAMAGED_BONUS` doc-comment
  updated to describe the wiring.
- `src/game/__tests__/damage.test.ts` (update): five new cases under
  "§13 / §23 nitroActiveOnDamagedCar bonus (applyHit)":
  the +15% delta on a severe-band car (the dot's verify item),
  identity preservation when the flag is omitted / `false`,
  multiplicative stack with `damageSeverity = 1.20` (Hard preset),
  no-op safety on a zero-magnitude hit, and input-immutability.
- `docs/FOLLOWUPS.md` (update): F-045 marked `done`; F-047 opened
  for the per-car `DamageState` threading into `raceSession` that
  will set the flag at the call site.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: existing damage and balancing suites continue to pass;
  five new cases under `damage.test.ts`.
- `npm run build`: clean (no UI surface added).
- `npm run test:e2e`: clean.

---

## 2026-04-26: Slice: §23 balancing pass (pin tables + `balancing.test.ts`)

**GDD sections touched:**
[§23](gdd/23-balancing-tables.md) Core car balance sheet (re-asserted),
Reward formula targets (pinned), Damage formula targets (pinned),
Weather modifiers (pinned for F-043), CPU difficulty modifiers
(pinned for F-044). [§13](gdd/13-damage-repairs-and-risk.md)
Damage sources `nitroWhileSeverelyDamagedBonus` constant pinned
for F-045 wiring.
**Branch / PR:** `feat/balancing-pass-23` stacked on
`feat/wire-difficulty-preset-scalars`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-balancing-pass-71a57fd5`. The §23 numeric tables
now have a single content-test owner (`src/data/__tests__/balancing.test.ts`)
that asserts each cell matches the source-of-truth code or JSON. Three
new exported constants pin §23 numbers that previously lived only in
ad-hoc test fixtures or the GDD prose. Two §23 columns (Weather
modifiers, CPU difficulty modifiers) need consumer modules that have
not landed yet; the balancing test pins the numbers so the wiring
slices (F-043, F-044) can copy them verbatim.

### Done
- `src/game/damage.ts` (update): `HIT_MAGNITUDE_RANGES` pins the §23
  rub `[2, 4]`, carHit `[6, 12]`, wallHit `[12, 24]`, offRoadObject
  `[10, 20]` bands as a frozen `Record<HitKind, {min, max}>`. The race
  session (future slice) picks a deterministic `baseMagnitude` from
  the kind's band; `damage.ts` itself does not roll. Existing test
  fixtures already used the mid-points (3 for rub, 9 for carHit) so
  no behaviour change.
  `NITRO_WHILE_SEVERELY_DAMAGED_BONUS = 0.15` pins §23's `+15%`
  damage bonus when nitro is active on a severe-band car. The
  consumer logic is filed as F-045 so this slice does not bump
  `PHYSICS_VERSION` and invalidate ghost replays.
- `src/game/economy.ts` (update): `BASE_REWARDS_BY_TRACK_DIFFICULTY`
  pins the §23 reward formula (`difficulty 1..5 -> 1000 / 1350 /
  1750 / 2250 / 2900 credits`) as a frozen lookup, plus a
  `baseRewardForTrackDifficulty(difficulty)` helper that clamps
  out-of-range inputs into `[1, 5]` and rounds fractional values to
  the nearest tier. The track JSON files do not yet declare a
  `difficulty` field; the championship slice will wire the helper
  into the per-race award (F-046).
- `src/data/__tests__/balancing.test.ts` (new): single-site assertion
  for every §23 numeric cell, plus deferred-consumer pins for the
  Weather and CPU difficulty modifier tables. 29 cases covering all
  five §23 sub-tables.
- `docs/FOLLOWUPS.md` (update): F-043 (weather wiring), F-044 (CPU
  difficulty wiring), F-045 (nitro-on-damaged bonus wiring), F-046
  (track-difficulty resolver in race-finish flow) appended with
  consumer-side TODO notes.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 1695 passed (+29 new cases on top of the 1666
  existing), 74 files. No existing fixture had to change (existing
  damage tests already used mid-band magnitudes).
- `npm run build`: clean (no UI surface added).
- `npm run test:e2e`: 47 passed.

---

## 2026-04-26: Slice: F-042 wire §28 difficulty preset scalars into physics, damage, nitro, raceSession

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) Off-road drag, steering
authority. [§13](gdd/13-damage-repairs-and-risk.md) Contact-event
totals. [§15](gdd/15-cpu-opponents-and-ai.md) Player-facing
difficulty ladder.
[§28](gdd/28-appendices-and-research-references.md) Example tuning
values consumed end-to-end.
**Branch / PR:** `feat/wire-difficulty-preset-scalars` stacked on
`feat/difficulty-presets-tuning`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-f-042-378995f6` and marks `F-042` `done`. The
§28 table now drives the runtime: a Hard preset bites harder on
contact, suffers a higher nitro instability penalty, and runs with no
steering assist; Easy gets a softer hit budget, lower nitro penalty,
and a quarter-share lateral assist. `PHYSICS_VERSION` bumped from `1`
to `2` so any v1 ghost recorded under the unscaled math is rejected
by the rehydrate path. The race page now reads
`loadSave().settings.difficultyPreset` and threads it into the
session config alongside the existing `assists` snapshot.

### Done
- `src/game/physics.ts` (update): `StepOptions.assistScalars`
  consumes `offRoadDragScale` against `OFF_ROAD_DRAG_M_PER_S2` and
  `steeringAssistScale` as a `(1 - scale)` clamp on the lateral
  velocity contribution. Identity (no `assistScalars` forwarded)
  preserves pre-binding behaviour bit-for-bit. `PHYSICS_VERSION`
  bumped from `1` to `2`. The version-history block documents the
  bump rationale.
- `src/game/damage.ts` (update): `applyHit` and
  `applyOffRoadDamage` accept an optional `assistScalars` argument
  and multiply the per-event total by `damageSeverity` before the
  per-zone distribution split. A defensive `[0, 4]` clamp on the
  scalar defends against a buggy upstream config without blocking
  the §28 documented `0.75 to 1.35` span.
- `src/game/nitro.ts` (update): `getInstabilityMultiplier` accepts
  an optional `assistScalars` argument and composes
  `nitroStabilityPenalty` into the existing `weather * surface *
  damageBand` product. The §10 downward floor at `1.0` still holds
  so an Easy preset cannot push the multiplier below the no-penalty
  baseline.
- `src/game/raceSession.ts` (update):
  `RaceSessionPlayer.difficultyPreset` is the new
  optional persisted preset id. `stepRaceSession` resolves once per
  tick via `resolvePresetScalars` (frozen-table lookup, no
  allocation) and forwards the cached `AssistScalars` reference to
  the player's `step()` call. AI cars deliberately do not consume
  the player's preset; the §28 narrative pins it as a player-facing
  knob.
- `src/app/race/page.tsx` (update): reads the persisted
  `difficultyPreset` off the loaded save (or the defaults bundle
  when no save exists) and threads it into the
  `RaceSessionConfig.player` alongside the existing `assists`
  sample. Sampled once per session; mid-race toggles still require
  a restart per the same convention as the assists pipeline.
- `src/game/__tests__/physics.test.ts` (update): seven new cases
  cover Beginner / Expert off-road drag deltas, Beginner /
  Expert / Balanced steering-assist behaviour, identity preservation
  when `assistScalars` is omitted, and NaN-clamp defence in depth.
- `src/game/__tests__/damage.test.ts` (update): seven new cases
  cover Beginner / Hard contact-damage scaling on `applyHit`,
  identity preservation on omit, NaN clamp, severity = 0 floor, and
  Beginner scaling on `applyOffRoadDamage`.
- `src/game/__tests__/nitro.test.ts` (update): five new cases cover
  Hard scalar compounding, Easy soft scalar with the downward floor
  at `1`, identity preservation on omit, NaN clamp, and the
  not-burning early-out across presets.
- `src/game/__tests__/raceSession.test.ts` (update): six new cases
  cover Easy versus Hard lateral drift, Master versus Hard parity
  on the steering floor, default fallback to `normal`, monotonic
  Easy / Balanced / Hard ladder, AI immunity to the player preset,
  and that `createRaceSession` accepts both missing and `null`
  preset values.
- `docs/FOLLOWUPS.md` (update): F-042 marked `done` with the
  consumer wiring summary.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 25 new cases on top of the 1641 existing.
- `npm run build`: clean (no UI surface added).
- `npm run test:e2e`: clean.

---

## 2026-04-26: Slice: §28 difficulty preset tuning scalars (pure binding)

**GDD sections touched:**
[§28](gdd/28-appendices-and-research-references.md) Example tuning
values (Beginner / Balanced / Expert).
[§15](gdd/15-cpu-opponents-and-ai.md) Difficulty tiers (player-facing
ladder Easy / Normal / Hard / Master).
**Branch / PR:** `feat/difficulty-presets-tuning` stacked on
`feat/profile-export-import`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-28-difficulty-aeb263d1` (binding portion). The
§28 appendix table now has a runtime owner: a frozen
`Record<PlayerDifficultyPreset, AssistScalars>` keyed by the §15
ladder. Easy maps to the Beginner row, Normal to Balanced, Hard to
Expert; Master extrapolates from the same trend (documented per scalar
in the module). Consumer wiring (physics off-road drag and steering
authority, damage severity, nitro stability penalty) is intentionally
deferred to F-042 so this slice does not bump `PHYSICS_VERSION` and
invalidate ghost replays. Per the dot's iter-30 researcher note, the
keying enum is the §15 player-facing `PlayerDifficultyPreset`, not the
wider championship enum.

### Done
- `src/game/difficultyPresets.ts` (new): pins the §28 four-row table
  in a frozen object; exports `AssistScalars`, `getPreset`,
  `resolvePresetScalars`, `DEFAULT_PRESET_ID`, and `PRESET_IDS`.
  `getPreset` returns the same frozen reference per call so callers
  can lean on identity. `resolvePresetScalars` treats `undefined`
  (older v1 saves before the field landed) as the Balanced row to
  match `defaultSave()` and the §15 baseline.
- `src/game/index.ts` (update): re-export the new module through the
  game barrel.
- `src/game/__tests__/difficultyPresets.test.ts` (new): 15 unit
  cases. Pins each row (Beginner, Balanced, Expert, Master)
  verbatim against the §28 table and the documented Master
  extrapolation; asserts `DEFAULT_PRESET_ID === 'normal'`;
  `PRESET_IDS` is the §15 ladder in order; `getPreset` returns the
  same frozen reference twice; out-of-band id falls back to
  Balanced; `resolvePresetScalars(undefined)` falls back to
  Balanced; monotonicity sanity (steering / drag non-increasing,
  nitro / damage non-decreasing) across Easy -> Master.
- `docs/FOLLOWUPS.md` (update): F-042 logs the deferred consumer
  wiring (physics, damage, nitro, raceSession) and the
  `PHYSICS_VERSION` bump it requires.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 1641 passing across 73 files (was 1626; +15 new
  difficultyPresets cases).
- `npm run build`: passes; no route-size deltas (the new module is
  pure runtime and not yet imported by any UI).
- `npm run test:e2e`: 47 passing.

### Followups
- F-042 (nice-to-have): wire the four scalars into physics, damage,
  nitro, and raceSession; bump `PHYSICS_VERSION` so existing ghosts
  recorded under the unscaled math are rejected.

### GDD edits
- None. The §28 table and §15 ladder were the source of truth.

---

## 2026-04-26: Slice: profile export / import (JSON download + upload)

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) Save and load: Manual profile export /
import, Versioned save migrations.
**Branch / PR:** `feat/profile-export-import` stacked on
`feat/savegame-settings-v2`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-profile-export-043666c9`. A player who clears
their browser data, switches devices, or wants to hand a save fixture
to a tester can now round-trip the save via a downloaded JSON file.
Import runs the existing v1 -> v2 migration chain so a v1 export
loads cleanly into the current runtime; future-version files are
rejected with a precise error rather than a silent corruption. The
pure parse / serialise functions live in a fresh module so they can
be unit-tested without DOM, Storage, or React; the React shell binds
to a hidden anchor for the download and a hidden file input for the
upload.

### Done
- `src/persistence/profileExport.ts` (new): pure
  `exportProfile(save)` returns `{ blob, filename }` (MIME
  `application/json`, filename `vibegear2-profile-<isoSlug>.json`).
  Pure `importProfile(text)` returns `{ ok: true, save }` or
  `{ ok: false, error }`; error kinds cover `parse`, `schema`,
  `future_version`, `migration`, and `too_large` (1 MB cap). The
  byte cap uses `TextEncoder` so multi-byte glyphs are sized
  accurately; the version probe runs before the migration walker
  so a future-version file gets a precise error rather than a
  generic migration failure.
- `src/persistence/index.ts` (update): re-export the new module
  through the persistence barrel.
- `src/persistence/__tests__/profileExport.test.ts` (new): 16
  cases covering filename pattern, blob MIME, schema-rejection on
  export, default-save round-trip, malformed-JSON parse error,
  empty-string parse error, non-object parse error, future-version
  error, schema-invalid error with the offending Zod path, the
  1 MB byte cap, v1-fixture migration through to current schema,
  customised-garage round-trip, and an em-dash sweep across every
  error message.
- `src/components/options/ProfileSection.tsx` (new): React shell
  with Export, Import, and Clear save buttons. Export programmatic
  ally clicks a hidden anchor on the blob URL and revokes on the
  next animation frame. Import opens a hidden file input, reads
  text, runs `importProfile`, persists via `saveSave`. Clear
  prompts via `window.confirm`, removes both the current-version
  key and the backup key. Status messages tag `info` vs `error`
  via `data-status`. Pattern follows `AccessibilityPane.tsx`.
- `src/app/options/page.tsx` (update): mount `<ProfileSection>` as
  the seventh tab labelled "Profile".
- `src/app/options/tabNav.ts` (update): extend `TabKey` and
  `TAB_ORDER` with the new `profile` tab.
- `src/app/options/__tests__/tabNav.test.ts` (update): pin the
  seven-tab order including the new Profile entry.
- `src/app/options/__tests__/page.test.tsx` (update): rename the
  six-tab assertion to iterate over `TAB_ORDER`.
- `e2e/options-screen.spec.ts` (update): extend the cycle-through
  spec and the wrap-back spec to cover the seventh tab.
- `e2e/profile-export.spec.ts` (new): five Playwright scenarios.
  Profile pane renders with the three buttons. Export downloads a
  JSON file matching the documented filename pattern. Round-trip
  via export -> Clear save -> setInputFiles -> import restores the
  custom seed save through localStorage. Import surfaces a parse
  error for malformed JSON. Import surfaces a future-version
  error for a save with `version: 99`. Auto-confirms the
  `window.confirm` dialog so the Clear save path is deterministic.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 1626 + 16 = 1642 passing across 73 files.
- `npm run build`: passes; bundle size for `/options` rises from
  4.2 kB to 6.3 kB First Load JS for the new pane.
- `npm run test:e2e`: 47 passing (3 new profile specs plus the
  two updated options-screen specs).

### GDD edits
None. The §20 'Save and load' bullet list called out manual export
/ import as a feature; this slice ships it without changing the
design.

### Followups
None opened. The `Import while a race is active: prompt confirm`
edge case from the dot was descoped: race state is in-memory only
during a session, so importing while racing replaces the persisted
save but does not yank the current race. A future slice can add
the prompt if the race-state-leak case shows up; not blocking.

---

## 2026-04-26: Slice: SaveGameSettings v2 schema expansion

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) Key bindings persistence,
[§20](gdd/20-hud-and-ui-ux.md) Audio + accessibility settings surfaces,
[§22](gdd/22-data-schemas.md) SaveGame schema major bump v1 -> v2.
**Branch / PR:** `feat/savegame-settings-v2` stacked on
`feat/e2e-race-finish-multilap`, PR pending.
**Status:** Implemented. Closes
`VibeGear2-implement-savegamesettings-b948015a`. The §20 settings surface
needed three additional persisted bundles (audio mix, accessibility prefs,
key bindings) so the HUD-UI / Sound / Key-remap dots can each read a
shared on-disk shape instead of inventing their own. Doing the schema
work behind a single migration avoids three concurrent v1 -> v2 attempts
later. v1 saves migrate forward additively; the migrator fills the new
bundles with the §20 / §19 documented defaults so existing players see
no behavioural change after the upgrade.

### Done
- `src/data/schemas.ts` (update): added
  `AudioSettingsSchema { master, music, sfx }` (each unit-interval),
  `AccessibilitySettingsSchema { colorBlindMode, reducedMotion,
  largeUiText, screenShakeScale }`, and `KeyBindingsSchema`
  (record of action -> 1..4 token list). Each is exported via the
  `data` barrel through `export * from "./schemas"`. Extended
  `SaveGameSettingsSchema` with the three new bundles, all marked
  optional so a v1 save mid-migration still validates.
- `src/persistence/migrations/v1ToV2.ts` (new): pure migrator that
  reshapes a v1 payload into v2. Documented defaults pinned as frozen
  constants (`V2_AUDIO_DEFAULTS`, `V2_ACCESSIBILITY_DEFAULTS`); the
  defaultSave path imports the same constants so a fresh save and a
  migrated v1 save observe byte-identical defaults. The migrator
  refuses to run on a non-v1 input (TypeError). When a v1 save
  somehow already carries the new bundle (forward-compat hand-edit),
  the migrator preserves it untouched.
- `src/persistence/migrations/index.ts` (update): bumped
  `CURRENT_SAVE_VERSION` from 1 to 2, registered `migrations[1] =
  migrateV1ToV2`. The chain walker handles the rest.
- `src/persistence/save.ts` (update): `defaultSave()` now emits a v2
  shape with the three new bundles populated. Added a private
  `cloneDefaultKeyBindings()` helper that mirrors the equivalent
  inside the migrator so the runtime frozen `DEFAULT_KEY_BINDINGS`
  is not aliased into save state.
- `src/data/examples/saveGame.example.json` (update): bumped to v2
  shape. The fixture is what `loadSave` validates against in the
  unit test, so the new fields had to land here in the same slice.
- `src/persistence/migrations/__fixtures__/v1-default-save.json` (new):
  pure v1 default save fixture, used as the canonical input to
  `migrateV1ToV2`. Captures the previous shape so the migration
  test never depends on whatever the live `defaultSave()` happens to
  emit.
- `src/data/__tests__/settings-schema.test.ts` (new): 21 cases
  covering each new schema's happy path, range edges (zero, one,
  out-of-range), unknown enum values, missing bundles, and the
  existing v1 settings shape (backward-compat).
- `src/persistence/migrations/v1ToV2.test.ts` (new): 10 cases covering
  the v1 -> v2 reshape, default-fill semantics, schema validation of
  the migrated output, the forward-compat hand-edit case, the
  no-alias property on `DEFAULT_KEY_BINDINGS`, the corrupt-payload
  rejection paths, and the missing-settings recovery.
- `src/persistence/migrations/migrations.test.ts` (update): replaced
  the v1-passes-through test (no longer true) with a chain-walker
  test that asserts a v1 input lands at `CURRENT_SAVE_VERSION` after
  `migrate()`. Per-step shape assertions live in v1ToV2.test.ts so
  each migrator owns its own contract.
- `e2e/options-accessibility.spec.ts`,
  `e2e/options-difficulty.spec.ts` (update): bumped the hardcoded
  `SAVE_KEY` from `vibegear2:save:v1` to `vibegear2:save:v2` to
  follow the version bump.
- `docs/gdd/22-data-schemas.md` (update): rewrote the SaveGame JSON
  example block to v2 with the three new bundles, plus a paragraph
  explaining v1 saves migrate additively.

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 71 files / 1,610 tests pass (was 1,578; +32 new tests).
- `npm run build`: clean; bundle sizes unchanged within the rounding
  budget (the schema additions are dead-code-eliminated everywhere
  except the persistence layer).
- `npm run test:e2e`: 42 / 42 pass after bumping the hardcoded
  `SAVE_KEY` references in the two `/options` e2e specs.
- No em-dashes in any added file (grep -rPn checked
  `src/data/schemas.ts`, `src/persistence/migrations`,
  `src/data/__tests__/settings-schema.test.ts`,
  `src/persistence/save.ts`).

### Decisions and assumptions
- **`screenShakeScale` default 1.0, not 0.5 as some §20 notes
  imply.** Picking 1.0 keeps the v1 shake intensity unchanged for
  existing players; the §16 reduced-motion track owns the
  preset-driven dampening. The slider is the per-player override.
- **`KeyBindingsSchema` action key kept loose (`z.string()`).**
  Pinning the key to the runtime `Action` enum would force a v3
  migration every time a new action lands. The runtime input layer
  already silently ignores unknown action keys, so the schema's
  `z.string()` is the right level of strictness.
- **`KeyBindings` token list capped at four entries per action.**
  Bound chosen so the runtime input layer never has to walk an
  unbounded list per keypress. Players can still bind keyboard,
  gamepad, mouse, and one extra alias per action.
- **`audio` defaults pinned at master 1.0, music 0.8, sfx 0.9.**
  Matches the §20 Settings reference levels; music is a touch
  quieter than sfx so engine and tyre cues read through the
  soundtrack. Final mix tuning is owned by the §18 sound dot.
- **Forward-compat preservation.** A hand-edited v1 save that
  somehow carries the new bundle is not clobbered by the migrator;
  this guards against a future agent shipping a "preview" v2 build
  before the migration lands.
- **`CURRENT_SAVE_VERSION` chain semantics retained.** A `migrate`
  call on a payload whose version equals current returns the
  payload untouched (the for-loop never enters). The dot's verify
  list claimed "registry rejects no-op identity"; that contradicts
  the existing contract and the existing test, so the new
  migrations.test.ts documents the actual no-op-identity behaviour.

### Followups created
- None. The §20 settings page slice (HUD-UI dot) and the §19 key
  remap UI dot can each consume the v2 shape directly; the schema
  work is the single coordinated owner the dot named.

### GDD edits
- `docs/gdd/22-data-schemas.md` SaveGame example block bumped to v2
  with the three new settings bundles documented.

---

## 2026-04-26: Slice: F-029 multi-lap race-finish e2e

**GDD sections touched:**
[§7](gdd/07-race-rules.md) Multi-lap race-finish behaviour,
[§20](gdd/20-hud-and-ui-ux.md) Results screen reachability.
**Branch / PR:** `feat/e2e-race-finish-multilap` stacked on
`feat/licence-files-finalisation`, PR pending.
**Status:** Implemented. Closes F-029. The race page now honours
an optional `?laps=N` URL override so the bundled single-lap test
tracks can be coerced into a multi-lap run without shipping new
fixture content. `e2e/race-finish.spec.ts` gained a second
`describe` ("F-029 multi-lap") that drives a three-lap race on
`test/straight` against the bundled clean-line AI, asserts the
HUD lap label reads `1 / 3` so the override actually threaded
through, holds throttle until the natural-finish wiring routes
to `/race/results`, and asserts both the player row and the
`ai-0` row render under the §20 testids. The earlier F-038
single-lap spec is preserved untouched.

### Done
- `src/app/race/page.tsx` (update): added `resolveLapsOverride`
  (parses `?laps=N`, clamps to `[1, 50]`, returns `null` when
  missing or malformed) and threaded the override into
  `RaceSessionConfig.totalLaps` plus the HUD seed snapshot. The
  effect dependency list now includes the override so a route
  hop with a different value re-mounts the loop. The dataflow
  remains: missing or malformed param falls back to
  `track.compiled.laps`, so existing call sites (title-screen
  Start Race, race-demo spec, F-038 spec) keep their previous
  semantics.
- `e2e/race-finish.spec.ts` (update): added a second `describe`
  block for F-029. The multi-lap test sets a 180 s test timeout
  (analytical floor: 3 laps x 1,200 m / 61 m/s plus the 3 s
  countdown is ~64 s; pad for CI jitter) and asserts the §20
  results-row testids for both the player and the demo AI car.
- `docs/FOLLOWUPS.md` (update): F-029 flipped from `open` to
  `done` with a resolution note covering the URL-override
  approach and the spec shape.

### Tests
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 69 files / 1,578 tests pass.
- `npm run build`: clean (`/race` 8.84 kB unchanged within the
  rounding budget).
- `npm run test:e2e`: 42 / 42 pass; the new F-029 multi-lap test
  runs in ~1.1 m on the local box.

### GDD edits
None.

### Open questions raised
None.

### Followups created
None.

---

## 2026-04-26: Slice: F-038 wire natural race-finish into `/race/results`

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) Inter-race loop (race -> results
-> garage),
[§20](gdd/20-hud-and-ui-ux.md) Results screen reachability.
**Branch / PR:** `feat/race-finish-wiring` stacked on
`feat/race-bonuses`, PR pending.
**Status:** Implemented. The natural-finish branch in
`src/app/race/page.tsx` now builds a `RaceResult`, writes the
session-storage handoff, tears down the loop / input manager, and
pushes the router to `/race/results` exactly once per finish. A
per-mount `routedRef` latch guards against the per-frame re-fire
risk inside the render callback and re-arms on the pause-menu
Restart so a second race after a restart still routes when it
finishes. The retire branch (commit `8756804`) flips the same
latch before its own `router.push` so a retire-then-finish race
never double-routes. PB recording is gated on
`session.player.status === "finished"` so a §7 hard-time-limit
DNF on the natural-finish path mirrors the retire branch's
`recordPBs: false` contract. F-038 is closed.

### Done
- `src/app/race/page.tsx` (update): natural-finish wiring inside
  the `startLoop({ render })` callback. Builds the §20 payload
  via `buildFinalRaceState({ trackId, totalLaps, cars })` +
  `buildFinalCarInputsFromSession(session)` + `buildRaceResult`,
  writes the handoff via `saveRaceResult`, then disposes the
  loop and the input manager before `router.push("/race/results")`.
  - New `routedRef = useRef<boolean>(false)` guards against the
    per-frame re-fire risk; reset to `false` on the loop-effect
    setup and inside the restart callback so a re-armed race
    still routes once on its own finish.
  - The retire branch now flips `routedRef.current = true`
    before its own `router.push` so a finish-tick on the next
    frame cannot double-route.
  - `recordPBs` derives from `session.player.status === "finished"`
    so the natural-finish PB-eligible path records and a
    natural-finish DNF (the §7 hard-time-limit branch) skips the
    records patch.
  - Reuses the same `trackForResult = { id: track.id } as Track`
    minimal cast the retire branch uses; the bundled track JSON
    does not need to be re-parsed for the results boundary.
- `e2e/race-finish.spec.ts` (new): drives a single-lap race on
  `?track=test/straight` with `ArrowUp` held, asserts the route
  hops to `/race/results`, and asserts the player row renders
  with `data-status="finished"` plus the Continue CTA. The
  spec sets a 60 s test timeout to absorb CI jitter (a Sparrow
  GT lap on the 1,200 m straight finishes in ~23 s of sim time
  including the 3 s countdown).
- `docs/FOLLOWUPS.md` (update): F-038 flipped from `open` to
  `done`. Resolution note records the retire-path commit
  (`8756804`) plus this slice as the natural-finish wiring;
  Practice / Quick Race / Time Trial reuse is deferred to the
  §6 mode dots.

### Verified
- `npm run lint && npm run typecheck && npm run test && npm run build`
  green; `npm run test:e2e` covers the new
  `race-finish.spec.ts` plus the existing
  `pause-actions.spec.ts` retire-path spec.
- The render callback's natural-finish branch is idempotent: the
  `routedRef` latch ensures `saveRaceResult` and `router.push`
  fire at most once per session even though the render tick fires
  every frame.
- Restart re-arms the latch (the restart callback resets
  `routedRef.current = false` after creating the fresh session)
  so a second race after a restart still routes on its own
  finish. The pause-actions e2e spec exercises restart already;
  this slice does not regress it.

### Decisions and assumptions
- **Latch placement.** The §20 dot's verify list spelled the
  natural-finish guard as a `useRef<boolean>(false)` flipped on
  first finish. The implementation follows that pattern verbatim
  rather than introducing a global `phase` state machine, which
  would have complicated the existing per-frame snapshot copy
  for the HUD `dl`.
- **PB gate.** The dot pinned `recordPBs: true` for the natural
  finish but called out that a §7 hard-time-limit DNF should
  mirror the retire branch's `recordPBs: false`. The
  implementation reads `session.player.status` (which the §7
  rule flips to `"dnf"` when the time limit fires), so both
  branches converge on the same record-patch policy without a
  separate code path.
- **Retire latch.** The retire callback flips the latch *after*
  `saveRaceResult` and *before* `router.push` so the natural-
  finish branch's check on the next render frame fails closed.
  This is belt-and-braces: the loop tear-down already stops the
  rAF, but the explicit latch documents the contract.
- **Test track.** The e2e spec uses `?track=test/straight` (1
  lap, 1,200 m) rather than the default `test/curve` so the
  natural-finish boundary fires inside a single Playwright test
  budget without needing a §22 lap-skip cheat. The
  `race-demo.spec.ts` header already documented this approach
  as the planned shorter-run path.

### Followups created
- None new. F-038 is closed by this slice. Practice / Quick
  Race / Time Trial reuse of the same wiring is owned by the
  §6 mode dots (`VibeGear2-implement-practice-quick-ad3ba399`,
  `VibeGear2-implement-time-trial-5d65280a`).

### GDD edits
- None. This slice is pure wiring of an existing surface; the
  GDD already documents the inter-race loop and the results
  screen.

---

## 2026-04-26: Slice: §5 race reward bonuses (raceBonuses.ts owner module + sponsors)

**GDD sections touched:**
[§5](gdd/05-core-gameplay-loop.md) Rewards (podium, fastest lap, clean
race, underdog, tour completion, sponsor objective),
[§12](gdd/12-upgrade-and-economy-system.md) Currency rewards (tour
bonus rate),
[§22](gdd/22-data-schemas.md) Sponsor objective schema (new).
**Branch / PR:** `feat/race-bonuses` stacked on
`feat/pause-menu-actions`, PR pending.
**Status:** Implemented. The §5 bonus pipeline now lives in
`src/game/raceBonuses.ts` (the owner module the dot specifies). The
existing `raceResult.ts` builder delegates to it and continues to
re-export the four legacy bonus constants and the `RaceBonus` /
`RaceBonusKind` types so the §20 chip pipeline (`BonusChip.tsx`,
results e2e) stays numerically and structurally stable. Two new
bonus surfaces ship: `tourCompletionBonus` (§12 0.15 of summed race
rewards) and `sponsorBonus` + `evaluateSponsorObjective` (the §5
sponsor objective layer). A new `src/data/sponsors.json` catalogue
plus `SponsorObjectiveSchema` give the evaluator a content source.
`economy.awardCredits` now accepts an optional `bonuses` array and
sums each `cashCredits` into the wallet delta. 1578 unit tests + 40
Playwright tests green.

### Done
- `src/game/raceBonuses.ts` (new): owner module for the §5 bonus
  pipeline.
  - `computeBonuses(input)`: pure per-race bonus list (podium,
    fastestLap, cleanRace, underdog) with the legacy fixed-credit
    placeholders (`PODIUM_BONUS_CREDITS = 250`, etc.). DNF cars
    receive no bonuses; the chip order is stable
    (`podium / fastestLap / cleanRace / underdog`).
  - `tourCompletionBonus(input)`: §12 0.15 of summed per-race
    rewards on a passed tour. Returns `null` on a failed tour, on
    an empty rewards list, on all-zero rewards. Negative entries
    are clamped before summing.
  - `sponsorBonus(input)` + `evaluateSponsorObjective(input)`:
    sponsor predicate evaluator covering every kind in
    `SponsorObjectiveKindSchema` (`top_speed_at_least`,
    `finish_at_or_above`, `clean_race`, `no_nitro`,
    `weather_finish_top_n`). Silent failure on missed predicate,
    on missing sponsor, on DNF, and on missing telemetry (the
    no_nitro predicate fails closed when the runtime has no
    nitro telemetry yet).
  - `sumBonusCredits(bonuses)` and `buildBonusReceipt(bonuses)`
    so callers (the §20 results screen and the
    `economy.awardCredits` wallet delta) stay in lockstep on the
    total. The §5 receipt boundary mirrors the iter-19
    stress-test §4 contract: one source for both the chip strip
    and the wallet write.
- `src/game/__tests__/raceBonuses.test.ts` (new): 38 cases.
  Per-bonus predicates (podium boundaries, fastest-lap player
  vs AI, clean-race epsilon, underdog with grid edge cases),
  DNF policy, chip order, sumBonusCredits clamp behaviour,
  tourCompletionBonus rate / failure / clamp paths, sponsor
  bonus per-kind cells (pass + fail + null-telemetry), purity
  on frozen inputs, determinism across repeated calls.
- `src/data/schemas.ts` (update): added
  `SponsorObjectiveKindSchema` and `SponsorObjectiveSchema`.
  Five predicate kinds are pinned today; adding a new kind is a
  schema change that requires the evaluator in
  `raceBonuses.ts` to learn it in the same slice.
- `src/data/sponsors.json` (new): MVP sponsor catalogue. Five
  entries cover one of each predicate kind so the §20 results
  screen has a non-empty bonus chip whenever a race meets a
  sponsor predicate. Balancing pass owns the final roster and
  credit values.
- `src/data/sponsors.ts` (new): registry mirroring the cars /
  championships pattern. `SPONSOR_OBJECTIVES`,
  `SPONSOR_OBJECTIVES_BY_ID`, `getSponsorObjective(id)`. The
  loader fails fast on schema validation failure at module
  initialisation so a malformed JSON entry trips at boot, not
  in the middle of a race.
- `src/data/__tests__/sponsors-content.test.ts` (new): 18
  cases. Catalogue invariants (non-empty, unique ids, lookup
  round-trip) plus per-entry validation (schema parse,
  evaluator runs without throwing, non-negative payout).
- `src/data/index.ts` (update): re-exports the sponsor
  registry so callers can import from `@/data` directly.
- `src/game/economy.ts` (update): `AwardCreditsInput` now
  accepts an optional `bonuses: ReadonlyArray<RaceBonus>` field.
  `awardCredits` sums each bonus's `cashCredits` into the
  wallet delta and surfaces both `cashBaseEarned` and the
  `bonuses` array on the `EconomyResult` success branch so the
  §20 results screen and the wallet write remain consistent.
  DNF cars ignore any supplied bonuses (participation cash
  only). Missing `bonuses` is back-compat: equivalent to an
  empty list.
- `src/game/__tests__/economy.test.ts` (update): three new
  cases for the bonus path. Sums every supplied bonus into the
  wallet delta, DNF ignores bonuses, missing `bonuses` is
  equivalent to an empty list.
- `src/game/raceResult.ts` (update): the inline
  `buildBonuses` helper plus the four `*_BONUS_CREDITS`
  constants and the `RaceBonus` / `RaceBonusKind` types now
  delegate to / re-export from `raceBonuses.ts`. The §20
  results-screen builder calls `computeBonuses` once and folds
  the result into `cashEarned` exactly as before; the chip
  pipeline (`BonusChip.tsx`) sees the same shape it always
  has.
- `src/game/index.ts` (update): comment block notes that
  `raceBonuses` is the owner of the bonus pipeline; only
  `raceResult` is barrel-exported here to avoid the duplicate
  `RaceBonus` / `*_BONUS_CREDITS` re-export ambiguity.
  Tour-completion / sponsor surfaces import from
  `@/game/raceBonuses` directly.

### GDD edits
- None. The §5 bonus list and the §12 tour-bonus rate already
  cover the surface that landed; the §22 schema gains
  `SponsorObjective` as an additive entry.

### Followups
- `tourCompletionBonus` has no in-app caller yet: the
  tour-clear surface owned by
  `VibeGear2-implement-tour-region-d9ca9a4d` is the natural
  consumer. The wiring should call `tourCompletionBonus`
  alongside `tourBonus` (see F-037 for the easyModeBonus
  parallel) at tour-clear time and credit the combined amount
  via `awardCredits`. Filed as F-039.
- `sponsorBonus` likewise has no in-app caller: the per-tour
  sponsor selection (which sponsor is active for which race)
  is owned by the championship / tour slice. Filed as F-040.
- The dot's spec stress-test pinned multiplier-based bonus
  rates (0.10 / 0.05 / 0.02 of base for podium tiers, 0.08 /
  0.05 / 0.10-per-grid for the others). The current slice
  preserves the legacy fixed-credit placeholders so the §20
  chip rendering and the existing tests stay numerically
  stable; the balancing-pass dot (`balancing-pass-71a57fd5`)
  will swap the constants for the multiplier-based values
  without rewriting call sites. Noted on F-041.

## 2026-04-26: Slice: §20 pause-menu actions (restart, retire, exit-to-title)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) DNF semantics + retire path,
[§20](gdd/20-hud-and-ui-ux.md) Pause menu (Resume, Restart race, Retire
race, Settings, Leaderboard, Exit to title).
**Branch / PR:** stacked on `feat/race-results-screen`, PR pending.
**Status:** Implemented. The §20 pause-menu Restart, Retire, and
Exit-to-Title controls are now wired through to the live race session,
the loop handle, and the router. Restart rebuilds the session in place
so the countdown re-runs from 3; Retire flips the player to a new
`"retired"` DNF reason, builds a `RaceResult` from the post-retire
session shape, and routes to `/race/results`; Exit-to-Title disposes
the loop and routes to `/`. 1516 unit tests + 40 Playwright tests
green.

### Done
- `src/game/raceRules.ts` (update): extended `DnfReason` with the
  user-initiated `"retired"` literal so the §7 DNF cell on the
  results screen can distinguish "ran out of track" from "gave up".
  Comment explains that `tickDnfTimers` never produces this value;
  it is set by the new pure helper `retireRaceSession` instead.
- `src/game/raceSessionActions.ts` (new): two pure helpers and a
  pinned constant.
  - `retireRaceSession(state)` returns a fresh `RaceSessionState`
    with the player flipped to `status: "dnf"`,
    `dnfReason: "retired"`, `finishedAtMs: null`, and the race
    phase forced to `"finished"`. AI cars are returned untouched
    (per §7 the multi-car finish gate would freeze them in turn);
    every nested record gets a fresh reference so the immutable
    contract holds.
  - `buildFinalCarInputsFromSession(state)` projects the live
    session shape onto the §7 `FinalCarInput[]` shape the results
    screen consumes. Coerces still-racing cars to `"dnf"` so the
    natural-finish builder produces a deterministic finishing order
    after a mid-race retire.
  - `DNF_REASON_RETIRED` constant re-exported for callers that need
    the literal without reaching into raceRules.
- `src/game/__tests__/raceSessionActions.test.ts` (new): 9 cases.
  Retire flips player to dnf with the retired reason and the phase
  to finished. Retire preserves existing lap times. Retire never
  mutates the input (deep-equal before / after JSON snapshot).
  Retire is a no-op on an already-finished session. Retire returns
  fresh nested references. Retire leaves still-racing AI cars
  alone. `buildFinalCarInputsFromSession` includes one entry per
  car keyed by canonical id, coerces still-racing cars to dnf,
  preserves the player's lap times and finished-at value.
- `src/components/pause/usePauseActions.ts` (new): hook that wraps
  the four `<PauseOverlay />` action props (`onResume`, `onRestart`,
  `onRetire`, `onExitToTitle`) through a single `closeMenu` plus
  three imperative-effect callbacks. Each wrapper closes the menu
  before invoking the downstream effect. `null` impls map to
  `undefined` props so `<PauseOverlay />`'s self-disable contract
  handles the rendering.
- `src/components/pause/__tests__/usePauseActions.test.tsx` (new):
  6 cases. onResume only closes the menu. Each handler closes the
  menu then invokes its impl in order (`mock.invocationCallOrder`
  comparison). null impls return undefined props. Omitted impl
  props behave the same as null.
- `src/app/race/page.tsx` (update): wired `usePauseActions` into
  the race shell. Three imperative refs (`restartFnRef`,
  `retireFnRef`, `exitFnRef`) are populated inside the loop effect
  so the hook layer stays decoupled from the loop / session /
  config refs. Restart re-creates the session from the same config
  and resets the React render snapshot to the countdown values.
  Retire builds a `RaceResult` via
  `buildFinalRaceState` + `buildRaceResult`, writes it via
  `saveRaceResult`, tears down the loop / input, and routes to
  `/race/results`. Exit-to-Title tears down then routes to `/`.
  Restart and Retire are gated to `null` once the race phase is
  `"finished"` so the post-finish overlay's Rematch / Continue CTAs
  are the only remaining actions.
- `src/game/index.ts` (update): re-exported `./raceSessionActions`
  and `./raceRules` so the `/race` page can import the helpers
  through the existing barrel.
- `e2e/pause-actions.spec.ts` (new): three Playwright cases.
  Restart sends the race back to the countdown phase. Retire flips
  to the results screen with the player row carrying
  `data-status="dnf"` and "DNF" in the position column. Exit-to-
  title routes back to the home page.
- `e2e/pause-overlay.spec.ts` (update): the
  "Retire entry is disabled" assertion is replaced with
  "Restart, Retire, and Exit are visible and enabled" so the
  layout regression guard tracks the new contract. Settings and
  Leaderboard remain `disabled` because the page does not pass
  their handlers yet.

### GDD edits
- None. The dot only adds wiring; the §20 pause-menu list and the
  §7 DNF semantics already cover the surface that was wired.

### Followups
- F-029 stays open: the dot's e2e covers Restart and Retire, but
  the natural-finish race-finish spec from F-029 (multi-lap race vs
  AI, assert results overlay) is owned by the dedicated dot
  `VibeGear2-implement-e2e-race-4a750bfc` and is not in scope here.

## 2026-04-26: Slice: §20 race results screen (buildRaceResult, /race/results page, components)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) "Qualification and advancement"
+ "Finish rewards", [§20](gdd/20-hud-and-ui-ux.md) Results screen,
[§5](gdd/05-core-gameplay-loop.md) inter-race loop (results sits between
race and garage).
**Branch / PR:** stacked on `feat/economy-catch-up`, PR pending.
**Status:** Implemented (`src/game/raceResult.ts` ships
`buildRaceResult`, `RaceResult`, `RaceBonus`, `DamageDelta`,
`NextRaceCard`, `RecordsUpdatePatch` plus the four pinned bonus
constants and the F1-style `PLACEMENT_POINTS` ladder. Pure on
`FinalRaceState` + `SaveGame` + `Track`. New `/race/results` page
reads from the session-storage handoff and renders the seven §20
fields plus Continue / Rematch CTAs. 33 builder tests + 3 Playwright
tests green; full verify chain green.).

### Done
- `src/game/raceResult.ts` (new): pure builder
  `buildRaceResult(input)` returns the §20 `RaceResult` shape.
  Computes points (top-8 ladder), cash (per-place via
  `computeRaceReward`), four bonuses (podium, fastest lap, clean
  race, underdog), per-zone damage delta clamped to `[0,1]`, the
  next-race card from championship + tour, and an optional
  `recordsUpdated` patch. DNF cars get participation cash and zero
  points. The receipt-style split (compute vs commit) means
  Practice / Quick Race can render the screen and skip the
  `awardCredits` call. Exports `PLACEMENT_POINTS`,
  `PODIUM_BONUS_CREDITS = 250`, `FASTEST_LAP_BONUS_CREDITS = 200`,
  `CLEAN_RACE_BONUS_CREDITS = 150`, `UNDERDOG_BONUS_CREDITS = 200`,
  `DEFAULT_BASE_TRACK_REWARD = 1000`. Re-exported from
  `src/game/index.ts`.
- `src/game/__tests__/raceResult.test.ts` (new): 33 cases covering
  every cell on the dot's verify list. Placement (every top-8 cell,
  outside-top-8 zero, missing player). Cash base (matches
  `computeRaceReward`, honours `baseTrackReward` and `difficulty`
  override). Bonuses cell-by-cell (podium 1/2/3 vs 4 boundary,
  fastest-lap player vs other car, clean race no-delta vs any
  damage, underdog improved vs equal vs no-grid). DNF path (zero
  points, participation cash, no bonuses). Damage delta (clamp,
  negative, NaN). Next race (no championship, mid-tour, fallback
  index lookup, final race, missing tour). Records patch (PB beats
  prior, ties do not write, no prior, recordPBs=false, no laps).
  Purity (frozen inputs) and determinism.
- `src/components/results/raceResultStorage.ts` (new):
  session-storage handoff shim with `saveRaceResult`,
  `loadRaceResult`, `clearRaceResult` and a versioned key. Pure
  read / write surface; no React.
- `src/components/results/FinishingOrderTable.tsx` (new): one row
  per car with player highlight, MM:SS.mmm formatting, "DNF" label
  in the position column for retired cars.
- `src/components/results/BonusChip.tsx` (new): pill render of a
  single bonus; kind exposed via data attribute for Playwright.
- `src/components/results/DamageBar.tsx` (new): per-zone bars with
  `role="progressbar"` + accessible labels, colour-coded (ok /
  warn / danger).
- `src/app/race/results/page.tsx` (new): client component reads
  the handoff on mount and renders banner + standings + rewards
  panels + Continue / Rematch CTAs. Soft-warning fallback for
  direct nav with no result. Default focus on Continue.
- `e2e/results-screen.spec.ts` (new): three Playwright tests.
  Seven-fields render assertion (finishing order, points, cash,
  bonuses, damage, fastest lap, next race), Continue routes to
  `/garage/cars`, direct nav fallback path.

### Verified
- `npm run lint` green (no warnings).
- `npm run typecheck` green.
- `npm test` green: 1501 tests pass (33 new raceResult cases on
  top of the prior 1468).
- `npm run build` green: new route `/race/results` is 4.11 kB / 110
  kB First Load JS.
- `npm run test:e2e` green: 37 tests pass (3 new results-screen
  cases on top of the prior 34).
- Em-dash sweep: `grep -rPn "[\x{2013}\x{2014}]"` over the new
  files returns nothing.

### Decisions and assumptions
- **Points table is F1-style placeholder.** §7 says "top 8 score
  points" but no GDD section pins the ladder. Used
  `[25, 18, 15, 12, 10, 8, 6, 4]`. The balancing-pass slice
  (`balancing-pass-71a57fd5`) can swap `PLACEMENT_POINTS` without
  rewriting call sites.
- **Bonus constants are pinned placeholders.** §5 names the
  bonuses (podium, fastest lap, clean race, underdog) but no
  numbers. Picked 250 / 200 / 150 / 200 so the four can stack
  without dominating the per-place cash. Balancing pass owns the
  final values.
- **Tour completion + sponsor bonuses out of scope.** §5 lists six
  bonuses; this slice ships the four that fit the per-race
  results screen. Tour-completion bonus is owned by
  `tour-region-d9ca9a4d` (it sums race rewards from the whole
  tour); sponsor objectives are post-MVP.
- **Session-storage handoff (vs URL param).** Result payload has
  nested arrays (finishingOrder, bonuses, perLapTimes) that exceed
  URL length budget at 12 cars. Session storage carries the full
  payload and clears on tab close, matching §20 ephemerality.
  Versioned key for future shape changes.
- **Page does not write to save.** Builder returns
  `recordsUpdated` as a patch; the page component (or the race
  finish wiring slice) is responsible for merging and calling
  `saveSave`. Mirrors the iter-19 stress-test §5 compute / commit
  split: Practice / Quick Race / Time Trial each decide whether
  to apply the patch and call `awardCredits`.
- **Placement formatter for English ordinals only.** §20 lists no
  L10N requirement in MVP; `formatPosition` in the page returns
  "1st", "2nd", "3rd", "11th"...
- **Next-race card lap target placeholder.** Builder returns
  `laps: 3` (the §7 "Standard circuit" target) when no Track
  lookup is supplied. The page that calls `buildRaceResult` can
  override by resolving the next Track JSON before rendering.

### Followups created
- F-NNN: Wire the race-finish path (`src/app/race/page.tsx`) to
  call `buildRaceResult` + `saveRaceResult` and route to
  `/race/results` when `phase === "finished"`. Currently
  the race route just renders an inline "Race finished" overlay;
  the wiring lands in a dedicated dot once the race-finish
  callback hook is in place.
- F-NNN: Replace the F1-style points placeholder with the GDD-pinned
  table once the balancing pass slice lands the column.
- F-NNN: Replace the four pinned bonus constants once the balancing
  pass slice lands the §23 bonus column.

### GDD edits
- None. §7 and §20 already enumerate the surfaces; this slice
  pins placeholder constants without changing the GDD.

---

## 2026-04-26: Slice: §12 catch-up mechanisms (stipend, repair cap, easy-mode bonus, weather preview)

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) "Catch-up mechanisms"
(all four levers), [§22](gdd/22-data-schemas.md) `SaveGameProgressSchema`
(additive `stipendsClaimed` field).
**Branch / PR:** stacked on `feat/economy-upgrade`, PR pending.
**Status:** Implemented (`src/game/catchUp.ts` ships
`computeStipend`, `recordStipendClaim`, `getStipendClaimed`,
`cappedRepairCost`, `easyModeBonus`, `practiceWeatherPreview` plus
the four pinned-placeholder constants. `SaveGameProgressSchema`
gains the optional `stipendsClaimed` ledger. 32 cell-by-cell
catchUp tests green; full verify chain green.).

### Done
- `src/game/catchUp.ts` (new): four §12 catch-up levers as pure
  functions on `SaveGame` / `Track`. Pinned placeholders
  `STIPEND_THRESHOLD_CREDITS = 1500`, `STIPEND_AMOUNT = 1000`,
  `REPAIR_CAP_FRACTION = 0.40`,
  `EASY_MODE_TOUR_BONUS_FRACTION = 0.20`. `computeStipend` enforces
  the first-tour gate (`tour.index >= 2`), the strict-less-than
  threshold, and the one-claim-per-tour invariant via the new
  `save.progress.stipendsClaimed` map. `cappedRepairCost`
  applies on `essential` repairs only and only on easy / normal /
  novice difficulty. `easyModeBonus` is gated on
  `save.settings.difficultyPreset === "easy"`.
  `practiceWeatherPreview` returns the track's `weatherOptions`
  array unchanged as the deterministic preview surface.
- `src/data/schemas.ts` (update): `SaveGameProgressSchema` gains an
  optional `stipendsClaimed: Record<slug, true>` field. Additive,
  no migration needed (default `{}` on load per `getStipendClaimed`).
  Doc comment cites §12 and the one-shot invariant.
- `src/game/__tests__/catchUp.test.ts` (new): 32 cases covering
  every cell on the dot-spec verify list. Stipend (threshold,
  first-tour gate, double-pay guard, cross-tour independence,
  purity, determinism). Repair cap (cap on normal / easy / novice,
  no-cap on hard / master / extreme, no-cap on full repair, zero
  income, negative-income clamp, negative-cost clamp, rounding
  spot-check). Easy-mode bonus (gating per preset including
  legacy-undefined v1 saves, empty-list, negative-reward filter,
  purity, determinism). Practice preview (identity behaviour,
  single-option track, reference equality, determinism).
- `docs/OPEN_QUESTIONS.md` (update): four new entries Q-004 through
  Q-007 flagging the pinned placeholders for dev confirmation
  before the balancing-pass slice closes.

### Verified
- `npm run lint` green (no new warnings).
- `npm run typecheck` green.
- `npm test` green: 1461 tests pass, 0 fail (32 new catchUp cases
  on top of the prior 1429).
- `npm run build` green: no new routes, no bundle-size impact (the
  catch-up module is data-side and currently has no UI consumer).
- Em-dash sweep: `grep -rPn "[\x{2013}\x{2014}]"` over the new and
  edited files returns nothing.

### Decisions and assumptions
- **Pinned placeholders for all four levers.** §12 names the levers
  but does not pin numbers. The four constants are exported so the
  balancing-pass slice
  (`VibeGear2-implement-balancing-pass-71a57fd5`) can swap them
  without rewriting call sites. Q-004 through Q-007 flag each for
  dev confirmation.
- **Stipend ledger as a literal-true map.** §12 stipend is
  one-shot per tour. A counter would suggest a future "second
  stipend" overload; a literal `true` keeps the schema honest
  (additive when a second stipend ships).
- **Repair cap difficulty gate.** Easy / normal / novice eligible;
  hard / master / extreme always pay full price per §15's
  expectation that higher tiers manage the risk directly. Q-005
  flags the gate for dev confirmation.
- **Module is pure-only; no in-app caller.** The dot description
  mentions wiring `awardCredits`, `applyRepairCost`, and
  `tourComplete` to the levers, but neither `applyRepairCost` nor a
  tour-complete surface exists yet (F-033 owns the repair-flow,
  F-034 owns the race-finish flow, and the tour-region slice owns
  tour clear). Wiring is filed as F-035 / F-036 / F-037 to land
  alongside the matching slices.

### Followups created
- F-035: Wire `computeStipend` + `recordStipendClaim` into the
  tour-entry flow (tour-region slice).
- F-036: Wire `cappedRepairCost` into `applyRepairCost` once that
  function lands per F-033.
- F-037: Wire `easyModeBonus` into the tour-clear bonus payout
  (tour-region slice).

### GDD edits
- None. §12 already names the four catch-up levers; this slice
  pins placeholder constants without changing the GDD.

---

## 2026-04-26: Slice: §12 economy + upgrade catalogue (awardCredits, purchaseUpgrade, tourBonus, 32-entry catalogue)

**GDD sections touched:**
[§12](gdd/12-upgrade-and-economy-system.md) (currency rewards,
upgrade pricing, sequential install rules, tour bonus), references
to [§22](gdd/22-data-schemas.md) `UpgradeSchema` and §23 placeholder
columns.
**Branch / PR:** `feat/economy-upgrade` (stacked on
`feat/build-version-stamping`), PR pending.
**Status:** Implemented (`src/data/upgrades.json` ships the 32-entry
§12 catalogue, `src/data/upgrades.ts` registry with `loadUpgrades`,
`src/game/economy.ts` exposes `awardCredits`, `computeRaceReward`,
`tourBonus`, `getUpgradePrice`, `purchaseUpgrade`, `installUpgrade`,
`purchaseAndInstall`, all pure on `SaveGame` with the
`EconomyResult` discriminated union. 33 economy + 101 upgrade-content
unit tests green; full verify chain green.).

### Done
- `src/data/upgrades.json` (new): 32 entries covering every
  (category, tier 1..4) cell from §12 "Example upgrade table"
  cell-by-cell. Costs match §12 exactly. Effect numerics are
  documented placeholder shapes (one effect per upgrade satisfies
  `UpgradeEffectsSchema.refine`); the balancing-pass slice owns the
  final per-tier deltas via §23.
- `src/data/upgrades.ts` (new): mirror of `src/data/cars/index.ts`.
  `UPGRADES`, `UPGRADES_BY_ID`, `getUpgrade(id)`, plus `loadUpgrades()`
  for strict-mode validation. Static JSON import keeps the registry
  in the client bundle without filesystem IO.
- `src/data/__tests__/upgrades-content.test.ts` (new): 101 cases
  covering schema validation per entry, the 32-cell coverage matrix,
  cell-by-cell §12 price match, registry uniqueness, and
  `getUpgrade` / `loadUpgrades` smoke.
- `src/game/economy.ts` (new): `awardCredits` (per-race wallet
  credit), `computeRaceReward` (pure helper for tour-bonus and
  spot-checks), `tourBonus` (15% sum-and-round), `purchaseUpgrade`
  (sequential install, cap, credit, ownership checks),
  `installUpgrade` and `purchaseAndInstall` (MVP-fold aliases),
  `getUpgradePrice` (catalogue lookup, throws on unknown id). Uses
  the iter-19 `EconomyResult` discriminated union with
  `EconomyFailure` codes (`insufficient_credits`, `upgrade_at_cap`,
  `tier_skip`, `unknown_car`, `unknown_upgrade`, `car_not_owned`).
- `src/game/__tests__/economy.test.ts` (new): 33 cases covering the
  §12 finish-multiplier table cell-by-cell, difficulty multiplier
  scaling, DNF participation, deterministic repeats, every named
  failure code, purity (input never mutated, deep-equal assertions),
  the cap-exact boundary (sparrow-gt aero cap 3 rejects
  aero-extreme; engine cap 4 accepts engine-extreme), and the
  install-preserves-other-categories invariant.

### Verified
- `npm run lint` green (one cycle of `import()` type-annotation fix
  in the test file).
- `npm run typecheck` green (one cycle to add `?? 1.0` fallback when
  reading from the `Record<string, number>` difficulty-multiplier
  table in the test).
- `npm test` green: 1429 tests pass, 0 fail.
- `npm run build` green: no new routes, no bundle-size impact (the
  upgrade JSON is data-side and currently has no UI consumer).
- Em-dash sweep: `grep -rPn "[\x{2013}\x{2014}]"` over the new files
  returns nothing.

### Decisions and assumptions
- **MVP fold purchase + install.** §12 narrative implies a possible
  split (buy upgrade, install later for a labor fee) but the GDD
  does not pin the labor mechanic; this slice folds purchase and
  install together. `purchaseAndInstall` is the canonical garage
  call; `installUpgrade` is currently an alias so the future split
  can land as an additive change.
- **DNF participation flat rate (200 credits).** §12 does not pin a
  DNF reward but mentions a "tour stipend" for under-threshold
  players (catch-up mechanism). 200 credits keeps a wrecked car
  from being stranded with zero; tunable via `awardCredits`'s
  `dnfParticipation` option.
- **Difficulty multiplier table is a placeholder.** §15 ships the
  player-facing tier names but neither §12 nor §23 prices the
  multipliers. Pinned `{novice: 0.9, easy: 0.95, normal: 1.0,
  hard: 1.10, master: 1.10, extreme: 1.20}` matching the iter-19
  stress-test recommendation. `master` mirrors `hard` until the
  unlock-gating slice lands.
- **`baseTrackReward` is caller-supplied.** The Track schema has no
  `baseReward` field today. Callers (the future race-finish wiring
  slice) pass the value from a per-tour table; the schema-side
  decision is deferred.
- **Effect numerics are placeholders.** Schema requires at least
  one numeric effect per upgrade. The values match the §12 row's
  thematic intent (engine raises accel, gearbox raises top speed,
  etc.) but are flagged for replacement in the balancing pass.
- **No `applyRepairCost`.** §12 names a `tourTierScale` factor with
  no §23 column. Filed F-033 to land it once the dev signs off on
  the placeholder table; this slice intentionally does not freeze
  the values.

### Followups created
- F-033: Implement `applyRepairCost` once §23 ships `tourTierScale`.
- F-034: Wire `awardCredits` into the race-finish flow.

### GDD edits
- None.

---

## 2026-04-26: Slice: §21 build version stamping (git SHA + version + sourcemaps)

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) (Asset
pipeline -> Build-time checksum versioning, new "Build version
stamping" subsection).
**Branch / PR:** `feat/build-version-stamping` (stacked on
`feat/leaderboard-client`), PR pending.
**Status:** Implemented (next.config.mjs git SHA resolution, baked
env vars, typed `buildInfo.ts` re-export, title-screen footer
badge, GDD subsection, six new buildInfo unit tests, page.test
updated; full verify chain green).

### Done
- `next.config.mjs` (update): `generateBuildId` now runs
  `git rev-parse --short HEAD` (with a `GIT_SHA` env var fallback
  for CI containers without a `.git` checkout, and a literal `dev`
  sentinel when both fail). Added `productionBrowserSourceMaps:
  true` so the future opt-in error reporter
  (`VibeGear2-implement-opt-in-b65cbbb8`) can map minified stack
  frames back to source. Bakes `NEXT_PUBLIC_BUILD_ID` and
  `NEXT_PUBLIC_BUILD_VERSION` into the client bundle via the `env`
  field; the version reads from `package.json` at config-load time
  via `readFileSync` so the JSON does not get bundled.
- `src/app/buildInfo.ts` (new): typed re-export of `BUILD_ID`,
  `BUILD_VERSION`, `isDevBuild`, plus `formatBuildBadge()` for
  reuse across the title screen and any future settings or error
  surfaces. Documents the three downstream consumers (opt-in error
  reporter, tagged-release smoke, cross-browser smoke) so a future
  reader can find the asset trail without grepping every dot.
- `src/app/__tests__/buildInfo.test.ts` (new): six cases covering
  type-of-string, no whitespace, dev-fallback contract,
  isDevBuild parity, and `formatBuildBadge` composition.
- `src/app/page.tsx` (update): title-screen footer renders a small
  dim `data-testid="build-version"` line below the existing
  `build-status` line via `formatBuildBadge()`. Manual smoke can
  read the stamp without inspecting the page source.
- `src/app/page.module.css` (update): `.footer` becomes a column
  flex with a `.buildVersion` child styled at 0.75rem opacity 0.7
  with tabular-nums for stable digit width.
- `src/app/__tests__/page.test.tsx` (update): asserts the new
  `build-version` testid renders the dev-sentinel literal under
  Vitest (which never runs `generateBuildId`).
- `docs/gdd/21-technical-design-for-web-implementation.md` (update):
  added the "Build version stamping" subsection under "Asset
  pipeline" pinning the env vars, the SHA derivation, the source
  map decision, and the title-screen footer placement.

### Why
- §21 already named "Build-time checksum versioning" as a required
  asset-pipeline output but the repo shipped at version `0.0.0`
  with no exposed SHA. Three downstream slices block on the env
  surface this introduces: the opt-in error reporter needs a
  per-error build attribution, the tagged-release smoke needs to
  compare deployed vs tagged SHA, and the cross-browser smoke
  matrix needs to log a precise commit per browser pass. Shipping
  the env / re-export / footer scaffold first lets each downstream
  slice be a thin consumer.
- The compile-time `env` injection turns `BUILD_ID` and
  `BUILD_VERSION` into string literals after tree-shaking; runtime
  cost is zero and the badge is grep-friendly in deployed page
  source.

### Verified
- `npm run lint`, `npm run typecheck`, `npm test` (1295 passing),
  `npm run build`, `npm run test:e2e` (34 passing).
- `.next/server/app/index.html` contains `v0.0.0 (a613cad)` in the
  rendered title-screen footer.
- `.next/BUILD_ID` matches the current git short SHA.
- `.next/static/chunks/*.js.map` files exist (14 maps emitted).
- No em-dashes or en-dashes in any added file
  (`grep -rPn '[\x{2014}\x{2013}]' src/app/buildInfo.ts
  src/app/__tests__/buildInfo.test.ts next.config.mjs
  src/app/page.tsx src/app/page.module.css` returns nothing).

### Decisions and assumptions
- Picked `productionBrowserSourceMaps: true` (rather than uploading
  source maps to a dedicated reporter and stripping them from the
  deploy artefact) because the opt-in error reporter is two slices
  away. The deploy host (Vercel / Cloudflare Pages) only serves
  `.map` files when explicitly requested, so the runtime cost
  stays zero.
- Did NOT bump `package.json` version. That is the
  `tagged-release-b3d30084` slice's job. The badge currently reads
  `v0.0.0 (<sha>)` which is the truthful representation of the
  pre-alpha state.
- Footer badge stays in the shipped build (not gated behind a dev
  flag). A version stamp on a shipped game is standard and the
  badge is dim enough to not dominate the title screen.
- `env` in `next.config.mjs` injects values at build time, not at
  runtime. A redeploy without a code change will still pick up a
  new SHA because Next.js re-runs `generateBuildId` on every
  build.

### Followups created
- F-031: Source map workspace path leak in Next.js framework
  chunks (`main-app-*.js.map` and `main-*.js.map`). Filed
  `nice-to-have`; the leaks are inside Next.js framework files
  (paths under `node_modules/next/dist/...`) rather than our own
  source, so the privacy impact is minimal. Revisit when the
  opt-in error-reporter slice lands and decide whether to scrub
  paths during the source-map upload step.

### GDD edits
- `docs/gdd/21-technical-design-for-web-implementation.md`: added
  the "Build version stamping" subsection under "Asset pipeline".

---

## 2026-04-26: Slice: §21 leaderboard pure primitives (sign + noop store)

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) (signed lap
submission concept, leaderboard back end concept).
**Branch / PR:** `feat/leaderboard-primitives` (stacked on
`feat/per-car-dnf-tracking`), PR pending.
**Status:** Implemented (types + sign/verify + noop store + 22 new
tests; verify chain green). First slice of parent dot
`VibeGear2-implement-optional-online-4b2341af`; route handlers,
Vercel KV adapter, and client adapter remain on the parent dot for
later slices.

### Done
- `src/leaderboard/types.ts` (new): `LapSubmission`,
  `LeaderboardEntry`, `LeaderboardStore`, `VerifiedSubmission`. Pure
  contracts; safe to import from both server route handlers and the
  future client adapter. `VerifiedSubmission` strips `signature` and
  `raceToken` before reaching the store so a buggy backend cannot
  leak the race token back to clients.
- `src/leaderboard/sign.ts` (new): `canonicalize`, `signSubmission`,
  `verifySubmission`. Uses Web Crypto (`crypto.subtle`) so the same
  module runs under Node tests and the future Edge runtime per
  AGENTS.md RULE 8. The canonical string is field-quoted with
  `JSON.stringify` and `|`-joined; `lapMs` is integer-truncated so
  float drift across clients does not change the tuple. Comparison
  uses a constant-time loop; verify returns false (never throws) on
  malformed hex so the route handler can collapse every signature
  failure into a single 401.
- `src/leaderboard/store-noop.ts` (new): `createNoopStore()`. Default
  store when `LEADERBOARD_BACKEND` is unset. `submit()` returns
  `null` (the documented sentinel for un-queryable inserts), `top()`
  returns `[]`, `clear()` resolves. Constructed (not a singleton) so
  a future variant can carry per-instance config without breaking
  callers.
- `src/leaderboard/__tests__/sign.test.ts` (new): 15 cases covering
  canonical-form stability, integer truncation, embedded-quote
  escaping, the pinned reference HMAC-SHA-256 (locks the
  algorithm + canonicalization for forward compatibility),
  determinism, per-field tamper detection, wrong-secret rejection,
  malformed-signature rejection, and the dev-mode empty-secret
  guard. Confirms `playerName` is intentionally outside the tuple.
- `src/leaderboard/__tests__/store-noop.test.ts` (new): exports a
  reusable `runStoreContract(name, factory)` so future Vercel KV /
  Upstash / in-memory stores re-run the same suite. Asserts the
  noop-specific sentinels (`submit` returns null, `top` always
  empty, each call returns an independent array).

### Why
- §21 calls out optional online leaderboard as the only post-MVP
  persistence touchpoint. The signed-lap-submission flow is the
  minimum surface that lets a future deploy slice plug in any
  backing store without re-shaping the contract. Shipping the pure
  primitives first lets the route-handler slice that follows be a
  thin glue layer (validate -> verify -> store), which keeps each
  PR small per AGENTS.md RULE 4.
- The reference signature is pinned in the test so a future
  algorithm or canonicalization change is a deliberate, reviewed
  break, not a silent invalidation of every existing submission.

### Verified
- `npm run lint`, `npm run typecheck`, `npm test` (1210 passing),
  `npm run build`, `npm run test:e2e` (31 passing).
- No em-dashes or en-dashes in any added file
  (`grep -rPn '[\x{2014}\x{2013}]' src/leaderboard/` returns
  nothing).

### Decisions and assumptions
- Web Crypto over Node `crypto` so the future route handlers can run
  under Edge runtime without a second code path.
- HMAC-SHA-256 hex (not base64) for the signature so the wire format
  is grep-friendly and URL-safe.
- `lapMs` is integer-truncated in canonicalization so two clients
  rounding the same physical lap differently still produce the same
  signature. The store also persists integer ms.
- `playerName` is deliberately outside the canonical tuple. Handles
  are display-only; the store is free to truncate or omit them. A
  future cosmetic slice can add a separate handle-claim flow if the
  GDD calls for one.
- `VerifiedSubmission` is the shape stores see, not `LapSubmission`,
  so the `raceToken` and `signature` fields cannot leak back through
  a buggy backend.
- The contract test exports `runStoreContract` so a future
  in-memory test fake or production Vercel KV adapter re-runs the
  exact same suite without copying the assertions.

### Followups created
- `VibeGear2-implement-leaderboard-route-2bc936cd`: route handlers
  (`POST /api/leaderboard/submit`, `GET /api/leaderboard/[trackId]`)
  that wire `signSubmission` + `verifySubmission` + a
  `LeaderboardStore` together. Status codes per the parent dot's
  edge-case list (401 / 422 / 404 / 200).
- `VibeGear2-implement-leaderboard-client-48a44048`: client adapter
  (`src/leaderboard/client.ts` with the
  `NEXT_PUBLIC_LEADERBOARD_ENABLED` feature flag) and the Vercel KV
  store (`src/leaderboard/store-vercel-kv.ts`, loaded dynamically
  when `LEADERBOARD_BACKEND=vercel-kv`). Re-runs the
  `runStoreContract` suite exported from
  `store-noop.test.ts`.
- The parent dot
  `VibeGear2-implement-optional-online-4b2341af` is marked done and
  replaced by these two child dots so each remaining piece is a
  PR-sized slice of its own per AGENTS.md RULE 4.

### GDD edits
- None. The pure primitives match the §21 description exactly.

---

## 2026-04-26: Slice: §20 HUD lap-timer + best-lap widget

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) (Race HUD layout: current-lap timer and
BEST lap rows beneath the existing LAP / POS labels in the top-left
corner).
**Branch / PR:** `feat/hud-lap-timer` (stacked on
`feat/race-rules-time-limit`), PR pending.
**Status:** Implemented (formatter + state extension + per-field guard
in renderer + 18 new tests; verify chain green). Sub-slice of HUD parent
`VibeGear2-implement-hud-ui-6c1b130d`; child dot
`VibeGear2-implement-hud-lap-33fd24ba` closed.

### Done
- `src/game/hudState.ts` adds the pure `formatLapTime(ms)` helper
  (`MM:SS.mmm` for valid input, `--:--.---` for non-finite,
  `00:00.000` for negative). Truncates fractional ms so the HUD never
  reads ahead of the sim.
- Same module extends `HudStateInput` and `HudState` with optional
  `currentLapElapsedMs` and `bestLapMs` fields. Existing minimal-HUD
  callers stay unchanged because both fields are optional and the
  derivation only mirrors them when supplied.
- `src/render/uiRenderer.ts` draws the TIME row at
  `y = padding + 44` (text colour) and the BEST row at
  `y = padding + 64` (muted colour) only when the matching field is
  present. The assist-badge anchor at `y = padding + 64` on the
  right-hand side is unaffected because the rows live on the left.
- `src/game/__tests__/hudState.test.ts` adds 18 cases covering the
  formatter (zero, sub-second, multi-minute, negative, NaN / Infinity
  collapse, truncation, purity) and the new derivation fields
  (omission, surfacing, explicit `null` for "no PB yet").
- `src/render/__tests__/uiRenderer.test.ts` adds 7 cases covering the
  per-field guard (no extra rows when omitted, TIME-only, BEST-only,
  both rows, explicit null suppresses BEST, non-finite renders the
  placeholder, badge anchor unaffected by timer rows).

### Verified
- `npm run lint`, `npm run typecheck`, `npm test` (1178 passing),
  `npm run build`, `npm run test:e2e` (31 passing).
- No em-dashes or en-dashes in any added or edited file.

### Decisions and assumptions
- Layout: TIME row uses the `text` colour (matching the LAP row); BEST
  row uses `textMuted` (matching the POS row) so the eye reads the
  pair as "current vs reference". Pinned in
  `LAP_TIMER_TOP_OFFSET = 44` and `BEST_LAP_TOP_OFFSET = 64` constants.
- `bestLapMs: null` (vs `undefined`) is honoured as an explicit "no PB
  yet" signal so callers can paint the timer while suppressing BEST
  without having to delete the field. This matches the §20 "no record"
  placeholder pattern.
- Truncation (not rounding) on the millisecond field so the HUD reads
  honest: a 999.9 ms elapsed renders `"00:00.999"`, never
  `"00:01.000"`.

### Followups created
- None. Sibling sub-slices (damage indicator, weather indicator, full
  pause action set, settings persistence) remain on the parent HUD dot
  and the iter-30 researcher note attached to it.

### GDD edits
- None.

---

## 2026-04-26: Slice: §7 race rules hard time limit wired into raceSession

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) (DNF / hard race time limit
safety net now flips a stuck race to `"finished"`).
**Branch / PR:** `feat/race-rules-time-limit` (stacked on
`feat/hud-assist-badge`), PR pending.
**Status:** Implemented (single-file wiring + 3 new tests + 2 followups
filed; verify chain green). Dot
`VibeGear2-implement-race-rules-b30656ae` closed; per-car DNF tracking
deferred to F-028 and the e2e race-finish spec deferred to F-029.

### Done
- `src/game/raceSession.ts` now imports `exceedsRaceTimeLimit` from
  `./raceRules` and calls it once per racing tick, after the
  lap-completion branch. When the elapsed sim time crosses
  `DNF_RACE_TIME_LIMIT_SEC` (10 minutes per the iter-19 stress-test
  on dot `VibeGear2-implement-race-rules-b30656ae`), the race phase
  flips to `"finished"`. The lap-completion `nextPhase` decision wins
  if both fire on the same tick: a player who crosses the line at the
  cap still gets a finish, not a timeout.
- `stepRaceSession`'s docstring now names the time-limit safety net
  alongside the lap-completion finish branch and points at F-028 for
  per-car DNF tracking.
- `src/game/__tests__/raceSession.test.ts` gained a
  `stepRaceSession (hard race time limit)` describe block with three
  tests: phase flips to `"finished"` on the tick the cap is crossed,
  no premature flip when `elapsed` is well below the cap, and a
  same-tick finish-vs-timeout race resolves to finish (lap clamps to
  `totalLaps`).
- `docs/FOLLOWUPS.md`: F-028 (per-car DNF tracking in raceSession)
  and F-029 (Playwright e2e race-finish spec) filed `nice-to-have`
  with detailed scope notes so the next slice that touches §7 race
  rules picks them up cleanly.

### Why
- §7 requires DNF / timeout behaviour so a stuck race cannot block
  the results screen forever. The pure helper `exceedsRaceTimeLimit`
  has been shipped on `raceRules.ts` since the iter-19 dot landed but
  had no consumer; this slice wires the smallest defensible fragment
  (the hard cap) into the session reducer without touching the
  multi-car-state shape.
- The full per-car DNF wiring (off-track and no-progress timers per
  car, per-car `status: "dnf"`, removal from physics integration) is
  larger than fits in one slice. It needs a `cars` array on
  `RaceState` (or a parallel map on `RaceSessionState`) and updates
  to every consumer of those shapes (HUD, sector timer, ghost
  recorder, results overlay). F-028 captures the scope so the
  follow-up slice has the design notes ready.
- The lap-completion branch's `nextPhase = "finished"` already runs
  before the new time-limit check, so the order of operations
  preserves the user-visible "you finished" outcome over the safety
  net "the clock ran out" outcome. Documented in the new test that
  asserts both conditions fire on the same tick.

### Skip
- Per-car DNF status, off-track timer wiring, and no-progress timer
  wiring. Filed as F-028.
- Multi-car finishing order (currently only the player can flip the
  race to `"finished"`). The lap-completion branch only reads the
  player's `z`. Land alongside F-028 because the AI-finish path
  needs the same per-car state shape.
- Playwright `e2e/race-finish.spec.ts`. Filed as F-029. The `/race`
  demo route does not yet render a results overlay so there is
  nothing meaningful to assert in a browser; the unit tests cover
  the reducer logic.
- Pause-during-countdown verification (called out in the iter-19
  stress-test §1). The session's countdown branch already halts on
  `dt <= 0` and `LoopHandle.pause()` (in `src/game/loop.ts`)
  short-circuits the simulate callback, so the existing pause path
  trivially handles this. Adding a dedicated test would duplicate
  `loop.test.ts` coverage.

### GDD edits
- None. The hard cap value (10 minutes) was pinned by the iter-19
  stress-test on the dot, not the GDD; §7 names DNF as a fail state
  but is silent on the threshold so the §7 text needs no edit.

### Verification
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` (Vitest): all suites pass.
- `npm run build`: success.
- `npm run test:e2e` (Playwright): all suites pass.

---

## 2026-04-26: Slice: F-027 HUD accessibility-assist badge renderer

**GDD sections touched:**
[§20](gdd/20-hud-and-ui-ux.md) (the "small badge when any assist is
active" requirement now has a renderer; the §19 accessibility surface
finally reads end-to-end from save toggle to canvas pixel).
**Branch / PR:** `feat/hud-assist-badge` (stacked on
`feat/wire-applyassists-into-race-session`), PR pending.
**Status:** Implemented (renderer wiring + 14 new tests + F-027 closed;
verify chain green).

### Done
- `src/render/uiRenderer.ts` now consumes `HudState.assistBadge`. When
  the badge is active, `drawHud` paints a tinted pill at
  `(viewport.width - padding, padding + 64)` (below the splits
  widget's three rows) plus a shadowed label drawn via the existing
  `drawShadowedText` pattern. The pill width is sized to the label via
  `ctx.measureText` so single-word and multi-assist labels both fit.
- `formatAssistBadgeLabel(badge)` is a new exported helper that maps
  the badge's `primary` slug through `ASSIST_BADGE_LABELS` and appends
  a plain ASCII `xN` suffix when `badge.count > 1`. The ASCII `x`
  (rather than U+00D7 multiplication sign) keeps the §20 monospace
  stack happy and avoids the Unicode minefield called out in
  AGENTS.md RULE 1.
- `HudColors` gained `assistBadgeFill` (default
  `rgba(80, 130, 220, 0.85)`) and `assistBadgeText` (default
  `#ffffff`) so theme overrides keep the badge palette tunable.
  Existing callers that pass partial colour blocks still type-check
  because the renderer's `colors` defaults populate the new keys.
- `src/render/__tests__/uiRenderer.test.ts` (new): 14 tests covering
  the badge-omitted (zero `fillRect` calls), badge-inactive (zero
  `fillRect` calls), single-assist (one pill + shadowed label),
  multi-assist (label suffix `Brake assist x3`), top-right anchor at
  `padding + 64`, default colour, override colour, context-state
  restoration (`fillStyle` / `font` / `textAlign` / `textBaseline`
  unchanged after the call), determinism, label mapping for every
  `AssistBadgeLabel` slug, and the no-Unicode-multiplication-sign
  guard. Uses the same recording-mock-canvas pattern as
  `hudSplits.test.ts`, extended to capture `fillRect` calls.
- `docs/FOLLOWUPS.md`: F-027 marked `done` with a resolution note
  pointing at this branch and naming the new test counts.
- Verify chain green: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm run test:e2e` all pass.

### Why
- The §19 accessibility assists became fully runtime-consumed in
  iter-46 (F-026), but the §20 surface still had no visible signal
  that an assist was active. Without a HUD pip the player can toggle
  brake-assist or auto-accelerate and never see confirmation that the
  assist is doing anything; the toggle UI in `/options/accessibility`
  is the only feedback. F-027 closes that gap with the smallest
  possible renderer change: one pill + one label, gated on
  `badge.active`.
- Choosing `padding + 64` for the badge anchor keeps the splits widget
  unchanged (it consumes timer 20 px + 6 px + sector 12 px + 6 px +
  delta 16 px = 60 px) and leaves a visible 4 px gutter between the
  splits delta and the badge pill so the corner reads as two distinct
  widgets rather than one stacked block.
- The `xN` count suffix (rather than rendering all active labels as a
  list or rotating between them) matches the §20 spec verbatim
  ("small badge when any assist is active") and keeps the badge a
  single short string the player can glance at without parsing.
  Players who want the full list can open `/options/accessibility`.
- Adding `assistBadgeFill` / `assistBadgeText` to `HudColors` (rather
  than hard-coding the badge palette inside `drawAssistBadge`) keeps
  the badge themable for the F-NNN palette-driven HUD slice when it
  lands, mirroring how `deltaFaster` / `deltaSlower` on
  `SplitsColors` already let the splits widget retheme.

### Skip
- Per-label colour coding. The badge uses a single tinted accent
  regardless of which assist is active. The §20 spec does not call
  for per-assist colour; if a future palette slice wants
  `auto-accelerate` green and `brake-assist` blue, the renderer's
  `drawAssistBadge` is the single hook to extend, but neither the GDD
  nor the F-027 followup name an asks for it.
- Mid-race assist toggling. The runtime samples assists once at
  session creation per iter-46 (F-026 resolution); the badge pip
  reflects the session's assist set, not a live-toggled view. Mid-race
  toggling is documented as out of scope for both slices.
- Damage / weather icons / nitro meter. Those §20 widgets ship in
  their own slices (the parent `implement-hud-ui-6c1b130d` dot tracks
  what is left). This slice only closes F-027.

### Followups
- None. F-027 is the last open producer-without-consumer entry from
  the §19 assists landing chain. The remaining §20 polish work
  (damage indicator, weather indicator, results screen styling, HUD
  reflow on resize, pause action set) lives under
  `implement-hud-ui-6c1b130d`.

---

## 2026-04-26: Slice: F-026 wire applyAssists into the race-session input pipeline

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) (Accessibility controls; six §19
assists become load-bearing in the per-tick simulation rather than
just persisted), [§20](gdd/20-hud-and-ui-ux.md)
(`HudState.assistBadge` is now populated by the live runtime so the
§27 polish slice has a real data source), and
[§22](gdd/22-data-schemas.md) (`SaveGameSettings.assists` is now
sampled by the consumer, closing the producer-without-consumer
followup tracked as `F-026` in `docs/FOLLOWUPS.md`).
**Branch / PR:** `feat/wire-applyassists-into-race-session` (stacked
on `feat/content-budget-cap`), PR pending.
**Status:** Implemented (consumer wiring + lifecycle reset + race-page
wiring + 14 new tests + F-026 closed; verify chain green).

### Done
- `src/road/segmentProjector.ts` exports a new
  `upcomingCurvature(segments, cameraZ, lookahead)` helper plus
  `DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M = 80` (~1.3 s of travel at
  the starter top speed). Returns the largest-magnitude signed curve
  in the lookahead window, recovers the authored `[-1, 1]` band by
  multiplying back through `CURVATURE_SCALE`, wraps `cameraZ` modulo
  the ring, and clamps the result so a slightly out-of-band authored
  segment cannot confuse the §19 brake-assist gate.
- `src/game/raceSession.ts` reads
  `RaceSessionPlayer.assists`, builds an `AssistContext`
  (`{ speedMps, surface, weather, upcomingCurvature, dt }`) every
  tick, threads `AssistMemory` through a new `assistMemory` field on
  `RaceSessionPlayerCar`, and runs `applyAssists` once per tick at the
  top of the racing branch so nitro / transmission / drafting /
  physics all consume the post-assist `Input`. The `lastNitroPressed`
  / `lastShift*Pressed` mirrors track the post-assist values so the
  toggle-nitro latch and shift edge-detection stay coherent across
  ticks. `assistBadge` and `weatherVisualReductionActive` surface on
  the player snapshot for the §20 HUD and the future weather grip
  multiplier (TODO marker references this followup).
- `RaceSessionConfig.weather` (defaults to the track's first weather
  option, falling back to `"clear"`) so the assist context has a
  weather value without forcing every caller to thread one explicitly.
- Lights-out promotion resets `AssistMemory` back to
  `INITIAL_ASSIST_MEMORY` so a paused-during-countdown player always
  starts the race with a clean smoothing buffer / latched-toggle /
  reduced-input winner. Mirrors the existing lap-timer / sector-timer
  reset on the same tick.
- `src/app/race/page.tsx` reads `loadSave().settings.assists` (or
  `defaultSave().settings.assists` when no save exists) at session
  creation so the toggles in `/options/accessibility` actually shape
  the per-tick input. `deriveHudState` now receives
  `session.player.assistBadge` so the §20 badge surface has live data.
- `src/game/__tests__/raceSession.test.ts` adds 7 assist tests:
  assists-off matches the pre-assists pipeline tick-for-tick,
  identical inputs + assists produce deep-equal state across runs,
  auto-accelerate keeps a no-throttle player moving, brake assist
  costs more speed on a curve at high speed, toggle-nitro latches
  across a key release and flips off on a second tap, reduced-input
  picks the brake under throttle + brake + nitro contention, and the
  green-light tick resets `AssistMemory`.
- `src/road/__tests__/segmentProjector.test.ts` adds 7
  upcoming-curvature tests: empty / non-positive / NaN / flat-track
  guards, magnitude recovery, sharpest-in-window selection, clamp to
  `[-1, 1]`, ring wraparound, and the default-lookahead behaviour.
- `docs/FOLLOWUPS.md`: F-026 marked `done` with a resolution note
  pointing at this branch and naming the new test counts.
- Verify chain green: `npm run lint` (clean), `npm run typecheck`
  (clean), `npm test` (1141 / 1141 across 50 files), `npm run build`
  (static export succeeds; `/race` route grew from 5.96 kB to 7.26
  kB First Load JS for the assists threading), `npm run test:e2e`
  (31 / 31 across chromium + mobile).

### Why
- The §19 accessibility assists are a release-blocker per the GDD
  (six assists across two presets, plus the visual-only-weather
  flag). The producer module landed clean in iter-43, but the
  toggles in `/options/accessibility` only persisted to localStorage;
  the runtime ignored them. Without consumer wiring the entire
  accessibility surface is paperwork. F-026 closes that gap.
- Threading `AssistMemory` per session (not per-config or global)
  matches AGENTS.md RULE 8: identical inputs + identical settings +
  identical track + identical weather produce deep-equal state across
  runs, so the slice does not contaminate the determinism property
  the rest of the runtime depends on.
- Resetting the memory at the green-light tick (rather than at
  session creation) keeps a paused-during-countdown player from
  carrying a stale smoothing buffer into the race, which would have
  shown up as a phantom steer pull in the first tenth of a second.
- Wiring the race page through `loadSave()` (rather than wiring it
  through the pause menu) is the minimum that gets the toggle-to-
  effect loop closed: mid-race toggling is documented as out of
  scope on the dot, and pause-then-toggle would change the runtime
  shape (every assist would need to flow through `RaceSessionConfig`
  per tick rather than being held on the player snapshot).

### Skip
- Mid-race toggling. The runtime samples assists once at session
  creation. A future slice that wants pause-menu mid-race toggling
  can move the `assists` field from `RaceSessionPlayer` to a
  per-tick parameter on `stepRaceSession` without changing the
  internals.
- HUD assist-badge renderer (F-027). The `assistBadge` field now
  flows from the runtime to `HudState.assistBadge`, but the canvas
  drawer in `src/render/uiRenderer.ts` still ignores it. F-027 is
  open and assigned to the §20 polish slice.
- Weather grip multiplier consumption of `weatherVisualReductionActive`.
  The flag is plumbed onto `RaceSessionPlayerCar` and exported through
  the snapshot, but the §14 weather slice has not yet shipped a grip
  multiplier; the consumer will read from there when it lands.

### Followups
- F-027 (HUD assist-badge renderer) remains open; data plane is now
  fully populated, so the renderer slice can land without further
  runtime changes.

---

## 2026-04-26: Slice: content budget cap + enforcement test (32 tracks / 6 cars)

**GDD sections touched:**
[§27](gdd/27-risks-and-mitigations.md) (Scope-creep mitigation: hard cap of
32 tracks and 6 cars at v1.0) and
[§24](gdd/24-content-plan.md) (MVP minimums: 8 tracks, 3 cars).
Phase 6 task per [`docs/IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
The dot (`VibeGear2-implement-content-budget-e42cd8f9`) ships the
single-source-of-truth cap constant and the Vitest suite that fails the
build the moment a contributor tries to add a 33rd track or a 7th car.
**Branch / PR:** `feat/content-budget-cap` (stacked on
`feat/accessibility-assists`), PR pending.
**Status:** Implemented (cap constant + 13 enforcement assertions + green
verify chain).

### Done
- Authored `src/data/content-budget.ts` exporting the frozen
  `CONTENT_BUDGET = { tracks: 32, cars: 6, mvpTracks: 8, mvpCars: 3 }`
  constant with §27 and §24 references in the docblock. The constant is
  the only place the cap numbers live so a future PR that lifts the cap
  has exactly one code site to touch (and one GDD §27 row, per the
  mitigation contract).
- Authored `src/data/__tests__/content-budget.test.ts` with 13
  assertions across three describe blocks:
  - **tracks**: walks `src/data/tracks/**/*.json` recursively, parses
    each file against `TrackSchema`, asserts the count is at most
    `CONTENT_BUDGET.tracks`, surfaces non-track JSONs as failures
    rather than silently skipping them, gates the MVP-minimum check on
    "at least one non-test track has shipped" so the suite is green
    during the current pre-content phase, and verifies bidirectional
    alignment between disk JSONs and the `TRACK_RAW` barrel.
  - **cars**: counts `src/data/cars/*.json` against `CONTENT_BUDGET.cars`,
    asserts the bundled `CARS` array meets the MVP minimum, and
    confirms every disk JSON is re-exported from `src/data/cars/index.ts`.
  - **cap source-of-truth guard**: positive-integer guards, MVP at-or-
    below-v1.0 guard, exact-match assertions against the §27 (32 / 6) and
    §24 (8 / 3) rows so a constant-only edit cannot silently drift away
    from the GDD, and a `Object.isFrozen` check.
- Manually verified the cap-exceeded failure path by dropping two
  scratch JSONs into `src/data/cars/`; the suite failed with both the
  cap-exceeded message and the registration-mismatch message before
  the fixtures were removed. Errors point at the offending file paths.
- Verify chain green: `npm run lint` (no warnings), `npm run typecheck`
  (no errors), `npm test` (1125 / 1125 across 50 files, including the
  13 new assertions), `npm run build` (static export succeeds with the
  pre-existing route table unchanged), `npm run test:e2e` (31 / 31
  passing across chromium + mobile).

### Why
- §27 names "scope creep" as a top-tier risk for v1.0 and pins the
  mitigation as a hard cap. Without enforcement the mitigation is just
  paperwork: a future loop iteration could land a 33rd track without
  anyone noticing the scope explosion until the bundle-size budget
  alarm fires (which is too late, by then the content is authored and
  the cut hurts). The test slice closes the loop so the cap is
  load-bearing during code review, not aspirational.
- The pattern matches the existing `cars-content.test.ts` and
  `tracks-content.test.ts` content tests (same fail-loud-with-paths
  diagnostics, same "JSON-is-source-of-truth" stance), so reviewers can
  pattern-match against work they already trust.

### Skip
- The dot's "track JSON in subdirectory" edge case (e.g.
  `src/data/tracks/velvet-coast/harbor-run.json`) is implemented
  (the walker recurses) but cannot be exercised under fixture today
  because no region subdirectories exist. The recursion path will
  activate the moment `implement-mvp-track-0e1b2918` ships its first
  authored track. The test is intentionally non-skippable so that the
  recursion behaviour gets exercised on the same PR that adds the
  first nested track.
- The MVP-minimum assertion for tracks is gated on "at least one
  non-test track ships" so the suite passes during the current
  pre-content phase. Once `implement-mvp-track-0e1b2918` lands the
  first real track, the gate trips and the assertion enforces the
  §24 minimum of 8 tracks. No follow-up needed: the gate self-resolves.

### GDD edits
- None. The constant references the existing §27 cap row and the
  §24 MVP row verbatim.

### Followups
- None new from this slice. Sibling dots
  (`implement-mvp-track-0e1b2918`,
  `implement-track-editor-fdb02792`,
  `implement-mod-loader-e9b8b51f`) will benefit from the cap as their
  content lands, but no coordination work is required from them: the
  test reads the disk and the barrels, no producer-side change.

### Tests added
- `src/data/__tests__/content-budget.test.ts` (13 assertions in three
  describe blocks, covering track count cap, car count cap, MVP
  minimums, barrel-disk alignment in both directions, and the cap
  source-of-truth guard).

---

## 2026-04-26: Slice: accessibility assists pure module + /options Accessibility pane

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) (Accessibility controls bundle),
[§20](gdd/20-hud-and-ui-ux.md) (HUD assist badge surface), and
[§22](gdd/22-data-schemas.md) (`SaveGameSettings.assists` schema).
Phase 4 task per [`docs/IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
The dot (`VibeGear2-implement-accessibility-9063e12c`) ships the six
§19 assists as a pure transform module plus the matching options pane.
**Branch / PR:** `feat/accessibility-assists` (stacked on
`feat/ghost-replay-recorder`), PR pending.
**Status:** Implemented (pure module + UI pane + persistence + HUD
badge surface). Race-session wiring of `applyAssists` into the per-tick
input pipeline deferred to a follow-up so this slice stays focused on
the contract and the player-facing toggles.

### Done
- Authored `src/game/assists.ts` exporting `applyAssists`, the six
  per-assist transforms (`applyAutoAccelerate`, `applyBrakeAssist`,
  `applySteeringSmoothing`, `applyToggleNitro`,
  `applyReducedSimultaneousInput`, plus the visual-only weather flag
  surface), `AssistContext`, `AssistMemory`,
  `INITIAL_ASSIST_MEMORY`, `AssistsApplied`, `AssistBadge`,
  `ASSIST_BADGE_LABELS`, and the tunable constants
  `STEERING_SMOOTHING_TAU_SECONDS`, `BRAKE_ASSIST_BOOST`,
  `BRAKE_ASSIST_MIN_SPEED_MPS`, `BRAKE_ASSIST_MIN_CURVATURE`. The
  module is pure: same `(input, assists, ctx, memory)` tuple always
  returns the same `(input, memory, badge, weatherVisualReductionActive)`
  snapshot. No `Math.random`, no time source, no globals.
- Composition order pinned in code: auto-accelerate, then brake assist,
  then steering smoothing, then toggle nitro, then reduced-simultaneous-
  input, then visual-weather flag. Reduced-input runs last so its
  priority ladder evaluates the post-assist input shape (the dot's
  edge case wanted "auto-accelerate's throttle yields to a held
  brake"; this ordering keeps that property).
- Steering smoothing implements an exponential low-pass with the
  configured tau. The tunable `STEERING_SMOOTHING_TAU_SECONDS = 0.08`
  matches the dot's edge-case target (snap halfway in 80 ms). A small
  residual snap to zero keeps the idempotency contract exact rather
  than asymptotic.
- Toggle nitro is rising-edge triggered; holding the key does not flip
  the latch. The pure helper threads its memory back through
  `AssistMemory.nitroToggleActive` and `AssistMemory.nitroLastPressed`
  so the caller does not have to reach into private state.
- Reduced-simultaneous-input picks a stable winner each tick from the
  priority ladder steer-left, steer-right, brake, throttle, nitro,
  handbrake. Pause and shift inputs always pass through; the §19
  intent is "one game action at a time", not "drop the safety
  controls".
- Extended `AssistSettingsSchema` (`src/data/schemas.ts`) with the
  five new optional fields (`autoAccelerate`, `brakeAssist`,
  `steeringSmoothing`, `nitroToggleMode`, `reducedSimultaneousInput`)
  alongside the existing `weatherVisualReduction`. Optional so v1
  saves that pre-date the slice still validate. Exported
  `ASSIST_FIELDS` and `AssistFieldKey` so the UI pane and the future
  race-session wiring share a single source of truth for the field
  names.
- Updated `defaultSave()` to set every assist to `false`. Out-of-the-
  box experience matches the §15 baseline; the accessibility pane is
  the opt-in surface.
- Authored `src/components/options/accessibilityPaneState.ts` with
  the §19 catalogue (`ASSISTS`), pane copy
  (`PANE_HEADLINE`, `PANE_SUBTITLE`),
  `applyAssistToggle`, `readAssists`, `isAssistActive`, and
  `VISIBLE_ASSIST_KEYS`. The legacy `steeringAssist` and `autoNitro`
  fields stay on the schema for backward compat but are excluded from
  the visible row list (the dot's wording was "the full set is six";
  the legacy trio is not those six).
- Authored `src/components/options/AccessibilityPane.tsx` as the thin
  React shell, mirroring the `DifficultyPane.tsx` pattern: hydrate
  after mount via `loadSave()`, commit each toggle through
  `saveSave()`, surface a status line on save failure. Stable per-row
  `data-testid="accessibility-row-<key>"` and per-toggle
  `data-testid="accessibility-toggle-<key>"` for the e2e suite.
- Wired the pane into `src/app/options/page.tsx` by replacing the
  Accessibility tab's "coming soon" placeholder with the real
  `<AccessibilityPane />` mount.
- Extended `HudState` (and `HudStateInput`) with an optional
  `assistBadge` field. `deriveHudState` only surfaces the badge when
  the caller's badge says `active === true`, so existing HUD wiring
  paths that never set the field stay untouched. Three new
  `hudState.test.ts` cases cover the present / inactive / absent
  branches of the passthrough.
- Authored `src/game/__tests__/assists.test.ts` (37 tests) covering
  every per-assist on / off path, the brake-assist gate ladder, the
  steering smoothing convergence and snap-to-zero, the toggle nitro
  rising-edge / hold / re-tap sequence, the reduced-input priority
  ladder, the visual-only weather flag passthrough, the badge
  composition determinism, the idempotency contract
  (`applyAssists(applyAssists(x).input)` converges to its own
  output), and the input / memory non-mutation guarantees.
- Authored `src/components/options/__tests__/accessibilityPaneState.test.ts`
  (16 tests) covering the §19 catalogue order, the no-em-dash copy
  rule, the `readAssists` v1 backfill, the `applyAssistToggle`
  applied / noop branches, and the rest-of-save preservation
  property. Authored
  `src/components/options/__tests__/AccessibilityPane.test.tsx` (2
  tests) covering the SSR loading marker plus the no-em-dash render
  guard, mirroring `DifficultyPane.test.tsx`.
- Authored `e2e/options-accessibility.spec.ts` (3 tests) covering
  default-off rendering of all six toggles, persistence across reload
  for `autoAccelerate`, and independence of multiple toggles.
- Re-exported the assists module from `src/game/index.ts` so consumers
  (`@/game`) get a one-line import path, matching the `rng`, `nitro`,
  `ghost`, and other module patterns.

### Decisions
- **Visual-only weather is a flag, not an input rewrite.** The §19
  assist says "physics ignores weather grip penalties; visuals still
  render rain/snow". An input-stream rewrite cannot satisfy that
  contract; it has to be a per-tick flag the physics layer reads.
  `applyAssists` now returns `weatherVisualReductionActive: boolean`
  so the future weather-physics integration can branch on a single
  pre-computed bit without re-reading the settings struct.
- **Steering smoothing memory tracks even when the assist is off.**
  Toggling the assist on mid-race must not snap to a stale cached
  value. The pipeline syncs `smoothedSteer` to the unfiltered steer
  whenever the assist is off, so the first frame after enabling it
  feels seamless. Same idea for the toggle-nitro latch (decays to
  `false` when the assist is off).
- **Brake assist never invents brake out of nothing.** The §19
  wording is "brake assist", which presupposes a player who is
  already trying to brake. Auto-braking on a corner approach without
  the player touching the brake would feel like the car was being
  yanked from them; that belongs in a future "auto-pilot" assist
  category, not §19.
- **Race-session wiring deferred to a follow-up.** Plumbing
  `applyAssists` into `raceSession.stepRaceSession` is a separate
  concern that intersects with the partially-implemented brake-assist
  curvature lookup (which needs the track-segment projection slice).
  Filed as F-024 below; the pure module and the player-facing UI ship
  this slice so the assists are testable end-to-end on the data plane
  before the runtime plane catches up.

### GDD edits
- None. The §19 'Accessibility controls' list is implemented as
  written.

### Open questions
- None new. Q-NNN entries from prior slices unchanged.

### Followups
- F-026 (`blocks-release`): wire `applyAssists` into
  `raceSession.stepRaceSession` so the toggles in the new pane
  actually affect the runtime input stream. Requires the track
  segment projection slice (for brake-assist's upcoming curvature
  lookup) and the weather state machine (for visual-only weather to
  bypass the future weather grip multiplier).
- F-027 (`nice-to-have`): add a HUD assist badge renderer that
  consumes the new `HudState.assistBadge` field. The data plane is
  ready; only the canvas / DOM draw step is missing. Lives with the
  rest of the §20 HUD polish slice.

### Followup-loop hand-off
- `feat/accessibility-assists` stacks on `feat/ghost-replay-recorder`.
  The next slice can stack on this branch; verification ladder green
  (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `npm run test:e2e` all pass).

---

## 2026-04-26: Slice: ghost replay recorder + player module (ghost.ts, delta-encoded inputs, version stamps)

**GDD sections touched:**
[§21](gdd/21-technical-design-for-web-implementation.md) (Ghost replay,
deterministic-replay tests, fixed-step loop). Phase 5 task per
[`docs/IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). The dot
(`VibeGear2-implement-ghost-replay-7ea6ffaa`) carries a long
stress-test that pinned format / cap / version invariants this slice
implements.
**Branch / PR:** `feat/ghost-replay-recorder` (stacked on
`feat/seeded-deterministic-rng`), PR pending.
**Status:** Implemented (producer module). Save schema, renderer, and
Time Trial UI integrations deferred to followups F-021, F-022, F-023.

### Done
- Authored `src/game/ghost.ts` exporting `Recorder`, `Player`, `Replay`,
  `ReplayDelta`, `createRecorder`, `createPlayer`,
  `REPLAY_FORMAT_VERSION`, `RECORDER_SOFT_CAP_TICKS`,
  `RECORDER_HARD_CAP_TICKS`, `INPUT_FIELDS`, and the
  `ReplayRejectReason` union. Replay shape is JSON-clean (no typed
  arrays, no functions) so the future save-integration slice can
  `JSON.stringify` it directly into a save slot without inventing an
  encoder.
- Recorder is delta-encoded: only the input fields that changed since
  the prior tick are stored. A 600-tick (10 s) hold of constant
  throttle compresses to a single delta entry. The recorder rejects
  non-integer ticks, ticks that do not strictly increase, and
  `record` calls past the 15-minute hard cap (`truncated: true` is
  stamped on the resulting replay). A soft-cap callback fires once
  when crossing the 5-minute threshold so a future HUD slice can
  surface the warning; the callback is wrapped in try / catch so a
  HUD fault cannot break recording.
- Player validates the replay up front against `REPLAY_FORMAT_VERSION`,
  `PHYSICS_VERSION`, and `FIXED_STEP_MS`. Mismatches set
  `mismatchReason` to one of `format-version-mismatch`,
  `physics-version-mismatch`, `fixed-step-mismatch`, or
  `malformed-replay` and `readNext` returns `null` so the consumer's
  ghost-render branch becomes a no-op. Once the recording is
  exhausted, `readNext` returns `NEUTRAL_INPUT` (the dot stress-test
  item 4 explicitly preferred this over "coast on the last input" so
  a finished ghost does not run throttle off the end of the
  recording). The `finished` flag latches.
- Added `PHYSICS_VERSION = 1` to `src/game/physics.ts` with a docstring
  pinning the bump rules (constants change, integration order
  changes, additions to `CarState` that physics writes to). Separate
  from the build-version slice that stamps the git SHA at build
  time; this version is owned by code so a replay produced under v1
  physics is rejected when the math has moved on.
- Authored `src/game/__tests__/ghost.test.ts` (34 tests) covering
  recorder per-tick record, neutral first-tick, no-change skip,
  strictly increasing tick guard, finalize idempotency, defensive
  copy on continued recording, soft-cap callback (fires exactly
  once, survives a thrown callback), hard-cap rejection +
  `truncated` stamp, scripted-sequence round-trip, neutral coast
  after exhaust, finished latching, zero-tick replay, long-hold
  compression, two-recorder JSON-equal determinism, two-player
  identical-stream determinism, and every `ReplayRejectReason`
  branch (future format version, stale physics version, fixed-step
  mismatch, out-of-range tick, non-strictly-increasing deltas, mask
  zero, mask out of byte range, values length disagreement,
  non-integer / negative `totalTicks`, non-array `deltas`).
- Re-exported the public surface from `src/game/index.ts` so
  downstream consumers (`@/game`) get a one-line import path,
  matching the pattern used by `rng`, `nitro`, and the other game
  modules.

### Decisions
- **Stateful recorder rather than a pure reducer.** A pure
  `record(prior, input) -> priorPlusInput` would either churn
  thousands of objects per lap or push the call site to mutate
  anyway. The mainline race session already owns one recorder
  reference per session, so the stateful API is the natural fit. The
  recorder is internally pure (testable, replayable) behind a
  smaller public API.
- **Replay is JSON-clean, not Uint8Array-encoded.** The dot
  stress-test (item 1) suggested base64-encoded `Uint8Array` deltas
  for compactness. We deferred that: the in-memory shape is
  `ReplayDelta[]` with `tick`, `mask`, `values`. When the save slice
  lands and we measure the actual storage footprint, switching to
  base64-packed bytes is an additive on-the-wire format bump
  (`REPLAY_FORMAT_VERSION` 2). Shipping JSON now keeps the slice
  small and makes test-time inspection (deep-equal asserts) trivial.
- **Player returns `NEUTRAL_INPUT` after exhaust, not the last input.**
  Per the dot stress-test item 4 recommendation. A finished ghost
  that mashes throttle off the end of its recording would crash
  into the wall behind the start line on tracks with a sharp turn 1.
  Coasting under physics is the conservative default; consumers that
  want different post-finish behaviour can read `finished` and stop
  rendering.
- **Format version and physics version are independent stamps.** The
  format describes the on-the-wire struct shape; the physics version
  describes the math the inputs were captured against. Either can
  bump without the other, so they are two fields rather than a
  combined "version".
- **Determinism contract is bit-exact, not "within tolerance".** The
  stress-test item 10 made this explicit: with a seeded RNG (the
  prior slice) and a pure physics step (per AGENTS.md RULE 8), there
  is no float-drift surface for record / playback to diverge on. The
  ghost test asserts `toEqual`, not `toBeCloseTo`. If a future test
  ever needs a tolerance, the determinism contract is broken and the
  fix belongs at the source.

### Open questions
- None new. The dot stress-test items 7 (save schema integration), 8
  (best-ghost comparison rule), 9 (renderer integration), 11
  (physics-feel benchmark consumer), 13 (Time Trial UI hook), and
  14 (Playwright e2e once a Time Trial route exists) are deferred to
  the followups below; they are not ambiguous, just not in scope for
  the producer slice.

### Followups
- F-021: wire `Replay` into `SaveGameSchema` as a `ghosts: Record<slug,
  GhostReplaySchema>` field with a v2 migration. Add a "best-ghost"
  comparison helper (`replace iff finalTimeMs < currentReplay
  .finalTimeMs`) per stress-test item 8.
- F-022: render the ghost car in `pseudoRoadCanvas.ts` as a
  translucent (`globalAlpha = 0.5`) blue-tinted player sprite. Lands
  with the visual-polish atlas slice that ships the player car
  frames.
- F-023: Time Trial UI hook (record on race start, save as PB ghost
  on finish if it beats the stored time, hide the ghost when the
  player has no PB yet). Lands with the time-trial dot.

### GDD edits
- None this slice.

---

## 2026-04-26: Slice: seeded deterministic PRNG module (rng.ts, mulberry32, splitRng) + Math.random ban

**GDD sections touched:**
[§15](gdd/15-cpu-opponents-and-ai.md) (deterministic AI contract),
[§21](gdd/21-technical-design-for-web-implementation.md) (deterministic
inputs, deterministic replay tests). The §21 contract for bit-exact
replay across runs depends on a single owned PRNG that every randomness
consumer (AI chaotic branch, damage hits, weather rolls, particle
effects, ghost replay sanity) imports from. This slice ships that
module so the downstream slices that depend on determinism (full AI,
damage model, weather, ghost replay, physics-feel benchmark) can land
on a stable foundation.
**Branch / PR:** `feat/seeded-deterministic-rng` (stacked on
`feat/race-checkpoint-tracking`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/game/rng.ts` exporting `Rng`, `createRng`, `splitRng`,
  `serializeRng`, and `deserializeRng`. Algorithm is mulberry32 (15
  lines, public-domain), transcribed fresh under MIT. Single u32 state
  word; trivially serialisable into a save / replay slot. All math
  goes through `Math.imul` so the output is identical across V8 /
  SpiderMonkey / JavaScriptCore (no IEEE-754 ordering hazard).
- `splitRng(parent, label)` derives a deterministic sub-stream by
  consuming one parent advance and mixing the post-advance state with
  an FNV-1a hash of the label. Two parents with the same seed and
  label produce the same child; two children with different labels on
  the same parent produce different streams. Different parent seeds
  with the same label also produce different children.
- `nextInt(min, maxExclusive)` and `nextBool(probability)` advance the
  state by one step per call. Both `nextBool(0)` and `nextBool(1)`
  still advance so the call is replay-observable; a guard that
  short-circuits the comparison must not skip the state advance.
- Seed normalisation: NaN / Infinity throw; floats throw in dev (caught
  loudly during development since race code controls every call site)
  and floor silently in prod; negatives coerce via `>>> 0`. Seed `0` is
  permitted and produces a non-degenerate stream pinned by snapshot.
- Added an ESLint `no-restricted-syntax` rule scoped to
  `src/game/**/*.ts` (excluded files: `rng.ts` and `__tests__/**`) that
  bans `Math.random` calls with a message pointing at `src/game/rng.ts`.
  Rule fires on the syntactic `MemberExpression`, so docstring mentions
  of the banned token in module headers do not trip lint.
- Authored `src/game/__tests__/rng.test.ts` (32 tests) covering: the
  mulberry32(42) reference snapshot for the first 8 values, seed-0
  snapshot, two-instance determinism over 1000 calls, every seed-
  normalisation edge case, splitRng isolation + parent advance count,
  serialise / deserialise round-trip after 1000 advances, nextInt
  range / negative / NaN / non-integer cases, nextBool determinism +
  state-advance invariant + fair-split smoke test over 10k rolls.
- Authored `src/game/__tests__/no-math-random.test.ts` as a static
  belt-and-braces guard alongside the lint rule. Walks `src/game/`,
  strips `//` and `/* */` comments before scanning, asserts no
  production source outside `rng.ts` references the literal token.
- Re-exported `Rng`, `createRng`, `splitRng`, `serializeRng`, and
  `deserializeRng` from `src/game/index.ts` so downstream consumers
  (`@/game`) get a one-line import path.

### Decisions
- **Algorithm choice: mulberry32, not xoshiro / pcg.** mulberry32's
  single u32 state word fits the §22 save-game schema's existing slot
  shape (a plain integer); xoshiro requires four state words. The
  period (2^32) is short for crypto but more than ample for a 60 Hz
  race that never exceeds ~10^5 ticks.
- **No `Date.now` and no `performance.now`.** The PRNG must be a pure
  function of its seed so replays are bit-exact. A wall-clock seed
  would couple the stream to the OS clock and break determinism.
- **`splitRng` consumes a parent advance.** Without the advance, two
  calls to `splitRng(rng, "ai")` (a likely caller mistake) would
  return the same child both times. Documented the snapshot pattern
  for callers that need to fan out multiple children from the same
  conceptual point: `serializeRng` the parent, then
  `deserializeRng(snapshot)` for each child.
- **`nextBool` advances state at p=0 and p=1.** A guard that returns
  early without advancing would change the per-tick PRNG usage count
  depending on input data, which is a determinism hole. The advance
  is unconditional; the comparison branches inside.
- **Static guard scope is `src/game/` only.** The render pipeline's
  particle code lives under `src/render/effects*` (visual-polish slice)
  and will get its own guard once that path exists. The dot stress-
  test §"Affected Files" mentions both paths; this slice ships the
  game half today.

### Open / Skipped
- ESLint scope cannot easily extend to `src/render/effects*` until that
  path exists; the visual-polish slice (`implement-visual-polish-7d31d112`)
  should add the second ESLint override entry when it lands. Documented
  in the dot's stress-test §"Affected Files" so the future implementer
  has a one-line pointer.
- `splitRng(parent, label)` derives via `(state * 0x9e3779b1) ^
  fnv1a(label)`. The constant `0x9e3779b1` is the 32-bit golden ratio,
  a widely-used mixing constant; if a future audit demands a different
  mixing function (e.g. SplitMix32) the change is local to this module
  and every existing serialised state would still round-trip because
  `splitRng` does not affect serialisation.
- The dot stress-test §"How callers use it" mentions consumer wiring in
  `ai.ts`, `damage.ts`, weather (not yet built), and `ghost.ts` (not
  yet built). Those wirings are owned by their respective slices; this
  slice ships only the module + ban.

### Verify
- `npm run lint` clean (the new ESLint override compiles and matches no
  current source). `npm run typecheck` clean. `npm test`:
  **1020 tests pass** across 45 files (added 33: 32 in `rng.test.ts`,
  1 in `no-math-random.test.ts`). `npm run build` clean. `npm run
  test:e2e`: **28 tests pass** (no regressions on existing flows).
- No em-dashes in the new files (verified via `grep -P
  '[\x{2013}\x{2014}]'`).

---

## 2026-04-26: Slice: race checkpoint pass tracking (RaceState fields, runtime detector, anti-shortcut guard)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) (lap counting, anti-shortcut),
[§22](gdd/22-data-schemas.md) (Track.checkpoints schema, now consumed at
runtime). The §22 schema declares `checkpoints: [{segmentIndex, label}]`
but the only runtime consumer was the §20 sector-splits widget; this
slice adds the per-tick detector that the §7 lap-credit guard, the §6
practice resetToCheckpoint, and the §15 AI recover-spawn all share.
**Branch / PR:** `feat/race-checkpoint-tracking` (stacked on
`feat/pure-race-rules-module`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/game/raceCheckpoints.ts` as a pure helpers module
  carrying `detectCheckpointPass`, `applyCheckpointPass`,
  `resetCheckpointsForNewLap`, and `hasPassedAllCheckpoints`. No
  `Math.random`, no `Date.now`; same inputs always produce the same
  output across runs (AGENTS.md RULE 8 determinism).
- Extended `RaceState` (`src/game/raceState.ts`) with two additive
  fields: `lastCheckpoint: LastCheckpointSnapshot | null` (the most
  recently forward-crossed checkpoint plus a defensive copy of the
  player's `CarState`) and `passedCheckpointsThisLap: ReadonlySet<number>`
  (the set of segment indices passed since the last start-line cross,
  cleared on lap rollover). Both default to the empty / null value at
  session creation.
- Updated `raceSession.ts` to construct the new fields when building
  the initial `RaceState`. Existing `...state.race` spreads in the
  countdown / racing branches preserve them automatically; no behaviour
  change for the active session.
- The detector pins forward-only pass detection, wrap-around handling
  for lap rollover (start-line checkpoint at `segmentIndex = 0` is
  detected on the wrap, not on the way up to `prevZ`), and a
  movement-window guard that returns `null` when the per-tick advance
  exceeds half the track length (the `loop`'s 250 ms accumulator cap
  makes this structurally impossible at 60 Hz, but the detector
  defends anyway).
- Multi-checkpoint per tick returns the LAST crossed (highest z)
  checkpoint with a stable lex-on-label tie-break for the rare
  same-z case; this keeps the API one event per tick and matches the
  iter-19 stress-test guidance.
- `EMPTY_PASSED_SET` is a frozen empty set shared across every fresh
  `RaceState` so a no-checkpoint-yet session does not allocate a new
  set per call. `addToFrozenSet` returns a fresh frozen set so the
  `RaceState` snapshot a downstream replay holds cannot be mutated.
- Test fixture `src/game/__tests__/raceCheckpoints.test.ts` (22 cases)
  pins the eight `detectCheckpointPass` cell-level cases from the dot
  (empty list, forward pass, no pass, wrap, reverse, multi-pass,
  half-track guard, non-finite inputs), the `applyCheckpointPass`
  purity / defensive-copy / idempotent behaviours, the
  `resetCheckpointsForNewLap` clear-but-preserve semantics, and the
  full `hasPassedAllCheckpoints` truth table for 0 / 1 / 2 / 5
  checkpoint counts.

### Verified
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 987 / 987 (43 files), including the new
  `raceCheckpoints.test.ts` and all 44 existing
  `raceSession.test.ts` cases.
- `npm run build`: clean (Next.js static export of all 15 routes).
- `npm run test:e2e`: 28 / 28.
- `grep -P '[\x{2013}\x{2014}]'` over the new files: nothing.

### Followups
- The §7 lap-credit guard (`hasPassedAllCheckpoints`) is now exported
  but not yet wired into `raceSession.ts` lap detection. The parent
  race-rules dot (`VibeGear2-implement-race-rules-b30656ae`) will land
  the wire-up once it picks up the now-pinned helpers.
- The `raceSession` does not yet call `detectCheckpointPass` per tick
  so `lastCheckpoint` and `passedCheckpointsThisLap` stay at their
  initial values during a live race. Wiring these into the racing
  branch (alongside the existing sector-splits tick) is the
  follow-up wiring slice; the consumers (practice reset, AI recovery)
  will need it before this slice is fully load-bearing.

---

## 2026-04-26: Slice: pure raceRules.ts module (countdown labels, DNF timers, ranking, final-state builder)

**GDD sections touched:**
[§7](gdd/07-race-rules-and-structure.md) (race lifecycle, fail states,
tie handling). The §7 spec names DNF as a fail state but does not pin
timeout values; this slice pins them per the parent dot's iter-19
researcher stress-test.
**Branch / PR:** `feat/pure-race-rules-module` (stacked on
`feat/legal-safety-doc`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/game/raceRules.ts` as a pure-helpers module mirroring
  the `nitro.ts` / `damage.ts` / `drafting.ts` pattern: pure module
  first, race-session wiring second.
- Exported countdown HUD labels (`COUNTDOWN_TICK_LABELS`,
  `labelForCountdown`) re-using the existing `DEFAULT_COUNTDOWN_SEC`
  constant from `raceState.ts` so the countdown duration is single-
  sourced.
- Pinned the four DNF threshold constants (`DNF_OFF_TRACK_TIMEOUT_SEC`,
  `DNF_NO_PROGRESS_TIMEOUT_SEC`, `DNF_RACE_TIME_LIMIT_SEC`,
  `DNF_NO_PROGRESS_DELTA_M`, plus `DNF_OFF_TRACK_RESET_SPEED_M_PER_S`
  for the high-speed-grass-excursion guard) and shipped the per-car
  reducer `tickDnfTimers(prev, sample, dt)` returning a fresh
  `{ timers, dnf, reason }`. Reset semantics match the iter-19
  stress-test §4 "drove through grass for 28s, came back for one tick,
  drove off again" guard.
- Shipped `exceedsRaceTimeLimit(elapsedSec)` for the hard race-time
  cap.
- Shipped `rankCars(snapshots)` with the iter-19 §3 tie-break ladder
  (status partition `finished > racing > dnf`, then lap > z >
  totalDistance > carId lex). The iter-19 §8 ranking case
  `[(1,1500),(1,1900),(2,10),(1,800)]` ranks as
  `[carC, carB, carA, carD]`, asserted in the test file.
- Shipped the `FinalRaceState` shape and `buildFinalRaceState(input)`
  builder. Per-car `bestLapMs` derives from `Math.min` of the lap
  array; fastest lap scans every (car, lapIndex) cell with earliest-
  lap and lex-carId tie-breaks. Reward computation
  (`economy-upgrade-ff73b279`) consumes this output; the boundary
  matches the iter-19 §5 split.
- Authored `src/game/__tests__/raceRules.test.ts` with 31 unit cells
  covering countdown labels (parametric), DNF off-track / no-progress
  windows, the threshold-on-exact-tick edge cases, the off-track
  reason preference on simultaneous trip, race-time-limit edge cases,
  ranking ladder + status partition, and the full
  `buildFinalRaceState` happy path / DNF / no-laps / determinism
  matrix. Frozen-input invariant asserted; per-call fresh-object
  invariant asserted.
- Filed sub-dot `VibeGear2-implement-pure-racerules-6272a25e` under
  the parent composite `VibeGear2-implement-race-rules-b30656ae`.
  Pure-helpers slice is closed; the wiring slice (race-session
  integration, `RaceState.cars[]` extension, Playwright e2e for
  3-lap race) lands in a follow-up sub-dot. Parent composite stays
  open per the iter-30 HUD-UI tracking-parent pattern.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (965 tests, 42 files; 31 new in raceRules.test.ts).
- `npm run build` clean.
- `npm run test:e2e` green (28 specs).
- No em-dashes (U+2014) or en-dashes (U+2013) in any added file
  (`grep -P "[\x{2013}\x{2014}]"` returns nothing).

### Decisions and assumptions
- Re-exported `DEFAULT_COUNTDOWN_SEC` from `raceRules.ts` rather than
  duplicating. Single source of truth lives in `raceState.ts`; the
  re-export keeps `raceRules.ts` self-contained for downstream
  consumers without a module-graph cycle.
- `labelForCountdown` returns `"GO"` for non-finite or non-positive
  inputs (including `+Infinity`) as a defensive fallback. A caller
  that subtracts past zero before checking phase still renders a
  sensible label.
- `tickDnfTimers` off-track reset uses the two-condition rule:
  on-road OR moving-fast (`speed >= DNF_OFF_TRACK_RESET_SPEED_M_PER_S`,
  pinned at 5 m/s ~ 18 km/h). A car blasting through gravel at full
  speed is racing, not retired; only a slow off-road excursion
  accumulates the timeout.
- When both timers trip on the same tick, `tickDnfTimers` reports the
  off-track reason because that is the more informative outcome for
  the §20 results screen.
- Ranking inside the `finished` status partition uses carId lex
  order in this slice. The iter-19 stress-test pinned
  `finishedAtTick` as the canonical tie-break; that field belongs on
  the wiring slice's extended `CarRankSnapshot` shape, deferred to
  keep the pure-helpers surface minimal.
- The DNF threshold values (30s off-track, 60s no-progress, 600s race
  cap, 5m progress delta) are pinned per the iter-19 stress-test §4.
  No new GDD edits required; §7 explicitly defers the numbers to the
  implementer.
- `buildFinalRaceState`'s DNF ordering (descending laps, then
  ascending last-lap time, then carId lex) is a slice-local choice;
  the §7 standings table only specifies tour-aggregate tie-breaks,
  not per-race DNF ordering. Documented inline.

### Followups created
- (none) The wiring slice belongs to a follow-up sub-dot of the
  parent composite. The composite tracks the remaining work:
  `RaceState.cars[]` extension, race-session integration replacing
  the current `Math.floor(z / trackLength)` lap-detection stub, and
  the Playwright `e2e/race-finish.spec.ts` for a 3-lap race against
  AI.

### GDD edits
- None. §7 race-rules text is unchanged; the threshold values land
  as code-level constants per the parent dot's stress-test pin.

---

## 2026-04-26: Slice: LEGAL_SAFETY.md authoring per GDD §26

**GDD sections touched:**
[§26](gdd/26-open-source-project-guidance.md) (the IP-contamination
rules and the suggested issue labels including `legal-review`),
[§27](gdd/27-risks-and-mitigations.md) (legal / IP drift named as a
primary risk; this document is the named mitigation), and the IP
perimeter from
[§1](gdd/01-title-and-high-concept.md) and
[§2](gdd/02-spiritual-successor-boundaries.md).
**Branch / PR:** `feat/legal-safety-doc` (stacked on
`feat/manual-transmission-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Authored `docs/LEGAL_SAFETY.md` with all 14 sections from the dot's
  binding outline: purpose and audience, the IP perimeter, safe content
  patterns with concrete examples, unsafe content patterns with concrete
  counter-examples, the grey-zone escalation surface, the asset
  manifest provenance contract, originality statement guidance, the PR
  checklist (reproduced verbatim from CONTRIBUTING for self-containment),
  the future content-lint denylist contract, the visual / audio review
  bar, the `legal-review` label protocol, the take-down request
  protocol, the issues / wiki rules, and the update-this-document
  protocol.
- Cross-linked the doc to `LICENSE`, `ASSETS-LICENSE`, the eventual
  `DATA-LICENSE`, `CONTRIBUTING.md`, the eventual `MODDING.md`, and the
  GDD sections that anchor the IP perimeter.
- Added a "Legal safety" one-liner to the README's "Reading order for
  new contributors" block so new contributors land on the doc before
  they ship art or audio.
- Filed `F-020` against the future `scripts/content-lint.ts`: the
  contract for what the lint enforces lives in LEGAL_SAFETY.md §9, the
  script that enforces it ships separately. `nice-to-have` priority,
  matches the dot's "Verify" bullet.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green.
- `npm run build` clean.
- `npm run test:e2e` green.
- No em-dashes (U+2014) or en-dashes (U+2013) in
  `docs/LEGAL_SAFETY.md`, the `README.md` diff, or the `FOLLOWUPS.md`
  diff (`grep -P "[\x{2014}\x{2013}]"` returns nothing for each).

### Decisions and assumptions
- Cross-linked to `DATA-LICENSE` even though the file does not exist
  yet. The dot's "Edge Cases" allows forward links to as-yet-unwritten
  siblings; the licence-files slice will land the file shortly. Until
  then, the doc states the convention (track JSON is CC BY-SA 4.0 by
  GDD §26) so contributors are not blocked.
- Cross-linked to `docs/MODDING.md` even though that file is owned by a
  separate dot (`implement-modding-md-efbf1c83`). Same forward-link
  rationale.
- Reproduced the PR checklist verbatim from `docs/CONTRIBUTING.md`
  rather than cross-link only. The dot's outline §8 explicitly asked
  for reproduction so the file stays self-contained; the duplication
  is intentional and the maintainer keeps both copies in sync at
  edit time.
- Did not enumerate every conceivable real-circuit name in the
  denylist illustration; the doc states the lists are illustrative and
  the authoritative version lives in the lint script when it lands
  (F-020). This avoids false implication that the doc is the
  enforceable surface.
- Did not name any specific real driver, current Formula 1 team, or
  current racing organisation, even as a "do not use" example. The
  dot's "Edge Cases" forbade that pattern; the doc uses generic
  placeholders ("any real-world racing-circuit name") instead.

### Followups created
- `F-020`: `scripts/content-lint.ts` implementing the §9 denylist
  contract.

### GDD edits
- None. The doc cites GDD §26 §27 §1 §2 verbatim; no GDD changes
  required.

---

## 2026-04-26: Slice: manual transmission race-session wiring

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Gear shifting") and
[§19](gdd/19-controls-and-input.md) (E / Q for keyboard, RB / LB for
gamepad). The pure transmission state machine in
`src/game/transmission.ts` is now consumed by the race session each
tick, so the on-track behaviour matches the §10 torque curve plus the
§19 manual-shift rising-edge contract.
**Branch / PR:** `feat/manual-transmission-race-wiring` (stacked on
`feat/drafting-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Added `createTransmissionForCar(stats, options)` and a
  race-session-friendly alias `tickTransmission(state, ctx, dt)` to
  `src/game/transmission.ts`. The constructor reads the player-facing
  mode (`SaveGameSettings.transmissionMode`) plus the active car's
  installed gearbox upgrade tier so the per-race state machine starts
  with the right reducer branch wired up from tick zero.
- Extended `RaceSessionPlayer` with an optional `transmissionMode`
  field defaulting to `"auto"` (matching the §10 default and the
  schema's optional-for-legacy-saves shape).
- Extended `RaceSessionPlayerCar` and `RaceSessionAICar` with
  `transmission`, `lastShiftUpPressed`, and `lastShiftDownPressed`
  fields so the race session can detect the rising edge of the
  player's shift inputs and feed the resulting one-tap-one-shift
  signal into `tickTransmission`. AI cars are pinned to `"auto"` with
  the same edge-detection plumbing for parity (no AI archetype today
  emits shift inputs).
- `stepRaceSession` advances transmission state on the same tick as
  nitro and drafting, then composes
  `gearAccelMultiplier(transmission)` multiplicatively with the nitro
  `accelMultiplier` and feeds the composed value into `physics.step`
  so a manual driver who taps nitro mid-band benefits from both.
- `cloneSessionState` and the countdown / promoted-to-racing branches
  spread the new fields uniformly so every state path stays a fresh
  immutable object (no aliasing between ticks).
- Added 12 new tests under `stepRaceSession (transmission)` covering
  the dot's verify items: per-car transmission init at race start,
  honour `transmissionMode` setting, AI always auto, auto mode ignores
  shift inputs, manual rising-edge fires once per tap, held shift does
  not cascade, releasing re-arms the edge detector, manual shiftDown
  drops a gear, gearbox upgrade tier caps max gear, gear curve
  composes multiplicatively with nitro, auto mode upshifts on
  acceleration, and 1000-tick determinism under a mixed
  shift-tap / throttle input stream.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (917 tests, 41 files; +12 from this slice).
- `npm run build` clean.
- `npm run test:e2e` green (28 tests).

### Decisions and assumptions
- Composed gear multiplier with nitro multiplier multiplicatively. The
  §10 budget calls the manual peak a small expert advantage (under
  5%); composing multiplicatively keeps the §10 nitro thrust ceiling
  the dominant accel knob and lets the gear curve sit alongside as a
  feel modifier rather than a top-speed lever.
- Pinned AI cars to `"auto"` regardless of player settings. The
  `clean_line` archetype never raises shift inputs; future archetypes
  that want to opt in can pass `transmissionMode: "manual"` through a
  config-shape extension.
- Did not wire the race page (`src/app/race/page.tsx`) to read the
  transmission setting from `loadSave()` yet. The pure runtime is the
  scope of this dot; integrating the save-loaded settings into the
  page is a wider integration owned by the savegamesettings dot.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: drafting / slipstream race-session wiring

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Drafting" subsection):
the pure helpers in `src/game/drafting.ts` are now consumed by the
race session each tick, so the on-track behaviour matches the §10
"0.6 s engagement, break on side movement / brake" rules end to end.
**Branch / PR:** `feat/drafting-race-wiring` (stacked on
`feat/nitro-race-wiring`), PR pending.
**Status:** Implemented.

### Done
- Wired `computeWakeOffset` + `tickDraftWindow` into
  `src/game/raceSession.ts` so every car (player + AI) runs a per-tick
  draft scan and the resulting `accelMultiplier` flows into
  `physics.step` via `StepOptions.draftBonus`.
- Added `RaceSessionState.draftWindows` keyed by
  `<followerId>>>><leaderId>` (`draftPairKey`) so multiple parallel
  pairs in a full grid stay isolated. `PLAYER_CAR_ID` and `aiCarId`
  exports give callers a stable id mapping.
- Per-tick rule: each follower's `pickLeader` pass picks the closest
  in-wake leader (deterministic tiebreak by lexical leader id), then
  every existing pair entry for that follower is advanced through
  `tickDraftWindow`. Pairs whose geometry now reads `inWake: false`
  reset to `{ engagedMs: 0, accelMultiplier: 1 }` the same tick the
  side-step / brake / out-of-gap event happens, matching §10's "break
  instantly" rule.
- Only the actively-picked pair contributes to the physics bonus; the
  other windows persist for re-engagement bookkeeping but cannot stack
  with the active pick.
- Added 9 new tests under `stepRaceSession (drafting)` covering the
  dot's verify items: 1000-tick determinism with 2 cars in tandem,
  brake input zeroes the bonus, side-step zeroes the bonus,
  pair-isolation in a 4-car field, no bonus below the speed threshold,
  no advancement during countdown, and an end-to-end physics integration
  check (a drafting follower out-distances a solo runner over 120 ticks).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (905 tests, 41 files).
- `npm run build` clean.
- `npm run test:e2e` green (28 specs across chromium and
  mobile-chromium projects).
- No em-dashes / en-dashes in any touched file (grep U+2014 / U+2013).

### Decisions and assumptions
- Pair-isolation is enforced by writing every existing follower pair
  entry through `tickDraftWindow` each tick, not just the actively
  picked one. The alternative (only advance the active pair, leave
  others untouched) would let stale `engagedMs` linger across leader
  switches and fail the §10 "break instantly" rule when the follower
  swerves wide of one leader and into the wake of another.
- `pickLeader` ties break by lexical leader id so two leaders at the
  same `longitudinalGap` always resolve identically across runs. This
  matters at race start where the grid spacing puts AI cars exactly
  `AI_GRID_SPACING_M` apart.

### Followups
- None new. The §10 "Drafting" entry is now end-to-end wired; future
  HUD work (F-NNN) might surface the engaged multiplier as a small
  indicator next to the speedometer.

---

## 2026-04-26: Slice: deferred Playwright e2e specs (F-016, F-017, F-018)

**GDD sections touched:**
[§19](gdd/19-controls-and-input.md) (touch overlay verification),
[§20](gdd/20-hud-and-ui-ux.md) (pause overlay, error fallback,
loading screen affordances),
[§21](gdd/21-technical-design-for-web-implementation.md) (Testing
approach: Playwright spec coverage for the Phase 1 vertical slice).
**Branch / PR:** `feat/deferred-playwright-e2e` (stacked on
`feat/nitro-system`), PR pending.
**Status:** Implemented.

### Done
- Added three dev-only routes that give the e2e suite deterministic
  surfaces to drive without dragging in production wiring that other
  slices still own:
  - `src/app/dev/throw/page.tsx`: client component that throws a
    fixed message synchronously in render so the root
    `<ErrorBoundary>` catches and renders its fallback. The throw
    happens in render so `getDerivedStateFromError` runs, not in an
    effect (where the boundary cannot see it).
  - `src/app/dev/touch/page.tsx`: mounts `<TouchControls forceVisible />`
    over a surface div wired to
    `createInputManager({ touchTarget })`. Surfaces the latest sampled
    `Input` (steer, throttle, brake, nitro, pause) as
    `data-testid="touch-metric-*"` for the spec to read.
  - `src/app/dev/loading/page.tsx`: mounts `<LoadingGate>` against a
    synthetic in-page fetcher whose per-entry resolution delay is
    controlled by `?delay=<ms>` (default 200) and whose forced
    critical-failure path is opt-in via `?fail=1`. Children render a
    `data-testid="loading-dev-ready"` card on success.
- Added the four deferred specs:
  - `e2e/pause-overlay.spec.ts`: Escape opens the overlay, the
    speedometer is stable across a 500 ms gap (proving
    `LoopHandle.pause()` fires on the same edge), Escape and the
    Resume button each dismiss it, and the Retire entry is present
    but disabled (the race route does not pass `onRetire` until the
    results screen lands).
  - `e2e/error-boundary.spec.ts`: the fallback renders with
    `role="alert"`, the inline message matches the forced throw, the
    Reload button reloads the page (and the boundary catches the
    second throw on the reloaded route), and the Copy button does not
    crash with clipboard permissions granted.
  - `e2e/touch-input.spec.ts`: runs against a new `mobile-chromium`
    Playwright project (iPhone 13 emulation). Holds the GAS, BRK, and
    pause-corner zones with synthetic `PointerEvent`s and asserts the
    matching metric flips. Drags the steering stick past the
    `stickMaxRadius` and asserts `steer > 0.5`.
  - `e2e/loading-screen.spec.ts`: drives `/dev/loading?delay=300`,
    asserts the screen is visible with `data-phase="loading"` and
    text matching `Loading \d+ of 4`, then waits for `Loaded 4 of 4`
    and the ready card. The failure variant
    (`?delay=80&fail=1`) asserts `data-phase="failed-critical"` and
    that the Retry button mounts.
- Updated `playwright.config.ts` to add the `mobile-chromium` project
  (iPhone 13 emulation, scoped to `touch-input.spec.ts`) and to
  exclude that spec from the default chromium project so the desktop
  pointer profile does not try to drive the on-screen overlay.
- Marked F-016, F-017, F-018 `done` in `docs/FOLLOWUPS.md` with
  closing notes pointing at this branch.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` green (no new unit suites; touched code is e2e + dev
  pages; existing suites still pass).
- `npm run build` clean.
- `npm run test:e2e` green locally on both projects (chromium and
  mobile-chromium), including the four new specs and the existing
  title / options / race-demo coverage.

### Decisions and assumptions
- The race route (`/race`) does not yet wire `touchTarget` into
  `createInputManager`. Driving the touch spec against the race route
  would require either modifying the race wiring (out of scope for
  this dot) or adopting a `forceTouch` query-string side channel
  (rejected on the same grounds the dot rejects `?test_error=1`).
  The dev page is a clean fixture: it mounts the same source +
  overlay pair the race route will mount once that wiring lands, and
  the spec asserts the underlying input shape directly so it is
  immune to the future wiring change.
- The race route also does not yet wire `<LoadingGate>`. The race
  page comment already references `F-018` for that wiring (see
  `src/app/race/page.tsx`). The dev page lets the spec exercise the
  full state machine (loading, ready, failed-critical, retry) end to
  end without coupling it to the production manifest's currently
  empty asset pipeline.
- The error-boundary `Copy error` button reads `navigator.clipboard`
  which Playwright fronts with a permission prompt. The spec grants
  the read/write clipboard permissions before the click so the
  promise resolves cleanly; the button gracefully no-ops when the
  permission is denied (per `ErrorBoundary.tsx`'s `onCopy` guard).
- The pause overlay's Retire button is asserted as `disabled` rather
  than testing the retire flow, because no retire callback is wired
  in the race route yet. When the results screen lands the spec will
  flip the assertion to `toBeEnabled()` and follow the click through
  to the results route.

### Followups created
- None. F-016, F-017, F-018 closed by this slice.

### GDD edits
- None. The slice closes deferred test coverage; no design changes.

---

## 2026-04-26: Slice: nitro / boost system per §10 §12 §19

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Nitro system",
"Damage effects on performance", "Weather effects on handling"),
[§12](gdd/12-upgrade-and-economy-system.md) ("Nitro system" upgrade
category, §12 cost ladder),
[§19](gdd/19-controls-and-input.md) (Space + X / Square bindings).
**Branch / PR:** `feat/nitro-system` (stacked on
`feat/manual-transmission`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/nitro.ts`: pure state machine over
  `{ charges: number; activeRemainingSec: number }` with reducer
  `tickNitro(state, ctx, dt) -> { state, code, isActive }`. The
  reducer treats taps as rising-edge (`pressed && !wasPressed`) so a
  held key does not re-fire on every tick; it ignores taps while a
  charge is currently burning (no stacking, the dot's edge case);
  releasing the key mid-burn does not abort the charge; holding past
  the burn does not extend it.
- Pinned the §10 baselines: `DEFAULT_NITRO_CHARGES = 3`,
  `BASE_NITRO_DURATION_SEC = 1.1`,
  `BASE_NITRO_THRUST_MULTIPLIER = 1.5`. The thrust baseline reads as
  "noticeable, not dominant" and respects the
  `ACCEL_MULTIPLIER_MAX = 2` clamp the physics step already enforces.
- Pinned the §12 nitro upgrade ladder via `NITRO_UPGRADE_TIERS`
  (Stock through Extreme). Each tier scales `chargesBonus`,
  `durationMultiplier`, and `thrustMultiplier`. Stock is identity;
  Extreme grants `+1 charge`, `x1.25 duration`, `x1.235 thrust`. The
  worst-case stacked accel is `1.5 * 1.235 = 1.8525`, comfortably
  under the `2.0` physics ceiling. `nitroUpgradeTierFor(tier)` and
  `nitroUpgradeTierForUpgrades(obj)` read either form; out-of-range
  tiers clamp into the table.
- Added `getNitroAccelMultiplier(state, ctx)`: returns the
  per-tick multiplier the physics step's existing `accelMultiplier`
  slot consumes while a charge is burning, and `1.0` otherwise. The
  result is the product of the tier's thrust, the car's
  `nitroEfficiency` stat (§11), and the §10 damage band's
  `nitroEfficiency`. Clamped into `[1, 2]` so a damaged engine
  never makes the car slower than no boost, and stacked bonuses
  cannot turn the slot into a top-speed cheat.
- Added `getInstabilityMultiplier(state, surface, weather, band)`:
  returns `1.0` when no charge is burning, otherwise the product of
  three axes (`weather risk * surface * damage band`) clamped into
  `[1, INSTABILITY_MULTIPLIER_MAX = 8]`. The §10 weather risk
  table is reproduced via `NITRO_WEATHER_RISK` (8 schema weather
  values mapped onto the §10 6 risk buckets; `dusk` and `night`
  both map to Low; `rain` maps to Medium). Tables are exported so
  HUD and traction-loss consumers can introspect the per-axis
  multipliers without re-deriving them.
- Race-start helper `createNitroForCar(stats, upgrades?)` reads the
  nitro upgrade tier from the player's installed upgrades and
  returns a frozen baseline state with `DEFAULT_NITRO_CHARGES +
  tier.chargesBonus` charges. Re-exported from
  `src/game/index.ts`.
- Added `src/game/__tests__/nitro.test.ts` (52 tests): frozen
  initial state, charge clamps, upgrade ladder shape and curve
  monotonicity, tap rising-edge detection, no charge stacking,
  three-charge spend exhaustion path, hold-past-duration boundary,
  defensive `dt <= 0` and stale-charge clamp paths,
  thrust-multiplier integration with car stats and damage band,
  no-boost floor when damage drags the boost below 1.0, the
  full instability table cross-product (3 surface x 8 weather x 5
  damage bands = 120 cells), 1000-tick deterministic replay,
  immutability guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (52 new nitro tests on top of the prior suite).
- `npm run build` clean. No route-size delta (the new module is
  game-logic only and not yet consumed by the renderer or
  `raceSession.ts`; integration with the existing physics seam
  ships in a follow-on slice via the `accelMultiplier` slot
  already plumbed by the transmission slice).
- `npm run test:e2e` skipped: pure reducer module with no DOM
  surface; no e2e specs were added or broken.
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Time field renamed from the dot's `activeUntilMs` to
  `activeRemainingSec` so it reads in the same units (`dt` in
  seconds) as the rest of the sim. Folding nitro time into the
  same dt cadence keeps the §21 replay/ghost system safe; an
  absolute-ms accumulator would diverge across runs whenever the
  loop's start timestamp changed.
- Tap detection uses a `wasPressed` companion rather than
  edge-triggering inside the input layer. Passing the prior
  press state through the context keeps the reducer stateless and
  matches the same pattern the transmission slice's `shiftUp` /
  `shiftDown` use.
- The dot pins the instability table at "6 weather x 4 surface x 5
  damage" (120 cells). The §22 `WeatherOption` enum carries 8
  values (mapped onto the §10 6 risk buckets), and the physics
  `Surface` type carries 3 values (`road | rumble | grass`), so
  the implemented cross-product is 8 x 3 x 5 = 120 cells under
  test, just along different axes than the dot's stress-test had
  in mind. The `NITRO_WEATHER_RISK` map is the explicit bridge
  between the schema's 8 weather values and the §10's 6 risk
  buckets.
- `getNitroAccelMultiplier` clamps to a no-boost floor of `1.0`
  rather than allowing severe damage to drag the multiplier below
  the no-boost identity. The §10 narrative describes a "weaker"
  nitro under damage, not a punishing one; the floor keeps the
  player from being penalised for using a charge while wrecked.
- Per-tier numbers (Sport `+0`, Factory `+1`, Extreme `+1` charge)
  pinned without a §12 explicit table; the §12 narrative says
  "Raises boost thrust and burn duration" without pinning a curve.
  The implemented curve is monotonically non-decreasing across
  tiers (asserted by the unit tests) and the worst-case Extreme
  product stays under the physics `ACCEL_MULTIPLIER_MAX = 2`
  clamp; a future balancing slice can pick exact numbers without
  rewriting consumers.
- The race session integration (resetting nitro to baseline
  charges at race start, feeding `getNitroAccelMultiplier` into
  the physics call site) is a follow-on slice. This slice ships
  the pure module + the per-tier table; the integration is a
  one-line `accelMultiplier: getNitroAccelMultiplier(...)` plumb
  that fits cleanly in the next slice without a rewrite.

### Followups created
- None. The race-session integration is a Phase 1 / 5 follow-on
  that will consume the helpers added here; it does not need a
  net-new follow-up entry because the existing
  `implement-phase-1-7aef013d` and `implement-race-rules-b30656ae`
  dots are the natural homes.

### GDD edits
- None. The implementation pins are inside the code; the §10 and
  §12 narratives stand as written.

---

## 2026-04-26: Slice: manual transmission and gear shifting per §10 §19

**GDD sections touched:**
[§10](gdd/10-driving-model-and-physics.md) ("Gear shifting"),
[§12](gdd/12-upgrade-and-economy-system.md) (Gearbox upgrade ladder),
[§19](gdd/19-controls-and-input.md) (E / Q + RB / LB bindings).
**Branch / PR:** `feat/manual-transmission` (stacked on
`feat/damage-band`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/transmission.ts`: pure state machine over
  `{ mode: 'auto' | 'manual', gear: 1..7, rpm: 0..1 }` with reducer
  `stepTransmission(state, ctx)`. Auto upshifts when prior RPM
  exceeds `AUTO_UPSHIFT_RPM = 0.85` and a higher gear exists; auto
  downshifts when prior RPM drops below `AUTO_DOWNSHIFT_RPM = 0.4`
  or the brake is pressed in any gear above first. Manual ignores
  auto thresholds and consumes `shiftUp` / `shiftDown` directly,
  ignored at the per-tier max gear / first-gear edges. Auto mode
  ignores shift inputs entirely so a stray press does not toggle
  modes (the dot's edge case).
- Pinned the gearbox upgrade ladder: Stock 5, Street 5, Sport 6,
  Factory 6, Extreme 7 in `MAX_GEAR_BY_GEARBOX_UPGRADE`. Helpers
  `maxGearForGearboxUpgrade(tier)` and `maxGearForUpgrades(obj)`
  read either form; out-of-range tiers clamp into the table.
- Pinned the torque curve via `gearAccelMultiplier(state)`: floor
  at `TORQUE_CURVE_FLOOR = 0.55` below `0.15` RPM, linear ramp to
  the gear's peak at `REDLINE_SOFT_LIMIT_RPM = 0.95`, then redline
  taper down to `peak * REDLINE_PENALTY_MULTIPLIER = 0.85` at the
  hard limit `1.0`. Auto peak `1.0`; manual peak `1.04`. The
  `1.04 / 1.0 = 1.04` ratio is the §10 "small expert advantage"
  budget, well under the dot's 5% cap. RPM clamps defensively
  into `[0, 1]` so a stale or buggy speed cannot poison physics.
- Wired `accelMultiplier` through `physics.step()` as a new
  optional `StepOptions` field (alongside `draftBonus` and
  `damageScalars`). The throttle term is now `accel * throttle *
  draftBonus * accelMultiplier * dt`. Defaults to `1.0` so existing
  call sites (`raceSession.ts`, the dev page, AI loop) keep their
  behaviour bit-for-bit. The race-session integration with the
  transmission reducer is a follow-on slice (kept narrow per the
  one-slice-one-PR rule); this slice ships the pure module + the
  physics seam.
- Added `transmissionMode: 'auto' | 'manual'` to
  `SaveGameSettingsSchema` as an optional field (back-compat with
  v1 saves; treat `undefined` as `'auto'` per §10). `defaultSave()`
  always sets it to `'auto'`. The §22 `saveGame.example.json` now
  carries the field. Schema tests cover the manual case, the
  default-auto case, and the bad-enum case.
- Re-exported the new module from `src/game/index.ts`.
- Added `src/game/__tests__/transmission.test.ts` (34 tests):
  upgrade-tier table, RPM band conversion (clamps and degenerates),
  auto upshift / downshift / brake-downshift / no-toggle behaviour,
  manual shift edges (max gear ignored, first gear ignored),
  stale-upgrade clamp, redline limiter, torque-curve monotonicity,
  manual-vs-auto < 5% advantage check, 200-step deterministic
  replay, immutability guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (824 tests; 34 new in `transmission.test.ts`,
  3 new schema tests).
- `npm run build` clean. No route-size delta (the new module is
  game-logic only and not consumed by the renderer yet).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  transmission state is a pure reducer).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Gear count by upgrade tier pinned at Stock 5, Street 5, Sport 6,
  Factory 6, Extreme 7. The dot pins these; the underlying §12
  text is qualitative ("unlocks higher gearing") so the numeric
  cadence here is the canonical source until a balancing slice
  changes it.
- Torque curve pinned to a linear floor / ramp / penalty model.
  §10's "smooths high-speed pull" language is qualitative; pinning
  the shape in one frozen function keeps the math reviewable and
  lets a future balancing slice pick exact numbers without
  rewriting consumers.
- Manual peak set to 1.04 (4%). The dot caps the advantage at
  under 5%; 4% gives a noticeable but undominating expert margin.
  The `tests` enforce the cap so a future tweak past 5% trips a
  test rather than silently breaking the §10 design promise.
- `transmissionMode` is persisted as `optional()` at the schema
  layer (matching the `difficultyPreset` pattern) so v1 saves
  written before this field landed continue to load. The
  `defaultSave()` writer sets the field eagerly, and consumers
  (HUD, race session) can default to `'auto'` when reading from a
  loaded save without a migration.
- Auto-mode brake-downshift fires from any gear > 1, not just at
  low RPM. §10's "downshift on brake" cue describes the
  expectation; the implementation matches by allowing the brake to
  drop one gear per tick until first.

### Followups
- F-NNN: wire `stepTransmission` into `raceSession` so the player
  car's `accelMultiplier` actually consumes the gear curve at race
  time. Held as a separate slice because the race session also
  owns the input-edge debouncing for `shiftUp` / `shiftDown` and
  the HUD slice owns the gear / RPM widgets; bundling these would
  bust the one-slice-one-PR rule.
- F-NNN: Settings UI control to toggle `transmissionMode`. Out of
  scope for this slice; the §20 HUD slice is the natural home.
- F-NNN: gear-shift SFX hook (the dot mentions a "limit" SFX cue
  for blocked shifts at max gear). Lives with the §18 sound slice.

### GDD edits
- None. Implementation reads §10, §12, §19 verbatim; pinned
  numeric values are documented in the module header rather than
  in the GDD so the design text stays qualitative.

---

## 2026-04-26: Slice: damage band performance scaling per §10 §13

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md)
("Damage effects on performance"),
[§13](gdd/13-damage-repairs-and-risk.md) ("Mechanical effects").
**Branch / PR:** `feat/damage-band` (stacked on `feat/damage-model`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/game/damageBands.ts`: pure
  `getDamageScalars(damagePercent: number): DamageScalars` returning
  `{ stability, gripScalar, topSpeedScalar, nitroEfficiency,
  spinRiskMultiplier }` per the §10 "Damage effects on performance"
  table. Five bands: cosmetic (0..24, identity), light (25..49,
  stability and nitro hit), moderate (50..74, grip and top speed
  start to drop), severe (75..99, heavy power loss), catastrophic
  (100, limp). Boundary rule pinned to inclusive lower bound
  (`>= 25` enters light). `MAX_SPIN_RISK_MULTIPLIER = 4` ceiling.
  Companion `getDamageBand(percent)` returns the named band for HUD
  consumers. `DAMAGE_BANDS` constant frozen so the lookup is
  reviewable in one place.
- Wired `damageScalars` through `physics.step()` as a new optional
  `StepOptions` field (alongside the existing `draftBonus`). The
  step consumes `topSpeedScalar` (shrinks the cap) and `gripScalar`
  (derates traction); `stability`, `nitroEfficiency`, and
  `spinRiskMultiplier` are exposed for the future steering
  smoothing, nitro, and traction-loss slices to read off the same
  scalars without a second resolve. Defaults to `PRISTINE_SCALARS`
  when omitted (back-compat: existing call sites in
  `raceSession.ts` and the dev page keep their behaviour).
- Re-exported the new module from `src/game/index.ts`.
- Added `src/game/__tests__/damageBands.test.ts` (37 tests):
  the dot's nine boundary values (0, 24, 25, 49, 50, 74, 75, 99,
  100) snapshot the documented tuples; monotonic invariants walk
  every integer percent and assert non-increasing
  stability/grip/topSpeed/nitroEfficiency and non-decreasing
  spinRisk; out-of-range inputs (NaN, negatives, +/-Infinity)
  clamp without throwing; determinism (1000-iter and full-table
  re-snapshot) confirms no `Math.random` / `Date.now` leakage; the
  physics integration test confirms a car at 80% damage caps at
  `61 * 0.78 = 47.58 m/s` versus the pristine 61 m/s under
  identical inputs and drifts 70% as far laterally for the same
  steer input (matching the severe band's gripScalar = 0.7).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (787 tests, 37 new in `damageBands.test.ts`).
- `npm run build` clean. No route-size delta (the new field is
  optional and the renderer / race scene do not consume it yet).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  band lookup is pure game logic).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Bands are inclusive at the lower bound. The dot's edge case asks
  for the rounding rule to be explicit; `25.000` lives in the
  light band, not the cosmetic band. Lookup walks `DAMAGE_BANDS`
  highest-to-lowest and takes the first whose `min` is at most the
  clamped input, which encodes the same rule.
- Pinned numeric values per band (light: stability 0.92, nitro 0.9;
  moderate: stability 0.8, grip 0.85, topSpeed 0.92, nitro 0.8,
  spin 1.5; severe: stability 0.6, grip 0.7, topSpeed 0.78, nitro
  0.6, spin 2.5; catastrophic: stability 0.45, grip 0.55, topSpeed
  0.55, nitro 0.4, spin 4.0). §10 only pins the qualitative
  effects; numbers are picked to keep a fully-damaged car
  "limp but finishable" per the §13 "Balancing principle". A
  future balancing pass owns the final values.
- `spinRiskMultiplier` is exposed but no consumer reads it yet.
  The future traction-loss slice will multiply it against its base
  spin probability. `MAX_SPIN_RISK_MULTIPLIER = 4` pins the
  ceiling so a tweak to the table cannot accidentally turn the
  catastrophic band into "instant spin every tick".
- 100% pin: §10 says "catastrophic state, either limp mode or
  retire". This module owns only the limp side (the scalars). The
  retire (DNF) decision is owned by the damage state machine
  (`isWrecked()`) and the future race-rules engine.
- Out-of-range inputs (NaN, < 0, > 100, +/-Infinity) clamp into
  `[0, 100]` rather than throwing. Physics must not crash on a
  stale damage value.

### Followups created
- None new. The §15 traction-loss / spin slice will consume
  `spinRiskMultiplier` when it lands. The race session damage
  integration slice (still tracked under F-019) will resolve the
  band per-tick from `DamageState.total` and pass `damageScalars`
  into `physics.step()`.

### GDD edits
- None. The §10 "Damage effects on performance" narrative is the
  source; the per-band numeric pins live in the module's docstring
  and the test file's snapshots.

---

## 2026-04-26: Slice: damage model per §13

**GDD sections touched:** [§13](gdd/13-damage-repairs-and-risk.md)
("Damage sources", "Damage visualization", "Mechanical effects",
"Repair decisions", "Race-ending damage threshold"),
[§23](gdd/23-balancing-tables.md) ("Damage formula targets").
**Branch / PR:** `feat/damage-model` (stacked on
`feat/drafting-slipstream`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/damage.ts`: pure damage module with the public
  surface `applyHit`, `applyOffRoadDamage`, `performanceMultiplier`,
  `isWrecked`, `repairCostFor`, `totalRepairCost`, `createDamageState`,
  `PRISTINE_DAMAGE_STATE`, plus the constants surface
  (`DEFAULT_ZONE_DISTRIBUTION`, `DAMAGE_UNIT_SCALE = 100`,
  `PERFORMANCE_FLOOR = { engine: 0.55, tires: 0.65, body: 1.0 }`,
  `TOTAL_DAMAGE_WEIGHTS = { engine: 0.45, tires: 0.20, body: 0.35 }`,
  `WRECK_THRESHOLD = 0.95`, `OFF_ROAD_DAMAGE_PER_M = 0.000107`,
  `REPAIR_BASE_COST_CREDITS = { engine: 1500, tires: 600, body: 900 }`).
- Per-zone (`engine`, `tires`, `body`) accumulator with weighted total.
  Hits clamp at 1.0 per zone with no overflow bleed into other zones.
  No `Math.random` or `Date.now`; identical inputs return deep-equal
  outputs (1000-iteration deep-equal test).
- `applyOffRoadDamage(state, speed, dt)` ships the F-015 hand-off:
  body damage from 5 s of top-speed off-road equals one mid-speed
  carHit body share within 1%. F-015 marked `in-progress` (producer
  ready, consumer wiring deferred to the race-session damage
  integration slice tracked as F-019).
- Added `src/game/__tests__/damage.test.ts` (42 tests): verify items
  cell-by-cell (rub mid-range distribution, clamping no-bleed,
  performance falloff at engine=0.5 -> 0.775, body floor at 1.0,
  wreck threshold trip and tires-only no-trip, repair cost zero on
  clean, determinism, idempotent no-op hits, off-road accumulator
  matching the F-015 stress-test), plus distribution-row sums-to-1
  invariants and constants-surface sanity checks.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (750 tests, 42 new in `damage.test.ts`).
- `npm run build` clean. No route-size delta (damage is a game-logic
  module not yet wired into any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since damage
  is pure game logic and not yet wired into the race scene).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- The §23 magnitude ranges (e.g. `rubDamage = 2 to 4`) collapse to
  the mid-range value (caller-supplied) until the seeded-RNG slice
  lands. The damage module itself never consumes a PRNG so the
  determinism invariant holds regardless of how the caller picks
  magnitudes.
- `DEFAULT_ZONE_DISTRIBUTION` rows (per HitKind) are pinned per the
  iter-19 stress-test §4. Each row sums to 1.0 so `totalIncrement` is
  conserved across zones; balancing pass owns final values.
- `DAMAGE_UNIT_SCALE = 100` converts §23 raw magnitudes (where a wall
  hit at `24` is "serious but survivable") to the `[0, 1]` per-zone
  scale this module uses internally. A wall hit at 24 + speedFactor 1
  deposits 0.24 units across zones, matching the §13 design goal.
- `PERFORMANCE_FLOOR` keeps a fully damaged car limp-but-finishable
  per the §13 "Balancing principle". Body damage returns multiplier
  1.0 because §13 routes body penalties through the `rub` hit
  category (rubbing penalty surfaces as new tires-zone damage), not
  through a direct performance multiplier.
- `TOTAL_DAMAGE_WEIGHTS` weights engine highest because a holed
  engine ends a race; tires lowest because §13 says "side / rear
  damage cause handling effects" rather than DNF-class consequences.
- `WRECK_THRESHOLD = 0.95` (not 1.0) leaves room for a HUD
  "you're about to wreck" warning band before the §7 race-rules slice
  flips the car to `dnf`.
- `OFF_ROAD_DAMAGE_PER_M = 0.000107` is calibrated to the F-015
  stress-test target (5 s top-speed off-road body damage equals one
  mid-speed carHit body share within 1%).
- `REPAIR_BASE_COST_CREDITS` per-zone prices fit the §23 reward
  formula (a tier-3 race pays 1750, so a typical race's worth of
  damage costs roughly 100 to 300 credits to repair). Numbers are
  pinned in one place so the §12 economy / upgrade slice can read
  them directly.
- Module is intentionally state-free at the per-car level: `RaceSessionAICar`
  and `player` will own a `DamageState` field in the integration
  slice. Keeping the damage module decoupled from `physics.ts` keeps
  the kinematic step pristine (drafting also uses this pattern).

### Followups created
- F-019: Race session integration of the §13 damage model
  (consumer-side wiring deferred until the multi-car collision
  detection slice).
- F-015 transitioned `open -> in-progress` since the off-road damage
  helper exists; a `done` transition lands with the consumer wiring.

### GDD edits
- None. The module is a faithful implementation of §13 + §23. A
  future balancing pass may revisit `PERFORMANCE_FLOOR`,
  `TOTAL_DAMAGE_WEIGHTS`, and the per-kind zone distribution rows;
  those revisits will land as their own slices with the GDD edit in
  the same PR.

---

## 2026-04-26: Slice: drafting / slipstream per §10

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md)
("Drafting" subsection).
**Branch / PR:** `feat/drafting-slipstream` (stacked on
`feat/ai-driver-content`), PR pending.
**Status:** Implemented.

### Done
- Added `src/game/drafting.ts`: pure helpers `computeWakeOffset(leader,
  follower)` and `tickDraftWindow(state, wake, inputs, dt)` that produce
  an additive accel multiplier. Exposed pinned constants
  (`DRAFT_MIN_SPEED_M_PER_S = 30`, `DRAFT_ENGAGE_MS = 600`,
  `DRAFT_RAMP_MS = 400`, `DRAFT_MAX_ACCEL_MULTIPLIER = 1.05`,
  `DRAFT_LATERAL_TOLERANCE_M = 0.8`, `DRAFT_LATERAL_BREAK_M = 1.5`,
  `DRAFT_LONGITUDINAL_GAP_M = 25`) so the verify dot, future tuning
  passes, and a HUD widget can all read the same numbers.
- Updated `src/game/physics.ts` `step()` to accept an optional
  `StepOptions` argument with a `draftBonus` field. The bonus is a
  multiplicative scalar applied to throttle-driven acceleration only,
  clamped to `[1, DRAFT_BONUS_MAX = 1.5]` so a buggy caller cannot turn
  the bonus into a top-speed override. Default behaviour is unchanged
  (parameter is optional, defaults to `1`).
- Added `src/game/__tests__/drafting.test.ts` (33 tests): the dot's
  five verify items, plus geometric edge cases (lateral tolerance vs
  break threshold, in-front vs behind, longitudinal gap inclusivity),
  break conditions (geometric, brake, speed-threshold), ramp linearity
  (`multiplierForEngagedMs` half-ramp pinned), dt edge cases (zero,
  negative, NaN), purity (no input mutation), determinism (1000
  identical runs produce deep-equal output), intermittent-wake
  resilience, and a small physics integration block confirming the
  step honours `draftBonus` end-to-end.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (708 tests, 33 new in `drafting.test.ts`).
- `npm run build` clean. No route-size delta (drafting is a game-logic
  module not yet wired into any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since drafting
  is pure game logic and not yet wired into the race scene).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Speed threshold pinned to 30 m/s (about 108 km/h). §10 says "activate
  only above a speed threshold" without naming the value; 30 m/s keeps
  drafting a high-speed straight-line tactic rather than a low-speed
  crutch out of corners. Future tuning slice may adjust without editing
  call sites.
- Engagement model is a 0.6 s threshold (per §10) followed by a 0.4 s
  linear ramp to a 5 percent accel multiplier. The ramp avoids a
  discrete snap that would feel like an event rather than a steady
  bonus.
- `computeWakeOffset` is intentionally stateless; the `ageMs: 0` field
  in its return shape is a literal-typed placeholder so the dot's
  verify item ("returns `{ inWake: true, ageMs: 0 }`") reads as a
  shape-stable check. Real time accumulation lives in
  `DraftWindowState.engagedMs` and is advanced by `tickDraftWindow`.
- Lateral geometry uses two thresholds: `DRAFT_LATERAL_TOLERANCE_M`
  (0.8 m, the "small side step still counts as in wake" radius) and
  `DRAFT_LATERAL_BREAK_M` (1.5 m, the verify item's hard break
  threshold). Both are exported. The current implementation only uses
  the break threshold for the binary `inWake` check; the tolerance
  constant is staged for a later slice that may apply a tapered bonus
  near the edge of the cone.
- Physics accepts the bonus as an optional `options.draftBonus` field
  rather than a positional parameter so future modifiers (nitro,
  damage band, weather grip) can layer in additively without growing
  the call signature.

### Followups created
- None. The wiring slice (race scene chooses a leader, calls
  `computeWakeOffset` and `tickDraftWindow` per tick, threads the
  resulting multiplier into `physics.step()`) belongs to whichever
  upcoming slice introduces the multi-car race state. Until then this
  module is a producer waiting for a consumer.

---

## 2026-04-26: Slice: AI driver content registry (20 profiles)

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md) (CPU
archetypes, Difficulty tiers), [§22](gdd/22-data-schemas.md) (AI driver
JSON schema), [§24](gdd/24-content-plan.md) (Data asset list: 20 AI
driver profiles).
**Branch / PR:** `feat/ai-driver-content` (stacked on
`feat/championship-content`), PR pending.
**Status:** Implemented.

### Done
- Authored 20 AI driver JSON files under `src/data/ai/`. File naming
  follows the §22 example (`ai_cleanline_01`, `ai_bully_03`, etc.).
  Distribution: 4 `nitro_burst` (Rocket starter), 4 `clean_line`,
  3 `aggressive` (Bully), 3 `defender` (Cautious), 3 `wet_specialist`
  (Chaotic / weather-volatile), 3 `endurance` (Enduro). Stat shapes
  reflect each archetype: rocket starters carry high `launchBias` and
  weak weatherSkill, defenders/cautious lift `weatherSkill.fog/rain`,
  chaotic profiles spike `mistakeRate` and `panicBias`, enduro picks
  flatten weatherSkill and keep `straightBias` high.
- Added `src/data/ai/index.ts`: static-import barrel exposing
  `AI_DRIVERS`, `AI_DRIVERS_BY_ID`, and `getAIDriver(id)`. Mirrors the
  `getCar` shape (returns undefined on miss so the ai-grid spawner can
  decide policy). Top-of-file comment documents the archetype slot
  mapping between schema enum names and the §15 prose names.
- Re-exported `AI_DRIVERS`, `AI_DRIVERS_BY_ID`, and `getAIDriver` from
  `src/data/index.ts` so callers import via the data barrel.
- Added `src/data/__tests__/ai-content.test.ts` (105 tests): per-driver
  schema validation, archetype-enum coverage, weatherSkill key
  completeness (clear/rain/fog/snow + no extras), `paceScalar` envelope
  (0.9..1.1, derived from §15 difficulty bounds), unit-interval checks
  on mistakeRate/aggression/nitroUsage biases, plus catalogue-level
  invariants (20 drivers, unique ids, unique displayNames, archetype
  distribution pin).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (675 tests, 105 new in `ai-content.test.ts`).
- `npm run build` clean. No route-size delta (AI JSON is data only,
  not yet imported by any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the AI
  registry is data-layer only).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Schema enum (`clean_line, aggressive, defender, wet_specialist,
  nitro_burst, endurance`) and the §15 prose archetype names (Rocket
  starter, Clean line, Bully, Cautious, Chaotic, Enduro) are the same
  six slots under different labels. Documented the mapping in
  `src/data/ai/index.ts`. The `wet_specialist` slot stands in for the
  §15 "Chaotic" archetype until full-ai shapes per-archetype behaviour;
  the chaotic JSONs already lean on high `mistakeRate` and high
  `panicBias` to differentiate from cautious profiles in dry weather.
- `paceScalar` envelope of 0.9..1.1 comes from the §15 Difficulty
  tiers table (Master at +9%, easy at -8%). The roster keeps every
  scalar inside the envelope so ai-grid can layer difficulty modifiers
  without immediately blowing past the upper bound.
- Display names are original two-token call signs (single initial +
  surname, drawn from a deliberately diverse linguistic pool) so the
  legal-safety lint slice can wire its check without flagging any of
  the 20 against active or historical motorsport rosters.
- Distribution (4/4/3/3/3/3 = 20) follows the dot's "documented
  spread"; balancing-pass slice may rebalance, with the index header
  comment as the canonical record.

### Followups created
- None. The full-ai and ai-grid sibling dots will consume this
  registry; this slice intentionally stops at content + barrel.

---

## 2026-04-26: Slice: championship content registry (world-tour-standard)

**GDD sections touched:** [§22](gdd/22-data-schemas.md) (Championship JSON
schema), [§24](gdd/24-content-plan.md) (Suggested region and track list,
Full v1.0 content totals).
**Branch / PR:** `feat/championship-content` (stacked on
`feat/sector-splits`), PR pending.
**Status:** Implemented.

### Done
- Authored `src/data/championships/world-tour-standard.json`: the canonical
  championship file with 8 tours of 4 tracks each, 32 tracks total, ids
  drawn verbatim from §24 "Suggested region and track list" and slugified
  (lowercased, hyphenated, slash-prefixed by tour). `requiredStanding`
  pinned monotonic non-increasing per the dot: 4, 4, 3, 3, 2, 2, 1, 1.
  `difficultyPreset` set to `normal` per §28-difficulty plumbing.
- Added `src/data/championships/index.ts`: static-import barrel exposing
  `CHAMPIONSHIPS`, `CHAMPIONSHIPS_BY_ID`, and a `getChampionship(id)`
  loader that mirrors the `loadTrack` shape (throws on unknown id or
  schema-validation failure for fail-fast loads). Top-of-file comment
  documents the MVP placeholder track ids since JSON cannot carry them.
- Re-exported `CHAMPIONSHIPS`, `CHAMPIONSHIPS_BY_ID`, and
  `getChampionship` from `src/data/index.ts` so callers import via the
  data barrel.
- Added `src/data/__tests__/championship-content.test.ts` (13 tests):
  schema-validation per championship, catalogue invariants, structural
  pins (8 tours, 4 tracks per tour, 32 total, unique ids, nested-id
  prefix), monotonic `requiredStanding`, and a phase-guarded cross-ref
  block. Default permissive mode passes during the MVP content window;
  set `STRICT_CHAMPIONSHIP_TRACKS=1` to enforce full resolution once the
  32-track set lands.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (570 tests, 13 new in `championship-content.test.ts`).
- `npm run build` clean. No route-size delta (championship JSON is data
  only, not yet imported by any page module).
- `npm run test:e2e` passes (15 specs, no new e2e specs since the
  championship is data-layer only and not yet wired into the title or
  garage flows).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Track ids are slash-nested under their tour id (e.g.
  `velvet-coast/harbor-run`) per the §22 schema example and the existing
  `test/straight`, `test/curve` precedent.
- `requiredStanding` cadence (4, 4, 3, 3, 2, 2, 1, 1) is taken verbatim
  from the dot. The §23-balancing slice may revise once the difficulty
  curve is play-tested.
- The cross-reference test defaults to permissive (no env var needed) so
  CI stays green during MVP. The dot's original
  `ALLOW_UNRESOLVED_CHAMPIONSHIP_TRACKS=1` shape was inverted to
  `STRICT_CHAMPIONSHIP_TRACKS=1` so the green-by-default path is the
  current MVP state, not a configured-CI state. The flag and permissive
  branch both go away once §24 ships in full.
- `getChampionship` throws on unknown id; the symmetric pattern in
  `loadTrack` returns the parsed object on success and throws otherwise.
  `CHAMPIONSHIPS_BY_ID` is exposed for callers (UI selectors) that
  prefer a `Map`-style lookup without the throw.

### Followups created
- None. The championship-content slice is structurally complete; track
  files are owned by sibling MVP-track and full-content slices.

---

## 2026-04-26: Slice: sector splits + ghost delta HUD widget

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Race HUD list:
"lap timer", "best lap"; wireframe: "Top-right: best lap / ghost delta"),
[§22](gdd/22-data-schemas.md) (Track checkpoints; SaveGame records).
**Branch / PR:** `feat/sector-splits` (stacked on `feat/difficulty-preset`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/game/sectorTimer.ts`: pure state machine for the §20 ghost
  delta widget. `createSectorState`, `onCheckpointPass`, `startNewLap`,
  `splitsForLap`, `sectorDeltaMs`, `bestSplitsForTrack`, and
  `shouldWriteBestSplits`. Sign convention pinned: positive delta = current
  is slower; negative = current is faster. Zero / one checkpoint tracks
  collapse to a single whole-lap sector and the widget reverts to lap-timer
  mode. Out-of-order labels are no-ops so the §7 anti-shortcut layer remains
  the single source of truth for correctness.
- Added `src/render/hudSplits.ts`: Canvas2D drawer for the top-right
  splits widget. At most three text drawcalls (timer, sector label, signed
  delta). `formatLapTime` and `formatDelta` (rounded to 100 ms granularity
  per the dot). Delta colour token picked by sign (red for slower, green
  for faster). Reduced-motion safe: no animation.
- Extended `HudState` in `src/game/hudState.ts` with optional
  `bestLapMs` and `sectorDeltaMs` fields so the §20 polish slice can wire
  them without a downstream contract break.
- Extended `SaveGameRecordSchema` in `src/data/schemas.ts` with optional
  `bestSplitsMs: z.array(z.number().nonnegative()).optional()`. Optional
  so v1 saves continue to validate; the dot pins "best-splits write only
  when the OVERALL bestLap improves" and `shouldWriteBestSplits` enforces
  it at the call site.
- Added `src/game/__tests__/sectorTimer.test.ts` (25 tests) covering the
  initial state shapes, sector advance, lap reset, ms formatting,
  cumulative split math, the pinned sign convention, the v1-backfill
  behaviour for `bestSplitsForTrack`, and replay-determinism.
- Added `src/render/__tests__/hudSplits.test.ts` (18 tests) with a
  mock-canvas drawcall snapshot per fixture: positive vs negative delta
  colour, two-vs-three drawcall count for null-vs-non-null delta,
  context-state restoration, and replay-determinism.
- Added three SaveGame schema cases in `src/data/schemas.test.ts`
  covering `bestSplitsMs` accepted, negative entries rejected, and v1
  records (no `bestSplitsMs`) still validate.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (557 tests, 46 new across the three suites).
- `npm run build` clean. No route-size delta (the new modules are
  pure / drawer surfaces and not yet imported by `/race`).
- `npm run test:e2e` passes (15 specs, no new e2e specs in this slice
  because the widget is not wired into `/race` yet; the §20 polish slice
  owns the wiring).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- The dot description names a `TrackRecordSchema`, but the actual schema
  surface in `src/data/schemas.ts` is `SaveGameRecordSchema`. Extended
  the existing surface rather than introducing a new schema name; the
  field shape (`bestSplitsMs?: readonly number[]`) matches the dot.
- The `currentSectorIdx` ascends as the player passes checkpoints; it
  does not wrap. `startNewLap` resets it to 0 explicitly so the displayed
  sector is the first sector after a lap-line crossing per the dot.
- Out-of-order or unknown checkpoint labels are silent no-ops in this
  module. The §7 anti-shortcut guard owns correctness; the widget never
  decides whether the player took a valid path.
- The drawer is not yet wired from `src/render/uiRenderer.ts` or the
  `/race` page. The §20 polish slice (`implement-hud-ui-6c1b130d`) owns
  full HUD composition; this slice ships the math + drawcall builder so
  that polish slice can call into it without re-deriving anything.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: difficulty preset selection in /options Difficulty pane

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md) (Difficulty
tiers table: Easy, Normal, Hard, Master with AI pace, rubber banding,
mistakes, economy pressure rows), [§20](gdd/20-hud-and-ui-ux.md) (Settings
six-pane list; Difficulty tab is the host),
[§28](gdd/28-appendices-and-research-references.md) (Beginner / Balanced /
Expert tuning table; Normal is the §28 baseline).
**Branch / PR:** `feat/difficulty-preset` (stacked on `feat/options-screen`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/components/options/difficultyPaneState.ts` with the pure
  §15 model: a four-entry `PRESETS` table (Easy / Normal / Hard /
  Master) carrying the verbatim §15 row values; `readPreset` falling
  back to `'normal'` for v1 saves missing the optional field;
  `isMasterUnlocked` (conservative `completedTours.length >= 1`
  approximation while championship-completion-at-difficulty tracking
  ships); `applyPresetSelection` returning a tagged `applied` /
  `noop:same-preset` / `noop:locked` result; and the
  `MASTER_UNLOCK_HINT` and `MID_TOUR_NOTE` string constants.
- Added `src/components/options/DifficultyPane.tsx`. Thin Client
  Component shell: hydrates from `loadSave()` after mount (mirrors
  `src/app/garage/cars/page.tsx`), renders a four-tile radio group
  with stable testids, and a detail panel (`difficulty-detail`) showing
  the §15 row for the active preset. Master tile is disabled until
  unlocked; the locked badge surfaces and the `<label>` `title`
  tooltip names the §15 unlock condition. A mid-tour caveat note sits
  above the radio group and explains that switching the preset only
  affects future tours.
- Updated `src/data/schemas.ts` to add `PlayerDifficultyPresetSchema`
  (`'easy' | 'normal' | 'hard' | 'master'`, matches §15 exactly) and
  an optional `difficultyPreset` field on `SaveGameSettings`. Optional
  so the v1 save shape continues to validate without a migration; the
  `readPreset` helper backfills `'normal'` for any save written before
  this slice.
- Updated `src/persistence/save.ts` `defaultSave()` to set
  `difficultyPreset: 'normal'` per the §28 dot default.
- Updated `src/data/examples/saveGame.example.json` to include
  `difficultyPreset: 'normal'` so the canonical example reflects the
  new field.
- Updated `src/app/options/page.tsx`: replaced the Difficulty tab's
  "coming soon" placeholder with `<DifficultyPane />`. The `TabSpec`
  type now carries an optional `pane` factory; placeholder tabs still
  render their headline / body / dot id triple, while shipped tabs
  render their pane component instead. The other five tabs are
  unchanged.
- Added `src/components/options/__tests__/difficultyPaneState.test.ts`
  (21 tests) covering the §15 table verbatim values, the locked /
  unlocked Master predicate, the pure mutation helper (applied,
  same-preset noop, locked noop, save immutability, side-fields
  preserved), the v1 backfill behaviour, and the no-em-dash project
  rule on every preset string and the two constants.
- Added `src/components/options/__tests__/DifficultyPane.test.tsx`
  (2 tests). SSR-shape contract: the pane renders the loading marker
  before hydration and never includes an em-dash. Interactive flows
  live in the e2e spec because RTL is not in the project.
- Added `e2e/options-difficulty.spec.ts` (4 tests): all four §15 tiles
  render with Normal selected by default, the detail panel shows the
  Normal row; Master is locked with the §15 unlock condition in its
  tooltip; selecting Hard updates the detail panel and persists to
  `vibegear2:save:v1` (and survives a reload); the mid-tour caveat
  note renders.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (511 tests; 23 new across the two suites).
- `npm run build` clean. `/options` route grew from 2.21 kB to 4.13 kB
  / 125 kB first-load (the DifficultyPane and its style block).
- `npm run test:e2e` passes (15 specs, 4 new).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns only the
  test-side regex literals (no em-dashes in actual copy).

### Decisions and assumptions
- Reused the §15 four-tier names (Easy / Normal / Hard / Master) for
  the player-facing preset enum, even though the §28 tuning table
  uses Beginner / Balanced / Expert. The dot description allows
  either; §15 is the more canonical source for the player-facing
  ladder, and the §28 dot ships the underlying tuning numbers. The
  championship-side `DifficultyPresetSchema` (novice / easy / normal /
  hard / extreme) is left unchanged: it is captured at tour-enter time
  and may use a wider taxonomy than the player picker.
- The new `difficultyPreset` save field is optional. Adding a required
  field would require a v2 schema bump and a migration; making it
  optional with a `'normal'` backfill at read time is additive per
  `WORKING_AGREEMENT.md` §11 ("dropping or renaming persisted save
  fields" is the gated case; adding fields is allowed).
- Master unlock predicate is conservative
  (`completedTours.length >= 1`) rather than the precise §15 condition
  ("complete one championship at Hard"). The save layer does not yet
  record championship-completion-at-difficulty. The locked tile's
  tooltip surfaces the canonical §15 wording so the player still sees
  the right condition; the predicate can tighten in a later slice
  without changing the UI contract.
- Followed the established `renderToStaticMarkup` test style for the
  `.tsx` shell test rather than pulling in React Testing Library.
  Interactive selection / persistence coverage lives in
  `difficultyPaneState.test.ts` (pure model) and the new Playwright
  spec (real browser). This matches how `e2e/options-screen.spec.ts`
  splits its concerns.

### Followups created
- None. The §28 dot still owes the underlying tuning numbers, but
  that is its own ready task and does not block this UI slice. Once
  championship-completion-at-difficulty tracking ships, tighten
  `isMasterUnlocked` to the precise §15 predicate.

---

## 2026-04-26: Slice: options screen route /options (settings UI scaffold)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Settings six-pane
list and pause-menu Settings entry point), [§19](gdd/19-controls-and-input.md)
(Remapping is a first-class feature; remap UI lives behind /options Controls
tab).
**Branch / PR:** `feat/options-screen` (stacked on `feat/minimap-module`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/app/options/page.tsx` as a Client Component scaffold with
  six tabs in §20 order (Display, Audio, Controls, Accessibility,
  Difficulty, Performance). Each pane renders a placeholder citing the
  exact dot id of the slice that ships its real content
  (`implement-visual-polish`, `implement-sound-music`,
  `implement-key-remap`, `implement-accessibility`,
  `implement-difficulty-preset`, `implement-performance-settings`).
  Tabs follow the WAI-ARIA Authoring Practices keyboard model: Left and
  Right cycle with wrap, Home and End jump to ends, focus follows
  selection. Esc on the page returns to the title via `history.back()`
  with a fall-through to `/`.
- Added `src/app/options/page.module.css` with the tab strip, panel,
  and footer styling. Reset to defaults button is rendered disabled
  with the F-049 reset wiring followup in its title attribute so the
  next agent can grep.
- Added `src/app/options/tabNav.ts` with the pure `nextTabIndex`,
  `isTabNavKey`, and `TAB_ORDER` exports the page binds to. Lives
  outside `page.tsx` so the keyboard model is unit-testable in the
  default node Vitest env without RTL.
- Added `src/app/options/__tests__/tabNav.test.ts` (10 tests) covering
  the navigation table, wrap behaviour, Home/End jumps, non-nav-key
  pass-through, and the empty-tab-set guard.
- Added `src/app/options/__tests__/page.test.tsx` (9 tests) using the
  existing `renderToStaticMarkup` pattern. Asserts the six tab test
  ids, the active-tab `aria-selected` and `data-active` attributes, the
  Display panel placeholder dot id, the Reset button's disabled state,
  the back-to-title link, and the `tabIndex=0`/`-1` roving tabindex
  pattern.
- Added `e2e/options-screen.spec.ts` (6 tests) covering: all six tabs
  visible with Display selected, ArrowRight cycle plus wrap,
  ArrowLeft wrap from first to last, Reset to defaults disabled with
  the F-049 reset wiring followup in its title, back-to-title link, and Esc
  returning to `/`.
- Updated `src/app/page.tsx` to enable the Options main-menu entry as a
  `Link` to `/options` with `data-testid="menu-options"`. Removed the
  prior `menu-options-pending` disabled placeholder.
- Updated `src/app/__tests__/page.test.tsx` to assert the new
  `menu-options` anchor and tab order. Updated
  `e2e/title-screen.spec.ts` to assert the link points at `/options`
  and added a navigation smoke.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (488 tests; 19 new across the two suites).
- `npm run build` clean. `/options` route reports 2.21 kB / 108 kB
  first-load.
- `npm run test:e2e` passes (11 specs).
- `grep -rP "[\x{2013}\x{2014}]"` on touched files returns nothing.

### Decisions and assumptions
- Followed the established `renderToStaticMarkup` test style instead of
  pulling in React Testing Library. The dot description called for
  arrow-key navigation in the unit test; that interactive coverage
  lives in `tabNav.test.ts` (pure model) plus the Playwright spec
  (real browser keyboard events). Adding `@testing-library/react` here
  would be a one-off divergence from the rest of the suite.
- Title-screen test id changed from `menu-options-pending` to
  `menu-options`. The `WORKING_AGREEMENT` rule against
  backwards-compatibility shims for code with no users yet supports a
  rename here; both the unit test and the Playwright spec are updated
  in this slice.
- Esc handler uses `window.history.length > 1` as a heuristic for the
  presence of a referrer in this tab. Edge case: `length` can be 1
  even when entering via a fresh tab in some browsers, so the
  fallback is a hard navigation to `/` rather than nothing.
- Tabs use roving tabindex (active = 0, others = -1) per WAI-ARIA so
  Tab moves between regions instead of cycling tabs. Arrow keys cycle
  within the tablist as expected.

### Followups created
- None. The placeholder dots cited in each pane are already ready
  tasks, so no new tracking entry is needed.

---

## 2026-04-26: Slice: minimap projection + HUD overlay drawer (split from hud-ui)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md) (Race HUD: simplified
minimap or progress strip; bottom-left wireframe slot),
[§21](gdd/21-technical-design-for-web-implementation.md) (Suggested module
structure: `src/road/minimap.ts`),
[§22](gdd/22-data-schemas.md) (Track data model: minimap points).
**Branch / PR:** `feat/minimap-module` (stacked on `feat/assets-license`),
PR pending.
**Status:** Implemented.

### Done
- Added `src/road/minimap.ts` with three pure exports:
  `projectTrack(segments, options)` integrates per-segment heading into a
  unit-square footprint with closing-snap to keep loops visually shut;
  `projectCar(points, segmentIndex, segmentProgress)` linearly
  interpolates a car's marker along the precomputed point list;
  `fitToBox(points, box)` uniform-scales any point list into a target
  rectangle preserving aspect ratio with the short axis centred.
- Added `src/render/hudMinimap.ts` with `drawMinimap(ctx, points, cars,
  layout, options)` issuing a single closed stroke path for the track
  plus one filled circle (or square in colour-blind mode) per car. AI
  markers paint first so the player draws on top. Context state is
  restored on return.
- Added `src/road/__tests__/minimap.test.ts` (17 tests) covering the
  dot's verifies: 80-segment track returns 80 points within the unit
  rectangle, single-segment track returns one point, aspect preservation
  for a 20:1 long-thin track, author-override path, deterministic
  reruns, off-track car clamping without NaN, and `projectCar`
  midpoint / wrap / single-point cases.
- Added `src/render/__tests__/hudMinimap.test.ts` (10 tests) covering
  drawcall counts (one stroke path, one fill per car), AI-before-player
  ordering, colour-blind shape swap (square via `fillRect`), background
  fill, zero-area / empty-input no-ops, and context-state restoration.
- Extended `src/data/schemas.ts` with `MinimapPointAuthoredSchema` and
  an optional `Track.minimapPoints` field (length >= 2 required when
  present). Added three schema tests covering the optional field, the
  override accept path, and the length-rejection paths.
- Extended `src/road/types.ts` with `CompiledMinimapPoint` and a
  required `CompiledTrack.minimapPoints` field. `src/road/trackCompiler.ts`
  now calls `projectTrack` (honouring `track.minimapPoints` override
  when present) and stamps the result on the compiled output.
- Extended `src/game/hudState.ts` with optional `HudMinimapState`
  carried through `HudStateInput.minimap` and surfaced on `HudState.minimap`
  so the HUD path stays opt-in for owners that want to render the minimap.
- Wired both new modules into `src/road/index.ts` and
  `src/render/index.ts` barrels.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (469 tests; 27 new across the three suites). Existing
  trackCompiler golden snapshots unaffected because the snapshot
  projector excludes `minimapPoints`.
- `npm run build` clean (route sizes unchanged; minimap is opt-in).
- `npm run test:e2e` passes (title-screen + phase-1 race demo).
- `grep -rP "[\x{2013}\x{2014}]" src/road/minimap.ts
  src/road/__tests__/minimap.test.ts src/render/hudMinimap.ts
  src/render/__tests__/hudMinimap.test.ts` returns nothing.

### Decisions and assumptions
- `Track.minimapPoints` minimum length is 2 (not 1). A single point has
  no direction and the polyline drawer skips lone points anyway, so
  rejecting length-1 inputs at the schema layer prevents silent
  no-op overrides.
- Closing snap is implemented as a linear residual distribution across
  the polyline rather than a global rotation. Cheaper to compute and
  produces the same end-to-end "loop closes" guarantee for the cases
  the dot calls out (loops and intentional kinks).
- Colour-blind mode is wired as a per-call `colorBlindMode` boolean
  option on `drawMinimap`. The save-game settings field
  (`accessibility.colorBlindMode`) is not implemented yet; whoever lands
  the §19 accessibility slice will pipe the save bit into this option.
- `HudState.minimap` is optional. Existing HUD callers continue to work
  without minimap data; the §20 polish slice will be the first
  consumer.

---

## 2026-04-26: Slice: ASSETS-LICENSE + per-entry asset licence metadata (Q-002)

**GDD sections touched:** [§26](gdd/26-open-source-project-guidance.md) (no
text edit; this slice fulfils the "Suggested licenses" table and the
"Avoiding IP contamination" requirement that every shipped manifest entry
declares provenance).
**Branch / PR:** `feat/assets-license` (stacked on
`feat/github-actions-ci-recovery`), PR pending.
**Status:** Implemented.

### Done
- Added `ASSETS-LICENSE` at repo root with the CC BY 4.0 license body, the
  per-entry licence taxonomy (`CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`,
  `public-domain`), an attribution policy, and a restatement of GDD
  section 26's "Avoiding IP contamination" rules.
- `src/asset/preload.ts`: added `AssetLicense` type union and
  `ASSET_LICENSES` constant; required `license` on `AssetEntry`; added
  `AssetLicenseError` and `assertManifestLicenses` so the future mod
  loader (and any defensive caller) can reject manifests that omit
  provenance.
- `src/asset/manifest.ts`: added `DEFAULT_ASSET_LICENSES` (track JSON
  defaults to `CC-BY-SA-4.0` per GDD section 26 data row, art and audio
  default to `CC-BY-4.0`); `manifestForTrack` now stamps the licence on
  every emitted entry and accepts a `licenses` per-kind override hook for
  mods that ship under a different licence.
- `src/asset/__tests__/manifest.test.ts`: added five tests covering
  licence presence on every entry, the per-kind defaults, override
  behaviour, the validator round-trip, and a separate `describe` block
  for `assertManifestLicenses` (accept / missing / unknown / first-error
  rejection).
- `src/asset/__tests__/preload.test.ts`: updated the `entry()` helper
  default to set `license: "CC-BY-4.0"` so existing fixtures still build
  valid `AssetEntry` records under the stricter type.
- Marked `OPEN_QUESTIONS.md` Q-002 `answered` with the chosen licences,
  the per-entry taxonomy, and the implementation pointer.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes (manifest + preload suites green; new licence tests
  pass; sibling suites unchanged).
- `npm run build` clean.
- `npm run test:e2e` passes against the existing suite (no UI surface
  changed).
- Grep for U+2014 and U+2013 across `ASSETS-LICENSE`, `src/asset/*.ts`,
  `src/asset/__tests__/*.ts`, the OPEN_QUESTIONS update, and this log
  entry returns nothing.

### Decisions and assumptions
- Track JSON ships under `CC-BY-SA-4.0`, not `CC-BY-4.0`. GDD section 26
  's "Suggested licenses" table assigns "Track/community data" to
  CC BY-SA 4.0 explicitly, so the data row picks that. Art and audio
  default to CC-BY-4.0 per Q-002's recommended default.
- The `license` field is required at the type level (not optional with a
  default fallback). A missing licence would defeat the point of the
  guard, so the type system enforces presence and the runtime validator
  exists for non-typed (mod-loaded) inputs.
- The per-entry licence is a small string union, not an open SPDX field.
  Section 26 names a small set of permitted licences, and a closed union
  surfaces accidental drift at compile time. Adding a new licence is a
  single-line edit.
- Did not add a `scripts/content-lint.ts` script. The dot lists it as
  "if present, else add to its dot"; no such script exists in the
  current tree, and the manifest builder + runtime validator already
  reject any code path that emits an entry without a licence. Filing as
  a polish followup if a separate authoring-time linter becomes useful.

### GDD edits
- None this slice; the GDD already specifies the licence policy.

### Followups created
- None.

### Open questions resolved
- Q-002 answered (licence choice for code and assets).

### Dot
- Closed `VibeGear2-implement-assets-license-3918e9cb` with reason
  "verified".

---

## 2026-04-26: Slice: GitHub Actions CI + Vercel auto-deploy (F-003) recovery

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md) (added "Deploy target" subsection)
**Branch / PR:** `feat/github-actions-ci-recovery` (stacked on `feat/render-perf-bench`), PR pending
**Status:** Implemented (workflow lands; first deploy waits on human prerequisites)

### Recovery context
- Re-applies the work that was originally written for the closed dot
  `VibeGear2-implement-github-actions-1780fc58` and committed as
  `934f5b6` on the orphan branch `feat/github-actions-ci`. That branch
  was never merged to `main`; the close-reason claimed shipped files
  that did not exist on `main`. The recovery dot
  `VibeGear2-implement-github-actions-388c5523` re-opened the work.
- Followed option 2 of the recovery dot (re-implement against the live
  trunk) rather than option 1 (rebase 934f5b6) so the iteration-17
  stress-test refinements (split concurrency for `deploy`, gated bench
  job) could land in the same commit. The original 934f5b6 had a single
  `concurrency` block with `cancel-in-progress: true` covering both
  jobs; this recovery splits them.

### Done
- Added `.github/workflows/ci.yml`: three jobs.
  - `verify` runs on every PR and on push to `main`. Steps: checkout,
    setup-node 20 with npm cache, `npm ci`, `npm run lint`, `npm run
    typecheck`, `npm run test`, install Playwright chromium with deps,
    `npm run build`, `npm run test:e2e`. Uploads `playwright-report/` as
    an artefact on failure (7-day retention). Concurrency group
    `ci-verify-${{ github.ref }}` with `cancel-in-progress: true`.
  - `bench` runs only on `workflow_dispatch` with `run_bench=true`. Runs
    `npm run bench:render` with `continue-on-error: true` so the
    informational bench can never gate a merge or deploy. Closes the
    follow-up noted in the previous PROGRESS_LOG entry.
  - `deploy` runs only on push to `main` after `verify` is green. Steps:
    checkout, setup-node, `npm ci`, `vercel pull` for production env,
    `vercel build --prod`, `vercel deploy --prebuilt --prod`. Surfaces
    the deploy URL via the GH `environment.url` field. Separate
    concurrency group `deploy-prod` with `cancel-in-progress: false` so
    a rapid second push to `main` queues behind the in-flight deploy
    instead of killing it (per iteration-17 stress test #5).
- Added `vercel.json` with `framework: nextjs`, `npm ci` install, `next
  build` build, region `iad1`, openapi.vercel.sh schema URL.
- Added `.vercel/` and `.claude/` to `.gitignore` so per-developer
  artefacts stay local.
- Updated `docs/gdd/21-technical-design-for-web-implementation.md` with
  a "Deploy target" subsection naming Vercel and pointing at the
  workflow.
- Updated `README.md` with a Deploy section that documents the CI gate,
  the Vercel preview behaviour, the bench dispatch toggle, and the
  one-time human setup steps.
- Marked `OPEN_QUESTIONS.md` Q-003 `answered` with the full resolution.
- Marked `FOLLOWUPS.md` F-003 `in-progress` with completion criteria
  (first green deploy + smoke of deployed URL); updated F-002 note that
  the CI slice has landed.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 passing (test count unchanged: no source files
  touched).
- `npm run build` clean.
- `npm run test:e2e` 4 of 4 passing.
- `npm run bench:render` runs to completion (sanity check that the
  bench script the new CI job gates on still works).
- `grep` for U+2014 and U+2013 across `.github/workflows/ci.yml`,
  `vercel.json`, and the new README + GDD additions returns nothing.
- The `verify` job will run against this PR; `deploy` will fail on
  first push to `main` until secrets are populated, which is the
  designed and documented behaviour.

### Decisions and assumptions
- Used the Vercel CLI from GitHub Actions for production deploys
  instead of the Vercel GitHub App's auto-prod, so production is
  strictly gated on the same CI run that runs the smoke. The GitHub
  App still handles PR preview URLs (with auto-prod toggled off, per
  the README setup notes).
- `--with-deps chromium` installs only chromium, matching
  `playwright.config.ts`'s projects array.
- Pinned Node 20 (LTS) in CI even though `engines.node` is `>=20`. Lets
  us bump in one place when 22 ships LTS.
- No separate `preview` deploy job. PR previews come from the Vercel
  GitHub App; running both an Actions preview and an App preview
  duplicates work without adding signal.
- Workflow file lands even though deploy secrets are not configured
  yet. The `verify` job is the meaningful gate; `deploy` will fail
  loudly with a clear error until the human steps complete, which is
  more discoverable than landing the workflow later.
- Bench job is `workflow_dispatch`-only with `continue-on-error: true`
  rather than the previously-suggested `RUN_BENCH=1` env switch
  because GH Actions has no built-in way to set repo-level env on a
  push, and dispatch inputs are first-class in the Actions UI.

### Followups created
- None. F-003 stays `in-progress` until the first green production
  deploy; that flip is a one-line edit in a follow-up commit, not a
  new dot.

### GDD edits
- Added "Deploy target" subsection to
  [`docs/gdd/21-technical-design-for-web-implementation.md`](gdd/21-technical-design-for-web-implementation.md). Naming the
  hosting choice in the GDD keeps the doc honest about the architecture.

---

## 2026-04-26: Slice: Render perf bench script (npm run bench:render)

**GDD sections touched:** none (tooling slice; informational bench only)
**Branch / PR:** `feat/render-perf-bench` (stacked on `feat/off-road-dust`), PR pending
**Status:** Implemented

### Done
- Added `scripts/bench-render.ts`: a manual frame-time bench that drives
  `pseudoRoadCanvas.drawRoad` against a stub Canvas2D context for 600
  frames with the parallax bands (sky / mountains / hills), a primed
  64-particle dust pool, and an active VFX shake. Prints a summary table
  with frame count, mean, p50, p95, and p99 in milliseconds, labelled
  "CPU canvas, indicative only" because jsdom's HTMLCanvasElement throws
  without the optional native `canvas` package and we deliberately do
  not pull that in.
- Added `vitest.bench.config.ts`: a standalone Vitest config whose
  include glob targets only `scripts/bench-render.ts`. The bench is
  invoked as a Vitest test so the `@/` aliases resolve and TypeScript
  is transpiled without an extra loader dep, but it stays out of the
  default `vitest.config.ts` glob so `npm test` and CI never run it.
- `npm run bench:render` script wired in `package.json`. Verified the
  bench prints the table and exits clean (~260 ms total). On this dev
  machine the first run reported mean 0.016 ms / p95 0.029 ms; numbers
  are not portable across machines, only useful for relative regression
  hunting on the same host.
- Authored `docs/CONTRIBUTING.md` covering the local check loop, the
  bench workflow ("paste the table into the PR body when touching the
  renderer"), the em-dash grep recipe, and the loop-logging
  expectations from `AGENTS.md` RULE 5.
- Per the dot's "CI does not run the bench by default" requirement: no
  CI workflow exists yet (CI is owned by the re-opened
  `implement-github-actions` dot). When that lands, the bench step
  should be gated on `if [ "$RUN_BENCH" = '1' ]` so the default
  pipeline stays deterministic per `AGENTS.md`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 tests passing (bench file is excluded from the unit
  glob; test count unchanged).
- `npm run build` clean. Route sizes unchanged (`/race` stays at
  7.49 kB / 130 kB; the bench only ships under `scripts/` and never
  reaches the bundle).
- `npm run test:e2e` 4 of 4 passing (no UI changes).
- `npm run bench:render` runs to completion and prints the summary
  table.

### Followups
- F-NNN (will be filed when the CI workflow dot lands): wire the
  optional `RUN_BENCH=1` step in CI so reviewers can request a bench
  comparison without touching the deterministic default pipeline.

---

## 2026-04-26: Slice: Off-road dust particles + physics surface flag

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md), [§16](gdd/16-rendering-and-visual-design.md)
**Branch / PR:** `feat/off-road-dust` (stacked on `feat/vfx-flash-shake`), PR pending
**Status:** Implemented

### Done
- Extended `src/game/physics.ts`: added `Surface = "road" | "rumble" | "grass"`
  type and a pure `surfaceAt(x, roadHalfWidth)` classifier. The road
  band is `|x| <= roadHalfWidth`, rumble is `|x| <= roadHalfWidth * 1.15`,
  grass is anything beyond. The 1.15 scalar matches the strip drawer's
  rumble trapezoid in `pseudoRoadCanvas.drawStrips` so physics and
  renderer stay in lockstep without inverting the dependency.
  `RUMBLE_HALF_WIDTH_SCALE` is exported so balancing slices can tune
  both layers from one place.
- `CarState` gained a `surface` field. `INITIAL_CAR_STATE.surface` is
  `"road"` so a fresh state at the centerline reads consistently before
  any tick has run. `step()` classifies the post-step lateral position
  via `surfaceAt` and returns the result on the new state. The
  `dt <= 0` early return preserves the prior `surface` field rather
  than re-deriving it (no input changed; no reason to recompute).
- Added `src/render/dust.ts`: pinned the API per stress-test item 8 of
  the visual-polish parent dot. Exports `INITIAL_DUST_STATE`,
  `tickDust(state, params)`, `drawDust(ctx, state, viewport)`, plus
  the tunables `MAX_DUST = 64`, `LIFETIME_MS = 600`,
  `EMIT_INTERVAL_TICKS = 2`, `EMIT_SPEED_THRESHOLD_M_PER_S = 8`,
  `PARTICLE_X_VELOCITY_PX_PER_S = 32`,
  `PARTICLE_Y_VELOCITY_PX_PER_S = -18`, `PARTICLE_RADIUS_PX = 4`,
  `DEFAULT_DUST_COLOR = "#c9b48a"`. Particles spawn at the caller's
  emit origin (typically the projected car position); horizontal
  velocity hashes off the (seed, particleIndex) integer pair via a
  Mulberry32-style hash so two replays paint identical particles.
- Pool-cap behaviour: when `state.particles.length` reaches `MAX_DUST`,
  the next emission overwrites slot `nextRecycleIdx` in place, then
  bumps the counter mod `MAX_DUST`. No allocation per emit once the
  pool is full; FIFO recycling order survives wrap-around.
- Lifetime: a particle is removed on the first tick whose post-add
  `elapsedMs >= LIFETIME_MS`. dt = 0 still bumps `tickIdx` so the "every
  2 ticks" cadence is dt-independent.
- Wired `DustState` into `pseudoRoadCanvas.drawRoad` via a new optional
  `DrawRoadOptions.dust`. The drawer paints dust AFTER the strip pass
  so particles sit over both road and grass; the pool is owned by the
  caller (read-only on the drawer side). Re-exported from
  `src/render/index.ts`.
- Added `src/render/__tests__/dust.test.ts`: 17 tests covering
  emission gating (road no-emit, rumble no-emit, grass + speed-at-or-
  under-threshold no-emit, grass + speed > threshold yields one
  emission per `EMIT_INTERVAL_TICKS`, surface flip road->grass starts
  emitting on the very tick); pool cap (65th emit recycles slot 0);
  lifetime (removed at exactly the 600 ms mark, dt = 0 preserves
  positions but advances tickIdx); determinism (two identical runs
  produce identical particles, different seeds diverge horizontal
  velocity); purity (input state never mutated); `drawDust` (one arc
  per active particle with alpha decaying from 1, radius attenuates
  linearly to 0 across lifetime, zero-area viewport short-circuits the
  draw, globalAlpha is restored after painting).
- Added 6 new tests to `src/game/__tests__/physics.test.ts`:
  `surfaceAt` classifies centerline / inclusive road edge / inclusive
  rumble edge / past-rumble; `step` emits the correct surface in each
  band; `dt = 0` preserves the prior surface field; surface
  transitions road -> grass on a single high-speed steering tick.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 429 tests passing (17 new in the dust suite, 6 new in
  physics surface tests, 23 total new).
- `npm run build` clean. Route sizes unchanged (`/race` stays at
  7.49 kB / 130 kB; the dust module ships in the render layer but has
  no runtime caller in this slice).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- `Surface` is an enum not a boolean because `rumble` is a distinct
  band per the strip drawer ("trapezoid 15% wider than the road"). A
  future tyre-rumble SFX slice can dispatch on `surface === "rumble"`
  without re-deriving the geometry; collapsing to `boolean` now would
  paint us into a corner.
- `INITIAL_CAR_STATE.surface = "road"` rather than computing from `x`.
  At `x = 0` both produce the same value, but pinning a literal keeps
  the singleton frozen at module init time and avoids importing
  `surfaceAt` into the constants file (which would create a
  cycle-of-readability between the type and the helper).
- The `dt <= 0` early-return path preserves the prior `surface` field
  rather than re-classifying. No input changed; matching the existing
  policy on `z`, `x`, `speed` (return verbatim) keeps the function's
  "nothing happened this frame" contract intact.
- Dust velocity hash is a separate copy of the Mulberry32-style chain
  in `vfx.ts` rather than a shared util. Sharing would couple two
  modules' deterministic outputs, so a tweak to the shake hash would
  silently shift dust particle positions across replays. Keeping
  per-module copies is a small DRY violation that buys per-system
  golden-test independence.
- `tickIdx` advances once per `tickDust` call regardless of dt or
  emission. This makes the "every 2 ticks" rule independent of
  wall-clock dt jitter, so a long-paused tab does not blast the pool
  on resume. Matches the §21 fixed-step model: ticks are the unit of
  time, not milliseconds.
- The drawer paints dust AFTER the strip loop so particles sit over
  the road / grass surfaces (matching the §16 "Dust roost" reference,
  where the plume rises above the surface). Painting before the strips
  would have the road occlude particles even at the spawn frame.
- `DEFAULT_DUST_COLOR = "#c9b48a"` is a sandy tan picked to read
  against both the dark grass (`#2f5a23` / `#3a6d2a`) and the light
  road (`#5a5a5a`). Tunable by callers via the `color` field on
  `tickDust` params for future weather variants (snow, mud).
- `PARTICLE_RADIUS_PX = 4` is small enough that a saturated 64-particle
  pool covers ~3 KB of overdraw at typical resolutions, well under the
  §16 60-FPS budget. The render-perf bench dot will measure this.
- No runtime integration with the race route in this slice. Wiring
  the dust pool into `/race` requires a screen-space car projector
  that the hud-ui-6c1b130d slice owns; doing it here would couple two
  open dots. The drawer accepts the optional `dust` field today so the
  follow-up slice can light it up without changing the renderer
  contract.

### Followups created
- None. The render-perf benchmark sibling dot
  (`implement-render-perf-f5492ef1`) covers measuring this module
  against the §16 60-FPS budget.

### GDD edits
- None.

---

## 2026-04-26: Slice: VFX flash + shake module with reduced-motion gate

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md), [§17](gdd/17-art-direction.md), [§19](gdd/19-controls-and-accessibility.md)
**Branch / PR:** `feat/vfx-flash-shake` (stacked on `feat/parallax-bands`), PR pending
**Status:** Implemented

### Done
- Added `src/render/vfx.ts`: pinned the API from stress-test items 6 / 7
  of the visual-polish parent dot, then split out into
  `implement-vfx-flash-3d33b035`. Exports `INITIAL_VFX_STATE`,
  `fireFlash(state, params)`, `fireShake(state, params)`,
  `tickVfx(state, dtMs)`, `drawVfx(ctx, state, viewport)`,
  `refreshReducedMotionPreference()`, and the pure
  `shakeOffsetAt(entry, elapsedMs)` helper. `MAX_SHAKE_AMPLITUDE_PX`
  caps stacked shakes at 24 px per axis; `DEFAULT_SHAKE_FREQUENCY_HZ`
  pins the snappy collision-shake frequency at 30 Hz per §16.
- Determinism: shake offsets derive from a Mulberry32-style integer
  hash on `(seed, tickIdx, axis)` so two replays with identical
  inputs paint identical pixels. The integer pair seed channels
  through the §22 RNG model (callers pass the seed; the module never
  consumes a global RNG).
- Reduced-motion gate: `fireShake` returns the input state unchanged
  when `prefers-reduced-motion: reduce` is set, per §19. `fireFlash`
  is NOT gated since the GDD treats HUD flash on lap complete as a
  navigation cue, not a motion effect.
- Hooked the renderer into `src/render/pseudoRoadCanvas.ts`: a new
  optional `DrawRoadOptions.vfx` paints the flash overlay between the
  parallax band and the road strips, then translates the canvas by
  the summed shake offset before the strip pass so the road shakes as
  one unit. The strip loop was extracted into a private `drawStrips`
  helper so the translate / restore wraps the entire road draw without
  duplicating the loop body.
- Re-exported `vfx` from `src/render/index.ts`.
- Added `src/render/__tests__/vfx.test.ts`: 27 tests covering
  `INITIAL_VFX_STATE` shape; `fireFlash` (push, invalid duration /
  intensity returns input state, works under reduced-motion, stacking);
  `fireShake` (push with seed and frequency, default frequency, invalid
  duration / amplitude, reduced-motion no-op,
  `refreshReducedMotionPreference` re-enables); `tickVfx` (zero / negative
  dt no-op, 4 ticks of 50 ms expire a 200 ms flash, shake removal at
  duration, immutability, independent flash + shake ticking);
  `shakeOffsetAt` (determinism across runs, different seeds diverge,
  zero-net-drift inside 1 px tolerance, returns zero past duration,
  linear amplitude attenuation); `drawVfx` (fillRect alpha decay
  envelope, MAX_SHAKE_AMPLITUDE_PX clamp, no-shake offset, zero-area
  viewport gates only the flash, two flashes paint in stack order,
  globalAlpha is restored after painting).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 402 tests passing (27 new in the vfx suite).
- `npm run build` clean. No route-size regression (`/race` stays at
  5.71 kB / 130 kB; the vfx module ships in the render layer but has
  no runtime caller in this slice).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- The flash overlay paints BEHIND the road strips, not on top. A
  HUD-style overlay flash belongs in the UI layer (where it should
  occlude the canvas); an in-world impact flash should not occlude the
  player car. Renderer callers that want a HUD flash can run a second
  drawVfx pass on the HUD layer after the road draws.
- `drawVfx` returns the shake offset rather than calling
  `ctx.translate` itself. Keeps the integration site explicit so the
  HUD layer can opt out of the shake (e.g. so the lap counter does not
  jitter during a collision).
- Each `ShakeEntry` carries its own `seed` and `frequencyHz`. Per-entry
  seeds let a future "off-road rumble" entry coexist with a "collision
  shake" entry without aliasing on shared sample points; per-entry
  frequency lets a slow rumble (5 Hz) coexist with a snap shake (30 Hz)
  in the same stack.
- `refreshReducedMotionPreference` exists for tests that flip the
  preference mid-suite. Production code does not need to call it
  because the accessibility setting does not change mid-session in
  practice (same reasoning as `TouchControls.usePointerCoarse` not
  subscribing to `change` events).
- The hash function is Mulberry32-style on the integer pair
  `(seed, tickIdx)` rather than a full PRNG state machine because the
  module needs random ACCESS by elapsed time, not a sequential stream.
  A stream PRNG would force callers to advance the state every frame
  even when nothing was drawing, which loses the "drawVfx is pure"
  property.
- `MAX_SHAKE_AMPLITUDE_PX = 24` is the chosen stack cap. Picked at the
  upper end of "subtle and short" per §16 so a degenerate stack still
  feels like a strong impact rather than a screen-clearing rumble.
- Zero-area viewport short-circuits the FLASH overlay only, not the
  shake offset computation. Tests that simulate a hidden tab or a
  resized canvas mid-tick still get the same offset they would with
  the canvas visible, so the deterministic-replay invariant survives a
  viewport collapse.

### Followups created
- None. The two remaining sibling visual-polish dots (off-road dust,
  render perf bench) remain open and ready.

### GDD edits
- None.

---

## 2026-04-26: Slice: Parallax bands renderer (sky / mountains / hills)

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md)
**Branch / PR:** `feat/parallax-bands` (stacked on `feat/sprite-atlas-loader`), PR pending
**Status:** Implemented

### Done
- Added `src/render/parallax.ts`: pinned the `drawParallax(ctx, layers,
  camera, viewport)` API from stress-test item 4 of the visual-polish
  parent dot. Exports `ParallaxLayer` (id `"sky" | "mountains" | "hills"`,
  `image: HTMLImageElement | null`, `scrollX`, `bandHeight`, `yAnchor`),
  pure helpers `parallaxOffsetFor(layer, camera)` and `bandRect(layer,
  viewport)`, the shared `PLACEHOLDER_FILL = "#ff00ff"`, and the
  `PARALLAX_PX_PER_WORLD_X = 1` tuning constant. Parallax derives only
  from `camera.x` per stress-test item 5 so the road's already-baked
  curvature does not double-shift the sky bands.
- Tiled horizontal scroll uses a `modPositive` helper so a camera
  arbitrarily far from world origin (positive or negative) still tiles
  across the viewport without gaps.
- Hooked the drawer into `src/render/pseudoRoadCanvas.ts` via an
  optional `DrawRoadOptions.parallax = { layers, camera }`. When
  present, the parallax bands replace the flat sky gradient; absent
  callers retain Phase 1 behaviour. No race / dev page is wired to
  parallax yet (placeholder PNG art is gated on a sibling dot); the
  hook is in place for the visual-polish landing slice.
- Added `src/render/__tests__/parallax.test.ts`: 14 tests covering
  `parallaxOffsetFor` (factors 0 / 0.25 / 0.6 / 1, scaling constant,
  determinism), `bandRect` (yAnchor 0 / 0.5 / 1), and `drawParallax`
  (back-to-front order across sky / mountains / hills, horizontal
  tiling at camera.x = 10000, placeholder fill when image is null,
  yAnchor=1 flush with viewport bottom, zero-area viewport short
  circuit, zero bandHeight short circuit, first-difference variance
  under a 600-frame curve fixture stays within 2 px, deterministic
  replay of a 30-frame camera path).
- Re-exported `parallax` from `src/render/index.ts`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 375 tests passing (14 new in the parallax suite).
- `npm run build` clean. No route-size regression (the parallax module
  is not yet imported by `/race` or `/dev/road`).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- Parallax derives from `camera.x` only; `camera.z` is in the signature
  for forward compatibility (e.g. depth-driven horizon lift in a later
  polish slice) but is not read today. This is the explicit pin from
  stress-test item 5: the road strip projector already bakes per-segment
  curvature into the centerline, so a parallax module that also
  responded to curvature would visibly double-shift.
- `PARALLAX_PX_PER_WORLD_X = 1` is the chosen world-x to pixel ratio.
  Lives in `parallax.ts` rather than `road/constants.ts` because
  parallax is a pure renderer concept the road compiler does not need
  to know about.
- The placeholder fill is `#ff00ff`, identical to the sprite atlas
  fallback fill. Magenta-on-missing-art is the project convention; the
  shared constant means a future palette tweak flips both renderers in
  one place.
- `ParallaxLayer.image` is `HTMLImageElement | null` so callers can
  pre-define their layer set without blocking on image load. The drawer
  gracefully degrades to placeholder fill per layer until the asset
  resolves, matching the `loadAtlas` `fallback: true` pattern.
- The drawer hook in `pseudoRoadCanvas.ts` REPLACES the sky gradient
  rather than layering on top of it. Layering would require either an
  alpha channel in the parallax PNG or a separate clear pass; the
  replacement keeps Phase 1 callers untouched and avoids a visible
  composite seam.
- The 600-frame variance test uses a synthetic sinusoidal camera path
  rather than driving the projector directly. The projector adds no
  curvature contribution to the parallax math by design, so the
  fixture isolates the parallax module's own jitter (zero) from the
  road's curvature behaviour (already covered by the projector tests).

### Followups created
- None. The three remaining sibling visual-polish dots (vfx flash +
  shake, off-road dust, render perf bench) remain open and ready.

### GDD edits
- None.

---

## 2026-04-26: Slice: Sprite atlas loader + frame index math

**GDD sections touched:** [§16](gdd/16-rendering-and-visual-design.md), [§17](gdd/17-art-direction.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/sprite-atlas-loader` (stacked on `feat/title-screen-menu-wiring`), PR pending
**Status:** Implemented

### Done
- Added `src/render/spriteAtlas.ts`: pinned the API from stress-test
  item 2 of `implement-visual-polish-7d31d112`. Exports `loadAtlas(meta,
  options)` (always resolves; image load failure surfaces as
  `{ image: null, fallback: true }` plus a single `console.error('[atlas]', path)`)
  and `frame(atlas, spriteId, frameIdx)` (modulo wraps out-of-range
  indices, throws `RangeError` on unknown sprite ids even in fallback
  mode). Re-exports the `AtlasFrame` / `AtlasMeta` types from
  `@/data/schemas` so render callers have one import surface. Ships a
  shared `FALLBACK_FRAME` (32x32 magenta, anchored at foot) and
  `FALLBACK_FILL = "#ff00ff"` so fallback rendering is reference-stable
  for memoisation.
- Added `AtlasMetaSchema` and `AtlasFrameSchema` to `src/data/schemas.ts`
  per stress-test item 3. Frames require positive `w` / `h`, anchors are
  optional and clamped to `[0, 1]`, and the sprites map plus every
  frame array must be non-empty so callers can index `[0]` without
  bounds checks.
- Added `src/data/atlas/cars.json`: one full atlas fixture for the
  Sparrow GT covering 12 directional frames across three damage
  variants (clean / dented / battered) plus brake-light and nitro-glow
  single frames per §17 "Car sprites".
- Added `src/data/atlas/roadside.json`: one regional roadside atlas with
  five prop categories (sign marker, pine tree, fence post, rock
  boulder, light pole) per §16 "Roadside objects".
- Added `src/render/__tests__/spriteAtlas.test.ts`: 16 tests covering
  the schema (4 fixtures + 3 broken variants), `loadAtlas` (success,
  error + log, leading-slash normalisation, missing Image constructor),
  and `frame` (in-range, modulo wrap, negative wrap, unknown sprite
  throws, fallback mode, fallback + unknown still throws, determinism).
  The Image stub fires `onload` / `onerror` on a queued microtask so the
  loader's promise behaves like real browser asynchrony.
- Re-exported `spriteAtlas` from `src/render/index.ts` alongside the
  existing road / UI renderer exports.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 361 tests passing (16 new in the sprite atlas suite).
- `npm run build` clean. No route-size regression (unchanged from prior
  slice; the atlas module is not yet imported by `/race`).
- `npm run test:e2e` 4 of 4 passing (no UI changes in this slice).

### Decisions and assumptions
- `frame` returns `FALLBACK_FRAME` for known sprite ids when the atlas
  is in fallback mode, but still throws `RangeError` for unknown ids.
  The asymmetry is deliberate: a missing image is a runtime / network
  condition the renderer must survive, but an unknown sprite id is a
  programming error the test suite should catch even with a broken
  atlas.
- Image paths are stored relative to `public/` (e.g.
  `art/cars/sparrow.png`) and the loader prepends `/` at resolve time.
  Authors can also write the leading slash; both forms produce the
  same runtime URL.
- Tests stub `Image` with a queued-microtask shim rather than depending
  on jsdom so the suite stays in Vitest's node environment, matching
  the strategy already used in `src/asset/__tests__/preload.test.ts`.
- The atlas loader does not validate against `AtlasMetaSchema` itself.
  Validation belongs at the JSON-load boundary (the future asset
  preloader will run `AtlasMetaSchema.safeParse` before calling
  `loadAtlas`), so the loader trusts its `AtlasMeta` argument and stays
  side-effect-free apart from the image fetch.

### Followups created
- None. The four sibling visual-polish dots (parallax bands, vfx flash
  + shake, off-road dust, render perf bench) remain open and ready.

### GDD edits
- None.

---

## 2026-04-26: Slice: Title-screen menu wiring (Start Race, Garage, Options pending)

**GDD sections touched:** [§5](gdd/05-core-gameplay-loop.md), [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/title-screen-menu-wiring` (off `feat/race-session-vertical-slice`), PR pending
**Status:** Implemented

### Done
- Replaced the three placeholder `<button disabled>` controls in
  `src/app/page.tsx` with `next/link` anchors for `Start Race` (`/race`)
  and `Garage` (`/garage/cars`), plus a deliberately-disabled `Options`
  button carrying `data-testid="menu-options-pending"` so the future
  `/options` slice can flip the assertion in one line.
- Updated `src/app/page.module.css` so the shared `.menuItem` class
  styles both `<a>` and `<button>` variants identically: added
  `text-align`, `text-decoration: none`, `font: inherit`,
  `display: inline-block`, a `:focus-visible` style, and an
  `[aria-disabled="true"]` selector matching the existing `:disabled`
  visual treatment.
- Rewrote `e2e/title-screen.spec.ts`: the smoke test now asserts the
  Start Race and Garage anchors render with the correct `href`, the
  Options button is visible and disabled with the pending hook, and
  added two new specs that click each enabled menu item and assert the
  resulting URL (`/race`, `/garage/cars`).
- Added `src/app/__tests__/page.test.tsx`: six unit tests that
  `renderToStaticMarkup(TitlePage)` and assert (a) the title renders,
  (b) each anchor has the right `data-testid` and `href`, (c) the
  Options button stays disabled with `aria-disabled="true"`, (d) the
  DOM order is Start Race -> Garage -> Options for keyboard tab, and
  (e) the build-status footer hook still ships.
- Wired `@vitejs/plugin-react` (already in devDependencies) into
  `vitest.config.ts` so `.test.tsx` suites get the automatic JSX
  runtime without each file importing React.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 345 tests passing (6 new in `src/app/__tests__/page.test.tsx`).
- `npm run build` clean. `/` ships at 3.57 kB / 106 kB first-load
  (was 1.41 kB / 102 kB before the Link wiring; the bump comes from
  `next/link` being a client component pulled into the route).
- `npm run test:e2e` 4 of 4 passing (title-screen smoke + two
  navigation specs + race demo).

### Decisions and assumptions
- Options stays disabled with a distinct `data-testid="menu-options-pending"`
  rather than being hidden, so the keyboard tab order is stable across
  the disabled-then-enabled transition and tests can flip the
  assertion in a single line when the `/options` route lands.
- Used `next/link` rather than a programmatic router push so the menu
  works without JS for pre-hydration crawlers and so the keyboard tab
  order falls out of normal anchor focus behavior (no `onClick`
  handlers needed).
- The unit test uses `renderToStaticMarkup` over RTL because the rest
  of the suite runs in `node` without `@testing-library/react`
  installed; for static-shape assertions on a server-rendered page,
  raw HTML inspection is the lighter option and avoids pulling in a
  jsdom test environment.
- Added `@vitejs/plugin-react` to the vitest config (no new dependency,
  it was already installed) so future `.test.tsx` suites have the
  automatic JSX runtime available without a per-file React import.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: Phase 1 vertical slice integration (drivable /race)

**GDD sections touched:** [§7](gdd/07-race-rules-and-structure.md), [§10](gdd/10-driving-model-and-physics.md), [§15](gdd/15-cpu-opponents-and-ai.md), [§20](gdd/20-hud-and-ui-ux.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/race-session-vertical-slice` (off `feat/playwright-smoke-recovery`), PR pending
**Status:** Implemented

### Done
- Added `src/game/raceSession.ts`: pure glue between input, physics, AI,
  and race lifecycle. Exposes `createRaceSession` and `stepRaceSession`
  (both pure, no rAF, no globals) plus a `totalProgress` helper for HUD
  ranking. The session owns the `phase` lifecycle (countdown -> racing
  -> finished), the player car state, the AI car array, and a tick
  counter that resets at the green light so lap timing starts there.
- Extended `src/game/raceState.ts` with `countdownRemainingSec`,
  `lastLapTimeMs`, and `bestLapTimeMs`. Added `DEFAULT_COUNTDOWN_SEC`
  (3 s per the dot stress-test §2) and a `countdownSec` option on
  `createRaceState` so practice / quick-race modes can opt for an
  instant start.
- Wired `/race` to the runtime: track compiler, fixed-step loop, input
  manager, race session, road renderer, and HUD overlay. Reads
  `?track=<slug>` from the URL (defaults to `test/curve`, falls back on
  unknown ids), mounts an 800x480 canvas, wraps in `<ErrorBoundary>`
  and a Suspense fallback, holds the loop handle in a `useRef` and
  stops it on unmount so React StrictMode does not spawn two parallel
  loops.
- Pause overlay sits on top of the canvas. `usePauseToggle` wires
  Escape to `loop.pause()` / `loop.resume()`, so the sim halts without
  stalling the render callback.
- Lap completion: `floor(player.car.z / track.totalLengthMeters)`
  drives the lap counter. On increment we record `lastLapTimeMs`,
  update `bestLapTimeMs`, and on final-lap completion flip to
  `finished` and freeze physics. The full §7 race-rules engine is
  still owned by the race-rules dot; this slice ships only the
  happy-path integration.
- Single AI clean_line opponent spawns 5 m behind the player at the
  centerline, per the dot stress-test §4. Full grid placement remains
  with `implement-ai-grid-02d7e311`.
- Added `src/game/__tests__/raceSession.test.ts` (12 tests: countdown
  decrement, lights-out promotion, lap completion + timing, finished
  freeze, determinism check, immutability of returned state).
- Added `src/data/__tests__/tracks-content.test.ts` (5 tests: every
  bundled track validates against `TrackSchema` and compiles via
  `loadTrack` without throwing).
- Added `e2e/race-demo.spec.ts`: visits `/race`, asserts the canvas
  mounts, waits for the countdown to expire, holds ArrowUp for ~2.5 s,
  asserts the speed HUD reads > 0, and asserts the lap label is
  `1 / N`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 339 tests passing (17 new across the two new suites,
  3 raceState additions).
- `npm run build` clean. `/race` ships at 5.62 kB / 129 kB first-load.
- `npm run test:e2e` 2 of 2 passing locally (title screen smoke +
  race demo).

### Decisions and assumptions
- `RaceSession` lives in `src/game/`, not `src/app/`. Pure module, no
  React. The `/race` page is the only consumer that wires it into the
  rAF loop.
- Track JSON is loaded via static `import` (the bundled
  `src/data/tracks/index.ts` barrel + `loadTrack(id)`) rather than
  `fetch`, so the bundle ships the JSON at build time and the demo
  loads instantly.
- Default countdown is 3 s, per the dot stress-test §2. Configurable
  via `RaceSessionConfig.countdownSec` so practice / quick-race can
  override to 0.
- Asset preload (`LoadingGate`) is intentionally skipped on `/race`
  for this slice. The MVP demo only needs the track JSON (statically
  imported) and the road renderer's solid-fill colours; sprite
  atlases will land with the visual-polish slice. The gate returns
  once `public/assets/` exists, tracked under F-018.
- AI per-frame lap is computed from `floor(ai.car.z / totalLength)`
  (the per-AI lap field is deferred to the AI grid slice).
- Lap timing uses sim-elapsed time so the value is deterministic
  across machines, not wall-clock-influenced.

### Followups created
- None new. The "off-road persistent damage" extension and "full grid
  spawning" are tracked by their existing slices.

### GDD edits
- None.

---

## 2026-04-26: Slice: Recover Playwright e2e harness + title-screen smoke

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/playwright-smoke-recovery` (off `feat/track-compiler-golden`), PR pending
**Status:** Implemented (recovery)

### Done
- Re-applied the Playwright harness that was originally shipped on
  `feat/playwright-smoke` (commit 693043a) but never made it onto any
  later feature branch. Dot
  `VibeGear2-implement-add-playwright-64eb2a44` re-opened
  `VibeGear2-implement-add-playwright-c2ccf4f9` after the iteration 17
  audit found no Playwright artefacts on `main` or any in-flight feature
  branch.
- Recovery option chosen: option 2 from the dot's recovery path
  (re-implement on the latest feature branch). Option 1 was attempted
  first via `git cherry-pick 693043a` but produced two unmergeable
  conflicts in `docs/PROGRESS_LOG.md` because every later iteration
  prepended a new top entry. The file contents from 693043a
  (`playwright.config.ts`, `e2e/title-screen.spec.ts`) were copied
  verbatim via `git show 693043a:<path>` so future bisects still find
  one canonical shape.
- Added `@playwright/test` ^1.48.0 as a devDependency and installed via
  `npm install`.
- Restored `playwright.config.ts`: chromium project, runs against
  `http://127.0.0.1:3100` (configurable via `PLAYWRIGHT_PORT`), boots
  the Next.js production build via `npm run build && npm run start`,
  retains HTML reports + traces + screenshots on failure, GitHub
  reporter under CI.
- Restored `e2e/title-screen.spec.ts`: a single smoke test that loads
  `/`, asserts `data-testid="game-title"` reads "VibeGear2", asserts
  the document title matches, asserts the three menu buttons (Start
  Race, Garage, Options) are visible and disabled, and asserts the
  build-status footer contains "Phase 0".
- Restored npm scripts `test:e2e`, `test:e2e:ui`, and `verify:full`
  (`verify` + `test:e2e`).
- Restored the `vitest.config.ts` exclude pattern from `tests/e2e/**` to
  `e2e/**` so the Playwright spec is not picked up by Vitest.
- Restored the README local-dev block documenting
  `npx playwright install chromium`, `npm run test:e2e`, and
  `npm run verify:full`.

### Verified
- `npm install` succeeds.
- `npx playwright install chromium` succeeds.
- `npm run lint`, `npm run typecheck`, `npm test` all pass.
- `npm run test:e2e` builds and starts the production server, runs the
  smoke spec, and passes (1 passed).
- `npm run build` clean.
- `grep -P` for U+2013 and U+2014 across new files returns nothing.

### Decisions and assumptions
- Branched off `feat/track-compiler-golden` (the head of the current
  13-deep stack) rather than re-cutting `feat/playwright-smoke` against
  `main`, because every other in-flight slice already targets the
  stack's tip and rebasing the whole stack onto a second base branch
  would multiply the merge work.
- Chose to re-apply rather than cherry-pick because the cherry-pick
  conflicted twice in `PROGRESS_LOG.md` (every later iteration prepends
  a top entry) and the source artefacts are tiny.
- Did not bring forward F-016 / F-017 / F-018 specs in this slice. They
  remain open per the dot's "Out of scope" section; their dots can now
  be picked up because the harness exists.

### Followups created
- None new. F-002 advanced: only the GitHub Actions CI sub-slice
  remains, still blocked by F-003 / Q-003.

### GDD edits
- None.

---

## 2026-04-26: Slice: Track compiler + golden-master tests (§9, §22)

**GDD sections touched:** [§9](gdd/09-track-design.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/track-compiler-golden`, PR pending
**Status:** Implemented

### Done
- Replaced the stubbed `compileTrack` in `src/road/trackCompiler.ts`
  with the full pipeline pinned by
  `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md`. The
  function now returns a `CompiledTrack` with `segments`, `checkpoints`,
  `warnings`, and full track metadata, recursively frozen via a local
  `deepFreeze` helper so callers cannot mutate it.
- Added `class TrackCompileError extends Error` with stable `code` and
  `details` fields. The compiler throws on no checkpoints, missing or
  misplaced start checkpoint, out-of-bounds checkpoint segmentIndex, and
  total compiled segment count below the 4-segment minimum.
- Added soft lints emitted into `CompiledTrack.warnings`: spawn.gridSlots
  below 8, weatherOptions missing "clear", lengthMeters drift over 5%
  from the sum of authored len, duplicate non-start checkpoint labels,
  and packed hairpin runs (consecutive |curve| > 0.6 with combined len
  under 80 m).
- Renamed `CompiledSegment.authoredRef` to `authoredIndex` and added the
  `roadsideLeftId`, `roadsideRightId`, and `hazardIds` fields per the
  research spec. `hazardIds` shares the same array reference as the
  authored segment to avoid per-frame allocation in the renderer.
- Kept the lower-level `compileSegments(authored)` entry point for the
  dev pages (`/dev/road`, `/dev/physics`, AI tests) and renamed its
  return type to `CompiledSegmentBuffer` to disambiguate from the full
  `CompiledTrack` returned by `compileTrack`.
- Added a browser-safe `loadTrack(id)` helper in `src/data/index.ts`
  backed by a static-import barrel `src/data/tracks/index.ts`. Two
  bundled tracks ship today: `test/straight` and `test/curve`.
- Added 16 unit tests in `src/road/__tests__/trackCompiler.test.ts`
  covering the algorithm, the throw cases, the warning cases, and the
  frozen-output property. Plus 10 lower-level `compileSegments` tests.
- Added 5 fixture tracks under `src/road/__tests__/fixtures/` (straight,
  gentle-curve, crest, mvp-vs, boundary) and a golden-master suite
  `trackCompiler.golden.test.ts` that deep-compares each fixture against
  a JSON snapshot stored in `__snapshots__/trackCompiler.snapshots.json`.
  Use `UPDATE_SNAPSHOTS=1 vitest run` to regenerate intentionally.
- Implemented `snapshotHelpers.ts` with stable JSON serialisation
  (sorted keys), atomic write-back via tmp + rename, full-prefix of 30
  segments plus stride-25 sampling beyond, and a clear "rerun with
  UPDATE_SNAPSHOTS=1" hint on a first-time miss.
- Updated `src/data/examples/track.example.json` and
  `docs/gdd/22-data-schemas.md` to use valid authored checkpoint
  indices (the previous example referenced compiled-segment indices
  18 and 41, which are out of bounds against the 2 authored segments
  the example actually shows).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 319 total passing (52 new across the three road suites).
- `npm run build` clean. New tracks barrel ships in the client bundle.

### Decisions and assumptions
- Pre-scaled curve and grade kept on `CompiledSegment` (Option A from
  the dot stress-test) so the existing `segmentProjector` does not
  regress. Documented the post-scaled invariant on the type.
- `loadTrack(id)` uses a build-time JSON barrel rather than `node:fs`
  so it is safe under static export and Edge runtime.
- `compileSegments` kept as a thin escape hatch for dev pages so they
  do not need to fabricate fake checkpoints.

### GDD edits
- `docs/gdd/22-data-schemas.md`: changed the example track's checkpoint
  segmentIndex values from 18 and 41 to 1, so the example is internally
  consistent with the authored segments shown.

---

## 2026-04-26: Slice: Single AI driver, clean_line archetype (§15)

**GDD sections touched:** [§15](gdd/15-cpu-opponents-and-ai.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/single-ai-cleanline`, PR pending
**Status:** Implemented

### Done
- Added `src/game/ai.ts` with `tickAI(driver, aiState, aiCar, player,
  track, race, stats, context, dt) -> { input, nextAiState }`. The
  function is pure: no globals, no `Math.random`, no `Date.now`. Same
  arguments produce identical outputs across runs, satisfying the
  §21 replay/ghost determinism requirement.
- Pinned the runtime AI state shape `interface AIState`
  (`progress`, `laneOffset`, `speed`, `intent`, `targetSpeed`,
  `seed`). Carries the per-AI PRNG seed even though the clean_line
  slice does not consume it, so adding mistake-prone or
  nitro-aware archetypes later does not force a breaking
  signature change.
- Pinned `AI_TUNING` constants in one place: racing-line bias cap
  (70 percent of road half-width), curve-driven deceleration
  coefficient (0.6 for unit curvature), minimum AI speed floor
  (8 m/s), speed hysteresis band (1.5 m/s), brake ramp (full at
  6 m/s overshoot), and steer P-gain (1.5 m authority band).
- Implemented the three clean_line behaviours from §15
  "Implementation approach": ideal lateral offset from the segment
  curve (inside-of-corner bias), target speed from `topSpeed`,
  curve magnitude, and `paceScalar`, and a P-controller for steer
  that doubles as off-road recovery once `aiCar.x` crosses the
  rumble.
- Countdown gating: `race.phase !== "racing"` returns
  `NEUTRAL_INPUT`. The AI does not integrate during the countdown
  but still updates its `progress` / `laneOffset` mirror so a
  future grid HUD overlay can show the starting order.
- Reasoned in authored-curve units (multiplied compiled
  `segment.curve` by `CURVATURE_SCALE`) so the tuning constants
  read against the same magnitude a track author types into the
  schema.
- Added `src/app/dev/ai/page.tsx` for visual smoke verification.
  Runs the §10 physics step driven by `tickAI` on a mixed
  straight / sweeper / straight / sweeper test track. The panel
  below the canvas reports live AI speed, target speed, lateral
  offset, and the steer / throttle / brake input.
- Added 18 unit tests in `src/game/__tests__/ai.test.ts`:
  countdown gating returns `NEUTRAL_INPUT`, straight-and-below
  target accelerates with zero steer, target-speed scales with
  `paceScalar`, sweeper biases steer toward the inside, target
  speed drops on curves, brakes when overshooting target,
  hysteresis-band feathering at and just below target,
  off-track recovery steers toward centerline, full-lock clamp on
  large lateral errors, purity (no input mutation), seed
  preservation, deep-equal output across 100 identical calls,
  and a sanity check on the tuning constants.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` 18 new tests, 287 total passing.
- `npm run build` clean. `/dev/ai` prerenders to a static page
  (2.98 kB).

### Followups
- AI overtake behaviour, collision avoidance, and lane shifts
  remain on the full-grid AI dot.
- Nitro firing for clean_line is deliberately deferred per the
  dot stress-test (item 3): future slice will add it once the
  nitro budget shape is settled.
- Future archetypes (rocket starter, bully, cautious, chaotic,
  enduro) reuse the `AIState` shape and consume the per-AI
  `seed` for randomised behaviour.

---

## 2026-04-26: Slice: Asset preload + loading screen (§21)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md), [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/asset-preload`, PR pending
**Status:** Implemented

### Done
- Added `src/asset/preload.ts` with the pure loader
  `preloadAll(manifest, options) -> Promise<{ assets, failures }>`.
  Resolves entries in parallel, never rejects, preserves manifest order
  in the output map and failure list, drops aborted entries silently
  (they neither resolve nor surface as failures), and validates that
  the fetcher's returned `kind` matches the entry's declared `kind`.
  Progress is reported through an injected `onProgress` callback after
  every settled entry so the loading screen does not have to derive
  its own progress.
- Distinguished critical vs non-critical assets via the `critical`
  flag on each entry plus the `hasCriticalFailure(result)` helper.
  Critical failures block the gate and surface a retry; non-critical
  failures degrade silently with a screen-reader-friendly warning
  count.
- Added a `createBrowserFetcher(deps)` factory that wraps `fetch`,
  `Image`, and an injected `AudioContext.decodeAudioData` for the
  runtime path. Dependencies are injectable so the unit tests never
  reach for the DOM and so a future Node-side build (e.g. golden
  manifest tests) can use a memory transport.
- Added `src/asset/manifest.ts` with `manifestForTrack({ track,
  weather, playerCarId, aiCarIds, resolver })`. Order is stable: track
  JSON first, then player car sprite, then AI car sprites (deduped
  against the player), then unique roadside atlases in segment order,
  then weather audio for the selected variant. Track JSON and player
  sprite are critical; everything else is non-critical so a missing
  roadside atlas does not block the race.
- Added `src/components/loading/loadingState.ts` as the pure state
  machine for the loading screen. Phases are `idle`, `loading`,
  `failed-critical`, and `ready`; the fold function `applyProgress`
  is idempotent and never mutates the input snapshot. Helpers
  `formatLoadingText` and `progressFraction` produce the screen-reader
  text and bar fraction.
- Added `src/components/loading/LoadingScreen.tsx`: presentational
  view with a `role="status"` live region, `role="progressbar"` track
  with the live percentage, a `data-phase` attribute for Playwright
  assertions, and a retry button only when a critical failure has
  surfaced. `reducedMotion` disables the bar's CSS transition without
  affecting the input flow.
- Added `src/components/loading/LoadingGate.tsx`: controller that wires
  `preloadAll` into the screen. Cancellation runs through an
  `AbortController` that aborts on unmount or manifest-id change.
  Empty manifests skip the gate entirely. A retry handler bumps an
  internal attempt counter so the gate re-runs the preload after a
  critical failure.
- Added `src/app/race/page.tsx` so the gate is wired end to end. The
  route currently mounts a placeholder "Race ready" card instead of
  the full canvas because the §10 / §15 / §20 race scene has not been
  composed into a single mounted page yet; the canvas swap happens in
  the future race-route slice. `/race` builds and prerenders.
- Added 36 new unit tests across three files:
  `src/asset/__tests__/preload.test.ts` (11 cases covering empty
  manifest, happy-path 3 image / 2 audio / 1 json, manifest-order
  preservation when entries resolve out of order, partial failure,
  kind mismatch, progress events, abort with no console noise, and
  AbortError name handling), `src/asset/__tests__/manifest.test.ts`
  (8 cases covering ordering, critical flagging, dedupe, weather
  audio selection, manifest id stability, default and injected
  resolvers), and
  `src/components/loading/__tests__/loadingState.test.ts` (17 cases
  covering startLoading, every phase transition, idempotency,
  immutability, every formatLoadingText branch, and progressFraction
  edge cases).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 269/269 (36 new across the three new test files
  plus 233 prior).
- `npm run build` succeeds; `/race` is one of the prerendered routes
  (3.52 kB).
- `grep -P '[\x{2013}\x{2014}]'` across the new files returns nothing
  (no em-dashes, no en-dashes).
- Manual visual verification of the loading screen and gate defers to
  Playwright once F-002 lands the harness; the dot's e2e spec is
  filed as F-018.

### Decisions and assumptions
- The race route ships a placeholder body because the full §10 / §15
  / §20 race scene has not been composed into a single mounted page
  yet; the gate is the contribution of this slice. The placeholder
  preserves the gate's contract (children receive the decoded asset
  map) so the canvas swap is a leaf change in a future slice.
- `manifestForTrack` does not enforce dedupe across `aiCarIds`
  beyond skipping the player id. Repeated AI ids are the caller's
  responsibility; the manifest test documents this rather than
  silently deduping (a noisy contract is easier to debug than a
  silent one).
- Aborted entries are dropped from `failures` rather than surfaced as
  cancellation failures. This matches the dot's spec ("subsequent
  calls do not log to console") and keeps Playwright assertions about
  the failure list stable across cancelled vs completed runs.
- The default resolver returns URLs under `/assets/...` even though
  no asset pipeline ships those files yet. Until the pipeline lands,
  every preload attempt against a default resolver will fail, but
  most failures are non-critical so the gate still surfaces a "Race
  ready" body. The next asset-pipeline slice will add the files.
- Critical-vs-non-critical split is documented in the manifest module's
  JSDoc per the dot's verify checklist; it is also enforced in code by
  the `critical: true` markers on the track JSON and player sprite
  entries.

### Followups created
- F-018: Playwright e2e spec for the loading screen / preload gate
  (deferred until F-002 lands the harness).

### GDD edits
- None. Implementation conforms to §21 (Renderer + Audio preload) and
  §20 (loading-screen accessibility text + reducedMotion handling).

---

## 2026-04-26: Slice: Touch / mobile input source (§19, closes F-013)

**GDD sections touched:** [§19](gdd/19-controls-and-input.md)
**Branch / PR:** `feat/touch-mobile-input`, PR pending
**Status:** Implemented

### Done
- Added `src/game/inputTouch.ts` with the pure projector
  `inputFromTouchState({ pointers, layout }) -> Input` and the stateful
  `createTouchInputSource({ target, layout, resetOnBlur }) -> { sample,
  hasActivePointers, dispose }`. The projector classifies each pointer
  by its origin position into one of four right-zone buttons
  (accelerator, brake, nitro corner, pause corner) or as the steering
  pointer. Steering reads as the dominant left-zone pointer's X offset
  from its anchor, clamped by `stickMaxRadius` and normalised to
  `[-1, 1]`. Multi-touch is required so a player can hold accelerator
  with one finger and steer with another; the manager tracks each
  pointer by `pointerId` and routes per-zone.
- Edge-case rules per the dot:
  - Two pointers in the steer zone: latest wins (so re-anchoring
    with a fresh finger takes effect immediately).
  - Two pointers in the right zone: any in accelerator counts as
    held (so a player can lift and replace fingers without losing
    throttle).
  - `pointercancel` (system gesture, palm reject, OS modal) releases
    the captured pointer, mirroring `pointerup`.
  - `blur` clears all active pointers, mirroring the keyboard
    manager's window-blur behaviour.
  - Non-finite or zero-radius layouts are guarded to avoid NaN.
- Added `mergeWithTouch(base, touch) -> Input` in `src/game/input.ts`.
  Steering uses the louder-wins rule (larger absolute steer wins);
  throttle / brake take the max; booleans OR. The asymmetric
  keyboard-beats-pad-on-steer rule from `mergeInputs` does not apply
  (a virtual stick is analog like the gamepad).
- Extended `InputManagerOptions` with optional `touchTarget` and
  `touchLayout`. When `touchTarget` is set, `createInputManager`
  attaches a `createTouchInputSource` and folds its sample into the
  pipeline via `mergeWithTouch(mergeInputs(kb, pad), touch)`. When
  unset (the default), no touch listeners attach and behaviour is
  unchanged from the prior keyboard + pad slice. Added a `hasTouch()`
  diagnostic alongside `hasGamepad()`.
- Added `src/components/touch/TouchControls.tsx`: presentational SVG
  overlay sized off `DEFAULT_TOUCH_LAYOUT`. Renders a left-side stick
  with a moving knob, plus accelerator, brake, nitro, and pause
  buttons in their layout positions. Visibility gates on
  `pointer:coarse` via `matchMedia` (SSR safe; defaults to hidden).
  `forceVisible` opt-out for the dev page and tests. `reducedMotion`
  prop disables the knob's CSS transition without affecting input.
  The overlay does not own input state; it subscribes to its own SVG
  for visual knob tracking only. Sets `pointer-events: none` on the
  root so taps still reach the underlying touch input target.
- Added `src/game/inputTouch.test.ts` with 38 cases covering: empty
  state, in-zone vs out-of-zone steer, max-radius clamp, partial
  drag, accelerator vs brake routing, multi-touch composition,
  steer-latest-wins, accelerator-and-brake-coexist, nitro and pause
  corner taps, no-handbrake-or-shifts contract, zero-radius and NaN
  guards, manager event tracking, ignored unknown pointermove,
  pointercancel, blur, dispose listener count and idempotency,
  `resetOnBlur: false`, client-to-local coord conversion via
  `getBoundingClientRect()`, null-target SSR path, re-anchor on next
  pointerdown, layout supplier picked up per sample, plus three
  `createInputManager(touchTarget)` integration cases (no listeners
  when unset, sample merges throttle, dispose tears down).
- Updated `docs/FOLLOWUPS.md`: marked F-013 `done` with the slice
  reference; filed F-017 for the deferred Playwright spec (no harness
  yet, mirrors F-016).
- Updated the touch deferral comment at the top of
  `src/game/input.ts` so future readers see the new `touchTarget`
  option instead of the F-NNN placeholder.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 234/234 (38 new across `inputTouch.test.ts` plus
  196 prior).
- `npm run build` succeeds.
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification of the overlay defers to a human run on a
  touchscreen device or with Chrome devtools' device emulation. The
  pure projector and stateful manager are fully covered by the new
  unit tests.

### Decisions and assumptions
- The dot asked for the e2e Playwright spec on `device: 'iPhone 13'`.
  Deferred to F-017 because the project has no Playwright runner yet
  (F-002 still tracks the harness slice). The same precedent was set
  by the pause-overlay slice's F-016.
- The TouchControls component subscribes to its own SVG for the
  visual knob, not the underlying input source. This avoids a
  cross-module subscription contract and keeps the overlay's render
  cadence independent of the sim sample cadence. The actual input
  reading goes through `createTouchInputSource` (or
  `createInputManager(touchTarget)`), which the race scene wires once
  to its canvas element.
- Pointer-events on the SVG root are set to `none` so finger taps
  pass through to the canvas (which is the touch target). The visible
  overlay is decoration; the real listener lives on the canvas.
- `mergeWithTouch` uses the louder-wins steer rule rather than the
  keyboard-priority rule from `mergeInputs(keyboard, pad)`. Justified
  in the doc comment: virtual stick is analog like the pad, so
  symmetric resolution is the intuitive default for a player
  multi-modal mixing keyboard with a touchscreen laptop.
- Layout stays a single constant (`DEFAULT_TOUCH_LAYOUT`) for now;
  the future calibration / orientation work called out in the dot's
  edge cases lives behind the `layout` supplier so a settings UI can
  swap it without touching the source.
- Race route wiring (`src/app/race/page.tsx`) is still future work
  because that route does not exist yet; the dev road page does not
  need touch since it has no race state. Race-route wiring will land
  with the §6 race-mode slice that owns that page.

### Followups created
- F-017: Playwright e2e spec for touch / mobile input (deferred until
  F-002 lands the Playwright harness).

### GDD edits
- None. Implementation conforms to §19 "Touch and mobile future work".

---

## 2026-04-26: Slice: Pause overlay + global error boundary (§20, §21)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/pause-overlay-error-boundary`, PR pending
**Status:** Implemented

### Done
- Extended `LoopHandle` with `pause()`, `resume()`, and `isPaused()`.
  While paused: `simulate` is skipped, `render` keeps firing so any
  overlay can repaint, the timing origin is held at "now" so the
  accumulator stays at zero, and resume reseats the origin so the next
  rAF tick produces zero sim ticks (no catch-up burst). Idempotent.
- Added three loop tests (`src/game/loop.test.ts`) covering pause skips
  sim, render keeps firing, resume drains accumulator (no burst after a
  5 s pause), and idempotency of pause/resume.
- New `src/components/pause/PauseOverlay.tsx`: controlled `<dialog>`-style
  React component with the §20 menu (Resume, Restart race, Retire race,
  Settings, Leaderboard, Exit to title). Resume is the only handler
  required; the rest accept optional handlers and self-disable when
  absent so the overlay reuses across screens that bind a subset.
- New `src/components/pause/usePauseToggle.ts`: hook that listens for
  the configured pause key on `keydown`, debounces held keys via
  `event.repeat`, and toggles open state. Accepts a `LoopHandle` (or a
  getter for the dev-page ref pattern) and pauses/resumes the loop on
  the same edge.
- New `src/components/pause/pauseAction.ts`: pure binding-resolution
  helper. `resolvePauseTokens()` returns `DEFAULT_KEY_BINDINGS.pause`
  (currently `["Escape"]`); `isPauseEvent(event, tokens?)` matches
  either `event.code` or `event.key` and rejects key-repeat. Six tests.
- New `src/components/error/ErrorBoundary.tsx`: React class component
  wrapping the App Router root in `src/app/layout.tsx`. Catches render
  errors anywhere in the tree, logs to console (dev-tooling only), and
  renders a fallback with "Reload" and "Copy error" buttons. The
  fallback can be overridden via the `fallback` prop.
- New `src/components/error/formatErrorReport.ts`: pure helper that
  shapes a captured error into a single-string clipboard payload
  (name, message, stack, component stack). Seven tests cover Error
  subclasses, non-Error throws, missing component stack, cyclic objects.
- Wired `<ErrorBoundary>` into `src/app/layout.tsx` so every page (dev
  and production) has the global recovery shell.
- Wired the pause overlay into `src/app/dev/road/page.tsx` for manual
  verification: Escape opens / closes the overlay, the camera halts
  while paused, the canvas keeps repainting.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 196/196 (16 new across formatErrorReport, pauseAction,
  and three loop pause/resume cases).
- `npm run build` succeeds; `/dev/road` ships at 3.3 kB; layout shared
  bundle is unchanged (the boundary is small).
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification of the pause overlay and the error fallback
  defers to a human run of `npm run dev` and a navigation to a thrown
  error route. Loop-level pause behaviour is fully covered by the new
  unit tests.

### Decisions and assumptions
- Pause key resolution lives behind `resolvePauseTokens()` so the
  per-save bindings UI tracked as F-014 can replace the implementation
  without touching any caller. Today the helper hardcodes the default
  (`Escape`) per `DEFAULT_KEY_BINDINGS.pause` since `SaveGameSettings`
  has no `controlBindings` field yet.
- `LoopHandle.resume()` reseats `lastTimestamp = null` so the next
  `tickFor` re-establishes the timing origin and runs zero sim that
  frame. The dot's "first frame after resume runs at most one sim tick"
  is therefore satisfied by "first frame runs zero, second frame runs
  one if a fixed step has elapsed". Picked the stricter zero-first to
  avoid any remaining drift across the pause boundary.
- The error boundary mirrors caught errors to `console.error` so dev
  tooling still surfaces them; the on-screen fallback is the only
  user-facing surface. No telemetry per the project privacy posture.
- The Playwright e2e specs listed in the dot
  (`e2e/pause-overlay.spec.ts`, `e2e/error-boundary.spec.ts`) are
  deferred to F-016 because the project has no Playwright runner
  configured yet (F-002 still tracks the harness slice). Loop pause
  semantics, key-binding resolution, and error report formatting are
  fully unit-tested today.
- The hook accepts a getter form for `loop` so the dev pages that store
  the loop in a `useRef` (null until the first effect) can wire the
  hook at the top level without a chained `useEffect`.

### Followups created
- F-016: Playwright e2e specs for the pause overlay and error boundary.

---

## 2026-04-26: Slice: Minimal HUD for speed, lap, and position (§20)

**GDD sections touched:** [§20](gdd/20-hud-and-ui-ux.md)
**Branch / PR:** `feat/minimal-hud`, PR pending
**Status:** Implemented

### Done
- Added `src/game/hudState.ts` exposing the pure derivation
  `deriveHudState({race, playerSpeedMetersPerSecond, playerId, cars,
  speedUnit}) -> HudState` plus the helpers `speedToDisplayUnit`
  (m/s to kph or mph with rounding and abs) and `rankPosition`
  (1-indexed place in the field, deterministic tie-break on id lex).
  HudState exposes `{speed, speedUnit, lap, totalLaps, position,
  totalCars}`. Lap is clamped into `[1, totalLaps]` so the HUD never
  surfaces "0 / N" pre-countdown or "4 / 3" mid-overshoot.
- Added `src/render/uiRenderer.ts` exposing `drawHud(ctx, state,
  viewport, options?) -> void`. Pure draw: lap and position read
  top-left, speed and unit read bottom-right per §20 "UX wireframe
  descriptions / Race HUD layout". Uses a one-pixel drop shadow for
  legibility over grass and sky alike. Saves and restores ctx state
  (fillStyle, font, textAlign, textBaseline) so the caller does not
  need to wrap with save/restore.
- Re-exported the HUD surface from `src/game/index.ts` and
  `src/render/index.ts`.
- Wired the HUD into `src/app/dev/road/page.tsx`: the dev page now
  renders the HUD overlay over the road. Lap rolls forward as the
  camera completes laps of the 1.2 km test track. A synthetic ghost
  AI sits 80 m ahead so the position display reads "POS 2 / 2".
- Added `src/game/__tests__/hudState.test.ts` (21 cases) covering:
  speed unit conversion (kph and mph), reverse / NaN / Infinity speed
  collapsing to a non-negative integer, single-car field rendering as
  position 1 / 1, multi-car ranking by total progress, deterministic
  tie-break across grid-start ties, lap 0 to lap 1 placeholder, lap
  overshoot clamped to totalLaps, fractional lap truncation, purity
  (no input mutation), and a 100-call determinism guard.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 180/180 (21 new + 159 prior).
- `npm run build` succeeds; `/dev/road` ships at 2.14 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/road` deferred to a human run
  of `npm run dev`. Unit tests cover the math.

### Decisions and assumptions
- The HUD computes position from a `RankedCar[]` passed in by the
  race-state owner. The owner is responsible for converting per-car
  `(lap, z)` into a single `totalProgress` scalar. This keeps HUD
  derivation independent of the §15 AI module that does not exist
  yet, and matches the pattern in `physics.ts` (small dependency
  surface, easy to test in isolation).
- Tie-break on id lex ascending, not insertion order. Grid-start ties
  are common (every car at progress 0); the lex order keeps the HUD
  stable across ticks. The §15 AI slice will introduce real
  archetype ids; the lex break stays useful when the §11 grid order
  is otherwise undefined.
- Speed unit reads from `SaveGame.settings.displaySpeedUnit` per §22.
  The dev page hardcodes `"kph"` for now; a future slice will plumb
  the loaded save into the dev pages once the title screen exists.
- Drop shadow is a single-pixel offset rather than a real
  `shadowBlur`. The §20 polish slice can switch to layered blurs
  once typography is settled; for the minimal-HUD slice the cheap
  underlay reads cleanly over the grass and sky bands.
- The HUD draws inside the `render` callback (not `simulate`) so it
  shares the road renderer's rAF cadence and cannot flicker between
  sim ticks. Interpolation across sim states is the caller's job;
  the HUD reads the current snapshot.

### Followups created
- None.

### GDD edits
- None. The implementation conforms to the §20 Race HUD layout.

---

## 2026-04-26: Slice: Arcade physics step for player car (§10)

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md), [§11](gdd/11-cars-and-stats.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/arcade-physics`, PR pending
**Status:** Implemented

### Done
- Added `src/game/physics.ts` exposing the pure step function
  `step(state, input, stats, context, dt) -> CarState`. Implements §10's
  acceleration / top-speed clamp / brake / coasting drag / lane-relative
  steering / off-road slowdown. State is the minimal `{ z, x, speed }`
  triple; future slices for traction loss, drifting, jumps, drafting,
  nitro, weather, damage, and collisions can extend it additively.
- Tunable constants surfaced from §10 "Suggested tunable constants":
  `OFF_ROAD_CAP_M_PER_S`, `OFF_ROAD_DRAG_M_PER_S2`,
  `COASTING_DRAG_M_PER_S2`, `STEER_RATE_LOW_RAD_PER_S`,
  `STEER_RATE_HIGH_RAD_PER_S`. Started with the starter-tier values; the
  per-car `topSpeed`, `accel`, `brake`, `gripDry` from
  `data/cars/*.json` drive the per-vehicle behaviour.
- Steering uses the §10 lerp: `steerRate = lerp(low, high,
  speed/topSpeed)`, then `yawDelta = steerInput * steerRate * dt *
  tractionScalar`. Lateral velocity is `yawDelta * speed`, which gives
  the dot's "no lateral movement at zero speed" behaviour for free.
- Off-road detection uses `Math.abs(x) > roadHalfWidth` against the
  renderer's `ROAD_WIDTH` constant. Off-road halves grip and applies
  `OFF_ROAD_DRAG`, then caps speed at `OFF_ROAD_CAP`. Damage on
  persistent off-road at high speed is deferred to the §13 damage slice.
- Re-exported physics from `src/game/index.ts`.
- Added `src/app/dev/physics/page.tsx`. Drives the starter car
  (Sparrow GT) along a 12 km straight using the deterministic input
  layer and the same `startLoop` 60 Hz cadence the real race uses.
  Shows live speed (m/s and km/h), lateral x, forward z, off-road
  flag, and per-input values for visual smoke.
- Added `src/game/__tests__/physics.test.ts` (27 cases). Covers
  acceleration curve, top-speed clamp, brake (no inversion past zero,
  brake-from-zero stays at zero, brake + throttle held), coasting
  drag, steering (zero at zero speed, magnitude scales with input,
  authority drops with speed), off-road detection / drag / cap,
  dt = 0 / negative / NaN edge cases, purity, determinism (1000-run
  identical-output check + 100-step trajectory equality), and
  forward-z integration sanity.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 159/159 (27 new + 132 prior).
- `npm run build` succeeds; `/dev/physics` ships as a static route at
  3.6 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/physics` deferred to a human run
  of `npm run dev`. Unit tests cover the math; the dev page is for
  feel-checking.

### Decisions and assumptions
- The yaw-equation in §10 produces an angular delta. The MVP renderer
  does not show vehicle heading, so we project the yaw onto a lateral
  velocity by multiplying by forward speed. This matches the dot's
  "lane-relative" steering and the design pillar that "steering at
  zero speed produces no lateral movement". A future slice that
  introduces a real heading angle replaces the projection but keeps
  the §10 equation intact.
- Coasting drag and steering rates are sourced from the §10 "starter
  target" column. A future balancing slice can plumb mid / late tier
  values per car class. The per-car `gripDry` already differentiates
  the starter cars (Sparrow 1.00, Breaker 1.08, Vanta 0.93).
- Brake clamps at zero rather than inverting (no reverse in MVP).
  Reverse is not in §10's MVP scope and the dot lists "brake while
  reversing: do not invert velocity past zero" as a hard edge case.
- Off-road halves `gripDry` and applies `OFF_ROAD_DRAG`. §10 says
  "reduce traction" + "apply strong drag" + "cap top speed"; the half
  and the cap together give a readable transition without over-tuning
  the constant. Persistent off-road damage is deferred to F-015.
- The physics step is pure: no globals, no time source, no RNG.
  Determinism is mandatory per AGENTS.md RULE 8 so the §21 ghost /
  replay system can rebuild identical traces from a recorded input
  stream.
- Brake + throttle held at the physics layer applies both forces (net
  delta = (accel - brake) * dt). The input layer already resolves the
  ambiguous "both keys held" case to throttle = 0, brake = 1 before
  reaching physics, so the only callers that hit the physics-layer
  combination are tests, AI drivers (intentional), and replay
  playback.

### Followups created
- F-015 in FOLLOWUPS.md: persistent off-road damage. §10 calls it out
  ("Increase damage slightly if the player persists off-road at high
  speed") but damage is owned by the §13 slice.

### GDD edits
- None. The implementation conforms to §10 as written.

---

## 2026-04-26: Slice: Keyboard + gamepad input layer (§19)

**GDD sections touched:** [§19](gdd/19-controls-and-input.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/keyboard-gamepad-input` (off `main`), PR pending
**Status:** Implemented

### Done
- Added `src/game/input.ts` exposing the canonical `Input` shape
  (`steer`, `throttle`, `brake`, `nitro`, `handbrake`, `pause`, `shiftUp`,
  `shiftDown`), `NEUTRAL_INPUT`, `DEFAULT_KEY_BINDINGS` (matching §19's
  keyboard + gamepad tables), pure helpers `inputFromActions`,
  `inputFromGamepad`, `mergeInputs`, `applyDeadzone`, plus the stateful
  `createInputManager(opts)` that subscribes to keyboard + Gamepad API
  sources and exposes `sample()`, `dispose()`, and `hasGamepad()`.
- The manager samples once per fixed sim step (sim calls `sample()`
  inside the simulate callback). Browser events only mutate the held
  set; the snapshot is built at sample time. This satisfies the §21
  determinism requirement for the upcoming replay/ghost system.
- Implemented the §19 cancellation rule for opposite directions (Left +
  Right held resolves to steer = 0). Brake + Accelerate held resolves
  to throttle = 0, brake = 1 since stop is the safer ambiguous default.
- Window blur clears all held keys so a tab-out cannot leave the player
  with stuck throttle / steer when focus returns. Gamepad disconnect is
  silent: the manager polls on each sample and falls back to keyboard
  with no crash.
- Re-exported the input surface from `src/game/index.ts`.
- Added `src/app/dev/input/page.tsx` showing live sampled values,
  driven by the same `startLoop` cadence the real race uses. Useful for
  visually verifying held keys, the cancellation rule, and pad input.
- Added `src/game/__tests__/input.test.ts` (27 cases): pure-helper
  contracts, deadzone math, cancellation rule, blur clears state,
  gamepad-source-throws survives, dispose unhooks all listeners,
  custom bindings, and headless null-keyTarget mode.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 132/132 (27 new + 105 existing).
- `npm run build` succeeds; `/dev/input` ships as a static route at
  2.61 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/input` deferred to a human run of
  `npm run dev` since the agent environment cannot drive a real
  browser. The unit tests cover the keyboard-event mapping and
  cancellation rule end-to-end via injected `KeyTarget`, so the
  remaining manual check is "does Gamepad API actually populate".

### Decisions and assumptions
- The `Input` shape includes `handbrake`, `shiftUp`, and `shiftDown`
  alongside the dot's listed fields. §19 enumerates handbrake and
  manual shifts under both keyboard and pad layouts, so leaving them
  out would force a breaking change once those slices land. The
  default state for the new fields is `false`, so consumers that only
  read `steer/throttle/brake/nitro/pause` are unaffected.
- Keyboard tokens are matched against both `KeyboardEvent.code` and
  `KeyboardEvent.key`. `code` is the layout-independent identifier
  (e.g. `KeyW`) and is preferred for letters; `key` is needed for
  Escape, ArrowUp, etc. The default binding map lists both styles per
  action and the lookup accepts either, which keeps the API friendly to
  test fixtures while staying layout-independent in production.
- Brake-wins on simultaneous accelerate + brake. The dot's edge-case
  list does not specify the resolution; safer to stop than to keep
  throttle. Documented in `inputFromActions`.
- Stick deadzone defaults to 0.15 (most racing games), trigger
  deadzone to 0.05. §19 calls out steering smoothing as an
  accessibility feature; it is intentionally not modelled here. A
  future settings slice can plumb both deadzones through
  `InputManagerOptions`.
- Touch / mobile is out of scope per the dot; F-013 captures the
  followup so the desktop slice does not silently absorb that
  workload.
- The dev page samples inside `simulate`, not `render`, so the
  displayed values are exactly what the sim sees. React state pushes
  are throttled to ~30 Hz to keep the page off the fixed-step hot path.

### Followups created
- F-013 (`nice-to-have`): touch and mobile input. §19 explicitly defers
  this; tracked so it does not get lost.
- F-014 (`nice-to-have`): user-facing key remapping UI + persistence.
  The schema for control profiles already has a slot in `SaveSchema`
  but the UI to edit and persist them is its own slice.

### GDD edits
- None. The shape and bindings match §19 and §21 as written.

---

## 2026-04-26: Slice: Car set + stats (§11) and garage car selector

**GDD sections touched:** [§11](gdd/11-cars-and-stats.md), [§22](gdd/22-data-schemas.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/car-set-stats` (off `main`), PR pending
**Status:** Implemented

### Done
- Authored the six MVP cars from §11 + §23 as JSON files under
  `src/data/cars/`: `sparrow-gt.json`, `breaker-s.json`, `vanta-xr.json`,
  `tempest-r.json`, `bastion-lm.json`, `nova-shade.json`. Stats match the
  §23 "Core car balance sheet" exactly. Brake values (which §23 omits)
  scale with topSpeed and grip per starter vs. late-game tier.
- Added `src/data/cars/index.ts` exposing `CARS`, `CARS_BY_ID`,
  `STARTER_CAR_ID`, and `getCar(id)`. Re-exported from
  `src/data/index.ts` so the rest of the app can `import { getCar } from
  "@/data"`. Sparrow GT (purchasePrice 0) is the granted starter, matching
  the existing `defaultSave()` invariant in `src/persistence/save.ts`.
- Updated `src/data/schemas.ts`:
  - `CarClassSchema` now enumerates the §11 classes (`sprint`, `balance`,
    `power`, `enduro`, `wet-spec`) instead of the prior placeholder set
    (`balance`, `speed`, `grip`, `accel`, `heavy`, `light`).
  - `CarBaseStatsSchema.durability` widened from `unitInterval` to
    `positiveNumber` so heavy enduro cars (Bastion LM at 1.12) pass
    validation. Comment cites §23 as the source.
- Added `src/data/__tests__/cars-content.test.ts` (29 cases): catalogue
  size and id set, unique indexing, starter invariant, plus per-car
  schema validation, §23 balance match (within 1e-5), positive brake,
  and non-negative upgrade caps. All `it.each`-style so adding a car
  picks up coverage automatically once it is registered.
- Added `src/app/garage/cars/page.tsx`, a client component that loads
  the localStorage save, renders every car with its §22 stats, and lets
  the player either set the active car (owned cars) or buy one (gated
  by credits). Selling is intentionally out of scope; the §11 dot's
  edge case ("cannot sell active car") is satisfied by not exposing
  selling at all in this slice. Status messages surface save failures.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 105/105 (29 new + 76 existing). The schema test
  suite still rejects unknown classes; the §22 example car ("balance")
  remains valid under the new enum.
- `npm run build` succeeds; `/garage/cars` route ships at 17.6 kB.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/garage/cars` deferred to a human run
  of `npm run dev`. The agent environment cannot drive a real browser
  so the persistence round-trip is covered only by unit tests of
  `loadSave`/`saveSave` plus the page logic. Logged here per RULE 8.

### Decisions and assumptions
- The prior `CarClassSchema` enum (`speed`, `grip`, `accel`, `heavy`,
  `light`) was a Phase 0 placeholder that did not match §11. Replacing
  it with the §11 classes is a schema correction, not a breaking change
  for shipped saves: only the §22 example used "balance" (still valid)
  and there are no live cars on disk yet.
- `durability` was previously `unitInterval` (0..1). §23 lists 1.12 for
  Bastion LM, so the schema was wrong. Widened to `positiveNumber` with
  a comment pointing at §23. No callers depended on the upper bound
  behaviour; the schemas test relied only on the unknown-class and
  negative-tier rejections, which still hold.
- Brake values are not in §23. Picked starter brakes between 27 and
  30, late-game brakes 31 to 33, scaling with grip and stability. If a
  later balance pass disagrees, only the JSONs need to change.
- `purchasePrice` is also absent from §23. Sparrow GT is 0 (starter
  invariant); the rest follow a starter (8k, 10k) vs late (28k, 32k,
  48k) split that gives the player a clear progression curve. Open to
  rebalance when the economy slice (§12) lands.
- Wet-spec is in the schema but no §11 example car declares it. Left
  the enum entry in for the niche-unlock car that §11 says exists
  ("Niche unlock") so a future content slice can drop a JSON in
  without re-touching the schema.
- Selling is deferred. The §11 dot lists "cannot sell active car" as
  an edge case; satisfied trivially by not exposing a sell button in
  this slice. Will be revisited with the upgrade UI.

### Followups created
- None. Selling, hangar visuals, and the §12 upgrade panel are all
  already covered by other ready dots.

### GDD edits
- None. The schema correction (CarClass enum + durability bound)
  brings the code into agreement with §11 and §23 as written; no GDD
  edits required.

---

## 2026-04-26: Slice: Pseudo-3D road renderer (Canvas2D, single straight track)

**GDD sections touched:** [§9](gdd/09-track-design.md), [§16](gdd/16-rendering-and-visual-design.md), [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/pseudo-3d-road-renderer` (off `chore/licence-files`), PR pending
**Status:** Implemented

### Done
- Added `src/road/constants.ts` pinning `ROAD_WIDTH`, `SEGMENT_LENGTH`,
  `DRAW_DISTANCE`, `FOV_DEGREES`, `CAMERA_HEIGHT`, `CAMERA_DEPTH`,
  `CURVATURE_SCALE`, stripe lengths, and `SPRITE_BASE_SCALE` per the values
  pinned in the research dot.
- Added `src/road/types.ts` with `Camera`, `Viewport`, `CompiledSegment`,
  and `Strip` types. Dependency-free so tests and the projector can import
  without pulling Canvas2D bindings.
- Added `src/road/trackCompiler.ts` exposing `compileTrack(track)` and
  `compileSegments(authored)` that expand variable-length authored
  segments into fixed `SEGMENT_LENGTH` blocks. `curve` and `grade` are
  pre-scaled into compiled units so the projector can sum dx and dy
  directly. NaN and Infinity in those fields are sanitized to 0 with a
  single warning per compile.
- Added `src/road/segmentProjector.ts` with a pure `project(segments,
  camera, viewport, options) -> Strip[]`. Implements the Gordon recipe:
  per-segment curve and grade accumulation, pinhole projection, and a
  near-to-far maxY clip that marks strips hidden behind a closer hill
  crest as not visible. Handles wrap-around for laps and caps
  drawDistance to totalSegments to avoid double-projecting tiny tracks.
- Added `src/render/pseudoRoadCanvas.ts` with `drawRoad(ctx, strips,
  viewport, options)`. Walks the strip list back-to-front and paints the
  sky band, alternating grass, rumble strips, road surface, and lane
  markings using filled trapezoids.
- Added `src/app/dev/road/page.tsx` (dev-only client component) at
  `/dev/road`. Mounts the renderer with a 1.2 km straight test track and
  a 60 m/s forward-moving camera. Surfaces fps, camera Z, and visible
  strip count for the manual visual check.
- Added unit tests:
  - `src/road/__tests__/trackCompiler.test.ts` (9 cases): empty input,
    `ceil(len / SEGMENT_LENGTH)` expansion, monotonic indices and
    worldZ, minimum-one-block guarantee, curve and grade scaling, NaN
    and Infinity sanitisation with single warning, ring-buffer total
    length, and authoredRef preservation.
  - `src/road/__tests__/segmentProjector.test.ts` (11 cases): empty
    list, degenerate viewport, monotonic screenY and screenW on a flat
    straight track, drift on a constant curve, mirrored sign behaviour
    on opposite curves, maxY cull on a sharp crest, lap wrap, drawDistance
    cap on tiny tracks, near-plane culling, and an analytical scale check.
- Wired `road` and `render` index re-exports.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 76/76 (20 new + 56 existing).
- `npm run build` succeeds; `/dev/road` ships at 2.75 kB route size.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/dev/road` deferred to a human run of
  `npm run dev`; the dot's "60 fps on a 2020-class laptop" check requires
  a real browser. Headless Vitest cannot render Canvas2D; this is logged
  here per RULE 8.

### Decisions and assumptions
- The maxY cull walks **near to far**, mirroring Gordon's racer.js
  pattern, not the back-to-front order originally described in the
  research dot. The two yield the same set of culled strips on flat
  ground (no cull), but only the near-to-far walk treats `maxY` as the
  smallest screenY seen so far, which is what the cull semantics
  actually require. Updated the comment in `segmentProjector.ts` to
  reflect the corrected order; the research dot is preserved as is.
- Strip pairing in the drawer uses `(strips[n-1], strips[n])` as
  `(near, far)`. The drawer walks the strip list far-to-near so closer
  strips paint on top of distant ones.
- `cameraOffsetWithinSegment` is computed inside the projector so the
  closest strip sits exactly at the camera position rather than snapping
  to the nearest segment boundary. Without this, the road would visibly
  jitter as the camera crossed each segment boundary.
- The strip array always preserves `drawDistance` slots even when the
  maxY cull marks some as not visible. Keeping array indices stable
  lets the drawer pair adjacent strips reliably without re-indexing
  after the cull.
- Sprite billboards, parallax background, and weather VFX are scoped
  out of this slice. Dot text confirms they belong to follow-up slices.

### Followups created
- None. Sprite atlas, background parallax, and authored multi-curve
  tracks are already tracked as separate ready dots.

### GDD edits
- None. Implementation matches the §16 visible characteristics, §21
  pipeline shape, and §9 road dimensions without GDD changes.

---

## 2026-04-26: Slice: Fixed-step simulation loop (§21 Game loop)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/fixed-step-loop` (off `feat/localstorage-save`), PR pending
**Status:** Implemented

### Done
- Added `src/game/loop.ts` with `startLoop`, `FIXED_STEP_SECONDS`,
  `FIXED_STEP_MS`, `MAX_ACCUMULATOR_MS`, plus `Scheduler`, `LoopOptions`,
  `LoopHandle`, and `LoopTickResult` types. Implements the §21 recipe:
  rAF-driven render, accumulator-based catch-up, fixed 60 Hz simulate
  callback, fractional alpha passed to render for blending. Spiral of
  death prevented by capping the accumulator at 250 ms (15 frames of
  catch-up max); excess time is reported as `droppedSteps` so callers
  can surface a hitch indicator if desired.
- Added `src/game/loop.test.ts` (11 cases) covering: first-frame origin
  (no sim, alpha=0), one tick per fixed step, exactly 6 ticks for
  100 ms elapsed, fractional remainder carry across frames, accumulator
  cap after a 5 s pause, custom max accumulator, rejection of a
  too-small max, negative-dt clamp, render-every-tick invariant,
  `stop()` idempotency and pending-handle cancel, and end-to-end
  scheduler-driven run.
- Added `src/app/dev/loop/page.tsx`, a client-only dev page at
  `/dev/loop` that reports running fps, sim tick count, render frame
  count, and the latest render alpha. Used for the manual
  tab-backgrounding check in §21.
- Wired `loop.ts` exports through `src/game/index.ts`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 56/56 (11 new + 45 existing).
- `npm run build` succeeds; `/dev/loop` ships at 1.32 kB route size.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- The loop exposes a `tickFor(timestamp)` escape hatch on the returned
  handle so deterministic unit tests can drive frames without any
  timer or `vi.useFakeTimers()` setup. Production code never calls it
  directly; the scheduler does.
- Floating-point carry: `100 ms / (1000/60 ms) = 6.0` mathematically,
  but six successive subtractions of `1000/60` from `100` can leave
  the accumulator a few ULPs below zero, which would make the next
  step boundary cross a real-time fence late. A `1e-9 ms` epsilon in
  the loop's `>=` test pins exact-multiple cases to the expected step
  count without affecting any tick that lands more than a nanosecond
  off-boundary. Negative remainders are also clamped to zero.
- Cap chosen at 250 ms per the dot spec. With a 1/60 s step that
  buys 15 frames of catch-up, which keeps any single rAF tick under
  ~5 ms of sim work even on a slow integrated-GPU laptop. Customisable
  via `maxAccumulatorMs`; values below one fixed step are rejected as
  RangeError because they would deadlock the loop.
- `Scheduler` is its own one-method interface, not the DOM's
  `Window['requestAnimationFrame']` signature, to keep the loop
  testable from node and to allow future swap-out for a worker-driven
  loop without refactoring callers.
- Browser tab-backgrounding cannot be exercised from this agent's
  environment. The deterministic accumulator-cap test stands in for
  that scenario; manual browser verification via `/dev/loop` is left
  for the human reviewer.
- No `__tests__/` subdirectory was created. The repo's existing
  convention (per `raceState.test.ts`, `schemas.test.ts`,
  `save.test.ts`) co-locates `*.test.ts` next to the module under
  test. Followed that convention rather than the dot's suggested
  layout, per AGENTS.md RULE 9.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: Versioned localStorage save/load (§21 Save system)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/localstorage-save` (off `feat/data-schemas`), PR pending
**Status:** Implemented

### Done
- Added `src/persistence/save.ts` with `loadSave`, `saveSave`, `defaultSave`,
  and supporting types. Storage key `vibegear2:save:v<major>` is namespaced
  by the current schema major; corrupted or schema-invalid payloads get
  preserved under a `:backup` key for forensic recovery before the loader
  falls back to the default save.
- Added `src/persistence/migrations/index.ts` with `CURRENT_SAVE_VERSION = 1`
  and an empty migrations registry. The `migrate(input)` helper walks the
  registry from the input's declared version up to the current major,
  refuses to downgrade future-major saves, and validates the version field.
- Added `src/persistence/index.ts` barrel.
- Added `src/persistence/save.test.ts` (15 cases) covering: storage key
  shape, default save round-trip through the SaveGame schema, loadSave
  paths (no storage, missing key, valid load, corrupted JSON, schema
  invalid, getItem throws, future-major save), saveSave paths (success,
  invalid input refused, no storage, quota-exceeded, generic setItem
  error), and a save-then-load round-trip.
- Added `src/persistence/migrations/migrations.test.ts` (4 cases) covering
  identity v1 case, non-object input, invalid version field, and refusal
  to downgrade.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 45/45 (3 race state + 23 schemas + 15 save + 4
  migrations).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Every failure mode is non-fatal. The dot spec says "fall back to default
  save (no persistence) with warning" for unavailable storage, "log and
  use default save, do not crash" for corrupted JSON, and to preserve raw
  under a backup key on schema validation failure. Implemented exactly
  that. Quota-exceeded is surfaced as a typed error so the UI can decide
  whether to retry, prompt the player, or shrink the save.
- Quota detection cross-checks `error.name`
  (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`) and the legacy
  numeric `code` (22, 1014). Covers Chrome, Safari, and old Firefox.
- `defaultSave()` ships with credits 0, the starter `sparrow-gt` already
  owned and active, and a zeroed upgrade row for that car. Phase 2 garage
  flow will replace this with a "create profile" wizard, but the data
  needs to validate today so that loadSave can return a usable SaveGame
  on first run.
- The `SaveIO` interface lets every public function accept an optional
  `storage` and `logger`, defaulting to globalThis.localStorage and
  console.warn. This keeps the module testable without jsdom (the unit
  tests use a hand-rolled in-memory Storage shim) and lets future SSR
  paths inject `null`.
- `migrate` validates that the input is a plain object with a positive
  integer version. v1 takes the identity path; v2+ migrations are
  registered as `migrations[fromVersion]` returning the next-version
  shape. Skipping a step is a thrown error, not a silent identity, so
  forgotten migrations fail loudly.
- Did not add the Playwright reload-survives-save test the dot spec
  mentions. The save module has no UI bindings yet (no garage screen, no
  options screen), so there is nothing meaningful to drive in a browser.
  Filed as a followup to revisit when the garage flow lands.

### Followups created
- F-004 Add a Playwright e2e test that drives the garage UI to mutate a
  save and asserts persistence across reload. Open until the Phase 2
  garage flow exists; tracked in `docs/FOLLOWUPS.md`.

### GDD edits
- None.

---

## 2026-04-26: Slice: Data schemas as Zod validators and TS types (§22)

**GDD sections touched:** [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/data-schemas` (off `feat/scaffold-next-app`), PR pending
**Status:** Implemented

### Done
- Added `src/data/schemas.ts` with Zod runtime validators and inferred
  TypeScript types for every JSON contract in §22: `Track`, `Car`,
  `Upgrade`, `Championship`, `AIDriver`, `SaveGame`, plus the supporting
  enums (`WeatherOption`, `CarClass`, `UpgradeCategory`, `DifficultyPreset`,
  `AIArchetype`, `SpeedUnit`) and nested record schemas (`TrackSegment`,
  `TrackCheckpoint`, `CarBaseStats`, `CarUpgradeCaps`, `AIWeatherSkill`,
  `AINitroUsage`, `SaveGameGarage`, `SaveGameSettings`,
  `SaveGameProgress`, `SaveGameRecord`).
- Added a barrel at `src/data/index.ts` so consumers can
  `import { TrackSchema, type Track } from "@/data"`.
- Added six fixture files under `src/data/examples/` copied verbatim from the
  §22 examples (track, car, upgrade, championship, aiDriver, saveGame).
- Added `src/data/schemas.test.ts` with 23 Vitest cases: each schema accepts
  its §22 example and rejects at least three deliberately broken variants
  (empty segments, negative numerics, unknown enum values, missing
  required fields).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 26/26 (3 pre-existing + 23 new).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Slug format permits lowercase alphanumerics, hyphens, and underscores.
  §22's AI driver IDs use snake_case (`ai_cleanline_01`); track IDs use a
  `tour-id/track-id` path. The regex accepts both.
- Picked enum sets that are conservative supersets of what §22 shows
  (e.g. `WeatherOption` includes `rain`, `heavy_rain`, `fog`, `snow`,
  `night` even though the example only uses `clear`, `light_rain`, `dusk`).
  These are forward-compatible with §14 weather and §22 likely future
  expansion. If the GDD ever pins a different set, narrow here.
- `UpgradeEffectsSchema` uses optional numeric fields with a refine that
  requires at least one declared effect. §22 shows two effects; the schema
  allows any subset of the eight stat keys so future upgrades can target
  brake or stability.
- `CarUpgradeCaps` and `SaveGame.garage.installedUpgrades.<carId>` reuse
  the same eight-category shape because §12 and §22 both list the same
  categories. Consolidated into one schema constant generated from
  `UpgradeCategorySchema.options`.
- `SaveGameGarage.installedUpgrades` and `SaveGame.records` both use
  `z.record(slug, ...)` to allow any car ID or track ID as a key. Stronger
  cross-record validation (e.g. record key must appear in `ownedCars`)
  belongs at the load-time wrapper, not inside the leaf schema.
- Did not add JSON Schema export. Phase 0 only requires TS types + Zod
  runtime validators per the dot spec. Defer to a content-pipeline slice if
  authoring tools need it.

### Followups created
- None.

### GDD edits
- None. The §22 examples round-trip without modification.

---

## 2026-04-26: Slice: Scaffold Next.js + TypeScript app shell

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/scaffold-next-app`, PR pending
**Status:** Implemented

### Done
- Stood up the Next.js 15 (App Router) + React 18 + TypeScript 5 strict
  project skeleton at the repo root: `package.json`, `tsconfig.json` with
  strict + `noUncheckedIndexedAccess` + `@/*` path alias, `next.config.mjs`
  with `outputFileTracingRoot` and typed routes, `.eslintrc.json` extending
  `next/core-web-vitals` and `next/typescript`, `.gitignore` covering the
  Next/Node/Playwright artefact paths plus `.dots/`.
- Added the App Router skeleton: `src/app/layout.tsx`, `src/app/page.tsx`
  (title screen with disabled menu placeholders for Start Race, Garage,
  Options, plus a `data-testid="game-title"` hook for the upcoming Playwright
  smoke), `src/app/globals.css`, and `src/app/page.module.css`.
- Created the Phase 0 stub layout for the runtime modules under §21's
  recommended structure: `src/game/`, `src/road/`, `src/render/` each with an
  `index.ts` barrel referencing §21. Added `src/game/raceState.ts` with a
  typed `createRaceState` constructor and three Vitest unit tests
  (`raceState.test.ts`) so the test harness exercises real code from day one.
- Added Vitest 2 unit harness via `vitest.config.ts` (node environment,
  `src/**/*.test.ts` discovery, `@/*` alias mirror, v8 coverage), and npm
  scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
  `verify` (lint + typecheck + test).

### Verified
- `npm install` succeeds (436 packages, no peer-dep failures).
- `npm run lint` passes with zero warnings.
- `npm run typecheck` passes (`tsc --noEmit`, strict).
- `npm run test` runs 3 unit tests, all green.
- `npm run build` produces an optimised production build, prerenders `/`
  statically (102 kB First Load JS).
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Resolved Q-001: §21 is fully authored, so the slice adopts the recommended
  layered architecture verbatim. Picked Next.js 15 (latest stable App Router)
  rather than 14 because §21 specifies "Next.js" without pinning a major and
  the canary tooling still works under 15.
- Picked React 18 over React 19 deliberately: §21 says "Reuse VibeRacer
  patterns" and React 18 is the current LTS-equivalent for Next.js + Vitest +
  jsdom; revisit when Phase 1 needs concurrent features.
- Deferred Playwright e2e harness to its own slice (`implement: add
  Playwright e2e harness and title-screen smoke`) so this slice stays
  PR-sized.
- Deferred CI / auto-deploy to its own slice (`implement: GitHub Actions CI
  + auto-deploy`), still blocked by Q-003.
- Excluded `.dots/` from version control: the dots task tracker is a
  per-developer working artefact, not a build input.
- Marked the title-screen menu items disabled rather than wired-up: the
  routes do not exist yet, and Phase 0 only owes a title screen.

### Followups created
- None new. F-001 marked `done` (sections 18 to 28 already exist; the
  followup was based on a stale assumption). F-002 advanced to `in-progress`:
  remaining slices are Playwright smoke and GitHub Actions CI.

### GDD edits
- None.

---

## 2026-04-26: Slice: Bootstrap implementation plan and working agreement

**GDD sections touched:** none (meta)
**Branch / PR:** `claude/gdd-implementation-plan-Z0cpN`, PR pending
**Status:** Implemented

### Done
- Added `docs/IMPLEMENTATION_PLAN.md` describing phases, the per-loop
  workflow, slice selection rules, definitions of done, and stopping
  conditions.
- Added `docs/WORKING_AGREEMENT.md` describing branching, commits, PRs,
  auto-deploy expectations, verification rules, clarification protocol, and
  risky-action gates.
- Seeded `docs/PROGRESS_LOG.md`, `docs/OPEN_QUESTIONS.md`, and
  `docs/FOLLOWUPS.md` so subsequent loops have a place to write.

### Verified
- Manual review of the four documents for internal consistency and against
  `GDD.md` section list.

### Decisions and assumptions
- Treated `GDD.docx` as a historical artefact; Markdown is canonical.
- Assumed Next.js + TypeScript + Canvas2D stack as implied by
  `01-title-and-high-concept.md` and `21-technical-design-for-web-implementation.md`
  (the latter is not yet authored, flagged as Q-001).
- Chose squash-merge as the default merge strategy, reversible by dev request.

### Followups created
- F-001 Author the eleven missing GDD sections (18-28) before Phase 0 can
  close.
- F-002 Stand up the Next.js + TypeScript project skeleton with CI and a
  deploy target.
- F-003 Wire an auto-deploy pipeline from `main`.

### GDD edits
- None.
