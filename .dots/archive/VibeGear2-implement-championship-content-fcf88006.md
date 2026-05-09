---
title: "implement: championship content registry (world-tour-standard JSON + loader)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:15:47.793658-05:00\\\"\""
closed-at: "2026-04-26T04:47:33.792461-05:00"
close-reason: verified
---

## Description

Author the canonical championship JSON file `world-tour-standard.json` per the §22 `ChampionshipSchema` and ship a loader. §24 'Full v1.0 content' lists 8 tours x 4 tracks; this dot ships the structure file referencing the 32 tracks (whose JSON files come from sibling track-set dot `implement-mvp-track-...` and full content). For MVP, the file may reference only the tracks that exist; the content lint dot enforces that all referenced track ids resolve.

## Context

GDD source of truth: `docs/gdd/22-data-schemas.md` ('Championship JSON schema'), `docs/gdd/24-content-plan.md` ('Suggested region and track list' enumerates 8 tours x 4 tracks). Sibling dots: `implement-tour-region-...` (game logic that reads the championship), `implement-mvp-track-...` (track JSON files). The tour-region dot's Affected Files already lists `src/data/championships/world-tour-standard.json`; this dot fully owns that file plus the loader plumbing.

## Affected Files

- `src/data/championships/world-tour-standard.json` (new): full 8-tour structure
- `src/data/championships/index.ts` (new): static-import barrel exposing `CHAMPIONSHIPS`, `CHAMPIONSHIPS_BY_ID`, `getChampionship(id)`
- `src/data/__tests__/championship-content.test.ts` (new): validates against `ChampionshipSchema`; every referenced track id resolves in `TRACK_RAW`; `requiredStanding` values monotonic-increasing per tour index
- `src/data/index.ts` (update): re-export `getChampionship`

## Edge Cases

- Tracks referenced but not yet authored: the schema validates structurally, but the cross-ref test fails until the track set ships. Add a 'phase guard' env-var `ALLOW_UNRESOLVED_CHAMPIONSHIP_TRACKS=1` for the MVP window; remove when full content lands.
- requiredStanding monotonic: tour 1 = 4, tour 2 = 4, tour 3 = 3, tour 4 = 3, etc. Pin in dot; defer fine-tuning to balancing-pass.
- Difficulty preset: 'normal' baseline; the §28-difficulty dot wires the preset selector.

## Verify

- [ ] `world-tour-standard.json` validates against `ChampionshipSchema.safeParse`.
- [ ] `tours.length === 8`; each `tracks.length === 4`.
- [ ] Every track id in the file matches one of: an authored track in `TRACK_RAW`, OR a placeholder id documented in the file's top comment.
- [ ] `requiredStanding` values monotonic non-increasing tour-by-tour.
- [ ] `getChampionship('world-tour-standard')` returns the parsed object.
- [ ] Build clean.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
