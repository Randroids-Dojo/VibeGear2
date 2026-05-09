---
title: "implement: §9 track-anatomy lint in content-lint pipeline"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:22:43.211932-05:00"
blocks:
  - VibeGear2-implement-re-author-47323741
---

## Description

Add a static lint pass to `scripts/content-lint.ts` (or a new
sibling under `scripts/`) that asserts the §9 "Track anatomy" rules
on every production track JSON:

1. At least one segment with |curve| >= 0.30 (the §9 Sharp / Hairpin
   signature feature).
2. At least one straight (|curve| < 0.05) of len >= 200 m (the §9
   recovery zone) after the signature.
3. At least one segment with |grade| >= 0.06 (the §9 mild or
   aggressive crest).
4. At least one Compound run: two adjacent authored segments both
   with |curve| >= 0.15 and combined len < 250 m.

Fail the lint if any production track misses any of (1)-(4). Soft
warn (do not fail) if a track has zero tunnel segments AND its
region theme `tunnelMaterials` has more than one entry (heuristic:
the region theme expected tunnels).

## Context

Iter 2 of the topgear-fun research loop found that all 32 production
tracks miss the §9 corner vocabulary. Re-authoring them is the
content slice (`VibeGear2-implement-re-author-47323741`); without a
lint, the next contributor can re-flatten a track and the regression
will not surface until a playtest. The lint is the spiral discipline
that protects pain point #2 from re-opening.

## Affected files

- `scripts/content-lint.ts` (or a new `scripts/track-anatomy-lint.ts`
  imported from `scripts/content-lint.ts`).
- `package.json` if a new script entry is needed.
- `docs/gdd/09-track-design.md` build log entry.
- No track JSON edits; that is the sister slice
  `VibeGear2-implement-re-author-47323741`.

## Implementation notes

- Run after the re-author slice ships so the lint passes on first
  introduction. If it ships first, gate it behind a per-track
  allowlist file that the re-author slice empties.
- Use the existing track schema validators in
  `src/data/schemas.ts` so the lint can import the parsed `Track`
  shape rather than re-parsing JSON.
- Co-locate the §9 thresholds with `docs/gdd/09-track-design.md`
  numbers so the lint and the GDD stay in sync.

## Verify

- `npm run content-lint` passes after the re-author slice.
- `npm run content-lint` fails with a clear error message when a
  test track fixture is intentionally flattened (add the fixture
  under `src/data/tracks/_lint/` or similar; do not pollute the
  production track folder).
- `npm run typecheck` and `npm run test` pass.
