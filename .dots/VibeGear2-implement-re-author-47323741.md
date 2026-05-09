---
title: "implement: re-author production tracks with §9 corner-grade vocabulary (sharps, hairpins, S-curves)"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:22:26.985422-05:00"
blocks:
  - VibeGear2-implement-bump-prod-076ae7e7
---

## Description

Re-author the 32 production track JSONs under `src/data/tracks/*.json`
so the segment data exercises the full §9 corner-grade vocabulary
(Sweep / Medium / Sharp / Hairpin / Compound) and the §9 elevation
vocabulary (mild crest / aggressive crest / dip / plateau). The
engine, schema, compiler, and renderer already accept |curve| up to
1.0 and |grade| up to 0.3 (see `src/data/schemas.ts:147-148`); the
miss is data, not engine.

This is a CONTENT-ONLY slice. No `src/` writes. The `archetype` and
`laps` slices from iter 1 ship first; this one re-shapes the
geometry of the same files.

### §9 corner targets per track

Every production track must ship at least the §9 anatomy:

- One signature feature corner: `Sharp` (|curve| 0.30-0.45) or
  `Hairpin` (|curve| 0.50-0.85).
- One recovery zone: a flat straight 200 m+ after the signature.
- One high-speed gamble: a `Medium` (|curve| 0.15-0.25) with a
  `dip` grade (-0.08 to -0.12).
- One late-race tension section: a `Compound` linking two grades
  back-to-back without a recovery straight between them.
- One mild or aggressive crest: |grade| 0.06-0.12 over a 120-180 m
  authored segment.

### Region tier targets

- Velvet Coast (onboarding): one Sharp signature per track. No
  hairpins. One mild crest per track. Tunnels stay zero so the
  onboarding tour reads as a coastal tour.
- Iron Borough: one Hairpin per track (|curve| ~0.55) representing
  the urban tight bend. At least one tunnel segment per track
  (only Rivet Tunnel ships one today; extend Foundry Mile,
  Freightline Ring, and Outer Exchange).
- Ember Steppe: one Sharp + one aggressive crest per track.
- Breakwater Isles: one Compound (S-curve) per track.
- Glass Ridge: one Hairpin per track + one aggressive crest. The
  alpine tier is the single hardest cornering set.
- Neon Meridian: one Compound + the existing tunnels stay.
  Velocity-pressure tunnel exits should follow a Sharp.
- Moss Frontier: one Hairpin per track (technical mid-late tier).
- Crown Circuit: one Hairpin AND one Compound per track (endgame
  mastery).

### Authoring guardrails

- Keep `lengthMeters` accurate to within 5% of `sum(segments[].len)`
  so the existing track-compiler warning does not fire.
- Keep the existing pickup ids; do not rename them. If a re-shape
  moves a pickup off-line, edit the `laneOffset` not the id.
- `inTunnel: true` segments must carry a `tunnelMaterial` slug from
  the region theme `tunnelMaterials` array; otherwise the existing
  validation will reject the file.
- Do not remove a checkpoint or hazard. This slice is geometry only.
- Keep `spawn.gridSlots` at 12.

## Context

Iter 2 of the topgear-fun research loop diagnosed pain point #2
("tracks are missing real turns"). The current production set
spans only |curve| 0 to 0.22 and |grade| 0 to 0.08, well inside the
schema range and well inside what the segment projector accepts.
Across all 32 tracks: 0 hairpins, 0 sharps, 4 tunnel tracks, 0
aggressive crests. See `docs/RESEARCH_TOPGEAR_FUN_PLAN.md` "Pain
point #2" section for the full distribution.

This slice is the highest-leverage single slice for pain point #2
because the engine already supports the vocabulary; the renderer
already handles tunnels via `src/render/tunnelRenderer.ts` and
local-window crest occlusion via `src/road/segmentProjector.ts`
maxY cull. The only thing missing is content that exercises any of
it.

## Affected files

- `src/data/tracks/*.json` (32 files, one per production track).
- No `src/` source code.
- No GDD spec edits. (The §9 build log gets a one-line entry per
  the gdd-build-log rule.)
- `docs/gdd/09-track-design.md` build log entry.

## Implementation notes

1. Work region by region. Land one region per PR if the diff is
   reviewable; otherwise split per-track. Either way is acceptable
   under the slice-discipline rule.
2. Run `npm run content-lint` after every region. The track
   compiler `LENGTH_METERS_TOLERANCE` is 5%; the packed-hairpin run
   heuristic fires at |curve| > 0.6 with combined len < 80 m, so
   space hairpin-grade segments with at least 80 m of recovery.
3. Re-render the dev `/dev/road` page for one track per region
   tier and eyeball the geometry; the projector has unit tests but
   no end-to-end golden image yet (F-082 covers that).
4. Update `docs/gdd/09-track-design.md` build log.

## Verify

- `npm run content-lint` passes for every touched track.
- `npm run typecheck` and `npm run test` pass.
- The `track-compiler.test.ts` packed-hairpin warning does not fire
  on any track (manual: search the test output for "packed
  hairpin").
- For one track per region, eyeball the `/dev/road` view and
  confirm the signature corner, recovery, gamble, tension section,
  and crest each read.
- Iter-2 followup F-083 (golden-image regression test) is filed
  separately so this slice does not block on it.
