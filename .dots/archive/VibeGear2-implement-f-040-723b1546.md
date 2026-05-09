---
title: "implement: F-040 wire sponsorBonus + per-race sponsor picker into race-finish flow per GDD §12"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T12:09:01.871884-05:00\\\"\""
closed-at: "2026-04-26T12:50:15.856002-05:00"
close-reason: verified
---

blocks: tour-region-d9ca9a4d (active) is the natural owner of per-tour sponsor roster. The feat/race-bonuses slice landed sponsorBonus(input) and evaluateSponsorObjective(input) in src/game/raceBonuses.ts plus a five-entry MVP catalogue at src/data/sponsors.json (and SponsorObjective schema in src/data/schemas.ts). No in-app caller yet.

This dot wires the consumer:
1. Pick which sponsor is active for the race. Two options:
   (a) Per-tour roster owned by the championship slice (preferred): tour JSON declares sponsors: [...sponsorIds] and the race-finish flow rotates through them.
   (b) Dedicated sponsor-selection module: src/game/sponsorPicker.ts that picks based on track difficulty + region.
   Recommend (a) for MVP; file Q-NNN if (b) is preferred.
2. Build SponsorEvaluationContext from RaceState at finish: { playerTopSpeed, nitroFiredAtLeastOnce, weatherAtFinish }.
3. Call sponsorBonus(input).
4. If non-null, append the resulting RaceBonus to the bonuses list passed into awardCredits and surfaced on RaceResult.bonuses.

Affected files:
- src/data/championships/world-tour-standard.json (update): each tour gains a sponsors: [...sponsorIds] field.
- src/data/schemas.ts (update): TourSchema gains optional sponsors: z.array(z.string()).optional().
- src/game/raceResult.ts or buildRaceResult (update): consume sponsor + RaceState to compute the bonus.
- src/game/__tests__/raceResult.test.ts (update): sponsor objective met -> bonus appended; not met -> no bonus.
- src/components/results/BonusChip.tsx (verify): renders sponsorBonus shape.
- docs/FOLLOWUPS.md: F-040 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- A race that meets the active sponsor's objective appends a sponsorBonus RaceBonus to the result.
- A race that misses the objective appends no bonus.
- The tour JSON sponsor roster is honoured in deterministic order across races.
- No em-dashes in changed files.
- F-040 marked done in docs/FOLLOWUPS.md.
