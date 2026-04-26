/**
 * Vitest suite for the `POST /api/leaderboard/submit` route handler.
 *
 * Tests build a fake `Request` and call the exported `POST` directly,
 * matching the dot's "fake Request for each status code" requirement.
 * Coverage:
 *
 *   - 200 on a verified, plausible submission with the noop store.
 *   - 401 on signature failure.
 *   - 404 on unknown track and unknown car.
 *   - 422 on a malformed body and on a lap below the floor.
 *   - 500 when LEADERBOARD_SIGNING_KEY is unset.
 *
 * Each case sets / restores `process.env.LEADERBOARD_SIGNING_KEY` and
 * `process.env.LEADERBOARD_BACKEND` around the call so the suite is
 * order-independent and does not pollute sibling tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CARS_BY_ID } from "@/data/cars";
import { TrackSchema } from "@/data/schemas";
import { TRACK_RAW } from "@/data/tracks";
import { lapFloorMs } from "@/leaderboard/lapFloor";
import { signSubmission } from "@/leaderboard/sign";
import type { LapSubmission } from "@/leaderboard/types";

import { POST } from "../route";

const SIGNING_KEY = "test-signing-key-do-not-use-in-prod";
const TRACK_ID = "test/straight";
const CAR_ID = "sparrow-gt";
const RACE_TOKEN = "race-token-abc-123";

let savedSigningKey: string | undefined;
let savedBackend: string | undefined;

beforeEach(() => {
  savedSigningKey = process.env.LEADERBOARD_SIGNING_KEY;
  savedBackend = process.env.LEADERBOARD_BACKEND;
  process.env.LEADERBOARD_SIGNING_KEY = SIGNING_KEY;
  process.env.LEADERBOARD_BACKEND = "noop";
});

afterEach(() => {
  if (savedSigningKey === undefined) {
    delete process.env.LEADERBOARD_SIGNING_KEY;
  } else {
    process.env.LEADERBOARD_SIGNING_KEY = savedSigningKey;
  }
  if (savedBackend === undefined) {
    delete process.env.LEADERBOARD_BACKEND;
  } else {
    process.env.LEADERBOARD_BACKEND = savedBackend;
  }
});

function trackLengthMeters(): number {
  const raw = TRACK_RAW[TRACK_ID];
  if (raw === undefined) throw new Error("test fixture lost");
  return TrackSchema.parse(raw).lengthMeters;
}

function carTopSpeed(): number {
  const car = CARS_BY_ID.get(CAR_ID);
  if (car === undefined) throw new Error("test fixture lost");
  return car.baseStats.topSpeed;
}

async function buildSubmission(
  overrides: Partial<LapSubmission> = {},
  lapMs?: number,
): Promise<LapSubmission> {
  const floor = lapFloorMs(trackLengthMeters(), carTopSpeed());
  const finalLapMs = lapMs ?? floor + 30_000;
  const base = {
    trackId: TRACK_ID,
    carId: CAR_ID,
    lapMs: finalLapMs,
    raceToken: RACE_TOKEN,
  };
  const tupleSource = {
    trackId: overrides.trackId ?? base.trackId,
    carId: overrides.carId ?? base.carId,
    lapMs: overrides.lapMs ?? base.lapMs,
    raceToken: overrides.raceToken ?? base.raceToken,
  };
  const signature = await signSubmission(tupleSource, SIGNING_KEY);
  return { ...base, signature, ...overrides };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/leaderboard/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/leaderboard/submit", () => {
  it("returns 200 with code 'stored' on a verified submission", async () => {
    const submission = await buildSubmission();
    const res = await POST(buildRequest(submission));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.code).toBe("stored");
    expect(body.id).toBeNull();
  });

  it("accepts a submission that includes an optional playerName", async () => {
    const submission = await buildSubmission({ playerName: "RAN" });
    const res = await POST(buildRequest(submission));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 401 with code 'bad-signature' on a tampered field", async () => {
    const submission = await buildSubmission();
    const tampered = { ...submission, lapMs: submission.lapMs + 5_000 };
    const res = await POST(buildRequest(tampered));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("bad-signature");
  });

  it("returns 401 when the signature is the right shape but wrong bytes", async () => {
    const submission = await buildSubmission();
    const broken = { ...submission, signature: "0".repeat(64) };
    const res = await POST(buildRequest(broken));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("bad-signature");
  });

  it("returns 422 on a malformed JSON body", async () => {
    const res = await POST(buildRequest("not json at all"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("not-json");
  });

  it("returns 422 on a missing required field", async () => {
    const submission = await buildSubmission();
    const incomplete: Partial<LapSubmission> = { ...submission };
    delete incomplete.signature;
    const res = await POST(buildRequest(incomplete));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("missing-signature");
  });

  it("returns 404 with code 'unknown-track' for an unbundled track id", async () => {
    const submission = await buildSubmission({ trackId: "nope/never" });
    const res = await POST(buildRequest(submission));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("unknown-track");
  });

  it("returns 404 with code 'unknown-car' for an unbundled car id", async () => {
    const submission = await buildSubmission({ carId: "no-such-car" });
    const res = await POST(buildRequest(submission));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("unknown-car");
  });

  it("returns 422 with code 'lap-too-fast' below the floor", async () => {
    const floor = lapFloorMs(trackLengthMeters(), carTopSpeed());
    const submission = await buildSubmission({}, floor - 1);
    const res = await POST(buildRequest(submission));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("lap-too-fast");
  });

  it("returns 500 when LEADERBOARD_SIGNING_KEY is unset", async () => {
    delete process.env.LEADERBOARD_SIGNING_KEY;
    const res = await POST(
      buildRequest({
        trackId: TRACK_ID,
        carId: CAR_ID,
        lapMs: 100_000,
        raceToken: RACE_TOKEN,
        signature: "f".repeat(64),
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("server-misconfigured");
    expect(JSON.stringify(body)).not.toContain("LEADERBOARD_SIGNING_KEY");
  });
});
