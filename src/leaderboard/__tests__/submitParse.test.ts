/**
 * Unit tests for `src/leaderboard/submitParse.ts`.
 *
 * Coverage map:
 *
 *   - Happy path: a fully-populated body parses to the expected
 *     `LapSubmission`, with and without the optional `playerName`.
 *   - Every `SubmissionParseError` code is reachable from a hand-built
 *     malformed body so the route-handler tests can rely on the codes
 *     not silently disappearing.
 *   - Non-integer / negative / zero / NaN / Infinity `lapMs` all hit
 *     `lapMs-not-positive-integer`.
 *   - JSON syntax errors hit `not-json` rather than throwing.
 */

import { describe, expect, it } from "vitest";

import { parseSubmissionBody } from "../submitParse";

const VALID = {
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67_450,
  raceToken: "abc123",
  signature: "f".repeat(64),
};

describe("parseSubmissionBody", () => {
  it("parses a fully-populated body", () => {
    const result = parseSubmissionBody(JSON.stringify(VALID));
    expect(result).toEqual({ kind: "ok", value: VALID });
  });

  it("preserves an optional playerName", () => {
    const body = { ...VALID, playerName: "RAN" };
    const result = parseSubmissionBody(JSON.stringify(body));
    expect(result).toEqual({ kind: "ok", value: body });
  });

  it("rejects non-JSON input", () => {
    expect(parseSubmissionBody("not json")).toEqual({
      kind: "invalid",
      reason: "not-json",
    });
    expect(parseSubmissionBody("")).toEqual({
      kind: "invalid",
      reason: "not-json",
    });
  });

  it("rejects non-object JSON", () => {
    expect(parseSubmissionBody("null")).toEqual({
      kind: "invalid",
      reason: "not-object",
    });
    expect(parseSubmissionBody("[]")).toEqual({
      kind: "invalid",
      reason: "not-object",
    });
    expect(parseSubmissionBody('"string"')).toEqual({
      kind: "invalid",
      reason: "not-object",
    });
  });

  it("reports each missing required field with its own code", () => {
    const cases: Array<{ omit: keyof typeof VALID; reason: string }> = [
      { omit: "trackId", reason: "missing-trackId" },
      { omit: "carId", reason: "missing-carId" },
      { omit: "lapMs", reason: "missing-lapMs" },
      { omit: "raceToken", reason: "missing-raceToken" },
      { omit: "signature", reason: "missing-signature" },
    ];
    for (const { omit, reason } of cases) {
      const body: Record<string, unknown> = { ...VALID };
      delete body[omit];
      expect(parseSubmissionBody(JSON.stringify(body))).toEqual({
        kind: "invalid",
        reason,
      });
    }
  });

  it("rejects empty-string trackId/carId/raceToken/signature", () => {
    expect(
      parseSubmissionBody(JSON.stringify({ ...VALID, trackId: "" })),
    ).toEqual({ kind: "invalid", reason: "missing-trackId" });
    expect(
      parseSubmissionBody(JSON.stringify({ ...VALID, carId: "" })),
    ).toEqual({ kind: "invalid", reason: "missing-carId" });
    expect(
      parseSubmissionBody(JSON.stringify({ ...VALID, raceToken: "" })),
    ).toEqual({ kind: "invalid", reason: "missing-raceToken" });
    expect(
      parseSubmissionBody(JSON.stringify({ ...VALID, signature: "" })),
    ).toEqual({ kind: "invalid", reason: "missing-signature" });
  });

  it("rejects non-positive-integer lapMs values", () => {
    const bad: Array<unknown> = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "100",
      null,
    ];
    for (const lapMs of bad) {
      expect(
        parseSubmissionBody(JSON.stringify({ ...VALID, lapMs })),
      ).toEqual({ kind: "invalid", reason: "lapMs-not-positive-integer" });
    }
  });

  it("rejects non-string playerName", () => {
    expect(
      parseSubmissionBody(JSON.stringify({ ...VALID, playerName: 42 })),
    ).toEqual({ kind: "invalid", reason: "playerName-wrong-type" });
  });
});
