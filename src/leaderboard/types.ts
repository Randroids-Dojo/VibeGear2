/**
 * Optional online leaderboard contracts.
 *
 * Pure data types and the `LeaderboardStore` interface every backing store
 * (noop, future Vercel KV / Upstash Redis) must satisfy. No IO, no Next.js
 * coupling, no Web Crypto: this module is safe to import from both server
 * route handlers and the client adapter.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * "signed lap submission concept" and "leaderboard back end concept", and
 * `docs/gdd/24-content-plan.md` v1.0 "Online leaderboard". The dot
 * `VibeGear2-implement-optional-online-4b2341af` scopes the full slice;
 * this file is the first hop (pure primitives), with route handlers and
 * the client adapter following as later slices.
 *
 * Privacy posture per AGENTS.md RULE 7 and `WORKING_AGREEMENT.md` §11:
 * submissions carry no PII, only the lap result fields below. The optional
 * `playerName` is a user-chosen handle, not a real name; the store is free
 * to truncate or reject it.
 */

/**
 * One unverified lap submission as it leaves the client. The server
 * verifies the `signature` against the canonical tuple of the other
 * fields plus the server-issued `raceToken` before persisting.
 *
 * `lapMs` is the single best lap time on the track (per §6 PB rules), not
 * the total race time. `carId` and `trackId` are bundled-content slugs;
 * the server validates both exist before accepting the row.
 */
export interface LapSubmission {
  /** Bundled track slug, e.g. `"test/straight"`. */
  trackId: string;
  /** Bundled car slug, e.g. `"sparrow-gt"`. */
  carId: string;
  /** Best lap time in integer milliseconds. Positive, finite. */
  lapMs: number;
  /** Server-issued race token returned at race start. */
  raceToken: string;
  /** Player-chosen handle. Optional; the store may truncate or omit it. */
  playerName?: string;
  /** HMAC-SHA-256 of the canonical tuple. Hex-encoded, lowercase. */
  signature: string;
}

/**
 * One row as the store returns it. Stable across backing stores so the
 * client adapter can render any backend's output identically.
 *
 * `submittedAt` is the store's wall-clock timestamp at insert (epoch ms).
 * `id` is opaque to the client; stores may use it for delete / update
 * operations a future slice exposes.
 */
export interface LeaderboardEntry {
  id: string;
  trackId: string;
  carId: string;
  lapMs: number;
  playerName: string | null;
  submittedAt: number;
}

/**
 * Pluggable backing store. Every implementation is async so a Redis /
 * Vercel KV adapter can drop in without changing call sites. The noop
 * store still returns Promises for the same reason.
 *
 * Method contracts:
 *
 *   - `submit(entry)` persists a verified entry. Returns the assigned
 *     `id` on success, or `null` if the store rejected the row (duplicate
 *     `(carId, trackId, lapMs)` triple per the dot's edge-case list).
 *     The caller has already verified the signature; stores must not
 *     re-verify.
 *
 *   - `top(trackId, limit)` returns the top `limit` rows for a track,
 *     sorted ascending by `lapMs`. `limit` is a positive integer; stores
 *     may cap it at their own internal maximum.
 *
 *   - `clear(trackId)` removes every row for a track. Used by the future
 *     "clear my submitted scores" UI; the noop store treats it as a
 *     successful no-op.
 */
export interface LeaderboardStore {
  submit(entry: VerifiedSubmission): Promise<string | null>;
  top(trackId: string, limit: number): Promise<readonly LeaderboardEntry[]>;
  clear(trackId: string): Promise<void>;
}

/**
 * Submission shape after the route handler has verified the signature.
 * Strips the `signature` and `raceToken` fields the store does not need
 * to persist, and adds the server's `submittedAt` timestamp.
 *
 * Stores receive this shape, never `LapSubmission` directly, so a buggy
 * store cannot leak the raceToken back to clients.
 */
export interface VerifiedSubmission {
  trackId: string;
  carId: string;
  lapMs: number;
  playerName: string | null;
  submittedAt: number;
}
