---
title: "implement: Phase 1 vertical slice integration (drivable 30s demo)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:48.646199-05:00\\\"\""
closed-at: "2026-04-26T03:15:31.018457-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-keyboard-gamepad-6ff1e38c
  - VibeGear2-implement-single-ai-4cdd40cd
  - VibeGear2-implement-minimal-hud-a25f39dc
---

## Description

Wire the renderer, fixed-step loop, physics, input layer, single AI car, and minimal HUD into one playable scene. Add one straight track and one curved track as JSON. The page at `/race` boots the demo: countdown, drive, finish a 1-lap micro-race against the AI.

## Context

Phase 1 Definition of Done in `docs/IMPLEMENTATION_PLAN.md` §3: "a 30-second drive feels like the design pillars in §1". This is the integration slice that proves the architecture before Phase 2 layers on rules and economy.

## Affected Files

- `src/app/race/page.tsx` (new): mounts the demo
- `src/game/raceSession.ts` (new): glue between input, sim, AI, render
- `src/data/tracks/test-straight.json` (new)
- `src/data/tracks/test-curve.json` (new)
- `e2e/race-demo.spec.ts` (new): Playwright test that loads `/race`, presses Up arrow for 5 s, asserts speed > 0 and HUD shows lap "1 / 1"

## Edge Cases

- User finishes a lap: race ends, results overlay shown.
- User leaves the road and stays off: race continues with off-road slowdown applied.
- Page resized mid-race: viewport adjusts, sim does not skip steps.

## Verify

- [ ] `/race` boots in browser, countdown plays, car drives, AI drives, HUD updates.
- [ ] Lap completes after roughly the expected time (note in PROGRESS_LOG.md).
- [ ] Playwright e2e test passes.
- [ ] No console errors during a 30-s drive.
- [ ] Phase 1 demo recording or screenshot attached to the PROGRESS_LOG.md entry.
- [ ] No em-dashes in any added file.

## Spec stress-test (iteration 16, researcher pass)

The current spec lists deliverables but leaves the integration glue undefined. With every blocker dot now archived (`keyboard-gamepad-6ff1e38c`, `single-ai-4cdd40cd`, `minimal-hud-a25f39dc`), this dot is genuinely ready to activate. Concrete decisions to add before implementation begins.

### 1. RaceSession is the missing glue module. Pin its shape.

`src/game/raceSession.ts` is listed but no signature is defined. Pin:

```ts
import type { CompiledTrack } from "@/road/trackCompiler";
import type { CarState, TrackContext } from "@/game/physics";
import type { RaceState } from "@/game/raceState";
import type { AIState } from "@/game/ai";
import type { CarBaseStats, AIDriver } from "@/data/schemas";

export interface RaceSessionConfig {
  track: CompiledTrack;
  trackContext: TrackContext;
  player: { stats: CarBaseStats; initial?: Partial<CarState> };
  ai: ReadonlyArray<{ driver: AIDriver; stats: CarBaseStats; initial?: Partial<CarState> }>;
  totalLaps: number;
  /** RNG seed for AI mistakes / shake / spawning. Pinned by §22 schema. */
  seed: number;
}

export interface RaceSessionState {
  race: RaceState;
  player: { car: CarState };
  ai: ReadonlyArray<{ car: CarState; state: AIState }>;
  /** Frame counter increments on every fixed-step tick. Used by ghost replay. */
  tick: number;
}

export function createRaceSession(config: RaceSessionConfig): RaceSessionState;
export function stepRaceSession(
  session: RaceSessionState,
  playerInput: Input,
  config: RaceSessionConfig,
  dt: number,
): RaceSessionState;
```

`stepRaceSession` is pure: it does not own the rAF loop. The `/race` page wires `step` into `startLoop({ simulate, render })`. This keeps determinism boundaries clean per AGENTS.md RULE 8.

### 2. Countdown lifecycle.

§7 says race phases are `idle | countdown | racing | finished`. Pin: `createRaceSession` returns `phase: "countdown"` with `countdownRemainingSec: 3`. `stepRaceSession` decrements the timer; at 0 it flips to `racing` and resets `tick = 0` so lap timing starts at the green light.

The countdown duration is a config field (`countdownSec: number` defaulting to 3) so the practice-quick dot can override to 0 for instant-start practice modes.

### 3. Lap completion + finish detection.

Edge Case "User finishes a lap" needs a concrete rule. Pin:

```
Lap progress = floor(player.car.z / track.totalLength)
On increment: race.lap += 1; race.lapTimeMs is recorded.
When race.lap > config.totalLaps: race.phase = "finished".
```

The §7 race-rules dot owns the full DNF + retire logic. This integration slice ships only the happy-path "complete N laps" check; everything else is deferred. Document that explicitly so the slice does not bloat into a rules engine.

### 4. AI grid spawning is OUT OF SCOPE for Phase 1.

The dot says "single AI car" and the description matches. Pin the AI start position: 5 m behind the player, same lateral offset 0. No grid pattern, no staggering. The full grid is owned by `implement-ai-grid-02d7e311`.

### 5. Track JSON files: which schema?

`src/data/tracks/test-straight.json` and `test-curve.json` need a concrete schema. Pin: they validate against `TrackSchema` from `src/data/schemas.ts`. Test-straight is one segment of length 1200 m, curve 0, grade 0. Test-curve is three segments: 600 m straight, 600 m sweeper at curve 0.5, 600 m straight. Both use `roadsideLeft: "default"`, `roadsideRight: "default"`, `hazards: []`.

Track loading is a single `import` of the JSON file; Next.js + TypeScript resolves it as `unknown` and the `TrackSchema.parse(...)` call validates. Document that `import` semantics, not `fetch`, so the bundle includes the JSON at build time and the demo loads instantly.

### 6. Race page: mounting, suspense, and abort.

`src/app/race/page.tsx` should:

- Use `"use client"` (the loop is browser-only).
- Read `?track=test-straight` from `useSearchParams()`; default to `test-curve`. Validate against the track id list and 404 if unknown.
- Mount one canvas at 800x480 (matches the existing /dev/road and /dev/ai pages for visual consistency).
- Hold the loop handle in a `useRef` and stop it on unmount; otherwise StrictMode double-mount in dev produces two parallel loops.
- Show the existing `<PauseOverlay>` from `src/components/pause/`. Pause halts the sim accumulator per the hud-ui dot's item 7.
- Wrap in `<ErrorBoundary>` from `src/components/error/`. Crash in `step` or `tickAI` should fall through to the boundary, not the browser console.

### 7. HUD wiring.

The minimal HUD lives in `src/render/uiRenderer.ts` and consumes `HudState` from `src/game/hudState.ts`. Pin: every render frame, the page derives a fresh `HudState` from the session state and passes to `drawHud(ctx, state, viewport)`. The position field requires a `RankedCar[]`; build it from the session each frame:

```ts
const cars: RankedCar[] = [
  { id: "player", totalProgress: session.player.car.z + (session.race.lap - 1) * track.totalLength },
  ...session.ai.map((a, i) => ({ id: `ai${i}`, totalProgress: a.car.z + (session.race.lap - 1) * track.totalLength })),
];
```

Note: the AI laps may differ from the player's; pin a `lap` field in `AIState` or compute per-AI progress from `floor(ai.car.z / track.totalLength)`. Recommend the latter for Phase 1 simplicity.

### 8. Off-road slowdown is owned by physics.

Edge Case "User leaves the road and stays off: race continues with off-road slowdown" is already implemented in `src/game/physics.ts` (per the F-015 followup notes; the slowdown ships, the persistent-damage extension is deferred). Phase 1 just needs to NOT add a special case; the physics step handles it. Drop the bullet from Verify or rephrase to "off-road slowdown engages without sim glitches".

### 9. Resize handling.

Edge Case "Page resized mid-race: viewport adjusts, sim does not skip steps" needs implementation. Pin: a `ResizeObserver` on the canvas updates a `viewportRef`. The sim accumulator is unaffected by render-side viewport changes (per §10 fixed-step design). The render callback reads the live `viewportRef` and passes it to `drawRoad` + `drawHud`. Document that the canvas internal resolution scales with the CSS pixel size on a `devicePixelRatio` cap of 2 (per §27 performance settings).

### 10. Verify list refinement.

Add concrete acceptance:
- [ ] On a 60 fps machine, the demo holds 60 fps for the entire 30 s drive (manual verification, `performance.now()` log).
- [ ] AI finishes the lap within 5 s of the player on the curve track at default settings (the AI is a clean_line driver; gross-mismatch in finish times indicates a tuning bug).
- [ ] Pause -> resume preserves the sim state bit-equal (no accumulator burst).
- [ ] StrictMode double-mount does not produce two loops (`handleRef.current?.stop()` cleanup verified).

Drop:
- [ ] "Phase 1 demo recording or screenshot attached to the PROGRESS_LOG.md entry." Attaching binaries to a markdown log is not supported in this repo's convention; replace with "PROGRESS_LOG.md entry links to the deployed demo URL" once the auto-deploy from F-003 is live.

### 11. Affected files refinement.

Add:
- `src/game/__tests__/raceSession.test.ts` (new): unit tests for the pure `stepRaceSession` (countdown -> racing -> finished, lap increment, AI advancement).
- `src/data/__tests__/tracks-content.test.ts` (new): validate both fixture tracks against `TrackSchema`.

The Playwright spec `e2e/race-demo.spec.ts` is currently the only integration-level test. Pin its assertions:
- After page load, the canvas mounts and the countdown text "3" appears.
- After 5 s of holding ArrowUp, `[data-testid=hud-speed]` text > 0.
- After the lap completes (configurable wait, ~30 s for test-curve), `[data-testid=race-finished]` appears.

Add `data-testid` attributes on the canvas, speedometer, and finished-state element so Playwright has stable selectors.

### 12. Blocks / blocked-by audit.

Current `blocks:` list is the inverse direction (these are dots this slice depends on, all archived). The yaml semantic in this repo is "blocks" = "this dot blocks others", but the listed dots are upstream of phase-1, not downstream. Audit: rename the field to `blocked-by` if the dot CLI supports it, or remove the obsolete `blocks:` list since all three are archived. Add a forward-looking `blocks:` list naming the dots that need this integration:

- `implement-ai-grid-02d7e311` (full grid uses raceSession scaffold)
- `implement-race-rules-b30656ae` (race-rules engine extends RaceSession)
- `implement-restart-retire-888c712b` (restart/retire actions hook into RaceSession)

### Pre-flight required before implementer starts

1. Decide on `blocks` vs `blocked-by` semantic per item 12.
2. Confirm RaceSession lives in `src/game/`, not `src/app/`. Pure module, no React.
3. Confirm track JSON loading uses `import`, not `fetch`.
4. Pin the countdown duration default at 3 s.

With these pins the slice is unambiguous and an implementer can ship a green PR without further spec hunts.
