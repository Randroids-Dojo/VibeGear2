/**
 * Mock-canvas drawcall tests for the minimap HUD overlay.
 *
 * Covers:
 * - One stroke path drawcall for the track polyline.
 * - One filled circle drawcall per car (AI first, player last).
 * - Player car uses a different fill than AI cars.
 * - Colour-blind mode swaps the player marker for a square.
 * - Empty point lists / zero-area boxes paint nothing.
 * - Context state (fillStyle, strokeStyle, lineWidth) is restored.
 */

import { describe, expect, it } from "vitest";

import type { MinimapPoint } from "@/road/minimap";

import { drawMinimap, type MinimapCar } from "../hudMinimap";

type Call =
  | { type: "fillRect"; fillStyle: string; x: number; y: number; w: number; h: number }
  | { type: "beginPath" }
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "closePath" }
  | { type: "stroke"; strokeStyle: string; lineWidth: number }
  | {
      type: "arc";
      x: number;
      y: number;
      r: number;
      start: number;
      end: number;
    }
  | { type: "fill"; fillStyle: string };

interface Spy {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
}

function makeSpy(): Spy {
  const calls: Call[] = [];
  let fillStyle: string = "";
  let strokeStyle: string = "";
  let lineWidth = 0;
  const ctx = {
    get fillStyle(): string {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get strokeStyle(): string {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
    },
    get lineWidth(): number {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({ type: "fillRect", fillStyle, x, y, w, h });
    },
    beginPath(): void {
      calls.push({ type: "beginPath" });
    },
    moveTo(x: number, y: number): void {
      calls.push({ type: "moveTo", x, y });
    },
    lineTo(x: number, y: number): void {
      calls.push({ type: "lineTo", x, y });
    },
    closePath(): void {
      calls.push({ type: "closePath" });
    },
    stroke(): void {
      calls.push({ type: "stroke", strokeStyle, lineWidth });
    },
    arc(x: number, y: number, r: number, start: number, end: number): void {
      calls.push({ type: "arc", x, y, r, start, end });
    },
    fill(): void {
      calls.push({ type: "fill", fillStyle });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const POINTS: MinimapPoint[] = [
  { x: 10, y: 10, segmentIndex: 0 },
  { x: 30, y: 10, segmentIndex: 1 },
  { x: 30, y: 30, segmentIndex: 2 },
  { x: 10, y: 30, segmentIndex: 3 },
];

const BOX = { x: 0, y: 0, w: 100, h: 100 };

describe("drawMinimap", () => {
  it("emits a single stroke path with one moveTo and N-1 lineTo calls", () => {
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, [], { box: BOX });
    const moves = calls.filter((c) => c.type === "moveTo");
    const lines = calls.filter((c) => c.type === "lineTo");
    const strokes = calls.filter((c) => c.type === "stroke");
    expect(moves.length).toBe(1);
    expect(lines.length).toBe(POINTS.length - 1);
    expect(strokes.length).toBe(1);
  });

  it("emits one filled circle per car when colour-blind mode is off", () => {
    const cars: MinimapCar[] = [
      { x: 15, y: 15, isPlayer: false },
      { x: 25, y: 15, isPlayer: true },
      { x: 25, y: 25, isPlayer: false },
    ];
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, cars, { box: BOX });
    const arcs = calls.filter((c) => c.type === "arc");
    const fills = calls.filter((c) => c.type === "fill");
    expect(arcs.length).toBe(cars.length);
    expect(fills.length).toBe(cars.length);
  });

  it("paints AI markers before the player so the player draws on top", () => {
    const cars: MinimapCar[] = [
      { x: 15, y: 15, isPlayer: true },
      { x: 25, y: 15, isPlayer: false },
      { x: 25, y: 25, isPlayer: false },
    ];
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, cars, { box: BOX });
    // Walk the fill drawcalls in emission order. The first two should be
    // AI fills; the last one should be the player fill.
    const fills = calls.filter((c): c is { type: "fill"; fillStyle: string } =>
      c.type === "fill",
    );
    expect(fills.length).toBe(3);
    // Player and AI fills must be different colours.
    expect(fills[0]!.fillStyle).not.toBe(fills[2]!.fillStyle);
    expect(fills[0]!.fillStyle).toBe(fills[1]!.fillStyle);
  });

  it("uses a square (fillRect) for the player when colour-blind mode is on", () => {
    const cars: MinimapCar[] = [
      { x: 25, y: 15, isPlayer: false },
      { x: 15, y: 15, isPlayer: true },
    ];
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, cars, { box: BOX }, { colorBlindMode: true });
    // AI uses arc + fill. Player uses fillRect.
    const arcs = calls.filter((c) => c.type === "arc");
    expect(arcs.length).toBe(1);
    // Two fillRects: one for the background, one for the player marker.
    const rectCalls = calls.filter(
      (c): c is { type: "fillRect"; fillStyle: string; x: number; y: number; w: number; h: number } =>
        c.type === "fillRect",
    );
    expect(rectCalls.length).toBe(2);
    // The player fillRect is centred on the marker position with side 2 * radius.
    const playerRect = rectCalls[1]!;
    expect(playerRect.x).toBe(15 - 3);
    expect(playerRect.y).toBe(15 - 3);
    expect(playerRect.w).toBe(6);
    expect(playerRect.h).toBe(6);
  });

  it("paints a background fillRect over the layout box", () => {
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, [], { box: BOX });
    const rectCalls = calls.filter((c) => c.type === "fillRect");
    expect(rectCalls.length).toBe(1);
    expect(rectCalls[0]).toMatchObject({
      x: BOX.x,
      y: BOX.y,
      w: BOX.w,
      h: BOX.h,
    });
  });

  it("draws nothing when the box has zero area", () => {
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, POINTS, [{ x: 10, y: 10, isPlayer: true }], {
      box: { x: 0, y: 0, w: 0, h: 100 },
    });
    expect(calls).toEqual([]);
  });

  it("draws nothing when both points and cars are empty", () => {
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, [], [], { box: BOX });
    expect(calls).toEqual([]);
  });

  it("skips the polyline when only a single point is provided", () => {
    const { ctx, calls } = makeSpy();
    drawMinimap(ctx, [{ x: 50, y: 50, segmentIndex: 0 }], [], {
      box: BOX,
    });
    const moves = calls.filter((c) => c.type === "moveTo");
    const strokes = calls.filter((c) => c.type === "stroke");
    expect(moves.length).toBe(0);
    expect(strokes.length).toBe(0);
  });

  it("restores fillStyle, strokeStyle, and lineWidth before returning", () => {
    const { ctx } = makeSpy();
    ctx.fillStyle = "#abcdef";
    ctx.strokeStyle = "#fedcba";
    ctx.lineWidth = 7;
    drawMinimap(ctx, POINTS, [{ x: 10, y: 10, isPlayer: true }], {
      box: BOX,
    });
    expect(ctx.fillStyle).toBe("#abcdef");
    expect(ctx.strokeStyle).toBe("#fedcba");
    expect(ctx.lineWidth).toBe(7);
  });

  it("is deterministic: replay produces the same drawcall sequence", () => {
    const cars: MinimapCar[] = [
      { x: 15, y: 15, isPlayer: false },
      { x: 25, y: 25, isPlayer: true },
    ];
    const runOnce = (): Call[] => {
      const { ctx, calls } = makeSpy();
      drawMinimap(ctx, POINTS, cars, { box: BOX });
      return calls;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
