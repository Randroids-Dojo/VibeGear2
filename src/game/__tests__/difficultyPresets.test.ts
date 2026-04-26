/**
 * Unit tests for `src/game/difficultyPresets.ts`.
 *
 * Pins the §28 "Example tuning values" table verbatim so a future
 * balancing pass that retunes a number trips this test (and forces a
 * matching GDD edit). Also covers the §15 four-tier ladder mapping
 * (Easy / Normal / Hard / Master), the Master extrapolation pinned
 * by the iter-30 dot researcher note, the default-preset id, and the
 * `undefined`-is-Balanced fallback for v1 saves that predate the
 * `difficultyPreset` field.
 *
 * Float comparisons use `toBe` because every scalar in the table is
 * a clean decimal that round-trips through IEEE-754 exactly. AGENTS.md
 * RULE 8: would have used `toBeCloseTo` if any value were derived
 * arithmetically; here every value is a literal.
 */

import { describe, expect, it } from "vitest";

import type { PlayerDifficultyPreset } from "@/data/schemas";

import {
  DEFAULT_PRESET_ID,
  PRESET_IDS,
  getPreset,
  resolvePresetScalars,
  type AssistScalars,
} from "../difficultyPresets";

describe("DEFAULT_PRESET_ID", () => {
  it("is 'normal' (the §28 Balanced row, also the §15 baseline)", () => {
    expect(DEFAULT_PRESET_ID).toBe("normal");
  });
});

describe("PRESET_IDS", () => {
  it("lists the §15 ladder in order", () => {
    expect(PRESET_IDS).toEqual(["easy", "normal", "hard", "master"]);
  });

  it("is frozen so callers cannot mutate the iteration order", () => {
    expect(Object.isFrozen(PRESET_IDS)).toBe(true);
  });
});

describe("getPreset", () => {
  it("returns the §28 Beginner row for 'easy'", () => {
    expect(getPreset("easy")).toEqual<AssistScalars>({
      steeringAssistScale: 0.25,
      nitroStabilityPenalty: 0.7,
      damageSeverity: 0.75,
      offRoadDragScale: 1.2,
    });
  });

  it("returns the §28 Balanced row for 'normal'", () => {
    expect(getPreset("normal")).toEqual<AssistScalars>({
      steeringAssistScale: 0.1,
      nitroStabilityPenalty: 1,
      damageSeverity: 1,
      offRoadDragScale: 1,
    });
  });

  it("returns the §28 Expert row for 'hard'", () => {
    expect(getPreset("hard")).toEqual<AssistScalars>({
      steeringAssistScale: 0,
      nitroStabilityPenalty: 1.15,
      damageSeverity: 1.2,
      offRoadDragScale: 0.95,
    });
  });

  it("returns the documented Master extrapolation", () => {
    // Per the module's pinned extrapolation comment: shrinking step
    // sizes past the §28 Expert row keep Master "Hard plus a notch".
    expect(getPreset("master")).toEqual<AssistScalars>({
      steeringAssistScale: 0,
      nitroStabilityPenalty: 1.25,
      damageSeverity: 1.35,
      offRoadDragScale: 0.9,
    });
  });

  it("returns the same frozen object reference across calls", () => {
    const first = getPreset("normal");
    const second = getPreset("normal");
    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("falls back to the default row for an out-of-band id", () => {
    // `as PlayerDifficultyPreset` mimics a mis-typed v1 save that the
    // Zod parser would normally reject. The function must not throw
    // and must yield Balanced so callers degrade gracefully.
    const sneaky = "freestyle" as unknown as PlayerDifficultyPreset;
    expect(getPreset(sneaky)).toEqual(getPreset(DEFAULT_PRESET_ID));
  });
});

describe("resolvePresetScalars", () => {
  it("treats undefined (older v1 save) as the default preset", () => {
    expect(resolvePresetScalars(undefined)).toEqual(getPreset("normal"));
  });

  it("delegates to getPreset for a known id", () => {
    expect(resolvePresetScalars("hard")).toBe(getPreset("hard"));
  });
});

describe("§28 table monotonicity (sanity)", () => {
  // Walking the §15 ladder Easy -> Normal -> Hard -> Master, each
  // scalar should move monotonically along the §28 trend. These
  // assertions catch a future typo that flips a sign or swaps two
  // values; they are not a balancing-pass replacement.
  it("steeringAssistScale is non-increasing across Easy -> Master", () => {
    const easy = getPreset("easy").steeringAssistScale;
    const normal = getPreset("normal").steeringAssistScale;
    const hard = getPreset("hard").steeringAssistScale;
    const master = getPreset("master").steeringAssistScale;
    expect(easy).toBeGreaterThanOrEqual(normal);
    expect(normal).toBeGreaterThanOrEqual(hard);
    expect(hard).toBeGreaterThanOrEqual(master);
  });

  it("nitroStabilityPenalty is non-decreasing across Easy -> Master", () => {
    const easy = getPreset("easy").nitroStabilityPenalty;
    const normal = getPreset("normal").nitroStabilityPenalty;
    const hard = getPreset("hard").nitroStabilityPenalty;
    const master = getPreset("master").nitroStabilityPenalty;
    expect(easy).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(master);
  });

  it("damageSeverity is non-decreasing across Easy -> Master", () => {
    const easy = getPreset("easy").damageSeverity;
    const normal = getPreset("normal").damageSeverity;
    const hard = getPreset("hard").damageSeverity;
    const master = getPreset("master").damageSeverity;
    expect(easy).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(master);
  });

  it("offRoadDragScale is non-increasing across Easy -> Master", () => {
    const easy = getPreset("easy").offRoadDragScale;
    const normal = getPreset("normal").offRoadDragScale;
    const hard = getPreset("hard").offRoadDragScale;
    const master = getPreset("master").offRoadDragScale;
    expect(easy).toBeGreaterThanOrEqual(normal);
    expect(normal).toBeGreaterThanOrEqual(hard);
    expect(hard).toBeGreaterThanOrEqual(master);
  });
});
