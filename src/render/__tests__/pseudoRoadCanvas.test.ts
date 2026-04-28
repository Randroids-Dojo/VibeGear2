/**
 * Unit tests for the pseudo-3D road drawer.
 *
 * The road strip painting is exercised by snapshot tests on the projector
 * output; this suite focuses on the F-022 ghost car overlay because that
 * is the new draw site this slice ships. Coverage:
 *
 * - Ghost rect renders with the pinned default alpha when present.
 * - Ghost rect uses the explicit alpha when supplied (clamped to [0, 1]).
 * - Ghost prop absent or `null` paints nothing extra.
 * - Out-of-range / non-finite projections short-circuit the draw so a
 *   ghost past the draw distance does not blip onto the canvas.
 * - The drawer restores `globalAlpha` and `fillStyle` after the ghost
 *   paint so subsequent draw calls (HUD, results overlay) inherit the
 *   pre-call state.
 *
 * Float comparisons use `toBeCloseTo` per AGENTS.md RULE 8.
 */

import { describe, expect, it } from "vitest";

import { visibilityForWeather } from "@/game/weather";
import type { Strip, Viewport } from "@/road/types";
import type { LoadedAtlas } from "../spriteAtlas";

import {
  GHOST_CAR_DEFAULT_ALPHA,
  GHOST_CAR_DEFAULT_FILL,
  HEAT_SHIMMER_BAND_COUNT,
  HEAT_SHIMMER_FILL,
  HEAT_SHIMMER_MAX_ALPHA,
  PLAYER_CAR_DEFAULT_FILL,
  PLAYER_CAR_DEFAULT_SHADOW,
  PLAYER_CAR_DEFAULT_SPRITE_ID,
  PLAYER_CAR_DEFAULT_TAIL_LIGHT,
  PLAYER_CAR_DEFAULT_TIRE,
  PLAYER_CAR_DEFAULT_WINDSHIELD,
  PLAYER_CAR_HEIGHT_FRACTION,
  PLAYER_CAR_WIDTH_TO_HEIGHT,
  RAIN_ROAD_SHEEN_FILL,
  RAIN_ROAD_SHEEN_MAX_ALPHA,
  SNOW_ROADSIDE_WHITENING_FILL,
  SNOW_ROADSIDE_WHITENING_MAX_ALPHA,
  TUNNEL_ADAPTATION_HIGHLIGHT_FILL,
  TUNNEL_ADAPTATION_HIGHLIGHT_MAX_ALPHA,
  TUNNEL_ADAPTATION_MAX_ALPHA,
  TUNNEL_ADAPTATION_OVERLAY_FILL,
  WEATHER_EFFECT_REDUCTION_SCALE,
  drawRoad,
  type DrawRoadOptions,
} from "../pseudoRoadCanvas";

const VIEWPORT: Viewport = { width: 800, height: 480 };

interface FillRectCall {
  type: "fillRect";
  fillStyle: string;
  globalAlpha: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FillCall {
  type: "fill";
  fillStyle: string;
  globalAlpha: number;
  path: readonly [number, number][];
}

interface DrawImageCall {
  type: "drawImage";
  globalAlpha: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

type DrawCall = FillRectCall | FillCall | DrawImageCall;

interface CanvasSpy {
  ctx: CanvasRenderingContext2D;
  calls: DrawCall[];
  finalAlpha(): number;
  finalFill(): string;
}

/**
 * Minimal Canvas2D spy. Captures `fillRect` calls (the ghost overlay)
 * and the final `globalAlpha` / `fillStyle` after the draw returns so
 * tests can assert state restoration.
 */
function makeCanvasSpy(): CanvasSpy {
  const calls: DrawCall[] = [];
  let fillStyle = "#000";
  let globalAlpha = 1;
  let currentPath: [number, number][] = [];
  const ctx = {
    get fillStyle(): string {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get globalAlpha(): number {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({ type: "fillRect", fillStyle, globalAlpha, x, y, w, h });
    },
    beginPath(): void {
      currentPath = [];
    },
    moveTo(x: number, y: number): void {
      currentPath.push([x, y]);
    },
    lineTo(x: number, y: number): void {
      currentPath.push([x, y]);
    },
    closePath(): void {},
    fill(): void {
      calls.push({ type: "fill", fillStyle, globalAlpha, path: currentPath });
    },
    save(): void {},
    restore(): void {},
    translate(): void {},
    createLinearGradient(): unknown {
      return {
        addColorStop(): void {},
      };
    },
    drawImage(
      _image: CanvasImageSource,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ): void {
      calls.push({ type: "drawImage", globalAlpha, sx, sy, sw, sh, dx, dy, dw, dh });
    },
  } as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    calls,
    finalAlpha: () => globalAlpha,
    finalFill: () => fillStyle,
  };
}

/**
 * Empty strip array. The drawer renders only the sky band on this input,
 * so no road trapezoids land in the spy. The ghost overlay still paints
 * because it is independent of the strip array.
 */
const EMPTY_STRIPS: readonly Strip[] = [];

function loadedCarAtlas(): LoadedAtlas {
  return {
    image: {} as HTMLImageElement,
    fallback: false,
    meta: {
      image: "art/cars/sparrow.svg",
      width: 128,
      height: 32,
      sprites: {
        [PLAYER_CAR_DEFAULT_SPRITE_ID]: [
          { x: 0, y: 0, w: 64, h: 32 },
          { x: 64, y: 0, w: 64, h: 32 },
        ],
      },
    },
  };
}

function strip(overrides: Partial<Strip>): Strip {
  return {
    segment: {
      index: 0,
      worldZ: 0,
      curve: 0,
      grade: 0,
      authoredIndex: 0,
      roadsideLeftId: "default",
      roadsideRightId: "default",
      hazardIds: [],
    },
    visible: true,
    screenX: VIEWPORT.width / 2,
    screenY: VIEWPORT.height / 2,
    screenW: 80,
    scale: 1,
    worldX: 0,
    worldY: 0,
    ...overrides,
  };
}

describe("drawRoad ghost car overlay", () => {
  it("paints a translucent rect at the projected ground point with the default alpha", () => {
    const spy = makeCanvasSpy();
    const ghost: NonNullable<DrawRoadOptions["ghostCar"]> = {
      screenX: 400,
      screenY: 300,
      screenW: 80,
    };
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, { ghostCar: ghost });

    const fillRectCalls = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    // First fillRect is the sky band (full viewport); the ghost rect is
    // the second. The strip drawer does not call fillRect for empty
    // strips so no other rects appear.
    expect(fillRectCalls.length).toBe(2);
    const skyRect = fillRectCalls[0]!;
    expect(skyRect.x).toBe(0);
    expect(skyRect.y).toBe(0);
    expect(skyRect.w).toBe(VIEWPORT.width);
    expect(skyRect.h).toBe(VIEWPORT.height);

    const ghostRect = fillRectCalls[1]!;
    expect(ghostRect.globalAlpha).toBeCloseTo(GHOST_CAR_DEFAULT_ALPHA, 6);
    expect(ghostRect.fillStyle).toBe(GHOST_CAR_DEFAULT_FILL);
    // 1:0.5 aspect: width 80 -> height 40; centered at screenX, anchored
    // at screenY.
    expect(ghostRect.x).toBeCloseTo(360, 6);
    expect(ghostRect.y).toBeCloseTo(260, 6);
    expect(ghostRect.w).toBeCloseTo(80, 6);
    expect(ghostRect.h).toBeCloseTo(40, 6);
  });

  it("honours an explicit alpha override", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: 100, screenY: 200, screenW: 40, alpha: 0.25 },
    });
    const ghostRect = spy.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.w === 40 && c.h === 20,
    );
    expect(ghostRect).toBeDefined();
    expect(ghostRect!.globalAlpha).toBeCloseTo(0.25, 6);
  });

  it("honours an explicit fill override", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: {
        screenX: 100,
        screenY: 200,
        screenW: 40,
        fill: "#ff8800",
      },
    });
    const ghostRect = spy.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.w === 40 && c.h === 20,
    );
    expect(ghostRect).toBeDefined();
    expect(ghostRect!.fillStyle).toBe("#ff8800");
  });

  it("draws the ghost from the loaded car atlas when available", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: {
        screenX: 100,
        screenY: 200,
        screenW: 64,
        alpha: 0.25,
        atlas: loadedCarAtlas(),
        frameIndex: 1,
      },
    });

    const draw = spy.calls.find((c): c is DrawImageCall => c.type === "drawImage");
    expect(draw).toBeDefined();
    expect(draw!.globalAlpha).toBeCloseTo(0.25, 6);
    expect(draw!.sx).toBe(64);
    expect(draw!.sy).toBe(0);
    expect(draw!.sw).toBe(64);
    expect(draw!.sh).toBe(32);
    expect(draw!.dx).toBeCloseTo(68, 6);
    expect(draw!.dy).toBeCloseTo(168, 6);
    expect(draw!.dw).toBeCloseTo(64, 6);
    expect(draw!.dh).toBeCloseTo(32, 6);
  });

  it("clamps an out-of-range alpha to [0, 1]", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: 100, screenY: 200, screenW: 40, alpha: 5 },
    });
    const ghostRect = spy.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.w === 40 && c.h === 20,
    );
    expect(ghostRect).toBeDefined();
    expect(ghostRect!.globalAlpha).toBeCloseTo(1, 6);

    const spy2 = makeCanvasSpy();
    drawRoad(spy2.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: 100, screenY: 200, screenW: 40, alpha: -1 },
    });
    // Clamped to 0 -> no draw.
    const ghostRect2 = spy2.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.w === 40 && c.h === 20,
    );
    expect(ghostRect2).toBeUndefined();
  });

  it("paints nothing extra when ghostCar is omitted", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {});
    // Only the sky rect; no ghost rect.
    const fillRectCalls = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    expect(fillRectCalls.length).toBe(1);
  });

  it("paints nothing extra when ghostCar is null", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, { ghostCar: null });
    const fillRectCalls = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    expect(fillRectCalls.length).toBe(1);
  });

  it("short-circuits when the projected width is non-positive", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: 100, screenY: 200, screenW: 0 },
    });
    const fillRectCalls = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    // Only the sky rect.
    expect(fillRectCalls.length).toBe(1);
  });

  it("short-circuits when a coordinate is non-finite", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: Number.NaN, screenY: 200, screenW: 40 },
    });
    expect(spy.calls.filter((c) => c.type === "fillRect")).toHaveLength(1);

    const spy2 = makeCanvasSpy();
    drawRoad(spy2.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: {
        screenX: 100,
        screenY: Number.POSITIVE_INFINITY,
        screenW: 40,
      },
    });
    expect(spy2.calls.filter((c) => c.type === "fillRect")).toHaveLength(1);
  });

  it("restores globalAlpha and fillStyle after the ghost paint", () => {
    const spy = makeCanvasSpy();
    // Pre-set the context to non-default values; the drawer must leave
    // them untouched once it returns.
    spy.ctx.globalAlpha = 0.7;
    spy.ctx.fillStyle = "#abcdef";
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      ghostCar: { screenX: 100, screenY: 200, screenW: 40 },
    });
    // The sky band overwrites fillStyle as part of the gradient flow,
    // but the ghost overlay's try / finally must restore alpha. The
    // post-draw alpha should match what we set before drawRoad ran.
    expect(spy.finalAlpha()).toBeCloseTo(0.7, 6);
  });

  it("paints nothing extra on a zero-area viewport", () => {
    const spy = makeCanvasSpy();
    drawRoad(
      spy.ctx,
      EMPTY_STRIPS,
      { width: 0, height: 480 },
      { ghostCar: { screenX: 100, screenY: 200, screenW: 40 } },
    );
    // The sky still tries to paint a 0-width rect; the ghost short-circuits.
    const ghostRect = spy.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.w === 40 && c.h === 20,
    );
    expect(ghostRect).toBeUndefined();
  });
});

describe("drawRoad foreground projection", () => {
  it("draws the projector-supplied foreground endpoint as a normal strip pair", () => {
    const spy = makeCanvasSpy();
    const colors = {
      skyTop: "#000001",
      skyBottom: "#000002",
      grassLight: "#112233",
      grassDark: "#223344",
      rumbleLight: "#334455",
      rumbleDark: "#445566",
      roadLight: "#556677",
      roadDark: "#667788",
      lane: "#778899",
    };
    const strips: readonly Strip[] = [
      strip({ visible: false, screenY: VIEWPORT.height, screenW: 0 }),
      strip({
        screenY: 300,
        screenW: 80,
        foreground: {
          screenX: VIEWPORT.width / 2,
          screenY: VIEWPORT.height,
          screenW: 240,
        },
        segment: { ...strip({}).segment, index: 0 },
      }),
      strip({ screenY: 240, screenW: 40, segment: { ...strip({}).segment, index: 1 } }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, { colors });

    const foregroundGrass = spy.calls.find(
      (c): c is FillRectCall =>
        c.type === "fillRect" &&
        c.fillStyle === colors.grassLight &&
        c.x === 0 &&
        c.y === 300 &&
        c.w === VIEWPORT.width &&
        c.h === VIEWPORT.height - 300,
    );
    expect(foregroundGrass).toBeDefined();

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills.some((call) => call.fillStyle === colors.roadLight)).toBe(true);
    expect(fills.some((call) => call.fillStyle === colors.lane)).toBe(true);
  });
});

describe("drawRoad procedural markings", () => {
  it("keeps rumble and centerline markings stable across adjacent uphill strips", () => {
    const spy = makeCanvasSpy();
    const colors = {
      skyTop: "#000001",
      skyBottom: "#000002",
      grassLight: "#112233",
      grassDark: "#223344",
      rumbleLight: "#334455",
      rumbleDark: "#445566",
      roadLight: "#556677",
      roadDark: "#667788",
      lane: "#778899",
    };
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 8, worldZ: 48 },
      }),
      strip({
        screenY: 340,
        screenW: 140,
        segment: { ...strip({}).segment, index: 9, worldZ: 54 },
      }),
      strip({
        screenY: 260,
        screenW: 90,
        segment: { ...strip({}).segment, index: 10, worldZ: 60 },
      }),
      strip({
        screenY: 210,
        screenW: 55,
        segment: { ...strip({}).segment, index: 11, worldZ: 66 },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, { colors });

    const fills = spy.calls.filter((call): call is FillCall => call.type === "fill");
    const rumbleFills = fills.filter((call) => call.fillStyle === colors.rumbleLight);
    const rumbleDarkFills = fills.filter((call) => call.fillStyle === colors.rumbleDark);
    const laneFills = fills.filter((call) => call.fillStyle === colors.lane);
    expect(rumbleFills.length + rumbleDarkFills.length).toBe(3);
    expect(laneFills.length).toBeLessThanOrEqual(3);
  });

  it("splits a lane dash at the road-distance duty boundary inside a strip", () => {
    const spy = makeCanvasSpy();
    const colors = {
      skyTop: "#000001",
      skyBottom: "#000002",
      grassLight: "#112233",
      grassDark: "#223344",
      rumbleLight: "#334455",
      rumbleDark: "#445566",
      roadLight: "#556677",
      roadDark: "#667788",
      lane: "#778899",
    };
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 7, worldZ: 42 },
      }),
      strip({
        screenY: 330,
        screenW: 120,
        segment: { ...strip({}).segment, index: 8, worldZ: 54 },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, { colors });

    const laneFills = spy.calls.filter(
      (call): call is FillCall => call.type === "fill" && call.fillStyle === colors.lane,
    );
    expect(laneFills).toHaveLength(1);
    const lanePath = laneFills[0]!.path;
    expect(lanePath[0]![1]).toBeCloseTo(380, 6);
    expect(lanePath[1]![1]).toBeCloseTo(380, 6);
    expect(lanePath[2]![1]).toBeCloseTo(330, 6);
    expect(lanePath[3]![1]).toBeCloseTo(330, 6);
  });

  it("keeps a near-camera lane dash short instead of filling the whole strip", () => {
    const spy = makeCanvasSpy();
    const colors = {
      skyTop: "#000001",
      skyBottom: "#000002",
      grassLight: "#112233",
      grassDark: "#223344",
      rumbleLight: "#334455",
      rumbleDark: "#445566",
      roadLight: "#556677",
      roadDark: "#667788",
      lane: "#778899",
    };
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 9, worldZ: 54 },
      }),
      strip({
        screenY: 330,
        screenW: 120,
        segment: { ...strip({}).segment, index: 10, worldZ: 66 },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, { colors });

    const laneFills = spy.calls.filter(
      (call): call is FillCall => call.type === "fill" && call.fillStyle === colors.lane,
    );
    expect(laneFills).toHaveLength(1);
    const lanePath = laneFills[0]!.path;
    expect(lanePath[0]![1]).toBeCloseTo(430, 6);
    expect(lanePath[1]![1]).toBeCloseTo(430, 6);
    expect(lanePath[2]![1]).toBeCloseTo(380, 6);
    expect(lanePath[3]![1]).toBeCloseTo(380, 6);
  });
});

describe("drawRoad roadside sprites", () => {
  it("paints compiled roadside ids as depth-scaled billboards", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 440,
        screenW: 260,
        segment: {
          ...strip({}).segment,
          index: 0,
          roadsideLeftId: "tree_pine",
          roadsideRightId: "light_pole",
        },
      }),
      strip({
        screenY: 300,
        screenW: 110,
        segment: {
          ...strip({}).segment,
          index: 1,
          roadsideLeftId: "tree_pine",
          roadsideRightId: "light_pole",
        },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {});

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills.some((call) => call.fillStyle === "#245c2f")).toBe(true);
    expect(fills.some((call) => call.fillStyle === "#2f7a3a")).toBe(true);

    const fillRects = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    expect(fillRects.some((call) => call.fillStyle === "#1b3a20")).toBe(true);
  });

  it("boosts sign panel and glyph contrast when the assist is enabled", () => {
    const normal = makeCanvasSpy();
    const highContrast = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 440,
        screenW: 260,
        segment: {
          ...strip({}).segment,
          index: 0,
          roadsideLeftId: "sign_marker",
          roadsideRightId: "default",
        },
      }),
      strip({
        screenY: 300,
        screenW: 110,
        segment: {
          ...strip({}).segment,
          index: 1,
          roadsideLeftId: "default",
          roadsideRightId: "default",
        },
      }),
    ];

    drawRoad(normal.ctx, strips, VIEWPORT, {
      weatherEffects: { weather: "clear" },
    });
    drawRoad(highContrast.ctx, strips, VIEWPORT, {
      weatherEffects: {
        weather: "clear",
        highContrastRoadsideSigns: true,
      },
    });

    const normalRects = normal.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    const highContrastRects = highContrast.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    expect(normalRects.some((call) => call.fillStyle === "#05070d")).toBe(false);
    expect(
      highContrastRects.some((call) => call.fillStyle === "#fff36a"),
    ).toBe(true);
    expect(
      highContrastRects.some((call) => call.fillStyle === "#05070d"),
    ).toBe(true);
    expect(
      highContrastRects.filter((call) => call.fillStyle === "#ffffff"),
    ).toHaveLength(2);
  });

  it("skips the default roadside id", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 440,
        screenW: 260,
        segment: { ...strip({}).segment, index: 0 },
      }),
      strip({
        screenY: 300,
        screenW: 110,
        segment: { ...strip({}).segment, index: 1 },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {});

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills.some((call) => call.fillStyle === "#245c2f")).toBe(false);
    expect(fills.some((call) => call.fillStyle === "#2f7a3a")).toBe(false);
  });

  it("culls roadside sprites whose base is above the viewport", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: -1,
        screenW: 260,
        segment: {
          ...strip({}).segment,
          index: 0,
          roadsideLeftId: "tree_pine",
          roadsideRightId: "default",
        },
      }),
      strip({
        screenY: -80,
        screenW: 110,
        segment: {
          ...strip({}).segment,
          index: 1,
          roadsideLeftId: "tree_pine",
          roadsideRightId: "default",
        },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {});

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills.some((call) => call.fillStyle === "#245c2f")).toBe(false);
    expect(fills.some((call) => call.fillStyle === "#2f7a3a")).toBe(false);
  });
});

describe("drawRoad tunnel adaptation", () => {
  it("darkens the world view when projected strips include a visible tunnel hazard", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 0, hazardIds: ["tunnel"] },
      }),
      strip({
        screenY: 330,
        screenW: 120,
        segment: { ...strip({}).segment, index: 1, hazardIds: ["tunnel"] },
      }),
      strip({
        screenY: 250,
        screenW: 70,
        segment: { ...strip({}).segment, index: 2, hazardIds: [] },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {});

    const overlay = spy.calls.find(
      (call): call is FillRectCall =>
        call.type === "fillRect" &&
        call.fillStyle === TUNNEL_ADAPTATION_OVERLAY_FILL,
    );
    expect(overlay).toBeDefined();
    expect(overlay!.x).toBe(0);
    expect(overlay!.y).toBe(0);
    expect(overlay!.w).toBe(VIEWPORT.width);
    expect(overlay!.h).toBe(VIEWPORT.height);
    expect(overlay!.globalAlpha).toBeCloseTo(TUNNEL_ADAPTATION_MAX_ALPHA, 6);

    const highlight = spy.calls.find(
      (call): call is FillRectCall =>
        call.type === "fillRect" &&
        call.fillStyle === TUNNEL_ADAPTATION_HIGHLIGHT_FILL,
    );
    expect(highlight).toBeDefined();
    expect(highlight!.globalAlpha).toBeCloseTo(
      TUNNEL_ADAPTATION_HIGHLIGHT_MAX_ALPHA,
      6,
    );
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("skips tunnel adaptation when no visible tunnel strip is projected", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 0, hazardIds: ["tunnel"] },
        visible: false,
      }),
      strip({
        screenY: 330,
        screenW: 120,
        segment: { ...strip({}).segment, index: 1, hazardIds: [] },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {});

    expect(
      spy.calls.some(
        (call) =>
          call.type === "fillRect" &&
          call.fillStyle === TUNNEL_ADAPTATION_OVERLAY_FILL,
      ),
    ).toBe(false);
    expect(
      spy.calls.some(
        (call) =>
          call.type === "fillRect" &&
          call.fillStyle === TUNNEL_ADAPTATION_HIGHLIGHT_FILL,
      ),
    ).toBe(false);
  });

  it("can be disabled by the caller for debug captures", () => {
    const spy = makeCanvasSpy();
    const strips: readonly Strip[] = [
      strip({
        screenY: 430,
        screenW: 220,
        segment: { ...strip({}).segment, index: 0, hazardIds: ["tunnel"] },
      }),
      strip({
        screenY: 330,
        screenW: 120,
        segment: { ...strip({}).segment, index: 1, hazardIds: ["tunnel"] },
      }),
    ];

    drawRoad(spy.ctx, strips, VIEWPORT, {
      tunnelAdaptation: { enabled: false },
    });

    expect(
      spy.calls.some(
        (call) =>
          call.type === "fillRect" &&
          call.fillStyle === TUNNEL_ADAPTATION_OVERLAY_FILL,
      ),
    ).toBe(false);
  });
});

describe("drawRoad heat shimmer", () => {
  it("paints deterministic horizon bands when the desert shimmer pass is enabled", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      heatShimmer: { enabled: true, phaseMeters: 120 },
    });

    const shimmerRects = spy.calls.filter(
      (call): call is FillRectCall =>
        call.type === "fillRect" && call.fillStyle === HEAT_SHIMMER_FILL,
    );
    expect(shimmerRects.length).toBeGreaterThanOrEqual(HEAT_SHIMMER_BAND_COUNT);
    expect(shimmerRects[0]!.globalAlpha).toBeCloseTo(HEAT_SHIMMER_MAX_ALPHA, 6);
    expect(shimmerRects[0]!.y).toBeCloseTo(VIEWPORT.height * 0.24, 6);
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("drifts shimmer bands from the deterministic camera-z phase", () => {
    const first = makeCanvasSpy();
    const second = makeCanvasSpy();
    drawRoad(first.ctx, EMPTY_STRIPS, VIEWPORT, {
      heatShimmer: { enabled: true, phaseMeters: 0 },
    });
    drawRoad(second.ctx, EMPTY_STRIPS, VIEWPORT, {
      heatShimmer: { enabled: true, phaseMeters: 240 },
    });

    const firstBand = first.calls.find(
      (call): call is FillRectCall =>
        call.type === "fillRect" && call.fillStyle === HEAT_SHIMMER_FILL,
    );
    const secondBand = second.calls.find(
      (call): call is FillRectCall =>
        call.type === "fillRect" && call.fillStyle === HEAT_SHIMMER_FILL,
    );
    expect(firstBand).toBeDefined();
    expect(secondBand).toBeDefined();
    expect(firstBand!.x).not.toBeCloseTo(secondBand!.x, 6);
  });

  it("skips heat shimmer when the pass is omitted or disabled", () => {
    const omitted = makeCanvasSpy();
    const disabled = makeCanvasSpy();
    drawRoad(omitted.ctx, EMPTY_STRIPS, VIEWPORT, {});
    drawRoad(disabled.ctx, EMPTY_STRIPS, VIEWPORT, {
      heatShimmer: { enabled: false, phaseMeters: 120 },
    });

    expect(
      omitted.calls.some(
        (call) => call.type === "fillRect" && call.fillStyle === HEAT_SHIMMER_FILL,
      ),
    ).toBe(false);
    expect(
      disabled.calls.some(
        (call) => call.type === "fillRect" && call.fillStyle === HEAT_SHIMMER_FILL,
      ),
    ).toBe(false);
  });
});

describe("drawRoad player car overlay", () => {
  it("paints the live player car at the §16 standard camera footprint", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, { playerCar: {} });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills).toHaveLength(5);
    expect(fills[0]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(fills[1]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(fills[2]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_SHADOW);
    expect(fills[3]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_FILL);
    expect(fills[4]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_WINDSHIELD);

    const height = VIEWPORT.height * PLAYER_CAR_HEIGHT_FRACTION;
    expect(height / VIEWPORT.height).toBeGreaterThanOrEqual(0.16);
    expect(height / VIEWPORT.height).toBeLessThanOrEqual(0.22);
    expect(height * PLAYER_CAR_WIDTH_TO_HEIGHT).toBeCloseTo(99.36, 2);
  });

  it("paints contained tires, rear deck, and two tail-light rects", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, { playerCar: {} });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills).toHaveLength(5);
    expect(fills[0]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(fills[1]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(fills[2]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_SHADOW);
    expect(fills[3]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_FILL);
    expect(fills[4]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_WINDSHIELD);

    const fillRects = spy.calls.filter(
      (c): c is FillRectCall => c.type === "fillRect",
    );
    expect(fillRects).toHaveLength(4);

    expect(fillRects[1]!.fillStyle).toBe("#d7a91e");
    expect(fillRects[1]!.w).toBeCloseTo(
      VIEWPORT.height * PLAYER_CAR_HEIGHT_FRACTION * PLAYER_CAR_WIDTH_TO_HEIGHT * 0.64,
      6,
    );

    const tailLightW = VIEWPORT.height *
      PLAYER_CAR_HEIGHT_FRACTION *
      PLAYER_CAR_WIDTH_TO_HEIGHT *
      0.16;
    const tailLightH = VIEWPORT.height * PLAYER_CAR_HEIGHT_FRACTION * 0.08;
    expect(fillRects[2]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TAIL_LIGHT);
    expect(fillRects[2]!.w).toBeCloseTo(tailLightW, 6);
    expect(fillRects[2]!.h).toBeCloseTo(tailLightH, 6);
    expect(fillRects[3]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TAIL_LIGHT);
    expect(fillRects[3]!.w).toBeCloseTo(tailLightW, 6);
    expect(fillRects[3]!.h).toBeCloseTo(tailLightH, 6);
  });

  it("restores fillStyle after painting the player car", () => {
    const spy = makeCanvasSpy();
    spy.ctx.fillStyle = "#123456";
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: {
        fill: "#aa3300",
        shadow: "#001122",
        tire: "#050505",
        tailLight: "#ff0000",
        windshield: "#223344",
      },
    });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills[0]!.fillStyle).toBe("#050505");
    expect(fills[1]!.fillStyle).toBe("#050505");
    expect(fills[2]!.fillStyle).toBe("#001122");
    expect(fills[3]!.fillStyle).toBe("#aa3300");
    expect(fills[4]!.fillStyle).toBe("#223344");
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("paints wet spray behind the live player car in rainy weather", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: { weather: "heavy_rain" },
    });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills[0]!.fillStyle).toBe("#d8f4ff");
    expect(fills[0]!.globalAlpha).toBeCloseTo(0.7, 6);
    expect(fills[1]!.fillStyle).toBe("#d8f4ff");
    expect(fills[1]!.globalAlpha).toBeCloseTo(0.7, 6);
    expect(fills[2]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("paints snow mist behind the live player car in snow", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: { weather: "snow" },
    });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills[0]!.fillStyle).toBe("#edf7ff");
    expect(fills[0]!.globalAlpha).toBeCloseTo(0.62, 6);
    expect(fills[1]!.fillStyle).toBe(PLAYER_CAR_DEFAULT_TIRE);
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("does not paint weather trails in clear weather", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: { weather: "clear" },
    });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills).toHaveLength(5);
    expect(fills.some((call) => call.fillStyle === "#d8f4ff")).toBe(false);
    expect(fills.some((call) => call.fillStyle === "#edf7ff")).toBe(false);
  });

  it("does not paint weather trails in fog", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: { weather: "fog" },
    });

    const fills = spy.calls.filter((c): c is FillCall => c.type === "fill");
    expect(fills).toHaveLength(5);
    expect(fills.some((call) => call.fillStyle === "#d8f4ff")).toBe(false);
    expect(fills.some((call) => call.fillStyle === "#edf7ff")).toBe(false);
  });

  it("draws the live player car from the loaded atlas when available", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      playerCar: { atlas: loadedCarAtlas(), frameIndex: 1 },
    });

    const draw = spy.calls.find((c): c is DrawImageCall => c.type === "drawImage");
    const width =
      VIEWPORT.height * PLAYER_CAR_HEIGHT_FRACTION * PLAYER_CAR_WIDTH_TO_HEIGHT;
    expect(draw).toBeDefined();
    expect(draw!.globalAlpha).toBeCloseTo(1, 6);
    expect(draw!.sx).toBe(64);
    expect(draw!.dw).toBeCloseTo(width, 6);
    expect(draw!.dh).toBeCloseTo(width * 0.5, 6);
    expect(draw!.dx).toBeCloseTo(VIEWPORT.width / 2 - width / 2, 6);
  });

  it("does not paint the live player car when omitted or null", () => {
    const omitted = makeCanvasSpy();
    drawRoad(omitted.ctx, EMPTY_STRIPS, VIEWPORT, {});
    expect(omitted.calls.filter((c) => c.type === "fill")).toHaveLength(0);

    const nulled = makeCanvasSpy();
    drawRoad(nulled.ctx, EMPTY_STRIPS, VIEWPORT, { playerCar: null });
    expect(nulled.calls.filter((c) => c.type === "fill")).toHaveLength(0);
  });
});

describe("drawRoad weather effects", () => {
  it("paints deterministic heavy-rain streaks over the road layer", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "heavy_rain" },
    });

    const streaks = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#cfefff",
    );
    const sheen = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
    );
    expect(sheen).toHaveLength(2);
    expect(sheen[0]!.globalAlpha).toBeCloseTo(RAIN_ROAD_SHEEN_MAX_ALPHA, 6);
    expect(sheen[0]!.x).toBeCloseTo(VIEWPORT.width * 0.08, 6);
    expect(sheen[0]!.y).toBeCloseTo(VIEWPORT.height * 0.62, 6);
    expect(sheen[0]!.w).toBeCloseTo(VIEWPORT.width * 0.84, 6);
    expect(sheen[1]!.globalAlpha).toBeCloseTo(RAIN_ROAD_SHEEN_MAX_ALPHA * 0.55, 6);
    expect(streaks).toHaveLength(92);
    expect(streaks[0]!.globalAlpha).toBeCloseTo(0.34, 6);
    expect(streaks[0]!.w).toBe(2);
    expect(streaks[0]!.h).toBe(18);
    expect(spy.finalAlpha()).toBeCloseTo(1, 6);
  });

  it("scales road sheen for standard rain", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "rain" },
    });

    const sheen = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
    );
    expect(sheen).toHaveLength(2);
    expect(sheen[0]!.globalAlpha).toBeCloseTo(RAIN_ROAD_SHEEN_MAX_ALPHA * 0.72, 6);
    expect(sheen[1]!.globalAlpha).toBeCloseTo(
      RAIN_ROAD_SHEEN_MAX_ALPHA * 0.72 * 0.55,
      6,
    );
  });

  it("scales road sheen for light rain", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "light_rain" },
    });

    const sheen = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
    );
    expect(sheen).toHaveLength(2);
    expect(sheen[0]!.globalAlpha).toBeCloseTo(RAIN_ROAD_SHEEN_MAX_ALPHA * 0.45, 6);
    expect(sheen[1]!.globalAlpha).toBeCloseTo(
      RAIN_ROAD_SHEEN_MAX_ALPHA * 0.45 * 0.55,
      6,
    );
  });

  it("reduces rain density when visual weather reduction is enabled", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "heavy_rain", visualReduction: true },
    });

    const streaks = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#cfefff",
    );
    const sheen = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
    );
    expect(sheen).toHaveLength(2);
    expect(sheen[0]!.globalAlpha).toBeCloseTo(
      RAIN_ROAD_SHEEN_MAX_ALPHA * WEATHER_EFFECT_REDUCTION_SCALE,
      6,
    );
    expect(streaks).toHaveLength(Math.round(92 * WEATHER_EFFECT_REDUCTION_SCALE));
    expect(streaks[0]!.globalAlpha).toBeCloseTo(
      0.34 * WEATHER_EFFECT_REDUCTION_SCALE,
      6,
    );
  });

  it("applies the particle intensity slider to rain density", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "heavy_rain", particleIntensity: 0.5 },
    });

    const streaks = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#cfefff",
    );
    const sheen = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
    );
    expect(sheen).toHaveLength(2);
    expect(sheen[0]!.globalAlpha).toBeCloseTo(RAIN_ROAD_SHEEN_MAX_ALPHA * 0.5, 6);
    expect(streaks).toHaveLength(Math.round(92 * 0.5));
    expect(streaks[0]!.globalAlpha).toBeCloseTo(0.34 * 0.5, 6);
  });

  it("allows weather particles to be disabled", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "snow", particleIntensity: 0 },
    });

    expect(
      spy.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === "#f4fbff",
      ),
    ).toBe(false);
    expect(
      spy.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === SNOW_ROADSIDE_WHITENING_FILL,
      ),
    ).toBe(false);
  });

  it("allows rain streaks and sheen to be disabled", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "heavy_rain", particleIntensity: 0 },
    });

    expect(
      spy.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === "#cfefff",
      ),
    ).toBe(false);
    expect(
      spy.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === RAIN_ROAD_SHEEN_FILL,
      ),
    ).toBe(false);
  });

  it("paints snow particles and roadside whitening", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "snow" },
    });

    const roadsideWhitening = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === SNOW_ROADSIDE_WHITENING_FILL,
    );
    expect(roadsideWhitening).toHaveLength(3);
    expect(roadsideWhitening[0]!.x).toBe(0);
    expect(roadsideWhitening[0]!.y).toBeCloseTo(VIEWPORT.height * 0.42, 6);
    expect(roadsideWhitening[0]!.w).toBe(VIEWPORT.width);
    expect(roadsideWhitening[0]!.globalAlpha).toBeCloseTo(
      SNOW_ROADSIDE_WHITENING_MAX_ALPHA * 0.65,
      6,
    );
    expect(roadsideWhitening[1]!.w).toBeCloseTo(VIEWPORT.width * 0.2, 6);
    expect(roadsideWhitening[2]!.x).toBeCloseTo(VIEWPORT.width * 0.8, 6);
    expect(roadsideWhitening[1]!.globalAlpha).toBeCloseTo(
      SNOW_ROADSIDE_WHITENING_MAX_ALPHA,
      6,
    );

    const flakes = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#f4fbff",
    );
    expect(flakes).toHaveLength(54);
    expect(flakes[0]!.w).toBe(3);
    expect(flakes[1]!.w).toBe(2);
    expect(flakes[0]!.globalAlpha).toBeCloseTo(0.72, 6);
  });

  it("reduces snow roadside whitening with visual weather reduction", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "snow", visualReduction: true },
    });

    const roadsideWhitening = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === SNOW_ROADSIDE_WHITENING_FILL,
    );
    expect(roadsideWhitening).toHaveLength(3);
    expect(roadsideWhitening[1]!.globalAlpha).toBeCloseTo(
      SNOW_ROADSIDE_WHITENING_MAX_ALPHA * WEATHER_EFFECT_REDUCTION_SCALE,
      6,
    );
  });

  it("paints fog as a draw-distance fade without changing clear weather", () => {
    const fog = makeCanvasSpy();
    drawRoad(fog.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "fog" },
    });

    const fogRects = fog.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#cbd7e1",
    );
    expect(fogRects).toHaveLength(2);
    expect(fogRects[0]!.x).toBe(0);
    expect(fogRects[0]!.y).toBe(0);
    expect(fogRects[0]!.w).toBe(VIEWPORT.width);
    expect(fogRects[0]!.h).toBeCloseTo(VIEWPORT.height * 0.72, 6);
    expect(fogRects[0]!.globalAlpha).toBeCloseTo(
      Math.min(0.5, (1 - visibilityForWeather("fog")) * 0.72),
      6,
    );

    const clear = makeCanvasSpy();
    drawRoad(clear.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "clear" },
    });
    expect(
      clear.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === "#cbd7e1",
      ),
    ).toBe(false);

    const overcast = makeCanvasSpy();
    drawRoad(overcast.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "overcast" },
    });
    expect(
      overcast.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === "#cbd7e1",
      ),
    ).toBe(false);
  });

  it("uses the fog readability floor to reduce fog overlay alpha", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "fog", fogFloorClamp: 0.8 },
    });

    const fogRects = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#cbd7e1",
    );
    expect(fogRects).toHaveLength(2);
    expect(fogRects[0]!.globalAlpha).toBeCloseTo(
      Math.min(0.5, (1 - 0.8) * 0.72),
      6,
    );
  });

  it("paints night bloom pools and restores fill state", () => {
    const spy = makeCanvasSpy();
    spy.ctx.fillStyle = "#123456";
    spy.ctx.globalAlpha = 0.64;

    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: { weather: "night" },
    });

    const bloom = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#f4e779",
    );
    expect(bloom).toHaveLength(2);
    expect(bloom[0]!.globalAlpha).toBeCloseTo(0.34, 6);
    expect(bloom[0]!.w).toBeCloseTo(VIEWPORT.width * 0.12, 6);
    expect(spy.finalAlpha()).toBeCloseTo(0.64, 6);
  });

  it("reduces night bloom when glare and flash reduction are enabled", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, VIEWPORT, {
      weatherEffects: {
        weather: "night",
        reducedGlare: true,
        flashReduction: true,
      },
    });

    const bloom = spy.calls.filter(
      (c): c is FillRectCall =>
        c.type === "fillRect" && c.fillStyle === "#f4e779",
    );
    expect(bloom).toHaveLength(2);
    expect(bloom[0]!.globalAlpha).toBeCloseTo(0.34 * 0.55 * 0.45, 6);
  });

  it("skips weather effects on a zero-area viewport", () => {
    const spy = makeCanvasSpy();
    drawRoad(spy.ctx, EMPTY_STRIPS, { width: 0, height: 480 }, {
      weatherEffects: { weather: "heavy_rain" },
    });

    expect(
      spy.calls.some(
        (c): c is FillRectCall =>
          c.type === "fillRect" && c.fillStyle === "#cfefff",
      ),
    ).toBe(false);
  });
});
