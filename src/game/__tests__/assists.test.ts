/**
 * Unit tests for the §19 accessibility assists pure module.
 *
 * Each assist gets dedicated coverage of the on / off paths, the
 * cross-effects called out in the dot's edge cases, and the global
 * idempotency contract that `applyAssists` is convergent under
 * repeated application against fixed inputs.
 */

import { describe, expect, it } from "vitest";

import {
  ASSIST_BADGE_LABELS,
  BRAKE_ASSIST_BOOST,
  BRAKE_ASSIST_MIN_CURVATURE,
  BRAKE_ASSIST_MIN_SPEED_MPS,
  INITIAL_ASSIST_MEMORY,
  STEERING_SMOOTHING_TAU_SECONDS,
  applyAssists,
  applyAutoAccelerate,
  applyBrakeAssist,
  applyReducedSimultaneousInput,
  applySteeringSmoothing,
  applyToggleNitro,
  resolveAssists,
  type AssistContext,
  type AssistSettingsRuntime,
} from "@/game/assists";
import { NEUTRAL_INPUT, type Input } from "@/game/input";

function input(overrides: Partial<Input> = {}): Input {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function ctx(overrides: Partial<AssistContext> = {}): AssistContext {
  return {
    speedMps: 0,
    surface: "road",
    weather: "clear",
    upcomingCurvature: 0,
    dt: 1 / 60,
    ...overrides,
  };
}

const ALL_OFF: AssistSettingsRuntime = {};
const ALL_ON: AssistSettingsRuntime = {
  autoAccelerate: true,
  brakeAssist: true,
  steeringSmoothing: true,
  nitroToggleMode: true,
  reducedSimultaneousInput: true,
  weatherVisualReduction: true,
};

describe("resolveAssists", () => {
  it("treats undefined fields as false", () => {
    expect(resolveAssists({})).toEqual({
      autoAccelerate: false,
      brakeAssist: false,
      steeringSmoothing: false,
      nitroToggleMode: false,
      reducedSimultaneousInput: false,
      weatherVisualReduction: false,
    });
  });

  it("passes through booleans verbatim", () => {
    const all: AssistSettingsRuntime = {
      autoAccelerate: true,
      brakeAssist: false,
      steeringSmoothing: true,
      nitroToggleMode: false,
      reducedSimultaneousInput: true,
      weatherVisualReduction: false,
    };
    expect(resolveAssists(all)).toEqual(all);
  });
});

describe("applyAutoAccelerate", () => {
  it("pins throttle to 1 with no brake (off)", () => {
    expect(applyAutoAccelerate(input()).throttle).toBe(1);
  });

  it("does not override an active brake (brake wins)", () => {
    const got = applyAutoAccelerate(input({ brake: 1 }));
    expect(got.brake).toBe(1);
    expect(got.throttle).toBe(0);
  });

  it("is a no-op when throttle is already 1", () => {
    const src = input({ throttle: 1 });
    expect(applyAutoAccelerate(src)).toBe(src);
  });
});

describe("applyBrakeAssist", () => {
  it("does nothing when brake is not held", () => {
    const src = input({ brake: 0 });
    const got = applyBrakeAssist(src, { speedMps: 100, upcomingCurvature: 0.8 });
    expect(got).toBe(src);
  });

  it("does nothing below the speed threshold", () => {
    const src = input({ brake: 0.5 });
    const got = applyBrakeAssist(src, {
      speedMps: BRAKE_ASSIST_MIN_SPEED_MPS - 1,
      upcomingCurvature: 0.8,
    });
    expect(got.brake).toBe(0.5);
  });

  it("does nothing below the curvature threshold", () => {
    const src = input({ brake: 0.5 });
    const got = applyBrakeAssist(src, {
      speedMps: 80,
      upcomingCurvature: BRAKE_ASSIST_MIN_CURVATURE - 0.05,
    });
    expect(got.brake).toBe(0.5);
  });

  it("scales brake by the boost when both gates are passed", () => {
    const src = input({ brake: 0.5 });
    const got = applyBrakeAssist(src, {
      speedMps: 80,
      upcomingCurvature: 0.6,
    });
    expect(got.brake).toBeCloseTo(0.5 * BRAKE_ASSIST_BOOST, 6);
  });

  it("clamps the boosted brake at 1", () => {
    const src = input({ brake: 0.9 });
    const got = applyBrakeAssist(src, {
      speedMps: 100,
      upcomingCurvature: 0.8,
    });
    expect(got.brake).toBe(1);
  });

  it("triggers on negative curvature too (left turns)", () => {
    const got = applyBrakeAssist(input({ brake: 0.4 }), {
      speedMps: 80,
      upcomingCurvature: -0.6,
    });
    expect(got.brake).toBeGreaterThan(0.4);
  });
});

describe("applySteeringSmoothing", () => {
  it("returns the input unchanged when steer matches the prior smoothed value", () => {
    const src = input({ steer: 0 });
    const got = applySteeringSmoothing(src, 0, 1 / 60);
    expect(got.input).toBe(src);
    expect(got.smoothed).toBe(0);
  });

  it("blends toward the new steer value at the configured tau", () => {
    const dt = 1 / 60;
    const out = applySteeringSmoothing(input({ steer: 1 }), 0, dt);
    const alpha = dt / (STEERING_SMOOTHING_TAU_SECONDS + dt);
    expect(out.smoothed).toBeCloseTo(alpha, 6);
  });

  it("converges to the input under sustained pressure", () => {
    let smoothed = 0;
    const target = 1;
    for (let i = 0; i < 240; i++) {
      const out = applySteeringSmoothing(input({ steer: target }), smoothed, 1 / 60);
      smoothed = out.smoothed;
    }
    // 240 ticks at 60 Hz is 4 seconds, which is many tau; should be at 1.
    expect(smoothed).toBeCloseTo(target, 3);
  });

  it("snaps to zero once the residual falls below threshold", () => {
    const smoothed = 0.001;
    const out = applySteeringSmoothing(input({ steer: 0 }), smoothed, 1 / 60);
    expect(out.smoothed).toBe(0);
  });

  it("leaves state untouched on a non-positive dt", () => {
    const out = applySteeringSmoothing(input({ steer: 1 }), 0.5, 0);
    expect(out.smoothed).toBe(0.5);
  });
});

describe("applyToggleNitro", () => {
  it("flips the latch on a rising edge of nitro", () => {
    const out = applyToggleNitro(input({ nitro: true }), false, false);
    expect(out.toggleActive).toBe(true);
    expect(out.input.nitro).toBe(true);
  });

  it("does not flip while nitro stays held", () => {
    const out = applyToggleNitro(input({ nitro: true }), true, true);
    expect(out.toggleActive).toBe(true);
    expect(out.input.nitro).toBe(true);
  });

  it("turns off on a second tap (rising edge from a release)", () => {
    // Tick 1: tap rises, latch on.
    const t1 = applyToggleNitro(input({ nitro: true }), false, false);
    // Tick 2: release, latch stays on.
    const t2 = applyToggleNitro(input({ nitro: false }), t1.toggleActive, t1.nitroPressed);
    expect(t2.toggleActive).toBe(true);
    expect(t2.input.nitro).toBe(true);
    // Tick 3: re-tap, latch flips off.
    const t3 = applyToggleNitro(input({ nitro: true }), t2.toggleActive, t2.nitroPressed);
    expect(t3.toggleActive).toBe(false);
    expect(t3.input.nitro).toBe(false);
  });
});

describe("applyReducedSimultaneousInput", () => {
  it("returns 'none' on a neutral input", () => {
    const got = applyReducedSimultaneousInput(input());
    expect(got.winner).toBe("none");
    expect(got.input).toEqual(NEUTRAL_INPUT);
  });

  it("picks steer-left as highest priority when held alongside throttle", () => {
    const got = applyReducedSimultaneousInput(
      input({ steer: -1, throttle: 1, nitro: true }),
    );
    expect(got.winner).toBe("steer-left");
    expect(got.input.steer).toBe(-1);
    expect(got.input.throttle).toBe(0);
    expect(got.input.nitro).toBe(false);
  });

  it("picks brake before throttle", () => {
    const got = applyReducedSimultaneousInput(
      input({ brake: 1, throttle: 1 }),
    );
    expect(got.winner).toBe("brake");
    expect(got.input.brake).toBe(1);
    expect(got.input.throttle).toBe(0);
  });

  it("preserves pause and shift inputs through the filter", () => {
    const got = applyReducedSimultaneousInput(
      input({ throttle: 1, pause: true, shiftUp: true }),
    );
    expect(got.input.pause).toBe(true);
    expect(got.input.shiftUp).toBe(true);
    expect(got.input.throttle).toBe(1);
  });
});

describe("applyAssists composition", () => {
  it("returns input unchanged with no assists active", () => {
    const src = input({ steer: 0.5, throttle: 1, brake: 0 });
    const got = applyAssists(src, ALL_OFF, ctx());
    expect(got.input).toEqual(src);
    expect(got.badge.active).toBe(false);
    expect(got.badge.count).toBe(0);
    expect(got.weatherVisualReductionActive).toBe(false);
  });

  it("auto-accelerate alone forces throttle to 1", () => {
    const got = applyAssists(input(), { autoAccelerate: true }, ctx());
    expect(got.input.throttle).toBe(1);
    expect(got.badge.primary).toBe("auto-accelerate");
  });

  it("brake-assist scales brake when curvature and speed gates pass", () => {
    const got = applyAssists(
      input({ brake: 0.5 }),
      { brakeAssist: true },
      ctx({ speedMps: 80, upcomingCurvature: 0.7 }),
    );
    expect(got.input.brake).toBeGreaterThan(0.5);
  });

  it("steering-smoothing threads memory across calls", () => {
    let memory = INITIAL_ASSIST_MEMORY;
    let last = 0;
    for (let i = 0; i < 30; i++) {
      const out = applyAssists(
        input({ steer: 1 }),
        { steeringSmoothing: true },
        ctx(),
        memory,
      );
      memory = out.memory;
      last = out.input.steer;
    }
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(1);
  });

  it("toggle-nitro flips on a tap and stays through the release", () => {
    let memory = INITIAL_ASSIST_MEMORY;
    const t1 = applyAssists(
      input({ nitro: true }),
      { nitroToggleMode: true },
      ctx(),
      memory,
    );
    expect(t1.input.nitro).toBe(true);
    expect(t1.memory.nitroToggleActive).toBe(true);

    memory = t1.memory;
    const t2 = applyAssists(
      input({ nitro: false }),
      { nitroToggleMode: true },
      ctx(),
      memory,
    );
    expect(t2.input.nitro).toBe(true);
    expect(t2.memory.nitroToggleActive).toBe(true);
  });

  it("reduced-input runs after auto-accelerate so throttle wins over no-input", () => {
    const got = applyAssists(
      input(),
      { autoAccelerate: true, reducedSimultaneousInput: true },
      ctx(),
    );
    expect(got.input.throttle).toBe(1);
    // No higher-priority action is held, so throttle propagates.
    expect(got.memory.reducedInputLastWinner).toBe("throttle");
  });

  it("reduced-input + brake held wins over auto-accelerate's throttle", () => {
    const got = applyAssists(
      input({ brake: 1 }),
      { autoAccelerate: true, reducedSimultaneousInput: true },
      ctx(),
    );
    expect(got.input.brake).toBe(1);
    expect(got.input.throttle).toBe(0);
    expect(got.memory.reducedInputLastWinner).toBe("brake");
  });

  it("visual-only weather surfaces the flag without rewriting input", () => {
    const src = input({ steer: 0.5, throttle: 0.7 });
    const got = applyAssists(src, { weatherVisualReduction: true }, ctx());
    expect(got.input.steer).toBe(0.5);
    expect(got.input.throttle).toBe(0.7);
    expect(got.weatherVisualReductionActive).toBe(true);
  });

  it("badge surfaces the count and primary label deterministically", () => {
    const got = applyAssists(
      input(),
      { autoAccelerate: true, brakeAssist: true, weatherVisualReduction: true },
      ctx(),
    );
    expect(got.badge.count).toBe(3);
    expect(got.badge.primary).toBe("auto-accelerate");
    expect(got.badge.active_labels).toEqual([
      "auto-accelerate",
      "brake-assist",
      "visual-weather",
    ]);
  });

  it("is idempotent: applying the result back through the pipeline converges", () => {
    const src = input({ steer: 0.4, brake: 0.6 });
    const c = ctx({ speedMps: 80, upcomingCurvature: 0.7, dt: 1 / 60 });
    const first = applyAssists(src, ALL_ON, c, INITIAL_ASSIST_MEMORY);
    const second = applyAssists(first.input, ALL_ON, c, first.memory);
    expect(second.input).toEqual(first.input);
    expect(second.weatherVisualReductionActive).toBe(
      first.weatherVisualReductionActive,
    );
    expect(second.badge.active_labels).toEqual(first.badge.active_labels);
  });

  it("is deterministic: repeated runs from identical inputs produce equal output", () => {
    const c = ctx({ speedMps: 90, upcomingCurvature: 0.7, dt: 1 / 60 });
    let a = INITIAL_ASSIST_MEMORY;
    let b = INITIAL_ASSIST_MEMORY;
    for (let i = 0; i < 20; i++) {
      const inp = input({ steer: 0.3 + 0.01 * (i % 5), brake: i % 3 === 0 ? 0.5 : 0, nitro: i === 5 });
      const stepA = applyAssists(inp, ALL_ON, c, a);
      const stepB = applyAssists(inp, ALL_ON, c, b);
      expect(stepA.input).toEqual(stepB.input);
      expect(stepA.memory).toEqual(stepB.memory);
      a = stepA.memory;
      b = stepB.memory;
    }
  });

  it("never mutates the input snapshot", () => {
    const src = input({ throttle: 0.3, brake: 0.5, steer: 0.2 });
    const before = JSON.stringify(src);
    applyAssists(src, ALL_ON, ctx({ speedMps: 80, upcomingCurvature: 0.7 }));
    expect(JSON.stringify(src)).toBe(before);
  });

  it("never mutates the memory snapshot", () => {
    const src = input({ nitro: true });
    const memory = { ...INITIAL_ASSIST_MEMORY };
    const before = JSON.stringify(memory);
    applyAssists(src, ALL_ON, ctx(), memory);
    expect(JSON.stringify(memory)).toBe(before);
  });
});

describe("ASSIST_BADGE_LABELS", () => {
  it("ships a label for every badge identifier", () => {
    const labels = Object.values(ASSIST_BADGE_LABELS);
    expect(labels.length).toBe(6);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/[–—]/u);
    }
  });
});
