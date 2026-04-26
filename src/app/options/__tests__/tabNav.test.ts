import { describe, expect, it } from "vitest";

import { TAB_ORDER, isTabNavKey, nextTabIndex } from "../tabNav";

/**
 * Pure tab-navigation model for the Options screen. Mirrors the WAI-ARIA
 * Authoring Practices keyboard pattern for tabs (Left, Right, Home, End)
 * and is what `page.tsx` binds to in its `onKeyDown` handler.
 */
describe("Options tabNav", () => {
  const total = TAB_ORDER.length;

  it("ships six tabs in §20 order", () => {
    expect(TAB_ORDER).toEqual([
      "display",
      "audio",
      "controls",
      "accessibility",
      "difficulty",
      "performance",
    ]);
  });

  it("ArrowRight advances by one", () => {
    expect(nextTabIndex(0, "ArrowRight", total)).toBe(1);
    expect(nextTabIndex(2, "ArrowRight", total)).toBe(3);
  });

  it("ArrowRight wraps from last back to first", () => {
    expect(nextTabIndex(total - 1, "ArrowRight", total)).toBe(0);
  });

  it("ArrowLeft retreats by one", () => {
    expect(nextTabIndex(3, "ArrowLeft", total)).toBe(2);
  });

  it("ArrowLeft wraps from first to last", () => {
    expect(nextTabIndex(0, "ArrowLeft", total)).toBe(total - 1);
  });

  it("Home jumps to first", () => {
    expect(nextTabIndex(4, "Home", total)).toBe(0);
  });

  it("End jumps to last", () => {
    expect(nextTabIndex(0, "End", total)).toBe(total - 1);
  });

  it("ignores non-navigation keys", () => {
    expect(nextTabIndex(2, "Enter", total)).toBe(2);
    expect(nextTabIndex(2, " ", total)).toBe(2);
    expect(nextTabIndex(2, "a", total)).toBe(2);
  });

  it("returns 0 for empty tab sets", () => {
    expect(nextTabIndex(0, "ArrowRight", 0)).toBe(0);
  });

  it("classifies navigation keys correctly", () => {
    expect(isTabNavKey("ArrowLeft")).toBe(true);
    expect(isTabNavKey("ArrowRight")).toBe(true);
    expect(isTabNavKey("Home")).toBe(true);
    expect(isTabNavKey("End")).toBe(true);
    expect(isTabNavKey("Enter")).toBe(false);
    expect(isTabNavKey("Escape")).toBe(false);
  });
});
