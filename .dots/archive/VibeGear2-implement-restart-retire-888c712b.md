---
title: "implement: restart + retire race controls (pause menu wiring) per §20"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:20:31.331756-05:00\\\"\""
closed-at: "2026-04-26T09:23:00.400080-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-race-rules-b30656ae
  - VibeGear2-implement-race-results-7b0abfaa
---

## Description

Wire the pause overlay's Restart, Retire, and Exit-to-Title buttons through to actual session actions. Today `PauseOverlay.tsx` accepts optional handlers and self-disables them when absent; the dev page only binds Resume. This dot ships the canonical handlers that the race / quick-race / time-trial / practice surfaces all reuse.

## Context

`docs/gdd/20-hud-and-ui-ux.md` Pause menu lists Resume, Restart race, Retire race, Settings, Leaderboard, Exit to title. The pause-overlay slice (closed) shipped the React component with placeholder optional handlers, deferring the action wiring to a follow-up. None of the existing dots own that wiring: HUD-UI dot covers visual polish; race-rules dot defines DNF semantics but not the user-initiated retire path; raceSession is the orchestrator but no dot owns its restart / abandon contract.

This is a small but cross-cutting slice: each handler maps to a session-level command (`session.restart()`, `session.retire()`, `session.exitToTitle()`) plus a router push. Wiring them one place instead of per-page avoids drift.

Depends on `implement-race-rules-b30656ae` (DNF + finish are defined) and `implement-race-results-7b0abfaa` (retire => results screen with DNF row). Blocks `implement-tour-region-d9ca9a4d` softly (championship retry-from-race-1 needs the same restart primitive).

## Affected Files

- `src/game/raceSession.ts` (update or extend): add `restart()`, `retire()`, `exitToTitle()` to the session handle. Restart resets the race state, the AI grid, and the lap timer to t=0; retire flags every uncrossed lap as DNF and routes to results; exitToTitle disposes the loop and pushes `/`.
- `src/components/pause/PauseOverlay.tsx` (update): bind the handlers via a hook `usePauseActions(session, router)` so callers wire one prop instead of four.
- `src/components/pause/usePauseActions.ts` (new): the hook.
- `src/app/race/page.tsx` (update): bind `usePauseActions` to the live session.
- `src/app/practice/page.tsx` and `src/app/quick-race/page.tsx` (update if extant): same binding, with practice's restart staying on `/practice` instead of routing to results.
- `src/components/pause/__tests__/usePauseActions.test.ts` (new): each handler calls the matching session method exactly once and triggers the documented side effect.
- `e2e/pause-actions.spec.ts` (new): load `/race?track=test-straight`, drive 2 s, press Escape, click Restart, assert lap timer back to 00:00.000; press Escape, click Retire, assert results screen with DNF row.

## Edge Cases

- Restart during countdown: countdown re-runs from 3.
- Retire during countdown: race never started so retire routes to title (no DNF row, no credits).
- Exit to title while paused: loop is paused; dispose must still tear down rAF and audio cleanly.
- Restart after finish: button disabled (race already ended; the results screen owns rematch).
- Practice restart preserves the active weather toggle (no reset to `clear`).
- Retire writes a results record: DNF placement is the lowest available place, cash earned is the §23 DNF participation cell.

## Verify

- [ ] Each session method is unit-tested with a fake loop: `restart` zeroes the lap timer; `retire` flips finishedAt; `exitToTitle` calls dispose.
- [ ] Pause-actions hook test calls each handler and asserts the documented side effect (state change + router push or session method call).
- [ ] Playwright e2e covers Restart and Retire user flows end-to-end.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/20-hud-and-ui-ux.md` (Pause menu, Results screen)
- `docs/gdd/07-race-rules-and-structure.md` (DNF, retire semantics)
- `docs/gdd/23-balancing-tables.md` (DNF cash row)
- existing: `src/components/pause/PauseOverlay.tsx`, `src/components/pause/usePauseToggle.ts`
