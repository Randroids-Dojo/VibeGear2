/**
 * Shared types for the pseudo-3D road renderer.
 *
 * `Camera`, `Viewport`, `CompiledSegment`, and `Strip` form the contract
 * between the track compiler, the segment projector, and the Canvas2D
 * strip drawer. Keep this file dependency-free so tests can import it
 * without pulling in either the projector or the canvas drawer.
 */

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
 * `curve` is the per-segment dx contribution (already divided by
 * `CURVATURE_SCALE`). `grade` is the per-segment dy contribution
 * (in meters per compiled-segment), already multiplied by `SEGMENT_LENGTH`.
 *
 * `authoredRef` keeps a back-reference to the variable-length authored
 * segment so the renderer can look up roadside / hazard info at draw time
 * without re-reading the source `Track`.
 */
export interface CompiledSegment {
  index: number;
  worldZ: number;
  curve: number;
  grade: number;
  authoredRef: number;
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
  scale: number;
  /** Camera-space world x after curve accumulation, before projection. */
  worldX: number;
  /** Camera-space world y after grade accumulation, before projection. */
  worldY: number;
}
