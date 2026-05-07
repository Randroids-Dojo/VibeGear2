/**
 * Vitest suite for the radial speed-line pool. Pins the contract from
 * `.dots/VibeGear2-implement-radial-speed-02dc1556.md`:
 * - Empty initial state.
 * - Zero emit at speedNorm 0.5 (below threshold).
 * - ~24 emits/sec at speedNorm 1, nitro off.
 * - ~42 emits/sec at speedNorm 1, nitro on.
 * - Deterministic across two pools fed the same inputs.
 * - Zero emit when prefers-reduced-motion is on.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  BASE_PEAK_RATE_PER_SEC,
  EMIT_THRESHOLD_NORM,
  emitRatePerSec,
  INITIAL_SPEED_LINE_STATE,
  LIFETIME_MS,
  MAX_SPEED_LINES,
  NITRO_BONUS_RATE_PER_SEC,
  tickSpeedLines,
  type TickSpeedLinesParams,
} from "@/render/speedLines";
import { refreshReducedMotionPreference } from "@/render/vfx";

const VIEWPORT = { width: 1280, height: 720 };

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  refreshReducedMotionPreference();
});

function drive(
  params: Omit<TickSpeedLinesParams, "viewport">,
  ticks: number,
) {
  let state = INITIAL_SPEED_LINE_STATE;
  for (let i = 0; i < ticks; i += 1) {
    state = tickSpeedLines(state, { ...params, viewport: VIEWPORT });
  }
  return state;
}

describe("INITIAL_SPEED_LINE_STATE", () => {
  it("is empty", () => {
    expect(INITIAL_SPEED_LINE_STATE.particles.length).toBe(0);
    expect(INITIAL_SPEED_LINE_STATE.tickIdx).toBe(0);
    expect(INITIAL_SPEED_LINE_STATE.emitAccumulator).toBe(0);
  });
});

describe("emitRatePerSec", () => {
  it("is 0 below the threshold", () => {
    expect(emitRatePerSec(0, false)).toBe(0);
    expect(emitRatePerSec(0.5, false)).toBe(0);
    expect(emitRatePerSec(EMIT_THRESHOLD_NORM, false)).toBe(0);
  });

  it("ramps linearly to BASE_PEAK_RATE_PER_SEC at speedNorm 1", () => {
    expect(emitRatePerSec(1, false)).toBeCloseTo(BASE_PEAK_RATE_PER_SEC, 5);
    const half =
      EMIT_THRESHOLD_NORM + (1 - EMIT_THRESHOLD_NORM) * 0.5;
    expect(emitRatePerSec(half, false)).toBeCloseTo(
      BASE_PEAK_RATE_PER_SEC * 0.5,
      5,
    );
  });

  it("adds NITRO_BONUS_RATE_PER_SEC when nitroActive", () => {
    expect(emitRatePerSec(1, true)).toBeCloseTo(
      BASE_PEAK_RATE_PER_SEC + NITRO_BONUS_RATE_PER_SEC,
      5,
    );
  });

  it("clamps speedNorm past 1", () => {
    expect(emitRatePerSec(1.5, false)).toBeCloseTo(BASE_PEAK_RATE_PER_SEC, 5);
  });
});

describe("tickSpeedLines emission rate", () => {
  it("emits zero at speedNorm 0.5 over a full second", () => {
    const out = drive(
      { speedNorm: 0.5, nitroActive: false, dtMs: 16, seed: 1 },
      63,
    );
    expect(out.particles.length).toBe(0);
  });

  it("emits ~24 particles/sec at speedNorm 1 (no nitro)", () => {
    // 100 ms window (6 ticks @ 60 Hz) = expected floor(24 * 0.1) = 2-3
    // spawns. Lifetime is 220 ms so no aging happens in the window;
    // spawn count == particle-count delta.
    let state = INITIAL_SPEED_LINE_STATE;
    let spawned = 0;
    for (let i = 0; i < 6; i += 1) {
      const before = state.particles.length;
      state = tickSpeedLines(state, {
        speedNorm: 1,
        nitroActive: false,
        dtMs: 1000 / 60,
        seed: 1,
        viewport: VIEWPORT,
      });
      spawned += state.particles.length - before;
    }
    expect(spawned).toBeGreaterThanOrEqual(2);
    expect(spawned).toBeLessThanOrEqual(3);
  });

  it("emits ~42 particles/sec at speedNorm 1 with nitro", () => {
    // 100 ms window = 4.2 expected spawns; aging not yet relevant.
    let state = INITIAL_SPEED_LINE_STATE;
    let spawned = 0;
    for (let i = 0; i < 6; i += 1) {
      const before = state.particles.length;
      state = tickSpeedLines(state, {
        speedNorm: 1,
        nitroActive: true,
        dtMs: 1000 / 60,
        seed: 1,
        viewport: VIEWPORT,
      });
      spawned += state.particles.length - before;
    }
    expect(spawned).toBeGreaterThanOrEqual(4);
    expect(spawned).toBeLessThanOrEqual(5);
  });

  it("ages particles out after LIFETIME_MS", () => {
    let state = INITIAL_SPEED_LINE_STATE;
    state = tickSpeedLines(state, {
      speedNorm: 1,
      nitroActive: false,
      dtMs: 1000 / 60,
      seed: 1,
      viewport: VIEWPORT,
    });
    // Force at least one emission by accumulating through a few ticks.
    for (let i = 0; i < 6; i += 1) {
      state = tickSpeedLines(state, {
        speedNorm: 1,
        nitroActive: false,
        dtMs: 1000 / 60,
        seed: 1,
        viewport: VIEWPORT,
      });
    }
    expect(state.particles.length).toBeGreaterThan(0);
    // Now drive zero-emit ticks past the lifetime.
    for (let i = 0; i < 20; i += 1) {
      state = tickSpeedLines(state, {
        speedNorm: 0,
        nitroActive: false,
        dtMs: LIFETIME_MS / 5,
        seed: 1,
        viewport: VIEWPORT,
      });
    }
    expect(state.particles.length).toBe(0);
  });

  it("caps the active pool at MAX_SPEED_LINES", () => {
    // Force many spawns by driving with a large dtMs so accumulator
    // produces multiple emits per tick.
    let state = INITIAL_SPEED_LINE_STATE;
    for (let i = 0; i < 200; i += 1) {
      state = tickSpeedLines(state, {
        speedNorm: 1,
        nitroActive: true,
        dtMs: 50,
        seed: 1,
        viewport: VIEWPORT,
      });
    }
    expect(state.particles.length).toBeLessThanOrEqual(MAX_SPEED_LINES);
  });
});

describe("tickSpeedLines determinism", () => {
  it("two pools fed the same inputs produce identical particle layouts", () => {
    const params: TickSpeedLinesParams = {
      speedNorm: 0.95,
      nitroActive: false,
      dtMs: 1000 / 60,
      seed: 7,
      viewport: VIEWPORT,
    };
    let a = INITIAL_SPEED_LINE_STATE;
    let b = INITIAL_SPEED_LINE_STATE;
    for (let i = 0; i < 60; i += 1) {
      a = tickSpeedLines(a, params);
      b = tickSpeedLines(b, params);
    }
    expect(a.particles.length).toBe(b.particles.length);
    for (let i = 0; i < a.particles.length; i += 1) {
      expect(a.particles[i]!.x).toBe(b.particles[i]!.x);
      expect(a.particles[i]!.y).toBe(b.particles[i]!.y);
      expect(a.particles[i]!.vx).toBe(b.particles[i]!.vx);
    }
  });

  it("two seeds produce different layouts at the same input", () => {
    const baseParams: Omit<TickSpeedLinesParams, "seed"> = {
      speedNorm: 0.95,
      nitroActive: false,
      dtMs: 1000 / 60,
      viewport: VIEWPORT,
    };
    let a = INITIAL_SPEED_LINE_STATE;
    let b = INITIAL_SPEED_LINE_STATE;
    for (let i = 0; i < 60; i += 1) {
      a = tickSpeedLines(a, { ...baseParams, seed: 7 });
      b = tickSpeedLines(b, { ...baseParams, seed: 13 });
    }
    if (a.particles.length > 0 && b.particles.length > 0) {
      const sameX = a.particles.every(
        (p, i) => p.x === b.particles[i]?.x,
      );
      expect(sameX).toBe(false);
    }
  });
});

describe("tickSpeedLines reduced-motion gate", () => {
  it("emits zero when prefers-reduced-motion is true", () => {
    (globalThis as { window: { matchMedia: (q: string) => MediaQueryList } }).window = {
      matchMedia: () =>
        ({
          matches: true,
          media: "(prefers-reduced-motion: reduce)",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    };
    refreshReducedMotionPreference();
    const out = drive(
      { speedNorm: 1, nitroActive: true, dtMs: 16, seed: 1 },
      120,
    );
    expect(out.particles.length).toBe(0);
  });
});
