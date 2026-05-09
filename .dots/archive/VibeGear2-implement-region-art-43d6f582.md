---
title: "implement: region art theme registry (palette / sky / props / weather / tunnel material / UI accent per region) per §17 §8"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:31.922570-05:00\\\"\""
closed-at: "2026-04-30T05:21:52.299443-05:00"
close-reason: "Merged PR #122, main CI green, CodeQL green, Vercel production deploy verified, production smoke passed, and region art theme registry shipped."
blocks:
  - VibeGear2-implement-palette-driven-d2e3857f
  - VibeGear2-implement-parallax-bands-c1bf44c4
  - VibeGear2-implement-mvp-track-0e1b2918
---

## Description

Author the region art theme registry per `docs/gdd/17-art-direction.md` "Region art themes" and `docs/gdd/08-world-and-progression-design.md` "Original tours" table. Each of the eight tours has a defined visual package: palette, sky treatment, road shoulder type, prop categories, weather presets, tunnel material set, UI accent color. Currently no dot owns the registry or the schema; `implement-palette-driven-d2e3857f` covers per-sprite palette swap but not the per-region palette set.

## Context

§17 names seven theme attributes per region. §8 lists eight tours with theme keywords (e.g. Velvet Coast = "Resorts, marinas, cliff roads / Clear, dusk, light rain / Onboarding"). Without a typed registry, every consumer (renderer, HUD accent, parallax loader, audio bus, mvp tracks) would re-pin its own region->theme map.

The registry is the data shape; consumers are:
- `palette-driven-d2e3857f` reads `regions[id].palette` to recolor sprites.
- `parallax-bands-c1bf44c4` reads `regions[id].sky` and `regions[id].mountains`.
- `tunnel-segments-...` reads `regions[id].tunnelMaterials`.
- `mvp-track-0e1b2918` references `regionId` per track JSON.
- `hud-ui-6c1b130d` reads `regions[id].uiAccent` for the HUD edge color.
- `weather-38d61fc2` validates that a track's `weatherOptions` is a subset of `regions[id].weatherPresets`.

## Affected Files

- `src/data/regions/<region-id>.json` (new, eight files): one per tour from §8. Each conforms to `RegionThemeSchema`.
- `src/data/regions/index.ts` (new): static-import barrel; `loadRegion(id)` returns the theme.
- `src/data/schemas.ts` (update): `RegionThemeSchema` Zod type:
  ```ts
  RegionThemeSchema = z.object({
    id: regionIdSlug,
    name: z.string(),
    palette: z.object({
      sky: hexColor,
      horizon: hexColor,
      road: hexColor,
      shoulder: hexColor,
      grass: hexColor,
      accent: hexColor,
    }),
    skyTreatment: z.enum(["clear", "overcast", "dusk", "night-neon", "snow", "fog", "desert-haze", "storm"]),
    roadShoulderType: z.enum(["sand", "guardrail", "concrete", "snowbank", "gravel", "neon-curb", "cliff-edge"]),
    propCategories: z.array(z.string()).min(1),
    weatherPresets: z.array(WeatherSchema).min(1),
    tunnelMaterials: z.array(z.string()).min(1),
    uiAccent: hexColor,
  });
  ```
- `src/data/__tests__/regions-content.test.ts` (new): every region validates; weatherPresets includes at least one option per §8 row; uiAccent meets §17 a11y contrast rule against the palette neutrals.
- `src/data/schemas.ts` (update): tighten `Track.regionId` to validate against the regions registry (existing `tourId` field renames or aliases).

## Pinned region themes (eight rows from §8)

| Region | Sky | Shoulder | Weather presets | UI accent |
| --- | --- | --- | --- | --- |
| velvet-coast | clear | guardrail | clear, dusk, light_rain | warm gold |
| iron-borough | overcast | concrete | overcast, fog | iron blue |
| ember-steppe | desert-haze | sand | clear, dust_storm | ember orange |
| breakwater-isles | storm | concrete | rain, heavy_rain | sea cyan |
| glass-ridge | snow | snowbank | snow, fog, dusk | ice cyan |
| neon-meridian | night-neon | neon-curb | rain, night_neon | magenta |
| moss-frontier | fog | gravel | rain, fog | moss green |
| crown-circuit | mixed | cliff-edge | clear, rain, fog, snow | gold |

Hex values pin in this dot; balancing-pass and design review may revise.

## Edge Cases

- A track JSON references a `regionId` that is not in the registry: schema validation rejects.
- A track's `weatherOptions[i]` is not in `regions[regionId].weatherPresets`: track content test fails.
- Modders add a new region: registry is data-driven, not enum-bound; modding loader (§26) appends entries.
- A11y high-contrast mode: the `uiAccent` color is overridden by a high-contrast palette in the renderer; the registry value remains the design default.

## Verify

- [ ] `RegionThemeSchema.safeParse(velvetCoast)` succeeds.
- [ ] All eight region JSONs validate.
- [ ] `loadRegion("velvet-coast").palette.sky` returns the pinned hex.
- [ ] Track content test: every track's `regionId` exists in the registry; every `weatherOption` is in `regions[regionId].weatherPresets`.
- [ ] UI accent contrast: every `uiAccent` against `palette.shoulder` meets WCAG 4.5:1 (`getContrastRatio` helper, deterministic).
- [ ] Determinism: `loadRegion` returns deep-equal output for repeated calls.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/data/regions src/data/schemas.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/17-art-direction.md` Region art themes
- `docs/gdd/08-world-and-progression-design.md` Original tours
- `docs/gdd/14-weather-and-environmental-systems.md` (weather presets per region)
- `docs/gdd/27-risks-and-mitigations.md` (Asset burden -> palette-driven reuse)
