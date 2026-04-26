import { expect, test } from "@playwright/test";

/**
 * Playwright smoke for the optional online leaderboard route handlers.
 *
 * The dot `VibeGear2-implement-leaderboard-route-2bc936cd` requires
 * one e2e check that the routes respond when `LEADERBOARD_BACKEND` is
 * the default (`noop`). The Vitest suites cover every status code in
 * detail; this spec only confirms the bundled production build wires
 * the route handlers and serves them under the expected paths.
 *
 * The submit-route check intentionally hits the 500 path (no signing
 * key configured in CI). That is the deterministic response shape
 * with no env setup, which keeps the test stable across machines and
 * still proves the route is reachable. A future slice that wires a
 * fixed-key dev backend can flip the assertion to expect 200.
 */

test.describe("leaderboard routes (smoke)", () => {
  test("GET /api/leaderboard/[trackId] returns 200 with empty entries on noop", async ({
    request,
  }) => {
    const res = await request.get("/api/leaderboard/test%2Fstraight");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.trackId).toBe("test/straight");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test("GET /api/leaderboard/[trackId] returns 404 for an unknown track", async ({
    request,
  }) => {
    const res = await request.get("/api/leaderboard/nope%2Fnever");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("unknown-track");
  });

  test("POST /api/leaderboard/submit responds (signing key may be unset)", async ({
    request,
  }) => {
    const res = await request.post("/api/leaderboard/submit", {
      data: {
        trackId: "test/straight",
        carId: "sparrow-gt",
        lapMs: 100_000,
        raceToken: "smoke-token",
        signature: "f".repeat(64),
      },
    });
    // The route is wired and reachable. Two stable outcomes depending
    // on whether the deploy supplies LEADERBOARD_SIGNING_KEY:
    //   - 500 server-misconfigured (no key in CI; the default).
    //   - 401 bad-signature (key set, signature is a placeholder).
    expect([401, 500]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(["bad-signature", "server-misconfigured"]).toContain(body.code);
  });
});
