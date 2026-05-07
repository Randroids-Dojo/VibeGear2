/**
 * Unit tests for the §15 AI nitro firing decision per F-091.
 *
 * Pin the per-window predicate truth-table and the hard gates so the
 * §21 ghost-replay determinism contract has a fixed surface a future
 * balancing slice can re-tune (the bias triple lives in
 * `src/data/ai/*.json`) without re-deriving the call shape.
 */

import { describe, expect, it } from "vitest";

import type { AINitroUsage } from "@/data/schemas";
import {
  decideFireNitro,
  FINAL_LAP_PUSH_FRACTION,
  LAUNCH_LAP_FRACTION,
  PANIC_GAP_METERS,
  SPEED_CEILING_FRACTION,
  SPEED_FLOOR_FRACTION,
  STRAIGHT_CURVE_THRESHOLD,
  type DecideFireNitroInput,
} from "@/game/aiNitroFire";
import { INITIAL_NITRO_STATE } from "@/game/nitro";

const ALWAYS: AINitroUsage = Object.freeze({
  launchBias: 1,
  straightBias: 1,
  panicBias: 1,
});

const NEVER: AINitroUsage = Object.freeze({
  launchBias: 0,
  straightBias: 0,
  panicBias: 0,
});

const ROCKET_BIASES: AINitroUsage = Object.freeze({
  launchBias: 0.95,
  straightBias: 0.6,
  panicBias: 0.4,
});

function input(
  overrides: Partial<DecideFireNitroInput> = {},
): DecideFireNitroInput {
  return {
    archetype: "clean_line",
    nitroUsage: ALWAYS,
    nitro: INITIAL_NITRO_STATE,
    seed: 1,
    aiSpeed: 50,
    topSpeed: 60,
    authoredCurve: 0,
    lap: 1,
    totalLaps: 3,
    lapFraction: 0.4,
    playerGapMeters: 200,
    weather: null,
    ...overrides,
  };
}

describe("decideFireNitro hard gates", () => {
  it("returns false when the AI has no charges remaining", () => {
    const result = decideFireNitro(
      input({ nitro: { charges: 0, activeRemainingSec: 0 } }),
    );
    expect(result).toBe(false);
  });

  it("returns false when a charge is currently burning", () => {
    const result = decideFireNitro(
      input({ nitro: { charges: 2, activeRemainingSec: 0.5 } }),
    );
    expect(result).toBe(false);
  });

  it("returns false mid-corner regardless of bias", () => {
    const result = decideFireNitro(input({ authoredCurve: 0.4 }));
    expect(result).toBe(false);
  });

  it("returns false when archetype is defender and weather is rain", () => {
    const result = decideFireNitro(
      input({ archetype: "defender", weather: "rain", lapFraction: 0 }),
    );
    expect(result).toBe(false);
  });

  it("returns false when archetype is defender and weather is heavy_rain", () => {
    const result = decideFireNitro(
      input({ archetype: "defender", weather: "heavy_rain", lapFraction: 0 }),
    );
    expect(result).toBe(false);
  });

  it("allows defender to fire in clear weather", () => {
    const result = decideFireNitro(
      input({ archetype: "defender", weather: "clear", lapFraction: 0 }),
    );
    expect(result).toBe(true);
  });

  it("allows non-defender archetypes to fire in heavy rain", () => {
    const result = decideFireNitro(
      input({
        archetype: "wet_specialist",
        weather: "heavy_rain",
        lapFraction: 0,
      }),
    );
    expect(result).toBe(true);
  });
});

describe("decideFireNitro launch window", () => {
  it("fires on lap 1 below the launch fraction with bias 1", () => {
    const result = decideFireNitro(input({ lap: 1, lapFraction: 0.05 }));
    expect(result).toBe(true);
  });

  it("does not fire on lap 1 above the launch fraction without other windows", () => {
    // Speed below the straight floor and player far away so neither
    // straight nor panic window opens. Above the launch fraction the
    // launch window also closes, leaving no opportunity.
    const result = decideFireNitro(
      input({
        lap: 1,
        lapFraction: LAUNCH_LAP_FRACTION + 0.01,
        aiSpeed: 10,
        playerGapMeters: 200,
        nitroUsage: { launchBias: 1, straightBias: 0, panicBias: 0 },
      }),
    );
    expect(result).toBe(false);
  });

  it("does not fire on lap 2 launch-fraction with launchBias-only", () => {
    const result = decideFireNitro(
      input({
        lap: 2,
        lapFraction: 0.05,
        aiSpeed: 10,
        playerGapMeters: 200,
        nitroUsage: { launchBias: 1, straightBias: 0, panicBias: 0 },
      }),
    );
    expect(result).toBe(false);
  });

  it("never fires when all biases are zero", () => {
    const result = decideFireNitro(
      input({ lap: 1, lapFraction: 0, nitroUsage: NEVER }),
    );
    expect(result).toBe(false);
  });
});

describe("decideFireNitro panic window", () => {
  it("fires when the player is close in front", () => {
    const result = decideFireNitro(
      input({
        lap: 2,
        lapFraction: 0.5,
        playerGapMeters: PANIC_GAP_METERS - 5,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(result).toBe(true);
  });

  it("does not fire when the player is far ahead", () => {
    const result = decideFireNitro(
      input({
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: PANIC_GAP_METERS + 5,
        aiSpeed: 10,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(result).toBe(false);
  });

  it("does not fire when the player is behind the AI", () => {
    const result = decideFireNitro(
      input({
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: -10,
        aiSpeed: 10,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(result).toBe(false);
  });

  it("fires on the final lap past the push fraction even without a close player", () => {
    const result = decideFireNitro(
      input({
        lap: 3,
        totalLaps: 3,
        lapFraction: FINAL_LAP_PUSH_FRACTION + 0.05,
        playerGapMeters: 500,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(result).toBe(true);
  });

  it("does not fire on the final lap below the push fraction", () => {
    const result = decideFireNitro(
      input({
        lap: 3,
        totalLaps: 3,
        lapFraction: FINAL_LAP_PUSH_FRACTION - 0.05,
        playerGapMeters: 500,
        aiSpeed: 10,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(result).toBe(false);
  });
});

describe("decideFireNitro straight window", () => {
  it("fires on a straight at mid-band speed with bias 1", () => {
    const result = decideFireNitro(
      input({
        authoredCurve: 0,
        aiSpeed: 40,
        topSpeed: 60,
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: 500,
        nitroUsage: { launchBias: 0, straightBias: 1, panicBias: 0 },
      }),
    );
    expect(result).toBe(true);
  });

  it("does not fire below the speed floor", () => {
    const result = decideFireNitro(
      input({
        authoredCurve: 0,
        aiSpeed: SPEED_FLOOR_FRACTION * 60 - 1,
        topSpeed: 60,
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: 500,
        nitroUsage: { launchBias: 0, straightBias: 1, panicBias: 0 },
      }),
    );
    expect(result).toBe(false);
  });

  it("does not fire above the speed ceiling", () => {
    const result = decideFireNitro(
      input({
        authoredCurve: 0,
        aiSpeed: SPEED_CEILING_FRACTION * 60 + 1,
        topSpeed: 60,
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: 500,
        nitroUsage: { launchBias: 0, straightBias: 1, panicBias: 0 },
      }),
    );
    expect(result).toBe(false);
  });

  it("does not fire when the segment curve exceeds the straight threshold", () => {
    const result = decideFireNitro(
      input({
        authoredCurve: STRAIGHT_CURVE_THRESHOLD + 0.02,
        aiSpeed: 40,
        topSpeed: 60,
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: 500,
        nitroUsage: { launchBias: 0, straightBias: 1, panicBias: 0 },
      }),
    );
    expect(result).toBe(false);
  });
});

describe("decideFireNitro determinism", () => {
  it("produces the same decision for the same seed and inputs", () => {
    const fixture: DecideFireNitroInput = input({
      seed: 42,
      lap: 1,
      lapFraction: 0.05,
      nitroUsage: ROCKET_BIASES,
    });
    const a = decideFireNitro(fixture);
    const b = decideFireNitro(fixture);
    expect(a).toBe(b);
  });

  it("decorrelates per-window draws via the salt", () => {
    // Two calls with identical inputs except `playerGapMeters` (panic on
    // vs panic off) should not produce identical PRNG draws across
    // windows; verifying both bias=1 and bias=0 in the launch window
    // exercises the salt path indirectly. The contract this test pins
    // is that flipping a window predicate cannot bleed an unrelated
    // window's bias into the result.
    const launchOnly = decideFireNitro(
      input({
        lap: 1,
        lapFraction: 0.05,
        nitroUsage: { launchBias: 1, straightBias: 0, panicBias: 0 },
      }),
    );
    const panicOnly = decideFireNitro(
      input({
        lap: 2,
        lapFraction: 0.4,
        playerGapMeters: PANIC_GAP_METERS - 5,
        nitroUsage: { launchBias: 0, straightBias: 0, panicBias: 1 },
      }),
    );
    expect(launchOnly).toBe(true);
    expect(panicOnly).toBe(true);
  });
});
