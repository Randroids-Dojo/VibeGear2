---
title: "implement: F-024 migrate src/game/ randomness consumers to createRng / splitRng per §27"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T14:41:38.453822-05:00\\\"\""
closed-at: "2026-04-28T04:58:23.044558-05:00"
close-reason: "Merged PR #43 with deterministic RNG consumers, addressed review comments, green main CI, automated production deploy, and production smoke."
---

blocks: implement-full-ai-fab57b84 (archetype roll + rubber-banding noise consumers); implement-hazards-runtime-6085799c (debris scatter + puddle-splash variation consumers); implement-weather-38d61fc2 (wind gust schedule consumers). Each downstream slice should call splitRng(raceRng, '<subsystem>') on the green-light tick so sub-streams stay isolated and the replay seed advances reproducibly.

PRNG slice (feat(game): seeded deterministic PRNG module, 2fcc7be) ships src/game/rng.ts with createRng, splitRng, serialiseRng, deserialiseRng, and bans Math.random inside src/game/ via an ESLint no-restricted-syntax override plus the no-math-random.test.ts static guard. As of that commit no production module in src/game/ imports the PRNG: damage.ts, damageBands.ts, raceRules.ts, raceCheckpoints.ts, sectorTimer.ts are fully deterministic; ghost.ts is replay playback (input-driven, no PRNG draw). The producer is therefore a pure module with no consumers yet (same shape as the F-021 / F-022 / F-023 ghost slice).

Per consumer slice:
1. AI slice: createRng(raceSeed) at race start; splitRng(raceRng, 'ai') for archetype mistake injection + rubber-banding catch-up term.
2. Hazards runtime: splitRng(raceRng, 'hazards') for debris scatter angle + puddle splash variation.
3. Weather: splitRng(raceRng, 'weather') for wind gust schedule.
4. Each consumer threads the sub-stream into its tick / step entry point so the replay seed advances deterministically.

Affected files:
- src/game/raceSession.ts (update): own raceRng = createRng(config.seed) on green-light tick; expose subsystem sub-streams to each consumer.
- src/game/ai.ts (consumer): replace any pending Math.random sites with the threaded sub-stream draw.
- src/game/hazards.ts (consumer, when it lands): same.
- src/game/weather.ts (consumer, when it lands): same.
- src/game/__tests__/rng-integration.test.ts (new): pin that two raceSession runs with the same seed produce byte-identical AI / hazard / weather outputs.
- docs/FOLLOWUPS.md: F-024 marked done once all three consumers are wired.

Verify:
- npm run lint, typecheck, test, build all clean.
- no-math-random.test.ts still passes (no Math.random reintroduced).
- Two raceSession runs with the same seed produce byte-identical replay deltas across AI mistake injection, hazard scatter, and weather gust schedule.
- A serialiseRng / deserialiseRng round-trip on the race seed survives a save / load.
- F-024 marked done in docs/FOLLOWUPS.md.
- No em / en-dashes in changed files.
