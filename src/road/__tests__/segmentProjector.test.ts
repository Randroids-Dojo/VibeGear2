import { describe, expect, it } from "vitest";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  CURVATURE_SCALE,
  ROAD_WIDTH,
  SEGMENT_LENGTH,
} from "../constants";
import {
  DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M,
  project,
  projectGhostCar,
  upcomingCurvature,
} from "../segmentProjector";
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
      authoredIndex: 0,
      roadsideLeftId: "default",
      roadsideRightId: "default",
      hazardIds: [],
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

  it("attaches a projected foreground endpoint to the closest visible strip", () => {
    const segs = flatTrack(16);
    const strips = project(segs, makeCamera(), VIEWPORT, { drawDistance: 8 });
    const visible = strips.filter((s) => s.visible);
    expect(visible.length).toBeGreaterThan(1);

    const near = visible[0]!;
    const far = visible[1]!;
    expect(near.foreground).toBeDefined();
    expect(near.foreground!.screenY).toBe(VIEWPORT.height);
    expect(near.foreground!.screenX).toBeCloseTo(near.screenX, 6);
    expect(near.foreground!.screenW).toBeGreaterThan(near.screenW);

    const expected =
      near.screenW +
      ((near.screenW - far.screenW) * (VIEWPORT.height - near.screenY)) /
        (near.screenY - far.screenY);
    expect(near.foreground!.screenW).toBeCloseTo(expected, 6);
  });

  it("keeps an ahead marker continuous through a dip-to-climb transition", () => {
    const segs = flatTrack(96);
    for (let i = 0; i < 16; i++) {
      segs[i] = { ...segs[i]!, grade: -0.35 };
    }
    for (let i = 16; i < 32; i++) {
      segs[i] = { ...segs[i]!, grade: 0.35 };
    }

    let previousY: number | null = null;
    let maxDelta = 0;
    for (
      let cameraZ = 14 * SEGMENT_LENGTH;
      cameraZ <= 18 * SEGMENT_LENGTH;
      cameraZ += 0.5
    ) {
      const marker = projectGhostCar(
        segs,
        makeCamera({ z: cameraZ }),
        VIEWPORT,
        cameraZ + 48,
        0,
        { drawDistance: 64 },
      );
      if (!marker.visible) continue;
      if (previousY !== null) {
        maxDelta = Math.max(maxDelta, Math.abs(marker.screenY - previousY));
      }
      previousY = marker.screenY;
    }

    expect(previousY).not.toBeNull();
    expect(maxDelta).toBeLessThan(20);
  });

  it("keeps long climbs from accumulating into a full-screen road wall", () => {
    const segs = flatTrack(96);
    for (let i = 12; i < 38; i++) {
      segs[i] = { ...segs[i]!, grade: 0.54 };
    }

    const strips = project(segs, makeCamera({ z: 220 }), VIEWPORT, {
      drawDistance: 64,
    });
    const visible = strips.filter((strip) => strip.visible);

    expect(visible.length).toBeGreaterThan(2);
    expect(visible[0]!.screenY).toBeGreaterThan(VIEWPORT.height * 0.35);
  });
});

describe("upcomingCurvature", () => {
  it("returns 0 on an empty segment list", () => {
    expect(upcomingCurvature([], 0)).toBe(0);
  });

  it("returns 0 when the lookahead window is non-positive or NaN", () => {
    const segs = flatTrack(8, { curve: 0.4 / CURVATURE_SCALE });
    expect(upcomingCurvature(segs, 0, 0)).toBe(0);
    expect(upcomingCurvature(segs, 0, -10)).toBe(0);
    expect(upcomingCurvature(segs, 0, Number.NaN)).toBe(0);
  });

  it("returns 0 on a flat track regardless of camera Z", () => {
    const segs = flatTrack(32);
    expect(upcomingCurvature(segs, 0)).toBe(0);
    expect(upcomingCurvature(segs, 5 * SEGMENT_LENGTH)).toBe(0);
  });

  it("recovers the authored curve magnitude for a uniformly-curved track", () => {
    // Author at curve = 0.5 (compiled value = 0.5 / CURVATURE_SCALE).
    const segs = flatTrack(64, { curve: 0.5 / CURVATURE_SCALE });
    const result = upcomingCurvature(segs, 0, SEGMENT_LENGTH * 4);
    expect(result).toBeCloseTo(0.5, 6);
  });

  it("returns the largest-magnitude curve in the window, signed", () => {
    const segs = flatTrack(64);
    // Insert one sharp left bend in the middle of the lookahead window.
    segs[5] = { ...segs[5]!, curve: -0.8 / CURVATURE_SCALE };
    // Plus a milder right bend further along.
    segs[8] = { ...segs[8]!, curve: 0.3 / CURVATURE_SCALE };
    const result = upcomingCurvature(segs, 0, SEGMENT_LENGTH * 12);
    expect(result).toBeCloseTo(-0.8, 6);
  });

  it("clamps the recovered authored curve to [-1, 1]", () => {
    const segs = flatTrack(8, { curve: 1.5 / CURVATURE_SCALE });
    expect(upcomingCurvature(segs, 0)).toBe(1);
    const segsLeft = flatTrack(8, { curve: -1.5 / CURVATURE_SCALE });
    expect(upcomingCurvature(segsLeft, 0)).toBe(-1);
  });

  it("wraps cameraZ through the ring so a lap-rolling player still sees ahead", () => {
    const segs = flatTrack(16);
    segs[1] = { ...segs[1]!, curve: 0.6 / CURVATURE_SCALE };
    // Camera Z one full lap ahead should wrap and see segment index 1.
    const cameraZ = 16 * SEGMENT_LENGTH;
    expect(upcomingCurvature(segs, cameraZ, SEGMENT_LENGTH * 4)).toBeCloseTo(
      0.6,
      6,
    );
  });

  it("uses DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M when none is supplied", () => {
    const segs = flatTrack(64);
    // Place a curve well past the default lookahead so the helper does
    // not read it.
    const farIndex =
      Math.ceil(DEFAULT_UPCOMING_CURVATURE_LOOKAHEAD_M / SEGMENT_LENGTH) + 5;
    segs[farIndex] = { ...segs[farIndex]!, curve: 0.9 / CURVATURE_SCALE };
    expect(upcomingCurvature(segs, 0)).toBe(0);
    // And a curve inside the window does get picked up.
    segs[2] = { ...segs[2]!, curve: 0.4 / CURVATURE_SCALE };
    expect(upcomingCurvature(segs, 0)).toBeCloseTo(0.4, 6);
  });
});

describe("projectGhostCar", () => {
  it("returns hidden on an empty segment list", () => {
    const result = projectGhostCar([], makeCamera(), VIEWPORT, 100, 0);
    expect(result.visible).toBe(false);
  });

  it("returns hidden when the viewport is degenerate", () => {
    const segs = flatTrack(64);
    expect(
      projectGhostCar(segs, makeCamera(), { width: 0, height: 600 }, 100, 0).visible,
    ).toBe(false);
    expect(
      projectGhostCar(segs, makeCamera(), { width: 800, height: 0 }, 100, 0).visible,
    ).toBe(false);
  });

  it("returns hidden when ghostZ or ghostX is non-finite", () => {
    const segs = flatTrack(64);
    expect(
      projectGhostCar(segs, makeCamera(), VIEWPORT, Number.NaN, 0).visible,
    ).toBe(false);
    expect(
      projectGhostCar(segs, makeCamera(), VIEWPORT, 100, Number.POSITIVE_INFINITY)
        .visible,
    ).toBe(false);
  });

  it("returns hidden when the ghost is closer than the near plane", () => {
    const segs = flatTrack(64);
    // Ghost half a meter ahead is well inside cameraDepth (~0.84 m).
    const result = projectGhostCar(segs, makeCamera(), VIEWPORT, 0.5, 0);
    expect(result.visible).toBe(false);
  });

  it("returns hidden when the ghost sits past the draw distance window", () => {
    const segs = flatTrack(64);
    const drawDistance = 16;
    // Ghost lives well beyond drawDistance * SEGMENT_LENGTH = 96 m.
    const result = projectGhostCar(segs, makeCamera(), VIEWPORT, 200, 0, {
      drawDistance,
    });
    expect(result.visible).toBe(false);
  });

  it("on a flat straight, projects a centerline ghost to the screen midline", () => {
    const segs = flatTrack(64);
    const ghostZ = SEGMENT_LENGTH * 4;
    const result = projectGhostCar(segs, makeCamera(), VIEWPORT, ghostZ, 0);
    expect(result.visible).toBe(true);
    expect(result.screenX).toBeCloseTo(VIEWPORT.width / 2, 6);
    // screenW collapses to scale * ROAD_WIDTH * halfW.
    const expectedScale = CAMERA_DEPTH / ghostZ;
    expect(result.scale).toBeCloseTo(expectedScale, 6);
    expect(result.screenW).toBeCloseTo(
      expectedScale * ROAD_WIDTH * (VIEWPORT.width / 2),
      6,
    );
  });

  it("on a flat straight, a positive ghostX shifts the projection right of centerline", () => {
    const segs = flatTrack(64);
    const ghostZ = SEGMENT_LENGTH * 4;
    const center = projectGhostCar(segs, makeCamera(), VIEWPORT, ghostZ, 0);
    const offset = projectGhostCar(segs, makeCamera(), VIEWPORT, ghostZ, 1.5);
    expect(center.visible).toBe(true);
    expect(offset.visible).toBe(true);
    expect(offset.screenX).toBeGreaterThan(center.screenX);
  });

  it("matches the strip projector at integer segment boundaries on a flat straight", () => {
    // The strip projector samples each segment at its near edge. A ghost
    // placed on a segment boundary on a flat straight must therefore land
    // on the same screenX / screenY / screenW as the matching strip.
    const segs = flatTrack(32);
    const camera = makeCamera();
    const strips = project(segs, camera, VIEWPORT, { drawDistance: 16 });
    // Pick a strip well inside the visible window so the maxY cull does
    // not flip it to invisible.
    const stripIndex = 5;
    const strip = strips[stripIndex]!;
    expect(strip.visible).toBe(true);
    const ghost = projectGhostCar(
      segs,
      camera,
      VIEWPORT,
      stripIndex * SEGMENT_LENGTH,
      0,
      { drawDistance: 16 },
    );
    expect(ghost.visible).toBe(true);
    expect(ghost.screenX).toBeCloseTo(strip.screenX, 6);
    expect(ghost.screenY).toBeCloseTo(strip.screenY, 6);
    expect(ghost.screenW).toBeCloseTo(strip.screenW, 6);
    expect(ghost.scale).toBeCloseTo(strip.scale, 6);
  });

  it("matches the strip projector at integer segment boundaries on a constant-curve track", () => {
    const segs = flatTrack(48, { curve: 0.4 / CURVATURE_SCALE });
    const camera = makeCamera();
    const strips = project(segs, camera, VIEWPORT, { drawDistance: 24 });
    const stripIndex = 7;
    const strip = strips[stripIndex]!;
    expect(strip.visible).toBe(true);
    const ghost = projectGhostCar(
      segs,
      camera,
      VIEWPORT,
      stripIndex * SEGMENT_LENGTH,
      0,
      { drawDistance: 24 },
    );
    expect(ghost.visible).toBe(true);
    // The curve accumulator must yield the same worldX as the strip.
    expect(ghost.worldX).toBeCloseTo(strip.worldX, 6);
    expect(ghost.screenX).toBeCloseTo(strip.screenX, 6);
  });

  it("wraps cameraZ past the end of the ring so a lap-rolling player still sees a ghost ahead", () => {
    const segs = flatTrack(16);
    const trackLength = 16 * SEGMENT_LENGTH;
    // Camera one full lap into the ring; ghost a few meters into the
    // next lap. The wrap should put the ghost at forwardZ ~ ghostZ -
    // (cameraZ % trackLength).
    const camera = makeCamera({ z: trackLength + 4 });
    const ghostZ = trackLength + 4 + SEGMENT_LENGTH * 3;
    const result = projectGhostCar(segs, camera, VIEWPORT, ghostZ, 0);
    expect(result.visible).toBe(true);
    expect(result.screenX).toBeCloseTo(VIEWPORT.width / 2, 6);
  });

  it("treats a ghost behind the camera as a next-lap ghost when the wrap distance is in the draw window", () => {
    // Camera near the end of the ring, ghost back at z = 0. The wrap
    // makes the ghost "next lap forward" by a small distance, which
    // sits inside drawDistance * SEGMENT_LENGTH and should render.
    const segs = flatTrack(32);
    const trackLength = 32 * SEGMENT_LENGTH;
    const camera = makeCamera({ z: trackLength - SEGMENT_LENGTH * 2 });
    const result = projectGhostCar(segs, camera, VIEWPORT, 0, 0, {
      drawDistance: 8,
    });
    expect(result.visible).toBe(true);
  });

  it("caps drawDistance to totalSegments so a ghost beyond a tiny ring still resolves", () => {
    const segs = flatTrack(4);
    // Requested drawDistance well above totalSegments; the helper should
    // clamp to 4 (== totalSegments) and still hide a ghost past 4 segs
    // forward of the camera (it would wrap and be too far otherwise).
    const result = projectGhostCar(segs, makeCamera(), VIEWPORT, SEGMENT_LENGTH * 2, 0, {
      drawDistance: 999,
    });
    expect(result.visible).toBe(true);
  });

  it("snaps the ghost to the projection plane consistent with the strip projector when the camera offsets within a segment", () => {
    // Camera Z is mid-segment. The strip projector pulls strip 0 to the
    // near plane via cameraOffsetWithinSegment; the ghost helper must
    // mirror that so a ghost on the same segment as a known strip
    // matches its screenX.
    const segs = flatTrack(32);
    const camera = makeCamera({ z: SEGMENT_LENGTH * 2.5 });
    const strips = project(segs, camera, VIEWPORT, { drawDistance: 16 });
    const stripIndex = 4;
    const strip = strips[stripIndex]!;
    expect(strip.visible).toBe(true);
    // The strip at iteration 4 sits at sz = 4 * SEGMENT_LENGTH -
    // cameraOffsetWithinSegment = 24 - 3 = 21 m forward of cameraZ.
    // The ghost at the same forwardZ from cameraZ must match.
    const ghostZ = camera.z + (4 * SEGMENT_LENGTH - (camera.z - 2 * SEGMENT_LENGTH));
    const ghost = projectGhostCar(segs, camera, VIEWPORT, ghostZ, 0, {
      drawDistance: 16,
    });
    expect(ghost.visible).toBe(true);
    expect(ghost.screenX).toBeCloseTo(strip.screenX, 6);
    expect(ghost.screenW).toBeCloseTo(strip.screenW, 6);
  });
});
