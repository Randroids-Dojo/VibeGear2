/**
 * Vitest suite for the speed- and brake-coupled camera smoother.
 *
 * Pins the contract from
 * `.dots/VibeGear2-implement-speed-coupled-3cc0838f.md`:
 * - fovDelta(0) === 0; fovDelta(1) ~ 6 at steady state.
 * - heightDelta(brake = 1) ~ -0.18 at steady state.
 * - 6 Hz low-pass: a step input is within 5 percent of the target after
 *   3 tau (~0.5 s).
 * - Reduced-motion gate holds both deltas at 0 regardless of input.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  cameraOverridesFor,
  INITIAL_CAMERA_SMOOTHING_STATE,
  MAX_BRAKE_DIP_METERS,
  MAX_FOV_WIDEN_DEG,
  SMOOTHING_TAU_SEC,
  tickCameraSmoothing,
} from "@/app/race/cameraSmoothing";
import { refreshReducedMotionPreference } from "@/render/vfx";

const TOP_SPEED = 60;

afterEach(() => {
  // Reset reduced-motion cache between cases so a test that flips
  // matchMedia does not leak the override.
  delete (globalThis as { window?: unknown }).window;
  refreshReducedMotionPreference();
});

function steady(
  input: { speed: number; topSpeed: number; brake: number },
  ticks = 200,
  dtMs = 16,
) {
  let state = INITIAL_CAMERA_SMOOTHING_STATE;
  for (let i = 0; i < ticks; i += 1) {
    state = tickCameraSmoothing(state, input, dtMs);
  }
  return state;
}

describe("tickCameraSmoothing", () => {
  it("is a no-op at zero speed and zero brake", () => {
    const next = tickCameraSmoothing(
      INITIAL_CAMERA_SMOOTHING_STATE,
      { speed: 0, topSpeed: TOP_SPEED, brake: 0 },
      16,
    );
    expect(next).toBe(INITIAL_CAMERA_SMOOTHING_STATE);
  });

  it("steady-state fovDelta at top speed approaches MAX_FOV_WIDEN_DEG", () => {
    const out = steady({ speed: TOP_SPEED, topSpeed: TOP_SPEED, brake: 0 });
    expect(out.fovDelta).toBeCloseTo(MAX_FOV_WIDEN_DEG, 3);
    expect(out.heightDelta).toBe(0);
  });

  it("steady-state fovDelta at half speed approaches MAX/2", () => {
    const out = steady({
      speed: TOP_SPEED * 0.5,
      topSpeed: TOP_SPEED,
      brake: 0,
    });
    expect(out.fovDelta).toBeCloseTo(MAX_FOV_WIDEN_DEG * 0.5, 3);
  });

  it("steady-state heightDelta at full brake approaches -MAX_BRAKE_DIP_METERS", () => {
    const out = steady({ speed: 0, topSpeed: TOP_SPEED, brake: 1 });
    expect(out.heightDelta).toBeCloseTo(-MAX_BRAKE_DIP_METERS, 4);
  });

  it("clamps speed/topSpeed beyond 1 (boost cases) to MAX widen", () => {
    const out = steady({
      speed: TOP_SPEED * 1.5,
      topSpeed: TOP_SPEED,
      brake: 0,
    });
    expect(out.fovDelta).toBeCloseTo(MAX_FOV_WIDEN_DEG, 3);
  });

  it("hits ~95 percent of a step input within 3 tau", () => {
    const dtMs = 16;
    const ticks = Math.ceil((SMOOTHING_TAU_SEC * 3 * 1000) / dtMs);
    let state = INITIAL_CAMERA_SMOOTHING_STATE;
    for (let i = 0; i < ticks; i += 1) {
      state = tickCameraSmoothing(
        state,
        { speed: TOP_SPEED, topSpeed: TOP_SPEED, brake: 0 },
        dtMs,
      );
    }
    expect(state.fovDelta).toBeGreaterThan(MAX_FOV_WIDEN_DEG * 0.94);
    expect(state.fovDelta).toBeLessThan(MAX_FOV_WIDEN_DEG);
  });

  it("returns the input state when no smoothing change is observable", () => {
    let state = INITIAL_CAMERA_SMOOTHING_STATE;
    state = tickCameraSmoothing(
      state,
      { speed: 0, topSpeed: TOP_SPEED, brake: 0 },
      16,
    );
    state = tickCameraSmoothing(
      state,
      { speed: 0, topSpeed: TOP_SPEED, brake: 0 },
      16,
    );
    expect(state).toBe(INITIAL_CAMERA_SMOOTHING_STATE);
  });

  it("holds FOV and height at authored defaults under reduced-motion", () => {
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
    const out = tickCameraSmoothing(
      INITIAL_CAMERA_SMOOTHING_STATE,
      { speed: TOP_SPEED, topSpeed: TOP_SPEED, brake: 1 },
      16,
    );
    expect(out.fovDelta).toBe(0);
    expect(out.heightDelta).toBe(0);
  });

  it("snaps back to defaults when reduced-motion turns on after motion was active", () => {
    let state: ReturnType<typeof tickCameraSmoothing> = {
      fovDelta: 5,
      heightDelta: -0.1,
    };
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
    state = tickCameraSmoothing(
      state,
      { speed: TOP_SPEED, topSpeed: TOP_SPEED, brake: 1 },
      16,
    );
    expect(state.fovDelta).toBe(0);
    expect(state.heightDelta).toBe(0);
  });
});

describe("cameraOverridesFor", () => {
  it("at zero deltas returns the geometric defaults (FOV 100, h 1.5)", () => {
    const out = cameraOverridesFor(INITIAL_CAMERA_SMOOTHING_STATE, 100, 1.5);
    const expectedDepth = 1 / Math.tan((100 / 2) * (Math.PI / 180));
    expect(out.depth).toBeCloseTo(expectedDepth, 6);
    expect(out.y).toBe(1.5);
  });

  it("widens the FOV which lowers cameraDepth at top speed", () => {
    const out = cameraOverridesFor(
      { fovDelta: MAX_FOV_WIDEN_DEG, heightDelta: 0 },
      100,
      1.5,
    );
    const expected = 1 / Math.tan(((100 + MAX_FOV_WIDEN_DEG) / 2) * (Math.PI / 180));
    expect(out.depth).toBeCloseTo(expected, 6);
    expect(out.depth).toBeLessThan(
      1 / Math.tan((100 / 2) * (Math.PI / 180)),
    );
  });

  it("dips height under brake", () => {
    const out = cameraOverridesFor(
      { fovDelta: 0, heightDelta: -MAX_BRAKE_DIP_METERS },
      100,
      1.5,
    );
    expect(out.y).toBeCloseTo(1.5 - MAX_BRAKE_DIP_METERS, 6);
  });
});
