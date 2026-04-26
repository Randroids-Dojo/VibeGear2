import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Viewport } from "@/road/types";

import {
  DEFAULT_SHAKE_FREQUENCY_HZ,
  drawVfx,
  fireFlash,
  fireShake,
  INITIAL_VFX_STATE,
  MAX_SHAKE_AMPLITUDE_PX,
  refreshReducedMotionPreference,
  shakeOffsetAt,
  tickVfx,
  type VfxState,
} from "../vfx";

interface DrawCall {
  type: "fillRect";
  fillStyle: string;
  globalAlpha: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Spy {
  ctx: CanvasRenderingContext2D;
  calls: DrawCall[];
}

/**
 * Hand-rolled Canvas2D spy for the only methods drawVfx touches. We
 * record the globalAlpha value at the moment of each fillRect so the
 * tests can assert the alpha decay envelope without driving a real
 * canvas.
 */
function makeSpy(): Spy {
  const calls: DrawCall[] = [];
  let fillStyle = "";
  let globalAlpha = 1;
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
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const VIEWPORT: Viewport = { width: 800, height: 600 };

/**
 * Stub `window.matchMedia` so tests can flip the reduced-motion
 * preference. Callers pass `true` to simulate the accessibility setting
 * being on.
 */
function setReducedMotion(reduced: boolean): void {
  // jsdom is not loaded in this suite (Vitest default node env), so
  // `window` may be undefined. Tests that need this call also stub a
  // global window via vi.stubGlobal.
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? reduced : false,
    }),
  });
  refreshReducedMotionPreference();
}

beforeEach(() => {
  refreshReducedMotionPreference();
});

afterEach(() => {
  vi.unstubAllGlobals();
  refreshReducedMotionPreference();
});

describe("INITIAL_VFX_STATE", () => {
  it("starts with no flashes and no shakes", () => {
    expect(INITIAL_VFX_STATE.flashes).toEqual([]);
    expect(INITIAL_VFX_STATE.shakes).toEqual([]);
  });
});

describe("fireFlash", () => {
  it("pushes a flash with elapsedMs at 0 and preserves color, intensity, duration", () => {
    const next = fireFlash(INITIAL_VFX_STATE, {
      intensity: 0.6,
      color: "#fff",
      durationMs: 200,
    });
    expect(next.flashes).toEqual([
      { intensity: 0.6, color: "#fff", durationMs: 200, elapsedMs: 0 },
    ]);
    expect(next.shakes).toEqual([]);
  });

  it("returns the input state unchanged when durationMs is non-positive", () => {
    const a = fireFlash(INITIAL_VFX_STATE, { intensity: 1, color: "#fff", durationMs: 0 });
    expect(a).toBe(INITIAL_VFX_STATE);
    const b = fireFlash(INITIAL_VFX_STATE, { intensity: 1, color: "#fff", durationMs: -50 });
    expect(b).toBe(INITIAL_VFX_STATE);
  });

  it("returns the input state unchanged when intensity is non-positive", () => {
    const a = fireFlash(INITIAL_VFX_STATE, { intensity: 0, color: "#fff", durationMs: 200 });
    expect(a).toBe(INITIAL_VFX_STATE);
  });

  it("works regardless of reduced-motion preference (HUD flash is a navigation cue)", () => {
    setReducedMotion(true);
    const next = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    expect(next.flashes.length).toBe(1);
  });

  it("stacks: two fires produce two entries", () => {
    let state = fireFlash(INITIAL_VFX_STATE, { intensity: 1, color: "#fff", durationMs: 200 });
    state = fireFlash(state, { intensity: 0.4, color: "#0f0", durationMs: 100 });
    expect(state.flashes.length).toBe(2);
  });
});

describe("fireShake", () => {
  it("pushes a shake with elapsedMs at 0 and the supplied seed and frequency", () => {
    const next = fireShake(INITIAL_VFX_STATE, {
      amplitudePx: 4,
      durationMs: 300,
      seed: 12345,
      frequencyHz: 20,
    });
    expect(next.shakes).toEqual([
      { amplitudePx: 4, durationMs: 300, elapsedMs: 0, seed: 12345, frequencyHz: 20 },
    ]);
  });

  it("defaults frequencyHz to DEFAULT_SHAKE_FREQUENCY_HZ when omitted", () => {
    const next = fireShake(INITIAL_VFX_STATE, {
      amplitudePx: 4,
      durationMs: 300,
      seed: 1,
    });
    expect(next.shakes[0]?.frequencyHz).toBe(DEFAULT_SHAKE_FREQUENCY_HZ);
  });

  it("returns the input state unchanged when durationMs or amplitude is non-positive", () => {
    const a = fireShake(INITIAL_VFX_STATE, { amplitudePx: 4, durationMs: 0, seed: 1 });
    expect(a).toBe(INITIAL_VFX_STATE);
    const b = fireShake(INITIAL_VFX_STATE, { amplitudePx: 0, durationMs: 200, seed: 1 });
    expect(b).toBe(INITIAL_VFX_STATE);
    const c = fireShake(INITIAL_VFX_STATE, { amplitudePx: -1, durationMs: 200, seed: 1 });
    expect(c).toBe(INITIAL_VFX_STATE);
  });

  it("is a no-op (returns the input state) when prefers-reduced-motion is reduce", () => {
    setReducedMotion(true);
    const next = fireShake(INITIAL_VFX_STATE, {
      amplitudePx: 4,
      durationMs: 300,
      seed: 1,
    });
    expect(next).toBe(INITIAL_VFX_STATE);
  });

  it("re-enables when refreshReducedMotionPreference is called after the user disables the setting", () => {
    setReducedMotion(true);
    expect(fireShake(INITIAL_VFX_STATE, { amplitudePx: 4, durationMs: 300, seed: 1 })).toBe(
      INITIAL_VFX_STATE,
    );
    setReducedMotion(false);
    const next = fireShake(INITIAL_VFX_STATE, {
      amplitudePx: 4,
      durationMs: 300,
      seed: 1,
    });
    expect(next.shakes.length).toBe(1);
  });
});

describe("tickVfx", () => {
  it("returns the input state when dtMs is zero or negative", () => {
    const seeded = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    expect(tickVfx(seeded, 0)).toBe(seeded);
    expect(tickVfx(seeded, -10)).toBe(seeded);
  });

  it("decays a flash over its duration: 4 ticks of 50 ms expire a 200 ms flash", () => {
    let state = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    state = tickVfx(state, 50);
    expect(state.flashes[0]?.elapsedMs).toBe(50);
    state = tickVfx(state, 50);
    expect(state.flashes[0]?.elapsedMs).toBe(100);
    state = tickVfx(state, 50);
    expect(state.flashes[0]?.elapsedMs).toBe(150);
    state = tickVfx(state, 50);
    expect(state.flashes).toEqual([]);
  });

  it("removes shakes once their elapsed time meets or exceeds duration", () => {
    let state = fireShake(INITIAL_VFX_STATE, {
      amplitudePx: 4,
      durationMs: 100,
      seed: 1,
    });
    state = tickVfx(state, 60);
    expect(state.shakes.length).toBe(1);
    state = tickVfx(state, 40);
    expect(state.shakes).toEqual([]);
  });

  it("does not mutate the input state", () => {
    const initial = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    const beforeFlashes = initial.flashes;
    tickVfx(initial, 50);
    expect(initial.flashes).toBe(beforeFlashes);
    expect(initial.flashes[0]?.elapsedMs).toBe(0);
  });

  it("ticks flashes and shakes independently", () => {
    let state = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    state = fireShake(state, { amplitudePx: 4, durationMs: 100, seed: 1 });
    state = tickVfx(state, 80);
    expect(state.flashes[0]?.elapsedMs).toBe(80);
    expect(state.shakes[0]?.elapsedMs).toBe(80);
    state = tickVfx(state, 30);
    expect(state.flashes[0]?.elapsedMs).toBe(110);
    expect(state.shakes).toEqual([]);
  });
});

describe("shakeOffsetAt determinism", () => {
  it("produces identical offsets across two runs with the same seed and elapsed time", () => {
    const entry = { amplitudePx: 6, durationMs: 300, seed: 999, frequencyHz: 30 };
    const a: Array<{ dx: number; dy: number }> = [];
    const b: Array<{ dx: number; dy: number }> = [];
    for (let t = 0; t < 300; t += 16.667) {
      a.push(shakeOffsetAt(entry, t));
      b.push(shakeOffsetAt(entry, t));
    }
    expect(a).toEqual(b);
  });

  it("different seeds produce different offset paths", () => {
    const seedA = { amplitudePx: 6, durationMs: 300, seed: 1, frequencyHz: 30 };
    const seedB = { amplitudePx: 6, durationMs: 300, seed: 2, frequencyHz: 30 };
    let differences = 0;
    for (let t = 0; t < 300; t += 16.667) {
      const a = shakeOffsetAt(seedA, t);
      const b = shakeOffsetAt(seedB, t);
      if (a.dx !== b.dx || a.dy !== b.dy) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("integral of shake offset over duration is ~zero (no net drift)", () => {
    const entry = { amplitudePx: 6, durationMs: 300, seed: 42, frequencyHz: 30 };
    let sumX = 0;
    let sumY = 0;
    let samples = 0;
    for (let t = 0; t < 300; t += 1) {
      const o = shakeOffsetAt(entry, t);
      sumX += o.dx;
      sumY += o.dy;
      samples++;
    }
    // Per-frame expected mean is zero by construction; per-entry the
    // sample mean has to land within 1 px when scaled up by sample
    // count. We assert mean offset stays inside 1 px, matching the
    // task's "tolerance 1 px" check on net drift.
    expect(Math.abs(sumX / samples)).toBeLessThanOrEqual(1);
    expect(Math.abs(sumY / samples)).toBeLessThanOrEqual(1);
  });

  it("returns zero when elapsed has met or exceeded duration", () => {
    const entry = { amplitudePx: 6, durationMs: 300, seed: 1, frequencyHz: 30 };
    expect(shakeOffsetAt(entry, 300)).toEqual({ dx: 0, dy: 0 });
    expect(shakeOffsetAt(entry, 500)).toEqual({ dx: 0, dy: 0 });
  });

  it("amplitude attenuates linearly toward zero across the entry's duration", () => {
    const entry = { amplitudePx: 10, durationMs: 100, seed: 1, frequencyHz: 30 };
    const start = shakeOffsetAt(entry, 0);
    const late = shakeOffsetAt(entry, 90);
    expect(Math.abs(start.dx) + Math.abs(start.dy)).toBeGreaterThan(
      Math.abs(late.dx) + Math.abs(late.dy),
    );
  });
});

describe("drawVfx", () => {
  it("paints a full-viewport fill per active flash with alpha = intensity * remaining", () => {
    const { ctx, calls } = makeSpy();
    let state: VfxState = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    drawVfx(ctx, state, VIEWPORT);
    expect(calls.length).toBe(1);
    expect(calls[0]?.fillStyle).toBe("#fff");
    expect(calls[0]?.globalAlpha).toBe(1);
    expect(calls[0]?.x).toBe(0);
    expect(calls[0]?.y).toBe(0);
    expect(calls[0]?.w).toBe(VIEWPORT.width);
    expect(calls[0]?.h).toBe(VIEWPORT.height);

    // Half-elapsed flash paints at half alpha.
    state = tickVfx(state, 100);
    const spy2 = makeSpy();
    drawVfx(spy2.ctx, state, VIEWPORT);
    expect(spy2.calls[0]?.globalAlpha).toBeCloseTo(0.5, 9);
  });

  it("returns the summed shake offset clamped to MAX_SHAKE_AMPLITUDE_PX per axis", () => {
    const { ctx } = makeSpy();
    let state = INITIAL_VFX_STATE;
    // Stack a wildly oversized shake so the sum exceeds the cap.
    for (let i = 0; i < 10; i++) {
      state = fireShake(state, {
        amplitudePx: 1000,
        durationMs: 1000,
        seed: i + 1,
        frequencyHz: 30,
      });
    }
    const offset = drawVfx(ctx, state, VIEWPORT);
    expect(Math.abs(offset.dx)).toBeLessThanOrEqual(MAX_SHAKE_AMPLITUDE_PX);
    expect(Math.abs(offset.dy)).toBeLessThanOrEqual(MAX_SHAKE_AMPLITUDE_PX);
  });

  it("returns { dx: 0, dy: 0 } when there are no active shakes", () => {
    const { ctx } = makeSpy();
    expect(drawVfx(ctx, INITIAL_VFX_STATE, VIEWPORT)).toEqual({ dx: 0, dy: 0 });
  });

  it("paints nothing when the viewport has zero area, but still returns the shake offset", () => {
    const { ctx, calls } = makeSpy();
    const state = fireShake(
      fireFlash(INITIAL_VFX_STATE, { intensity: 1, color: "#fff", durationMs: 200 }),
      { amplitudePx: 4, durationMs: 200, seed: 1 },
    );
    const offset = drawVfx(ctx, state, { width: 0, height: 600 });
    expect(calls).toEqual([]);
    // Offset still computes; viewport size only gates the flash overlay.
    expect(typeof offset.dx).toBe("number");
    expect(typeof offset.dy).toBe("number");
  });

  it("two concurrent flashes paint two fillRects in stack order", () => {
    const { ctx, calls } = makeSpy();
    let state = fireFlash(INITIAL_VFX_STATE, {
      intensity: 0.5,
      color: "#fff",
      durationMs: 200,
    });
    state = fireFlash(state, { intensity: 0.4, color: "#0f0", durationMs: 100 });
    drawVfx(ctx, state, VIEWPORT);
    expect(calls.length).toBe(2);
    expect(calls[0]?.fillStyle).toBe("#fff");
    expect(calls[1]?.fillStyle).toBe("#0f0");
  });

  it("restores globalAlpha after painting", () => {
    const { ctx } = makeSpy();
    ctx.globalAlpha = 0.7;
    const state = fireFlash(INITIAL_VFX_STATE, {
      intensity: 1,
      color: "#fff",
      durationMs: 200,
    });
    drawVfx(ctx, state, VIEWPORT);
    expect(ctx.globalAlpha).toBe(0.7);
  });
});
