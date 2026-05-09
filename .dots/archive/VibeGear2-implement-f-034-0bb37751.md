---
title: "implement: F-034 wire awardCredits into the race-finish flow per GDD §12 §20"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T12:08:09.559448-05:00\""
closed-at: "2026-04-26T12:27:56.268509-05:00"
close-reason: verified
---

blocks: F-046 (done) ships baseTrackReward via BASE_REWARDS_BY_TRACK_DIFFICULTY. The feat/economy-upgrade slice landed awardCredits(save, { placement, status, baseTrackReward, difficulty }) in src/game/economy.ts plus tourBonus(rewards), proven with 33 unit tests. The function has no in-app caller yet: the post-race results surface (race-results-7b0abfaa, archived) was the natural consumer but the wiring slice was never carved off.

This dot owns the wiring slice. At the moment the player car crosses the final finish line, the race-finish flow should:
1. Resolve baseTrackReward via baseRewardForTrackDifficulty(track.difficulty) (F-046 helper).
2. Call awardCredits(save, { placement: result.playerPosition, status: result.playerStatus, baseTrackReward, difficulty: save.settings.difficultyPreset }) where placement is the 1-based finish position, status is 'finished' or 'dnf'.
3. Merge the new save via saveSave(...).
4. Surface the credit delta on RaceResult.creditsAwarded so the §20 results screen renders it.

Affected files:
- src/app/race/results/page.tsx (or wherever buildRaceResult is called): call awardCredits in the build pipeline.
- src/game/raceResult.ts (if buildRaceResult takes save): thread saveBefore -> saveAfter through, exposing creditsAwarded as a delta on the result.
- src/game/__tests__/raceResult.test.ts: new test covering: P1 finish + base 1000 credits Hard difficulty -> save.garage.credits incremented by the formula result.
- e2e/results-screen.spec.ts: assert the credit delta surface renders the awarded credits count.
- docs/FOLLOWUPS.md: F-034 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- Finishing a 1-lap test race at P1 increments save.garage.credits by the awardCredits formula's exact integer result.
- DNF status awards 0 credits (per §12 DNF rule).
- No em-dashes in changed files.
- F-034 marked done in docs/FOLLOWUPS.md.
