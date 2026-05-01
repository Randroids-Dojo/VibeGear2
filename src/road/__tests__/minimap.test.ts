/**
 * Unit tests for the minimap projection module.
 *
 * Covers the dot's listed verifies:
 * - 80-segment track returns 80 points within the unit rectangle.
 * - `projectCar` linear interpolation midpoint case.
 * - Single-segment track returns one point.
 * - Aspect preservation: a 20:1 track uses 100% of the long axis and
 *   roughly 5% of the short axis.
 * - Author override: verbatim output ignoring segment data.
 * - Off-track car clamps without producing NaN.
 * - Determinism: same input always produces deep-equal output.
 */

import { describe, expect, it } from "vitest";

import type { CompiledSegment } from "../types";
import {
  fitToBox,
  projectCar,
  projectTrack,
  type MinimapPoint,
} from "../minimap";

function seg(overrides: Partial<CompiledSegment> = {}): CompiledSegment {
  return {
    index: 0,
    worldZ: 0,
    curve: 0,
    grade: 0,
    authoredIndex: 0,
    roadsideLeftId: "default",
    roadsideRightId: "default",
    hazardIds: [],
      pickupIds: [],
    ...overrides,
  };
}

/** Generate `n` segments with a constant per-segment heading delta. */
function ring(n: number, perSegmentCurve: number): CompiledSegment[] {
  const out: CompiledSegment[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = seg({ index: i, worldZ: i * 6, curve: perSegmentCurve });
  }
  return out;
}

describe("projectTrack", () => {
  it("returns one point per segment for an 80-segment track", () => {
    // 80 segments and a per-segment curve that integrates to 2 PI for a
    // closed loop. (2 PI / 80) per segment.
    const segments = ring(80, (Math.PI * 2) / 80);
    const points = projectTrack(segments);
    expect(points.length).toBe(80);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(1 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("returns one point for a single-segment track", () => {
    const points = projectTrack([seg({ index: 0, worldZ: 0, curve: 0 })]);
    expect(points).toHaveLength(1);
    // Centred in the unit box.
    expect(points[0]!.x).toBeCloseTo(0.5, 9);
    expect(points[0]!.y).toBeCloseTo(0.5, 9);
  });

  it("returns an empty list for an empty input", () => {
    expect(projectTrack([])).toEqual([]);
  });

  it("preserves aspect ratio for a long-thin straight track", () => {
    // A perfectly straight 40-segment track integrates to a horizontal
    // line. After fitToBox into the unit square it occupies the full
    // horizontal span and is centred vertically.
    const segments = ring(40, 0);
    const points = projectTrack(segments);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    expect(minX).toBeCloseTo(0, 9);
    expect(maxX).toBeCloseTo(1, 9);
    // Y range collapses; centred vertically.
    expect(minY).toBeCloseTo(0.5, 9);
    expect(maxY).toBeCloseTo(0.5, 9);
  });

  it("honours the author override and skips heading integration", () => {
    const segments = ring(2, 0.5);
    const points = projectTrack(segments, {
      override: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(0, 9);
    expect(points[0]!.y).toBeCloseTo(0.5, 9);
    expect(points[1]!.x).toBeCloseTo(1, 9);
    expect(points[1]!.y).toBeCloseTo(0.5, 9);
    // segmentIndex carries the compiled index even with override.
    expect(points[0]!.segmentIndex).toBe(0);
    expect(points[1]!.segmentIndex).toBe(1);
  });

  it("respects a custom target box", () => {
    const segments = ring(40, 0);
    const points = projectTrack(segments, {
      box: { x: 100, y: 200, w: 300, h: 100 },
    });
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    expect(minX).toBeCloseTo(100, 6);
    expect(maxX).toBeCloseTo(400, 6);
  });

  it("is deterministic across calls with the same input", () => {
    const segments = ring(40, 0.04);
    const a = projectTrack(segments);
    const b = projectTrack(segments);
    expect(a).toEqual(b);
  });
});

describe("projectCar", () => {
  function pt(x: number, y: number, segmentIndex: number): MinimapPoint {
    return { x, y, segmentIndex };
  }

  it("interpolates between two adjacent points", () => {
    const points = [pt(0, 0, 0), pt(1, 0, 1)];
    expect(projectCar(points, 0, 0.5)).toEqual({ x: 0.5, y: 0 });
  });

  it("returns the start point when progress is 0", () => {
    const points = [pt(0, 0, 0), pt(1, 0, 1), pt(1, 1, 2)];
    expect(projectCar(points, 1, 0)).toEqual({ x: 1, y: 0 });
  });

  it("wraps to the first point at the end of the ring", () => {
    const points = [pt(0, 0, 0), pt(1, 0, 1)];
    // segmentIndex 1 with progress 1 wraps back to point 0.
    expect(projectCar(points, 1, 1)).toEqual({ x: 0, y: 0 });
  });

  it("clamps an out-of-range segment index without producing NaN", () => {
    const points = [pt(0, 0, 0), pt(1, 0, 1)];
    const result = projectCar(points, 99, 0.5);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it("clamps NaN progress to 0", () => {
    const points = [pt(0, 0, 0), pt(1, 0, 1)];
    expect(projectCar(points, 0, Number.NaN)).toEqual({ x: 0, y: 0 });
  });

  it("returns the only point for a single-point track", () => {
    expect(projectCar([pt(0.4, 0.6, 0)], 0, 0.5)).toEqual({ x: 0.4, y: 0.6 });
  });

  it("returns origin for an empty point list (defensive)", () => {
    expect(projectCar([], 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("fitToBox", () => {
  it("rescales a square to the unit box", () => {
    const fitted = fitToBox(
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      { x: 0, y: 0, w: 1, h: 1 },
    );
    expect(fitted[0]!.x).toBeCloseTo(0, 9);
    expect(fitted[0]!.y).toBeCloseTo(0, 9);
    expect(fitted[1]!.x).toBeCloseTo(1, 9);
    expect(fitted[1]!.y).toBeCloseTo(1, 9);
  });

  it("centres a long-thin shape on its short axis", () => {
    // 20:1 ratio fitted into a square box: long axis spans full box,
    // short axis uses 5% and is centred.
    const points = [];
    for (let i = 0; i <= 20; i++) {
      points.push({ x: i, y: i % 2 === 0 ? 0 : 1 });
    }
    const fitted = fitToBox(points, { x: 0, y: 0, w: 1, h: 1 });
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of fitted) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    expect(minX).toBeCloseTo(0, 9);
    expect(maxX).toBeCloseTo(1, 9);
    expect(maxY - minY).toBeCloseTo(0.05, 9);
    // Short axis centred: leftover (1 - 0.05) split evenly above and below.
    expect(minY).toBeCloseTo(0.475, 9);
  });

  it("returns an empty list for an empty input", () => {
    expect(fitToBox([], { x: 0, y: 0, w: 1, h: 1 })).toEqual([]);
  });
});
