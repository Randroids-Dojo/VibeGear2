---
title: "implement: Quick Race honours track.spawn.gridSlots so non-tour fields the full §7 grid"
status: open
priority: 1
issue-type: task
created-at: "2026-05-05T23:30:20.051971-05:00"
blocks:
  - VibeGear2-implement-bump-prod-076ae7e7
---

Note (2026-05-06): Superseded by `VibeGear2-implement-cut-non-fdcb3b2d`
per the Q-015 resolution. The Quick Race route is being removed
entirely; this slice's grid-density work is no longer applicable to
v1.0. The renderer cull move (200 m -> 600 m with alpha fade) is
preserved in the separate `VibeGear2-implement-lift-opponent-8764ce5e`
dot. This dot is left in place per the append-only ledger discipline;
the implementor of `cut-non-fdcb3b2d` should soft-close this entry
with `dot off VibeGear2-implement-quick-race-78084a95 -r "superseded
by cut-non-fdcb3b2d (Q-015 resolution, 2026-05-06)"` once the
scope-cut PR lands.

Quick Race / Time Trial / Practice currently field 1 AI because resolveRaceAIDrivers (src/app/race/page.tsx:672) returns AI_DRIVERS.slice(0, 1) when tourContext is null. §7 pins default field size 12 in championship and quick race. Replace the 1-AI roster with a deterministic shuffle of AI_DRIVERS sized to track.spawn.gridSlots - 1 (11 with current data). Affected: src/app/race/page.tsx (resolveRaceAIDrivers), src/app/race/__tests__ if present, plus a quick-race grid count Playwright assertion. Verify: unit test 'resolveRaceAIDrivers honours gridSlots in non-tour mode' (asserts roster size === gridSlots - 1 with deterministic ordering); Playwright spec tests-e2e/quick-race-grid-density.spec.ts that loads /race in Quick Race mode and asserts the standings strip lists 12 entries; a Quick Race lap shows position '1/12' on the HUD when leading and '12/12' when DNFing in last; aiVisibleCount > 0 in the dev overlay; deterministic ordering across reloads. Per Q-015 default. Q-015 recommended default is the source of truth and unblocks this slice. After: VibeGear2-implement-bump-prod-076ae7e7 so the longer multi-lap race window is the natural place to feel the larger pack.
