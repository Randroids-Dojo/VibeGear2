---
title: "implement: content budget tests (32 tracks / 6 cars cap) per §27 scope-creep mitigation"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:45:24.534781-05:00\\\"\""
closed-at: "2026-04-26T07:26:02.590650-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Add a Vitest test suite that enforces the v1.0 content budget hard-locked by GDD §27: "32 tracks and 6 cars". The suite walks `src/data/tracks/**`, `src/data/cars/**`, and the championship JSON, asserts counts, and fails the build if the project exceeds the cap. Closes the GDD §27 "scope creep" mitigation.

## Context

GDD §27 names the scope-creep mitigation as a hard cap of 32 tracks and 6 cars for v1.0. The cap is reinforced by `docs/gdd/24-content-plan.md` ("32 tracks", "6 playable cars" under "Full v1.0 content"). MVP is 8 tracks, 3 cars per §24, also enforced. Existing dots author the content (`implement-mvp-track-0e1b2918`, `implement-car-set-26dc37be`); none enforces the cap.

Without enforcement, a future contributor (or future agent loop) could land a 33rd track without anyone noticing the scope explosion. The cap is the entire mitigation per §27. This is a small Vitest slice, not a heavy infrastructure change.

The test must accept a documented exemption pattern so explicit GDD revisions can move the cap. The exemption: the cap lives in a single `src/data/content-budget.ts` constant exported as `CONTENT_BUDGET = { tracks: 32, cars: 6, mvpTracks: 8, mvpCars: 3 }`. Changing the cap requires editing both the constant and the GDD §27 row in the same PR.

## Affected Files

- `src/data/content-budget.ts` (new): constants module with the four cap numbers; export `CONTENT_BUDGET`.
- `src/data/__tests__/content-budget.test.ts` (new): walks the data directories with `fs.readdirSync` (synchronous is fine; this is a test). Asserts:
  - `src/data/tracks/**/*.json` count is at most `CONTENT_BUDGET.tracks` (32).
  - `src/data/cars/*.json` count (excluding `index.ts`) is at most `CONTENT_BUDGET.cars` (6).
  - `src/data/championship.json` lists every shipped track id (no orphaned tracks; no missing tracks).
  - `src/data/cars/index.ts` re-exports every car JSON in the directory (no orphans).
- `docs/gdd/27-risks-and-mitigations.md` (existing): no edit; the cap text is already there.
- `docs/PROGRESS_LOG.md` (existing): standard slice entry per WORKING_AGREEMENT §6.

## Edge Cases

- Subdirectory tracks (e.g. `src/data/tracks/velvet-coast/harbor-run.json`): counted as one track. Recursion via `**/*.json`.
- A non-track JSON inside `src/data/tracks/` (e.g. a regional metadata file): excluded via a top-level filename allowlist or by reading and rejecting any file that fails `TrackSchema.safeParse`. Pick the latter: if it parses as a track, it counts.
- A track JSON that fails schema validation: the test fails with a clear "track at path X failed schema; not counted toward budget" message rather than silently passing.
- The MVP cap is enforced as `cars >= MVP and cars <= V1`; the v1.0 cap is `cars <= V1`. A test can be at either tier; the wording in the test name calls out which tier is being asserted.
- The `championship.json` orphaned-track check needs the championship dot (`implement-tour-region-d9ca9a4d`) to have shipped. If not, gate that sub-assertion behind a `try / catch` that logs a warning rather than blocks.
- Stretch content (daily challenge, reverse tracks per §24) is out of the v1.0 cap because it is in a separate "Stretch content" section. Document this in the test.

## Verify

- [ ] `npm run test` includes the new suite and it is green at current track / car counts.
- [ ] Adding a 7th car JSON to `src/data/cars/` causes the suite to fail with a clear cap-exceeded message.
- [ ] `CONTENT_BUDGET` constant is the only source of truth; no other test file inlines the numbers.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/27-risks-and-mitigations.md` (scope-creep row).
- `docs/gdd/24-content-plan.md` ("Full v1.0 content").
