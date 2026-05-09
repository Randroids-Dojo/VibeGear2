---
title: "research: track authoring pipeline + golden-master test design"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:16.947443-05:00\\\"\""
closed-at: "2026-04-26T01:19:41.432869-05:00"
close-reason: Pinned compile semantics (SEGMENT_LENGTH=6 m, ceil split, frozen output), validation rules (start checkpoint required, min length, lint warnings), golden-master test design (5 fixtures, explicit JSON snapshots, UPDATE_SNAPSHOTS=1), and module layout. Created implement-11995c69 for full compiler + golden-master tests.
blocks:
  - VibeGear2-implement-data-schemas-4dd373bc
---

Specify how a track JSON is authored, validated, and compiled to runtime form (segments). Output: implement: dots for trackCompiler.ts and the golden-master tests.

## Findings

### Goal of the pipeline

Three stages, in order, for any track entering the runtime:

1. **Author** as a `Track` JSON file under `src/data/tracks/<region>/<track>.json`, conforming to `TrackSchema` in `src/data/schemas.ts`.
2. **Load + validate** at runtime through `Track.safeParse(raw)`. Failure is fail-fast at the load site (`src/data/index.ts` re-exports plus a `loadTrack(id)` helper). No silent fallback in production builds.
3. **Compile** the validated `Track` to a `CompiledSegment[]` ring buffer with `trackCompiler.compileTrack(track)`. The compiler is pure, deterministic, and side-effect free, so its output can be golden-mastered.

This pipeline is dictated by the pseudo-3D recipe pinned in
`.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md`: authored variable-length segments expand into fixed-length compiled blocks of `SEGMENT_LENGTH = 6 m` so the projector can iterate by index without per-segment length math.

### Authoring conventions (binding)

Authored tracks are hand-written JSON, not generated. Conventions:

- **File path.** `src/data/tracks/<tour-id>/<track-id>.json` where `<tour-id>` and `<track-id>` are the slug fields from `Track.id` (`tour/track`). The on-disk path mirrors the `id` so a directory walk maps 1:1 to ids.
- **Authoring units.** Lengths in meters (matches §10 sim units). `curve` in `[-1, 1]` per §22, where `+1` is a hard right and `-1` is a hard left at the chosen `CURVATURE_SCALE`. `grade` in `[-0.3, 0.3]` per §22 (rise per length).
- **Segment granularity.** Authors write coarse segments (typical 60 m to 220 m per row). The compiler subdivides. Authors should think in terms of features ("opening straight", "first hairpin in", "crest reveal", "back straight", "tunnel"), not at compiled-segment granularity.
- **Roadside refs.** `roadsideLeft` and `roadsideRight` are string ids (e.g. `palms_sparse`, `marina_signs`, `guardrail`). For Phase 1 these are decorative-only. A later slice will attach a `RoadsideSet` registry; for now the strings are validated as non-empty by Zod and unmatched ids are drawn as the empty roadside.
- **Hazards.** `hazards: string[]` per segment; ids drawn from a known vocabulary (`puddle`, `cone`, `gravel`, `slick`, `snow_drift`, `tunnel_dark`). MVP renderer treats unknown strings as no-op.
- **Checkpoints.** `checkpoints[].segmentIndex` indexes the **authored** segments array (0-based). At least one checkpoint with `label: "start"` at `segmentIndex: 0` is required, enforced by `compileTrack`. Sector checkpoints use `label: "sector-N"` for HUD timing.
- **Spawn.** `spawn.gridSlots` >= AI count + 1 (player). The compiler emits a warning (not an error) if `gridSlots` < 8, matching MVP race field size.
- **No copyrighted strings.** Track names and authored deco refs must not include real-world brands or location names. Enforced by the author, not the schema (see Q-002 for the licensing path).

### Compile semantics (binding)

`compileTrack(track: Track) -> CompiledTrack` where:

```
type CompiledTrack = {
  trackId: string;
  totalLengthMeters: number;       // sum of authored len, rounded up to whole compiled segments
  totalCompiledSegments: number;   // ceil(totalLengthMeters / SEGMENT_LENGTH)
  segments: CompiledSegment[];     // length === totalCompiledSegments
  checkpoints: CompiledCheckpoint[];
  spawn: TrackSpawn;
  laps: number;
  laneCount: number;
  weatherOptions: WeatherOption[];
  warnings: string[];              // non-fatal lint output
}

type CompiledSegment = {
  index: number;                   // 0-based, monotonic
  worldZ: number;                  // index * SEGMENT_LENGTH, in meters
  curve: number;                   // authored curve (unscaled); projector divides by CURVATURE_SCALE
  grade: number;                   // authored grade
  authoredIndex: number;           // index into Track.segments for roadside/hazard lookup
  roadsideLeftId: string;
  roadsideRightId: string;
  hazardIds: readonly string[];    // shared by reference with the authored segment
}

type CompiledCheckpoint = {
  authoredIndex: number;           // original index into Track.checkpoints
  compiledStart: number;           // compiled-segment index where the checkpoint begins
  label: string;
}
```

Algorithm:

```
SEGMENT_LENGTH = 6  // meters; pinned in src/road/constants.ts

function compileTrack(track):
  segments = []
  cumulativeIndex = 0
  authoredStartCompiled = []      // for each authored segment, its first compiled index

  for a, authoredIdx in track.segments:
    authoredStartCompiled.push(cumulativeIndex)
    count = ceil(a.len / SEGMENT_LENGTH)
    if count < 1: count = 1       // pathological zero-length authored segment becomes 1 compiled
    for i in 0..count-1:
      segments.push({
        index: cumulativeIndex,
        worldZ: cumulativeIndex * SEGMENT_LENGTH,
        curve: a.curve,
        grade: a.grade,
        authoredIndex: authoredIdx,
        roadsideLeftId: a.roadsideLeft,
        roadsideRightId: a.roadsideRight,
        hazardIds: a.hazards,
      })
      cumulativeIndex += 1

  checkpoints = track.checkpoints.map((cp, i) => ({
    authoredIndex: i,
    compiledStart: authoredStartCompiled[cp.segmentIndex],
    label: cp.label,
  }))

  return {
    trackId: track.id,
    totalLengthMeters: cumulativeIndex * SEGMENT_LENGTH,
    totalCompiledSegments: cumulativeIndex,
    segments,
    checkpoints,
    spawn: track.spawn,
    laps: track.laps,
    laneCount: track.laneCount,
    weatherOptions: track.weatherOptions,
    warnings: lint(track),
  }
```

Determinism guarantees:

1. The compiler is a pure function. No `Math.random`, no `Date.now`, no I/O.
2. Output ordering is deterministic: compiled index follows authored order top-to-bottom.
3. `worldZ` is exact integer multiples of `SEGMENT_LENGTH` (no floating-point drift), because `cumulativeIndex` is an integer multiplied by a literal integer.
4. `hazardIds` is the same array reference as the authored segment's array (frozen). This avoids per-frame allocation at projector use.

### Validation rules (in addition to TrackSchema)

`compileTrack` performs a second pass of structural lints that the schema cannot express. These run after `safeParse` and either emit `warnings` or `throw new TrackCompileError(message)`.

Hard errors (throw):

- `track.checkpoints` is empty, or no checkpoint has `label === "start"`, or the start checkpoint's `segmentIndex !== 0`. Rationale: the race-rules engine needs a deterministic lap-zero anchor.
- Any `checkpoint.segmentIndex >= track.segments.length`.
- Authored segments collectively shorter than 4 * `SEGMENT_LENGTH` (24 m). Rationale: a track shorter than the minimum draw window is unrenderable.
- The sum of authored `len` rounded to compiled segments produces fewer segments than `DRAW_DISTANCE` AND `track.laps === 1`. (Multi-lap short tracks are fine; the ring repeats.)

Warnings (collected into `warnings[]`, do not throw):

- `spawn.gridSlots < 8`.
- A checkpoint label is duplicated (other than `"start"`).
- Two consecutive authored segments with `|curve| > 0.6` and combined `len < 80 m` (likely a packed hairpin run that authors meant to break up).
- An authored segment has `len < SEGMENT_LENGTH` (will round up to 1 compiled segment, slightly stretching the authored intent).
- `weatherOptions` does not include `"clear"` (every track must have a clear baseline available).
- `lengthMeters` differs from the actual sum of authored `len` by more than 5%. Authors are expected to keep the metadata roughly in sync.

`TrackCompileError` extends `Error` with a `code: string` and a `details: object` for test introspection.

### Module layout (binding)

```
src/data/
  schemas.ts              // existing Zod validators
  tracks/
    <tour>/<track>.json   // authored content (later slices)
  index.ts                // re-export schemas + loadTrack(id) helper
  __tests__/
    tracks-content.test.ts // walks src/data/tracks, validates each (later slice)

src/road/
  constants.ts
  types.ts
  trackCompiler.ts        // compileTrack(track) -> CompiledTrack
  segmentProjector.ts
  __tests__/
    trackCompiler.test.ts        // unit tests
    trackCompiler.golden.test.ts // golden-master tests
    __snapshots__/               // committed JSON snapshots
      trackCompiler.snapshots.json
```

The compiler lives in `src/road/` because its output type (`CompiledSegment`) is consumed by `segmentProjector.ts`. The compiler does not import from `src/render/`; the render layer consumes compiled output via the projector.

### Golden-master test design (binding)

The compiler is the natural seam for golden-master testing per §21 ("Golden-master tests for track compilation") and AGENTS.md RULE 8. The strategy:

1. **Fixture corpus.** A small set of hand-authored fixture tracks under `src/road/__tests__/fixtures/`:
   - `straight.json`. 8 authored segments, all `curve: 0`, `grade: 0`, length 480 m total. Sanity check.
   - `gentle-curve.json`. 12 authored segments, alternating `curve: 0.2` and `0.0`, length 720 m.
   - `crest.json`. 10 authored segments, one with `grade: 0.15`, length 600 m. Exercises grade.
   - `mvp-vs.json`. Copy of the §22 example expanded to a complete authorable track (~1500 m, 3 laps). Acts as the "shape of a real track" canary.
   - `boundary.json`. Extreme but valid: `curve: 1.0`, `grade: 0.3`, segments 7 m and 200 m mixed. Exercises rounding boundaries.

   Each fixture is itself validated by `TrackSchema` in a setup step; if it stops validating, the test fails fast before running golden-master comparisons. Fixtures live under the test folder, NOT under `src/data/tracks/`, so they cannot be confused with shipping content.

2. **Snapshot format.** Per fixture, store the full `CompiledTrack` (segments + checkpoints + warnings + totals) as pretty-printed JSON in `src/road/__tests__/__snapshots__/trackCompiler.snapshots.json`. One file per fixture is too noisy; one merged file keyed by fixture name is the right granularity.

3. **Comparison.** Use Vitest's `expect(compiled).toMatchSnapshot()` or, for stricter control, deep-equal against a parsed JSON file. We pick **explicit JSON files** rather than Vitest's auto-managed `.snap` files because:
   - JSON is reviewable in PRs (every diff is meaningful).
   - JSON survives Vitest version upgrades cleanly.
   - The snapshot format documents the contract better than a `.snap` file would.

   Helper: `expectMatchesSnapshot(name, compiled)` reads
   `__snapshots__/trackCompiler.snapshots.json[name]`, deep-compares, and writes back when `UPDATE_SNAPSHOTS=1` is set in the environment. Same pattern as Jest's controlled snapshot mode but explicit.

4. **What the snapshot pins.**
   - Total compiled segment count.
   - First, last, and three sampled mid `worldZ` values (verifies integer multiples).
   - For each compiled segment in the first 30 indices: full record (curve, grade, authoredIndex, roadside ids, hazards). Beyond 30, sample every 25th to keep the snapshot small.
   - All compiled checkpoints in full.
   - The `warnings[]` array verbatim.
   - The lint metadata (totalLengthMeters, etc.).

   This bounds snapshot size while preserving regression detection: any per-segment math change shows up in indices 0-29 immediately.

5. **What the snapshot does NOT pin.**
   - Object reference identity (we deep-compare values, not references).
   - The order of keys (we serialize with sorted keys).
   - Nondeterministic fields (none should exist; if any do, they are bugs).

6. **Failure mode.** A snapshot mismatch fails the test with a unified diff of the JSON. The agent or human can rerun with `UPDATE_SNAPSHOTS=1` after manually verifying the diff is intentional, and commit the snapshot change.

7. **Golden-master test list.** `trackCompiler.golden.test.ts` contains:
   - one `describe` per fixture
   - one `it("compiles to expected shape", ...)` deep-comparing snapshot
   - one `it("is deterministic across two runs", ...)` calling compile twice and asserting deep-equal
   - one `it("frozen output cannot be mutated", ...)` (defensive: `Object.freeze` on the returned segments)

### Unit test list (binding)

Separate from golden-master, `trackCompiler.test.ts` covers the algorithm itself with assertion-based tests that do not depend on snapshots:

- `compiles a single 6 m authored segment to exactly 1 compiled segment with worldZ = 0`.
- `compiles a 13 m authored segment to 3 compiled segments (ceil(13/6))`.
- `compiles two authored segments back-to-back with monotonically increasing worldZ`.
- `compiles a track with checkpoints, mapping authored indices to correct compiled indices`.
- `propagates curve and grade unchanged from authored to compiled segments`.
- `treats len === 0 as 1 compiled segment` (pathological input).
- `throws TrackCompileError when no start checkpoint exists`.
- `throws TrackCompileError when start checkpoint segmentIndex !== 0`.
- `throws TrackCompileError when a checkpoint segmentIndex is out of bounds`.
- `throws TrackCompileError when total length is below the minimum`.
- `emits a warning when spawn.gridSlots < 8`.
- `emits a warning when weatherOptions does not include "clear"`.
- `emits a warning when lengthMeters disagrees with sum(len) by more than 5%`.
- `does not throw on the §22 example track`.
- `produces hazardIds that are the same array reference as the authored segment` (allocation property).
- `produces a deeply-frozen segments array` (immutability property).

Each test is float-tolerant where applicable (none here: all worldZ values are exact integer multiples of 6).

### Authoring workflow recommendations (informational)

For human authors writing track JSON by hand:

1. Sketch the track on paper or in a notepad as a sequence of 8 to 25 features. Each feature is one row in the segments array.
2. For each feature, pick `len` to match the §9 length targets (Short 50-75 s, Medium 75-105 s, Long 105-150 s) at 50 m/s competitive pace.
3. Set `curve` in increments of 0.05 to keep tracks readable; reserve `0.8+` for hairpins.
4. Set `grade` only on segments that are visibly hilly. Most segments should have `grade: 0`.
5. Place checkpoints to mark `start` (required) and one `sector-N` per 30% of length for HUD splits.
6. Run `compileTrack` in a unit test to surface warnings before shipping the track.
7. Drive the track in `/dev/track?id=<id>` (later slice) for visual verification.

A minimal "track-lint" CLI (`bun run scripts/lint-tracks.ts` or similar) is **not** Phase 1 scope; it should be a followup once the test suite stabilises. Filed below.

### Decisions

1. Authored tracks live as JSON files at `src/data/tracks/<tour-id>/<track-id>.json`, mirroring the slug structure. Loader walks the directory.
2. The Phase 0 schemas in `src/data/schemas.ts` are the authoritative validation surface. No second schema in `src/road/`.
3. `compileTrack(track)` is a pure function returning a `CompiledTrack` object that includes `warnings[]`. Hard errors throw `TrackCompileError`; soft lints are warnings.
4. Compiled segments use a fixed length of `SEGMENT_LENGTH = 6 m`, defined in `src/road/constants.ts`. `ceil(len / SEGMENT_LENGTH)` per authored segment.
5. Checkpoints map from authored indices to compiled indices at compile time. The race-rules engine consumes compiled checkpoints, not authored ones.
6. `hazardIds` is shared by reference between authored and compiled segments to avoid per-segment allocation. Output is `Object.freeze`-d.
7. Golden-master tests use explicit JSON snapshot files keyed by fixture name, not Vitest's `.snap` files. Update via `UPDATE_SNAPSHOTS=1`.
8. Five fixture tracks cover straight, curve, crest, full-shape, and boundary cases.
9. Snapshot pins first 30 segments fully + samples beyond, plus all checkpoints, warnings, and totals.
10. Unit tests cover algorithm assertions; golden-master tests cover end-to-end shape.

### Refinements to existing dots

The `implement-pseudo-3d-d4c30840` dot already lists `trackCompiler.ts` and a test file; that dot ships a minimal compiler with a single straight test track inline. The full content-loadable compiler (filesystem walk, fixture corpus, lint warnings, golden-master tests) is a larger surface and should be its own implement dot, gated after pseudo-3d lands so the projector can consume real authored data.

New implement dot proposed below: `implement: track compiler + golden-master tests`. The `implement-mvp-track` dot then depends on it, since each authored track needs the compiler to render.

### Followups produced

- F-NNN: build a `scripts/lint-tracks.ts` CLI that runs `safeParse` + `compileTrack` on every file under `src/data/tracks/`, printing warnings and failing on errors. `nice-to-have`. Unblocks human authors. Not Phase 1.
- F-NNN: build a `/dev/track?id=<id>` page that mounts the compiler + projector against any authored track for visual verification. Depends on the renderer dev page from `implement-pseudo-3d`. `nice-to-have`.
- F-NNN: extend the compiler later with a `RoadsideSet` registry so unknown roadside ids fail fast at compile rather than rendering as empty. `polish`.

### References

1. `.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md` Findings (segment compilation contract, `SEGMENT_LENGTH = 6`).
2. `docs/gdd/09-track-design.md` (track anatomy, length targets, hazards, community rules).
3. `docs/gdd/21-technical-design-for-web-implementation.md` (track data model, golden-master testing for track compilation).
4. `docs/gdd/22-data-schemas.md` (canonical Track JSON shape).
5. `src/data/schemas.ts` (existing Zod TrackSchema).
6. `src/data/examples/track.example.json` (canonical example).
