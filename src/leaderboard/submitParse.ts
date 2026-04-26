/**
 * Parse-and-validate a raw POST body into a `LapSubmission` shape.
 *
 * The route handler calls this before any signature work or store
 * lookup so an obviously malformed body never hits the
 * (potentially expensive) signature path. Returns a discriminated
 * union: `{ kind: "ok", value }` on success, `{ kind: "invalid", reason }`
 * for the route handler to turn into a 422 with a stable error code.
 *
 * Why a hand-rolled validator instead of Zod: the leaderboard module
 * is the only consumer in the repo today, the shape has six fields,
 * and the reasons need stable string codes for the e2e smoke. A
 * single Zod schema would also work; it would just couple the route
 * shape to the type module that the client adapter imports too.
 *
 * Pure: no IO, no throws (every malformed input is reported via the
 * union). The route handler tests pin every reason code below.
 */

import type { LapSubmission } from "./types";

/**
 * Stable string codes for every "invalid body" reason. Kept narrow so
 * the route handler tests can assert on the exact value, and so a
 * future client adapter can branch on the same set without parsing
 * free-form prose.
 */
export type SubmissionParseError =
  | "not-json"
  | "not-object"
  | "missing-trackId"
  | "missing-carId"
  | "missing-lapMs"
  | "missing-raceToken"
  | "missing-signature"
  | "lapMs-not-positive-integer"
  | "playerName-wrong-type";

export type SubmissionParseResult =
  | { kind: "ok"; value: LapSubmission }
  | { kind: "invalid"; reason: SubmissionParseError };

function isPositiveFiniteInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * Parse a raw request body string into a `LapSubmission`. The route
 * handler reads the raw text first so a non-JSON body produces a
 * clean `not-json` error instead of leaking the JSON parser's prose.
 */
export function parseSubmissionBody(rawBody: string): SubmissionParseResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { kind: "invalid", reason: "not-json" };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { kind: "invalid", reason: "not-object" };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.trackId !== "string" || obj.trackId.length === 0) {
    return { kind: "invalid", reason: "missing-trackId" };
  }
  if (typeof obj.carId !== "string" || obj.carId.length === 0) {
    return { kind: "invalid", reason: "missing-carId" };
  }
  if (!("lapMs" in obj)) {
    return { kind: "invalid", reason: "missing-lapMs" };
  }
  if (!isPositiveFiniteInteger(obj.lapMs)) {
    return { kind: "invalid", reason: "lapMs-not-positive-integer" };
  }
  if (typeof obj.raceToken !== "string" || obj.raceToken.length === 0) {
    return { kind: "invalid", reason: "missing-raceToken" };
  }
  if (typeof obj.signature !== "string" || obj.signature.length === 0) {
    return { kind: "invalid", reason: "missing-signature" };
  }

  let playerName: string | undefined;
  if (obj.playerName !== undefined) {
    if (typeof obj.playerName !== "string") {
      return { kind: "invalid", reason: "playerName-wrong-type" };
    }
    playerName = obj.playerName;
  }

  const value: LapSubmission = {
    trackId: obj.trackId,
    carId: obj.carId,
    lapMs: obj.lapMs,
    raceToken: obj.raceToken,
    signature: obj.signature,
    ...(playerName !== undefined ? { playerName } : {}),
  };
  return { kind: "ok", value };
}
