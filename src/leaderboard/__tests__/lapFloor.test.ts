/**
 * Unit tests for `src/leaderboard/lapFloor.ts`.
 *
 * Covers:
 *
 *   - `lapFloorMs` arithmetic on hand-picked values.
 *   - `lapFloorMs` rejects non-positive / non-finite inputs (defensive
 *     even though the data schemas already constrain these).
 *   - `checkSubmissionFloor` reports `unknown-track` and `unknown-car`
 *     for ids missing from the bundled catalogues.
 *   - `checkSubmissionFloor` accepts a lap exactly at the floor and
 *     rejects one millisecond below.
 */

import { describe, expect, it } from "vitest";

import { CARS_BY_ID } from "@/data/cars";
import { TrackSchema } from "@/data/schemas";
import { TRACK_RAW } from "@/data/tracks";

import { checkSubmissionFloor, lapFloorMs } from "../lapFloor";

const KNOWN_TRACK_ID = "test/straight";
const KNOWN_CAR_ID = "sparrow-gt";

function knownTrackLengthMeters(): number {
  const raw = TRACK_RAW[KNOWN_TRACK_ID];
  if (raw === undefined) {
    throw new Error("test fixture lost: test/straight not registered");
  }
  return TrackSchema.parse(raw).lengthMeters;
}

function knownCarTopSpeed(): number {
  const car = CARS_BY_ID.get(KNOWN_CAR_ID);
  if (car === undefined) {
    throw new Error("test fixture lost: sparrow-gt not registered");
  }
  return car.baseStats.topSpeed;
}

describe("lapFloorMs", () => {
  it("computes floor = ceil(length / topSpeed * 1000)", () => {
    expect(lapFloorMs(1200, 60)).toBe(20_000);
    expect(lapFloorMs(1500, 50)).toBe(30_000);
  });

  it("rounds up rather than down so the integer floor is reachable", () => {
    expect(lapFloorMs(1000, 33)).toBe(Math.ceil((1000 / 33) * 1000));
  });

  it("rejects non-positive lengths", () => {
    expect(() => lapFloorMs(0, 60)).toThrow(/lengthMeters/);
    expect(() => lapFloorMs(-1, 60)).toThrow(/lengthMeters/);
    expect(() => lapFloorMs(Number.NaN, 60)).toThrow(/lengthMeters/);
    expect(() => lapFloorMs(Number.POSITIVE_INFINITY, 60)).toThrow(
      /lengthMeters/,
    );
  });

  it("rejects non-positive top speeds", () => {
    expect(() => lapFloorMs(1200, 0)).toThrow(/topSpeed/);
    expect(() => lapFloorMs(1200, -1)).toThrow(/topSpeed/);
    expect(() => lapFloorMs(1200, Number.NaN)).toThrow(/topSpeed/);
  });
});

describe("checkSubmissionFloor", () => {
  it("returns unknown-track for an unbundled track id", () => {
    const result = checkSubmissionFloor("nope/never", KNOWN_CAR_ID, 100_000);
    expect(result).toEqual({ kind: "unknown-track", trackId: "nope/never" });
  });

  it("returns unknown-car for an unbundled car id", () => {
    const result = checkSubmissionFloor(KNOWN_TRACK_ID, "no-such-car", 100_000);
    expect(result).toEqual({ kind: "unknown-car", carId: "no-such-car" });
  });

  it("accepts a lap exactly at the floor", () => {
    const floor = lapFloorMs(knownTrackLengthMeters(), knownCarTopSpeed());
    const result = checkSubmissionFloor(KNOWN_TRACK_ID, KNOWN_CAR_ID, floor);
    expect(result).toEqual({ kind: "ok" });
  });

  it("rejects a lap one millisecond below the floor", () => {
    const floor = lapFloorMs(knownTrackLengthMeters(), knownCarTopSpeed());
    const result = checkSubmissionFloor(
      KNOWN_TRACK_ID,
      KNOWN_CAR_ID,
      floor - 1,
    );
    expect(result.kind).toBe("lap-too-fast");
    if (result.kind === "lap-too-fast") {
      expect(result.floorMs).toBe(floor);
      expect(result.lapMs).toBe(floor - 1);
    }
  });

  it("accepts a lap well above the floor (real-race scenario)", () => {
    const floor = lapFloorMs(knownTrackLengthMeters(), knownCarTopSpeed());
    const result = checkSubmissionFloor(
      KNOWN_TRACK_ID,
      KNOWN_CAR_ID,
      floor + 30_000,
    );
    expect(result).toEqual({ kind: "ok" });
  });
});
