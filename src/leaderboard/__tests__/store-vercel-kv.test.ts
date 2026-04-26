/**
 * Tests for the Vercel KV-backed leaderboard store.
 *
 * Two-layer coverage:
 *
 *   1. The shared `runStoreContract` from `store-noop.test.ts` runs
 *      against `createVercelKvStore(fakeKv)` so the Vercel KV store
 *      satisfies the same `LeaderboardStore` contract as the noop
 *      store. This is the dot's "Re-runs the runStoreContract suite
 *      from store-noop.test.ts" requirement.
 *
 *   2. KV-specific behaviour the noop store has nothing to assert
 *      about: insertion order, ascending-by-lapMs ordering on `top`,
 *      duplicate-triple dedup returning `null`, and `clear()` wiping
 *      both the index and the per-entry hashes.
 *
 * The fake KV implements the `KvLike` surface in terms of plain Maps
 * and a sorted insertion list. Stays in-process so the suite runs
 * under the same `vitest run` invocation as every other unit test.
 */

import { describe, expect, it } from "vitest";

import {
  createVercelKvStore,
  dedupKey,
  entryKey,
  trackIndexKey,
  type KvLike,
} from "../store-vercel-kv";
import type { VerifiedSubmission } from "../types";

import { runStoreContract } from "./store-noop.test";

interface SortedSetMember {
  score: number;
  member: string;
}

function createFakeKv(): KvLike & {
  hashes: Map<string, Record<string, string | number>>;
  sortedSets: Map<string, SortedSetMember[]>;
  scalars: Map<string, string>;
} {
  const hashes = new Map<string, Record<string, string | number>>();
  const sortedSets = new Map<string, SortedSetMember[]>();
  const scalars = new Map<string, string>();
  return {
    hashes,
    sortedSets,
    scalars,
    async hset(key, value) {
      const prior = hashes.get(key) ?? {};
      let added = 0;
      for (const k of Object.keys(value)) {
        if (!(k in prior)) added += 1;
      }
      hashes.set(key, { ...prior, ...value });
      return added;
    },
    async hgetall(key) {
      const v = hashes.get(key);
      if (v === undefined) return null;
      // Vercel KV returns numbers as numbers, but the underlying Redis
      // protocol returns strings. Mirror the upstream serialisation
      // shape (string-coerced numbers) so the store's `rowToEntry`
      // coercion gets exercised.
      const out: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(v)) {
        out[k] = typeof raw === "number" ? String(raw) : raw;
      }
      return out;
    },
    async zadd(key, options, member) {
      const list = sortedSets.get(key) ?? [];
      if (options?.nx === true) {
        if (list.some((m) => m.member === member.member)) return 0;
      }
      list.push({ ...member });
      list.sort((a, b) => a.score - b.score);
      sortedSets.set(key, list);
      return 1;
    },
    async zrange(key, start, stop) {
      const list = sortedSets.get(key) ?? [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return list.slice(start, end).map((m) => m.member);
    },
    async del(...keys) {
      let removed = 0;
      for (const k of keys) {
        if (hashes.delete(k)) removed += 1;
        if (sortedSets.delete(k)) removed += 1;
        if (scalars.delete(k)) removed += 1;
      }
      return removed;
    },
    async set(key, value, options) {
      if (options.nx === true && scalars.has(key)) return null;
      scalars.set(key, value);
      return "OK";
    },
  };
}

runStoreContract("vercel-kv store (fake)", () =>
  createVercelKvStore(createFakeKv()),
);

const SAMPLE: VerifiedSubmission = {
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67_450,
  playerName: "RAN",
  submittedAt: 1_700_000_000_000,
};

describe("vercel-kv store (specifics)", () => {
  it("submit returns a non-empty id and indexes the entry by lapMs", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    const id = await store.submit(SAMPLE);
    expect(typeof id).toBe("string");
    expect((id ?? "").length).toBeGreaterThan(0);
    expect(fake.hashes.has(entryKey(id ?? ""))).toBe(true);
    expect(fake.sortedSets.has(trackIndexKey(SAMPLE.trackId))).toBe(true);
    const dedupSet = fake.scalars.has(
      dedupKey(SAMPLE.trackId, SAMPLE.carId, SAMPLE.lapMs),
    );
    expect(dedupSet).toBe(true);
  });

  it("top returns rows ascending by lapMs", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    await store.submit({ ...SAMPLE, lapMs: 80_000, submittedAt: 1 });
    await store.submit({ ...SAMPLE, lapMs: 70_000, submittedAt: 2 });
    await store.submit({ ...SAMPLE, lapMs: 60_000, submittedAt: 3 });
    const rows = await store.top(SAMPLE.trackId, 10);
    expect(rows.map((r) => r.lapMs)).toEqual([60_000, 70_000, 80_000]);
  });

  it("top respects the limit", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    for (let i = 0; i < 5; i++) {
      await store.submit({
        ...SAMPLE,
        lapMs: 60_000 + i * 1000,
        submittedAt: i,
      });
    }
    const rows = await store.top(SAMPLE.trackId, 2);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.lapMs)).toEqual([60_000, 61_000]);
  });

  it("submit returns null on a duplicate (trackId, carId, lapMs) triple", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    const first = await store.submit(SAMPLE);
    const second = await store.submit(SAMPLE);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const rows = await store.top(SAMPLE.trackId, 10);
    expect(rows.length).toBe(1);
  });

  it("playerName empty / missing maps to null on read", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    await store.submit({ ...SAMPLE, playerName: null });
    const rows = await store.top(SAMPLE.trackId, 1);
    expect(rows[0]?.playerName).toBeNull();
  });

  it("clear empties the index and the per-entry hashes for the track", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    await store.submit({ ...SAMPLE, lapMs: 60_000 });
    await store.submit({ ...SAMPLE, lapMs: 70_000 });
    await store.clear(SAMPLE.trackId);
    expect(fake.sortedSets.has(trackIndexKey(SAMPLE.trackId))).toBe(false);
    // The per-entry hashes for the cleared track should also be gone.
    for (const key of fake.hashes.keys()) {
      expect(key.startsWith("lb:entry:")).toBe(false);
    }
  });

  it("top returns empty for a non-positive limit without hitting the index", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    await store.submit(SAMPLE);
    expect(await store.top(SAMPLE.trackId, 0)).toEqual([]);
    expect(await store.top(SAMPLE.trackId, -1)).toEqual([]);
  });

  it("top skips rows whose entry hash has been reaped (partial-write recovery)", async () => {
    const fake = createFakeKv();
    const store = createVercelKvStore(fake);
    const id = await store.submit(SAMPLE);
    expect(id).not.toBeNull();
    // Simulate a manual ops wipe of the entry hash without touching the
    // sorted-set index. The store should drop the orphaned id and
    // return the empty list rather than crashing on a null hgetall.
    fake.hashes.delete(entryKey(id ?? ""));
    const rows = await store.top(SAMPLE.trackId, 10);
    expect(rows).toEqual([]);
  });
});
