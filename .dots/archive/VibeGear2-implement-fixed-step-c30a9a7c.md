---
title: "implement: fixed-step simulation loop (60 Hz) with rAF interpolation"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:32.013433-05:00\\\"\""
closed-at: "2026-04-26T01:25:18.449217-05:00"
close-reason: Implemented fixed-step 60 Hz loop with rAF and accumulator catch-up. 11 unit tests cover step counts, fractional remainder carry, spiral-of-death cap, negative dt, stop idempotency, and end-to-end scheduler run. /dev/loop page added for manual fps/tick verification. Lint, typecheck, all 56 tests, and next build pass on branch feat/fixed-step-loop.
blocks:
  - VibeGear2-implement-data-schemas-4dd373bc
---

## Description

Implement the fixed-step (1/60 s) simulation loop with rAF render and accumulator-based catch-up, as specified in `docs/gdd/21-technical-design-for-web-implementation.md` §game loop.

```
renderLoop (rAF):
  accumulate dt
  while accumulator >= fixedStep:
    simulateRace(1/60)
  renderFrame(interpolatedState)
```

## Context

Phase 1 prerequisite for any deterministic gameplay. Determinism is required by `AGENTS.md` RULE 8 (deterministic tests for physics/AI/economy) and `docs/gdd/15-cpu-opponents-and-ai.md` (replay testing).

## Affected Files

- `src/game/raceState.ts` (new): immutable state shape and `step(state, input, dt) -> state` skeleton
- `src/game/loop.ts` (new): the rAF accumulator loop, takes `simulate` and `render` callbacks
- `src/game/__tests__/loop.test.ts` (new): step count for known elapsed times; spiral-of-death prevention (cap accumulator)
- `src/app/dev/loop/page.tsx` (new): dev-only page that runs the loop and prints fps + sim ticks

## Edge Cases

- Tab inactive then resumed (huge dt): cap accumulator to a max (e.g., 250 ms) so the sim does not freeze trying to catch up.
- Fractional accumulator left over: pass interpolation alpha to render callback.
- First frame: `lastTime = now()`, no sim ticks fired.

## Verify

- [ ] Unit tests pass: 100 ms elapsed at 60 Hz produces exactly 6 sim ticks (with 4 ms remainder).
- [ ] `npm run typecheck` exits 0.
- [ ] `/dev/loop` renders a counter at 60 fps with no console errors.
- [ ] Manually backgrounding the tab for 5 s does not stall the page on resume.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
