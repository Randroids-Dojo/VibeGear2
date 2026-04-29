/**
 * Shared types for the pseudo-3D road renderer.
 *
 * `Camera`, `Viewport`, `CompiledSegment`, and `Strip` form the contract
 * between the track compiler, the segment projector, and the Canvas2D
 * strip drawer. Keep this file dependency-free so tests can import it
 * without pulling in either the projector or the canvas drawer.
 */

import type { TrackSpawn, WeatherOption } from "@/data/schemas";

/**
 * Virtual camera that the player car never visibly leaves.
 *
 * `cameraX` follows the player laterally with low-pass smoothing in the
 * runtime layer. `cameraZ` advances forward as the car drives. `cameraY`
 * holds the camera height above the local road surface. `cameraDepth` is
 * the pinhole projection depth derived from FOV, see `constants.ts`.
 */
export interface Camera {
  x: number;
  y: number;
  z: number;
  depth: number;
}

/** Viewport size in CSS pixels. Origin is top-left. */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * One compiled (fixed-length) road segment.
 *
 * `index` is the position of the segment in the compiled ring buffer.
 * `worldZ` is the cumulative position along travel direction in meters.
 *
 * `curve` is the per-segment dx contribution, post-scaled by the compiler
 * to `authoredCurve / CURVATURE_SCALE` so the projector can sum dx
 * directly without per-strip scale math. `grade` is the per-segment dy
 * contribution, post-scaled to `authoredGrade * SEGMENT_LENGTH` so the
 * projector can integrate vertical lift in compiled units.
 *
 * `authoredIndex` keeps a back-reference to the variable-length authored
 * segment so the renderer can look up roadside / hazard info at draw time
 * without re-reading the source `Track`.
 *
 * `roadsideLeftId`, `roadsideRightId`, and `hazardIds` are the authored
 * decoration ids for the strip. `hazardIds` is the same array reference
 * as the source authored segment's `hazards` array (frozen) to avoid
 * per-segment allocation.
 *
 * `inTunnel` and `tunnelMaterialId` are authored visual and audio metadata.
 * `hazardIds` can still contain `tunnel` for older content, but the
 * renderer and audio layer should prefer `inTunnel` once present.
 */
export interface CompiledSegment {
  index: number;
  worldZ: number;
  curve: number;
  grade: number;
  authoredIndex: number;
  roadsideLeftId: string;
  roadsideRightId: string;
  hazardIds: readonly string[];
  inTunnel?: boolean;
  tunnelMaterialId?: string;
}

/**
 * One compiled checkpoint, mapping the authored checkpoint to the compiled
 * segment index where it begins. The race-rules engine reads compiled
 * checkpoints exclusively; authored checkpoints are an authoring-only
 * concept.
 */
export interface CompiledCheckpoint {
  authoredIndex: number;
  compiledStart: number;
  label: string;
}

/**
 * One footprint point for the minimap polyline, normalised into the
 * `[0, 1]` unit square. Cached on the compiled track so the HUD never
 * re-runs the per-segment heading integration at draw time. See
 * `src/road/minimap.ts`.
 */
export interface CompiledMinimapPoint {
  x: number;
  y: number;
  segmentIndex: number;
}

/**
 * Output of `compileTrack`. Frozen at every depth so callers cannot
 * mutate it; see `deepFreeze` in `trackCompiler.ts`.
 *
 * `warnings` collects non-fatal lints. Hard errors throw
 * `TrackCompileError` instead.
 */
export interface CompiledTrack {
  trackId: string;
  totalLengthMeters: number;
  totalCompiledSegments: number;
  segments: readonly CompiledSegment[];
  checkpoints: readonly CompiledCheckpoint[];
  spawn: TrackSpawn;
  laps: number;
  laneCount: number;
  weatherOptions: readonly WeatherOption[];
  /**
   * §23 track difficulty rating in `[1, 5]`. Mirrored from the source
   * `Track.difficulty` so the race-finish wiring can resolve a per-track
   * `baseTrackReward` via `baseRewardForTrackDifficulty` without re-reading
   * the authored JSON. Same value as `Track.difficulty`; copied here to
   * keep the runtime path single-source from the compiled output.
   */
  difficulty: number;
  /**
   * Minimap polyline, one point per compiled segment, normalised into
   * the unit square. Honours `Track.minimapPoints` when supplied;
   * otherwise computed by `projectTrack` from segment headings.
   */
  minimapPoints: readonly CompiledMinimapPoint[];
  warnings: readonly string[];
}

/**
 * One strip of projected screen-space data, ready for the Canvas2D drawer.
 *
 * `null` projection means the strip is behind the near plane and should be
 * skipped. `screenX` is the road centerline x in CSS pixels. `screenY` is
 * the centerline y. `screenW` is the half-width of the road at this depth
 * in CSS pixels. `scale` is the projection scale factor (cameraDepth / sz)
 * which sprite billboards reuse.
 */
export interface Strip {
  segment: CompiledSegment;
  /** True if this strip projects in front of the near plane. */
  visible: boolean;
  screenX: number;
  screenY: number;
  screenW: number;
  /**
   * Optional foreground endpoint for the closest visible strip. When
   * present, the renderer uses this as the near edge of the first strip
   * pair instead of inventing foreground geometry outside projection.
   */
  foreground?: {
    screenX: number;
    screenY: number;
    screenW: number;
  };
  scale: number;
  /** Camera-space world x after curve accumulation, before projection. */
  worldX: number;
  /** Camera-space world y after grade accumulation, before projection. */
  worldY: number;
}
