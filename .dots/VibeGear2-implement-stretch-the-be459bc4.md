---
title: "implement: stretch the AI starting grid across the start straight so the pack is visible at the lights"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:30:32.337019-05:00"
blocks:
  - VibeGear2-implement-quick-race-78084a95
---

Today spawnGrid (src/game/aiGrid.ts:31) places 11 AIs at z = -row*5 with row = floor(index/laneCount)+1, so for laneCount=3 the entire pack stacks within z=-5..-20 (15m of depth). raceSession.ts also overrides z to -(5 + index*5). Bump the row spacing so the pack stretches across ~80-120m of start straight (Top Gear 2 reference: visible from start to first corner). Affected: src/game/aiGrid.ts (DEFAULT_ROW_SPACING_METERS or new lateral-row stagger), src/game/raceSession.ts (AI_GRID_OFFSET_BEHIND_PLAYER_M, AI_GRID_SPACING_M reconciliation; today they double up with aiGrid's startZ via entry.initial), and src/game/__tests__/aiGrid.test.ts. Verify: unit test 'spawnGrid stretches 11 AI cars across at least 80 m of start straight' in src/game/__tests__/aiGrid.test.ts (asserts max(|z|) >= 80 and min(|z|) <= 10 for a 12-slot grid with laneCount=3); Playwright spec tests-e2e/quick-race-grid-stretch.spec.ts that captures the pre-countdown camera and asserts the trailing AI cars are visible past 60 m of depth; the existing trackCompiler.test grid-slot warning still fires; deterministic seeded layout. After: VibeGear2-implement-quick-race-78084a95 so the 11-car pack actually exists in Quick Race when this lands.
