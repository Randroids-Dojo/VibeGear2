/**
 * Unit tests for `src/leaderboard/store.ts`.
 *
 * The resolver is the only piece of routing-time policy in the
 * leaderboard module today. Tests pin:
 *
 *   - Unset / empty / case-insensitive `"noop"` values pick the noop
 *     store.
 *   - `"upstash-redis"` is a recognised tag and rejects loudly when
 *     the required Marketplace env vars are missing.
 *   - `"vercel-kv"` remains a recognised legacy tag.
 *   - Any unknown value throws (loud failure on misconfigured deploy
 *     per AGENTS.md RULE 7).
 *   - The factory returns a fresh store object on each call so a
 *     hot-reloaded route handler does not leak state.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

  it("returns vercel-kv for the literal 'vercel-kv' (case-insensitive, trimmed)", () => {
    expect(resolveBackendTag("vercel-kv")).toBe("vercel-kv");
    expect(resolveBackendTag("  Vercel-KV  ")).toBe("vercel-kv");
  });

  it("returns upstash-redis for the literal 'upstash-redis' (case-insensitive, trimmed)", () => {
    expect(resolveBackendTag("upstash-redis")).toBe("upstash-redis");
    expect(resolveBackendTag("  Upstash-Redis  ")).toBe("upstash-redis");
  });

  it("throws on an unknown value rather than falling back silently", () => {
    expect(() => resolveBackendTag("redis")).toThrow(/LEADERBOARD_BACKEND/);
    expect(() => resolveBackendTag("upstash")).toThrow(/LEADERBOARD_BACKEND/);
  });
});

describe("resolveLeaderboardStore", () => {
  it("returns a store satisfying the LeaderboardStore contract for noop", async () => {
    const store = await resolveLeaderboardStore("noop");
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

  it("returns a fresh store per call (no shared identity)", async () => {
    const a = await resolveLeaderboardStore("noop");
    const b = await resolveLeaderboardStore("noop");
    expect(a).not.toBe(b);
  });
});

describe("resolveLeaderboardStore(upstash-redis)", () => {
  let savedUrl: string | undefined;
  let savedToken: string | undefined;

  beforeEach(() => {
    savedUrl = process.env.KV_REST_API_URL;
    savedToken = process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = savedUrl;
    if (savedToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = savedToken;
  });

  it("rejects with a configuration error when env vars are absent", async () => {
    await expect(resolveLeaderboardStore("upstash-redis")).rejects.toThrow(
      /KV_REST_API_URL|KV_REST_API_TOKEN/,
    );
  });
});

describe("resolveLeaderboardStore(vercel-kv)", () => {
  // The kv-from-env factory throws when KV_REST_API_URL or
  // KV_REST_API_TOKEN are missing. We strip both around this suite so
  // the resolver promise rejects with the expected message regardless
  // of how the local shell happens to be configured. This pins the
  // "loud failure on misconfigured deploy" contract per AGENTS.md
  // RULE 7 without requiring `@vercel/kv` to be installed.
  let savedUrl: string | undefined;
  let savedToken: string | undefined;

  beforeEach(() => {
    savedUrl = process.env.KV_REST_API_URL;
    savedToken = process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = savedUrl;
    if (savedToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = savedToken;
  });

  it("rejects with a configuration error when env vars are absent", async () => {
    await expect(resolveLeaderboardStore("vercel-kv")).rejects.toThrow(
      /KV_REST_API_URL|KV_REST_API_TOKEN/,
    );
  });
});
