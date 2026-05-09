---
title: "implement: placeholder art assets (cars, roadside props, HUD icons) + asset manifest per §17 §24"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T02:21:54.498064-05:00\""
closed-at: "2026-04-29T04:23:49.726765-05:00"
close-reason: "Completed placeholder art bank through region backdrops, car sheets, roadside props, HUD icons, effects, menu backgrounds, manifest checks, and coverage entries across PRs #80 to #83."
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
---

## Description

Author the placeholder art bank described in `docs/gdd/17-art-direction.md` and `docs/gdd/24-content-plan.md` Asset list. Ship as PNG sprites under `public/art/` with a JSON atlas + manifest. The art is intentionally placeholder (solid colors + simple shapes) so the renderer code in `implement-visual-polish-7d31d112` has something to load while final art is authored. Manifest doubles as the §26 "asset manifest" required by Contribution Guidelines.

This dot is a content slice, not a code slice. It produces the bytes; `implement-visual-polish-7d31d112` consumes them. `implement-palette-driven-d2e3857f` separately swaps colors over the same sprites.

## Context

`docs/gdd/24-content-plan.md` Asset list calls for: 6 car sets, 8 region backdrop packs, 80-120 roadside props, HUD icon set, menu backgrounds, effects sheets. v1.0 needs the full bank; this slice ships placeholder versions of all of them so the renderer never references missing files. Final art is authored in a later content pass.

`docs/gdd/26-open-source-project-guidance.md` requires every asset to declare original-or-licensed provenance and ship under CC-BY-4.0 (or CC0). Since these are placeholders the agent authors, they are CC0 with an originality statement in the manifest.

`docs/gdd/27-risks-and-mitigations.md` "Asset burden" risk is mitigated by palette-driven reuse + modular prop kits; the placeholder pass already follows that pattern (one base sprite per category, palette-swapped per region).

## Affected Files

- `public/art/cars/<car-id>/{idle,brake,turnLeft,turnRight}.png` (new, 6 car sets at low resolution): one sprite per starter and late-game car.
- `public/art/roadside/<prop-id>.png` (new, 80-120 placeholder props grouped by region): trees, signs, guardrails, buildings.
- `public/art/backdrops/<region>/sky.png` and `mountains.png` (new, 8 regions).
- `public/art/hud/{speedometer,lap,position,damage,minimap,weather}.png` (new HUD icon set).
- `public/art/effects/{flash,dust,sparks,rain,fog,snow}.png` (new effects sheets).
- `public/art/manifest.json` (new): full asset manifest per `docs/gdd/26-open-source-project-guidance.md`. Each entry has id, path, license, author, originality flag, dimensions, source-pipeline note ("agent-authored placeholder").
- `src/data/atlas/cars.json`, `src/data/atlas/roadside.json`, etc. (new or updated by `implement-visual-polish-7d31d112`): atlas frame metadata pointing at the new sprites.
- `scripts/check-art-manifest.ts` (new): a CI guardrail that scans `public/art/` and verifies every file is listed in the manifest with a license + originality statement; missing entries fail the build.

## Edge Cases

- A renderer slice references a sprite that does not exist: `spriteAtlas.ts` already falls back to a magenta rect (per `implement-visual-polish-7d31d112` verify list); this slice gives it real bytes so the magenta is reserved for actual errors.
- The placeholder art is publicly visible: include a "PLACEHOLDER" watermark in each sprite so a deployed pre-alpha is unambiguously non-final.
- Final art replaces placeholders later: every replacement preserves the same id + dimensions so atlas metadata does not need to change.
- An asset is later flagged as not-CC0 (provenance dispute): `scripts/check-art-manifest.ts` checks every license string against an allow-list; introducing a different license requires both an allow-list entry and a manifest update.

## Verify

- [ ] Every `docs/gdd/24-content-plan.md` Asset list entry has a corresponding placeholder file under `public/art/`.
- [ ] `public/art/manifest.json` lists every file with author + license + originality statement.
- [ ] `scripts/check-art-manifest.ts` exits zero on the shipped state.
- [ ] No file under `public/art/` exceeds 32 KB (placeholders are deliberately tiny).
- [ ] Total `public/art/` size under 4 MB (within `docs/gdd/27-risks-and-mitigations.md` performance budget).
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/17-art-direction.md`
- `docs/gdd/24-content-plan.md` (Asset list)
- `docs/gdd/26-open-source-project-guidance.md` (asset manifest, originality)
- `docs/gdd/27-risks-and-mitigations.md` (Asset burden, palette-driven reuse)
