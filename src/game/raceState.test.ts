import { describe, expect, it } from "vitest";
import { createRaceState } from "./raceState";

describe("createRaceState", () => {
  it("starts in countdown on lap 1 with zero elapsed time", () => {
    const state = createRaceState(3);
    expect(state.phase).toBe("countdown");
    expect(state.elapsed).toBe(0);
    expect(state.lap).toBe(1);
    expect(state.totalLaps).toBe(3);
  });

  it("rejects non-positive lap counts", () => {
    expect(() => createRaceState(0)).toThrow(RangeError);
    expect(() => createRaceState(-1)).toThrow(RangeError);
  });

  it("rejects non-integer lap counts", () => {
    expect(() => createRaceState(2.5)).toThrow(RangeError);
  });
});
