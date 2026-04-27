/**
 * Track barrel registry.
 *
 * Browser-safe map of `slug` to raw `Track` JSON. Build-time JSON imports
 * mean these tracks ship in the client bundle without any filesystem I/O,
 * which makes them work under static export and Edge runtime alike.
 *
 * Add a new track by importing its JSON file and adding it to `TRACK_RAW`.
 * The Zod schema runs at `loadTrack` time, not at module-init, so a single
 * malformed track does not crash the title screen; the load call surfaces
 * the validation error to the caller instead.
 */

import testCurve from "./test-curve.json";
import testElevation from "./test-elevation.json";
import testStraight from "./test-straight.json";

export const TRACK_RAW: Readonly<Record<string, unknown>> = Object.freeze({
  "test/straight": testStraight,
  "test/curve": testCurve,
  "test/elevation": testElevation,
});

/** Sorted list of available track slugs for menu builders. */
export const TRACK_IDS: readonly string[] = Object.freeze(
  Object.keys(TRACK_RAW).sort(),
);
