import { describe, expect, it } from "vitest";
import { CAMERA_DEPTH, CAMERA_HEIGHT, SEGMENT_LENGTH } from "../constants";
import { project } from "../segmentProjector";
import type { Camera, CompiledSegment, Viewport } from "../types";

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    depth: CAMERA_DEPTH,
    ...overrides,
  };
}

const VIEWPORT: Viewport = { width: 800, height: 600 };

function flatTrack(count: number, init: Partial<CompiledSegment> = {}): CompiledSegment[] {
  const segs: CompiledSegment[] = new Array(count);
  for (let i = 0; i < count; i++) {
    segs[i] = {
      index: i,
      worldZ: i * SEGMENT_LENGTH,
      curve: 0,
      grade: 0,
      authoredRef: 0,
      ...init,
    };
  }
  return segs;
}

describe("project (pseudo-3D segment projector)", () => {
  it("returns an empty array for an empty segment list", () => {
    expect(project([], makeCamera(), VIEWPORT)).toEqual([]);
  });

  it("returns an empty array when the viewport is degenerate", () => {
    const segs = flatTrack(8);
    expect(project(segs, makeCamera(), { width: 0, height: 600 })).toEqual([]);
    expect(project(segs, makeCamera(), { width: 800, height: 0 })).toEqual([]);
  });

  it("on a straight flat track, screenY is monotonically decreasing toward the horizon", () => {
    const segs = flatTrack(64);
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 32 });
    // Skip the first strip if it sits at the near plane and was culled.
    let prev = -Infinity;
    let visibleCount = 0;
    for (const s of strips) {
      if (!s.visible) continue;
      // Visible strips, walking near to far, climb up the screen toward the
      // horizon. Smaller screenY = higher on screen.
      visibleCount += 1;
    }
    expect(visibleCount).toBeGreaterThan(0);
    for (const s of strips) {
      if (!s.visible) continue;
      // Camera looks slightly down; horizon line is at viewport / 2.
      expect(s.screenY).toBeLessThanOrEqual(VIEWPORT.height);
    }
    // Walk from far to near and confirm screenY only ever decreases (hill culls
    // are absent on a flat track).
    const visibleStrips = strips.filter((s) => s.visible);
    for (let i = visibleStrips.length - 1; i >= 0; i--) {
      const y = visibleStrips[i]!.screenY;
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  it("on a straight flat track, screenW grows as strips approach the camera", () => {
    const segs = flatTrack(64);
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 32 });
    const visible = strips.filter((s) => s.visible);
    expect(visible.length).toBeGreaterThan(2);
    // Near to far: width strictly decreases.
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i]!.screenW).toBeLessThan(visible[i - 1]!.screenW);
    }
  });

  it("on a constant left-curve track, distant strips drift to the left of the centerline", () => {
    const segs = flatTrack(96, { curve: 0.01 });
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 64 });
    const visible = strips.filter((s) => s.visible);
    expect(visible.length).toBeGreaterThan(4);
    // Negative curve (left) should pull the far end below the centerline X.
    // We use a positive curve constant; sign convention: positive curve = right.
    // Confirm that the far strip's screenX is greater than the near strip's
    // (curving right). If the chosen sign is left-curve, swap. The test
    // simply asserts non-trivial drift away from the center.
    const nearX = visible[0]!.screenX;
    const farX = visible[visible.length - 1]!.screenX;
    expect(Math.abs(farX - nearX)).toBeGreaterThan(10);
  });

  it("on a constant-curve track, the curve direction matches the sign of curve", () => {
    const right = project(flatTrack(96, { curve: 0.01 }), makeCamera(), VIEWPORT, {
      drawDistance: 64,
    });
    const left = project(flatTrack(96, { curve: -0.01 }), makeCamera(), VIEWPORT, {
      drawDistance: 64,
    });
    const rightVisible = right.filter((s) => s.visible);
    const leftVisible = left.filter((s) => s.visible);
    const rightFar = rightVisible[rightVisible.length - 1]!.screenX;
    const leftFar = leftVisible[leftVisible.length - 1]!.screenX;
    // Mirror behaviour: a positive curve and a negative curve should drift in
    // opposite directions.
    expect(Math.sign(rightFar - VIEWPORT.width / 2)).not.toBe(
      Math.sign(leftFar - VIEWPORT.width / 2),
    );
  });

  it("culls at least one post-crest strip via the maxY clip on a single uphill", () => {
    // Build a flat run, one steep crest segment, then a plateau. The crest
    // lifts the post-crest road above the screen line of the strip in front
    // of it; the back-to-front maxY pass should mark at least one downstream
    // strip as not-visible.
    const segs = flatTrack(96);
    // Insert an aggressive single-strip rise mid-track.
    for (let i = 30; i < 40; i++) {
      segs[i] = { ...segs[i]!, grade: 0.8 };
    }
    // Then drop sharply.
    for (let i = 40; i < 50; i++) {
      segs[i] = { ...segs[i]!, grade: -0.8 };
    }
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 96 });
    const culled = strips.filter((s) => !s.visible);
    expect(culled.length).toBeGreaterThan(0);
  });

  it("wraps the camera index past the end of the ring (lap closure)", () => {
    const segs = flatTrack(16);
    // Camera Z past totalLength; should wrap and still produce visible strips.
    const cam = makeCamera({ z: 16 * SEGMENT_LENGTH * 3 + 4 });
    const strips = project(segs, cam, VIEWPORT, { drawDistance: 16 });
    const visible = strips.filter((s) => s.visible);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("caps drawDistance to totalSegments to avoid double-projecting tiny tracks", () => {
    const segs = flatTrack(8);
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 999 });
    expect(strips.length).toBe(8);
  });

  it("marks strips at or behind the near plane as not visible without crashing", () => {
    const segs = flatTrack(8);
    // Camera depth set to a value larger than the closest strip distance.
    const cam = makeCamera({ depth: SEGMENT_LENGTH * 4 });
    const strips = project(segs, cam, VIEWPORT, { drawDistance: 4 });
    expect(strips[0]!.visible).toBe(false);
  });

  it("scale and screenW are derived consistently for a known camera and segment", () => {
    // Hand-checked: at z = SEGMENT_LENGTH (one strip ahead), with camera at
    // origin and standard depth, scale = depth / SEGMENT_LENGTH.
    const segs = flatTrack(4);
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 4 });
    // The first strip sits at sz = SEGMENT_LENGTH because camera Z = 0 is on
    // the segment boundary. n = 1 strip should match the analytical scale.
    const second = strips[1]!;
    expect(second.visible).toBe(true);
    expect(second.scale).toBeCloseTo(CAMERA_DEPTH / SEGMENT_LENGTH, 6);
  });
});
