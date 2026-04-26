/**
 * Resolve a `LeaderboardStore` from the `LEADERBOARD_BACKEND` env var.
 *
 * Per the dot `VibeGear2-implement-leaderboard-route-2bc936cd` and
 * `docs/gdd/21-technical-design-for-web-implementation.md` "leaderboard
 * back end concept": the route handlers must work under three deploy
 * shapes (local dev with no backing service, Vercel with KV, GitHub
 * Pages mirror with no backend) without per-shape branches at the call
 * site. The resolver collapses the difference into one factory.
 *
 * Resolution rules:
 *
 *   - Unset, empty, or `"noop"` (case-insensitive): returns the noop
 *     store. This is the documented default in `AGENTS.md` RULE 7
 *     (backend services are optional later phases).
 *
 *   - `"vercel-kv"` (case-insensitive): dynamically imports
 *     `./store-vercel-kv` and returns a Vercel KV-backed store. The
 *     dynamic import keeps `@vercel/kv` out of the bundle on the noop
 *     and static-export deploy shapes per the dot
 *     `VibeGear2-implement-leaderboard-client-48a44048` "loaded
 *     dynamically when LEADERBOARD_BACKEND=vercel-kv so the bundle
 *     stays slim" requirement.
 *
 *   - Anything else: throws. A typoed value should fail loudly at
 *     boot rather than silently fall back to the noop store and
 *     discard real submissions.
 *
 * Pure: returns a fresh store on every call so a route handler holding
 * a stale reference cannot leak state across hot-reload boundaries in
 * dev. The noop store is stateless, so this is free; the KV factory
 * caches its connection inside the dynamically loaded module.
 *
 * Why one resolver instead of importing each factory directly: the
 * route handlers stay backend-agnostic. Adding a Redis or Upstash
 * store later means editing this file (and the dot's followup) without
 * touching the route handlers or their tests.
 */

import { createNoopStore } from "./store-noop";
import type { LeaderboardStore } from "./types";

/**
 * The set of backend tags the resolver recognises today. Adding a tag
 * (e.g. `"upstash-redis"`) requires only extending this union and the
 * switch below; the route handlers stay untouched.
 */
export type LeaderboardBackendTag = "noop" | "vercel-kv";

/**
 * Resolve which backend tag to use given the raw env value. Exported so
 * tests can pin a value without poking `process.env`. Returns the tag
 * or throws on unknown values.
 */
export function resolveBackendTag(
  envValue: string | undefined,
): LeaderboardBackendTag {
  const normalized = (envValue ?? "").trim().toLowerCase();
  if (normalized === "" || normalized === "noop") {
    return "noop";
  }
  if (normalized === "vercel-kv") {
    return "vercel-kv";
  }
  throw new Error(
    `resolveBackendTag: unknown LEADERBOARD_BACKEND value "${envValue}". Known values: noop, vercel-kv`,
  );
}

/**
 * Build the store the route handlers should use. Reads
 * `process.env.LEADERBOARD_BACKEND` by default; tests pass an explicit
 * value to avoid mutating the process env.
 *
 * Async because the `vercel-kv` branch dynamically imports its module
 * to keep `@vercel/kv` out of the noop deploy bundle. The noop branch
 * resolves synchronously inside the returned Promise; awaiting it
 * costs one microtask.
 */
export async function resolveLeaderboardStore(
  envValue: string | undefined = process.env.LEADERBOARD_BACKEND,
): Promise<LeaderboardStore> {
  const tag = resolveBackendTag(envValue);
  switch (tag) {
    case "noop":
      return createNoopStore();
    case "vercel-kv": {
      const mod = await import("./store-vercel-kv");
      return mod.createVercelKvStoreFromEnv();
    }
  }
}
