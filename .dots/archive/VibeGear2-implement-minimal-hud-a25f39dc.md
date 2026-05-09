---
title: "implement: minimal HUD (speed, lap, position) per §20"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:41.585787-05:00\\\"\""
closed-at: "2026-04-26T02:05:41.177247-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-arcade-physics-2efae8b6
---

## Description

First-pass HUD: speed (kph), current lap / total laps, and current position (1st of N). Render in canvas overlay so it shares the rAF cadence with the road renderer. Read units from save settings (default kph).

## Context

Phase 1 vertical slice goal in `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/20-hud-and-ui-ux.md`. Polish slice (separate dot) handles full HUD treatment later.

## Affected Files

- `src/render/uiRenderer.ts` (new): pure draw `(ctx, hudState) -> void`
- `src/game/hudState.ts` (new): derive HUD state from race state
- `src/game/__tests__/hudState.test.ts` (new): position calculation, lap rounding

## Edge Cases

- Lap 0 (pre-countdown): show "1 / N" placeholder, not "0".
- Position when no opponents: "1 / 1".
- Speed when reversing: show absolute value (no negative number on HUD).

## Verify

- [ ] Unit tests pass for HUD state derivation.
- [ ] HUD visible in `/dev/road` while driving; values change with speed and lap progress.
- [ ] HUD does not flicker between sim ticks (uses interpolated state).
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
