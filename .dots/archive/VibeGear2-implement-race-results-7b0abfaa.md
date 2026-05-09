---
title: "implement: race results screen per §7 §20"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:02:42.335290-05:00\\\"\""
closed-at: "2026-04-26T09:10:03.934827-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-race-rules-b30656ae
  - VibeGear2-implement-economy-upgrade-ff73b279
  - VibeGear2-implement-damage-model-765f2bb9
---

## Description

Build the standalone Results Screen surface from §20 ("Results screen / Must show: finishing order, points earned, cash earned, bonuses, damage taken, fastest lap, next race card"). Currently the HUD-UI dot lists this under "results screen styling" and the Garage flow dot wires the redirect after a race, but no slice owns the results data shape, the screen, or the rematch / continue routing. This dot is that owner.

## Context

`docs/gdd/07-race-rules-and-structure.md` defines placement, DNF, and lap timing — all the inputs to the results page. `docs/gdd/20-hud-and-ui-ux.md` Results screen section enumerates the visible fields. `docs/gdd/05-core-gameplay-loop.md` puts the results screen between the race and the garage in the inter-race loop. The Garage flow dot (`implement-garage-flow-07f26703`) assumes a transition from results into `/garage`.

## Affected Files

- `src/game/raceResult.ts` (new): pure builder `buildRaceResult(state: FinalRaceState, save: SaveGame, track: Track) => RaceResult`. Returns `{ finishingOrder, pointsEarned, cashEarned, bonuses[], damageTaken, fastestLap, nextRace? }`. No I/O.
- `src/game/__tests__/raceResult.test.ts` (new): fixture race states (1st, last, DNF, fastest-lap-bonus, weather-bonus) each produce the §23 cash + points cells exactly.
- `src/app/race/results/page.tsx` (new): client component reading the latest `RaceResult` from a session-scoped store (URL param or `sessionStorage`; document the choice). Renders the seven §20 fields + "Continue to Garage" CTA + "Rematch" CTA.
- `src/components/results/*` (new): finishing-order table, lap-time list, bonus chip, damage-bar.
- `e2e/results-screen.spec.ts` (new): seed a finished race in `sessionStorage`, navigate to `/race/results`, assert the seven fields render with the seeded values, click "Continue to Garage", assert `/garage`.

## Edge Cases

- DNF: `pointsEarned = 0`, `cashEarned = participation-only` per §23; "Did Not Finish" label replaces the position.
- Tie on race time: stable sort by qualifying order; document this is not an FIA-grade tie-breaker, just deterministic.
- Player retired (pause -> retire): same as DNF for results purposes.
- No session result on direct nav to `/race/results`: redirect to `/` with a soft warning.
- Last race of a tour: "next race card" replaced by "Tour complete" summary linking to `/garage`.

## Verify

- [ ] Unit tests cover every §23 reward row cell-by-cell for `buildRaceResult` (placement-by-placement cash + points, fastest-lap bonus, no-damage bonus, weather-prep bonus).
- [ ] `RaceResult` type lives next to `raceResult.ts` and is re-exported from `src/game/index.ts`.
- [ ] DNF path: result has `cashEarned === DNF_PARTICIPATION_CASH` and `pointsEarned === 0`.
- [ ] Tied race times produce a stable, deterministic order (Vitest seeded fixture).
- [ ] Session-store mechanism documented in the page header comment; e2e test exercises it via a `page.evaluate` seed.
- [ ] Playwright e2e (`e2e/results-screen.spec.ts`) verifies all seven §20 fields and both CTAs route correctly.
- [ ] Direct nav to `/race/results` with no session data renders the soft-warning fallback (Playwright assertion).
- [ ] Keyboard-only navigation works: Tab through CTAs, Enter activates ("Continue to Garage" on first focus per §20 default-focus convention).
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/raceResult.ts src/app/race/results src/components/results e2e/results-screen.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/07-race-rules-and-structure.md`
- `docs/gdd/20-hud-and-ui-ux.md` (Results screen)
- `docs/gdd/23-balancing-tables.md` (placement payouts)
- `docs/gdd/05-core-gameplay-loop.md`
