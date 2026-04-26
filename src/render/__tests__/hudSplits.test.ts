/**
 * Mock-canvas drawcall tests for the splits / ghost-delta widget.
 *
 * Covers:
 * - Three text drawcalls (timer + label + delta) when delta is non-null.
 * - Two text drawcalls (timer + label) when delta is null.
 * - Positive delta uses the "slower" color token; negative uses "faster".
 * - Lap-time and delta formatting per the pinned widget contract.
 * - Deterministic replay produces the same drawcall sequence.
 * - Context state (fillStyle, font, textAlign, textBaseline) is restored.
 */

import { describe, expect, it } from "vitest";

import {
  deltaColor,
  drawSplitsWidget,
  formatDelta,
  formatLapTime,
  type SplitsState,
} from "../hudSplits";

type Call =
  | {
      type: "fillText";
      fillStyle: string;
      font: string;
      align: CanvasTextAlign;
      baseline: CanvasTextBaseline;
      text: string;
      x: number;
      y: number;
    };

interface Spy {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
}

function makeSpy(): Spy {
  const calls: Call[] = [];
  let fillStyle: string = "";
  let font: string = "";
  let textAlign: CanvasTextAlign = "start";
  let textBaseline: CanvasTextBaseline = "alphabetic";
  const ctx = {
    get fillStyle(): string {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get font(): string {
      return font;
    },
    set font(value: string) {
      font = value;
    },
    get textAlign(): CanvasTextAlign {
      return textAlign;
    },
    set textAlign(value: CanvasTextAlign) {
      textAlign = value;
    },
    get textBaseline(): CanvasTextBaseline {
      return textBaseline;
    },
    set textBaseline(value: CanvasTextBaseline) {
      textBaseline = value;
    },
    fillText(text: string, x: number, y: number): void {
      calls.push({
        type: "fillText",
        fillStyle,
        font,
        align: textAlign,
        baseline: textBaseline,
        text,
        x,
        y,
      });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const VIEWPORT = { width: 800, height: 600 };

describe("formatLapTime", () => {
  it("formats zero as MM:SS.mmm", () => {
    expect(formatLapTime(0)).toBe("00:00.000");
  });

  it("formats sub-second values", () => {
    expect(formatLapTime(123)).toBe("00:00.123");
  });

  it("formats minute / second / ms components", () => {
    expect(formatLapTime(67_321)).toBe("01:07.321");
  });

  it("returns a placeholder for non-finite input", () => {
    expect(formatLapTime(Number.NaN)).toBe("--:--.---");
  });
});

describe("formatDelta", () => {
  it("includes a leading + for slower deltas", () => {
    expect(formatDelta(1234)).toBe("+00:01.200");
  });

  it("includes a leading - for faster deltas", () => {
    expect(formatDelta(-1234)).toBe("-00:01.200");
  });

  it("rounds to 100 ms granularity", () => {
    expect(formatDelta(449)).toBe("+00:00.400");
    expect(formatDelta(450)).toBe("+00:00.500");
  });

  it("renders zero with a leading + for stability", () => {
    expect(formatDelta(0)).toBe("+00:00.000");
  });
});

describe("deltaColor", () => {
  it("returns the slower colour for positive deltas", () => {
    expect(deltaColor(500)).toBe("#ff5a5a");
  });

  it("returns the faster colour for negative deltas", () => {
    expect(deltaColor(-500)).toBe("#7ce25a");
  });
});

describe("drawSplitsWidget", () => {
  it("emits three text drawcalls when sectorDeltaMs is non-null", () => {
    const state: SplitsState = {
      lapTimerMs: 30_000,
      currentSectorIdx: 1,
      sectorLabel: "split-a",
      sectorDeltaMs: 250,
    };
    const { ctx, calls } = makeSpy();
    drawSplitsWidget(ctx, state, VIEWPORT);
    // Each shadowed text emits two fillText calls (shadow + text).
    expect(calls).toHaveLength(6);
    const textColors = calls
      .filter((_, i) => i % 2 === 1)
      .map((c) => c.fillStyle);
    expect(textColors).toEqual(["#ffffff", "#cfd6e4", "#ff5a5a"]);
  });

  it("emits two text drawcalls when sectorDeltaMs is null (first-run case)", () => {
    const state: SplitsState = {
      lapTimerMs: 0,
      currentSectorIdx: 0,
      sectorLabel: "start",
      sectorDeltaMs: null,
    };
    const { ctx, calls } = makeSpy();
    drawSplitsWidget(ctx, state, VIEWPORT);
    // Two shadowed texts (timer + label) = four fillText calls.
    expect(calls).toHaveLength(4);
  });

  it("uses green for negative deltas and red for positive deltas", () => {
    const positive: SplitsState = {
      lapTimerMs: 1000,
      currentSectorIdx: 0,
      sectorLabel: "start",
      sectorDeltaMs: 500,
    };
    const negative: SplitsState = { ...positive, sectorDeltaMs: -500 };
    const posSpy = makeSpy();
    const negSpy = makeSpy();
    drawSplitsWidget(posSpy.ctx, positive, VIEWPORT);
    drawSplitsWidget(negSpy.ctx, negative, VIEWPORT);
    // Last two fillText calls per side are the delta shadow + delta text.
    expect(posSpy.calls.at(-1)!.fillStyle).toBe("#ff5a5a");
    expect(negSpy.calls.at(-1)!.fillStyle).toBe("#7ce25a");
  });

  it("anchors text on the right edge of the viewport with the configured padding", () => {
    const state: SplitsState = {
      lapTimerMs: 1234,
      currentSectorIdx: 0,
      sectorLabel: "start",
      sectorDeltaMs: null,
    };
    const { ctx, calls } = makeSpy();
    drawSplitsWidget(ctx, state, VIEWPORT);
    expect(calls.every((c) => c.align === "right")).toBe(true);
    // Shadow uses x + 1; the second of each pair is the canonical x.
    expect(calls[1]!.x).toBe(VIEWPORT.width - 16);
  });

  it("formats the lap timer in the first text drawcall", () => {
    const state: SplitsState = {
      lapTimerMs: 67_321,
      currentSectorIdx: 0,
      sectorLabel: "start",
      sectorDeltaMs: null,
    };
    const { ctx, calls } = makeSpy();
    drawSplitsWidget(ctx, state, VIEWPORT);
    expect(calls[0]!.text).toBe("01:07.321");
    expect(calls[1]!.text).toBe("01:07.321");
  });

  it("formats the delta with a leading sign in the third text drawcall", () => {
    const state: SplitsState = {
      lapTimerMs: 0,
      currentSectorIdx: 0,
      sectorLabel: "start",
      sectorDeltaMs: -1500,
    };
    const { ctx, calls } = makeSpy();
    drawSplitsWidget(ctx, state, VIEWPORT);
    expect(calls.at(-1)!.text).toBe("-00:01.500");
  });

  it("restores fillStyle, font, textAlign, and textBaseline before returning", () => {
    const { ctx } = makeSpy();
    ctx.fillStyle = "#abcdef";
    ctx.font = "10px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawSplitsWidget(
      ctx,
      {
        lapTimerMs: 1000,
        currentSectorIdx: 0,
        sectorLabel: "start",
        sectorDeltaMs: 100,
      },
      VIEWPORT,
    );
    expect(ctx.fillStyle).toBe("#abcdef");
    expect(ctx.font).toBe("10px serif");
    expect(ctx.textAlign).toBe("center");
    expect(ctx.textBaseline).toBe("middle");
  });

  it("is deterministic: replay produces the same drawcall sequence", () => {
    const state: SplitsState = {
      lapTimerMs: 12_345,
      currentSectorIdx: 1,
      sectorLabel: "split-a",
      sectorDeltaMs: 250,
    };
    const runOnce = (): Call[] => {
      const { ctx, calls } = makeSpy();
      drawSplitsWidget(ctx, state, VIEWPORT);
      return calls;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
