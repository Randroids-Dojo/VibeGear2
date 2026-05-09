---
title: "implement: F-041 swap fixed-credit bonus placeholders for multiplier-of-base rates per GDD §23"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T12:07:54.721181-05:00\""
closed-at: "2026-04-26T12:18:51.644248-05:00"
close-reason: verified
---

blocks: none. The feat/race-bonuses slice preserved the legacy fixed-credit placeholders (PODIUM_BONUS_CREDITS=250, FASTEST_LAP_BONUS_CREDITS=200, CLEAN_RACE_BONUS_CREDITS=150, UNDERDOG_BONUS_CREDITS=200) so §20 chip rendering, BonusChip.tsx, raceResult builder tests, and e2e/results-screen.spec.ts stayed numerically stable. The race-reward-3eb9b609 dot stress-test pinned multiplier-of-base values: podium 0.10/0.05/0.02 of base (P1/P2/P3), fastest 0.08, clean 0.05, underdog 0.10 per grid-rank improvement.

Swap is mechanical:
1. Change the constants in src/game/raceBonuses.ts to compute against the per-race baseTrackReward (already passed into awardCredits via F-046's BASE_REWARDS_BY_TRACK_DIFFICULTY pinning).
2. Update the four expect(... cashCredits).toBe(...) cases in src/game/__tests__/raceBonuses.test.ts.
3. Update the matching cells in src/game/__tests__/raceResult.test.ts.
4. Refresh the hardcoded cashCredits numbers in e2e/results-screen.spec.ts.
5. Mark F-041 done in docs/FOLLOWUPS.md.

Affected files:
- src/game/raceBonuses.ts
- src/game/__tests__/raceBonuses.test.ts
- src/game/__tests__/raceResult.test.ts
- e2e/results-screen.spec.ts
- docs/FOLLOWUPS.md

Verify:
- npm run lint, typecheck, test, build all clean.
- A baseTrackReward of 1000 yields podium P1=100, P2=50, P3=20; fastest=80; clean=50; underdog=100 per grid rank improved.
- All four bonus chips still render with correct cashCredits in the results screen.
- No em-dashes in changed files.
- docs/FOLLOWUPS.md F-041 status flipped to done.
