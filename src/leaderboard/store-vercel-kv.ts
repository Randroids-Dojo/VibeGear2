/**
 * Vercel KV-backed leaderboard store.
 *
 * Loaded dynamically by `resolveLeaderboardStore` only when
 * `LEADERBOARD_BACKEND=vercel-kv`, so the noop / static-export deploy
 * path never pulls the `@vercel/kv` package into the bundle. This
 * keeps the JS payload slim per AGENTS.md RULE 9 (scope discipline)
 * and per the dot
 * `VibeGear2-implement-leaderboard-client-48a44048` "loaded
 * dynamically" requirement.
 *
 * The package is intentionally NOT a hard `dependencies` entry in
 * `package.json` until the production deploy actually provisions
 * Vercel KV (tracked in `docs/FOLLOWUPS.md`). Until then, calling
 * `createVercelKvStoreFromEnv()` without an injected client throws a
 * loud error so a misconfigured deploy fails at boot rather than
 * silently dropping submissions.
 *
 * Storage layout (Sorted Set per track, Hash per entry):
 *
 *   - Per-track sorted set: key `lb:track:<trackId>`, score = `lapMs`,
 *     member = `id`. ZADD on insert (NX so the same id never gets
 *     re-scored). ZRANGE BYSCORE 0 +inf LIMIT 0 N for `top`.
 *   - Per-entry hash: key `lb:entry:<id>`, fields `trackId`, `carId`,
 *     `lapMs`, `playerName`, `submittedAt`. HSET on insert; HGETALL
 *     during `top` to materialise rows.
 *   - Optional dedup set: key `lb:dedup:<trackId>:<carId>:<lapMs>`,
 *     SETNX on insert to enforce the dot's "duplicate triple returns
 *     null" contract.
 *
 * Why not a single hash per row keyed by sorted-set member: ZRANGE
 * returns members only; we need a second roundtrip to fetch the row
 * fields anyway. Pipelining the second batch keeps `top` to two
 * round-trips regardless of N.
 *
 * The KV client interface this module needs (`KvLike` below) is a
 * narrow subset of `@vercel/kv`'s public surface so any compatible
 * Redis client (Upstash, ioredis, an in-memory test fake) can drop in
 * without touching this file. Tests in
 * `__tests__/store-vercel-kv.test.ts` pass a Map-backed fake.
 *
 * Pure where possible: the factory itself just stitches the closures
 * and is deterministic in its inputs. The closures themselves do IO
 * by definition; the contract test from `store-noop.test.ts` re-runs
 * here to pin the same shape.
 */

import type {
  LeaderboardEntry,
  LeaderboardStore,
  VerifiedSubmission,
} from "./types";

/**
 * Narrow subset of the `@vercel/kv` client surface this store uses.
 * Stays narrow so any Redis-compatible client can satisfy it: Upstash
 * Redis, `ioredis`, a Map-backed test fake. Adding a new method here
 * is a load-bearing change; prefer composing on top.
 *
 * All methods are async to match `@vercel/kv` and Upstash. Return
 * types match the upstream packages so a future swap to
 * `@upstash/redis` does not break the store.
 */
export interface KvLike {
  /**
   * `HSET key field value [field value ...]`. Returns the number of
   * fields that were newly created (not the count modified). The
   * store does not branch on the return value; it is here for symmetry
   * with `@vercel/kv`.
   */
  hset(key: string, value: Record<string, string | number>): Promise<number>;
  /**
   * `HGETALL key`. Returns the hash as an object, or `null` when the
   * key does not exist. `@vercel/kv` returns `null` (not `{}`) for
   * missing keys; the store relies on that to drop entries that the
   * sorted set still references (e.g. a partial write that leaked the
   * hash but not the index, recovered by skipping that row).
   */
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  /**
   * `ZADD key score member`. The `nx` option mirrors `@vercel/kv`'s
   * shape: `zadd(key, { nx: true }, { score, member })`. Returns
   * the number of new members added (0 when the member already
   * existed under any score).
   */
  zadd(
    key: string,
    options: { nx: true } | undefined,
    member: { score: number; member: string },
  ): Promise<number | null>;
  /**
   * `ZRANGE key start stop` returning members ordered by ascending
   * score. The store uses 0-based indexes and a positive `stop`. The
   * upstream client returns `string[]` because `member` is always a
   * string in our layout.
   */
  zrange(
    key: string,
    start: number,
    stop: number,
  ): Promise<string[]>;
  /**
   * `DEL key [key ...]`. Returns the number of keys removed. Used by
   * `clear()` to drop the per-track sorted set; the per-entry hashes
   * are reaped lazily on the next `top` call.
   */
  del(...keys: string[]): Promise<number>;
  /**
   * `SET key value NX`. Returns `"OK"` on success, `null` when the
   * key already existed. Used by the dedup index.
   */
  set(
    key: string,
    value: string,
    options: { nx: true },
  ): Promise<"OK" | null>;
}

/**
 * The set of env-var names this store reads. Exposed as a constant
 * so a deploy-checklist script can grep for them rather than scraping
 * source.
 */
export const VERCEL_KV_ENV_VARS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

/**
 * Build the Redis key for a track's sorted-set index.
 * Exposed for tests so a fake KV's contents can be inspected directly.
 */
export function trackIndexKey(trackId: string): string {
  return `lb:track:${trackId}`;
}

/**
 * Build the Redis key for one entry hash.
 */
export function entryKey(id: string): string {
  return `lb:entry:${id}`;
}

/**
 * Build the Redis key for the per-(track,car,lapMs) dedup marker.
 */
export function dedupKey(
  trackId: string,
  carId: string,
  lapMs: number,
): string {
  return `lb:dedup:${trackId}:${carId}:${lapMs}`;
}

/**
 * Mint a fresh entry id. Format: `<submittedAt>-<random6>` so a sort
 * by id is approximately chronological even outside the sorted-set
 * index, which helps debugging the KV contents directly.
 *
 * The randomness uses `crypto.getRandomValues` so the same module
 * runs under both Node 20+ and the Edge runtime per AGENTS.md RULE 8.
 * `Math.random` is banned in `src/game/` but not here; the leaderboard
 * module is not part of the deterministic simulation.
 */
function mintId(submittedAt: number): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    suffix += (byte < 16 ? "0" : "") + byte.toString(16);
  }
  return `${submittedAt}-${suffix}`;
}

/**
 * Coerce one HGETALL row into a `LeaderboardEntry`. Returns `null`
 * when any required field is missing or malformed so the caller can
 * skip a partial-write row without crashing the entire `top` call.
 *
 * `playerName` is normalised to `string | null` (the empty string
 * coerces to null so the read side never has to disambiguate).
 */
function rowToEntry(
  id: string,
  raw: Record<string, unknown>,
): LeaderboardEntry | null {
  const trackId = raw.trackId;
  const carId = raw.carId;
  const lapMs = typeof raw.lapMs === "string" ? Number(raw.lapMs) : raw.lapMs;
  const submittedAt =
    typeof raw.submittedAt === "string"
      ? Number(raw.submittedAt)
      : raw.submittedAt;
  if (typeof trackId !== "string" || trackId.length === 0) return null;
  if (typeof carId !== "string" || carId.length === 0) return null;
  if (
    typeof lapMs !== "number" ||
    !Number.isFinite(lapMs) ||
    !Number.isInteger(lapMs) ||
    lapMs <= 0
  ) {
    return null;
  }
  if (
    typeof submittedAt !== "number" ||
    !Number.isFinite(submittedAt) ||
    submittedAt < 0
  ) {
    return null;
  }
  let playerName: string | null = null;
  if (typeof raw.playerName === "string" && raw.playerName.length > 0) {
    playerName = raw.playerName;
  }
  return { id, trackId, carId, lapMs, playerName, submittedAt };
}

/**
 * Build a `LeaderboardStore` over an injected KV client. The factory
 * is the public surface every test and route handler uses; the Vercel
 * `@vercel/kv` import lives behind `createVercelKvStoreFromEnv` below
 * so the package can stay out of the bundle until production needs
 * it.
 *
 * Closures are bound once; the returned object satisfies the same
 * `LeaderboardStore` contract the noop store does, including the
 * "store may return null on duplicate" contract.
 */
export function createVercelKvStore(kv: KvLike): LeaderboardStore {
  return {
    async submit(entry: VerifiedSubmission): Promise<string | null> {
      const dedup = await kv.set(
        dedupKey(entry.trackId, entry.carId, entry.lapMs),
        "1",
        { nx: true },
      );
      if (dedup === null) {
        // The dot's edge-case list calls duplicate triples a returned-
        // null (not an error); the route handler reports it as the
        // happy `200 / stored / id=null` so the client UI can show
        // "your PB is unchanged" instead of an error pip.
        return null;
      }
      const id = mintId(entry.submittedAt);
      await kv.hset(entryKey(id), {
        trackId: entry.trackId,
        carId: entry.carId,
        lapMs: entry.lapMs,
        playerName: entry.playerName ?? "",
        submittedAt: entry.submittedAt,
      });
      const added = await kv.zadd(
        trackIndexKey(entry.trackId),
        { nx: true },
        { score: entry.lapMs, member: id },
      );
      if (added === null || added === 0) {
        // The id collision can only happen when two submissions in the
        // same millisecond mint the same 6-hex random suffix (~1 in
        // 16M per ms). Returning null rather than retrying matches
        // the dot's "the store may return null on rejection" contract;
        // the dedup marker still occupied the slot so a retry is up to
        // the caller.
        return null;
      }
      return id;
    },
    async top(
      trackId: string,
      limit: number,
    ): Promise<readonly LeaderboardEntry[]> {
      if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
        return [];
      }
      const ids = await kv.zrange(trackIndexKey(trackId), 0, limit - 1);
      if (ids.length === 0) return [];
      const rows = await Promise.all(
        ids.map(async (id) => {
          const raw = await kv.hgetall(entryKey(id));
          if (raw === null) return null;
          return rowToEntry(id, raw);
        }),
      );
      return rows.filter((row): row is LeaderboardEntry => row !== null);
    },
    async clear(trackId: string): Promise<void> {
      const indexKey = trackIndexKey(trackId);
      const ids = await kv.zrange(indexKey, 0, -1);
      const entryKeys = ids.map((id) => entryKey(id));
      if (entryKeys.length > 0) {
        await kv.del(...entryKeys);
      }
      await kv.del(indexKey);
      // Dedup keys deliberately stay around; a future race that posts
      // the same `(track, car, lapMs)` triple should still dedup. The
      // ops-side "wipe leaderboard" runbook clears the `lb:dedup:`
      // namespace separately.
    },
  };
}

/**
 * Resolve the `@vercel/kv` package at runtime and return a store
 * bound to its singleton client. Throws a typed error rather than
 * crashing on `MODULE_NOT_FOUND` so the deploy log makes the missing-
 * dependency case obvious.
 *
 * NOT called by tests: the suite injects a fake via
 * `createVercelKvStore` directly. The route handler reaches this path
 * only when a production deploy sets `LEADERBOARD_BACKEND=vercel-kv`
 * and the FOLLOWUPS task to install `@vercel/kv` has been completed.
 */
export async function createVercelKvStoreFromEnv(): Promise<LeaderboardStore> {
  const missing = VERCEL_KV_ENV_VARS.filter(
    (name) => !(process.env[name] ?? "").trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `createVercelKvStoreFromEnv: missing env vars ${missing.join(", ")}`,
    );
  }
  let mod: unknown;
  try {
    // The string is dynamic so the bundler does not statically resolve
    // the import; the `@vercel/kv` package only loads when this branch
    // actually runs. Without this indirection a `next build` on a
    // deploy that does not have the package installed would fail at
    // build time even when `LEADERBOARD_BACKEND` is unset.
    const moduleName = "@vercel/kv";
    mod = await import(/* webpackIgnore: true */ moduleName);
  } catch (err) {
    throw new Error(
      `createVercelKvStoreFromEnv: failed to load "@vercel/kv". ` +
        `Install the package or set LEADERBOARD_BACKEND=noop. ` +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof mod !== "object" || mod === null || !("kv" in mod)) {
    throw new Error(
      `createVercelKvStoreFromEnv: "@vercel/kv" did not export "kv".`,
    );
  }
  const kv = (mod as { kv: KvLike }).kv;
  return createVercelKvStore(kv);
}
