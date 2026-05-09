---
title: "feat(ai): make CPU opponents visible and competitive on /race (close FOLLOWUPS:473 gap)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-05-01T03:25:05.217312-05:00\\\"\""
closed-at: "2026-05-01T12:06:35.666817-05:00"
close-reason: "Merged PR #145. AI opponents render on /race, overtake intent is visible, Copilot threads were answered and resolved, local checks passed, main CI passed, and production version 6895d4d smoked. Remaining archetype behavior work split to a new dot."
---

The full-AI dot (VibeGear2-implement-full-ai-fab57b84) was closed but FOLLOWUPS.md:473 explicitly notes the cut scope: "overtake / lane-shift behavior, archetype-specific mistakes, nitro usage, weather skill, and full grid behavior." On the live /race build, AI cars tick in the sim but are NEVER RENDERED — `DrawRoadOptions` (src/render/pseudoRoadCanvas.ts:243) only carries a `playerCar` overlay, with no `aiCars` field. AI spawn 5–15m behind the player (src/game/aiGrid.ts:31–80) and remain invisible forever.

Production scope (5 concrete change surfaces):
1. src/render/pseudoRoadCanvas.ts:116 — extend DrawRoadOptions with aiCars?: Array<{worldX, worldZ, archetypeId, damageTier, brake, nitro}>. Add a drawAICars() helper called after the road strips and before the player overlay; project each AI through the same camera the road uses, z-cull beyond ~200m draw distance, and render via the same per-car atlas system added in PR #131.
2. Race frame loop (src/components/render/RoadCanvas.tsx + src/app/race/page.tsx) — iterate session.ai[], project to screen, build the aiCars[] array each frame.
3. src/game/ai.ts:233 (tickAI) — emit visible overtake intent: when intent transitions to overtake, lerp state.laneOffset toward the opposite side of the player by 2–5m so the lane-shift is visible to both renderer and physics.
4. src/game/ai.ts — implement archetype-specific visible behaviors per GDD §15: rocket-starter pace fade in final 30% of lap, bully tracks inside player line on curves (already has trafficLanePressure hook at lines 479–482, extend it), cautious brakes early in rain/fog, chaotic occasionally misses apex, enduro stays consistent. These must be readable to a human watching, not just measurable in stats.
5. src/game/raceSession.ts (~line 1300) — wire AI lane-shift through the per-tick AI integration with a 2m lateral safety margin against the player to avoid teleport-collisions.

Existing reusable code:
- Per-car FX atlas routing already shipped (PR #131, src/data/atlas/carSprites.ts) — AI cars should use the same spriteSetFor() lookup as the player.
- carSpriteCompositor.ts already handles damage tier overlays and brake/nitro frames — reuse for AI sprites.
- segmentProjector.ts has the camera projection used by the road; AI projection should reuse the same math, NOT a separate transform.

Acceptance criteria (production, not POC):
- AI car sprite is visible on screen when its z is within 200m of the player (z-culled beyond).
- AI lateral offset visibly shifts ±2–5m during overtake attempts.
- An AI with paceScalar > 1.0 spawned 10m behind the player reaches and passes the player within 30s on the MVP straight track.
- Each archetype shows at least one visible behavior in a 90-second observation window.
- New e2e/race-ai-visible.spec.ts (iPhone 13 + desktop): drives a race for 15s, asserts a non-player car sprite is rendered within the viewport (canvas pixel sample or DOM-overlay assertion).
- Existing e2e (race, time-trial, garage) all still pass.
- No determinism regression: ghost replays of the player still match (raceSession is purity-locked per AGENTS.md RULE 8).
