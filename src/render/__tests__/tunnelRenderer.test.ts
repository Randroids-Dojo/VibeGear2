import { describe, expect, it } from "vitest";

import type { Strip, Viewport } from "@/road/types";
import {
  TUNNEL_ADAPTATION_OVERLAY_FILL,
  drawTunnelAdaptation,
  tunnelAdaptationIntensity,
} from "../tunnelRenderer";

interface FillRectCall {
  readonly fillStyle: string;
  readonly globalAlpha: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function strip(overrides: Partial<Strip> = {}): Strip {
  return {
    visible: true,
    screenX: 400,
    screenY: 300,
    screenW: 120,
    scale: 1,
    worldX: 0,
    worldY: 0,
    segment: {
      index: 0,
      worldZ: 0,
      curve: 0,
      grade: 0,
      authoredIndex: 0,
      roadsideLeftId: "default",
      roadsideRightId: "default",
      hazardIds: [],
      pickupIds: [],
    },
    ...overrides,
  };
}

function makeCtx(): {
  readonly ctx: CanvasRenderingContext2D;
  readonly calls: FillRectCall[];
} {
  const calls: FillRectCall[] = [];
  const target = {
    fillStyle: "#000",
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({
        fillStyle: String(this.fillStyle),
        globalAlpha: this.globalAlpha,
        x,
        y,
        w,
        h,
      });
    },
  };
  return {
    ctx: target as unknown as CanvasRenderingContext2D,
    calls,
  };
}

describe("tunnelRenderer", () => {
  const viewport: Viewport = { width: 800, height: 480 };

  it("computes intensity from visible tunnel segments", () => {
    const intensity = tunnelAdaptationIntensity([
      strip({ segment: { ...strip().segment, inTunnel: true } }),
      strip({ segment: { ...strip().segment, hazardIds: ["tunnel"] } }),
      strip({ segment: { ...strip().segment, hazardIds: [] } }),
    ]);
    expect(intensity).toBe(1);
  });

  it("draws a deterministic dark overlay scaled by caller intensity", () => {
    const { ctx, calls } = makeCtx();
    drawTunnelAdaptation(
      ctx,
      [strip({ segment: { ...strip().segment, inTunnel: true } })],
      viewport,
      { intensityScale: 0.5 },
    );

    const overlay = calls.find((call) => call.fillStyle === TUNNEL_ADAPTATION_OVERLAY_FILL);
    expect(overlay).toBeDefined();
    expect(overlay!.x).toBe(0);
    expect(overlay!.y).toBe(0);
    expect(overlay!.w).toBe(viewport.width);
    expect(overlay!.h).toBe(viewport.height);
    expect(overlay!.globalAlpha).toBeCloseTo(0.38 * 0.5, 6);
    expect(ctx.globalAlpha).toBe(1);
  });

  it("skips disabled draws", () => {
    const { ctx, calls } = makeCtx();
    drawTunnelAdaptation(
      ctx,
      [strip({ segment: { ...strip().segment, inTunnel: true } })],
      viewport,
      { enabled: false },
    );
    expect(calls).toEqual([]);
  });
});
