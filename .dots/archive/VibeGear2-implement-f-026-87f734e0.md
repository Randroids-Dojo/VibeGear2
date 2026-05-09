---
title: "implement: F-026 wire applyAssists into race-session input pipeline per §19 §20"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T07:22:07.068089-05:00\\\"\""
closed-at: "2026-04-26T07:36:14.947436-05:00"
close-reason: verified
---

## Description

Wire the §19 accessibility assists pure module (`src/game/assists.ts`, landed in iter-43) into `raceSession.stepRaceSession` so the toggles in /options/accessibility move from 'persisted' to 'actually applied'. Producer is complete + unit-tested (37 tests); this is the consumer slice.

## Context

Tracked as F-026 in `docs/FOLLOWUPS.md` (priority blocks-release). The assists slice deliberately deferred consumer wiring to keep its diff focused on the contract + UI; the producer module exposes `applyAssists(input, assists, ctx, memory) -> { input, memory, weatherVisualReductionActive, badge }` with deterministic + idempotent semantics. F-026's job is to thread it into the per-tick pipeline.

GDD: `docs/gdd/19-controls-and-input.md` (Accessibility controls), `docs/gdd/20-hud-and-ui-ux.md` (assist badge surfaces in HUD), `docs/gdd/22-data-schemas.md` (`SaveGameSettings.assists`).

## Affected Files

- `src/game/raceSession.ts` (update): read player `SaveGameSettings.assists`; build `AssistContext` from current car state (`speedMps`, `surface`, `weather`, `upcomingCurvature`, `dt`); thread per-session `AssistMemory` (init via `INITIAL_ASSIST_MEMORY` on green-light, advance each tick); pipe player input through `applyAssists(...).input` before forwarding it to the physics step.
- `src/game/raceSession.ts` (update): surface `applyAssists(...).badge` through the existing `HudState.assistBadge` passthrough (data plane already wired in iter-43).
- `src/road/segmentProjector.ts` or `src/game/raceSession.ts` (small update): expose 'upcoming curvature in the next N meters' so brake-assist's curvature gate has a value to read. Track segments already carry `curve`; the projector can sum / max upcoming curve in a fixed lookahead window.
- `src/game/__tests__/raceSession.test.ts` (update): cover assists-on / assists-off determinism, brake-assist firing on a curve, toggle-nitro latch persisting across ticks, reduced-input lockout.

## Edge Cases

- Visual-only weather: when `weatherVisualReductionActive` is true, the future weather grip multiplier must respect it (skip the grip penalty, keep visual rendering). If the grip-multiplier code path is not yet shipped, leave the flag plumbed to its callsite with a TODO so the weather slice can hook in cleanly.
- Memory initialisation: assist memory must reset on race restart / retire. Tie it to the same lifecycle as the lap timer / sector timer reset.
- Determinism: identical assists + identical input streams + identical track + identical weather must produce deep-equal race state across runs.
- HUD: `HudState.assistBadge` is already an optional snapshot field. F-027 covers the renderer; F-026 only feeds the data plane.

## Verify

- [ ] applyAssists is called once per player tick before the physics step.
- [ ] AssistMemory threads correctly across ticks; toggle nitro latch survives a release.
- [ ] AssistContext.upcomingCurvature is sourced from the projector / track segments, not invented.
- [ ] Determinism: identical inputs + assists produce deep-equal race state.
- [ ] HudState.assistBadge surfaces the live badge for the current tick.
- [ ] No em-dashes / en-dashes.
- [ ] PROGRESS_LOG.md entry added.
- [ ] Closes F-026 in docs/FOLLOWUPS.md (mark done).
