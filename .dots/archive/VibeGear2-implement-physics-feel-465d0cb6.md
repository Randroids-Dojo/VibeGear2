---
title: "implement: physics-feel benchmark tracks + ghost-replay regression test"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:45:27.619526-05:00\\\"\""
closed-at: "2026-04-30T01:11:39.575542-05:00"
close-reason: "Merged PR #118, main CI green, CodeQL green, Vercel production deploy verified, production smoke passed, and physics-feel benchmark replays shipped."
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Author three small benchmark tracks designed to exercise specific physics-feel facets (straight acceleration, sweeping curve grip, mid-corner brake-and-recovery) and ship a deterministic ghost-replay regression test that fails the build if a physics tuning change moves the reference lap time by more than a configurable tolerance. Closes the GDD §27 "physics feel" mitigation clause "replayable benchmark tracks".

## Context

GDD §27 names "fixed-step sim, tight prototyping, replayable benchmark tracks" as the physics-feel mitigation. The fixed-step sim is shipped (`src/game/loop.ts`, branch `feat/fixed-step-loop`). Tight prototyping is procedural. Replayable benchmark tracks is the gap.

The benchmark suite is intentionally small (three tracks, not the MVP track set) because its purpose is fast feedback for the human tuning physics, not content. Each track is hand-authored to stress one feel facet and is run by the regression test with a recorded scripted-input sequence (the same `Input` stream every run; ghost replay determinism is the contract).

The lap-time delta tolerance is loose by default (`+/- 5%` of the reference) so trivial refactors do not trip the test, but the test fails the build on regressions outside that band. The tolerance is a constant in the test file so a deliberate tuning change updates the constant in the same PR that updates the physics constants, with a PROGRESS_LOG.md justification.

Depends on `implement-arcade-physics-2efae8b6` (the physics step exists), `implement-11995c69` (the track compiler exists), and `implement-ghost-replay-7ea6ffaa` (the ghost replay system exists). Blocks `implement-tagged-release-b3d30084`.

## Affected Files

- `src/data/tracks/_benchmark/straight-accel.json` (new): straight track, no curves, used to measure 0-to-top-speed time.
- `src/data/tracks/_benchmark/sweeping-curve.json` (new): one long constant-radius curve, used to measure mid-curve grip.
- `src/data/tracks/_benchmark/brake-and-recover.json` (new): straight then sharp curve then straight, used to measure brake-and-recovery lap time.
- `src/data/tracks/_benchmark/inputs/straight-accel.json` (new): scripted input stream (array of `{frame, input}` entries) producing a deterministic run.
- `src/data/tracks/_benchmark/inputs/sweeping-curve.json` (new).
- `src/data/tracks/_benchmark/inputs/brake-and-recover.json` (new).
- `src/data/tracks/_benchmark/expected/<track>.json` (new, three files): reference lap times and key sample points (speed at frame 60, 120, 240). Generated once by running the suite with `UPDATE_BENCHMARK=1` and committing the JSON.
- `src/game/__tests__/physics-feel.bench.test.ts` (new): runs each benchmark track, replays the scripted input, asserts lap time within `+/- BENCHMARK_TOLERANCE` of expected. Tolerance is `0.05` (5%) by default; documented in the test header.
- `src/data/__tests__/tracks-content.test.ts` (existing per `implement-mvp-track-0e1b2918`): exclude `_benchmark` directory from the v1.0 budget count (these tracks are not user-facing content; they are dev tooling).
- `src/data/content-budget.ts` (created in `implement-content-budget-e42cd8f9`): exclude `_benchmark` from the cap.

## Edge Cases

- A scripted input stream that produces a lap that does not finish (player flies off the track): the test fails with a clear message, not an infinite loop. Test runs a max-frame guard (e.g. 60 seconds of sim = 3600 frames).
- Benchmark tracks must not be selectable in the regular track-select UI (they are dev-tier). The track compiler should accept them; the UI track loader filters by directory prefix `_`.
- The expected lap times depend on the physics tuning at commit time. When physics changes intentionally, the dev runs `UPDATE_BENCHMARK=1 npm run test:bench`, reviews the diff, and commits the new expected JSON in the same PR. PROGRESS_LOG.md must justify the change.
- Cross-platform float determinism: pin the test to a single Node version (which is already pinned in `.nvmrc`); document this in the test header.
- A run that takes more than 30 seconds in CI: the suite fast-fails; benchmarks are simulation only, no rendering, so this should never happen in practice.

## Verify

- [ ] Three benchmark tracks compile against the track compiler (golden-master suite is unaffected).
- [ ] Three benchmark runs produce stable lap times across 100 invocations (variance is exactly zero; the sim is deterministic).
- [ ] Changing a physics constant by 10% trips at least one benchmark; reverting the change makes the suite green again.
- [ ] `UPDATE_BENCHMARK=1` regenerates the expected JSON cleanly.
- [ ] `_benchmark` directory is excluded from the user-facing track count and from the v1.0 cap.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/27-risks-and-mitigations.md` (physics-feel row).
- `docs/gdd/10-driving-model-and-physics.md` (physics contract).
- `docs/gdd/21-technical-design-for-web-implementation.md` ("Testing approach": deterministic replay tests).
