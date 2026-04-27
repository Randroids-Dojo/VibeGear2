import { describe, expect, it } from "vitest";

import { playerCarFrameIndex } from "../carFrame";

describe("playerCarFrameIndex", () => {
  it("uses the centered atlas frame for neutral steering and flat road", () => {
    expect(playerCarFrameIndex(0, 0)).toBe(0);
  });

  it("maps rightward steering to right-leaning atlas frames", () => {
    expect(playerCarFrameIndex(0.35, 0)).toBe(1);
    expect(playerCarFrameIndex(0.85, 0)).toBe(2);
  });

  it("maps leftward steering to left-leaning atlas frames", () => {
    expect(playerCarFrameIndex(-0.35, 0)).toBe(11);
    expect(playerCarFrameIndex(-0.85, 0)).toBe(10);
  });

  it("combines upcoming road curve with driver steering", () => {
    expect(playerCarFrameIndex(0, 1)).toBe(1);
    expect(playerCarFrameIndex(0, -1)).toBe(11);
  });
});
