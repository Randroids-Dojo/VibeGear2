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
import ironBoroughFoundryMile from "./iron-borough-foundry-mile.json";
import ironBoroughFreightlineRing from "./iron-borough-freightline-ring.json";
import ironBoroughOuterExchange from "./iron-borough-outer-exchange.json";
import ironBoroughRivetTunnel from "./iron-borough-rivet-tunnel.json";
import velvetCoastClifflineArc from "./velvet-coast-cliffline-arc.json";
import velvetCoastHarborRun from "./velvet-coast-harbor-run.json";
import velvetCoastLighthouseFall from "./velvet-coast-lighthouse-fall.json";
import velvetCoastSunpierLoop from "./velvet-coast-sunpier-loop.json";

export const TRACK_RAW: Readonly<Record<string, unknown>> = Object.freeze({
  "test/straight": testStraight,
  "test/curve": testCurve,
  "test/elevation": testElevation,
  "velvet-coast/harbor-run": velvetCoastHarborRun,
  "velvet-coast/sunpier-loop": velvetCoastSunpierLoop,
  "velvet-coast/cliffline-arc": velvetCoastClifflineArc,
  "velvet-coast/lighthouse-fall": velvetCoastLighthouseFall,
  "iron-borough/freightline-ring": ironBoroughFreightlineRing,
  "iron-borough/rivet-tunnel": ironBoroughRivetTunnel,
  "iron-borough/foundry-mile": ironBoroughFoundryMile,
  "iron-borough/outer-exchange": ironBoroughOuterExchange,
});

/** Sorted list of available track slugs for menu builders. */
export const TRACK_IDS: readonly string[] = Object.freeze(
  Object.keys(TRACK_RAW).sort(),
);
