---
title: "implement: economy catch-up mechanisms (tour stipend, repair cap, easy-mode bonus) per §12"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:27.062973-05:00\\\"\""
closed-at: "2026-04-26T08:56:41.213812-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-economy-upgrade-ff73b279
---

## Description

Implement the four catch-up mechanisms enumerated in `docs/gdd/12-upgrade-and-economy-system.md` Catch-up mechanisms: cash-threshold tour stipend, essential-repair cost cap, easy-mode tour-clear bonus, and practice-mode weather preview. These are anti-grind levers that prevent the §27 "AI frustration" risk from compounding into player exit. None of the existing economy or balancing dots own them.

## Context

§12 names the four levers but does not pin numeric thresholds. This dot pins them and ships the decision logic. Without these levers, a player who gets unlucky once can fall below upgrade-purchase budget and bounce off the difficulty wall.

`implement-economy-upgrade-ff73b279` owns the core economy. `implement-balancing-pass-71a57fd5` owns numeric tuning. This dot inserts catch-up hooks into the economy and stages placeholder constants for the balancing pass.

## Affected Files

- `src/game/catchUp.ts` (new): pure functions `computeStipend(save, tour) => number`, `cappedRepairCost(rawCost, raceCashEarned, difficulty) => number`, `easyModeBonus(save, tourComplete) => number`, `practiceWeatherPreview(track) => readonly Weather[]`.
- `src/game/__tests__/catchUp.test.ts` (new): cell-level fixtures for each lever.
- `src/game/economy.ts` (update): `awardCredits` checks for tour-entry stipend and applies; `applyRepairCost` invokes the cap; `tourComplete` invokes the easy-mode bonus.
- `docs/gdd/12-upgrade-and-economy-system.md` (no edit): the GDD already names the levers. This dot does not change the GDD; it adds OPEN_QUESTIONS entries for any threshold the dot pins as placeholder.
- `docs/OPEN_QUESTIONS.md` (update): file Q-NNN entries for stipend threshold, repair cap percentage, easy-mode bonus percentage, and confirm with dev before balancing-pass closes.

## Pinned placeholders (until balancing-pass owns them)

```ts
// Stipend: granted once per tour entry if credits below threshold
export const STIPEND_THRESHOLD_CREDITS = 1500;
export const STIPEND_AMOUNT = 1000;

// Repair cap: essential repair cost capped at this fraction of last race income
export const REPAIR_CAP_FRACTION = 0.40; // §12 says "low percentage", pin 40%

// Easy-mode bonus: tour-clear bonus on top of the §12 0.15 bonus
export const EASY_MODE_TOUR_BONUS_FRACTION = 0.20;

// Practice weather preview: surfaces all approved weather options for the track
// (no random override; player can swap pre-race per §6).
```

## Edge Cases

- Stipend: granted at most once per `(saveProfile, tourId)` pair; record in `save.progress.stipendsClaimed: Record<TourId, true>`.
- Stipend: never granted on the first tour (default starter cash is sufficient).
- Repair cap: applied to `applyRepairCost` only when the player chose "essential" (not "full"); full repairs always cost full price.
- Easy-mode bonus: gated on `save.settings.difficulty === "easy"` (or the equivalent §28 difficulty-preset key once that dot lands).
- Save migration: new `stipendsClaimed` field is optional in the schema; default `{}` on load.

## Verify

- [ ] `computeStipend(save, tour)` returns `STIPEND_AMOUNT` when `credits < threshold` and the tour is not first; otherwise 0.
- [ ] Stipend not double-paid: second call after `stipendsClaimed[tourId] === true` returns 0.
- [ ] First-tour gate: stipend on tour-1 returns 0 even at low credits.
- [ ] `cappedRepairCost(2000, raceIncome=4000, "essential", "normal")` returns `min(2000, 4000 * 0.40) = 1600`.
- [ ] Cap does not apply on "full" repair: returns full cost.
- [ ] Cap does not apply on "hard" / "master" difficulty: returns full cost.
- [ ] `easyModeBonus(save, tourComplete)` returns `0.20 * sumRaceRewards` when `difficulty === "easy"`; 0 otherwise.
- [ ] `practiceWeatherPreview(track)` returns the track's `weatherOptions` array unchanged (deterministic, no preview lookup needed).
- [ ] Pure: no Math.random, no Date.now.
- [ ] OPEN_QUESTIONS.md has new entries flagging the four pinned constants for dev confirmation.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/catchUp.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/12-upgrade-and-economy-system.md` Catch-up mechanisms
- `docs/gdd/27-risks-and-mitigations.md` (AI frustration risk)
