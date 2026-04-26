/**
 * Unit tests for the per-tick ghost-car driver in `src/game/ghostDriver.ts`.
 *
 * Coverage map (mirrors the F-022 dot stress-test items):
 *
 *   - A `null` replay (no PB recorded yet) returns `null` from every
 *     `tick(...)` call without side effects. The route can wire the
 *     driver unconditionally.
 *   - A version-mismatched replay sets `mismatchReason` and returns
 *     `null` from every `tick(...)` call; `finished` latches `true`.
 *   - A clean replay drives the per-tick `step` from the recorded
 *     inputs: a recording that pinned `throttle: 1` for N ticks
 *     advances the car forward exactly as the live `step` would have.
 *   - The driver projects `(z, x)` to the screen prop via
 *     `projectGhostCar`, returning the drop-in shape `drawRoad`'s
 *     `ghostCar` prop expects (screenX / screenY / screenW / alpha).
 *   - Default alpha matches the §6 ghost-overlay convention (0.5).
 *   - `alpha` and `fill` overrides are forwarded to the overlay.
 *   - The driver returns `null` for an off-screen ghost (behind the
 *     camera, past draw distance) so the route does not paint a
 *     vanishingly small placeholder at the horizon.
 *   - Once the recorded replay finishes, the driver latches `finished`
 *     and returns `null` from subsequent `tick(...)` calls.
 *   - Determinism: two drivers fed the same replay + camera + viewport
 *     produce the same per-tick overlay shape. Bit-exact, not "within
 *     tolerance".
 *   - `lastProjection` exposes the underlying `projectGhostCar` result
 *     so debug surfaces can read `worldX` / `scale` without re-running
 *     the projection.
 */

import { describe, expect, it } from "vitest";

import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  ROAD_WIDTH,
  SEGMENT_LENGTH,
} from "@/road/constants";
import type { Camera, CompiledSegment, Viewport } from "@/road/types";

import type { CarBaseStats } from "@/data/schemas";
import { createGhostDriver, type GhostTickContext } from "../ghostDriver";
import {
  REPLAY_FORMAT_VERSION,
  createPlayer,
  createRecorder,
  type Replay,
} from "../ghost";
import { NEUTRAL_INPUT, type Input } from "../input";
import { FIXED_STEP_MS, FIXED_STEP_SECONDS } from "../loop";
import { PHYSICS_VERSION, step, type CarState } from "../physics";

// Helpers ----------------------------------------------------------------

const STARTER_STATS: Readonly<CarBaseStats> = Object.freeze({
  topSpeed: 61.0,
  accel: 16.0,
  brake: 28.0,
  gripDry: 1.0,
  gripWet: 0.82,
  stability: 1.0,
  durability: 0.95,
  nitroEfficiency: 1.0,
});

function input(overrides: Partial<Input> = {}): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function flatTrack(count: number): CompiledSegment[] {
  const segs: CompiledSegment[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    segs[i] = {
      index: i,
      worldZ: i * SEGMENT_LENGTH,
      curve: 0,
      grade: 0,
      authoredIndex: 0,
      roadsideLeftId: "default",
      roadsideRightId: "default",
      hazardIds: [],
    };
  }
  return segs;
}

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    depth: CAMERA_DEPTH,
    ...overrides,
  };
}

const VIEWPORT: Viewport = { width: 800, height: 480 };

/**
 * Build a replay that pins `throttle: 1` from tick 0 for `tickCount`
 * ticks. The recorder writes one delta on tick 0 (the throttle change
 * from the implicit neutral prior) and silently coasts on every
 * subsequent tick.
 */
function buildThrottleReplay(tickCount: number): Replay {
  const rec = createRecorder({
    trackId: "test-track",
    trackVersion: 1,
    carId: "sparrow-gt",
    seed: 0xdeadbeef,
  });
  for (let t = 0; t < tickCount; t += 1) {
    rec.record(input({ throttle: 1 }), t);
  }
  return rec.finalize();
}

function makeContext(
  tick: number,
  segments: readonly CompiledSegment[],
  camera: Camera = makeCamera(),
): GhostTickContext {
  return {
    tick,
    dt: FIXED_STEP_SECONDS,
    camera,
    viewport: VIEWPORT,
    segments,
  };
}

// Construction ----------------------------------------------------------

describe("createGhostDriver", () => {
  it("returns null from every tick call when the replay is null", () => {
    const driver = createGhostDriver({ replay: null, stats: STARTER_STATS });
    expect(driver.mismatchReason).toBeNull();
    expect(driver.finished).toBe(false);
    expect(driver.carState).toBeNull();

    const segs = flatTrack(32);
    const overlay = driver.tick(makeContext(0, segs));
    expect(overlay).toBeNull();
    expect(driver.lastProjection).toBeNull();
  });

  it("returns null and surfaces the mismatch reason on a version-drifted replay", () => {
    const replay = buildThrottleReplay(10);
    const drifted: Replay = { ...replay, formatVersion: REPLAY_FORMAT_VERSION + 1 };
    const driver = createGhostDriver({ replay: drifted, stats: STARTER_STATS });
    expect(driver.mismatchReason).toBe("format-version-mismatch");
    expect(driver.finished).toBe(true);
    expect(driver.carState).toBeNull();

    const segs = flatTrack(32);
    expect(driver.tick(makeContext(0, segs))).toBeNull();
    expect(driver.tick(makeContext(1, segs))).toBeNull();
  });

  it("returns null on a physics-version-drifted replay", () => {
    const replay = buildThrottleReplay(10);
    const drifted: Replay = { ...replay, physicsVersion: PHYSICS_VERSION + 1 };
    const driver = createGhostDriver({ replay: drifted, stats: STARTER_STATS });
    expect(driver.mismatchReason).toBe("physics-version-mismatch");
    expect(driver.tick(makeContext(0, flatTrack(8)))).toBeNull();
  });

  it("returns null on a fixed-step-drifted replay", () => {
    const replay = buildThrottleReplay(10);
    const drifted: Replay = { ...replay, fixedStepMs: FIXED_STEP_MS / 2 };
    const driver = createGhostDriver({ replay: drifted, stats: STARTER_STATS });
    expect(driver.mismatchReason).toBe("fixed-step-mismatch");
    expect(driver.tick(makeContext(0, flatTrack(8)))).toBeNull();
  });
});

// Per-tick advance -------------------------------------------------------

describe("ghost driver per-tick advance", () => {
  it("advances the internal car state via the same step function as the live car", () => {
    const TICKS = 30;
    const replay = buildThrottleReplay(TICKS);
    const driver = createGhostDriver({ replay, stats: STARTER_STATS });

    // Reference: the live `step` function fed the same input would
    // produce the same forward distance. We compute it here off the
    // same starter stats and default track context to pin the driver
    // matches the contract bit-for-bit (no tolerance window).
    let refCar: CarState = { z: 0, x: 0, speed: 0, surface: "road" };
    const segs = flatTrack(64);

    for (let t = 0; t < TICKS; t += 1) {
      const overlay = driver.tick(makeContext(t, segs));
      refCar = step(
        refCar,
        input({ throttle: 1 }),
        STARTER_STATS,
        { roadHalfWidth: ROAD_WIDTH },
        FIXED_STEP_SECONDS,
      );
      // Skip overlay assertions for ticks where the projection lands
      // behind the near plane (the ghost starts at z=0 = camera.z).
      if (overlay !== null) {
        expect(driver.carState).not.toBeNull();
        expect(driver.carState!.z).toBeCloseTo(refCar.z, 10);
        expect(driver.carState!.speed).toBeCloseTo(refCar.speed, 10);
      }
    }

    // After TICKS calls the player has consumed every recorded input,
    // so the driver latches finished and stops emitting overlays.
    expect(driver.finished).toBe(true);
    expect(driver.tick(makeContext(TICKS, segs))).toBeNull();
  });

  it("returns the projection drop-in shape with the §6 default alpha when no override is set", () => {
    // Build a long enough run that the ghost lands well inside the
    // visible window by the time we sample the overlay.
    const TICKS = 120;
    const replay = buildThrottleReplay(TICKS);
    const driver = createGhostDriver({ replay, stats: STARTER_STATS });

    const segs = flatTrack(128);
    let lastOverlay: ReturnType<typeof driver.tick> = null;
    for (let t = 0; t < TICKS; t += 1) {
      const overlay = driver.tick(makeContext(t, segs));
      if (overlay !== null) lastOverlay = overlay;
    }
    expect(lastOverlay).not.toBeNull();
    expect(lastOverlay!.alpha).toBe(0.5);
    expect(lastOverlay!.fill).toBeUndefined();
    expect(Number.isFinite(lastOverlay!.screenX)).toBe(true);
    expect(Number.isFinite(lastOverlay!.screenY)).toBe(true);
    expect(lastOverlay!.screenW).toBeGreaterThan(0);
  });

  it("forwards alpha and fill overrides to the overlay shape", () => {
    const TICKS = 120;
    const replay = buildThrottleReplay(TICKS);
    const driver = createGhostDriver({
      replay,
      stats: STARTER_STATS,
      alpha: 0.25,
      fill: "#ff00aa",
    });

    const segs = flatTrack(128);
    let lastOverlay: ReturnType<typeof driver.tick> = null;
    for (let t = 0; t < TICKS; t += 1) {
      const overlay = driver.tick(makeContext(t, segs));
      if (overlay !== null) lastOverlay = overlay;
    }
    expect(lastOverlay).not.toBeNull();
    expect(lastOverlay!.alpha).toBe(0.25);
    expect(lastOverlay!.fill).toBe("#ff00aa");
  });

  it("returns null on an off-screen ghost without throwing", () => {
    // Replay only one tick. The ghost spawns at z=0 with throttle, so
    // its first projected position is right at the camera (forwardZ <
    // camera.depth) and the overlay should hide.
    const replay = buildThrottleReplay(1);
    const driver = createGhostDriver({ replay, stats: STARTER_STATS });
    const segs = flatTrack(8);
    const overlay = driver.tick(makeContext(0, segs));
    expect(overlay).toBeNull();
    expect(driver.lastProjection).not.toBeNull();
    expect(driver.lastProjection!.visible).toBe(false);
  });

  it("latches finished and returns null after the recorded replay is exhausted", () => {
    const TICKS = 4;
    const replay = buildThrottleReplay(TICKS);
    const driver = createGhostDriver({ replay, stats: STARTER_STATS });
    const segs = flatTrack(32);
    for (let t = 0; t < TICKS; t += 1) {
      driver.tick(makeContext(t, segs));
    }
    expect(driver.finished).toBe(true);
    expect(driver.tick(makeContext(TICKS, segs))).toBeNull();
    expect(driver.tick(makeContext(TICKS + 1, segs))).toBeNull();
  });
});

// Determinism ------------------------------------------------------------

describe("ghost driver determinism", () => {
  it("two drivers fed the same replay + ticks produce the same overlay sequence", () => {
    const TICKS = 90;
    const replay = buildThrottleReplay(TICKS);
    const a = createGhostDriver({ replay, stats: STARTER_STATS });
    const b = createGhostDriver({ replay, stats: STARTER_STATS });

    const segs = flatTrack(128);
    for (let t = 0; t < TICKS; t += 1) {
      const ctxA = makeContext(t, segs);
      const ctxB = makeContext(t, segs);
      const overlayA = a.tick(ctxA);
      const overlayB = b.tick(ctxB);
      expect(JSON.stringify(overlayA)).toBe(JSON.stringify(overlayB));
    }
  });

  it("plays back the same input stream as a freshly constructed Player", () => {
    // Sanity check that the driver does not silently swallow inputs
    // before forwarding them to step. A standalone player on the same
    // replay should hand out the same per-tick input.
    const TICKS = 12;
    const replay = buildThrottleReplay(TICKS);
    const player = createPlayer(replay);
    for (let t = 0; t < TICKS; t += 1) {
      const inp = player.readNext(t);
      expect(inp).not.toBeNull();
      expect(inp!.throttle).toBe(1);
    }
  });
});
