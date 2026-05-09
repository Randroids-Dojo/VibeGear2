---
title: "implement: F-048 wire mistakeScalar + recoveryScalar from CPU_DIFFICULTY_MODIFIERS into AI per §23"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T14:41:55.611056-05:00\\\"\""
closed-at: "2026-04-27T18:25:05.517524-05:00"
close-reason: "Merged PR #26: wired CPU difficulty mistake and recovery scalars into tickAI, closed F-048, CI and production smoke green"
---

blocks: implement-full-ai-fab57b84 (mistake-injection pipeline + rubber-banding catch-up term consumers). paceScalar slice already landed (feat/cpu-tier-pace-scalar-in-tickai); tickAI in src/game/ai.ts already accepts an optional cpuModifiers parameter and stacks cpuModifiers.paceScalar on driver.paceScalar at the targetSpeed compute site. raceSession.stepRaceSession already resolves the tier once per tick via resolveCpuModifiers(config.player.difficultyPreset) and forwards the cached frozen reference into every tickAI call.

Two scalars still owed:
1. mistakeScalar: stack on AIDriver.mistakeRate at the mistake-injection site once the mistake-injection pipeline lands (clean_line is currently zero-randomness; consumer arrives with aggressive / chaotic / bully archetypes per the full-AI dot).
2. recoveryScalar: stack on the rubber-banding catch-up term once it lands (§15 lists rubber-banding as deferred; no consumer module exists yet).

Both stack like paceScalar: composed = scalar * driver.<field>. Sub-stream the mistake-injection draw through splitRng(raceRng, 'ai') (depends on F-024 if not already landed) so replays stay deterministic.

Affected files:
- src/game/ai.ts (update once consumer sites exist): cpuModifiers.mistakeScalar stacks at mistake-injection site; cpuModifiers.recoveryScalar stacks at rubber-banding catch-up term.
- src/game/__tests__/ai.test.ts (update): pin Hard > Easy mistake rate under matched inputs; pin Master tier rubber-banding term magnitude vs Easy.
- docs/FOLLOWUPS.md: F-048 marked done once both scalars consume their respective modifiers at their consumer sites.

Verify:
- npm run lint, typecheck, test, build all clean.
- Existing paceScalar tests still green; identity-default byte-equivalence intact.
- mistakeScalar test: a Hard-tier driver with the same mistakeRate produces strictly more mistake events per N ticks than an Easy-tier driver.
- recoveryScalar test: a Master-tier rubber-banding term is strictly larger in magnitude than the Easy-tier term under matched gaps.
- F-048 marked done in docs/FOLLOWUPS.md.
- No em / en-dashes in changed files.
