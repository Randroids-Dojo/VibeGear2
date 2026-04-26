import { describe, expect, it } from "vitest";

import type { Camera, Viewport } from "@/road/types";

import {
  bandRect,
  drawParallax,
  PARALLAX_PX_PER_WORLD_X,
  PLACEHOLDER_FILL,
  parallaxOffsetFor,
  type ParallaxLayer,
} from "../parallax";

/**
 * Minimal stand-in for `HTMLImageElement` covering only the surface the
 * drawer touches (`width`). The drawer never reads `height` directly; it
 * uses `layer.bandHeight` for vertical sizing so the drawer works the
 * same with placeholder magenta as it does with a real image.
 */
function makeImage(width: number): HTMLImageElement {
  return { width } as unknown as HTMLImageElement;
}

interface DrawCall {
  type: "drawImage";
  image: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FillCall {
  type: "fillRect";
  fillStyle: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Call = DrawCall | FillCall;

interface Spy {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
}

/**
 * Hand-rolled spy for the only two `CanvasRenderingContext2D` methods
 * the drawer touches. Avoids pulling jsdom into a node test environment;
 * matches the sprite-atlas test's strategy of stubbing only what is
 * exercised so the suite stays in the Vitest node env.
 */
function makeSpy(): Spy {
  const calls: Call[] = [];
  let fillStyle = "";
  const ctx = {
    get fillStyle(): string {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({ type: "fillRect", fillStyle, x, y, w, h });
    },
    drawImage(
      image: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number,
    ): void {
      calls.push({ type: "drawImage", image, x, y, w, h });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const VIEWPORT: Viewport = { width: 800, height: 600 };

describe("parallaxOffsetFor", () => {
  it("returns camera.x * scrollX in pixels", () => {
    expect(parallaxOffsetFor({ scrollX: 0 }, { x: 1234.5 })).toBe(0);
    expect(parallaxOffsetFor({ scrollX: 0.25 }, { x: 100 })).toBeCloseTo(25, 9);
    expect(parallaxOffsetFor({ scrollX: 0.6 }, { x: 100 })).toBeCloseTo(60, 9);
    expect(parallaxOffsetFor({ scrollX: 1 }, { x: 100 })).toBeCloseTo(100, 9);
  });

  it("scales by PARALLAX_PX_PER_WORLD_X", () => {
    // Documents the constant so tuning it later flips this assertion in
    // one place rather than 40 fixture pixels.
    expect(PARALLAX_PX_PER_WORLD_X).toBe(1);
  });

  it("is deterministic: same camera returns the same offset", () => {
    const a = parallaxOffsetFor({ scrollX: 0.6 }, { x: 42.5 });
    const b = parallaxOffsetFor({ scrollX: 0.6 }, { x: 42.5 });
    expect(a).toBe(b);
  });
});

describe("bandRect", () => {
  it("anchors to the viewport top when yAnchor is 0", () => {
    const r = bandRect({ bandHeight: 120, yAnchor: 0 }, VIEWPORT);
    expect(r).toEqual({ y: 0, height: 120 });
  });

  it("anchors flush to the viewport bottom when yAnchor is 1", () => {
    const r = bandRect({ bandHeight: 120, yAnchor: 1 }, VIEWPORT);
    expect(r).toEqual({ y: 480, height: 120 });
  });

  it("centers the band when yAnchor is 0.5", () => {
    const r = bandRect({ bandHeight: 120, yAnchor: 0.5 }, VIEWPORT);
    expect(r).toEqual({ y: 240, height: 120 });
  });
});

describe("drawParallax", () => {
  function defaultLayers(): ParallaxLayer[] {
    return [
      { id: "sky", image: makeImage(512), scrollX: 0, bandHeight: 200, yAnchor: 0 },
      { id: "mountains", image: makeImage(512), scrollX: 0.25, bandHeight: 120, yAnchor: 0.4 },
      { id: "hills", image: makeImage(512), scrollX: 0.6, bandHeight: 80, yAnchor: 0.8 },
    ];
  }

  it("draws the three layers in array order (back to front)", () => {
    const { ctx, calls } = makeSpy();
    const layers = defaultLayers();
    drawParallax(ctx, layers, { x: 0, z: 0 }, VIEWPORT);
    const drawImageCalls = calls.filter((c): c is DrawCall => c.type === "drawImage");
    // Sky paints first (back), hills last (front). Each layer may emit
    // multiple drawImage calls due to tiling; we only assert the order
    // of the first call per layer.
    const layerOrder: string[] = [];
    for (const call of drawImageCalls) {
      const layer = layers.find((l) => l.image === call.image);
      if (layer && layerOrder[layerOrder.length - 1] !== layer.id) {
        layerOrder.push(layer.id);
      }
    }
    expect(layerOrder).toEqual(["sky", "mountains", "hills"]);
  });

  it("tiles horizontally when camera.x scrolls past the image width", () => {
    const { ctx, calls } = makeSpy();
    const layer: ParallaxLayer = {
      id: "hills",
      image: makeImage(512),
      scrollX: 1,
      bandHeight: 80,
      yAnchor: 1,
    };
    drawParallax(ctx, [layer], { x: 10000, z: 0 }, VIEWPORT);
    const drawImageCalls = calls.filter((c): c is DrawCall => c.type === "drawImage");
    expect(drawImageCalls.length).toBeGreaterThan(0);
    // Tiles cover the entire viewport: leftmost call x <= 0, rightmost
    // call x + w >= viewport.width.
    const leftmost = Math.min(...drawImageCalls.map((c) => c.x));
    const rightmost = Math.max(...drawImageCalls.map((c) => c.x + c.w));
    expect(leftmost).toBeLessThanOrEqual(0);
    expect(rightmost).toBeGreaterThanOrEqual(VIEWPORT.width);
  });

  it("paints the placeholder fill when the layer image is null", () => {
    const { ctx, calls } = makeSpy();
    const layer: ParallaxLayer = {
      id: "sky",
      image: null,
      scrollX: 0,
      bandHeight: 200,
      yAnchor: 0,
    };
    drawParallax(ctx, [layer], { x: 0, z: 0 }, VIEWPORT);
    expect(calls).toEqual([
      {
        type: "fillRect",
        fillStyle: PLACEHOLDER_FILL,
        x: 0,
        y: 0,
        w: VIEWPORT.width,
        h: 200,
      },
    ]);
  });

  it("anchors yAnchor=1 layers flush with the viewport bottom", () => {
    const { ctx, calls } = makeSpy();
    const layer: ParallaxLayer = {
      id: "hills",
      image: makeImage(512),
      scrollX: 0.6,
      bandHeight: 80,
      yAnchor: 1,
    };
    drawParallax(ctx, [layer], { x: 0, z: 0 }, VIEWPORT);
    const drawImageCalls = calls.filter((c): c is DrawCall => c.type === "drawImage");
    for (const call of drawImageCalls) {
      expect(call.y).toBe(VIEWPORT.height - 80);
      expect(call.h).toBe(80);
    }
  });

  it("skips drawing when the viewport has zero area", () => {
    const { ctx, calls } = makeSpy();
    drawParallax(ctx, defaultLayers(), { x: 0, z: 0 }, { width: 0, height: 600 });
    expect(calls).toEqual([]);
    drawParallax(ctx, defaultLayers(), { x: 0, z: 0 }, { width: 800, height: 0 });
    expect(calls).toEqual([]);
  });

  it("skips a layer with bandHeight <= 0 without crashing", () => {
    const { ctx, calls } = makeSpy();
    const layer: ParallaxLayer = {
      id: "sky",
      image: makeImage(512),
      scrollX: 0,
      bandHeight: 0,
      yAnchor: 0,
    };
    drawParallax(ctx, [layer], { x: 0, z: 0 }, VIEWPORT);
    expect(calls).toEqual([]);
  });

  it("first-difference variance across a 600-frame curve fixture stays bounded", () => {
    // Stress-test item 5: parallax derives only from camera.x. The road
    // already bakes curvature into the strip projector, so a curving
    // camera path produces a smooth offset sequence with no per-frame
    // jitter beyond the curvature itself.
    //
    // We feed the parallax math a synthetic camera path that walks
    // through a high-curve region (sinusoid in camera.x) and assert the
    // first-difference variance of the produced offsets is within 2 px.
    const layer: ParallaxLayer = {
      id: "mountains",
      image: makeImage(512),
      scrollX: 0.25,
      bandHeight: 120,
      yAnchor: 0.4,
    };
    const offsets: number[] = [];
    for (let i = 0; i < 600; i++) {
      // Half-meter step plus a 50 m amplitude curve oscillation, the
      // worst case the §9 lint rules permit. Frame-to-frame delta is
      // dominated by the linear forward motion; the oscillation adds
      // <= ~1 px of variance at scrollX 0.25.
      const camera: Camera = {
        x: 50 * Math.sin(i / 40),
        y: 0,
        z: i * 0.5,
        depth: 0.839,
      };
      offsets.push(parallaxOffsetFor(layer, camera));
    }
    const deltas: number[] = [];
    for (let i = 1; i < offsets.length; i++) {
      const a = offsets[i] as number;
      const b = offsets[i - 1] as number;
      deltas.push(a - b);
    }
    const mean = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    const variance =
      deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
    expect(variance).toBeLessThanOrEqual(2);
  });

  it("is deterministic: replaying a camera path produces identical draw arguments", () => {
    const layers = defaultLayers();
    const path: Camera[] = [];
    for (let i = 0; i < 30; i++) {
      path.push({ x: 10 * Math.sin(i / 5), y: 0, z: i * 0.5, depth: 0.839 });
    }
    const runOnce = (): Call[] => {
      const { ctx, calls } = makeSpy();
      for (const camera of path) {
        drawParallax(ctx, layers, camera, VIEWPORT);
      }
      return calls;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
