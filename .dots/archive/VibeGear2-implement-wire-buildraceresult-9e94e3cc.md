---
title: "implement: wire buildRaceResult into natural race-finish flow + push to /race/results per F-038"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T09:24:55.019109-05:00\\\"\""
closed-at: "2026-04-26T09:41:38.453784-05:00"
close-reason: verified
---

## Description

Wire the natural race-finish path in `src/app/race/page.tsx` to build a `RaceResult`, write it to the session-storage handoff, and route to `/race/results`. The `feat/race-results-screen` slice (commit `e1129b7`) shipped the pure builder `buildRaceResult` and the standalone `/race/results` page, and the `feat/pause-actions` slice (commit `8756804`) wired the same flow for the **retire** branch only. The **natural finish** branch (`session.race.phase === "finished"` in the render callback at `src/app/race/page.tsx`) still does nothing beyond setting `resultMs` for the inline overlay — the §20 results screen is unreachable from a normal multi-lap race against AI. This dot owns that wiring.

## Context

`docs/gdd/05-core-gameplay-loop.md` puts the results screen between the race and the garage in the inter-race loop. `docs/gdd/20-hud-and-ui-ux.md` Results-screen section enumerates the visible fields fed by `buildRaceResult`. `docs/FOLLOWUPS.md` F-038 captures the unwired-producer pattern (mirrors F-026 / F-032 / F-034 / F-035 / F-036 / F-037). The retire branch in `src/app/race/page.tsx` (`retireFnRef.current = ...`) already demonstrates the call sequence: `buildFinalRaceState` -> `buildRaceResult` -> `saveRaceResult` -> tear-down loop / input -> `router.push("/race/results")`. The natural-finish branch should mirror that sequence exactly, except the player car finished naturally (not coerced to DNF) and `recordPBs` should be `true` (this is the canonical PB-eligible finish).

The natural-finish branch fires inside `render()` of the `startLoop` callback when `session.race.phase === "finished"` first becomes true. The wiring must be idempotent (the render callback fires per frame) and must guard against double-routing — the easiest pattern is a `routedRef` that flips on first finish, gating both `saveRaceResult` and `router.push`.

`src/components/pause/usePauseActions.ts`, `src/game/raceSessionActions.ts`, and the per-car DNF tracking from `7bc1c1c` are not in scope; this dot is purely the natural-finish glue in `src/app/race/page.tsx`.

## Affected Files

- `src/app/race/page.tsx` (update): in the `render` callback, when the session phase flips from `"countdown" | "racing"` to `"finished"` (detect via a `useRef<boolean>(false)` guard), build the `RaceResult` from the live session, call `saveRaceResult`, dispose the loop / input manager, and `router.push("/race/results")`. Reuse the same `trackForResult = { id: track.id } as Track` minimal cast the retire branch uses so we do not re-parse the bundled JSON. Pass `recordPBs: true` (vs the retire branch's `false`).
- `e2e/race-finish.spec.ts` (new) **or** extension of an existing spec: simulate a short multi-lap race (1-2 laps with the existing AI-grid) and assert the results route renders with player position, lap times, and the §20 fields. Coordinate with F-029 owner — if `VibeGear2-implement-e2e-race-4a750bfc` lands first, this dot may piggyback on that spec instead of authoring its own.
- `docs/FOLLOWUPS.md` (update): mark F-038 `done` once natural-finish wiring is verified end-to-end. Note that retire-path wiring landed in `8756804` and natural-finish wiring landed in this dot's commit.
- `docs/PROGRESS_LOG.md` (update): standard slice entry.

## Edge Cases

- Render-callback fires per frame: guard the wiring with a `useRef<boolean>(false)` so `saveRaceResult` and `router.push` only fire once per finish. Reset the ref to `false` inside the loop-effect setup (so a Restart that re-enters racing then finishes still triggers the route once).
- Player DNF on the natural-finish path (e.g. the §7 hard time-limit fires while the player is still racing, see commit `4ab225f`): treat it the same as the retire branch — `buildRaceResult` already handles a DNF row via `buildFinalCarInputsFromSession`. PB recording should be skipped on DNF (mirror retire's `recordPBs: false` when player is DNF; otherwise `true`).
- Player retired before natural-finish: the retire branch already routed; the natural-finish guard never fires because `routedRef` flipped on retire. Verify by ordering: retire flips `routedRef = true` before `router.push`.
- Direct nav to `/race/results` with no session payload: out of scope for this dot; the `/race/results` page already handles the missing-payload case per the §20 dot's edge-case list.
- Tear-down ordering: stop the loop and dispose the input manager **before** `router.push` so the rAF / keydown listeners cannot outlive the page. Mirror the retire branch's pattern verbatim.
- `persisted.kind` may be `"loading"` mid-finish (race ends before the save resolves). Use `persisted.kind === "loaded" ? persisted.save : defaultSave()` exactly like the retire branch so the call site stays a one-liner.

## Verify

- [ ] Multi-lap race against AI runs to natural finish; the page navigates to `/race/results` once (no double-route).
- [ ] Player position, fastest lap, lap times, points, and cash render on the results screen with the seeded race's values (cell-level fixture from a deterministic seed).
- [ ] Restart from the pause menu re-arms the natural-finish guard so a second finish still routes (no stuck guard).
- [ ] DNF via §7 time-limit during the natural-finish path produces a results row marked `data-status="dnf"` with "DNF" in the position column (matches the retire e2e contract).
- [ ] `routedRef` guard: simulate two `phase === "finished"` render calls; assert `saveRaceResult` and `router.push` each fire exactly once.
- [ ] Loop / input tear-down: assert no rAF handle outlives the route hop (mirrors retire branch).
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e` clean.
- [ ] `docs/FOLLOWUPS.md` F-038 flipped to `done` with a final note pointing to this dot's commit.
- [ ] No em-dashes / en-dashes anywhere this dot touches (`grep -rP "[\x{2013}\x{2014}]" src/app/race/page.tsx` returns nothing on the changed lines).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/FOLLOWUPS.md` F-038 (this dot's parent followup)
- `docs/gdd/05-core-gameplay-loop.md` Inter-race loop
- `docs/gdd/20-hud-and-ui-ux.md` Results screen
- `src/app/race/page.tsx` (retire branch as the wiring template)
- `src/game/raceResult.ts` (`buildRaceResult`)
- `src/components/results/raceResultStorage.ts` (`saveRaceResult`)
- Commit `e1129b7` (pure builder + page)
- Commit `8756804` (retire-path wiring template)
- Sibling dot `VibeGear2-implement-e2e-race-4a750bfc` (F-029 e2e spec — coordinate test ownership)
