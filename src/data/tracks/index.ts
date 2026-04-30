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
import breakwaterIslesGullPoint from "./breakwater-isles-gull-point.json";
import breakwaterIslesSealightShelf from "./breakwater-isles-sealight-shelf.json";
import breakwaterIslesStormSpan from "./breakwater-isles-storm-span.json";
import breakwaterIslesTidewire from "./breakwater-isles-tidewire.json";
import glassRidgeFrostrelay from "./glass-ridge-frostrelay.json";
import glassRidgeHollowCrest from "./glass-ridge-hollow-crest.json";
import glassRidgeSummitEcho from "./glass-ridge-summit-echo.json";
import glassRidgeWhitepass from "./glass-ridge-whitepass.json";
import neonMeridianAfterglowRun from "./neon-meridian-afterglow-run.json";
import neonMeridianArcBoulevard from "./neon-meridian-arc-boulevard.json";
import neonMeridianPrismCut from "./neon-meridian-prism-cut.json";
import neonMeridianSkylineDrain from "./neon-meridian-skyline-drain.json";
import mossFrontierMillstream from "./moss-frontier-millstream.json";
import mossFrontierMistbarrow from "./moss-frontier-mistbarrow.json";
import mossFrontierPineSwitchback from "./moss-frontier-pine-switchback.json";
import mossFrontierWetrootDrive from "./moss-frontier-wetroot-drive.json";
import ironBoroughFoundryMile from "./iron-borough-foundry-mile.json";
import ironBoroughFreightlineRing from "./iron-borough-freightline-ring.json";
import ironBoroughOuterExchange from "./iron-borough-outer-exchange.json";
import ironBoroughRivetTunnel from "./iron-borough-rivet-tunnel.json";
import emberSteppeCinderGate from "./ember-steppe-cinder-gate.json";
import emberSteppeDustbreakCauseway from "./ember-steppe-dustbreak-causeway.json";
import emberSteppeMesaCoil from "./ember-steppe-mesa-coil.json";
import emberSteppeRedglassStraight from "./ember-steppe-redglass-straight.json";
import velvetCoastClifflineArc from "./velvet-coast-cliffline-arc.json";
import velvetCoastHarborRun from "./velvet-coast-harbor-run.json";
import velvetCoastLighthouseFall from "./velvet-coast-lighthouse-fall.json";
import velvetCoastSunpierLoop from "./velvet-coast-sunpier-loop.json";

export const TRACK_RAW: Readonly<Record<string, unknown>> = Object.freeze({
  "test/straight": testStraight,
  "test/curve": testCurve,
  "test/elevation": testElevation,
  "breakwater-isles/tidewire": breakwaterIslesTidewire,
  "breakwater-isles/storm-span": breakwaterIslesStormSpan,
  "breakwater-isles/gull-point": breakwaterIslesGullPoint,
  "breakwater-isles/sealight-shelf": breakwaterIslesSealightShelf,
  "glass-ridge/whitepass": glassRidgeWhitepass,
  "glass-ridge/frostrelay": glassRidgeFrostrelay,
  "glass-ridge/hollow-crest": glassRidgeHollowCrest,
  "glass-ridge/summit-echo": glassRidgeSummitEcho,
  "neon-meridian/arc-boulevard": neonMeridianArcBoulevard,
  "neon-meridian/prism-cut": neonMeridianPrismCut,
  "neon-meridian/skyline-drain": neonMeridianSkylineDrain,
  "neon-meridian/afterglow-run": neonMeridianAfterglowRun,
  "moss-frontier/pine-switchback": mossFrontierPineSwitchback,
  "moss-frontier/millstream": mossFrontierMillstream,
  "moss-frontier/wetroot-drive": mossFrontierWetrootDrive,
  "moss-frontier/mistbarrow": mossFrontierMistbarrow,
  "velvet-coast/harbor-run": velvetCoastHarborRun,
  "velvet-coast/sunpier-loop": velvetCoastSunpierLoop,
  "velvet-coast/cliffline-arc": velvetCoastClifflineArc,
  "velvet-coast/lighthouse-fall": velvetCoastLighthouseFall,
  "iron-borough/freightline-ring": ironBoroughFreightlineRing,
  "iron-borough/rivet-tunnel": ironBoroughRivetTunnel,
  "iron-borough/foundry-mile": ironBoroughFoundryMile,
  "iron-borough/outer-exchange": ironBoroughOuterExchange,
  "ember-steppe/redglass-straight": emberSteppeRedglassStraight,
  "ember-steppe/mesa-coil": emberSteppeMesaCoil,
  "ember-steppe/dustbreak-causeway": emberSteppeDustbreakCauseway,
  "ember-steppe/cinder-gate": emberSteppeCinderGate,
});

/** Sorted list of available track slugs for menu builders. */
export const TRACK_IDS: readonly string[] = Object.freeze(
  Object.keys(TRACK_RAW).sort(),
);
