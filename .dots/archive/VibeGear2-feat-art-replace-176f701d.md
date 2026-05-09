---
title: "feat(art): replace placeholder car SVGs with production-quality car art (6 cars × 4 damage tiers × 12 frames)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-05-01T03:27:00.808659-05:00\\\"\""
closed-at: "2026-05-02T08:29:46.897065-05:00"
close-reason: "Merged PR #165 with production car sprite sheets; PR CI, CodeQL, main CI, and production deploy verified at aa02f7d."
---

Every car SVG in public/art/cars/ is a procedurally-generated placeholder (literal aria-label "VibeGear2 placeholder art"). Body shapes are flat trapezoids; per-archetype distinction is just a hex-color swap in scripts/generate-placeholder-art.ts:46–53. The atlas plumbing (PR #131) and per-car FX routing (carSpriteCompositor.ts, carSprites.ts) are production-ready — the gap is the art itself.

GDD §17 art-direction lines 27–35 specify the visual language verbatim:
- compact, stylized sports coupes
- low polygon / high silhouette
- non-licensed
- readable at small screen scale
- color-customizable with decals optional later

GDD §17:68 specifies asset resolution: "Car sprites | 192×96 source, scaled in-engine".
GDD §17:59–62 specifies accessibility: 4.5:1 contrast, colorblind-safe damage indicators with shape support.

The atlas convention an artist MUST honor (from src/data/atlas/carSprites.ts:15–27 and carSprites.test.ts):
- Canvas: 768×384, viewBox "0 0 768 384"
- Per-frame: 64×32 pixels, pivot centered at (32, 16)
- 12 directional frames per damage tier, in skewX rotation steps [0, 4, 8, 12, 8, 4, 0, -4, -8, -12, -8, -4]
- 4 damage tiers (clean, dented, battered, totaled) at y rows 16, 48, 80, 144
- Special frames: brake at (0, 96), nitro at (64, 96), wet-trail and snow-trail at y=176
- Fallback: unknown sprite ids → sparrow_gt

Total volume per car: 4×12 directional + 4 special = 52 frames × 6 cars = 312 frames across 6 atlases.

Production scope:
1. Decide art pipeline: continue procedural with richer geometry, OR commission/source real SVG/PNG sheets, OR hybrid (procedural body + hand-crafted livery overlays). Recommendation: hand-authored SVGs per car that match the existing atlas layout exactly, kept in-repo as source-of-truth (no external dependency, tests stay deterministic).
2. Replace public/art/cars/{sparrow_gt,breaker_s,vanta_xr,bastion_lm,tempest_r,nova_shade}.svg with new art that honors the dimensions and frame layout above.
3. Update public/art.manifest.json with source/originality/license metadata for each new file (manifest validator at scripts/check-art-manifest.ts will enforce).
4. Update scripts/generate-placeholder-art.ts: either remove the per-car generators (if hand-authored takes over) OR add a --cars=… skip flag so procedural keeps working for any car not yet hand-authored.
5. Visual regression: add a Playwright screenshot test that captures /race for one canonical car on the MVP track and diffs against a baseline. (Existing e2e/race.spec.ts has the page setup to extend.)
6. Verify damage-tier reading still works: drive a car to >0.85 damage in a unit test (src/game/damage.ts has the threshold), assert carSpriteCompositor.ts picks tier 3.

Existing reusable code (no code changes needed if SVGs follow the layout):
- src/data/atlas/carSprites.ts — sprite-set lookup is data-driven; new SVGs slot in by id.
- src/render/carSpriteCompositor.ts — frame-switching logic (damage, brake, nitro, weather trail) is already correct.
- scripts/check-art-manifest.ts — validates every SVG is licensed + dated; will catch missing entries.
- src/data/atlas/carSprites.test.ts — frame-count assertions catch any sheet that misses required frames.

Acceptance criteria (production, not POC):
- Each of the 6 cars has a visually distinct silhouette readable at 64×32 rendered scale (per GDD §17:30 readable at small screen scale).
- Damage tiers 0–3 show clear visual differentiation per tier (not just color shift) — dent marks, crumple lines, broken glass, missing panels. Colorblind-safe per GDD §17:62.
- Brake-light frame and nitro-flame frame look obviously different from base.
- Wet-trail and snow-trail frames composite correctly with the existing weather render passes.
- All 6 atlases pass scripts/check-art-manifest.ts and src/data/atlas/carSprites.test.ts.
- New visual regression e2e captures a baseline; subsequent PRs that change car render get reviewed against it.
- No SVG > 50KB (procedural placeholders are ~7KB; hand-authored should fit comfortably under 50KB).
- High-contrast accessibility setting (PR #50) still produces a readable car silhouette.
- Per-car palette respects the data values declared in scripts/generate-placeholder-art.ts:46–53 — the autonomous loop has tuned UI/HUD around those colors, so the new art should remain in those families (or update palette references in lockstep).
