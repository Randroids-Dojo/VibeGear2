---
title: "implement: F-039 wire tourCompletionBonus into the tour-clear payout per GDD §12"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T12:09:01.863034-05:00\\\"\""
closed-at: "2026-04-26T15:26:52.475001-05:00"
close-reason: verified
---

blocks: tour-region-d9ca9a4d (active) carves the tour-clear surface. The feat/race-bonuses slice landed tourCompletionBonus({ raceRewards, tourPassed }) in src/game/raceBonuses.ts returning a RaceBonus of kind 'tourComplete' (or null on failed tour / empty rewards). No in-app caller yet.

At tour-clear payout (alongside F-037 easyModeBonus and existing tourBonus):
1. Compute raceRewards = list of per-race credit awards.
2. Call tourCompletionBonus({ raceRewards, tourPassed: tourComplete.passed }).
3. If non-null, append to the bonuses list and credit the wallet.

Affected files:
- src/game/championship.ts (update from tour-region dot): tourComplete flow calls tourCompletionBonus.
- src/game/__tests__/championship.test.ts (update): passed tour appends a tourComplete RaceBonus; failed tour appends none.
- docs/FOLLOWUPS.md: F-039 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- Passed tour with non-empty raceRewards yields a tourComplete RaceBonus appended to the bonuses list.
- Failed tour yields null, no bonus appended.
- Empty raceRewards yields null.
- No em-dashes in changed files.
- F-039 marked done in docs/FOLLOWUPS.md.
