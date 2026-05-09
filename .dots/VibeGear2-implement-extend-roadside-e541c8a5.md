---
title: "implement: extend roadside sprite schema with optional heightMeters override so authors and lints can express prop physical scale per id"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:45:04.053128-05:00"
blocks:
  - VibeGear2-implement-calibrate-roadside-96e24f40
---

src/render/pseudoRoadCanvas.ts ROADSIDE_SPRITE_STYLES extends to {kind, widthToHeight, heightMeters, minHeight}; renderer derives heightRoadFactor = heightMeters/ROAD_WIDTH at draw time. Migration: convert calibration values from the calibrate-roadside slice into heightMeters fields per Q-017 defaults (tree_pine 10, light_pole 9, sign_marker 3, fence_post 0.7, rock_boulder 1.5, palms_sparse 8, marina_signs 3.5, guardrail 0.7, water_wall 1.0, rock_spire 6, heat_sign 3). Schema-only change; no per-track JSON edits required because prop ids stay the same. Affected: src/render/pseudoRoadCanvas.ts (ROADSIDE_SPRITE_STYLES type and table; size compute at lines 774-779 reads heightMeters), src/render/__tests__/pseudoRoadCanvas.test.ts. Verify: unit test 'derived heightRoadFactor equals heightMeters / ROAD_WIDTH for every shipped roadside style id' (asserts each entry in ROADSIDE_SPRITE_STYLES projects to the same px height post-migration as the calibrate-roadside slice pinned). No new Playwright spec needed; the calibrate-roadside slice's golden frame at /dev/road continues to gate visual regressions across this refactor. After: VibeGear2-implement-calibrate-roadside-96e24f40 so the schema migration ships on top of correct numbers, not on top of the current ones.
