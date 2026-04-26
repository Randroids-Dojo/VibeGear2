import { describe, expect, it } from "vitest";

import { CURRENT_SAVE_VERSION, migrate } from "./index";

describe("migrate", () => {
  it("walks the chain from v1 to the current version and bumps the version field", () => {
    // The v1 -> v2 migration is the first registered step; this test only
    // asserts the chain walker advances the version field. Per-step shape
    // assertions live in v1ToV2.test.ts and v2ToV3.test.ts so each
    // migration owns its own contract.
    const v1Stub = {
      version: 1,
      profileName: "Player",
      settings: {
        displaySpeedUnit: "kph",
        assists: {
          steeringAssist: false,
          autoNitro: false,
          weatherVisualReduction: false,
        },
      },
    };
    const result = migrate(v1Stub) as { version: number; ghosts?: unknown };
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    // The v2 -> v3 step seeds an empty ghosts slot at the top of the
    // chain output. Asserting it here confirms the chain walker advanced
    // through both registered migrations rather than stopping early.
    expect(result.ghosts).toEqual({});
  });

  it("walks the chain from v2 to the current version", () => {
    const v2Stub = {
      version: 2,
      profileName: "Player",
      settings: {
        displaySpeedUnit: "kph",
        assists: {
          steeringAssist: false,
          autoNitro: false,
          weatherVisualReduction: false,
        },
      },
    };
    const result = migrate(v2Stub) as { version: number; ghosts?: unknown };
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.ghosts).toEqual({});
  });

  it("returns the input untouched when its version already equals current", () => {
    const current = { version: CURRENT_SAVE_VERSION, payload: "hi" };
    expect(migrate(current)).toEqual(current);
  });

  it("rejects non-object input", () => {
    expect(() => migrate("nope")).toThrow(TypeError);
    expect(() => migrate(42)).toThrow(TypeError);
    expect(() => migrate(null)).toThrow(TypeError);
    expect(() => migrate([1, 2])).toThrow(TypeError);
  });

  it("rejects missing or invalid version field", () => {
    expect(() => migrate({})).toThrow(TypeError);
    expect(() => migrate({ version: "1" })).toThrow(TypeError);
    expect(() => migrate({ version: 0 })).toThrow(TypeError);
    expect(() => migrate({ version: 1.5 })).toThrow(TypeError);
  });

  it("refuses to downgrade a future-major save", () => {
    const future = { version: CURRENT_SAVE_VERSION + 1 };
    expect(() => migrate(future)).toThrow(RangeError);
  });
});
