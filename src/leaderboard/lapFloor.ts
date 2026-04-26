/**
 * Plausibility floor for a single lap on a given (track, car) pair.
 *
 * Per the dot `VibeGear2-implement-leaderboard-route-2bc936cd` and
 * `docs/gdd/21-technical-design-for-web-implementation.md` "anti-cheat
 * sketch": the route handler rejects submissions whose `lapMs` is
 * strictly below the physical minimum a car could theoretically
 * complete the lap in, computed from the catalogue stats alone. The
 * formula is intentionally loose so legitimate hot laps with drafting,
 * nitro, and tail-wind never trip it; the floor is a coarse cheat
 * filter, not a tight upper bound on player skill.
 *
 * Formula: `floorLapMs = ceil(lengthMeters / topSpeed * 1000)`.
 *
 * Units:
 *   - `lengthMeters` is the track length in metres (`Track.lengthMeters`).
 *   - `topSpeed` is the car's catalogue top speed in metres per second
 *     (`Car.baseStats.topSpeed`; see `docs/gdd/23-balancing-tables.md`).
 *   - The 1000 multiplier converts seconds to milliseconds.
 *
 * `Math.ceil` rounds up so a lap that exactly hits the catalogue top
 * speed for the full lap (the theoretical lower bound) still validates;
 * one millisecond faster is unreachable and indicates a tampered
 * submission.
 *
 * Pure: deterministic in its inputs, no IO, no `Date.now`, no globals.
 * Lives next to `sign.ts` so the route handler imports both from the
 * same module surface.
 */

import { CARS_BY_ID } from "@/data/cars";
import { TRACK_RAW } from "@/data/tracks";
import { TrackSchema, type Track } from "@/data/schemas";

/**
 * Compute the lap-time floor in integer milliseconds for a track length
 * and a car top speed. Exported as the pure primitive so tests can pin
 * specific number combinations without going through the catalogue.
 *
 * Throws on non-positive inputs. Both fields are constrained positive
 * by the data schemas, so a thrown error here always indicates a bug
 * in the caller, not in user data.
 */
export function lapFloorMs(lengthMeters: number, topSpeed: number): number {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) {
    throw new Error(
      `lapFloorMs: lengthMeters must be a positive finite number, got ${lengthMeters}`,
    );
  }
  if (!Number.isFinite(topSpeed) || topSpeed <= 0) {
    throw new Error(
      `lapFloorMs: topSpeed must be a positive finite number, got ${topSpeed}`,
    );
  }
  return Math.ceil((lengthMeters / topSpeed) * 1000);
}

/**
 * Lookup result for a (trackId, carId) plausibility check. The route
 * handler returns `404` on `unknown-track` or `unknown-car` (the
 * submitter referenced bundled content the server cannot find), and
 * `422` on `lap-too-fast` (a real submission below the physical floor).
 */
export type SubmissionFloorCheck =
  | { kind: "ok" }
  | { kind: "unknown-track"; trackId: string }
  | { kind: "unknown-car"; carId: string }
  | { kind: "lap-too-fast"; floorMs: number; lapMs: number };

/**
 * Validate one submission's `(trackId, carId, lapMs)` triple against
 * the bundled content catalogue and the lap-time floor.
 *
 * The track lookup goes through `TrackSchema.safeParse` so a malformed
 * JSON in the bundle returns `unknown-track` instead of throwing; the
 * route handler turns that into a 404. This keeps a corrupt fixture
 * from crashing the route for every other request.
 */
export function checkSubmissionFloor(
  trackId: string,
  carId: string,
  lapMs: number,
): SubmissionFloorCheck {
  const rawTrack = TRACK_RAW[trackId];
  if (rawTrack === undefined) {
    return { kind: "unknown-track", trackId };
  }
  const parsed = TrackSchema.safeParse(rawTrack);
  if (!parsed.success) {
    return { kind: "unknown-track", trackId };
  }
  const track: Track = parsed.data;

  const car = CARS_BY_ID.get(carId);
  if (car === undefined) {
    return { kind: "unknown-car", carId };
  }

  const floorMs = lapFloorMs(track.lengthMeters, car.baseStats.topSpeed);
  if (lapMs < floorMs) {
    return { kind: "lap-too-fast", floorMs, lapMs };
  }
  return { kind: "ok" };
}
