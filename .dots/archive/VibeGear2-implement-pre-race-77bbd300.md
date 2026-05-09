---
title: "implement: pre-race screen (track card + weather forecast + recommended tires + car summary) per §20 §14"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:24.396686-05:00\\\"\""
closed-at: "2026-04-28T06:34:32.771810-05:00"
close-reason: "Merged PR #46 with pre-race tire selection, green main CI, production deploy, and production smoke."
blocks:
  - VibeGear2-implement-garage-flow-07f26703
  - VibeGear2-implement-weather-38d61fc2
  - VibeGear2-implement-tour-region-d9ca9a4d
---

## Description

Build the standalone pre-race screen surface from `docs/gdd/20-hud-and-ui-ux.md` "Pre-race screen" section and `docs/gdd/14-weather-and-environmental-systems.md` "Forecasting in pre-race UI" section. Currently no dot owns this. The screen sits between the garage / tour selection and the race itself; player reviews the track card, confirms tires, sees the cash + repair forecast, and presses Start.

## Context

`docs/gdd/20-hud-and-ui-ux.md` Pre-race screen lists eight required fields: track name, tour name, weather, laps, track difficulty, recommended tires, current standings, cash and repair estimate, selected car and setup summary.

`docs/gdd/14-weather-and-environmental-systems.md` Forecasting section adds: current condition, surface temperature band, recommended tires, grip rating, visibility rating.

`docs/gdd/05-core-gameplay-loop.md` Race preparation lists: car selection, tire choice based on forecast, optional setup bias, nitro confirmation, brief look at track card.

`implement-garage-flow-07f26703` and `implement-tour-region-d9ca9a4d` both assume a transition into a race from their respective entry points, but neither owns the prep screen between garage and race. `implement-hud-ui-6c1b130d` mentions HUD polish but explicitly excludes pre-race. This dot fills that gap.

## Affected Files

- `src/game/preRaceCard.ts` (new): pure builder `buildPreRaceCard(track, save, championship?, weatherSelection) => PreRaceCard`. Returns `{trackName, tourName?, weather, laps, difficulty, recommendedTires, standings?, cashOnHand, repairEstimate, carSummary, setupSummary}`. No I/O.
- `src/game/__tests__/preRaceCard.test.ts` (new): cell-level fixtures from §20 / §14; recommended-tires logic from §23 weather modifiers (rain or heavy rain or snow recommends wet, otherwise dry).
- `src/app/race/prep/page.tsx` (new) OR a `<PreRaceCard>` mounted on `/garage` before the Start CTA (pin the choice in the implementer doc; the simpler path is `/garage` -> mount card inline -> click Start -> push to `/race?track=<id>`).
- `src/components/preRace/*` (new): track-card panel, weather panel with §14 forecast cells, tire recommendation chip, car-summary panel, standings strip, Start CTA.
- `e2e/pre-race.spec.ts` (new): seed save with championship + active tour, navigate from `/garage` to the pre-race surface, assert all eight §20 fields render, click Start, assert `/race?track=<id>` boots.

## Edge Cases

- Quick race entry (no championship): standings strip hidden; tour name reads "Quick Race".
- Practice mode: hide cash + repair estimate (no economy in practice); visible weather swap shortcut per §6.
- Player has wet tires equipped but weather is clear: recommendation chip flags "consider dry tires" but does not block Start.
- No save: redirect to title with soft warning.
- Track has only "clear" in `weatherOptions`: weather panel renders the static condition; no swap UI.
- Tour final race (race index 3 of 4): standings strip shows aggregate-to-date; "next race card" replaced with "Tour finale".

## Verify

- [ ] `buildPreRaceCard(track, save, championship, weatherSelection)` returns a `PreRaceCard` with all §20 / §14 fields populated for a fixture (Velvet Coast Harbor Run, light_rain, default car).
- [ ] Recommended-tire derivation: rain or heavy_rain or snow returns `"wet"`; clear or fog or overcast returns `"dry"`; cell-by-cell against §14 weather list and §23 weather-modifiers table.
- [ ] Difficulty rendering matches the `track.difficulty` integer (1..5) with a label band ("Easy" / "Moderate" / "Hard" / "Expert" / "Master") pinned in this dot.
- [ ] Repair estimate: sum of `damagePercent * carRepairFactor * tourTierScale` per damaged zone; pulled from `applyRepairCost` cost-only path (no state mutation). Cell-level fixture asserts the integer credits.
- [ ] Standings strip shows current tour standings if `save.progress.activeTour` is set; otherwise hidden.
- [ ] Practice-mode entry hides cash and repair estimate (assert via mode flag passed to the page).
- [ ] Quick-race entry hides standings; tour name reads "Quick Race".
- [ ] Wet-tires-vs-clear warning chip renders without disabling Start (Playwright assertion).
- [ ] Direct nav with no save redirects to `/`.
- [ ] Start CTA on Enter focuses by default (keyboard-only nav), pushes to `/race?track=<trackId>&weather=<selection>`.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/preRaceCard.ts src/app/race/prep src/components/preRace e2e/pre-race.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/20-hud-and-ui-ux.md` Pre-race screen
- `docs/gdd/14-weather-and-environmental-systems.md` Forecasting in pre-race UI
- `docs/gdd/05-core-gameplay-loop.md` Race preparation
- `docs/gdd/23-balancing-tables.md` Weather modifiers (recommended-tire derivation)
