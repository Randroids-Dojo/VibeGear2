/**
 * Client adapter for the optional online leaderboard.
 *
 * Final slice of the §21 "leaderboard back end concept": gives the
 * race UI two pure entry points, `submitLap(token, lap)` and
 * `getTop(trackId, n)`, that always resolve to a documented sentinel
 * shape so the caller has a single branch shape regardless of whether
 * a backend is configured.
 *
 * Feature flag per the dot
 * `VibeGear2-implement-leaderboard-client-48a44048`:
 * `NEXT_PUBLIC_LEADERBOARD_ENABLED`. When unset or anything other than
 * `"true"` (case-insensitive), every method short-circuits to the
 * `disabled` sentinel without hitting the network. This is the
 * documented default in `AGENTS.md` RULE 7 (backend services are
 * optional later phases).
 *
 * Why a discriminated union instead of throwing: the consumer (the
 * results screen) renders a "submitting..." pip and either a "best
 * lap saved" or "leaderboard offline" line. Throwing would force a
 * try/catch around every call and surface stack traces to the player.
 *
 * Why the `fetcher` injection point: the `fetch` global is hard to
 * stub in Vitest without mocking modules. Tests pass an in-memory
 * fetch fake; production callers omit the option and the module
 * defaults to the platform `fetch`.
 *
 * Pure: every function takes its `fetcher` and `enabled` flag as
 * arguments (defaulting to globals only when omitted) so the suite
 * does not need to mutate `process.env` or `globalThis.fetch`.
 *
 * No retries, no exponential backoff, no in-flight de-dup: the lap
 * submission is fire-and-forget on the happy path, and the read-side
 * is called once per results-screen mount. A future slice can wrap
 * this module with an offline queue if the leaderboard upgrade-tier
 * feature ever lands.
 */

import type { LapSubmission, LeaderboardEntry } from "./types";

/**
 * The literal env-var value that turns the client on. Anything else
 * (unset, empty string, `"false"`, `"0"`, typoed `"ture"`) leaves the
 * client in disabled mode. Case-insensitive, whitespace-trimmed.
 */
const ENABLED_VALUE = "true";

/**
 * Default base path for the leaderboard routes. Matches the App Router
 * paths shipped in `src/app/api/leaderboard/`. Tests pass an explicit
 * `baseUrl` to point at a fake; production callers rely on the default
 * relative path which the platform `fetch` resolves against
 * `window.location.origin`.
 */
const DEFAULT_BASE_PATH = "/api/leaderboard";

/**
 * Read the feature-flag env var without coupling the module to
 * `process.env`. Exported so tests can check the parsing rule without
 * round-tripping through a fake.
 */
export function isLeaderboardEnabled(
  envValue: string | undefined = process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED,
): boolean {
  return (envValue ?? "").trim().toLowerCase() === ENABLED_VALUE;
}

/**
 * Minimal `fetch` shape the adapter needs. Narrower than the full
 * platform `fetch` so tests can fake it with a one-line function.
 */
export type LeaderboardFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Per-call options. Every field is optional; production callers omit
 * the entire object. Tests inject `fetcher` and `enabled` so the suite
 * is hermetic.
 */
export interface LeaderboardClientOptions {
  /** Override the platform `fetch`. Defaults to `globalThis.fetch`. */
  fetcher?: LeaderboardFetcher;
  /** Override the feature flag. Defaults to the env-var read. */
  enabled?: boolean;
  /** Override the route base path. Defaults to `/api/leaderboard`. */
  baseUrl?: string;
}

/**
 * Sentinel return shapes for `submitLap`. Stable string codes the UI
 * branches on without parsing prose:
 *
 *   - `disabled`: the feature flag is off; nothing was sent.
 *   - `stored`: the server accepted the lap and may have assigned an
 *     id (the noop store returns `null`; KV returns a string).
 *   - `rejected`: the server returned a 4xx with a stable `code`. The
 *     UI shows a non-blocking "lap rejected" pip without retrying.
 *   - `network-error`: the fetch call threw or returned a non-JSON
 *     body. The UI shows "leaderboard offline" and moves on.
 */
export type SubmitLapResult =
  | { kind: "disabled" }
  | { kind: "stored"; id: string | null }
  | { kind: "rejected"; status: number; code: string }
  | { kind: "network-error"; reason: string };

/**
 * Sentinel return shapes for `getTop`:
 *
 *   - `disabled`: the feature flag is off; the consumer renders an
 *     empty list and a "leaderboard offline" pip.
 *   - `entries`: the server returned a 200 with a row list (possibly
 *     empty).
 *   - `rejected`: the server returned a 4xx (e.g. unknown track).
 *   - `network-error`: the fetch call threw or returned a non-JSON
 *     body.
 */
export type GetTopResult =
  | { kind: "disabled" }
  | { kind: "entries"; entries: ReadonlyArray<LeaderboardEntry> }
  | { kind: "rejected"; status: number; code: string }
  | { kind: "network-error"; reason: string };

function resolveOptions(opts: LeaderboardClientOptions | undefined): {
  fetcher: LeaderboardFetcher;
  enabled: boolean;
  baseUrl: string;
} {
  const enabled = opts?.enabled ?? isLeaderboardEnabled();
  const baseUrl = opts?.baseUrl ?? DEFAULT_BASE_PATH;
  const fetcher =
    opts?.fetcher ??
    (typeof globalThis.fetch === "function"
      ? (globalThis.fetch.bind(globalThis) as LeaderboardFetcher)
      : undefined);
  if (fetcher === undefined) {
    // The platform we run on has no `fetch`. Fall back to a stub that
    // produces a `network-error` so callers do not need to special-case
    // this rare path. SSR + Node 18+ + browsers all ship `fetch`; the
    // only realistic miss is a future Edge-runtime test environment.
    return {
      enabled,
      baseUrl,
      fetcher: () =>
        Promise.reject(new Error("globalThis.fetch is not available")),
    };
  }
  return { fetcher, enabled, baseUrl };
}

async function readJsonBody(response: Response): Promise<unknown> {
  // The route handler always JSON-encodes both happy and error bodies.
  // A non-JSON body therefore implies a transport error (proxy 502,
  // CDN HTML page, etc); the caller treats it as a network error.
  const text = await response.text();
  return JSON.parse(text);
}

/**
 * Submit one signed lap to `POST /api/leaderboard/submit`.
 *
 * The submission must already be signed (the caller holds the
 * raceToken and the shared secret was minted at race start). This
 * function is a thin transport wrapper around the route handler.
 */
export async function submitLap(
  submission: LapSubmission,
  opts?: LeaderboardClientOptions,
): Promise<SubmitLapResult> {
  const { fetcher, enabled, baseUrl } = resolveOptions(opts);
  if (!enabled) {
    return { kind: "disabled" };
  }
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
    });
  } catch (err) {
    return {
      kind: "network-error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  let body: unknown;
  try {
    body = await readJsonBody(response);
  } catch (err) {
    return {
      kind: "network-error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (typeof body !== "object" || body === null) {
    return { kind: "network-error", reason: "response body is not an object" };
  }
  const obj = body as Record<string, unknown>;
  if (response.ok && obj.ok === true && obj.code === "stored") {
    const rawId = obj.id;
    const id =
      typeof rawId === "string" && rawId.length > 0 ? rawId : null;
    return { kind: "stored", id };
  }
  const code = typeof obj.code === "string" ? obj.code : "unknown";
  return { kind: "rejected", status: response.status, code };
}

/**
 * Fetch the top `limit` rows for one track from
 * `GET /api/leaderboard/[trackId]`.
 *
 * `limit` is forwarded as a `?limit=` query when present; the route
 * handler defaults to 10 when omitted and caps at 100 server-side.
 */
export async function getTop(
  trackId: string,
  limit?: number,
  opts?: LeaderboardClientOptions,
): Promise<GetTopResult> {
  const { fetcher, enabled, baseUrl } = resolveOptions(opts);
  if (!enabled) {
    return { kind: "disabled" };
  }
  if (trackId.length === 0) {
    return { kind: "rejected", status: 422, code: "missing-trackId" };
  }
  const safePath = encodeURIComponent(trackId);
  const query =
    limit === undefined ? "" : `?limit=${encodeURIComponent(String(limit))}`;
  const url = `${baseUrl}/${safePath}${query}`;
  let response: Response;
  try {
    response = await fetcher(url, { method: "GET" });
  } catch (err) {
    return {
      kind: "network-error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  let body: unknown;
  try {
    body = await readJsonBody(response);
  } catch (err) {
    return {
      kind: "network-error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (typeof body !== "object" || body === null) {
    return { kind: "network-error", reason: "response body is not an object" };
  }
  const obj = body as Record<string, unknown>;
  if (response.ok && obj.ok === true && Array.isArray(obj.entries)) {
    // The route handler returns the store's rows untouched. The store
    // contract pins the row shape; we trust the server here rather
    // than re-validating each row, because the only producer is our
    // own resolver. A future schema-drift slice can add a Zod parse.
    return {
      kind: "entries",
      entries: obj.entries as ReadonlyArray<LeaderboardEntry>,
    };
  }
  const code = typeof obj.code === "string" ? obj.code : "unknown";
  return { kind: "rejected", status: response.status, code };
}
