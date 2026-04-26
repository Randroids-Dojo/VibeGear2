/**
 * Unit tests for `src/leaderboard/sign.ts`.
 *
 * Coverage map:
 *
 *   - `canonicalize` is stable: the same source produces the same
 *     string; field order on the input object does not matter; lapMs
 *     is integer-truncated.
 *
 *   - Reference signature: `signSubmission` over a pinned tuple matches
 *     a hex value computed with the standard HMAC-SHA-256 spec. Pin so
 *     a future canonicalization or algorithm change cannot quietly
 *     invalidate every existing signature.
 *
 *   - Determinism: signing the same source twice with the same secret
 *     produces byte-equal hex.
 *
 *   - Round-trip: sign + verify accepts the unmodified submission.
 *
 *   - Tamper detection per field: flipping `trackId`, `carId`, `lapMs`,
 *     or `raceToken` (the four canonical-tuple fields) makes
 *     `verifySubmission` return false. Flipping `playerName` (which is
 *     outside the tuple by design) does not invalidate the signature;
 *     this is correct behaviour because handles are display-only.
 *
 *   - Wrong secret: same submission with the wrong secret fails.
 *
 *   - Bad signature shape: odd-length hex, non-hex characters, empty
 *     string all return false (never throw).
 *
 *   - `signSubmission` rejects an empty secret in dev (loud failure
 *     per AGENTS.md).
 */

import { describe, expect, it } from "vitest";

import {
  canonicalize,
  signSubmission,
  verifySubmission,
} from "../sign";
import type { LapSubmission } from "../types";

const SECRET = "test-secret-key-do-not-use-in-prod";

const REFERENCE_SOURCE = {
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67450,
  raceToken: "abc123",
} as const;

/**
 * Reference HMAC-SHA-256 hex of the canonical string for
 * `REFERENCE_SOURCE` keyed by `SECRET`. Computed once with the spec
 * algorithm; pin so a future canonicalization or algorithm change is
 * detected by the test rather than discovered by a real submission.
 *
 * The canonical string is:
 *   "test/straight"|"sparrow-gt"|67450|"abc123"
 */
const REFERENCE_SIGNATURE_HEX =
  "f2cac27da351764e1856e20066988de22a8565d30e36e001652ccf1880f6d924";

function makeSubmission(
  overrides: Partial<LapSubmission> = {},
): LapSubmission {
  return {
    trackId: REFERENCE_SOURCE.trackId,
    carId: REFERENCE_SOURCE.carId,
    lapMs: REFERENCE_SOURCE.lapMs,
    raceToken: REFERENCE_SOURCE.raceToken,
    signature: "placeholder",
    ...overrides,
  };
}

describe("canonicalize", () => {
  it("is stable across input-object property order", () => {
    const a = canonicalize({
      trackId: "t",
      carId: "c",
      lapMs: 100,
      raceToken: "tok",
    });
    const b = canonicalize({
      raceToken: "tok",
      lapMs: 100,
      carId: "c",
      trackId: "t",
    });
    expect(a).toBe(b);
  });

  it("emits the documented format", () => {
    const out = canonicalize(REFERENCE_SOURCE);
    expect(out).toBe('"test/straight"|"sparrow-gt"|67450|"abc123"');
  });

  it("integer-truncates lapMs so float drift does not change the tuple", () => {
    const exact = canonicalize({ ...REFERENCE_SOURCE, lapMs: 67450 });
    const drifted = canonicalize({ ...REFERENCE_SOURCE, lapMs: 67450.7 });
    expect(exact).toBe(drifted);
  });

  it("escapes embedded quotes safely", () => {
    const out = canonicalize({
      trackId: 'has"quote',
      carId: "c",
      lapMs: 1,
      raceToken: "t",
    });
    expect(out).toBe('"has\\"quote"|"c"|1|"t"');
  });
});

describe("signSubmission", () => {
  it("matches the pinned reference signature", async () => {
    const sig = await signSubmission(REFERENCE_SOURCE, SECRET);
    expect(sig).toBe(REFERENCE_SIGNATURE_HEX);
  });

  it("is deterministic on identical inputs", async () => {
    const a = await signSubmission(REFERENCE_SOURCE, SECRET);
    const b = await signSubmission(REFERENCE_SOURCE, SECRET);
    expect(a).toBe(b);
  });

  it("changes when any tuple field changes", async () => {
    const base = await signSubmission(REFERENCE_SOURCE, SECRET);
    const variants = [
      { ...REFERENCE_SOURCE, trackId: "test/curve" },
      { ...REFERENCE_SOURCE, carId: "other-car" },
      { ...REFERENCE_SOURCE, lapMs: REFERENCE_SOURCE.lapMs + 1 },
      { ...REFERENCE_SOURCE, raceToken: "xyz789" },
    ];
    for (const v of variants) {
      const sig = await signSubmission(v, SECRET);
      expect(sig).not.toBe(base);
    }
  });

  it("changes when the secret changes", async () => {
    const a = await signSubmission(REFERENCE_SOURCE, SECRET);
    const b = await signSubmission(REFERENCE_SOURCE, SECRET + "x");
    expect(a).not.toBe(b);
  });

  it("rejects an empty secret", async () => {
    await expect(signSubmission(REFERENCE_SOURCE, "")).rejects.toThrow(
      /non-empty/,
    );
  });

  it("returns lowercase hex of the expected length", async () => {
    const sig = await signSubmission(REFERENCE_SOURCE, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifySubmission", () => {
  it("accepts an unmodified round-trip", async () => {
    const signature = await signSubmission(REFERENCE_SOURCE, SECRET);
    const ok = await verifySubmission(makeSubmission({ signature }), SECRET);
    expect(ok).toBe(true);
  });

  it("rejects every individually tampered tuple field", async () => {
    const signature = await signSubmission(REFERENCE_SOURCE, SECRET);
    const tampered: ReadonlyArray<Partial<LapSubmission>> = [
      { trackId: "test/curve" },
      { carId: "other-car" },
      { lapMs: REFERENCE_SOURCE.lapMs + 1 },
      { raceToken: "xyz789" },
    ];
    for (const fields of tampered) {
      const submission = makeSubmission({ ...fields, signature });
      const ok = await verifySubmission(submission, SECRET);
      expect(ok).toBe(false);
    }
  });

  it("ignores playerName because it is outside the canonical tuple", async () => {
    const signature = await signSubmission(REFERENCE_SOURCE, SECRET);
    const ok = await verifySubmission(
      makeSubmission({ signature, playerName: "anyone" }),
      SECRET,
    );
    expect(ok).toBe(true);
  });

  it("rejects when the secret is wrong", async () => {
    const signature = await signSubmission(REFERENCE_SOURCE, SECRET);
    const ok = await verifySubmission(
      makeSubmission({ signature }),
      "wrong-secret",
    );
    expect(ok).toBe(false);
  });

  it("returns false (never throws) on malformed signatures", async () => {
    const cases = ["", "abc", "not-hex-zz", "f".repeat(63), "f".repeat(65)];
    for (const sig of cases) {
      const ok = await verifySubmission(
        makeSubmission({ signature: sig }),
        SECRET,
      );
      expect(ok).toBe(false);
    }
  });
});
