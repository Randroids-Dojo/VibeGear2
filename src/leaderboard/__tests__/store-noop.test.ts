/**
 * Contract tests for the no-op leaderboard store.
 *
 * The same suite is the canonical fixture every future store
 * implementation (Vercel KV, Upstash Redis, in-memory test fake) must
 * satisfy. The shape `runStoreContract(name, factory)` lets a sibling
 * test file import and re-run this against its own factory, so a new
 * backing store does not have to copy the contract.
 *
 * Per the dot specification:
 *   - `submit()` returns `null` for noop (documented sentinel).
 *   - `top()` returns the empty list for an unknown / empty track.
 *   - `clear()` resolves without throwing.
 *
 * Stores beyond noop add their own test suites for the persistence,
 * ordering, and dedup behaviour the noop store has nothing to assert
 * about.
 */

import { describe, expect, it } from "vitest";

import { createNoopStore } from "../store-noop";
import type { LeaderboardStore, VerifiedSubmission } from "../types";

const SAMPLE_ENTRY: VerifiedSubmission = {
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67450,
  playerName: "RAN",
  submittedAt: 1_700_000_000_000,
};

export function runStoreContract(
  name: string,
  factory: () => LeaderboardStore,
): void {
  describe(`${name} (LeaderboardStore contract)`, () => {
    it("submit returns null or a non-empty string id", async () => {
      const store = factory();
      const id = await store.submit(SAMPLE_ENTRY);
      expect(id === null || (typeof id === "string" && id.length > 0)).toBe(
        true,
      );
    });

    it("top returns an array (possibly empty) for any track", async () => {
      const store = factory();
      const rows = await store.top("test/straight", 10);
      expect(Array.isArray(rows)).toBe(true);
    });

    it("top respects a positive limit by returning at most `limit` rows", async () => {
      const store = factory();
      const rows = await store.top("test/straight", 3);
      expect(rows.length).toBeLessThanOrEqual(3);
    });

    it("clear resolves without throwing", async () => {
      const store = factory();
      await expect(store.clear("test/straight")).resolves.toBeUndefined();
    });
  });
}

runStoreContract("noop store", createNoopStore);

describe("noop store specifics", () => {
  it("submit returns null (the documented sentinel for un-queryable inserts)", async () => {
    const store = createNoopStore();
    const id = await store.submit(SAMPLE_ENTRY);
    expect(id).toBeNull();
  });

  it("top always returns the empty list", async () => {
    const store = createNoopStore();
    await store.submit(SAMPLE_ENTRY);
    const rows = await store.top("test/straight", 10);
    expect(rows).toEqual([]);
  });

  it("each call returns an independent array", async () => {
    const store = createNoopStore();
    const a = await store.top("test/straight", 10);
    const b = await store.top("test/straight", 10);
    expect(a).not.toBe(b);
  });
});
