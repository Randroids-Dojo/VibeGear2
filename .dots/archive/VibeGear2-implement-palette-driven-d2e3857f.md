---
title: "implement: palette-driven sprite recolour system per §16 §27"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:45:30.046019-05:00\\\"\""
closed-at: "2026-04-30T03:41:08.721431-05:00"
close-reason: "Merged PR #120, main CI green, CodeQL green, Vercel production deploy verified, production smoke passed, and palette-driven sprite recolour shipped."
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Ship a palette-driven sprite recolour system: one master sprite atlas plus per-region palette JSON files that recolour shared sprites at runtime, plus a reserved-colour catalogue for systemic UI feedback. Closes the GDD §27 "asset burden" mitigation clause "palette-driven reuse".

## Context

GDD §27's asset-burden row names three mitigations: "palette-driven reuse, modular prop kits, background layering." `implement-visual-polish-7d31d112` covers parallax (background layering) and a sprite atlas (modular prop kits, in spirit). The palette-driven reuse system has no dot.

GDD §16 ("Color palette guidance") specifies five reserved systemic colours (amber for road-edge warnings, red for severe damage, cyan for wet grip UI, magenta or electric blue for nitro full, green and gold for clean PB / record celebration) that must NOT be used for region palettes. GDD §24 ("Asset list") expects "8 region backdrop packs". Without palette reuse, each region needs full bespoke sprite art (~80 to 120 props per region times 8 regions = 640+ unique sprites). With palette reuse, one set of 80 to 120 grayscale-or-indexed sprites is recoloured per region (a 5x to 8x asset budget reduction).

This is a renderer and data-pipeline slice, not a content slice. It ships the format, the runtime, and a small example. Per-region palette authoring lands later as content.

Depends on `implement-visual-polish-7d31d112` (the sprite atlas exists). Blocks `implement-tagged-release-b3d30084`.

## Affected Files

- `src/data/palettes/_schema.ts` (new): Zod schema for `RegionPalette`. Fields: `id`, `name`, `slots: { sky: HexColor, midHorizon: HexColor, nearTerrain: HexColor, propPrimary: HexColor, propSecondary: HexColor, propAccent: HexColor, roadEdge: HexColor, roadSurface: HexColor, fogTint: HexColor, ... }`. Reserved colours (amber, red, cyan, magenta or electric blue, green and gold) are NOT in the slot list and a runtime check rejects palettes that overlap them.
- `src/data/palettes/<region>.json` (new, eight files; or one example fixture if regions have not been authored yet): one palette per region, slot keys filled with hex colours.
- `src/render/paletteRecolour.ts` (new): runtime palette swap. Loads a grayscale-or-indexed sprite from the atlas, applies the active region palette to produce a recoloured `ImageBitmap`, caches by `(spriteId, paletteId)` key. Pure function: `recolour(sprite, palette) -> ImageBitmap`.
- `src/render/paletteCache.ts` (new): LRU cache of recoloured `ImageBitmap`s with a configurable max size (default 256). Evicts least-recently-used on overflow.
- `src/render/spriteAtlas.ts` (existing per `implement-visual-polish-7d31d112`): atlas entries flagged `recolourable: true` go through the palette recolour pipeline at draw time; non-recolourable entries draw raw.
- `src/render/pseudoRoadCanvas.ts` (existing): per-segment palette lookup based on the segment's region; pass to the sprite draw call.
- `src/render/__tests__/paletteRecolour.test.ts` (new): pixel-by-pixel recolour test against a fixture sprite; cache eviction test; reserved-colour rejection test.
- `docs/gdd/22-data-schemas.md` (existing): add a `RegionPalette` subsection if not already present; or note that the schema lives in `src/data/palettes/_schema.ts` and is re-exported through `src/data/schemas.ts`.
- `scripts/build-mods-index.ts` (existing per `implement-mod-loader-e9b8b51f`): if a mod ships a `palettes/` directory, validate each palette JSON the same way.

## Edge Cases

- A palette JSON whose hex colour overlaps a reserved-colour band (within a small tolerance, e.g. delta-E < 5 from amber): rejected at validation; loud error citing the slot and the reserved colour.
- A sprite tagged `recolourable: true` that contains pixels outside the indexed-palette range (i.e. a non-recolourable colour leaked in): warning at build time; sprite still draws but does not get recoloured.
- A region palette is missing a slot: validation fails with the missing slot name.
- Cache hit on the recoloured bitmap returns the cached bitmap directly (no recolour work). Hit-rate target: 99%+ in steady state.
- A palette JSON with `slots.sky === slots.nearTerrain` (would cause flat-look horizon): warning at validation, not error; the dev may want it.
- Browser support: `OffscreenCanvas` is the recolour target; fall back to a regular canvas for Safari versions that lack it. Document the fallback behaviour.

## Verify

- [ ] Pixel-comparison test passes between a fixture sprite and a hand-recoloured reference.
- [ ] Palette validation catches reserved-colour collisions and missing slots.
- [ ] Cache eviction works deterministically.
- [ ] Manual smoke: same sprite atlas drawn against two palettes in `/dev/road` looks distinct (region A vs region B).
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/27-risks-and-mitigations.md` (asset-burden row).
- `docs/gdd/16-rendering-and-visual-design.md` ("Color palette guidance").
- `docs/gdd/24-content-plan.md` ("Asset list").
- `docs/gdd/17-art-direction.md` (palette intent per region).
