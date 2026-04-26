/**
 * Tests for the leaderboard client adapter.
 *
 * Coverage matrix per the dot
 * `VibeGear2-implement-leaderboard-client-48a44048`:
 *
 *   - `isLeaderboardEnabled` parses the env-var rule (only literal
 *     `"true"` after trim+lowercase enables; everything else disables).
 *   - `submitLap` and `getTop` short-circuit to the documented
 *     `disabled` sentinel when the feature flag is off, without
 *     touching the injected fetcher.
 *   - The happy paths translate the route handler envelope into
 *     `stored` / `entries` sentinels.
 *   - 4xx responses surface as `rejected` with the route handler's
 *     stable `code` string.
 *   - Network failures (fetch throws, non-JSON body) surface as
 *     `network-error`.
 *   - URL composition: `getTop` URL-encodes the trackId and forwards
 *     the optional `?limit=` query.
 */

import { describe, expect, it, vi } from "vitest";

import {
  getTop,
  isLeaderboardEnabled,
  submitLap,
  type LeaderboardFetcher,
} from "../client";
import type { LapSubmission } from "../types";

const SUBMISSION: LapSubmission = {
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67_450,
  raceToken: "race-token-abc-123",
  playerName: "RAN",
  signature: "deadbeef".repeat(8),
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("isLeaderboardEnabled", () => {
  it("returns false for undefined and empty string", () => {
    expect(isLeaderboardEnabled(undefined)).toBe(false);
    expect(isLeaderboardEnabled("")).toBe(false);
  });

  it("returns true only for the literal 'true' (case-insensitive, trimmed)", () => {
    expect(isLeaderboardEnabled("true")).toBe(true);
    expect(isLeaderboardEnabled("  TRUE  ")).toBe(true);
    expect(isLeaderboardEnabled("True")).toBe(true);
  });

  it("returns false for anything else", () => {
    expect(isLeaderboardEnabled("false")).toBe(false);
    expect(isLeaderboardEnabled("1")).toBe(false);
    expect(isLeaderboardEnabled("yes")).toBe(false);
    expect(isLeaderboardEnabled("ture")).toBe(false);
  });
});

describe("submitLap", () => {
  it("short-circuits to disabled when the feature flag is off", async () => {
    const fetcher = vi.fn<LeaderboardFetcher>();
    const result = await submitLap(SUBMISSION, { enabled: false, fetcher });
    expect(result).toEqual({ kind: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns stored on a 200 response", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(
        jsonResponse(200, { ok: true, code: "stored", id: "row-1" }),
      );
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result).toEqual({ kind: "stored", id: "row-1" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/leaderboard/submit");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      trackId: SUBMISSION.trackId,
      lapMs: SUBMISSION.lapMs,
      signature: SUBMISSION.signature,
    });
  });

  it("returns stored with id=null when the server stored without an id (noop store)", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(
        jsonResponse(200, { ok: true, code: "stored", id: null }),
      );
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result).toEqual({ kind: "stored", id: null });
  });

  it("returns rejected with the server's code on 4xx", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(jsonResponse(401, { ok: false, code: "bad-signature" }));
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result).toEqual({
      kind: "rejected",
      status: 401,
      code: "bad-signature",
    });
  });

  it("returns rejected with code=unknown when the body has no code field", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(jsonResponse(500, { ok: false }));
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result).toEqual({ kind: "rejected", status: 500, code: "unknown" });
  });

  it("returns network-error when the fetcher throws", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockRejectedValue(new Error("connection refused"));
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result).toEqual({
      kind: "network-error",
      reason: "connection refused",
    });
  });

  it("returns network-error when the body is not valid JSON", async () => {
    const fetcher = vi.fn<LeaderboardFetcher>().mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );
    const result = await submitLap(SUBMISSION, { enabled: true, fetcher });
    expect(result.kind).toBe("network-error");
  });

  it("respects the baseUrl override", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(
        jsonResponse(200, { ok: true, code: "stored", id: "row-1" }),
      );
    await submitLap(SUBMISSION, {
      enabled: true,
      fetcher,
      baseUrl: "https://example.test/lb",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://example.test/lb/submit");
  });
});

describe("getTop", () => {
  it("short-circuits to disabled when the feature flag is off", async () => {
    const fetcher = vi.fn<LeaderboardFetcher>();
    const result = await getTop("test/straight", 5, {
      enabled: false,
      fetcher,
    });
    expect(result).toEqual({ kind: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns entries on a 200 response", async () => {
    const entries = [
      {
        id: "row-1",
        trackId: "test/straight",
        carId: "sparrow-gt",
        lapMs: 60_000,
        playerName: "RAN",
        submittedAt: 1,
      },
    ];
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(
        jsonResponse(200, {
          ok: true,
          trackId: "test/straight",
          entries,
        }),
      );
    const result = await getTop("test/straight", 5, {
      enabled: true,
      fetcher,
    });
    expect(result).toEqual({ kind: "entries", entries });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/leaderboard/test%2Fstraight?limit=5",
    );
  });

  it("omits the limit query when limit is undefined", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(
        jsonResponse(200, {
          ok: true,
          trackId: "test/straight",
          entries: [],
        }),
      );
    await getTop("test/straight", undefined, { enabled: true, fetcher });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/leaderboard/test%2Fstraight",
    );
  });

  it("returns rejected on a 404 unknown-track", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockResolvedValue(jsonResponse(404, { ok: false, code: "unknown-track" }));
    const result = await getTop("does/not/exist", 5, {
      enabled: true,
      fetcher,
    });
    expect(result).toEqual({
      kind: "rejected",
      status: 404,
      code: "unknown-track",
    });
  });

  it("returns rejected without hitting the network on an empty trackId", async () => {
    const fetcher = vi.fn<LeaderboardFetcher>();
    const result = await getTop("", 5, { enabled: true, fetcher });
    expect(result).toEqual({
      kind: "rejected",
      status: 422,
      code: "missing-trackId",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns network-error when the fetcher throws", async () => {
    const fetcher = vi
      .fn<LeaderboardFetcher>()
      .mockRejectedValue(new Error("dns failure"));
    const result = await getTop("test/straight", 5, {
      enabled: true,
      fetcher,
    });
    expect(result).toEqual({ kind: "network-error", reason: "dns failure" });
  });
});
