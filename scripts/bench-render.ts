/**
 * Render perf bench (manual, not a CI gate).
 *
 * Pinned by `VibeGear2-implement-render-perf-f5492ef1`. The Vitest perf
 * assertion that lived in the parent `visual-polish` dot was fragile: a
 * machine-dependent threshold either flaked CI or stopped catching real
 * regressions. Per `AGENTS.md` "CI must be deterministic", this slice
 * moves the measurement into a manual `npm run bench:render` script that
 * prints frame-time stats. The CI gates that catch perf regressions are
 * bundle size and Lighthouse, both already wired by `ci-bundle-57af4a04`.
 *
 * What it measures:
 * - One full pseudoRoadCanvas.drawRoad pass per frame, against a stub
 *   CanvasRenderingContext2D so we time only the JS side. Real GPU /
 *   compositor cost is out of scope for this bench (see "Caveats" below).
 * - Three parallax bands (sky / mountains / hills) with mock images so
 *   the drawer takes the parallax branch.
 * - A dust pool primed to its 64-particle cap so the dust draw walks the
 *   full pool every frame. The dot calls this "60 sprites and parallax";
 *   we use the dust pool as a stand-in for the per-frame draw load until
 *   the sprite billboard renderer lands.
 * - VFX shake active so the strip pass runs inside a save / translate /
 *   restore pair.
 *
 * Why a stub ctx and not jsdom: jsdom's HTMLCanvasElement.getContext
 * throws unless the optional `canvas` npm package is installed. Adding
 * `canvas` would pull in a native build dep just for this bench. The
 * stub records nothing, so the timing reflects the JS-side draw work
 * (projector + drawer + parallax tiling + dust loop) plus the cost of
 * looking up methods on the ctx prototype. That is the right thing to
 * track for regression hunting; absolute frame-time numbers are not
 * comparable to a real browser.
 *
 * Output:
 *   bench:render (CPU canvas, indicative only)
 *     frames           600
 *     mean              0.234 ms
 *     p50               0.221 ms
 *     p95               0.318 ms
 *     p99               0.412 ms
 *
 * Run:
 *   npm run bench:render
 *
 * The bench uses Vitest as the TypeScript runner so the `@/` path
 * aliases resolve without an extra loader. The `it(...)` block is a
 * carrier for the timing loop, not an assertion: the script prints a
 * summary table to stdout and never gates CI.
 */

import { it } from "vitest";

import { loadTrack } from "@/data";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  project,
  type Camera,
  type Viewport,
} from "@/road";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import {
  EMIT_INTERVAL_TICKS,
  INITIAL_DUST_STATE,
  MAX_DUST,
  tickDust,
  type DustState,
} from "@/render/dust";
import { fireShake, INITIAL_VFX_STATE, tickVfx, type VfxState } from "@/render/vfx";
import type { ParallaxLayer } from "@/render/parallax";

const FRAMES = 600;
const VIEWPORT: Viewport = { width: 800, height: 480 };
const TRACK_ID = "test/curve";

/**
 * Stub CanvasRenderingContext2D covering every method the renderer
 * touches. No-ops: we are measuring the JS pipeline, not pixel fill
 * cost. Methods are top-level functions assigned once so the V8 hidden
 * class is stable across the bench loop.
 */
function makeStubCtx(): CanvasRenderingContext2D {
  const noop = (): void => {};
  return {
    fillStyle: "#000",
    strokeStyle: "#000",
    globalAlpha: 1,
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeText: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    measureText: () => ({ width: 0 }),
    setTransform: noop,
    resetTransform: noop,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Stub HTMLImageElement that the parallax tiling math reads `width`
 * from. The drawer never touches `height` or `naturalWidth`; matches
 * the parallax test's `makeImage` helper.
 */
function makeImage(width: number): HTMLImageElement {
  return { width } as unknown as HTMLImageElement;
}

function buildLayers(): readonly ParallaxLayer[] {
  return [
    { id: "sky", image: makeImage(512), scrollX: 0, bandHeight: 200, yAnchor: 0 },
    { id: "mountains", image: makeImage(512), scrollX: 0.25, bandHeight: 120, yAnchor: 0.4 },
    { id: "hills", image: makeImage(512), scrollX: 0.6, bandHeight: 80, yAnchor: 0.8 },
  ];
}

/**
 * Tick the dust pool until it reaches `MAX_DUST` particles so every
 * bench frame walks the full pool. With grass + speed > threshold the
 * pool emits one particle every `EMIT_INTERVAL_TICKS` ticks; we run a
 * comfortable margin past that to land on the cap.
 */
function primeDust(seed: number): DustState {
  let state = INITIAL_DUST_STATE;
  const ticksNeeded = MAX_DUST * EMIT_INTERVAL_TICKS + 4;
  for (let i = 0; i < ticksNeeded; i++) {
    state = tickDust(state, {
      surface: "grass",
      speed: 30,
      dtMs: 16,
      seed,
      origin: { x: VIEWPORT.width / 2, y: VIEWPORT.height * 0.7 },
    });
  }
  return state;
}

function primeVfx(): VfxState {
  // Long-lived shake so every bench frame pays the save / translate /
  // restore cost on the strip pass.
  return fireShake(INITIAL_VFX_STATE, {
    durationMs: FRAMES * 16,
    amplitudePx: 4,
    seed: 7,
  });
}

interface FrameStats {
  frames: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx] as number;
}

function summarise(samples: readonly number[]): FrameStats {
  const sorted = samples.slice().sort((a, b) => a - b);
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    frames: samples.length,
    mean: sum / samples.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function formatTable(stats: FrameStats): string {
  const fmt = (ms: number): string => `${ms.toFixed(3)} ms`;
  const lines = [
    "bench:render (CPU canvas, indicative only)",
    `  frames    ${String(stats.frames).padStart(10)}`,
    `  mean      ${fmt(stats.mean).padStart(10)}`,
    `  p50       ${fmt(stats.p50).padStart(10)}`,
    `  p95       ${fmt(stats.p95).padStart(10)}`,
    `  p99       ${fmt(stats.p99).padStart(10)}`,
  ];
  return lines.join("\n");
}

function runBench(): FrameStats {
  const compiled = loadTrack(TRACK_ID);
  const ctx = makeStubCtx();
  const layers = buildLayers();
  const dust = primeDust(13);
  const vfx = primeVfx();

  const camera: Camera = {
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    depth: CAMERA_DEPTH,
  };

  // Warm-up pass so JIT-compiled code is steady before we start
  // sampling. 60 frames matches one second of game-clock at the §21
  // 60 Hz fixed step.
  let warmVfx = vfx;
  for (let i = 0; i < 60; i++) {
    camera.z = i * 1.0;
    camera.x = Math.sin(i / 30) * 2;
    const strips = project(compiled.segments, camera, VIEWPORT);
    warmVfx = tickVfx(warmVfx, 16);
    drawRoad(ctx, strips, VIEWPORT, {
      parallax: { layers, camera },
      vfx: warmVfx,
      dust,
    });
  }

  const samples = new Array<number>(FRAMES);
  let liveVfx = warmVfx;
  for (let i = 0; i < FRAMES; i++) {
    camera.z = (60 + i) * 1.0;
    camera.x = Math.sin(i / 30) * 2;
    liveVfx = tickVfx(liveVfx, 16);
    const t0 = performance.now();
    const strips = project(compiled.segments, camera, VIEWPORT);
    drawRoad(ctx, strips, VIEWPORT, {
      parallax: { layers, camera },
      vfx: liveVfx,
      dust,
    });
    samples[i] = performance.now() - t0;
  }

  return summarise(samples);
}

it("bench:render prints frame-time stats", () => {
  const stats = runBench();
  // Surface the table on stdout so the npm script user sees it. We do
  // NOT assert against the numbers: this bench is informational.
  // eslint-disable-next-line no-console
  console.log("\n" + formatTable(stats) + "\n");
});
