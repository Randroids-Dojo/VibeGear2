---
title: "implement: F-032 wire leaderboard client into race results surface per GDD §21"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T12:08:22.726059-05:00\""
closed-at: "2026-04-26T12:41:29.424589-05:00"
close-reason: verified
---

blocks: none. The feat/leaderboard-client slice landed src/leaderboard/client.ts with submitLap and getTop, gated by NEXT_PUBLIC_LEADERBOARD_ENABLED. The race-results-7b0abfaa dot was archived without consuming the client. grep -rn 'submitLap|getTop' src/ outside src/leaderboard/ returns nothing today; the adapter is a producer waiting for a consumer.

This dot wires the consumer:
1. On the post-race results page (src/app/race/results/page.tsx or equivalent), when the player crosses the finish line cleanly (status='finished'), call submitLap with the signed token computed from { trackId, finalTimeMs, ghostHash }.
2. Render the result outcome inline ('stored' | 'rejected' | 'disabled' | 'error') as a small status row.
3. Optionally fetch and render the top-N leaderboard via getTop(trackId) below the player's row.
4. Respect NEXT_PUBLIC_LEADERBOARD_ENABLED: when unset/false, the section is hidden entirely.

Affected files:
- src/app/race/results/page.tsx (update): add leaderboard panel below bonuses.
- src/components/results/LeaderboardPanel.tsx (new): renders the status pill + top-N list.
- src/components/results/__tests__/LeaderboardPanel.test.tsx (new): RTL covers all four submitLap outcomes.
- e2e/results-screen.spec.ts (update): assert leaderboard panel renders 'disabled' when env off and 'stored' (with mocked KV backend) when on.
- docs/FOLLOWUPS.md: F-032 status flipped to done.

Verify:
- npm run lint, typecheck, test, build all clean.
- With NEXT_PUBLIC_LEADERBOARD_ENABLED=false (default), the panel is not rendered.
- With NEXT_PUBLIC_LEADERBOARD_ENABLED=true and noop store, the status reads 'disabled' (graceful).
- With NEXT_PUBLIC_LEADERBOARD_ENABLED=true and vercel-kv backend (mock), submitLap fires once on finished status and the result renders.
- DNF status does not call submitLap.
- No em-dashes in changed files.
- F-032 marked done in docs/FOLLOWUPS.md.
