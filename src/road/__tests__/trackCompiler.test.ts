import { describe, expect, it, vi } from "vitest";
import type { TrackSegment } from "@/data/schemas";
import { CURVATURE_SCALE, SEGMENT_LENGTH } from "../constants";
import { compileSegments } from "../trackCompiler";

function seg(overrides: Partial<TrackSegment> = {}): TrackSegment {
  return {
    len: 12,
    curve: 0,
    grade: 0,
    roadsideLeft: "default",
    roadsideRight: "default",
    hazards: [],
    ...overrides,
  };
}

describe("compileSegments", () => {
  it("returns an empty list for an empty input", () => {
    const compiled = compileSegments([]);
    expect(compiled.segments).toEqual([]);
    expect(compiled.totalLength).toBe(0);
  });

  it("expands authored segments into ceil(len / SEGMENT_LENGTH) blocks", () => {
    // 12 m / 6 m = 2 blocks; 7 m / 6 m = ceil(1.16) = 2 blocks.
    const compiled = compileSegments([seg({ len: 12 }), seg({ len: 7 })]);
    expect(compiled.segments.length).toBe(4);
    expect(compiled.totalLength).toBe(4 * SEGMENT_LENGTH);
  });

  it("assigns monotonic indices and worldZ at SEGMENT_LENGTH spacing", () => {
    const compiled = compileSegments([seg({ len: 18 }), seg({ len: 6 })]);
    expect(compiled.segments.length).toBe(4);
    compiled.segments.forEach((s, i) => {
      expect(s.index).toBe(i);
      expect(s.worldZ).toBeCloseTo(i * SEGMENT_LENGTH, 6);
    });
  });

  it("guarantees at least one compiled block per authored segment", () => {
    // len < SEGMENT_LENGTH still produces one block.
    const compiled = compileSegments([seg({ len: 1 })]);
    expect(compiled.segments).toHaveLength(1);
  });

  it("scales curve by 1 / CURVATURE_SCALE so the projector sums dx directly", () => {
    const compiled = compileSegments([seg({ curve: 0.5 })]);
    expect(compiled.segments[0]!.curve).toBeCloseTo(0.5 / CURVATURE_SCALE, 12);
  });

  it("scales grade into meters per compiled segment", () => {
    const compiled = compileSegments([seg({ grade: 0.1 })]);
    // 0.1 rise per meter * 6 m segment = 0.6 m vertical lift.
    expect(compiled.segments[0]!.grade).toBeCloseTo(0.6, 6);
  });

  it("treats NaN curve and grade as 0 and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const compiled = compileSegments([
        { ...seg(), curve: Number.NaN },
        { ...seg(), grade: Number.POSITIVE_INFINITY },
      ]);
      expect(compiled.segments[0]!.curve).toBe(0);
      expect(compiled.segments[1]!.grade).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("ring-buffer wrap: total length matches segment count for laps", () => {
    // A short authored list still produces a usable ring; the projector wraps
    // via mod totalSegments on the camera index.
    const compiled = compileSegments([seg({ len: 24 })]);
    expect(compiled.segments).toHaveLength(4);
    expect(compiled.totalLength).toBe(4 * SEGMENT_LENGTH);
    // First and last compiled segments share authoredRef (single source).
    expect(compiled.segments[0]!.authoredRef).toBe(0);
    expect(compiled.segments[3]!.authoredRef).toBe(0);
  });

  it("preserves authoredRef for downstream roadside lookup", () => {
    const compiled = compileSegments([seg({ len: 6 }), seg({ len: 6 })]);
    expect(compiled.segments[0]!.authoredRef).toBe(0);
    expect(compiled.segments[1]!.authoredRef).toBe(1);
  });
});
