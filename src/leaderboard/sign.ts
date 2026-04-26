/**
 * HMAC-SHA-256 signing for optional online leaderboard submissions.
 *
 * The flow per `docs/gdd/21-technical-design-for-web-implementation.md`
 * "signed lap submission concept":
 *
 *   1. The server issues a unique `raceToken` at race start (any opaque
 *      string; 24 random chars is plenty).
 *   2. The client races, computes its best `lapMs`, builds a canonical
 *      tuple of `(trackId, carId, lapMs, raceToken)`, and HMAC-SHA-256s
 *      it with the shared secret.
 *   3. The submission carries both the fields and the hex signature.
 *   4. The route handler reconstructs the canonical tuple from the
 *      submitted fields, recomputes the signature, and compares with a
 *      timing-safe equality check.
 *
 * Anti-cheat is an optional second layer (rate limits, plausibility
 * caps); the signature itself only proves the submitter held the secret
 * for that race. The shared secret comes from `LEADERBOARD_SIGNING_KEY`
 * server-side only and never crosses the wire to the client; the client
 * receives the secret only as part of the server-issued race token
 * payload (a future slice owns the token-issuance route).
 *
 * Web Crypto, not Node `crypto`, so the same module runs under both the
 * Node test environment and the Edge runtime per AGENTS.md RULE 8.
 *
 * Pure: every function is deterministic in its inputs (the signature is
 * a pure function of `tuple + secret`). No `Date.now()`, no PRNG. The
 * tests pin a reference signature so a future canonicalization or
 * algorithm change cannot quietly invalidate every existing submission.
 */

import type { LapSubmission } from "./types";

/**
 * The fields whose tuple is hashed. Pulled out as a type so a future
 * field addition (e.g. a per-lap checksum, a sector-time bundle) can
 * extend the tuple at a single location and the canonical form below
 * picks the new field up automatically.
 *
 * Order is load-bearing. Adding a new field must append, never reorder
 * or insert, so existing signatures stay valid.
 */
export interface CanonicalTupleSource {
  trackId: string;
  carId: string;
  lapMs: number;
  raceToken: string;
}

/**
 * Build the canonical string the signature is computed over.
 *
 * Format: each field rendered as a quoted JSON string, joined with `|`.
 * `lapMs` is integer-coerced via `Math.trunc` so a float that rounded
 * differently on two clients still produces the same canonical bytes.
 *
 * Why not `JSON.stringify(tuple)`: JSON's object-key ordering is
 * implementation-defined in older runtimes, and a future field rename
 * would silently change every signature. The explicit join is stable
 * and easy to audit.
 *
 * Why quote each field: a `|` inside `playerName` (not in the tuple
 * today, but a sibling field tomorrow) cannot be confused with the
 * separator. The quoting uses `JSON.stringify` so the standard string
 * escapes apply.
 */
export function canonicalize(source: CanonicalTupleSource): string {
  const trackId = JSON.stringify(source.trackId);
  const carId = JSON.stringify(source.carId);
  const lapMs = JSON.stringify(Math.trunc(source.lapMs));
  const raceToken = JSON.stringify(source.raceToken);
  return `${trackId}|${carId}|${lapMs}|${raceToken}`;
}

const encoder = new TextEncoder();

/**
 * Convert a `Uint8Array` to a lowercase hex string. Browsers and
 * recent Node both ship `Uint8Array.prototype.toHex`, but the proposal
 * is not in the lib target this repo compiles against; the manual loop
 * works everywhere with no allocations beyond the result string.
 */
function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    out += (byte < 16 ? "0" : "") + byte.toString(16);
  }
  return out;
}

/**
 * Convert a lowercase hex string back to bytes. The inverse of
 * `bytesToHex`. Throws on odd length or non-hex characters so the
 * caller's signature-comparison path can fail loudly.
 */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(
      `hexToBytes: input length must be even, got ${hex.length}`,
    );
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(
        `hexToBytes: non-hex byte at offset ${i * 2}: "${hex.substring(i * 2, i * 2 + 2)}"`,
      );
    }
    out[i] = byte;
  }
  return out;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Compute the HMAC-SHA-256 of the canonical tuple, hex-encoded.
 *
 * Async because `crypto.subtle` is async on every supported runtime.
 * The route handler awaits this once per submission.
 */
export async function signSubmission(
  source: CanonicalTupleSource,
  secret: string,
): Promise<string> {
  if (secret.length === 0) {
    throw new Error("signSubmission: secret must be a non-empty string");
  }
  const key = await importSigningKey(secret);
  const message = encoder.encode(canonicalize(source));
  const signature = await crypto.subtle.sign("HMAC", key, message);
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Constant-time byte-array comparison. Returns false on any length
 * mismatch (which is itself a leak, but a benign one: the attacker
 * already controls the submitted signature length).
 *
 * The loop runs the full length on equal-length inputs so the comparison
 * cost does not vary with the position of the first mismatching byte.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}

/**
 * Verify a `LapSubmission` against the shared secret.
 *
 * Returns `true` only when every field of the canonical tuple matches
 * the signature. Any tampered field (trackId, carId, lapMs, raceToken)
 * fails verification because the canonical string changes.
 *
 * Returns `false` (never throws) on hex-decoding failures so the route
 * handler can return a single `401` for any signature problem and never
 * leak which specific check failed.
 */
export async function verifySubmission(
  submission: LapSubmission,
  secret: string,
): Promise<boolean> {
  let submitted: Uint8Array;
  try {
    submitted = hexToBytes(submission.signature);
  } catch {
    return false;
  }
  let expectedHex: string;
  try {
    expectedHex = await signSubmission(submission, secret);
  } catch {
    return false;
  }
  const expected = hexToBytes(expectedHex);
  return timingSafeEqual(expected, submitted);
}
