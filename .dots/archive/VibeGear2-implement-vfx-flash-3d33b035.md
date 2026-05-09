---
title: "implement: VFX flash + shake module with reduced-motion gate (split from visual-polish)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:17:16.439676-05:00\\\"\""
closed-at: "2026-04-26T03:39:09.734001-05:00"
close-reason: verified
---

## Description

Ship `src/render/vfx.ts` per stress-test item 6 / 7 of visual-polish-7d31d112: stateful pure module with `fireFlash`, `fireShake` (seeded for determinism), `tickVfx(state, dtMs)` (called in fixed-step loop), `drawVfx(ctx, state, viewport)` (called per-frame, returns dx/dy offset). `fireShake` is a no-op when `prefers-reduced-motion: reduce`; `fireFlash` is NOT gated.

## Context

Child of visual-polish-7d31d112. Source: §16 rendering, §17 art direction, AGENTS.md determinism rule. Shake seed channels through the §22 deterministic RNG so replays reproduce.

## Affected Files

- `src/render/vfx.ts` (new): `INITIAL_VFX_STATE`, `fireFlash`, `fireShake`, `tickVfx`, `drawVfx`, `refreshReducedMotionPreference`
- `src/render/__tests__/vfx.test.ts` (new)
- `src/render/pseudoRoadCanvas.ts` (update): apply drawVfx offset before road translate

## Edge Cases

- Multiple concurrent flashes: stack visually; tickVfx removes expired entries.
- Multiple concurrent shakes: amplitudes sum; bounded by max amplitude.
- prefers-reduced-motion changes mid-session: tests call `refreshReducedMotionPreference()` to invalidate cache.

## Verify

- [ ] `fireFlash({intensity:1, color:'#fff', durationMs:200})` decays to 0 over 200 ms (tickVfx 4 times by 50 ms).
- [ ] `fireShake` with seed produces deterministic offsets across two runs.
- [ ] Integral of shake offset over its duration is zero (no net drift); tolerance 1 px.
- [ ] With prefers-reduced-motion = reduce, fireShake is a no-op (state unchanged).
- [ ] fireFlash works regardless of reduced-motion preference.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
