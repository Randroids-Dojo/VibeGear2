/**
 * `GET /api/leaderboard/[trackId]` handler.
 *
 * Returns the top entries for one track, ordered ascending by `lapMs`.
 * Per the dot `VibeGear2-implement-leaderboard-route-2bc936cd`:
 *
 *   - 200 with `{ ok, trackId, entries }` on success. `entries` is the
 *     store's response unchanged so a future store ordering or limit
 *     change does not need a route-handler edit.
 *   - 404 if the track id is unknown to the bundled catalogue. Avoids
 *     enumeration: requesting a typoed id returns 404 with the same
 *     stable code instead of an empty list, so a casual client can
 *     tell "no submissions yet" from "no such track".
 *   - 422 if `?limit` is present but not a positive integer.
 *
 * `limit` defaults to 10 when omitted. The hard cap is 100 so a noisy
 * or malicious client cannot ask the store for an arbitrarily large
 * page; stores may cap further on their side.
 *
 * No body, no signing: this is the read-side endpoint. Anyone can
 * fetch the public leaderboard for a track. Future per-player views
 * will live at a different path.
 *
 * Edge / Node compatible. Pinned to Node so the env-var lookup matches
 * the Vitest test environment exactly, mirroring the submit route.
 */

import { NextResponse } from "next/server";

import { TRACK_RAW } from "@/data/tracks";
import { resolveLeaderboardStore } from "@/leaderboard/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type ResponseBody =
  | { ok: true; trackId: string; entries: ReadonlyArray<unknown> }
  | { ok: false; code: string; message?: string };

function json(status: number, body: ResponseBody): Response {
  return NextResponse.json(body, { status });
}

/**
 * Parse the optional `?limit=` query into a clamped positive integer.
 * Returns the number on success, the literal string `"invalid"` on a
 * malformed value, or `null` when the query is absent.
 */
function parseLimit(raw: string | null): number | "invalid" | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return "invalid";
  }
  return Math.min(n, MAX_LIMIT);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ trackId: string }> },
): Promise<Response> {
  const { trackId } = await context.params;

  if (TRACK_RAW[trackId] === undefined) {
    return json(404, { ok: false, code: "unknown-track" });
  }

  const url = new URL(request.url);
  const parsedLimit = parseLimit(url.searchParams.get("limit"));
  if (parsedLimit === "invalid") {
    return json(422, {
      ok: false,
      code: "limit-not-positive-integer",
    });
  }
  const limit = parsedLimit ?? DEFAULT_LIMIT;

  const store = await resolveLeaderboardStore();
  const entries = await store.top(trackId, limit);

  return json(200, { ok: true, trackId, entries });
}
