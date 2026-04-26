/**
 * No-op leaderboard store.
 *
 * The default store when `LEADERBOARD_BACKEND` is unset or set to
 * `"noop"`. Returns the success-shaped sentinel for every method so the
 * client adapter and route handlers behave identically to a configured
 * backend, just with empty results.
 *
 * Used in three contexts:
 *
 *   1. Local dev with no Redis / KV configured.
 *   2. Static-export deploys (Vercel free tier, GitHub Pages mirror)
 *      where the API routes are still bundled but no backing store
 *      exists.
 *   3. The contract test in `__tests__/store-noop.test.ts`, which is
 *      the canonical fixture every future store implementation must
 *      pass.
 *
 * The `submit()` return value is `null` (not a synthetic id) so callers
 * can distinguish "stored but un-queryable" from "stored and queryable
 * by id later". Tests assert on this.
 */

import type {
  LeaderboardEntry,
  LeaderboardStore,
  VerifiedSubmission,
} from "./types";

/**
 * Instantiate a fresh noop store. Currently stateless, but constructed
 * (rather than exported as a singleton) so a future variant can carry
 * per-instance config (logger, metric hook) without breaking callers.
 */
export function createNoopStore(): LeaderboardStore {
  return {
    async submit(_entry: VerifiedSubmission): Promise<string | null> {
      return null;
    },
    async top(
      _trackId: string,
      _limit: number,
    ): Promise<readonly LeaderboardEntry[]> {
      return [];
    },
    async clear(_trackId: string): Promise<void> {
      return;
    },
  };
}
