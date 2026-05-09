---
title: "implement: starter mod sample pack + mod loading e2e per §26"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:21:26.271739-05:00\\\"\""
closed-at: "2026-04-29T16:25:15.690339-05:00"
close-reason: "Merged PR #100, addressed Copilot threads, CI green, production smoke passed at e8c4fea."
blocks:
  - VibeGear2-implement-mod-loader-e9b8b51f
  - VibeGear2-implement-modding-md-efbf1c83
---

## Description

Author one starter mod under `public/mods/<mod-id>/` that exercises every required mod-manifest field and ships one playable extra track. Use it as the canonical test fixture for the mod loader and as a contributor reference. Closes the §25 v1.0 deliverable "docs and mod samples".

## Context

`docs/gdd/26-open-source-project-guidance.md` describes mod manifest requirements (author, license, originality statement) and `docs/gdd/21-technical-design-for-web-implementation.md` describes the loader path (`/mods/<mod-id>/`). `implement-mod-loader-e9b8b51f` ships the loader; this dot ships the sample mod the loader can validate against and that contributors can copy.

The starter mod is intentionally minimal: one new track, no new car (cars require sprites), one CC0 placeholder palette swap on roadside props. The point is to exercise the full pipeline without authoring large content.

## Affected Files

- `public/mods/sample-coast-extra/manifest.json` (new): manifest per §26 (id, version, author, license, originality, content list).
- `public/mods/sample-coast-extra/tracks/coast-extra.json` (new): one track JSON conforming to §22.
- `public/mods/sample-coast-extra/README.md` (new): describes the mod, the licence, the originality statement.
- `docs/MODDING.md` (update if extant): link to the sample as the contributor reference.
- `e2e/mod-loader.spec.ts` (update or new): asserts the sample mod loads successfully and the track appears in quick-race's track picker when mods are enabled.

## Edge Cases

- Mod with an invalid manifest: loader rejects, sample's manifest is the positive control.
- Mod with a track ID that collides with a core track: rejected by the loader; sample uses an unambiguously new ID (`sample-coast-extra/coast-extra`).
- Mod loaded with mods disabled in settings: sample track does not appear in pickers.
- Browser cache for the manifest: bust via the build SHA query param.

## Verify

- [ ] `manifest.json` validates against the manifest schema authored in `implement-mod-loader-e9b8b51f`.
- [ ] `coast-extra.json` validates against the §22 Track schema.
- [ ] License files are CC0 (or another permissive choice approved by the licence dot) for every asset referenced.
- [ ] Originality statement is non-empty and asserts no Top Gear 2 derivation.
- [ ] e2e: load `/quick-race` with mods enabled, confirm "Coast Extra" appears in the track list; load it, race for 5 s, no console errors.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/26-open-source-project-guidance.md` (modding rules, manifest fields, IP-contamination guardrails)
- `docs/gdd/22-data-schemas.md` (Track schema)
- `docs/gdd/25-development-roadmap.md` (v1.0 mod samples)
