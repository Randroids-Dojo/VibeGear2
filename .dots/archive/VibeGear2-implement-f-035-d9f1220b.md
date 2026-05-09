---
title: "implement: F-035 wire stipend lever into the tour-entry flow per GDD §12 §8"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T12:09:01.846055-05:00\\\"\""
closed-at: "2026-04-26T15:06:43.020402-05:00"
close-reason: verified
---

blocks: tour-region-d9ca9a4d (active) carves the tour entry surface; this dot lands the stipend wiring once that surface exists or alongside it. The feat/economy-catch-up slice landed computeStipend(save, tour), getStipendClaimed(save, tourId), recordStipendClaim(save, tourId) in src/game/catchUp.ts. No in-app caller yet.

At tour-entry confirmation:
1. Call computeStipend(save, { id: tour.id, index: tour.index }) where tour.index is 1-based (first tour in a championship is index 1) per StipendTourContext.
2. If result is non-zero: credit the wallet via awardCredits-equivalent or new creditFlat(save, amount), then call recordStipendClaim(save, tourId) to prevent double-pay.
3. Persist via saveSave.

Affected files:
- src/game/championship.ts (new or update from tour-region dot): enterTour calls computeStipend + recordStipendClaim.
- src/game/__tests__/championship.test.ts (update): tour-entry on a fresh save with stipend-eligible difficulty + tour index credits the wallet by exactly computeStipend's result; second entry on the same tour returns 0.
- src/app/world/page.tsx (update from tour-region dot): the 'Enter tour' button consumes the new save and the credit delta surfaces in a one-shot toast.
- docs/FOLLOWUPS.md: F-035 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- A fresh save entering tour index 1 on Easy difficulty receives the §12 stipend amount; entering the same tour again returns 0 (idempotent claim).
- A non-eligible difficulty/tour-index combo returns 0 and does not call recordStipendClaim.
- No em-dashes in changed files.
- F-035 marked done in docs/FOLLOWUPS.md.
