import { describe, expect, it } from "vitest";

import { CURRENT_SAVE_VERSION, migrate } from "./index";

describe("migrate", () => {
  it("returns v1 input untouched when current is v1", () => {
    const input = { version: 1, payload: "hi" };
    const result = migrate(input);
    expect(result).toEqual(input);
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
