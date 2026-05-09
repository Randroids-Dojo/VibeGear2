---
title: "implement: minimap module (projection + canvas drawcall) split from hud-ui"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:33:25.348165-05:00\\\"\""
closed-at: "2026-04-26T04:17:54.247459-05:00"
close-reason: verified
---

## Description

Build the standalone minimap module per `docs/gdd/21-technical-design-for-web-implementation.md` (`src/road/minimap.ts` is listed in the recommended module structure) and `docs/gdd/20-hud-and-ui-ux.md` ("simplified minimap or progress strip"). Currently the `implement-hud-ui-6c1b130d` dot bundles minimap with seven other surfaces and its own stress-test recommends splitting. This dot owns the minimap end-to-end so it can land independently of the broader HUD polish slice.

## Context

§21 Recommended module structure pins `src/road/minimap.ts` as a first-class module. §20 lists "simplified minimap or progress strip" under Race HUD and the wireframe puts the minimap in the bottom-left damage / weather grip cluster. §22 Track schema declares `minimap points` ("per §21 Track data model: minimap points") but the current `TrackSchema` in `src/data/schemas.ts` does not yet expose them; this dot adds the field.

The hud-ui dot's stress-test recommends "implement: minimap projection + render" as one of six split-out children. This dot fills that recommendation.

## Affected Files

- `src/road/minimap.ts` (new): pure module
  - `projectTrack(track, options) => readonly {x: number; y: number; segmentIndex: number}[]` (one point per segment, normalized to a unit rectangle by integrating curve / heading along the track)
  - `projectCar(track, points, segmentIndex, segmentProgress) => {x: number; y: number}` (locates a car along the precomputed point list with linear interpolation)
  - `fitToBox(points, box) => points` (uniform-scale points into a target rectangle preserving aspect ratio; centers within the box)
- `src/road/__tests__/minimap.test.ts` (new): cell-level fixtures
- `src/render/hudMinimap.ts` (new): pure drawcall builder
  - `drawMinimap(ctx, projectedPoints, cars, layout) => void` issues stroke-path for the track and one filled circle per car (player highlighted)
- `src/render/__tests__/hudMinimap.test.ts` (new): mock-canvas drawcall snapshot
- `src/data/schemas.ts` (modify): optional `Track.minimapPoints?: readonly {x: number; y: number}[]` (override projected points for hand-authored tracks; falls back to `projectTrack` when absent)
- `src/road/trackCompiler.ts` (modify): if `track.minimapPoints` is present, emit them on the compiled track; otherwise emit the projection result
- `src/game/hudState.ts` (modify): optional `minimap?: {points: readonly {x: number; y: number}[]; cars: readonly {x: number; y: number; isPlayer: boolean}[]}`

## Pinned projection algorithm

Per-segment heading integration:
- Start at heading 0, position (0, 0).
- For each segment, accumulate heading by `segment.curve * normalizedLength` and position by `(cos heading, sin heading) * segment.len`.
- Output one point per segment plus a final closing point.
- Snap the closing point to (0, 0) by uniformly scaling the path so loops close cleanly even when curve integrals do not exactly match.

This is fast (O(n)) and runs at compile time, not per-frame.

## Edge Cases

- Track with one segment: minimap shows a dot. Test asserts one point in output.
- Track that does not loop (open-ended track): closing snap still applies; the track may appear slightly distorted. Document as intentional.
- Author-overridden `minimapPoints`: trackCompiler honors them verbatim; projection skipped.
- Aspect ratio: `fitToBox` preserves it; a long thin track centers vertically in the box and uses the full horizontal span.
- Car off-track: clamp segmentIndex / segmentProgress to track bounds before projection; no NaN.
- Resize: layout box passed in fresh each frame; the projection is precomputed once.
- Colorblind mode (`settings.accessibility.colorBlindMode !== "off"`): player car uses a distinct shape (square) not just color; cell-level test covers this.
- Determinism: `projectTrack(sameInput)` returns deep-equal output across calls.

## Verify

- [ ] `projectTrack` for an 80-segment track returns 80 points all within the unit rectangle after `fitToBox` to `{x: 0, y: 0, w: 1, h: 1}`.
- [ ] `projectCar` linear interp: at `segmentProgress: 0.5` between points (0, 0) and (1, 0) returns `{x: 0.5, y: 0}`.
- [ ] One-segment track returns one point.
- [ ] Aspect preservation: a long-thin track (20:1 length:width ratio) projected into a square box uses 100% horizontal span and ~5% vertical span.
- [ ] Author override: a track with `minimapPoints: [{x: 0, y: 0}, {x: 1, y: 0}]` produces those exact points after compilation regardless of segment data.
- [ ] Schema validation: `minimapPoints` of length zero rejected; non-array rejected; missing field accepted.
- [ ] HUD drawcall snapshot: one stroke path drawcall plus N circle drawcalls (one per car); player car is highlighted (different fillStyle or shape).
- [ ] Colorblind: player car shape differs (square) not just color.
- [ ] Pure: `projectTrack` is deterministic; no Math.random, no Date.now.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` are green.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/road/minimap.ts src/render/hudMinimap.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/21-technical-design-for-web-implementation.md` (Suggested module structure: `src/road/minimap.ts`)
- `docs/gdd/20-hud-and-ui-ux.md` (Race HUD: simplified minimap or progress strip; Wireframe bottom-left)
- `docs/gdd/22-data-schemas.md` (Track data model: minimap points)
