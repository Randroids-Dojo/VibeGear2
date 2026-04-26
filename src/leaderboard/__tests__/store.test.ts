/**
 * Unit tests for `src/leaderboard/store.ts`.
 *
 * The resolver is the only piece of routing-time policy in the
 * leaderboard module today. Tests pin:
 *
 *   - Unset / empty / case-insensitive `"noop"` values pick the noop
 *     store.
 *   - Any unknown value throws (loud failure on misconfigured deploy
 *     per AGENTS.md RULE 7).
 *   - The factory returns a fresh store object on each call so a
 *     hot-reloaded route handler does not leak state.
 */

import { describe, expect, it } from "vitest";

import {
  resolveBackendTag,
  resolveLeaderboardStore,
} from "../store";

describe("resolveBackendTag", () => {
  it("returns noop for undefined", () => {
    expect(resolveBackendTag(undefined)).toBe("noop");
  });

  it("returns noop for empty string", () => {
    expect(resolveBackendTag("")).toBe("noop");
  });

  it("returns noop for the literal 'noop'", () => {
    expect(resolveBackendTag("noop")).toBe("noop");
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(resolveBackendTag("  NOOP  ")).toBe("noop");
    expect(resolveBackendTag("Noop")).toBe("noop");
  });

  it("throws on an unknown value rather than falling back silently", () => {
    expect(() => resolveBackendTag("vercel-kv")).toThrow(/LEADERBOARD_BACKEND/);
    expect(() => resolveBackendTag("redis")).toThrow(/LEADERBOARD_BACKEND/);
  });
});

describe("resolveLeaderboardStore", () => {
  it("returns a store satisfying the LeaderboardStore contract for noop", async () => {
    const store = resolveLeaderboardStore("noop");
    await expect(store.submit({
      trackId: "test/straight",
      carId: "sparrow-gt",
      lapMs: 100_000,
      playerName: null,
      submittedAt: 1,
    })).resolves.toBeNull();
    await expect(store.top("test/straight", 5)).resolves.toEqual([]);
    await expect(store.clear("test/straight")).resolves.toBeUndefined();
  });

  it("returns a fresh store per call (no shared identity)", () => {
    const a = resolveLeaderboardStore("noop");
    const b = resolveLeaderboardStore("noop");
    expect(a).not.toBe(b);
  });
});
