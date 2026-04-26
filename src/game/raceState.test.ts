import { describe, expect, it } from "vitest";
import { DEFAULT_COUNTDOWN_SEC, createRaceState } from "./raceState";

describe("createRaceState", () => {
  it("starts in countdown on lap 1 with zero elapsed time", () => {
    const state = createRaceState(3);
    expect(state.phase).toBe("countdown");
    expect(state.elapsed).toBe(0);
    expect(state.lap).toBe(1);
    expect(state.totalLaps).toBe(3);
    expect(state.countdownRemainingSec).toBe(DEFAULT_COUNTDOWN_SEC);
    expect(state.lastLapTimeMs).toBeNull();
    expect(state.bestLapTimeMs).toBeNull();
  });

  it("rejects non-positive lap counts", () => {
    expect(() => createRaceState(0)).toThrow(RangeError);
    expect(() => createRaceState(-1)).toThrow(RangeError);
  });

  it("rejects non-integer lap counts", () => {
    expect(() => createRaceState(2.5)).toThrow(RangeError);
  });

  it("honours a custom countdown duration", () => {
    const state = createRaceState(1, { countdownSec: 1.5 });
    expect(state.phase).toBe("countdown");
    expect(state.countdownRemainingSec).toBeCloseTo(1.5, 6);
  });

  it("starts in racing when countdownSec is 0 (practice / quick-race)", () => {
    const state = createRaceState(2, { countdownSec: 0 });
    expect(state.phase).toBe("racing");
    expect(state.countdownRemainingSec).toBe(0);
  });

  it("rejects a negative or non-finite countdown", () => {
    expect(() => createRaceState(1, { countdownSec: -0.5 })).toThrow(RangeError);
    expect(() => createRaceState(1, { countdownSec: Number.NaN })).toThrow(RangeError);
  });
});
