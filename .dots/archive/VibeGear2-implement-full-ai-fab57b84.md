---
title: "implement: full AI archetypes + difficulty tiers + light rubber banding per §15"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:45:28.697588-05:00\\\"\""
closed-at: "2026-04-30T02:45:33.844159-05:00"
close-reason: "Merged PR #119, main CI green, CodeQL green, Vercel production deploy verified, production smoke passed, and full AI archetype behavior shipped."
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Ship the five remaining AI archetypes (rocket starter, bully, cautious, chaotic, enduro), the difficulty-tier table from §15, and the light rubber-banding rules. Closes the GDD §27 "AI frustration" mitigation clauses "visible AI archetypes" and "light rubber banding".

## Context

`implement-single-ai-4cdd40cd` ships the `clean_line` archetype only, as the Phase 1 vertical slice. GDD §15 names six archetypes total and four difficulty tiers (Easy / Normal / Hard / Master) with concrete rubber-banding and mistake-frequency knobs. GDD §27 names "light rubber banding" and "visible AI archetypes" as two of three AI-frustration mitigations.

The archetypes share infrastructure: the same lane-relative driving routine and the same progress-space state shape. They differ in target-lane offset bias, target speed bias, brake-distance bias, and a small per-archetype event probability table (mistake rate, rub aggression, weather modifier). A clean abstraction is one `AIBehaviour` interface plus six implementations + difficulty modifiers.

Rubber banding follows §15's allowed list: small pace bonuses to keep midfield relevant, mild lead compression in easy mode, better catch-up in lower difficulties. NOT allowed: teleporting pace, impossible final-lap boosts, rubber-banding that invalidates upgrades.

Depends on `implement-single-ai-4cdd40cd` (the AI module exists) and `implement-balancing-pass-71a57fd5` (the §23 numeric tables are loaded). Blocks `implement-tagged-release-b3d30084`.

## Affected Files

- `src/game/ai.ts` (existing, extended): refactor `tickAI` to dispatch on `archetype`. Add the five new archetypes as named exports. Add `applyRubberBanding(field, difficulty)` that mutates target-speed bias for the trailing AI cars within the §15-allowed bounds.
- `src/game/aiArchetypes.ts` (new): per-archetype constant tables (target lane bias, target speed bias, mistake rate, rub aggression, weather modifier).
- `src/game/aiDifficulty.ts` (new): difficulty-tier constants per §15 ("AI pace", "Rubber banding", "Mistakes", "Economy pressure" columns).
- `src/data/ai/<archetype>.json` (new, six files; one already exists from the single-ai dot): driver-style examples per `docs/gdd/22-data-schemas.md` AIDriver schema.
- `src/game/__tests__/ai.test.ts` (existing, extended): per-archetype deterministic-output tests; rubber-banding bound tests; difficulty-tier modifier tests.
- `src/game/__tests__/ai-grid.test.ts` (new): given a grid of mixed archetypes, the field is internally consistent (no two cars in the same lane at the same progress).
- `src/data/championship.json` or per-tour AI lists (existing if `implement-tour-region-d9ca9a4d` has shipped; otherwise leave a stub): wire archetype distribution per tour.

## Edge Cases

- Rubber banding floor: the trailing AI's pace bonus is capped at +5% per §15 ("Allowed: small pace bonuses"). Master tier disables rubber banding entirely.
- Mistake rates per §15 difficulty table ("Frequent / Occasional / Rare / Very rare"). A "mistake" is a one-frame target-offset glitch that recovers within 30 frames. Mistakes never cause a crash that ends the AI's race.
- Bully archetype's "rub more often" must not produce damage to the player above the §13 ramp because doing so would feel unfair (cross-link to GDD §13 caps).
- Cautious archetype in clear weather behaves nearly identically to clean line; the test must use a wet-weather fixture to assert the cautious-specific behaviour.
- Chaotic archetype's "occasionally brilliant" branch is rare (1-2% of frames trigger a faster cornering setpoint). The branch must be deterministic given the seed (no `Math.random()`; use a seeded PRNG threaded through race state).
- Enduro archetype is consistent across multiple races; this is hard to test in isolation. Add a multi-lap fixture that asserts low variance lap-to-lap for enduro vs high variance for chaotic.

## Verify

- [ ] All six archetypes have deterministic Vitest tests.
- [ ] Difficulty-tier modifiers match the §15 table within float tolerance.
- [ ] Rubber-banding caps respect §15 "allowed / not allowed" lists.
- [ ] A mixed-archetype grid race finishes without internal collisions in 100 simulated runs (deterministic seed).
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` are green.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/15-cpu-opponents-and-ai.md` (the archetype, rubber-banding, and difficulty contracts).
- `docs/gdd/27-risks-and-mitigations.md` (AI frustration row).
- `docs/gdd/22-data-schemas.md` (AIDriver shape).
- `docs/gdd/23-balancing-tables.md` (numeric tuning targets).
