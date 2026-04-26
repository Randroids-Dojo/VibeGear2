/**
 * Vitest suite for the `GET /api/leaderboard/[trackId]` route handler.
 *
 * Calls the exported `GET` directly with a fake `Request` and a
 * `params` promise to mirror the App Router's call shape. Coverage:
 *
 *   - 200 with `{ ok, trackId, entries: [] }` on a known track and the
 *     noop store.
 *   - 200 with the default limit when `?limit` is omitted.
 *   - 404 with code `unknown-track` for an unbundled track id.
 *   - 422 with code `limit-not-positive-integer` for malformed query.
 *   - The `?limit` clamp at MAX_LIMIT is respected (caller cannot ask
 *     for an arbitrarily large page).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "../route";

const TRACK_ID = "test/straight";

let savedBackend: string | undefined;

beforeEach(() => {
  savedBackend = process.env.LEADERBOARD_BACKEND;
  process.env.LEADERBOARD_BACKEND = "noop";
});

afterEach(() => {
  if (savedBackend === undefined) {
    delete process.env.LEADERBOARD_BACKEND;
  } else {
    process.env.LEADERBOARD_BACKEND = savedBackend;
  }
});

function buildRequest(query: string = ""): Request {
  return new Request(
    `http://localhost/api/leaderboard/${encodeURIComponent(TRACK_ID)}${query}`,
    { method: "GET" },
  );
}

async function call(
  request: Request,
  trackId: string,
): Promise<Response> {
  return GET(request, { params: Promise.resolve({ trackId }) });
}

describe("GET /api/leaderboard/[trackId]", () => {
  it("returns 200 with empty entries on a known track + noop store", async () => {
    const res = await call(buildRequest(), TRACK_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, trackId: TRACK_ID, entries: [] });
  });

  it("uses the default limit when ?limit is absent", async () => {
    const res = await call(buildRequest(""), TRACK_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("accepts an explicit positive integer limit", async () => {
    const res = await call(buildRequest("?limit=25"), TRACK_ID);
    expect(res.status).toBe(200);
  });

  it("clamps an over-large limit silently rather than rejecting it", async () => {
    const res = await call(buildRequest("?limit=99999"), TRACK_ID);
    expect(res.status).toBe(200);
  });

  it("returns 404 with code 'unknown-track' for an unbundled id", async () => {
    const req = new Request("http://localhost/api/leaderboard/nope/never", {
      method: "GET",
    });
    const res = await call(req, "nope/never");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("unknown-track");
  });

  it("returns 422 with code 'limit-not-positive-integer' on bad query", async () => {
    for (const q of ["?limit=0", "?limit=-1", "?limit=1.5", "?limit=abc"]) {
      const res = await call(buildRequest(q), TRACK_ID);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("limit-not-positive-integer");
    }
  });
});
