/**
 * `POST /api/leaderboard/submit` handler.
 *
 * Owns the route-level glue between the pure leaderboard primitives
 * (`signSubmission`, `verifySubmission`, `parseSubmissionBody`,
 * `checkSubmissionFloor`, `resolveLeaderboardStore`) and an HTTP
 * `Request` / `Response`. Per the dot
 * `VibeGear2-implement-leaderboard-route-2bc936cd`:
 *
 *   - 200 on a verified, plausible submission stored (or attempted).
 *   - 401 on signature failure.
 *   - 404 on unknown track or unknown car (the submission references
 *     bundled content the server cannot resolve).
 *   - 422 on a malformed body or a lap time below the catalogue floor.
 *   - 500 only on missing server config (no signing key) so the client
 *     can distinguish "your submission is bad" from "the server is
 *     misconfigured". The 500 path never echoes the env-var name to
 *     the client.
 *
 * Why the discriminated union (instead of throwing): the four happy
 * paths (200) and four error paths (401, 404, 422, 500) all return a
 * stable JSON envelope `{ ok, code, message? }`. The Vitest tests pin
 * each `(status, code)` pair so a future refactor that breaks the
 * contract trips a test, not a real submission.
 *
 * Privacy: the response body never echoes the raceToken back, never
 * echoes the signature, and never includes the server's signing key.
 * `playerName` may appear in the response shape on success because the
 * client already submitted it.
 *
 * Edge / Node compatible: every dependency uses Web Crypto and the
 * `Request` / `Response` Web API, so the same handler runs under both
 * runtimes per AGENTS.md RULE 8. The Next App Router picks the runtime
 * based on `export const runtime = "nodejs"` below; we pin Node so the
 * `process.env` lookup matches the test environment exactly.
 */

import { NextResponse } from "next/server";

import { checkSubmissionFloor } from "@/leaderboard/lapFloor";
import { verifySubmission } from "@/leaderboard/sign";
import { resolveLeaderboardStore } from "@/leaderboard/store";
import { parseSubmissionBody } from "@/leaderboard/submitParse";

/**
 * Pin the runtime to Node so the `process.env.LEADERBOARD_SIGNING_KEY`
 * lookup behaves identically in dev, the Vitest suite, and the Vercel
 * deploy. A future Edge-runtime variant would read the key from a
 * different binding; we'd ship it as `runtime = "edge"` then.
 */
export const runtime = "nodejs";

/**
 * Disable the App Router's response cache: every submission is a write
 * and must reach the store. `dynamic = "force-dynamic"` also makes the
 * route opt out of static export, which matches the noop / KV split
 * described in `docs/gdd/21-technical-design-for-web-implementation.md`.
 */
export const dynamic = "force-dynamic";

/**
 * Stable response envelope for both happy and error paths. `code` is
 * the same string the Vitest tests assert on; `message` is human-
 * readable prose for the dev console and never load-bearing.
 */
type ResponseBody =
  | { ok: true; code: "stored"; id: string | null }
  | { ok: false; code: string; message?: string };

function json(status: number, body: ResponseBody): Response {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const signingKey = process.env.LEADERBOARD_SIGNING_KEY ?? "";
  if (signingKey.length === 0) {
    return json(500, {
      ok: false,
      code: "server-misconfigured",
      message: "Leaderboard signing key is not configured.",
    });
  }

  const rawBody = await request.text();
  const parsed = parseSubmissionBody(rawBody);
  if (parsed.kind === "invalid") {
    return json(422, { ok: false, code: parsed.reason });
  }
  const submission = parsed.value;

  const verified = await verifySubmission(submission, signingKey);
  if (!verified) {
    return json(401, { ok: false, code: "bad-signature" });
  }

  const floor = checkSubmissionFloor(
    submission.trackId,
    submission.carId,
    submission.lapMs,
  );
  if (floor.kind === "unknown-track") {
    return json(404, { ok: false, code: "unknown-track" });
  }
  if (floor.kind === "unknown-car") {
    return json(404, { ok: false, code: "unknown-car" });
  }
  if (floor.kind === "lap-too-fast") {
    return json(422, {
      ok: false,
      code: "lap-too-fast",
      message: `lapMs ${floor.lapMs} is below the floor ${floor.floorMs}`,
    });
  }

  const store = resolveLeaderboardStore();
  const id = await store.submit({
    trackId: submission.trackId,
    carId: submission.carId,
    lapMs: submission.lapMs,
    playerName: submission.playerName ?? null,
    submittedAt: Date.now(),
  });

  return json(200, { ok: true, code: "stored", id });
}
