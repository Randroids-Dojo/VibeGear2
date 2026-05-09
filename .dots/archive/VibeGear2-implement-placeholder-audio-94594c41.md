---
title: "implement: placeholder audio assets (music stems + SFX bank) + asset manifest per §18 §24"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:22:19.781528-05:00\\\"\""
closed-at: "2026-04-29T04:54:05.523572-05:00"
close-reason: "Shipped generated placeholder audio bank with manifest and coverage checks in PR #84."
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
---

## Description

Author the placeholder audio bank described in `docs/gdd/18-sound-and-music-design.md` and `docs/gdd/24-content-plan.md`. Ship as OGG/Opus loops + one-shots under `public/audio/` with a JSON manifest. Like the placeholder art slice, this is content-only and provides bytes for `implement-sound-music-1611f9dd` to load while final audio is authored.

The placeholders are procedurally generated tones / simple drum loops authored programmatically (e.g. via a one-off `scripts/generate-placeholder-audio.ts` that writes Opus files via ffmpeg) so they are unambiguously placeholder, CC0, and zero-license-risk. Final audio replaces them later.

## Context

`docs/gdd/24-content-plan.md` Asset list / Audio: title theme, 8 race themes, 20-30 SFX, UI set, weather loops. `docs/gdd/25-development-roadmap.md` Vertical Slice phase calls for "one music pack" and "one original music theme". Today there is no audio at all on disk; `implement-sound-music-1611f9dd` would have to ship its own stub audio just to compile its tests, blurring the code/content split.

`docs/gdd/26-open-source-project-guidance.md` requires every audio asset to declare provenance + license. CC0 placeholders authored by the agent satisfy that without external dependency.

## Affected Files

- `public/audio/music/{title,velvet-coast,iron-borough,ember-steppe,breakwater-isles,glass-ridge,neon-meridian,moss-frontier,crown-circuit}.opus` (new): nine placeholder music loops (one per region + title).
- `public/audio/sfx/{ui-hover,ui-confirm,ui-back,countdown-3,countdown-2,countdown-1,countdown-go,impact-light,impact-heavy,nitro-on,nitro-off,gear-up,gear-down,puddle-splash,grass-skid,brake-screech,collision-crunch,horn,checkpoint,finish,damage-warn,record-set}.opus` (new): ~22 SFX one-shots covering UI, race events, weather hits.
- `public/audio/weather/{rain-loop,fog-wind-loop,snow-loop,heavy-rain-loop}.opus` (new): four weather ambience loops.
- `public/audio/manifest.json` (new): per-asset id, path, license (CC0), author ("agent-authored placeholder"), duration, sample rate, originality statement.
- `scripts/generate-placeholder-audio.ts` (new): regenerates the placeholder bank from a small set of synthesis primitives. Reproducible, deterministic, no external SFX libraries.
- `scripts/check-audio-manifest.ts` (new): CI guardrail mirroring `check-art-manifest.ts`.

## Edge Cases

- Browser audio decode failure on a corrupt placeholder: `mixer.ts` already no-ops on a missing buffer; the manifest test catches missing files at build time.
- Sample rate mismatch with `AudioContext`: stick to 48 kHz across all placeholders for portability.
- Total audio size: each placeholder loop is short (4-8 s) and Opus-encoded; the bank stays under 2 MB to keep `implement-asset-preload-ea2d400a` fast.
- A future "final" audio replacement preserves the same id + duration so mixing metadata stays valid.

## Verify

- [ ] Every `docs/gdd/24-content-plan.md` Audio asset has a corresponding placeholder file under `public/audio/`.
- [ ] `public/audio/manifest.json` lists every file with author + license + originality statement.
- [ ] `scripts/check-audio-manifest.ts` exits zero.
- [ ] Total `public/audio/` size under 2 MB.
- [ ] `scripts/generate-placeholder-audio.ts` is deterministic: rerunning it produces byte-identical files (or at minimum, same id-set + same duration metadata).
- [ ] All files load via `AudioContext.decodeAudioData` in a Vitest `web-audio-test-api` fixture.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/18-sound-and-music-design.md`
- `docs/gdd/24-content-plan.md` (Audio asset list)
- `docs/gdd/25-development-roadmap.md` (Vertical Slice / one music pack)
- `docs/gdd/26-open-source-project-guidance.md` (asset manifest, originality)
