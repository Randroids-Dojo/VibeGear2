---
title: "implement: parallax bands renderer (sky / mountains / hills) (split from visual-polish)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:17:03.257954-05:00\\\"\""
closed-at: "2026-04-26T03:32:29.808672-05:00"
close-reason: verified
---

## Description

Ship `src/render/parallax.ts` with the API pinned in stress-test item 4 of visual-polish-7d31d112: `drawParallax(ctx, layers, camera, viewport)`, ParallaxLayer type with scrollX / bandHeight / yAnchor, factors 0.0 (sky) / 0.25 (mountains) / 0.6 (hills), no curvature contribution.

## Context

Child of visual-polish-7d31d112. Source: `docs/gdd/16-rendering-and-visual-design.md`. Parallax derives only from `camera.x` and `camera.z`, not per-segment curvature, to avoid double-shifting.

## Affected Files

- `src/render/parallax.ts` (new)
- `src/render/__tests__/parallax.test.ts` (new)
- `src/render/pseudoRoadCanvas.ts` (update): hook before road drawing
- `public/art/parallax/*.png` (new placeholders): sky, mountains, hills

## Edge Cases

- High-curve track: variance in parallax-frame-delta bounded by 2 px / 600 frames.
- Camera-x outside layer image extent: tile horizontally.
- yAnchor = 1: layer aligns to viewport bottom.

## Verify

- [ ] `drawParallax` produces a translation sequence whose first-difference variance is <= 2 px over a 600-frame fixture.
- [ ] Three layers (sky 0.0, mountains 0.25, hills 0.6) draw in back-to-front order; spy on ctx.drawImage call order.
- [ ] Tiling: camera.x = 10000 with layer image width 512 still draws.
- [ ] Determinism: same camera path -> same offsets.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
