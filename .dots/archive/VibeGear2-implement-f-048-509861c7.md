---
title: "implement: F-048 apply CPU_DIFFICULTY_MODIFIERS scalars in AI runtime per §23 §15"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T11:35:09.514623-05:00\""
closed-at: "2026-04-26T11:49:50.003176-05:00"
close-reason: verified
---

blocks: none. F-044 landed src/game/aiDifficulty.ts with frozen CPU_DIFFICULTY_MODIFIERS keyed by PlayerDifficultyPreset (easy/normal/hard/master), plus getCpuModifiers and resolveCpuModifiers helpers. The runtime side of the §23 wiring still needs three call-sites:

1. tickAI in src/game/ai.ts: multiply driver.paceScalar by getCpuModifiers(tierId).paceScalar before computing targetSpeed. Thread the resolved tier id from the save's settings.difficultyPreset through raceSession.createRaceSession so the AI tick sees both archetype identity (per-driver) and player-facing difficulty (per-tier).

2. mistakeScalar consumer: stack on AIDriver.mistakeRate once the mistake-injection pipeline lands. Clean_line archetype is currently zero-randomness; consumer arrives with aggressive / chaotic / bully archetypes (full-AI dot).

3. recoveryScalar consumer: stack on the rubber-banding catch-up term once it lands. §15 marks rubber-banding deferred (full-AI dot covers it). No consumer module exists yet.

Slice may land partial: paceScalar wiring is unblocked today (only needs raceSession + ai.ts). The mistake/recovery scalars must wait for their respective consumers; document the gap in F-048 followup notes when paceScalar slice lands. Replace the F-048 followup with mark-done once all three sites consume; until then keep F-048 open with the remaining sites enumerated.

Affected files (paceScalar slice, minimum viable):
- src/game/raceSession.ts: add tierId: PlayerDifficultyPreset on RaceSessionInit / RaceSessionState, default normal; createRaceSession reads save.settings.difficultyPreset via resolveCpuModifiers.
- src/game/ai.ts: tickAI accepts tierId (or pre-resolved CpuDifficultyModifiers), multiplies driver.paceScalar by tier paceScalar at the targetSpeed compute site.
- src/game/__tests__/ai.test.ts: assert tier=hard with a clean_line driver yields a higher targetSpeed than tier=easy under identical inputs.
- docs/FOLLOWUPS.md: F-048 update once paceScalar lands; close once all three sites consume.

Verify:
- npm run lint, typecheck, test, build all clean.
- A clean_line driver at hard has higher targetSpeed than at easy under matched inputs.
- A normal-tier run is byte-identical to pre-slice behaviour (paceScalar=1.0 is the identity).
- No em-dashes in changed files.
