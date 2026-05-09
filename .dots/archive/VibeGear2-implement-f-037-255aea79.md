---
title: "implement: F-037 wire easyModeBonus into the tour-clear payout per GDD §12"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T12:09:01.856291-05:00\\\"\""
closed-at: "2026-04-26T18:26:05.790325-05:00"
close-reason: Implemented optional save-aware easy-mode tour-clear bonus in tourComplete, added F-037 tests, marked followup done. Verified lint, typecheck, unit tests, build, content-lint, diff check, and dash scan.
---

blocks: tour-region-d9ca9a4d (active) carves the tour-clear surface. The feat/economy-catch-up slice landed easyModeBonus(save, sumRewards) in src/game/catchUp.ts with eight unit tests. No in-app caller yet.

At tour-clear payout:
1. Compute sumRewards = sum of per-race awardCredits results in the tour.
2. Call existing tourBonus(rewards) (already in economy.ts).
3. Call easyModeBonus(save, sumRewards) - returns 0 unless save.settings.difficultyPreset === 'easy'.
4. Credit save.garage.credits by tourBonus + easyModeBonus.
5. Persist.

Affected files:
- src/game/championship.ts (update from tour-region dot): tourComplete flow calls both bonus helpers.
- src/game/__tests__/championship.test.ts (update): Easy difficulty tour-clear credits tourBonus + easyModeBonus; Normal/Hard/Master credits tourBonus only.
- docs/FOLLOWUPS.md: F-037 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- Easy difficulty tour-clear credit delta = tourBonus(rewards) + easyModeBonus(save, rewards).
- Normal+ difficulty tour-clear credit delta = tourBonus(rewards).
- Failed tour pays 0 of either bonus (per existing tourBonus contract).
- No em-dashes in changed files.
- F-037 marked done in docs/FOLLOWUPS.md.
