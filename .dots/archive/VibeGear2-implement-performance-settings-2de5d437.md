---
title: "implement: performance settings (draw distance, sprite density, pixel ratio) per §27"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:45:26.068893-05:00\\\"\""
closed-at: "2026-04-29T20:34:37.258884-05:00"
close-reason: "Merged PR #112, main CI green, and production smoke passed at 6a52606."
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Wire the three named GDD §27 browser-performance knobs (draw distance, sprite density, pixel ratio cap) end-to-end: persisted save field, settings UI controls, runtime read in the renderer. Closes the GDD §27 "browser performance" mitigation.

## Context

GDD §27's browser-performance row demands "Adjustable draw distance, sprite density, pixel ratio caps." `implement-cross-browser-7cf643ce` covers the verification sweep but does not ship the user-facing knobs. `implement-hud-ui-6c1b130d` ships a settings UI for units / assists / audio levels but explicitly does not include performance controls. This dot fills the gap.

GDD §16 ("Performance targets" table) tiers devices by mid-range desktop, integrated laptop GPU, lower-end desktop, mobile. The runtime should provide an `auto` mode that detects rough device class and picks defaults, plus manual overrides for each knob.

`src/road/constants.ts` already defines `DRAW_DISTANCE`. This dot replaces the hard-coded constant with a runtime-readable `useGraphicsSettings()` accessor that reads from the save / settings layer and falls back to the constant.

Depends on `implement-hud-ui-6c1b130d` (the settings page exists) and the persistence layer (already shipped per `src/persistence/save.ts`). Blocks `implement-tagged-release-b3d30084` because §27 mitigations must be live before v0.1.

## Affected Files

- `src/data/schemas.ts` (existing): extend `SaveGameSchema.settings` (or wherever the settings live in the schema) with a `graphics` sub-object: `{ drawDistance: 'low' | 'medium' | 'high' | 'ultra', spriteDensity: 0.25 | 0.5 | 0.75 | 1.0, pixelRatioCap: 1 | 1.5 | 2, mode: 'auto' | 'manual' }`.
- `src/persistence/migrations/index.ts` (existing): add migration step for the new field with sensible defaults (`mode: 'auto'`, derived defaults).
- `src/render/graphicsSettings.ts` (new): `useGraphicsSettings()` hook (or pure accessor for non-React render code) reading the persisted save and returning resolved numeric knob values: `{ drawDistanceSegments: number, spriteDensityFactor: number, devicePixelRatio: number }`. Includes `detectAutoTier()` heuristic using `navigator.hardwareConcurrency`, `devicePixelRatio`, and a quick offline canvas perf probe (deferred behind a flag if too slow).
- `src/render/pseudoRoadCanvas.ts` (existing): replace the hard `DRAW_DISTANCE` constant read with a per-frame read of the resolved value. Cap `dpr` to `pixelRatioCap`.
- `src/render/spriteAtlas.ts` (named in `implement-visual-polish-7d31d112`, may not exist yet at write-time): forward declare a `cullByDensity(sprites, factor)` hook so this dot only modifies what already exists. If `spriteAtlas.ts` is missing, this dot ships the per-frame draw-distance and pixel ratio knobs only and leaves a `// TODO when sprite atlas lands` comment for sprite density.
- `src/app/settings/page.tsx` (existing once `implement-hud-ui-6c1b130d` lands): add a "Graphics" section with three select dropdowns plus an "Auto / Manual" toggle.
- `src/render/__tests__/graphicsSettings.test.ts` (new): `detectAutoTier()` deterministic on stubbed `navigator`; resolved settings honour manual overrides; pixel ratio cap clamps actual `devicePixelRatio`.
- `e2e/graphics-settings.spec.ts` (new): change setting in UI, reload, change applied.
- `docs/PROGRESS_LOG.md` (existing): standard slice entry.

## Edge Cases

- `auto` mode must not reduce draw distance to a level that breaks gameplay (e.g. cars popping into view on top of the player). Set a minimum-segments floor of 30 segments regardless of tier.
- Pixel ratio cap of 1 on a 3x retina display: blurry but performant. Test the perceived quality manually; document the trade-off in the settings UI tooltip.
- Setting changes mid-race: apply on next frame for draw distance and sprite density; pixel ratio change requires a canvas resize (handle on next frame, no flicker).
- A user opens settings on a save that predates this dot: migration applies `mode: 'auto'` and the renderer behaves identically to before.
- `prefers-reduced-motion` media query: independent of this slice but should be respected by the VFX layer (called out in `implement-visual-polish-7d31d112`).

## Verify

- [ ] Manual test: switch each knob and observe the change at runtime.
- [ ] Vitest unit tests cover the schema migration and `detectAutoTier` deterministically.
- [ ] Playwright e2e: change a graphics setting, reload, verify the change persisted.
- [ ] Pixel ratio cap of 1 on a high-DPR test page reduces canvas backing-store size as expected.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/27-risks-and-mitigations.md` (browser-performance row).
- `docs/gdd/16-rendering-and-visual-design.md` ("Performance targets" table).
- `docs/gdd/21-technical-design-for-web-implementation.md` ("Performance constraints").
