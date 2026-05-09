---
title: "implement: AI driver content registry (20 driver profiles per §24)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:15:29.810695-05:00\\\"\""
closed-at: "2026-04-26T04:53:26.281696-05:00"
close-reason: verified
---

## Description

Author the 20 AI driver profile JSON files conforming to `AIDriverSchema` (already in `src/data/schemas.ts`) and ship them through a static-import barrel like `src/data/cars/index.ts`. The §24 content plan calls for 20 AI driver profiles; this dot ships placeholder values that the full-ai dot and balancing-pass dot can refine. Spans the six archetypes from §15 (rocket starter, clean line, bully, cautious, chaotic, enduro) plus a couple of mixed entries.

## Context

GDD source of truth: `docs/gdd/15-cpu-opponents-and-ai.md` (archetype list), `docs/gdd/22-data-schemas.md` (`AIDriverSchema`), `docs/gdd/24-content-plan.md` (20 profiles). Sibling dot `implement-ai-grid-...` consumes these to spawn N-car race fields. Sibling dot `implement-full-ai-...` shapes archetype behaviour.

## Affected Files

- `src/data/ai/*.json` (20 files, new): each conforms to `AIDriverSchema`; cover all six archetypes; ids of the form `ai_cleanline_01`, `ai_bully_03`, etc.
- `src/data/ai/index.ts` (new): static-import barrel exposing `AI_DRIVERS`, `AI_DRIVERS_BY_ID`, `getAIDriver(id)`
- `src/data/__tests__/ai-content.test.ts` (new): every file validates against the schema; ids unique; archetype distribution matches the documented spread; weatherSkill keys complete.
- `src/data/index.ts` (update): re-export `AI_DRIVERS` and `getAIDriver`

## Edge Cases

- Display names must not collide with real drivers (legal-safety lint covers this).
- `paceScalar` ranges: documented in schema; clamp tested.
- `mistakeRate` ranges: 0..1 by schema.
- `weatherSkill` keys must include all four weathers (clear, rain, fog, snow).

## Verify

- [ ] `AI_DRIVERS.length === 20`.
- [ ] Archetype distribution: 4 rocket starter, 4 clean line, 3 bully, 3 cautious, 3 chaotic, 3 enduro (or document the chosen distribution in the index).
- [ ] Every file passes `AIDriverSchema.safeParse`.
- [ ] Every file has a unique id and unique displayName.
- [ ] Content lint script (legal-safety dot) flags zero of the 20 displayNames as trademark-risk.
- [ ] Static-import barrel ships in client bundle (no node:fs).
- [ ] Build clean.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
