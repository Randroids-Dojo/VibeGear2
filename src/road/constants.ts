/**
 * Tunable constants for the pseudo-3D road renderer.
 *
 * Pinned by the research dot
 * `.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md` "Tunable constants
 * summary". All units are SI (meters, seconds) unless explicitly noted.
 *
 * Balancing slices may tune these values without re-reading the projector.
 * Any change here must be paired with a regeneration of the
 * `segmentProjector` golden tolerances.
 */

/** Half-width of the drivable road surface, in meters. Matches §9 "3 visual lanes". */
export const ROAD_WIDTH = 4.5;

/**
 * Length of one compiled segment, in meters.
 *
 * 6 m chosen because at 60 m/s the player advances exactly one segment per
 * 60 Hz tick, which gives smooth perceived motion. A fixed segment length
 * lets the projector iterate by index without per-segment length math.
 */
export const SEGMENT_LENGTH = 6;

/**
 * Number of compiled segments rendered ahead of the camera each frame.
 * 300 segments at 6 m = 1800 m of visible road, comfortable for a 100 deg
 * FOV. §16 "Cap draw distance adaptively"; this is the MVP cap.
 */
export const DRAW_DISTANCE = 300;

/** Horizontal field of view in degrees. Wide enough to feel fast. */
export const FOV_DEGREES = 100;

/** Camera height above the road surface, in meters. Slightly above hood. */
export const CAMERA_HEIGHT = 1.5;

/**
 * Pinhole camera depth, derived from FOV.
 *
 *   cameraDepth = 1 / tan((fov / 2) * pi / 180)
 *
 * For FOV 100 deg this is approximately 0.839.
 */
export const CAMERA_DEPTH = 1 / Math.tan((FOV_DEGREES / 2) * (Math.PI / 180));

/**
 * Authored `curve` field is divided by this scale to get per-compiled-segment
 * dx accumulator units. A `curve = 1.0` segment shifts roughly one road-width
 * per 100 segments at this scale.
 */
export const CURVATURE_SCALE = 100;

/** Compiled segments between alternating dark/light grass bands. */
export const GRASS_STRIPE_LEN = 3;

/** Compiled segments between alternating dark/light rumble bands. */
export const RUMBLE_STRIPE_LEN = 5;

/** Compiled segments between dashed-lane segments (visible/skip pattern). */
export const LANE_STRIPE_LEN = 8;

/**
 * Multiplier applied to the projection scale when sizing billboard sprites.
 * Phase 1 ships at 1.0; tune in §16 polish.
 */
export const SPRITE_BASE_SCALE = 1.0;

/** Default fill colors for the strip drawer. Tunable per region in later slices. */
export const DEFAULT_COLORS = {
  skyTop: "#0e1730",
  skyBottom: "#3b5a8c",
  grassLight: "#3a6d2a",
  grassDark: "#2f5a23",
  rumbleLight: "#dddddd",
  rumbleDark: "#bb2222",
  roadLight: "#5a5a5a",
  roadDark: "#525252",
  lane: "#e8e8e8",
  finishLight: "#ffffff",
  finishDark: "#101010",
} as const;
