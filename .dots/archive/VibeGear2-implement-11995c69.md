---
title: "implement: track compiler + golden-master tests"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T01:19:04.456799-05:00\\\"\""
closed-at: "2026-04-26T02:53:10.125447-05:00"
close-reason: verified
---

## Description

Implement the full authoring-to-runtime track pipeline per the binding spec in `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md` "Findings".

This is the production version of the compiler stubbed in the pseudo-3D slice. It ships:

1. `compileTrack(track)` returning a `CompiledTrack` with `segments`, `checkpoints`, `warnings`, frozen output.
2. `TrackCompileError` for hard validation failures.
3. A full unit test suite (16 cases) and a golden-master suite over five fixture tracks with explicit JSON snapshots.
4. A `loadTrack(id)` helper in `src/data/index.ts` that reads a JSON file, runs `safeParse`, and runs `compileTrack`.

## Context

Phase 3 prerequisite per `docs/IMPLEMENTATION_PLAN.md`. Unblocks `implement-mvp-track-0e1b2918` (authored content needs the compiler to render) and `implement-tour-region-d9ca9a4d` (tours reference compiled tracks). Depends on `implement-pseudo-3d-d4c30840` landing first so the compiled-segment shape is exercised by the projector.

GDD references: §9 (track anatomy), §21 (golden-master testing for track compilation), §22 (Track JSON schema).

## Affected Files

- `src/road/constants.ts` (already created by pseudo-3d slice): re-used `SEGMENT_LENGTH`, `DRAW_DISTANCE`.
- `src/road/types.ts` (existing): extend with `CompiledTrack`, `CompiledCheckpoint`, `TrackCompileError` types.
- `src/road/trackCompiler.ts` (existing stub): replace with full implementation per spec.
- `src/road/__tests__/trackCompiler.test.ts` (existing stub): expand to all 16 unit cases listed in research findings.
- `src/road/__tests__/trackCompiler.golden.test.ts` (new): five fixture deep-compares + determinism + immutability.
- `src/road/__tests__/__snapshots__/trackCompiler.snapshots.json` (new): keyed by fixture name.
- `src/road/__tests__/fixtures/straight.json` (new).
- `src/road/__tests__/fixtures/gentle-curve.json` (new).
- `src/road/__tests__/fixtures/crest.json` (new).
- `src/road/__tests__/fixtures/mvp-vs.json` (new).
- `src/road/__tests__/fixtures/boundary.json` (new).
- `src/data/index.ts` (existing): add `loadTrack(id)` helper that reads `src/data/tracks/<id>.json`, validates, and compiles.

## Edge Cases

- Authored `len < SEGMENT_LENGTH`: ceil to 1 compiled segment, emit warning.
- `len === 0` (pathological): treat as 1 compiled segment.
- Checkpoints without a `start` label or `start.segmentIndex !== 0`: throw `TrackCompileError`.
- Checkpoint `segmentIndex >= segments.length`: throw `TrackCompileError`.
- Total compiled length below 4 segments: throw `TrackCompileError`.
- `lengthMeters` metadata off by more than 5%: warning.
- `weatherOptions` missing `"clear"`: warning.
- `spawn.gridSlots < 8`: warning.
- Fixtures that fail `TrackSchema.safeParse` should fail loudly in test setup, not pass with empty compiled output.

## Verify

- [ ] Unit tests pass for all 16 listed cases (see research findings "Unit test list").
- [ ] Golden-master tests pass for all five fixtures and assert determinism + immutability.
- [ ] `UPDATE_SNAPSHOTS=1 vitest run` regenerates the snapshot JSON when the schema or compiler intentionally changes.
- [ ] `compileTrack` is a pure function: same input produces deep-equal output across two runs.
- [ ] `loadTrack(id)` correctly resolves a path under `src/data/tracks/`, validates, and compiles.
- [ ] `compileSegments` callers in `src/app/dev/road/page.tsx` and `src/app/dev/physics/page.tsx` still work (or are migrated to the new API and tests cover the new shape).
- [ ] `segmentProjector.project` still consumes the new `CompiledSegment` shape without regressions (its `authoredRef` reads must be renamed to `authoredIndex`).
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 14, researcher pass)

Inspecting the repo before implementation reveals concrete migration work this dot must own that is not currently surfaced in Description or Affected Files:

1. **`CompiledSegment` shape change (breaking).** The current `src/road/types.ts` `CompiledSegment` is `{index, worldZ, curve, grade, authoredRef}`. The research spec's compiled segment is `{index, worldZ, curve, grade, authoredIndex, roadsideLeftId, roadsideRightId, hazardIds}`. The implementer MUST rename `authoredRef -> authoredIndex` AND add roadside / hazard id fields. Two known consumers depend on the current shape:
   - `src/road/segmentProjector.ts` imports `CompiledSegment` and is type-coupled (no field access on the rename target itself).
   - `src/road/__tests__/segmentProjector.test.ts` builds `CompiledSegment` literals with `authoredRef: 0` (line ~26). Migration: update to `authoredIndex: 0` and add the new string id fields.
   - `src/road/__tests__/trackCompiler.test.ts` reads `compiled.segments[i]!.authoredRef` (lines 79-87). Migration: rename to `authoredIndex`.
   - `src/app/dev/road/page.tsx` and `src/app/dev/physics/page.tsx` call `compileSegments(...)` (the lower-level helper). The research spec's API is `compileTrack(track)` returning a richer `CompiledTrack`. Decision required: keep `compileSegments(authored)` as a thin escape hatch for dev pages OR migrate dev pages to construct minimal `Track` objects. Recommendation: keep `compileSegments` to avoid forcing dev pages to fabricate fake checkpoints; document it as the dev-only entry point.

2. **Curve scaling drift between current code and research spec.** Current `compileSegments` divides `curve` by `CURVATURE_SCALE` and multiplies `grade` by `SEGMENT_LENGTH` at compile time. The research spec keeps `curve` and `grade` raw on the compiled segment ("the projector divides by CURVATURE_SCALE"). This is a real semantic conflict that this dot must resolve. Resolution required before implementation:
   - Option A: keep current pre-scaling. Update research-spec's `CompiledSegment` doc to match: store post-scaled values. Pros: zero regression in `segmentProjector`; the dev pages work today against this shape.
   - Option B: switch to raw values per research spec. Requires updating `segmentProjector.project` to apply `/ CURVATURE_SCALE` and `* SEGMENT_LENGTH` itself.
   - **Recommended: Option A** (keep pre-scaling). The current code is shipping; the projector is tested. Annotate `CompiledSegment.curve` in `types.ts` to document the post-scaled invariant. Update the research spec note in this dot's pseudocode reference accordingly.

3. **`TrackCompileError` does not exist yet.** Spec calls for `class TrackCompileError extends Error { code: string; details: object }`. This is a new export from `trackCompiler.ts`. Tests import it; production loaders catch it. The fixture-loading helper (test setup) must surface schema parse errors as plain `Error`, not `TrackCompileError`, to disambiguate.

4. **`loadTrack(id)` runs in browser, no `fs`.** The dot says "reads a JSON file" but Next.js client bundles cannot do filesystem I/O. Two viable shapes:
   - Static import map: `loadTrack(id)` looks up `id` in a registry built at compile time from `import * as tracks from "./tracks/*.json"` (or an explicit barrel). Browser-safe.
   - Server-only helper in a node script (golden-master test setup) with `import.meta.glob` or `node:fs`.
   - **Recommended: both, layered.** A `loadTrack(id)` browser helper that reads from a barrel index built by `src/data/tracks/index.ts`, plus a `loadTrackFromFile(path)` test helper using `node:fs/promises` for fixture loading in golden-master tests.

5. **Snapshot helper is more code than the dot acknowledges.** `expectMatchesSnapshot(name, compiled)` per research spec needs:
   - JSON read from `__snapshots__/trackCompiler.snapshots.json` keyed by `name`.
   - Stable serialization (sorted keys) for diff-friendly snapshots.
   - `UPDATE_SNAPSHOTS=1` env-var write-back. Atomic write (write to tmp then rename) to avoid corrupted snapshot files.
   - First-time write when key is missing AND the env var is set.
   - First-time MISS without env var should fail with a clear "snapshot not found, rerun with UPDATE_SNAPSHOTS=1" message.
   - Add this helper to `src/road/__tests__/snapshotHelpers.ts` (new). The dot's Affected Files list omits this; add it.

6. **Sampling rule for snapshots beyond index 30.** Research spec says "sample every 25th to keep the snapshot small". Implementer must encode this exactly: in the snapshot writer, after segment 29, include only segments where `index % 25 === 0`. Make it a constant `SNAPSHOT_SAMPLE_STRIDE = 25` so future tuning is one-line.

7. **`Object.freeze` is shallow.** Spec says "deeply-frozen segments array". The implementer MUST recursively freeze each `CompiledSegment` AND the outer `CompiledTrack` AND the `segments` array AND the `checkpoints` array AND the `hazardIds` arrays per segment. A `deepFreeze(value)` helper in the same file is the cleanest option; do not import a library.

8. **Five fixture JSON files are nontrivial to author.** Each fixture needs to validate against `TrackSchema` which requires (per `src/data/schemas.ts`): id, name, region, weatherOptions (with at least "clear" or warning), spawn.gridSlots, laps, laneCount, lengthMeters, segments (with curve, grade, len, roadsideLeft, roadsideRight, hazards), checkpoints (with segmentIndex and label, including a "start" at index 0). The implementer should literally copy `src/data/examples/track.example.json` as the seed for `mvp-vs.json` and adjust other fixtures from there.

9. **`brake-distance bias` is a future-archetype concern, not this dot.** Note for the dot reader: this dot ships the compiler ONLY. AI behaviour, race rules, and renderer integration are downstream.

### Pre-flight required before implementer starts

The implementer should reply to whoever opens this dot with their pick on items 1, 2, and 4 above. If left ambiguous, default to: rename `authoredRef -> authoredIndex` + add roadside/hazard ids (#1), keep current pre-scaling + document it (#2 Option A), barrel + node:fs split (#4).
