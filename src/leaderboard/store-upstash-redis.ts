/**
 * Upstash Redis-backed leaderboard store.
 *
 * Vercel Marketplace injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
 * for Upstash Redis resources. The command surface matches the narrow
 * `KvLike` contract used by the legacy Vercel KV store, so this module
 * only owns env validation and SDK construction.
 */

import { Redis } from "@upstash/redis";

import {
  createVercelKvStore,
  type KvLike,
  VERCEL_KV_ENV_VARS,
} from "./store-vercel-kv";
import type { LeaderboardStore } from "./types";

export const UPSTASH_REDIS_ENV_VARS = VERCEL_KV_ENV_VARS;

export function createUpstashRedisStoreFromEnv(): LeaderboardStore {
  const missing = UPSTASH_REDIS_ENV_VARS.filter(
    (name) => !(process.env[name] ?? "").trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `createUpstashRedisStoreFromEnv: missing env vars ${missing.join(", ")}`,
    );
  }
  return createVercelKvStore(Redis.fromEnv() as KvLike);
}
