/**
 * Unit tests for the off-road dust particle pool.
 *
 * Covers the dot's "Verify" checklist:
 * - Emission rate (1 / 2 ticks while grass + speed > threshold).
 * - Pool cap at MAX_DUST = 64; the 65th emit overwrites the oldest.
 * - Lifetime 600 ms: a particle removed at exactly the 600 ms mark.
 * - Determinism: identical input + seed -> identical particle positions
 *   across two runs (AGENTS.md RULE 8).
 *
 * Float comparisons use `toBeCloseTo` per AGENTS.md RULE 8.
 */

import { describe, expect, it } from "vitest";

import type { Viewport } from "@/road/types";

import {
  DEFAULT_DUST_COLOR,
  EMIT_INTERVAL_TICKS,
  EMIT_SPEED_THRESHOLD_M_PER_S,
  INITIAL_DUST_STATE,
  LIFETIME_MS,
  MAX_DUST,
  PARTICLE_RADIUS_PX,
  drawDust,
  tickDust,
  type DustState,
} from "../dust";

const VIEWPORT: Viewport = { width: 800, height: 600 };

/** Standard 60 Hz fixed step in milliseconds. */
const DT_MS = 1000 / 60;

/** Speed safely above the emission threshold. */
const FAST = EMIT_SPEED_THRESHOLD_M_PER_S * 2;

/**
 * Hand-rolled spy for the canvas methods `drawDust` touches. Avoids
 * pulling jsdom into the node Vitest env, matching the parallax / vfx
 * test strategy.
 */
interface ArcCall {
  type: "arc";
  fillStyle: string;
  globalAlpha: number;
  x: number;
  y: number;
  r: number;
}

function makeSpy(): { ctx: CanvasRenderingContext2D; calls: ArcCall[] } {
  const calls: ArcCall[] = [];
  let fillStyle = "";
  let globalAlpha = 1;
  let pendingX = 0;
  let pendingY = 0;
  let pendingR = 0;
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
    beginPath(): void {
      // no-op; only tracked indirectly via the arc capture.
    },
    arc(x: number, y: number, r: number): void {
      pendingX = x;
      pendingY = y;
      pendingR = r;
    },
    fill(): void {
      calls.push({
        type: "arc",
        fillStyle,
        globalAlpha,
        x: pendingX,
        y: pendingY,
        r: pendingR,
      });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("INITIAL_DUST_STATE", () => {
  it("starts empty with tickIdx 0", () => {
    expect(INITIAL_DUST_STATE.particles).toEqual([]);
    expect(INITIAL_DUST_STATE.tickIdx).toBe(0);
    expect(INITIAL_DUST_STATE.nextRecycleIdx).toBe(0);
  });

  it("is frozen so callers cannot mutate the shared singleton", () => {
    expect(Object.isFrozen(INITIAL_DUST_STATE)).toBe(true);
  });
});

describe("tickDust (emission gating)", () => {
  it("emits nothing while surface is road, even at speed", () => {
    let state: DustState = INITIAL_DUST_STATE;
    for (let i = 0; i < 20; i += 1) {
      state = tickDust(state, {
        surface: "road",
        speed: FAST,
        dtMs: DT_MS,
        seed: 1,
      });
    }
    expect(state.particles.length).toBe(0);
  });

  it("emits nothing while surface is rumble", () => {
    let state: DustState = INITIAL_DUST_STATE;
    for (let i = 0; i < 20; i += 1) {
      state = tickDust(state, {
        surface: "rumble",
        speed: FAST,
        dtMs: DT_MS,
        seed: 1,
      });
    }
    expect(state.particles.length).toBe(0);
  });

  it("emits nothing on grass while speed <= threshold", () => {
    let state: DustState = INITIAL_DUST_STATE;
    for (let i = 0; i < 20; i += 1) {
      state = tickDust(state, {
        surface: "grass",
        speed: EMIT_SPEED_THRESHOLD_M_PER_S,
        dtMs: DT_MS,
        seed: 1,
      });
    }
    expect(state.particles.length).toBe(0);
  });

  it("emits one particle every EMIT_INTERVAL_TICKS ticks while grass + speed > threshold", () => {
    let state: DustState = INITIAL_DUST_STATE;
    // 10 ticks at the 1/2 cadence -> 5 particles, all alive (lifetime
    // 600 ms; 10 ticks is ~167 ms).
    for (let i = 0; i < 10; i += 1) {
      state = tickDust(state, {
        surface: "grass",
        speed: FAST,
        dtMs: DT_MS,
        seed: 1,
      });
    }
    expect(state.particles.length).toBe(10 / EMIT_INTERVAL_TICKS);
  });

  it("starts emitting on the very tick the surface flips road -> grass", () => {
    let state: DustState = INITIAL_DUST_STATE;
    // One road tick to bump tickIdx to 1 (no emit, parity wrong anyway).
    state = tickDust(state, {
      surface: "road",
      speed: FAST,
      dtMs: DT_MS,
      seed: 7,
    });
    expect(state.particles.length).toBe(0);
    // First grass tick: tickIdx becomes 2, parity matches, particle
    // emits immediately.
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: DT_MS,
      seed: 7,
    });
    expect(state.particles.length).toBe(1);
  });
});

describe("tickDust (pool cap)", () => {
  it("caps the pool at MAX_DUST and recycles oldest when over", () => {
    let state: DustState = INITIAL_DUST_STATE;
    // Each emission lands on an even tick; we need MAX_DUST emissions
    // before the cap triggers. Using a 0 ms dt keeps every spawned
    // particle alive forever so the cap test isn't confounded by
    // expiry.
    const spawnUntilFull = MAX_DUST * EMIT_INTERVAL_TICKS;
    for (let i = 0; i < spawnUntilFull; i += 1) {
      state = tickDust(state, {
        surface: "grass",
        speed: FAST,
        dtMs: 0,
        seed: 9,
        origin: { x: i, y: 0 },
      });
    }
    expect(state.particles.length).toBe(MAX_DUST);

    // Next two ticks land one more emission (the 65th). It must
    // overwrite slot 0 (the oldest) rather than grow the array.
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 9,
      origin: { x: 999, y: 0 },
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 9,
      origin: { x: 999, y: 0 },
    });
    expect(state.particles.length).toBe(MAX_DUST);
    const recycled = state.particles[0];
    expect(recycled?.x).toBe(999);
  });
});

describe("tickDust (lifetime)", () => {
  it("removes a particle at exactly its LIFETIME_MS mark", () => {
    let state: DustState = INITIAL_DUST_STATE;
    // Emit one particle on tick 2.
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 3,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 3,
    });
    expect(state.particles.length).toBe(1);

    // Advance the pool with road-surface ticks (no new emissions) so
    // the single particle ages cleanly. We need to land on >= 600 ms.
    // First step adds 599 ms (still alive).
    state = tickDust(state, {
      surface: "road",
      speed: 0,
      dtMs: 599,
      seed: 3,
    });
    expect(state.particles.length).toBe(1);

    // Next step adds 1 ms -> total 600 ms, particle is removed.
    state = tickDust(state, {
      surface: "road",
      speed: 0,
      dtMs: 1,
      seed: 3,
    });
    expect(state.particles.length).toBe(0);
  });

  it("dt = 0 leaves particle positions unchanged but advances tickIdx", () => {
    let state: DustState = INITIAL_DUST_STATE;
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 11,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 11,
      origin: { x: 100, y: 50 },
    });
    expect(state.particles.length).toBe(1);
    const before = state.particles[0]!;
    state = tickDust(state, {
      surface: "road",
      speed: 0,
      dtMs: 0,
      seed: 11,
    });
    const after = state.particles[0]!;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(state.tickIdx).toBe(3);
  });
});

describe("tickDust (determinism)", () => {
  it("produces identical particles across two identical runs", () => {
    function run(): DustState {
      let state: DustState = INITIAL_DUST_STATE;
      for (let i = 0; i < 30; i += 1) {
        state = tickDust(state, {
          surface: "grass",
          speed: FAST,
          dtMs: DT_MS,
          seed: 0xdeadbeef,
          origin: { x: i, y: i * 2 },
        });
      }
      return state;
    }
    const a = run();
    const b = run();
    expect(a.particles.length).toBe(b.particles.length);
    for (let i = 0; i < a.particles.length; i += 1) {
      expect(a.particles[i]).toEqual(b.particles[i]);
    }
  });

  it("different seeds diverge horizontal velocity", () => {
    let stateA: DustState = INITIAL_DUST_STATE;
    let stateB: DustState = INITIAL_DUST_STATE;
    for (let i = 0; i < 4; i += 1) {
      stateA = tickDust(stateA, {
        surface: "grass",
        speed: FAST,
        dtMs: DT_MS,
        seed: 1,
      });
      stateB = tickDust(stateB, {
        surface: "grass",
        speed: FAST,
        dtMs: DT_MS,
        seed: 9999,
      });
    }
    // Two emissions each. At least one velocity must differ across
    // seeds; equality across both pairs would imply the seed had no
    // effect.
    const sameVelocities = stateA.particles.every(
      (p, i) => p.vx === stateB.particles[i]?.vx,
    );
    expect(sameVelocities).toBe(false);
  });
});

describe("tickDust (purity)", () => {
  it("does not mutate the input state", () => {
    const before = JSON.stringify(INITIAL_DUST_STATE);
    tickDust(INITIAL_DUST_STATE, {
      surface: "grass",
      speed: FAST,
      dtMs: DT_MS,
      seed: 1,
    });
    expect(JSON.stringify(INITIAL_DUST_STATE)).toBe(before);
  });
});

describe("drawDust", () => {
  it("paints one arc per active particle with alpha decaying from 1", () => {
    let state: DustState = INITIAL_DUST_STATE;
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 5,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 5,
      origin: { x: 100, y: 200 },
    });
    const spy = makeSpy();
    drawDust(spy.ctx, state, VIEWPORT);
    expect(spy.calls.length).toBe(1);
    const call = spy.calls[0]!;
    expect(call.fillStyle).toBe(DEFAULT_DUST_COLOR);
    // Freshly emitted: alpha === 1 (remaining = 1 - 0 / LIFETIME_MS).
    expect(call.globalAlpha).toBeCloseTo(1, 6);
    // Radius starts at the cap at spawn.
    expect(call.r).toBeCloseTo(PARTICLE_RADIUS_PX, 6);
  });

  it("attenuates radius linearly toward 0 across lifetime", () => {
    let state: DustState = INITIAL_DUST_STATE;
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 6,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 6,
    });
    // Age the pool to half-life (300 ms) via a road tick (no new emit).
    state = tickDust(state, {
      surface: "road",
      speed: 0,
      dtMs: LIFETIME_MS / 2,
      seed: 6,
    });
    const spy = makeSpy();
    drawDust(spy.ctx, state, VIEWPORT);
    expect(spy.calls[0]?.r).toBeCloseTo(PARTICLE_RADIUS_PX * 0.5, 6);
    expect(spy.calls[0]?.globalAlpha).toBeCloseTo(0.5, 6);
  });

  it("renders nothing on a zero-area viewport", () => {
    let state: DustState = INITIAL_DUST_STATE;
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 8,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 8,
    });
    const spy = makeSpy();
    drawDust(spy.ctx, state, { width: 0, height: 0 });
    expect(spy.calls.length).toBe(0);
  });

  it("restores globalAlpha after painting", () => {
    let state: DustState = INITIAL_DUST_STATE;
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 4,
    });
    state = tickDust(state, {
      surface: "grass",
      speed: FAST,
      dtMs: 0,
      seed: 4,
    });
    const spy = makeSpy();
    spy.ctx.globalAlpha = 0.42;
    drawDust(spy.ctx, state, VIEWPORT);
    expect(spy.ctx.globalAlpha).toBeCloseTo(0.42, 6);
  });
});
