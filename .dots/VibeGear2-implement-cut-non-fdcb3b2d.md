---
title: "implement: cut non-tour modes for World-Tour-only v1.0 scope"
status: partial
priority: 1
issue-type: task
created-at: "2026-05-06T12:52:19.260689-05:00"
---

## Description

Remove Quick Race, Time Trial, Daily Challenge, and Practice modes from the live build so v1.0 ships exactly the World Tour championship loop (per the Top Gear 2 reference). Strip the Next.js routes, title-screen menu items, related state machines, and dead tests. Update GDD section 6 (Game modes) to mark non-Tour modes as out-of-scope for v1.0; reconcile downstream followups (F-NNN entries that touched cut modes get append-only superseded-by notes).

## Context

The user explicitly answered Q-015 (2026-05-06) with: 'Gut any feature not related to the world tour mode (the whole idea is to match TopGear2).' Top Gear 2's primary loop is the championship; ancillary modes dilute the focus. Cutting them lets every fun-factor slice (lateral fix, prop calibration, lap bump, grid stretch, AI archetypes, music intensity, weather grip, FOV widen, tire-scrub) compound on a single race surface instead of paying integration costs across four modes.

This slice supersedes VibeGear2-implement-quick-race-78084a95 (the Quick Race grid-density slice). The renderer cull move (200m -> 600m with alpha fade) still applies but is preserved separately in VibeGear2-implement-lift-opponent-8764ce5e.

## Affected files

The implementor walks these paths and decides per-route whether to delete the directory or leave a redirect.

- src/app/quick-race/ (route + page)
- src/app/time-trial/ (route + page)
- src/app/daily/ (route + page)
- src/app/race/page.tsx (entry handling for non-Tour, especially the tourContext == null path)
- src/app/page.tsx (title-screen menu items pointing at cut modes)
- src/components/track-editor/ (only if exclusively a non-Tour surface; verify before cutting)
- src/game/timeTrial.ts, src/game/dailyChallenge.ts, src/game/practice.ts (or wherever those state machines live; grep first)
- src/leaderboard/ (Time Trial submission paths if they exist)
- e2e/ specs that drive the cut routes
- tests/ unit tests covering the cut modules
- docs/gdd/06-game-modes.md (mark non-Tour modes out-of-scope for v1.0)
- docs/gdd/24-content-plan.md (Daily Challenge / Time Trial entries)
- docs/FOLLOWUPS.md (mark obsolete F-NNN with append-only superseded-by notes; do NOT delete)
- docs/GDD_COVERAGE.json (update coverage arrays for rows touching cut modes; mark out_of_scope_v1 with a note)

## Implementation notes

- This is the LARGEST slice in the plan. Land it as ONE PR but carefully reviewed; the diff will be net-negative LOC because it strips features.
- DO NOT remove section 6 from the GDD. Add a 'v1.0 scope' prefix to the section header and an explicit 'Non-Tour modes (Quick Race, Time Trial, Daily Challenge, Practice) are deferred post-v1.0 per the 2026-05-06 Q-015 resolution' subsection at the top.
- The title screen should still feel complete: replace the cut-mode buttons with World Tour, Garage, Options. This is a few lines per the existing menu-theme code.
- Make sure /race (the actual race-running route) still works under Tour entry; the entry conditional that branched on tourContext becomes a guard.
- The leaderboard backend, if Time-Trial-only, can be either deleted or repurposed to Tour ghost runs; defer that decision to a follow-up Q-NNN if the implementor finds the entanglement is non-trivial.
- Recommended PR size guard: if the diff exceeds ~1500 LOC delta, split into two PRs (route delete + page surface; tests + docs).
- This slice does not depend on any other slice landing first; it is independent and unblocks everything else by simplifying the surface. Use blocks: (not after:) per the iter-6 finding.

### Iteration 14 update (2026-05-06): Q-019 resolved with label `deprecated`

- The coverage-ledger marker chosen by the user is `deprecated` (NOT `out-of-scope-v1` as recommended). Same structural shape as option (a) in Q-019, different label string.
- The enum extension lives at `scripts/content-lint.ts:589-594`. One-line addition: append `"deprecated"` to the `COVERAGE_KINDS` tuple so it reads `["implemented-code", "automated-test", "open-followup", "open-question", "deprecated"] as const`.
- Rows with `coverage: ["deprecated"]` are treated as documentation only by content-lint; no `implementationRefs` validation, no `testRefs` validation. The `coverage` array can mix values (e.g. `["deprecated", "open-followup"]` for a cut row that has a tracking F-NNN).
- The seven coverage-ledger rows that get `coverage: ["deprecated"]`:
  - `GDD-06-DAILY-CHALLENGE-SELECTION`
  - `GDD-06-DAILY-CHALLENGE-RESULT-SHARE`
  - `GDD-06-TIME-TRIAL-PB-RECORDS`
  - `GDD-06-TIME-TRIAL-BENCHMARK-LAUNCH`
  - `GDD-06-TIME-TRIAL-DOWNLOADED-GHOST`
  - `GDD-06-QUICK-RACE-MODE`
  - `GDD-06-PRACTICE-MODE`
- The two coverage-ledger rows that stay in scope but need their `requirement` text amended to drop cut-mode references (their `coverage` array is unchanged):
  - `GDD-04-FIRST-RACE-FUN-LOOP`
  - `GDD-20-PAUSE-GHOSTS-ACTION`
- Iteration 13 §B in `docs/RESEARCH_TOPGEAR_FUN_PLAN.md` remains the canonical per-row edit text. This iter-14 update only changes the label string from `out-of-scope-v1` to `deprecated`; everything else (which rows, what `requirement` text amendments, which `implementationRefs` survive) stays as iter-13 specified.
- The "Verify" check `docs/GDD_COVERAGE.json rows for cut modes have coverage: [out_of_scope_v1] and a note` should be read as `coverage: ["deprecated"]` per this iter-14 resolution.

## Verify (concrete acceptance)

- npm run typecheck clean
- npm run lint clean
- npm run test 0 failures, all suites green (cut tests removed not skipped)
- npm run build produces no /quick-race, /time-trial, /daily routes in the build manifest
- e2e/ Playwright spec world-tour-only-scope.spec.ts (NEW) drives the title screen, confirms only Tour / Garage / Options buttons present, navigates Tour, runs one race
- docs/gdd/06-game-modes.md shows the v1.0 scope prefix and the post-v1.0 deferral note
- docs/FOLLOWUPS.md has an append-only superseded-by note on every F-NNN that referenced cut modes
- docs/GDD_COVERAGE.json rows for cut modes have coverage: [out_of_scope_v1] and a note
- No regression in Tour-mode race flow (existing race-finish e2e specs still pass)

