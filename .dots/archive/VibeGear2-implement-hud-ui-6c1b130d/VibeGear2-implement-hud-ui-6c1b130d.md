---
title: "implement: HUD + UI/UX polish per §20"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:39.814627-05:00\\\"\""
closed-at: "2026-04-30T10:51:39.783159-05:00"
close-reason: All tracked §20 HUD and pause child slices are merged and production-smoked through ea20c42. Remaining online leaderboard storage is blocked separately by Q-011; F-068 is art FX polish outside this parent.
blocks:
  - VibeGear2-implement-minimal-hud-a25f39dc
---

## Description

Polish the HUD per `docs/gdd/20-hud-and-ui-ux.md`: full layout (speedometer, lap timer, position, damage indicator, minimap, weather indicator), pause menu, results screen styling. Settings page (units, assists, audio levels). Title screen with start / continue / settings.

> **Researcher note (iter-30, 2026-04-26):** several of this parent dot's
> sub-slices have already landed on `main`. Tracking status:
> - DONE: title-screen menu wiring (`52ee6cf`, three-action menu w/ Continue gate).
> - DONE: pause overlay + error boundary (`94379fa`).
> - DONE: minimal HUD (`d881198`, speed / lap / position).
> - DONE: minimap projection + HUD overlay drawer (`9b3c71f`).
> - DONE: sector splits + ghost delta widget (`9ab8887`, top-right per §20).
> - DONE: /options settings scaffold + Difficulty pane (`60c0c67`, `2b06fb5`).
> Still outstanding under this parent: settings persistence for the
> remaining five panes (Display, Audio, Assists, Accessibility, Profile),
> HUD reflow on resize, full pause action set (restart/retire/leaderboard/exit),
> damage indicator, weather indicator, results screen styling. Consider
> splitting these into siblings per item 1 in the stress-test below; the
> parent dot should not block on any single one.

## Context

Phase 4 task per `docs/IMPLEMENTATION_PLAN.md`. Phase 1 had a minimal HUD; this slice replaces it with the production layout.

## Affected Files

- `src/render/uiRenderer.ts` (update or split): full HUD draw
- `src/road/minimap.ts` (new): minimap projection from track segments
- `src/app/page.tsx` (update): production title screen
- `src/app/settings/page.tsx` (new)
- `src/components/pause/*` (new): pause overlay
- `e2e/pause-menu.spec.ts` (new): open / close pause, settings change persists

## Edge Cases

- Pause during countdown: countdown freezes.
- Settings change mid-race: applied next race for assists; immediately for units.
- Resize during pause: HUD reflows.

## Verify

- [ ] HUD draw test (Vitest with a `node-canvas` shim or a `mock-canvas-api`): given a known `hudState`, `uiRenderer.drawHud` issues the expected sequence of canvas calls covering speedometer, lap timer ("MM:SS.mmm"), position ("Nth / M"), damage indicator (per-zone bar), minimap blob, weather icon. Use a recording mock canvas to assert each draw call shape.
- [ ] Minimap projection: given a fixture track of 80 compiled segments, `minimap.project(track, cameraSegmentIndex)` returns 80 `{x, y}` points within the configured minimap rectangle bounds.
- [ ] Title screen renders three actions: "Start", "Continue" (only if a save exists), "Settings"; RTL test covers both save-present and fresh-start states.
- [ ] Settings page edits each control (units, assists, master/music/sfx levels) and writes via `src/persistence/save.ts`; reload, values persist.
- [ ] Pause overlay opens on the configured key (default `Escape`), freezes the sim accumulator (no advancement during pause), shows resume / settings / quit; Playwright e2e (`e2e/pause-menu.spec.ts`) presses Escape mid-race, asserts speedometer value is unchanged after 500 ms.
- [ ] Pause during countdown: countdown ticker is also frozen (Playwright asserts the countdown number does not change while paused).
- [ ] Units toggle (`kph` ↔ `mph`) takes effect immediately on the speedometer with no race restart (Playwright assertion).
- [ ] Resize during pause: HUD reflows on the next animation frame; Playwright uses `page.setViewportSize` and asserts no overlap of HUD elements at 800x600 and 1920x1080.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/render/uiRenderer.ts src/road/minimap.ts src/app/settings src/components/pause e2e/pause-menu.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 16, researcher pass)

The current spec lists outcomes but leaves data shapes, ownership, and ordering against existing modules undefined. An implementer would have to invent the HUD state extension, the pause-overlay protocol, and the settings persistence path. Concrete decisions to add to this dot before implementation begins.

### 1. Slice scope is too broad. Split this dot.

The Verify list bundles seven independent surfaces: full HUD draw, minimap projection, title screen, settings page, pause overlay, units toggle, resize reflow. Each is its own deliverable. Recommend splitting into siblings so each can land independently:

- `implement: HUD full layout (lap timer, best lap, nitro, damage, weather)`
- `implement: minimap projection + render`
- `implement: title screen production layout`
- `implement: settings page (units, assists, audio)`
- `implement: pause overlay extension (settings link, restart, retire, exit-to-title)`
- `implement: HUD reflow on resize`

Keep this dot as a tracking parent with `blocks:` listing the children. Until split, the rest of this stress-test pins enough detail that a bundled implementation can still proceed.

Note: an existing `src/components/pause/` directory already ships `PauseOverlay.tsx`, `usePauseToggle.ts`, `pauseAction.ts`. The dot's "Pause overlay" Verify bullet is partially satisfied. Audit those files before re-implementing; the slice should EXTEND them, not replace.

### 2. HudState shape needs a polish-slice extension, not a rewrite.

`src/game/hudState.ts` currently exposes `HudState { speed, speedUnit, lap, totalLaps, position, totalCars }`. The §20 polish HUD needs many more fields. Pin a backwards-compatible extension:

```ts
export interface HudState {
  // Existing fields, unchanged.
  speed: number;
  speedUnit: SpeedUnit;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;

  // Polish-slice additions (all optional so old callers still type-check):
  gear?: number;                     // 1..6, 0 = neutral, -1 = reverse
  lapTimerMs?: number;               // current-lap elapsed in ms
  bestLapMs?: number | null;         // null when no lap completed yet
  nitro?: { current: number; max: number };
  damagePerZone?: Record<"engine" | "tires" | "body" | "gearbox", number>; // 0..1
  weatherIcon?: "clear" | "rain" | "fog" | "snow";
  cashDelta?: number;                // since race start, signed
  gripHint?: "dry" | "wet" | "ice";
}
```

`deriveHudState` becomes additive: existing tests keep passing, new fields are derived from a richer `HudStateInput` that also takes the §13 damage state, the §14 weather snapshot, the §22 economy delta. Document that pre-polish callers may pass a minimal input and get a minimal output; the renderer's per-field guards are pinned in item 3.

### 3. Renderer per-field guards.

§20 says the polish HUD has top-center lap timer, top-right best lap / ghost delta, bottom-left damage and weather grip, bottom-center nitro meter, bottom-right speed and gear. The drawer must not render a region whose source field is missing. Pin in `src/render/uiRenderer.ts`:

```ts
if (state.lapTimerMs != null) drawLapTimer(ctx, state.lapTimerMs, ...);
if (state.bestLapMs != null) drawBestLap(ctx, state.bestLapMs, ...);
// etc
```

This keeps the §6 split feasible: a slice that lands lap timer alone shows the top-center clock without forcing damage / weather to ship at the same time.

### 4. Lap timer formatting.

Verify says `MM:SS.mmm`. Pin: `formatLapTime(ms: number): string` lives in `src/game/hudState.ts` (pure derivation, headless-testable). Format: minutes 2-digit (no hour rollover), seconds 2-digit, milliseconds 3-digit. Examples:

- `0` -> `"00:00.000"`
- `73499` -> `"01:13.499"`
- `3600000` -> `"60:00.000"` (race laps never approach an hour)

Negative input collapses to `"00:00.000"`. Non-finite collapses to `"--:--.---"` so the HUD can render "no time" without a sentinel string in the caller.

### 5. Position formatting.

Verify says position renders as "Nth / M". The current `HudState.position` is a 1-indexed number. Pin: `formatPosition(n: number): string` returns `"1st"`, `"2nd"`, `"3rd"`, then `"4th"` ... `"20th"`, then `"21st"`, etc. (English ordinal suffix). The HUD draws `${formatPosition(state.position)} / ${state.totalCars}`. Localisation is OUT OF SCOPE; English-only per §20 (no L10N requirement in MVP).

### 6. Minimap projection: world-space, not segment-index.

Verify says `minimap.project(track, cameraSegmentIndex)` returns 80 points. Pin signature instead:

```ts
export interface MinimapPoint { x: number; y: number; }

export function projectMinimap(
  track: CompiledTrack,
  cameraZ: number,
  bounds: { x: number; y: number; w: number; h: number },
): {
  /** Flattened polyline of the lap, normalised to fit `bounds`. */
  path: MinimapPoint[];
  /** Player position marker. */
  player: MinimapPoint;
};
```

Working from `cameraZ` (meters) instead of segment index keeps the minimap consistent with how the projector consumes camera state. The polyline is precomputed once per track (memoise on `track.totalLength` + `bounds` hash); only the player marker recomputes per frame.

### 7. Pause freeze: which clock stops?

Verify says pause "freezes the sim accumulator (no advancement during pause)". The §10 loop has a fixed-step accumulator. Pin: `pause.set(true)` halts the rAF callback's call to `simulate()` AND zeroes the accumulator on the next resume so a long pause does not produce a burst of catch-up ticks. The render callback continues running (so the HUD redraws on resize during pause).

The countdown gate is a separate clock; per §15 the countdown is implemented as a timer in `RaceState`. Pin: pause also halts countdown advancement so "pause during countdown" visibly freezes the count. The Playwright assertion in Verify already covers this.

### 8. Pause action set is incomplete.

§20 lists six pause actions: resume, restart race, retire race, settings, leaderboard / ghost, exit to title. The Verify bullet only mentions "resume / settings / quit". Pin the full set per §20 even if some buttons route to a "coming soon" toast in MVP. List in the dot's body which actions ship working in this slice and which are stubs; reviewers should expect the visual treatment of all six.

`implement-restart-retire-888c712b` already covers restart + retire wiring. Note `blocks:` between dots so an implementer knows which slice owns which action.

### 9. Settings page: which storage path, which schema?

Verify says "writes via `src/persistence/save.ts`". Existing save module owns `defaultSave()`, versioned migration, and a singleton key. Settings live inside the save's `settings: SaveGameSettings`. Pin:

- Settings page reads with `loadSave()` once on mount, hydrates a local form state, writes back via `saveGame(saveGame => ({ ...saveGame, settings: { ...next } }))`.
- The form is uncontrolled per-section; saves on blur + on submit so the user sees the change in the live HUD before navigating away (per Verify: "units toggle takes effect immediately on the speedometer with no race restart"). Live effect uses a `subscribe` pattern from `src/persistence/save.ts`; if no subscribe exists, add one in this slice.

The §22 schema expansion for settings is owned by `implement-savegamesettings-b948015a`. This dot CONSUMES that schema; it must not redefine it. Add `blocks:` from this dot to that one (or merge if `savegamesettings` lands first).

### 10. Settings categories and controls.

Verify lists "units, assists, master/music/sfx levels". §20 Settings section adds: controls, display, accessibility, game feel assists, profile / save clear. Pin the MVP control set:

- Display: speed unit (`kph` | `mph`).
- Audio: master, music, sfx (each 0..1 slider).
- Assists: steer assist (off | low | high), brake assist (off | on), traction (off | on).
- Accessibility: reduce motion (boolean), high contrast (boolean), colorblind mode (none | protan | deutan | tritan).
- Profile: clear save (button with confirm dialog).

Controls (key remap) is owned by `implement-key-remap-a0908466`; link from this dot via `blocks:` and gate the Settings "Controls" tab on that landing.

### 11. Title screen: when does "Continue" appear?

Verify says "Continue (only if a save exists)". Pin: "save exists" means `loadSave()` returns a non-default save (i.e. `save.profile.totalRaces > 0` or any garage purchase or any career progress). Just having a default-stamped record from a fresh visit does NOT enable Continue. Otherwise a player who launches the game once and clears settings would see Continue with nothing to continue.

The detection runs synchronously at render time; do not block the title screen on async load. If `loadSave()` is async, gate on a `useEffect` that flips a local boolean. Document the brief flicker as acceptable; the alternative (loading screen) is overkill for a title.

### 12. Resize reflow: layout primitive choice.

Verify says "HUD reflows on next animation frame". The HUD is drawn into a Canvas2D context (per existing `uiRenderer.ts`). Reflow means the next `drawHud(ctx, state, viewport)` call uses the new viewport dimensions. Pin: the canvas element subscribes to `ResizeObserver`; the observer callback updates a `viewportRef` consumed by the rAF render callback. No DOM-side reflow; the HUD is canvas, not HTML.

The pause-menu overlay IS DOM (per existing `PauseOverlay.tsx`) and reflows automatically with CSS. Document the asymmetry so the Playwright reflow assertion targets the canvas data-testid, not a DOM element.

### 13. Affected files refinement.

Add:
- `src/game/hudState.ts` (update): extend `HudState` per item 2; add `formatLapTime`, `formatPosition`.
- `src/game/__tests__/hudState.test.ts` (update): add cases for new fields, formatters, and zero / negative / NaN edge cases.
- `src/render/__tests__/uiRenderer.test.ts` (new): mock-canvas drawHud assertions per item 3.
- `src/road/__tests__/minimap.test.ts` (new): missed in current list.
- `src/app/page.tsx` (update): title screen with three actions, item 11 Continue gate.
- `src/app/settings/page.tsx` (new): per item 10.
- `e2e/title-screen.spec.ts` (new): item 11 Continue visibility per save state.
- `e2e/settings.spec.ts` (new): item 9 persistence assertions.
- `e2e/pause-menu.spec.ts` (new): existing.

Revise:
- `src/components/pause/*` (new) -> `(update)`. Files already exist.

### 14. Blocks / blocked-by audit.

This dot CONSUMES:
- `implement-savegamesettings-b948015a` (settings schema must land first).
- `implement-key-remap-a0908466` (controls tab).
- `implement-restart-retire-888c712b` (pause actions wiring).
- `implement-race-rules-b30656ae` (lap timer derivation needs race-rules state).
- `implement-damage-model-765f2bb9` (damagePerZone source).
- `implement-weather-38d61fc2` (weatherIcon source).

Add `blocks:` reflecting these. The dot should NOT activate until at least the first three land; otherwise the slice will mock state that other dots are about to define, creating churn.

The current `blocks:` field lists `VibeGear2-implement-minimal-hud-a25f39dc`, which does not appear anywhere in the dots directory. Audit this id; either correct or remove.

### 15. Pre-flight required before implementer starts

1. Decide on the split per item 1.
2. Land the `SaveGameSettings` schema expansion per item 14.
3. Pin the full pause action set per item 8.
4. Confirm minimap polyline cache strategy per item 6.
5. Audit the stale `blocks:` id per item 14.

Without these, an implementer will either ship a slice that contradicts pending schema work or ship a slice so large it violates §6 "small slices".
