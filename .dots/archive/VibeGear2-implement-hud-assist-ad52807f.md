---
title: "implement: HUD assist badge renderer (F-027)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T07:39:08.376828-05:00\\\"\""
closed-at: "2026-04-26T07:43:34.987506-05:00"
close-reason: verified
---

## Description

Render the §20 accessibility-assist badge pip in the HUD. The data plane is fully complete: `HudState.assistBadge` is populated by `deriveHudState` whenever the assist runtime reports any active assist. The renderer in `src/render/uiRenderer.ts` currently ignores that field. This slice closes F-027 by drawing a small corner badge that surfaces the primary assist label and a count when more than one assist is active.

## Context

Phase 4 polish task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/20-hud-and-ui-ux.md` ("small badge when any assist is active"). The producer module ships `ASSIST_BADGE_LABELS` mapping each label slug to the display string ("Auto accel", "Brake assist", "Steer smooth", "Toggle nitro", "Reduced input", "Visual weather"); the renderer consumes that dictionary so labels stay in one place.

Closes F-027 in `docs/FOLLOWUPS.md`. Mirrors the F-024 pattern (a producer module that has a documented consumer slice but no renderer yet).

## Affected Files

- `src/render/uiRenderer.ts` (update): accept `assistBadge` from `HudState` and draw a top-right pip below the splits widget. New `AssistBadgeColors` block on the existing options shape.
- `src/render/__tests__/uiRenderer.test.ts` (new): unit tests using a recording mock canvas. Cover (a) badge omitted when `HudState.assistBadge` is undefined, (b) badge drawn with the primary label when one assist is active, (c) badge drawn with primary label + `xN` suffix when multiple assists are active, (d) sequence of canvas calls covers fillRect (background pill), shadowed text (label), and color choice (default tinted accent).
- `docs/FOLLOWUPS.md`: mark F-027 as `done` with a resolution note pointing at this branch.

## Edge Cases

- `HudState.assistBadge` undefined: drawer is a no-op, nothing rendered, no canvas state mutation outside the regular HUD draw.
- `assistBadge.active === false`: drawer is a no-op (consumer should never reach the badge code path; defensive guard).
- Multiple assists active (`count >= 2`): label format is `${primaryLabel} ×N` where N is `count`. The multiplication sign is plain ASCII `x` to keep the §20 monospace stack happy and avoid any Unicode minefields.
- Badge layout must not overlap the splits widget: the splits widget uses up to ~62 px of vertical space at the top-right anchor (timer 20 px + sector 12 px + delta 16 px + padding); the assist badge sits below that band.
- Renderer state restoration: the existing pattern in `drawHud` saves and restores fillStyle / font / textAlign / textBaseline. The assist-badge draw must respect the same contract; tests assert no leaked context state.

## Verify

- [ ] `drawHud(ctx, hudState, viewport)` with `hudState.assistBadge === undefined` issues zero badge-related draw calls (recording mock canvas asserts no fillRect outside the existing HUD).
- [ ] `drawHud(ctx, hudState, viewport)` with `hudState.assistBadge = { active: true, primary: "auto-accelerate", count: 1, active_labels: ["auto-accelerate"] }` draws one rounded pill background plus the label text "Auto accel" via `drawShadowedText`.
- [ ] Same call with `count: 3, primary: "brake-assist"` draws the label "Brake assist x3" (or equivalent with the count suffix).
- [ ] After `drawHud` returns, `ctx.fillStyle`, `ctx.font`, `ctx.textAlign`, and `ctx.textBaseline` match their values before the call.
- [ ] No em-dashes anywhere in changed files.
- [ ] PROGRESS_LOG.md entry added per §6.
- [ ] F-027 marked `done` in `docs/FOLLOWUPS.md`.

## References

- F-027 (`docs/FOLLOWUPS.md`).
- `src/game/assists.ts` (`AssistBadge`, `AssistBadgeLabel`, `ASSIST_BADGE_LABELS`).
- `src/game/hudState.ts` (`HudState.assistBadge` already populated; renderer is the missing consumer).
- `docs/gdd/20-hud-and-ui-ux.md` ("small badge when any assist is active").
