---
title: "implement: pseudo-3D road renderer (Canvas2D, single straight track)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:29.264256-05:00\\\"\""
closed-at: "2026-04-26T01:37:46.731768-05:00"
close-reason: verified
blocks:
  - VibeGear2-research-pseudo-3d-3b818fa6
---

## Description

Build the pseudo-3D road renderer per the spec in `.dots/VibeGear2-research-pseudo-3d-3b818fa6.md` "Findings". Adopt the Gordon / Lou's Pseudo-3D recipe: pure-function projector + Canvas2D strip drawer + back-to-front loop with `maxY` clip.

Phase 1 scope is a single straight test track (no curves, no hills) so the projector and drawer can be exercised without requiring the curve/grade authoring path to land first. Curve accumulation and hill rendering are coded but exercised more thoroughly in a follow-up slice with real authored content.

## Context

Phase 1 vertical slice prerequisite. The road renderer is the visible feature that proves the pseudo-3D approach works. `docs/gdd/16-rendering-and-visual-design.md` describes the visible characteristics; `docs/gdd/21-technical-design-for-web-implementation.md` §rendering pipeline specifies the pipeline shape; `docs/gdd/09-track-design.md` §"Road curvature" and §"Lane width" pin road dimensions.

All math, constants, and module layout are pinned in the research dot's Findings.

## Affected Files

- `src/road/constants.ts` (new): `ROAD_WIDTH`, `SEGMENT_LENGTH`, `DRAW_DISTANCE`, `FOV_DEGREES`, `CAMERA_HEIGHT`, `CAMERA_DEPTH`, `CURVATURE_SCALE`, stripe lengths, `SPRITE_BASE_SCALE`.
- `src/road/types.ts` (new): `Camera`, `Viewport`, `CompiledSegment`, `Strip`.
- `src/road/trackCompiler.ts` (new): `compileTrack(track: Track) -> CompiledSegment[]`. Expands authored variable-length segments into fixed `SEGMENT_LENGTH` blocks.
- `src/road/segmentProjector.ts` (new): pure `project(segments, camera, viewport) -> Strip[]`. Includes curve and grade accumulation + maxY culling pre-pass.
- `src/road/__tests__/segmentProjector.test.ts` (new): float-tolerant unit tests for straight, constant curve, and crest cases.
- `src/road/__tests__/trackCompiler.test.ts` (new): segment count and worldZ correctness; ring-buffer wrap-around.
- `src/render/pseudoRoadCanvas.ts` (new): consumes `Strip[]`, draws sky band + grass + rumble + road + lane markings via Canvas2D `drawTrapezoid` helpers.
- `src/app/dev/road/page.tsx` (new): dev-only client component that mounts the renderer with a hard-coded straight track and a slowly-advancing camera for visual verification at `/dev/road`.

## Edge Cases

- Camera z near 0 or `cameraDepth`: handle without divide-by-zero (return null strip).
- Empty segment list: render only the sky band, no crash.
- Viewport width or height 0: bail before pre-pass.
- Camera z past last segment: ring-buffer wrap (mod totalSegments).
- `drawDistance > totalSegments`: cap.
- NaN/Infinity in segment fields: log once at compile, treat as 0.

## Verify

- [ ] Unit tests pass for `segmentProjector.ts`: straight track yields monotonic screenY/screenW, crest culls at least one strip via maxY.
- [ ] Unit tests pass for `trackCompiler.ts`: count matches `ceil(sum(len) / SEGMENT_LENGTH)`, ring wrap correct.
- [ ] Visiting `/dev/road` shows a clean straight road with alternating grass/rumble bands animating outward (camera moving forward).
- [ ] Browser console has no errors or warnings.
- [ ] Renderer maintains 60 fps on a 2020-class laptop (note manual measurement in PROGRESS_LOG.md).
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
