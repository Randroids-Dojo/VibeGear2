---
title: "implement: sprite atlas loader + frame index math (split from visual-polish)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:16:53.167568-05:00\\\"\""
closed-at: "2026-04-26T03:26:36.154896-05:00"
close-reason: verified
---

## Description

Ship `src/render/spriteAtlas.ts` with the API pinned in stress-test item 2 of `VibeGear2-implement-visual-polish-7d31d112`: `loadAtlas(meta)`, `frame(atlas, spriteId, frameIdx)` (modulo on frame, throw on unknown sprite), AtlasFrame / AtlasMeta / LoadedAtlas types, fallback magenta on image load failure. Add `AtlasMetaSchema` (Zod) to `src/data/schemas.ts` per stress-test item 3.

## Context

This dot is a child of visual-polish-7d31d112 per its self-recommendation to split. Source of truth: `docs/gdd/16-rendering-and-visual-design.md` (sprites), `docs/gdd/17-art-direction.md` (car sprites: 12-16 directional frames + 3 damage variants).

## Affected Files

- `src/render/spriteAtlas.ts` (new)
- `src/render/__tests__/spriteAtlas.test.ts` (new)
- `src/data/schemas.ts` (update): AtlasMetaSchema
- `src/data/atlas/cars.json` (new fixture): 12-16 frames + 3 damage variants for one car
- `src/data/atlas/roadside.json` (new fixture): 5 prop categories

## Edge Cases

- Out-of-range frameIdx: modulo wrap (do not throw).
- Unknown spriteId: throw RangeError (programming error).
- Image load failure: fallback magenta rect; logs `console.error('[atlas]', path)` once.
- AtlasMeta with empty frames array: Zod rejects (min(1)).

## Verify

- [ ] AtlasMetaSchema rejects empty frames; accepts the cars.json and roadside.json fixtures.
- [ ] `frame(atlas, 'sparrow', 17)` with 12 frames returns frame 5 (modulo).
- [ ] `frame(atlas, 'unknown', 0)` throws RangeError.
- [ ] Image load failure: spy on Image.onerror; loader resolves with `fallback: true`.
- [ ] Determinism: same input -> same output.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
