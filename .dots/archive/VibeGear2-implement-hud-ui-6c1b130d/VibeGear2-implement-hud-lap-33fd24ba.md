---
title: "implement: HUD lap-timer widget per §20"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T07:51:47.338338-05:00\\\"\""
closed-at: "2026-04-26T07:56:01.350184-05:00"
close-reason: verified
---

## Description

Sub-slice of the HUD parent (`VibeGear2-implement-hud-ui-6c1b130d`). Add the lap-timer widget called out in GDD §20 "UX wireframe descriptions / Race HUD layout": current-lap elapsed time formatted as MM:SS.mmm, drawn near the lap counter so the player can read pace at a glance. Also add the formatter helper as a sibling utility consumed by the broader HUD polish work.

## Affected Files

- `src/game/hudState.ts` (update): export pure `formatLapTime(ms): string` helper. Extend `HudStateInput` with optional `currentLapElapsedMs` and `bestLapMs` so the existing minimal-HUD callers keep type-checking. Mirror the values on `HudState` only when the caller supplied them.
- `src/game/__tests__/hudState.test.ts` (update): cases for formatter (zero, sub-second, multi-minute, negative collapses to 00:00.000, NaN collapses to --:--.---), and that `deriveHudState` only includes the new fields when input supplies them.
- `src/render/uiRenderer.ts` (update): when `HudState.currentLapElapsedMs != null`, draw the timer below the existing POS line. When `HudState.bestLapMs != null`, draw "BEST MM:SS.mmm" below the timer in the muted text colour.
- `src/render/__tests__/uiRenderer.test.ts` (existing): add a recording-mock case asserting the lap-timer text appears at the documented position when supplied, and is absent when omitted.

## Edge Cases

- Caller omits both fields: HUD layout matches today's minimal HUD; no extra rows drawn.
- `currentLapElapsedMs` is negative or non-finite: formatter returns `00:00.000` and `--:--.---` respectively; renderer still draws the row so layout is stable.
- Race finished phase: caller is responsible for freezing the timer at the final lap time; the HUD does not own that state.
- `bestLapMs` is null or undefined: omit the BEST row entirely.

## Verify

- [ ] `formatLapTime(0) === "00:00.000"`
- [ ] `formatLapTime(73499) === "01:13.499"`
- [ ] `formatLapTime(3600000) === "60:00.000"` (no hour rollover)
- [ ] `formatLapTime(-5) === "00:00.000"`
- [ ] `formatLapTime(NaN) === "--:--.---"`
- [ ] `deriveHudState` round-trips both fields when supplied; omits both fields when not supplied.
- [ ] `drawHud` records expected fillText calls for both rows when supplied; records no extra fillText for either row when not supplied.
- [ ] Lint, typecheck, vitest, build all pass.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/20-hud-and-ui-ux.md` (Race HUD layout, lap timer + best lap)
- `src/game/hudState.ts` (existing minimal HUD derivation)
- `src/render/uiRenderer.ts` (existing minimal HUD draw)
- Parent dot stress-test items 2 and 4 pin the formatter contract.
