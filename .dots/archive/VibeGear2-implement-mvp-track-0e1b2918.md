---
title: "implement: MVP track set per §24"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:22.558355-05:00\\\"\""
closed-at: "2026-04-28T02:45:19.371995-05:00"
close-reason: "Merged PR #39. Added the eight section 24 MVP tracks for Velvet Coast and Iron Borough, registered them in TRACK_RAW, added schema and championship coverage, addressed PR review comments, verified main CI and production deploy, and smoked production routes."
blocks:
  - VibeGear2-implement-tour-region-d9ca9a4d
---

## Description

Author the MVP track set listed in `docs/gdd/24-content-plan.md`. Each track is a JSON file conforming to the Track schema in §22 and validated by the Zod validator. Place under `src/data/tracks/<region>/<track>.json`.

## Context

Phase 3 task per `docs/IMPLEMENTATION_PLAN.md`. Track set is required for the championship structure (§8) to have content.

## Affected Files

- `src/data/tracks/velvet-coast/*.json` (new, four tracks per §24)
- additional regions per §24 (one folder per region)
- `src/data/__tests__/tracks-content.test.ts` (new): walk the directory, validate each JSON against the Zod schema

## Edge Cases

- Track without `weatherOptions`: schema-invalid (must include at least `clear`).
- Lap count < 1 or > 10: schema-invalid (per §22 / §23 bounds).
- Spawn `gridSlots` < AI count: log a warning at compile time.

## Verify

- [ ] All track JSONs validate against the schema.
- [ ] Each track loads in `/race?track=<id>` and is drivable.
- [ ] Total length, lap count, and difficulty match `docs/gdd/24-content-plan.md` table.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Researcher Stress-Test (iter-19)

The 37-line spec collides with the §24 content plan in two ways: §24 lists "2 tours, 8 tracks" for MVP but the table at the bottom of §24 enumerates 8 regions with 32 tracks. Pin which set this dot ships, then pin the authoring shape.

### 1. Scope: ship the §24 MVP set, not the full v1.0 set.

§24 "MVP content" line 6: `2 tours, 8 tracks`. The §24 region table is the v1.0 32-track scope (covered separately by `content-budget-e42cd8f9` which polices the cap). For this dot:

- Ship 2 tours from §24's table: `velvet-coast` (Harbor Run, Sunpier Loop, Cliffline Arc, Lighthouse Fall) and `iron-borough` (Freightline Ring, Rivet Tunnel, Foundry Mile, Outer Exchange).
- Why these two: Velvet Coast first (the design pillars and §1 "spiritual successor" wording lean to coastal openings), Iron Borough second (industrial / urban contrast unlocks tonal range and stress-tests the §13 damage scenes).
- Other 6 regions become a follow-on dot, blocked on `tour-region-d9ca9a4d`.

### 2. Affected Files: the schema-correct path.

`TrackSchema.id` is a slug, validated as `^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/` (`src/data/schemas.ts:24`). The id MUST contain the slash to encode the region (e.g. `velvet-coast/harbor-run`) so loadTrack can resolve cross-region. File path on disk:

- `src/data/tracks/velvet-coast/harbor-run.json` (new)
- `src/data/tracks/velvet-coast/sunpier-loop.json` (new)
- `src/data/tracks/velvet-coast/cliffline-arc.json` (new)
- `src/data/tracks/velvet-coast/lighthouse-fall.json` (new)
- `src/data/tracks/iron-borough/freightline-ring.json` (new)
- `src/data/tracks/iron-borough/rivet-tunnel.json` (new)
- `src/data/tracks/iron-borough/foundry-mile.json` (new)
- `src/data/tracks/iron-borough/outer-exchange.json` (new)
- `src/data/tracks/index.ts` (UPDATE — was missing from spec): extend the static-import barrel from `feat/track-compiler-golden` (PROGRESS_LOG 2026-04-26) so `loadTrack(id)` resolves the new ids. Today the barrel only has `test/straight` and `test/curve`.
- `src/data/__tests__/tracks-content.test.ts` (new): walks `src/data/tracks/<region>/*.json`, runs `TrackSchema.safeParse`, asserts compile errors are absent (`expect(() => compileTrack(parsed)).not.toThrow()`), asserts §24's lengthMeters / laps / difficulty cells match the plan.

### 3. Per-track authored values.

§24 names tracks but does not pin lengths or lap counts. §7 lap targets ("Standard circuit: 3 laps", "Long scenic: 2 laps", "Short sprint: 4 to 5") give the band. Pin these for the 8 MVP tracks, scoped to roughly hit the §24 difficulty rubric (line 53) and the §1 "30 second drive feels like the design pillars" target:

| id | length (m) | laps | difficulty | weatherOptions |
| --- | --- | --- | --- | --- |
| velvet-coast/harbor-run | 1800 | 3 | 1 | clear, light_rain |
| velvet-coast/sunpier-loop | 2400 | 3 | 1 | clear, fog |
| velvet-coast/cliffline-arc | 3200 | 2 | 2 | clear, light_rain, rain |
| velvet-coast/lighthouse-fall | 4100 | 2 | 3 | clear, fog, heavy_rain |
| iron-borough/freightline-ring | 2000 | 4 | 2 | clear, light_rain |
| iron-borough/rivet-tunnel | 1600 | 4 | 3 | clear, fog |
| iron-borough/foundry-mile | 2700 | 3 | 3 | clear, light_rain, rain |
| iron-borough/outer-exchange | 3500 | 3 | 4 | clear, light_rain, rain, heavy_rain |

Authoring time per track: roughly 30-90 minutes of segment-by-segment work in the §22 schema. Implementer can use `src/data/examples/track.example.json` as a template. The §9 track-design module's authoring guidance applies; tracks should pass `compileTrack` with zero hard errors and only soft warnings.

### 4. Edge cases the spec missed.

- spawn.gridSlots vs §7 field size 12: spec says "warning at compile time" if gridSlots < AI count. Pin `spawn.gridSlots: 12` for every MVP track so the §7 default field fits without warnings.
- All 8 tracks must list `clear` as their first weatherOption (the trackCompiler emits a warning if `weatherOptions` is missing "clear", per `feat/track-compiler-golden`).
- Checkpoints: at least one checkpoint per track at segmentIndex 0 (start/finish) plus one mid-track checkpoint, so the lap-credit anti-shortcut guard from `race-checkpoint-81d86518` has something to enforce. Recommend `[{segmentIndex:0,label:"start"}, {segmentIndex:Math.floor(segments.length/2),label:"mid"}]`.
- `lengthMeters` drift: the trackCompiler warns when authored sum drifts >5% from `lengthMeters`. Authors should set `lengthMeters` to exactly `sum(segment.len)`.

### 5. Boundary with `tour-region-d9ca9a4d` (also currently a skinny dot).

This dot delivers track JSON only. It does NOT define the championship file linking tour to track. That belongs to `tour-region-d9ca9a4d` (which currently blocks on this dot but does not pin its own delivery shape). Recommend a follow-on stress-test on `tour-region` to pin a `src/data/championships/mvp.json` entry referencing the 2 tours x 4 tracks introduced here.

### 6. Sharper Verify list.

- [ ] `tracks-content.test.ts` walks the directory, asserts `expect(safeParse(json).success).toBe(true)` for all 8 files.
- [ ] `compileTrack(parsed)` returns no thrown errors for all 8; `result.warnings` array is empty (or only the documented soft-lint set).
- [ ] Each track's `lengthMeters` matches `sum(segment.len)` to within 0.5m (assert per file).
- [ ] Each track's `id` matches its file path (`velvet-coast/harbor-run.json` -> id `"velvet-coast/harbor-run"`).
- [ ] Each track has `weatherOptions[0] === "clear"` and `checkpoints[0].segmentIndex === 0`.
- [ ] `loadTrack(id)` round-trips for all 8 ids and returns a parsed `Track` deep-equal to the JSON.
- [ ] §24 §7 §23 cells: assert table cell-by-cell against the table in (3) above.
- [ ] Manual: each track loads in `/race?track=<id>` and the player can complete a lap (deferred to Phase-1 demo wiring; if the demo route is not yet ready, mark this row "deferred to phase-1-7aef013d").
- [ ] No em-dashes (`grep -P '[\x{2013}\x{2014}]' src/data/tracks/velvet-coast/*.json src/data/tracks/iron-borough/*.json src/data/__tests__/tracks-content.test.ts` returns nothing).
