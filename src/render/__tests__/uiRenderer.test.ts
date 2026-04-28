/**
 * Mock-canvas drawcall tests for the HUD overlay drawer.
 *
 * Covers F-027: the renderer was missing the §20 accessibility-assist
 * badge pip even though `HudState.assistBadge` was already populated by
 * `deriveHudState`. These tests pin the badge's draw shape (background
 * pill + shadowed label) and the multi-assist label format, plus the
 * existing context-state restoration contract that the legacy HUD
 * already honours.
 */

import { describe, expect, it } from "vitest";

import type { AssistBadge, AssistBadgeLabel } from "@/game/assists";
import type { HudState } from "@/game/hudState";

import { drawHud, formatAssistBadgeLabel } from "../uiRenderer";

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
    }
  | {
      type: "fillRect";
      fillStyle: string;
      x: number;
      y: number;
      w: number;
      h: number;
    };

interface Spy {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
}

/**
 * Build a recording mock canvas. Captures fillText / fillRect calls plus
 * the active fill / font / align / baseline at the time of each call so
 * tests can assert the shape sequence without booting a real DOM canvas.
 * `measureText` returns a synthetic width of 7 px per character, matching
 * the §20 monospace stack closely enough for layout assertions.
 */
function makeSpy(): Spy {
  const calls: Call[] = [];
  let fillStyle = "";
  let font = "";
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
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({ type: "fillRect", fillStyle, x, y, w, h });
    },
    measureText(text: string): TextMetrics {
      return { width: text.length * 7 } as TextMetrics;
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const VIEWPORT = { width: 800, height: 600 };

const BASE_HUD: HudState = {
  speed: 88,
  speedUnit: "kph",
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalCars: 4,
};

function badge(
  primary: AssistBadgeLabel,
  count = 1,
  active = true,
  extra: AssistBadgeLabel[] = [],
): AssistBadge {
  return {
    active,
    count,
    primary,
    active_labels: [primary, ...extra],
  };
}

describe("formatAssistBadgeLabel", () => {
  it("returns the primary label when only one assist is active", () => {
    expect(formatAssistBadgeLabel(badge("auto-accelerate"))).toBe("Auto accel");
  });

  it("appends a count suffix when more than one assist is active", () => {
    expect(formatAssistBadgeLabel(badge("brake-assist", 3))).toBe(
      "Brake assist x3",
    );
  });

  it("returns an empty string when there is no primary label", () => {
    const inactive: AssistBadge = {
      active: false,
      count: 0,
      primary: null,
      active_labels: [],
    };
    expect(formatAssistBadgeLabel(inactive)).toBe("");
  });

  it("uses ascii x rather than unicode multiplication for the count suffix", () => {
    const label = formatAssistBadgeLabel(badge("steering-smoothing", 2));
    expect(label).toContain(" x2");
    // Forbid the unicode x-cross variant; the §20 monospace stack covers
    // ASCII reliably but not every Unicode glyph.
    expect(label).not.toMatch(/[×✕]/u);
  });

  it("maps every assist label slug to a non-empty display string", () => {
    const slugs: AssistBadgeLabel[] = [
      "auto-accelerate",
      "brake-assist",
      "steering-smoothing",
      "toggle-nitro",
      "reduced-input",
      "visual-weather",
    ];
    for (const slug of slugs) {
      expect(formatAssistBadgeLabel(badge(slug))).not.toBe("");
    }
  });
});

describe("drawHud assist badge", () => {
  it("draws zero badge primitives when assistBadge is undefined", () => {
    const { ctx, calls } = makeSpy();
    drawHud(ctx, BASE_HUD, VIEWPORT);
    // The legacy HUD draws four shadowed texts (lap, position, speed,
    // unit) = eight fillText calls. No fillRects when the badge is
    // omitted; the lack of fillRect is the badge-not-drawn assertion.
    expect(calls.filter((c) => c.type === "fillRect")).toHaveLength(0);
    expect(calls.filter((c) => c.type === "fillText")).toHaveLength(8);
  });

  it("draws zero badge primitives when assistBadge.active is false", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        assistBadge: {
          active: false,
          count: 0,
          primary: null,
          active_labels: [],
        },
      },
      VIEWPORT,
    );
    expect(calls.filter((c) => c.type === "fillRect")).toHaveLength(0);
  });

  it("draws a pill background plus a shadowed label when one assist is active", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, assistBadge: badge("auto-accelerate") },
      VIEWPORT,
    );
    const fillRects = calls.filter((c) => c.type === "fillRect");
    expect(fillRects).toHaveLength(1);
    // The badge label uses two fillText calls (shadow + text) appended
    // after the legacy HUD's eight, so the last two fillText calls are
    // the badge label.
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts).toHaveLength(10);
    expect(fillTexts.at(-1)!.text).toBe("Auto accel");
    expect(fillTexts.at(-2)!.text).toBe("Auto accel");
  });

  it("formats the label as 'Brake assist x3' when three assists are active", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        assistBadge: badge("brake-assist", 3, true, [
          "auto-accelerate",
          "steering-smoothing",
        ]),
      },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts.at(-1)!.text).toBe("Brake assist x3");
  });

  it("anchors the badge in the top-right corner with the configured padding", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, assistBadge: badge("toggle-nitro") },
      VIEWPORT,
    );
    const fillRect = calls.find((c) => c.type === "fillRect");
    expect(fillRect).toBeDefined();
    if (fillRect && fillRect.type === "fillRect") {
      // Pill's right edge sits at viewport.width - padding (16).
      expect(fillRect.x + fillRect.w).toBe(VIEWPORT.width - 16);
      // Pill sits below the splits widget at y = padding + 64.
      expect(fillRect.y).toBe(16 + 64);
      // Pill height is the pinned 20 px.
      expect(fillRect.h).toBe(20);
    }
  });

  it("uses the default tinted accent for the pill background", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, assistBadge: badge("visual-weather") },
      VIEWPORT,
    );
    const fillRect = calls.find((c) => c.type === "fillRect");
    expect(fillRect?.fillStyle).toBe("rgba(80, 130, 220, 0.85)");
  });

  it("respects an override color for the badge fill and text", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, assistBadge: badge("brake-assist") },
      VIEWPORT,
      {
        colors: {
          text: "#fff",
          textMuted: "#ccc",
          shadow: "rgba(0,0,0,0.5)",
          assistBadgeFill: "#aabbcc",
          assistBadgeText: "#112233",
          statusPanelFill: "#010203",
          damageGood: "#00aa00",
          damageWarn: "#aaaa00",
          damageBad: "#aa0000",
          weatherChipFill: "#002244",
        },
      },
    );
    const fillRect = calls.find((c) => c.type === "fillRect");
    expect(fillRect?.fillStyle).toBe("#aabbcc");
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts.at(-1)!.fillStyle).toBe("#112233");
  });

  it("restores fillStyle / font / textAlign / textBaseline after drawing", () => {
    const { ctx } = makeSpy();
    ctx.fillStyle = "#abcdef";
    ctx.font = "10px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawHud(
      ctx,
      { ...BASE_HUD, assistBadge: badge("steering-smoothing") },
      VIEWPORT,
    );
    expect(ctx.fillStyle).toBe("#abcdef");
    expect(ctx.font).toBe("10px serif");
    expect(ctx.textAlign).toBe("center");
    expect(ctx.textBaseline).toBe("middle");
  });

  it("is deterministic: identical input produces the same drawcall sequence", () => {
    const hud: HudState = { ...BASE_HUD, assistBadge: badge("brake-assist", 2) };
    const runOnce = (): Call[] => {
      const { ctx, calls } = makeSpy();
      drawHud(ctx, hud, VIEWPORT);
      return calls;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe("drawHud damage and weather cluster", () => {
  it("draws no status panel when damage and weather are absent", () => {
    const { ctx, calls } = makeSpy();
    drawHud(ctx, BASE_HUD, VIEWPORT);
    const labels = calls
      .filter((c) => c.type === "fillText")
      .map((c) => c.text);
    expect(labels.some((label) => label.startsWith("DMG"))).toBe(false);
    expect(labels.some((label) => label.startsWith("GRIP"))).toBe(false);
  });

  it("draws damage total, per-zone text, and a proportional damage bar", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        damage: {
          totalPercent: 50,
          zones: { engine: 70, tires: 20, body: 10 },
        },
      },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts.some((c) => c.text === "DMG 50%")).toBe(true);
    expect(fillTexts.some((c) => c.text === "E70 T20 B10")).toBe(true);
    const fillRects = calls.filter((c) => c.type === "fillRect");
    expect(fillRects).toHaveLength(3);
    const damageFill = fillRects.at(-1);
    expect(damageFill?.fillStyle).toBe("#f3c84b");
    expect(damageFill?.w).toBe(37);
  });

  it("draws weather label and uppercase grip hint", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        weather: {
          icon: "rain",
          label: "HEAVY RAIN",
          gripHint: "slick",
          gripPercent: 72,
        },
      },
      VIEWPORT,
    );
    const labels = calls
      .filter((c) => c.type === "fillText")
      .map((c) => c.text);
    expect(labels).toContain("R");
    expect(labels).toContain("HEAVY RAIN");
    expect(labels).toContain("GRIP 72% SLICK");
  });

  it("omits the grip row when weather has no grip data", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        weather: {
          icon: "clear",
          label: "CLEAR",
        },
      },
      VIEWPORT,
    );
    const labels = calls
      .filter((c) => c.type === "fillText")
      .map((c) => c.text);
    expect(labels).toContain("CLEAR");
    expect(labels.some((label) => label.startsWith("GRIP"))).toBe(false);
  });

  it("draws combined damage and weather inside one bottom-left panel", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        damage: {
          totalPercent: 82,
          zones: { engine: 90, tires: 80, body: 70 },
        },
        weather: {
          icon: "fog",
          label: "FOG",
          gripHint: "low-vis",
          gripPercent: 91,
        },
      },
      VIEWPORT,
    );
    const fillRects = calls.filter((c) => c.type === "fillRect");
    expect(fillRects[0]).toMatchObject({
      type: "fillRect",
      fillStyle: "rgba(7, 14, 28, 0.72)",
      x: 16,
      w: 142,
    });
    expect(fillRects.some((c) => c.fillStyle === "#ef4b4b")).toBe(true);
    const labels = calls
      .filter((c) => c.type === "fillText")
      .map((c) => c.text);
    expect(labels).toContain("F");
    expect(labels).toContain("GRIP 91% LOW-VIS");
  });
});

describe("drawHud lap-timer widget", () => {
  it("draws no extra fillText rows when neither timer field is supplied", () => {
    const { ctx, calls } = makeSpy();
    drawHud(ctx, BASE_HUD, VIEWPORT);
    const fillTexts = calls.filter((c) => c.type === "fillText");
    // Legacy minimal HUD: lap, position, speed, unit = four shadowed
    // texts = eight fillText calls. The TIME and BEST rows must add
    // nothing when the matching fields are absent.
    expect(fillTexts).toHaveLength(8);
    const labels = fillTexts.map((c) => c.text);
    expect(labels.some((t) => t.startsWith("TIME"))).toBe(false);
    expect(labels.some((t) => t.startsWith("BEST"))).toBe(false);
  });

  it("draws the TIME row at the documented offset when currentLapElapsedMs is supplied", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, currentLapElapsedMs: 12_345 },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    // Legacy 8 + TIME row (shadow + text) = 10.
    expect(fillTexts).toHaveLength(10);
    const timerCalls = fillTexts.filter((c) => c.text.startsWith("TIME"));
    expect(timerCalls).toHaveLength(2);
    expect(timerCalls[0]!.text).toBe("TIME 00:12.345");
    // Padding (16) + LAP_TIMER_TOP_OFFSET (44) = 60. Shadow underlay is
    // offset by +1 px; the canonical text sits at exactly 60.
    const textCall = timerCalls.find((c) => c.fillStyle === "#ffffff");
    expect(textCall?.x).toBe(16);
    expect(textCall?.y).toBe(16 + 44);
  });

  it("draws the BEST row at the documented offset when bestLapMs is supplied", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, bestLapMs: 65_432 },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts).toHaveLength(10);
    const bestCalls = fillTexts.filter((c) => c.text.startsWith("BEST"));
    expect(bestCalls).toHaveLength(2);
    expect(bestCalls[0]!.text).toBe("BEST 01:05.432");
    const textCall = bestCalls.find((c) => c.fillStyle === "#cfd6e4");
    expect(textCall?.x).toBe(16);
    expect(textCall?.y).toBe(16 + 64);
  });

  it("draws both rows together when both fields are supplied", () => {
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, currentLapElapsedMs: 1_000, bestLapMs: 2_000 },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    // Legacy 8 + TIME 2 + BEST 2 = 12.
    expect(fillTexts).toHaveLength(12);
    expect(fillTexts.some((c) => c.text === "TIME 00:01.000")).toBe(true);
    expect(fillTexts.some((c) => c.text === "BEST 00:02.000")).toBe(true);
  });

  it("suppresses the BEST row when bestLapMs is explicitly null", () => {
    // The "no PB yet" state passes null so the timer still draws but
    // the BEST row stays hidden.
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, currentLapElapsedMs: 7_500, bestLapMs: null },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts).toHaveLength(10);
    expect(fillTexts.some((c) => c.text.startsWith("TIME"))).toBe(true);
    expect(fillTexts.some((c) => c.text.startsWith("BEST"))).toBe(false);
  });

  it("renders non-finite currentLapElapsedMs as the placeholder string", () => {
    // The renderer still draws the row so layout stays stable; the
    // formatter is what supplies the dashes.
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      { ...BASE_HUD, currentLapElapsedMs: Number.NaN },
      VIEWPORT,
    );
    const fillTexts = calls.filter((c) => c.type === "fillText");
    expect(fillTexts.some((c) => c.text === "TIME --:--.---")).toBe(true);
  });

  it("draws the timer rows above the assist badge so they do not overlap", () => {
    // The badge sits at y = padding + 64 in the top-right corner; the
    // timer rows sit on the left at y = padding + 44 / + 64. Ensure the
    // badge keeps its anchor when the timer rows are present so the
    // top-right corner is unaffected.
    const { ctx, calls } = makeSpy();
    drawHud(
      ctx,
      {
        ...BASE_HUD,
        currentLapElapsedMs: 4_321,
        bestLapMs: 9_999,
        assistBadge: badge("auto-accelerate"),
      },
      VIEWPORT,
    );
    const fillRect = calls.find((c) => c.type === "fillRect");
    expect(fillRect?.y).toBe(16 + 64);
  });
});
