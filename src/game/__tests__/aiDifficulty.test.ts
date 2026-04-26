/**
 * Unit tests for `src/game/aiDifficulty.ts`.
 *
 * Pins the §23 "CPU difficulty modifiers" table verbatim so a future
 * balancing pass that retunes a number trips this test (and forces a
 * matching GDD edit). Also covers the §15 four-tier ladder mapping
 * (Easy / Normal / Hard / Master), the default-tier id, the
 * `undefined`-is-Normal fallback for v1 saves that predate the
 * `difficultyPreset` field, frozen-object semantics, and the
 * monotonicity sanity bounds.
 *
 * Float comparisons use `toBe` because every scalar in the table is
 * a clean decimal that round-trips through IEEE-754 exactly. AGENTS.md
 * RULE 8: would have used `toBeCloseTo` if any value were derived
 * arithmetically; here every value is a literal.
 */

import { describe, expect, it } from "vitest";

import type { PlayerDifficultyPreset } from "@/data/schemas";

import {
  CPU_DIFFICULTY_MODIFIERS,
  CPU_TIER_IDS,
  DEFAULT_CPU_TIER_ID,
  getCpuModifiers,
  resolveCpuModifiers,
  type CpuDifficultyModifiers,
} from "../aiDifficulty";

describe("DEFAULT_CPU_TIER_ID", () => {
  it("is 'normal' (the §23 identity row, also the §15 baseline)", () => {
    expect(DEFAULT_CPU_TIER_ID).toBe("normal");
  });
});

describe("CPU_TIER_IDS", () => {
  it("lists the §15 ladder in order", () => {
    expect(CPU_TIER_IDS).toEqual(["easy", "normal", "hard", "master"]);
  });

  it("is frozen so callers cannot mutate the iteration order", () => {
    expect(Object.isFrozen(CPU_TIER_IDS)).toBe(true);
  });
});

describe("CPU_DIFFICULTY_MODIFIERS", () => {
  it("is frozen so a stray write cannot drift §23", () => {
    expect(Object.isFrozen(CPU_DIFFICULTY_MODIFIERS)).toBe(true);
    for (const tier of CPU_TIER_IDS) {
      expect(Object.isFrozen(CPU_DIFFICULTY_MODIFIERS[tier])).toBe(true);
    }
  });

  it("covers every PlayerDifficultyPreset key with no extras", () => {
    expect(Object.keys(CPU_DIFFICULTY_MODIFIERS).sort()).toEqual(
      ["easy", "hard", "master", "normal"],
    );
  });
});

describe("getCpuModifiers", () => {
  it("returns the §23 Easy row", () => {
    expect(getCpuModifiers("easy")).toEqual<CpuDifficultyModifiers>({
      paceScalar: 0.92,
      recoveryScalar: 0.95,
      mistakeScalar: 1.4,
    });
  });

  it("returns the §23 Normal (identity) row", () => {
    expect(getCpuModifiers("normal")).toEqual<CpuDifficultyModifiers>({
      paceScalar: 1,
      recoveryScalar: 1,
      mistakeScalar: 1,
    });
  });

  it("returns the §23 Hard row", () => {
    expect(getCpuModifiers("hard")).toEqual<CpuDifficultyModifiers>({
      paceScalar: 1.05,
      recoveryScalar: 1.03,
      mistakeScalar: 0.7,
    });
  });

  it("returns the §23 Master row", () => {
    expect(getCpuModifiers("master")).toEqual<CpuDifficultyModifiers>({
      paceScalar: 1.09,
      recoveryScalar: 1.05,
      mistakeScalar: 0.45,
    });
  });

  it("returns the same frozen object reference across calls", () => {
    const first = getCpuModifiers("normal");
    const second = getCpuModifiers("normal");
    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("falls back to the default row for an out-of-band id", () => {
    // `as PlayerDifficultyPreset` mimics a mis-typed v1 save that the
    // Zod parser would normally reject. The function must not throw
    // and must yield Normal so callers degrade gracefully.
    const sneaky = "freestyle" as unknown as PlayerDifficultyPreset;
    expect(getCpuModifiers(sneaky)).toEqual(getCpuModifiers(DEFAULT_CPU_TIER_ID));
  });
});

describe("resolveCpuModifiers", () => {
  it("treats undefined (older v1 save) as the default tier", () => {
    expect(resolveCpuModifiers(undefined)).toEqual(getCpuModifiers("normal"));
  });

  it("delegates to getCpuModifiers for a known id", () => {
    expect(resolveCpuModifiers("hard")).toBe(getCpuModifiers("hard"));
  });
});

describe("§23 table monotonicity (sanity)", () => {
  // Walking the §15 ladder Easy -> Normal -> Hard -> Master, each
  // scalar should move monotonically along the §23 trend. These
  // assertions catch a future typo that flips a sign or swaps two
  // values; they are not a balancing-pass replacement.
  it("paceScalar is non-decreasing across Easy -> Master", () => {
    const easy = getCpuModifiers("easy").paceScalar;
    const normal = getCpuModifiers("normal").paceScalar;
    const hard = getCpuModifiers("hard").paceScalar;
    const master = getCpuModifiers("master").paceScalar;
    expect(easy).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(master);
  });

  it("recoveryScalar is non-decreasing across Easy -> Master", () => {
    const easy = getCpuModifiers("easy").recoveryScalar;
    const normal = getCpuModifiers("normal").recoveryScalar;
    const hard = getCpuModifiers("hard").recoveryScalar;
    const master = getCpuModifiers("master").recoveryScalar;
    expect(easy).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(master);
  });

  it("mistakeScalar is non-increasing across Easy -> Master", () => {
    const easy = getCpuModifiers("easy").mistakeScalar;
    const normal = getCpuModifiers("normal").mistakeScalar;
    const hard = getCpuModifiers("hard").mistakeScalar;
    const master = getCpuModifiers("master").mistakeScalar;
    expect(easy).toBeGreaterThanOrEqual(normal);
    expect(normal).toBeGreaterThanOrEqual(hard);
    expect(hard).toBeGreaterThanOrEqual(master);
  });

  it("Normal sits at identity for every column", () => {
    const normal = getCpuModifiers("normal");
    expect(normal.paceScalar).toBe(1);
    expect(normal.recoveryScalar).toBe(1);
    expect(normal.mistakeScalar).toBe(1);
  });
});
