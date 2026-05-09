---
title: "implement: visual polish (sprites, parallax, vfx) per §16 §17"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:36.980019-05:00\\\"\""
closed-at: "2026-04-29T09:41:24.209933-05:00"
close-reason: "Closed visual polish parent scope: sprite atlas, parallax, VFX flash/shake, off-road dust, and render benchmark coverage are implemented and logged through PR #91."
---

## Description

Layer visual polish onto the road renderer: sprite atlas for car and roadside objects, parallax sky / mountains, screen-space flash and shake on impact, dust kick-up off-road. Behaviour matches the art direction in §17 and the rendering pipeline in §16 / §21.

## Context

Phase 4 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/16-rendering-and-visual-design.md` and `docs/gdd/17-art-direction.md`.

## Affected Files

- `src/render/spriteAtlas.ts` (new): atlas loader
- `src/render/parallax.ts` (new): sky + parallax bands
- `src/render/vfx.ts` (update or new): flash, shake, dust
- `src/render/pseudoRoadCanvas.ts` (update): hook in parallax + sprites
- `src/data/atlas/*.json` (new): sprite atlas metadata
- `src/render/__tests__/spriteAtlas.test.ts` (new): sprite lookup, frame index math

## Edge Cases

- Atlas image fails to load: render placeholder rectangles, log error.
- Camera under high curve / grade: parallax does not jitter.
- Reduced-motion media query: skip shake (accessibility).

## Verify

- [ ] Atlas lookup test: `atlas.frame(spriteId, frameIdx)` returns the expected `(x, y, w, h)` rect for at least 5 known fixture entries; out-of-range `frameIdx` throws or wraps per documented behaviour.
- [ ] Atlas image load failure: stub `Image.onerror`; renderer falls back to a placeholder magenta rectangle and logs once via `console.error("[atlas]", path)`.
- [ ] Parallax math: `parallax.offsetFor(layer, cameraX, cameraY)` returns `cameraX * layer.factor` within `1e-6`; fixture covers 3 layers (sky, mountains, hills) at factors `0.0`, `0.25`, `0.6`.
- [ ] Parallax stability under curve/grade: a fixture camera moving along a high-curve track produces parallax offsets whose variance per frame is bounded by `2 px` over 600 frames (no frame-to-frame jitter).
- [ ] VFX flash: `vfx.flash({ intensity: 1.0, color: "#fff", duration: 200 })` adds a global-alpha overlay that decays to 0 over 200 ms; spy on canvas `globalAlpha` writes covers the curve.
- [ ] VFX shake: shake adds `(dx, dy)` translation that decays to 0 over 250 ms; the integral of the shake offset is zero (no net camera drift).
- [ ] Reduced-motion: with `matchMedia("(prefers-reduced-motion: reduce)").matches === true`, `vfx.shake(...)` is a no-op (spy on translate calls records zero shake-induced translates).
- [ ] Off-road dust: when the player's surface flag is `grass` for >= 3 ticks, dust particles emit at the rear of the player sprite; particle count is bounded by `MAX_DUST = 64`.
- [ ] Frame budget: a Vitest performance smoke (with `performance.now()`) measures `pseudoRoadCanvas.draw` at 60 sprites and parallax-on; mean frame time over 100 frames is `<= 6 ms` (10x headroom under 60 fps budget); fails on regression.
- [ ] Playwright visual smoke (`e2e/visual-polish.spec.ts`): load `/race?track=test-curve`, drive 5 s with arrow-up, screenshot, assert no diff against the committed `__snapshots__/visual-polish-curve.png` (tolerance: 1% pixel diff via Playwright's built-in toMatchSnapshot).
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/render src/data/atlas e2e/visual-polish.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 16, researcher pass)

The current spec lists files and verify bullets but leaves several call-site contracts undefined. An implementer would have to invent shapes that touch the existing road renderer and the §22 schemas. Concrete decisions to add to this dot before implementation begins.

### 1. Slice scope is too broad. Split this dot.

The Verify list bundles five orthogonal concerns: sprite atlas, parallax, vfx flash/shake, dust particles, perf budget. Each lands a different module in `src/render/` and each can ship independently. Recommend splitting into five sibling implement dots so a reviewer can land sprites without waiting on parallax fixtures and so each PR stays under the §6 "small slices" rule:

- `implement: sprite atlas (loader + frame index math)`
- `implement: parallax bands (sky / mountains / hills)`
- `implement: vfx flash + shake with reduced-motion gate`
- `implement: off-road dust particles`
- `implement: render perf budget regression test`

The current dot then becomes a tracking parent with `blocks:` listing the five children. Until the split is done, the rest of this stress-test pins enough detail that the bundled implementation can still proceed deterministically.

### 2. SpriteAtlas API must be pinned, not invented.

Verify says "atlas.frame(spriteId, frameIdx) returns the expected (x, y, w, h) rect" but the codebase has no atlas type. Pin in `src/render/spriteAtlas.ts`:

```ts
export interface AtlasFrame {
  x: number; y: number; w: number; h: number;
  /** Anchor offset relative to top-left, normalised 0..1; default {x:0.5,y:1} (foot of sprite). */
  anchor?: { x: number; y: number };
}

export interface AtlasMeta {
  /** Atlas image path relative to `public/`, e.g. `art/cars/sparrow.png`. */
  image: string;
  /** Source resolution; runtime asserts the loaded image matches. */
  width: number;
  height: number;
  /** Sprite id -> ordered frame list. Frame 0 is the canonical "facing camera" frame. */
  sprites: Record<string, AtlasFrame[]>;
}

export interface LoadedAtlas {
  meta: AtlasMeta;
  /** Loaded HTMLImageElement; null on load failure. */
  image: HTMLImageElement | null;
  /** True when the placeholder fallback is active. */
  fallback: boolean;
}

export function loadAtlas(meta: AtlasMeta): Promise<LoadedAtlas>;
export function frame(atlas: LoadedAtlas, spriteId: string, frameIdx: number): AtlasFrame;
```

`frame` semantics: out-of-range `frameIdx` wraps with modulo (do not throw) so an animated brake-light index can free-run without bounds checks at every call site. Unknown `spriteId` throws `RangeError` because that is a programming error, not a runtime condition.

### 3. AtlasMeta JSON schema lives in `src/data/atlas/`, validated by Zod.

`src/data/atlas/*.json` is listed but no schema is pinned. Add `AtlasMetaSchema` to `src/data/schemas.ts` so atlas JSON is validated at load time the same way cars / tracks are. Required fields: `image: z.string()`, `width: z.number().int().positive()`, `height: z.number().int().positive()`, `sprites: z.record(z.string(), z.array(z.object({x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), anchor: z.object({x: z.number(), y: z.number()}).optional()})).min(1))`. Reject empty sprite frame arrays so callers can index `[0]` safely.

### 4. Parallax API must match the road renderer's camera, not invent its own.

Verify says `parallax.offsetFor(layer, cameraX, cameraY)` returns `cameraX * layer.factor`. That is too narrow: the road renderer uses a `Camera { x, y, z, depth }` shape (per `@/road` exports). Pin instead:

```ts
export interface ParallaxLayer {
  id: "sky" | "mountains" | "hills";
  /** Image path; same semantics as AtlasMeta.image. */
  image: string;
  /** Horizontal scroll factor; 0 = static, 1 = locks to camera.x. */
  scrollX: number;
  /** Vertical band height in CSS px; layered top to bottom. */
  bandHeight: number;
  /** Vertical anchor in viewport: 0 = top, 1 = bottom. */
  yAnchor: number;
}

export function drawParallax(
  ctx: CanvasRenderingContext2D,
  layers: readonly ParallaxLayer[],
  camera: Pick<Camera, "x" | "z">,
  viewport: Viewport,
): void;
```

The factor `0.0 / 0.25 / 0.6` mentioned in Verify becomes `scrollX` per layer. Order is back-to-front (sky, mountains, hills); the drawer is responsible for filling each band and tiling horizontally so the same image repeats outside the camera-x range.

### 5. Parallax stability under curve/grade requires a concrete formula.

"Variance per frame is bounded by 2 px over 600 frames" needs a computation rule. Pin: parallax derives only from `camera.x` and `camera.z`, not from the per-segment curve. The road's curvature is already baked into the strip projector's centerline; if parallax also responded to curvature it would double-shift. The test fixture: feed a high-curve track to the road projector, accumulate camera.x via the loop's interpolation, and assert `parallax.drawParallax` produces a translation sequence whose first-difference variance is `<= 2 px`.

### 6. VFX module owns time, not the caller.

Verify says "decays to 0 over 200 ms" but no integration point is named. Pin a stateful module:

```ts
export interface VfxState {
  flashes: Array<{ color: string; intensity: number; remainingMs: number; durationMs: number }>;
  shakes: Array<{ amplitudePx: number; remainingMs: number; durationMs: number; seed: number }>;
}

export const INITIAL_VFX_STATE: Readonly<VfxState>;

export function fireFlash(state: VfxState, opts: { color: string; intensity: number; durationMs: number }): VfxState;
export function fireShake(state: VfxState, opts: { amplitudePx: number; durationMs: number; seed: number }): VfxState;
export function tickVfx(state: VfxState, dtMs: number): VfxState;     // pure decay
export function drawVfx(ctx: CanvasRenderingContext2D, state: VfxState, viewport: Viewport): { dx: number; dy: number };
```

`tickVfx` runs in the §10 fixed-step loop (deterministic). `drawVfx` runs in the rAF render callback and returns the camera offset so the road drawer can apply it before its own translate. This keeps the simulation deterministic (per AGENTS.md RULE 8) while letting the renderer pull the visual per-frame.

`fireShake.seed` channels through the §22 deterministic RNG so replays reproduce shake exactly. Without the seed, replays would diverge visually even when sim is bit-equal.

### 7. Reduced-motion gate is a one-liner at fire time.

Verify gates shake on `matchMedia("(prefers-reduced-motion: reduce)")`. Pin: the gate lives in `fireShake` so the state never grows in reduced-motion mode (memory bound). `fireFlash` is NOT gated because a 200 ms color flash on lap completion is not vestibular; only translation triggers the reduce check. Document the asymmetry in the file header so accessibility reviewers do not file a false issue.

The matchMedia query is read once at module load and cached. A test that flips the media query mid-test must call `vfx.refreshReducedMotionPreference()` (export this) so the cache is invalidated. Tests should not rely on the live media query.

### 8. Off-road dust needs a surface flag the player physics does not yet expose.

Verify says "when the player's surface flag is `grass` for >= 3 ticks". `src/game/physics.ts` does not currently emit a per-tick surface flag. Pre-flight: add `surface: "road" | "grass" | "rumble"` to `CarState` returned by `step(...)`. Derive from `|car.x| > roadHalfWidth` (grass) or `|car.x| in [roadHalfWidth, roadHalfWidth*1.15]` (rumble). This is a physics-side change, NOT a render-side change; either gate this dot on a small physics dot or include the surface-flag PR as a prerequisite step in the description.

`MAX_DUST = 64` is a particle pool size, not a per-frame emit rate. Pin emit rate: 1 particle per 2 ticks while surface is grass and speed > 8 m/s. Lifetime: 600 ms. Particles are rear-anchored to the player sprite at `(carScreenX +/- 12 px, carScreenY)` with random horizontal velocity uniformly in [-30, 30] px/s; the random draw uses the same shake seed channel from item 6 so replays reproduce dust positions.

### 9. Frame-budget perf test belongs in a separate dot, not Vitest.

"Vitest performance smoke ... mean frame time over 100 frames is <= 6 ms" is fragile in Vitest because CI runners vary by 5x in CPU speed. Move this to a manual `npm run bench:render` script that prints the result; the CI gate is bundle size + Lighthouse perf (already covered by `implement-ci-bundle-57af4a04`). Update the Verify bullet to drop the hard `<= 6 ms` claim and replace with "render benchmark prints frame time; regressions investigated in PR review". Fold the explicit perf gate into the CI bundle dot.

### 10. Playwright snapshot needs reproducible determinism.

Verify says "screenshot, assert no diff against the committed `__snapshots__/visual-polish-curve.png`". Browser rendering is not deterministic across OS or even GPU drivers; a 1% pixel-diff tolerance still fails on font hinting changes between Chrome versions. Pin determinism prerequisites:

- The race uses a fixed seed (`?seed=1234` via the URL).
- The track is a synthetic test track, not an authored one (no roadside sprite RNG).
- The screenshot is taken at a fixed fixed-step tick count (e.g. tick 300), not after a wall-clock 5 s drive, by exposing a `?tick=300` query param that runs the loop in headless mode and stops.
- Tolerance: 5% pixel diff (loosen from 1%; stricter is brittle on CI).

These prerequisites are NEW dependencies on the §10 loop and the race page. List them explicitly in `## Affected Files`:

- `src/app/race/page.tsx` (update): support `?seed=` and `?tick=` query params for headless screenshot mode.
- `src/game/loop.ts` (update): expose a `runTo(tickCount)` deterministic mode for tests.

### 11. Atlas image path resolution rules.

`AtlasMeta.image: "art/cars/sparrow.png"` needs a documented base URL. Pin: paths are relative to `public/`, resolved through `next/image` static loader semantics (i.e. they become URLs `/art/cars/sparrow.png` at runtime). The atlas loader uses `new Image()` with `img.src = "/" + meta.image`. Tests run under jsdom with `Image` shimmed; document that the shim must call `onload` synchronously after `src` is set so the loader's promise resolves.

### 12. Affected files refinement.

Add to the list:
- `src/data/atlas/cars.json` (new): one concrete atlas fixture with the 12-16 directional frames + 3 damage variants from §17 "Car sprites".
- `src/data/atlas/roadside.json` (new): per §16 "Roadside objects", one atlas with at least 5 prop categories.
- `public/art/cars/sparrow.png` (new): placeholder image; a 192x96 magenta-on-black grid is acceptable (pinned by `implement-placeholder-art-d68d1ee2`, which this dot consumes).
- `src/render/__tests__/parallax.test.ts` (new): missed in current list.
- `src/render/__tests__/vfx.test.ts` (new): also missed.

Drop:
- `e2e/visual-polish.spec.ts` if item 9 splits perf out and item 10 prerequisites are not in scope; otherwise keep but move to its own spec dot.

### 13. Blocks/blocked-by audit.

Per item 8, this dot effectively depends on a `physics.surface` field. Per item 12, it consumes `implement-placeholder-art-d68d1ee2`. Add `blocks:` reflecting the placeholder-art dot. The dot also consumes the renderer landed in the Phase 1 vertical slice; gate by `implement-phase-1-7aef013d` finishing first.

### Pre-flight required before implementer starts

1. Decide on the split per item 1; if not splitting, accept the bundle but expect a much larger PR than §6 prefers.
2. Land the `physics.surface` pre-flight from item 8.
3. Add Zod `AtlasMetaSchema` per item 3.
4. Decide on the perf-test home per item 9.
5. Decide on the screenshot determinism prerequisites per item 10.

Without these, an implementer cannot reach a green Verify list deterministically.
