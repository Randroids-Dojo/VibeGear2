---
title: "implement: render perf benchmark script (npm run bench:render) (split from visual-polish)"
status: closed
priority: 5
issue-type: task
created-at: "\"\\\"2026-04-26T03:17:40.586458-05:00\\\"\""
closed-at: "2026-04-26T03:55:38.986234-05:00"
close-reason: verified
---

## Description

Per stress-test item 9 of visual-polish-7d31d112: move the fragile Vitest perf assertion to a manual `npm run bench:render` script that prints frame time stats. CI gate stays on bundle-size + Lighthouse (already covered by ci-bundle-57af4a04). PR review investigates regressions.

## Context

Child of visual-polish-7d31d112. Source: AGENTS.md (CI must be deterministic; Vitest perf gates are not). The bench prints; it does not gate.

## Affected Files

- `scripts/bench-render.ts` (new): boots a headless canvas, runs pseudoRoadCanvas.draw with 60 sprites and parallax for 600 frames, prints mean / p50 / p95 / p99 frame time
- `package.json` (update): `bench:render` script
- `docs/CONTRIBUTING.md` (update): document running the bench locally before perf-affecting PRs

## Edge Cases

- jsdom canvas does not support GPU; the bench notes this and labels its result as 'CPU canvas, indicative only'.
- CI does not run the bench by default; gate via `if [ "" = '1' ]` in CI workflow.

## Verify

- [ ] `npm run bench:render` runs to completion and prints a summary table.
- [ ] Output format includes mean, p50, p95, p99 frame time in ms.
- [ ] CONTRIBUTING.md describes the workflow.
- [ ] Script does not run by default in CI.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
