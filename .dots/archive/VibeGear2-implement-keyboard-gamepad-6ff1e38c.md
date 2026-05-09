---
title: "implement: keyboard + gamepad input layer per §19"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:38.094522-05:00\\\"\""
closed-at: "2026-04-26T01:51:04.122932-05:00"
close-reason: verified
---

## Description

Build a deterministic input layer that maps keyboard and gamepad events to a stable `Input` shape (steer in [-1, 1], throttle [0, 1], brake [0, 1], nitro bool, pause bool). Sample once per sim tick, not per browser event.

## Context

Phase 1 prerequisite. Source of truth is `docs/gdd/19-controls-and-input.md`. Determinism (one sample per fixed step) is required for the replay/ghost system specified in `docs/gdd/21-technical-design-for-web-implementation.md`.

## Affected Files

- `src/game/input.ts` (new): subscribe to keyboard + Gamepad API, expose `sample() -> Input`
- `src/game/__tests__/input.test.ts` (new): mock event sequences and assert sampled shape
- `src/app/dev/input/page.tsx` (new): dev-only page showing the live input shape

## Edge Cases

- Two keys mapped to opposite directions held simultaneously: steer = 0 (cancellation rule).
- Gamepad disconnect mid-race: fall back to keyboard, do not crash.
- Browser focus lost: clear all held keys (no stuck inputs).
- Touch / mobile: out of scope for this slice (note as F-NNN if surfacing).

## Verify

- [ ] Unit tests pass for keyboard event mapping and cancellation rule.
- [ ] `/dev/input` shows live values that match held keys / gamepad axes.
- [ ] Tab blur clears held-key state.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
