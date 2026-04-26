# Contributing

Working notes for anyone adding code or content to VibeGear2. Start with the mandatory reading list in [`AGENTS.md`](../AGENTS.md) RULE 2: README, IMPLEMENTATION_PLAN.md, WORKING_AGREEMENT.md, GDD.md, then the recent dozen entries of PROGRESS_LOG.md. This file collects the smaller workflow conventions that did not warrant their own GDD section.

## Local checks before pushing

Per `WORKING_AGREEMENT.md` §6 the slice is not done until all four pass cleanly:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

End-to-end smokes run with `npm run test:e2e` (Playwright). They are slower; prefer running them after the four above are green. The `verify` and `verify:full` aliases chain them together:

```sh
npm run verify       # lint + typecheck + unit
npm run verify:full  # the above plus e2e
```

## Render perf bench

Source: `.dots/archive/VibeGear2-implement-render-perf-f5492ef1.md` (split from the `visual-polish` parent dot).

CI gates render perf via bundle size and Lighthouse, both deterministic. Frame-time numbers are not deterministic across machines, so we do not gate on them. Instead, run the bench locally before any PR that touches the renderer (parallax, dust, vfx, sprite atlas, the strip drawer, or the segment projector) and paste the output into the PR body so reviewers can spot regressions:

```sh
npm run bench:render
```

Sample output:

```
bench:render (CPU canvas, indicative only)
  frames           600
  mean        0.234 ms
  p50         0.221 ms
  p95         0.318 ms
  p99         0.412 ms
```

The bench drives `pseudoRoadCanvas.drawRoad` against a stub Canvas2D context for 600 frames with parallax bands, a full 64-particle dust pool, and an active VFX shake. The "CPU canvas, indicative only" label is intentional: jsdom's HTMLCanvasElement throws without the optional native `canvas` package, so the stub records nothing and the timings reflect only the JS-side draw pipeline. Absolute numbers are not comparable to a real browser; relative changes between runs on the same machine are.

The bench is invoked through Vitest (`vitest.bench.config.ts`) so the `@/` path aliases resolve, but it is excluded from the default `vitest.config.ts` include glob. `npm test` and CI never run it. If a future CI workflow wants to opt in, gate the step on `if [ "$RUN_BENCH" = '1' ]` so the default pipeline stays deterministic.

## Em-dashes

Per `AGENTS.md` RULE 1 there are no em-dashes anywhere in the repo. Before committing run:

```sh
grep -rn $(printf '\xe2\x80\x94') . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report --exclude-dir=test-results
```

The grep must return nothing. Use the same recipe with `\xe2\x80\x93` to catch en-dashes (U+2013).

## Logging the loop

Every slice ends with three writes per `AGENTS.md` RULE 5:

1. New `PROGRESS_LOG.md` entry at the top of the file.
2. Any unresolved decisions appended to `OPEN_QUESTIONS.md` as `Q-NNN` entries.
3. Any deferred work appended to `FOLLOWUPS.md` as `F-NNN` entries with a priority.

If the slice produced anything that another agent would need to know to pick up where you left off, write it down in those three files.
