---
title: "implement: lift opponent draw distance to 600m with alpha fade so leaders and tail are visible mid-pack"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:30:43.718775-05:00"
blocks:
  - VibeGear2-implement-quick-race-78084a95
---

projectOpponentCar (src/app/race/page.tsx:702-778) culls every opponent at depthMeters > 200, plus an absolute width floor of 20px desktop / 12px mobile. With multi-lap pacing landing in the iter-1 lap-bump slice the field will routinely stretch past 200m so the player can no longer SEE leaders or trailers. Per Q-015 default move the cull to 600m and add a linear alpha fade from 1.0 at 400m to 0.05 at 600m so far cars are present but unobtrusive. Keep the projected-width floor since sub-pixel draws are wasteful. Affected: src/app/race/page.tsx (projectOpponentCar plus AI_MIN_PROJECTED_WIDTH constants), src/render/pseudoRoadCanvas.ts (alpha pass already exists, just thread it), e2e/projection-readability.spec.ts (extend asserts to require at least one opponent visible at depth > 250m on a long track). Verify: existing projection-readability spec passes; new assertion catches a regression that re-clamps the cull to 200m; HUD position still computes from full field, not visible subset. After: VibeGear2-implement-quick-race-78084a95 so there are enough cars in the field to spread out and exercise the new range.
