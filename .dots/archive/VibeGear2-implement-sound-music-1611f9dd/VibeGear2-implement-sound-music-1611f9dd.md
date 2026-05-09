---
title: "implement: sound + music systems per §18"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:33.841504-05:00\\\"\""
closed-at: "2026-04-29T09:05:14.737460-05:00"
close-reason: "Implemented §18 audio runtime, SFX, weather stems, and race music intensity stem assets and runtime across PRs #86-#90."
---

## Description

Build the audio layer using Web Audio API. Two modes: procedural (oscillators, noise) and stem-based (preloaded buffers). Wire engine pitch to player speed, surface impact SFX to damage events, and play region-themed music in the menu and during races.

## Context

Phase 4 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/18-sound-and-music-design.md`. Per `docs/gdd/21-technical-design-for-web-implementation.md`, the audio pipeline supports both procedural and sample-stem modes with metadata-driven mixing.

## Affected Files

- `src/audio/engine.ts` (new): engine pitch model
- `src/audio/sfx.ts` (new): impact, countdown, menu hover
- `src/audio/music.ts` (new): region-themed loops
- `src/audio/mixer.ts` (new): master / music / sfx levels driven from save settings
- `src/audio/__tests__/engine.test.ts` (new): pitch-to-speed mapping is monotonic
- `src/data/audio/*.json` (new): mixing metadata

## Edge Cases

- AudioContext suspended (no user gesture yet): defer creation until first input.
- Audio disabled in save settings: every audio call is a no-op.
- Page visibility hidden: pause music, mute SFX.

## Verify

- [ ] `engine.pitchFor(speed)` is strictly monotonically increasing for `speed in [0, topSpeed]` (unit test samples 100 speeds).
- [ ] `mixer.resolve({master, music, sfx})` returns gain values whose products match `master * music` and `master * sfx` within `1e-6`; covers boundary values 0, 0.5, 1.0.
- [ ] AudioContext suspended (no user gesture): `engine.start()` and `sfx.play(...)` are no-ops without throwing; first call after a `click` event resumes the context (Playwright e2e: click "Start", assert `audioContext.state === "running"`).
- [ ] Audio disabled in save settings: spies on `audioContext.createBufferSource` and `createOscillator` record zero calls during a 5-second scripted race.
- [ ] Page visibility hidden: `document.hidden = true` plus `visibilitychange` event leaves `audioContext.state === "suspended"` and music gain at 0.
- [ ] Engine pitch under acceleration: drive `/race` from `0` to `topSpeed`; sampled oscillator frequency every 250 ms matches `pitchFor(speed)` within 1%.
- [ ] Impact SFX: scripted collision fixture triggers exactly one impact playback within one tick of the damage event (assertion via spy on the impact source).
- [ ] Region music: load a track in `velvet-coast`, switch to another region, mixing metadata file in use changes accordingly (read from `audio/state.activeRegion`).
- [ ] Settings page (from `implement-hud-ui-6c1b130d`) sliders persist master / music / sfx levels independently and rehydrate on reload.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/audio src/data/audio` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 15, researcher pass)

The spec leaves the audio module's runtime contract underspecified: there is no `src/audio/` directory in the codebase, no `AudioSettings` field in `SaveGameSettings`, no defined Region enum, and `pitchFor` has no formula. An implementer would have to invent the central plumbing.

Concrete decisions to add to this dot before implementation begins:

1. **`SaveGameSettings` has no audio fields.** `src/data/schemas.ts` `SaveGameSettingsSchema` does not declare `master`, `music`, or `sfx` levels. The verify step "Settings page sliders persist master / music / sfx levels independently and rehydrate on reload" cannot pass against the current schema. Either:
   - extend `SaveGameSettingsSchema` here to add `audio: { master: unitInterval, music: unitInterval, sfx: unitInterval, audioEnabled: boolean }`, plus a v2 migration, OR
   - add an explicit `blocks: VibeGear2-implement-savegamesettings-b948015a` (the SaveGameSettings expansion dot already exists at `.dots/VibeGear2-implement-savegamesettings-b948015a.md`).
   Pick the second; that dot is the right home for the schema bump.

2. **No `Region` enum exists.** `engine.start()`, `music.regionFor(region)`, and the verify step "load a track in `velvet-coast`" all assume a `Region` type / value set. `src/data/schemas.ts` only has `tourId` (a slug) on `Track`; there is no `region` field on Track or Tour, and no Region enum. Pin one of:
   - (preferred) add a `region: slug` field to `TrackSchema` and a `RegionSchema` enum (`alpine`, `velvet-coast`, `desert`, `tundra`, `urban`, etc.). The `velvet-coast` example in the dot must come from somewhere.
   - or document that "region" is just `track.tourId` and rely on tour-level theme metadata. This avoids a schema change but tightly couples regions to tours.
   This decision belongs to `tour-region-d9ca9a4d` first; add `blocks: VibeGear2-implement-tour-region-d9ca9a4d` to this dot.

3. **`pitchFor(speed)` has no formula.** "Strictly monotonically increasing" is necessary but not sufficient. Pin a formula:
   ```ts
   // Engine pitch model: idle to redline, exponential rise then plateau.
   // ratio = clamp(speed / topSpeed, 0, 1.1) // overrun allowed
   // pitchHz = idleHz + (redlineHz - idleHz) * (1 - exp(-3 * ratio))
   const IDLE_HZ = 80;
   const REDLINE_HZ = 320;
   ```
   The exponential rise gives the expected "rev" feel without requiring a real gear model (the §18 GDD calls out "engine idle / low / mid / high"; this is the analog approximation until the per-car gear curves land).

4. **AudioContext lifecycle is not pinned.** The dot says "defer creation until first input". Pin where the singleton lives. Recommend:
   - `src/audio/context.ts` exports `getAudioContext(): AudioContext | null` and `ensureAudioContext(): AudioContext`. The first returns the existing context or `null`; the second creates one (on first call) and `resume()`s it.
   - The pause overlay's "Resume" button is a natural first user gesture; wire `ensureAudioContext()` to its onClick. Otherwise wire to the title-screen "Start" button (already exists in `src/app/page.tsx`).
   - `engine.start()` and `sfx.play()` early-return if `getAudioContext()` is null, so unit tests in node (no AudioContext) become trivial.

5. **"Audio disabled in save settings" cannot be satisfied without runtime hookup.** The verify says "spies on `audioContext.createBufferSource` and `createOscillator` record zero calls during a 5-second scripted race". To enforce this, `mixer.resolve` must short-circuit before the buffer is created. Pin: `mixer.resolve` returns `null` when `audioEnabled === false`, and every `engine` / `sfx` / `music` call early-returns on `null`.

6. **Region music asset shape is missing.** "Each region theme should have base groove, motif, instrumentation accent, weather stem option" (§18). The dot says `src/data/audio/*.json` (new): mixing metadata. Pin the schema:
   ```ts
   export const AudioMetadataSchema = z.object({
     region: slug,
     baseGroove: z.string().min(1),         // file path
     motif: z.string().min(1),
     accent: z.string().min(1),
     weatherStems: z.record(WeatherOptionSchema, z.string().min(1)).optional(),
     bpm: positiveNumber,
     intensityLayers: z.array(z.string().min(1)).min(2).max(3),  // §18 "2 to 3 intensity layers"
   });
   ```
   Add `src/data/schemas.ts (update)` to Affected Files.

7. **Procedural vs stem-based mode toggle is not pinned.** The dot says "two modes: procedural (oscillators, noise) and stem-based (preloaded buffers)". An implementer must know which is active. Pin:
   - `audio.mode: "procedural" | "stem"` is read from the global `audio.config.ts` (or env-driven default).
   - For v0.1 ship `procedural` only (no stems checked into the repo per §18 "Never include 'temporary homage' music in the repo" and the absence of an asset pipeline). The placeholder-audio dot (`VibeGear2-implement-placeholder-audio-94594c41`) owns the stem assets; add `blocks: VibeGear2-implement-placeholder-audio-94594c41` for stem-mode work.
   - Engine + SFX use procedural primitives that ship today.

8. **`page.visibility` handling is not pinned.** "Pause music, mute SFX". §18 implies music continues smoothly across menu / race; tab-out is different. Pin:
   - On `visibilitychange` with `document.hidden === true`: call `audioContext.suspend()` (parks the entire audio graph; resumes on focus).
   - This matches the `LoopHandle.pause()` semantics and is one line.
   - Verify by spying on `audioContext.state` after dispatching `visibilitychange`.

9. **No `src/audio/__tests__/` test for `mixer.ts`, `sfx.ts`, or `music.ts`.** Affected Files only lists `engine.test.ts`. Plan also: `mixer.test.ts` (gain composition, audio-disabled short-circuit), `sfx.test.ts` (impact spy on `createBufferSource`, countdown timing), `context.test.ts` (singleton, defer-until-gesture). Five test files, ~30 cases total.

10. **"Region music" verify step is brittle.** "load a track in velvet-coast, switch to another region" requires (a) a region field on Track (decision 2), (b) at least two metadata JSONs in `src/data/audio/`, (c) a way to switch tracks at runtime. The implementer cannot deliver this in one PR if regions are not yet on Track. Pull this out into a sibling dot or defer to the tour-region dot.

11. **Missing AGENTS.md alignment.** The Affected Files list `src/audio/__tests__/engine.test.ts`. AGENTS.md RULE 9 (per `physics.test.ts`, `loop.test.ts`, `input.test.ts`) is co-locating tests next to their module. Update the path to `src/audio/engine.test.ts`. Apply same fix to all other test paths in this dot.

12. **Determinism contract is missing.** §21 calls out determinism for ghost / replay (which run physics from recorded inputs). Audio runs in real time and **does not need to be deterministic**, but `engine.pitchFor(speed)` must be pure (no AudioContext required). Add an explicit "engine.pitchFor is pure: same input -> same output, no side effects" verify line.

13. **FOLLOWUPS impact.** Add F-NNN: "Web Audio reduced-motion / accessibility audio attenuation" if §18 lists accessibility constraints (it does not in the current text, but `docs/gdd/14-weather-and-environmental-systems.md` does have an "Accessibility options" block; ensure consistency by checking §18 once design lands the audio-accessibility table).

14. **Deps chain.** This dot's natural prerequisites in dependency order:
    - `seeded-deterministic-2ae383f2` (probably not needed for audio — drop)
    - `savegamesettings-b948015a` (needed for audioEnabled / levels)
    - `tour-region-d9ca9a4d` (needed for Region enum)
    - `placeholder-audio-94594c41` (needed only for stem mode; procedural ships first)
   Encode 2 and 3 as `blocks:` in the front-matter; mark stem-mode work as a follow-up if procedural ships first.
