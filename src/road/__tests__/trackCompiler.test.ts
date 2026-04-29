import { describe, expect, it, vi } from "vitest";
import type { Track, TrackSegment } from "@/data/schemas";
import { TrackSchema } from "@/data/schemas";
import trackExample from "@/data/examples/track.example.json";
import { CURVATURE_SCALE, SEGMENT_LENGTH } from "../constants";
import { TrackCompileError, compileSegments, compileTrack } from "../trackCompiler";

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

function track(overrides: Partial<Track> = {}): Track {
  const base: Track = {
    id: "test/track",
    name: "Test Track",
    tourId: "test",
    author: "core",
    version: 1,
    lengthMeters: 240,
    laps: 1,
    laneCount: 3,
    weatherOptions: ["clear"],
    difficulty: 1,
    segments: [
      seg({ len: 60 }),
      seg({ len: 60 }),
      seg({ len: 60 }),
      seg({ len: 60 }),
    ],
    checkpoints: [{ segmentIndex: 0, label: "start" }],
    spawn: { gridSlots: 12 },
  };
  return { ...base, ...overrides };
}

describe("compileSegments (lower-level dev-page entry point)", () => {
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

  it("preserves authoredIndex for downstream roadside lookup", () => {
    const compiled = compileSegments([seg({ len: 6 }), seg({ len: 6 })]);
    expect(compiled.segments[0]!.authoredIndex).toBe(0);
    expect(compiled.segments[1]!.authoredIndex).toBe(1);
  });

  it("propagates roadside ids and shares the hazards array reference", () => {
    const hazards = ["puddle", "cone"];
    const authored = [
      seg({
        len: 6,
        roadsideLeft: "palms_sparse",
        roadsideRight: "marina_signs",
        hazards,
      }),
    ];
    const compiled = compileSegments(authored);
    expect(compiled.segments[0]!.roadsideLeftId).toBe("palms_sparse");
    expect(compiled.segments[0]!.roadsideRightId).toBe("marina_signs");
    // Same array reference avoids per-frame allocation in the renderer.
    expect(compiled.segments[0]!.hazardIds).toBe(hazards);
  });

  it("propagates tunnel segment metadata", () => {
    const compiled = compileSegments([
      seg({
        len: 6,
        inTunnel: true,
        tunnelMaterial: "iron-borough/riveted-steel",
      }),
    ]);
    expect(compiled.segments[0]!.inTunnel).toBe(true);
    expect(compiled.segments[0]!.tunnelMaterialId).toBe("iron-borough/riveted-steel");
  });

  it("treats legacy tunnel hazards as tunnel segments", () => {
    const compiled = compileSegments([seg({ len: 6, hazards: ["tunnel"] })]);
    expect(compiled.segments[0]!.inTunnel).toBe(true);
  });
});

describe("compileTrack (full-track entry point)", () => {
  it("compiles a single 6 m authored segment to exactly 1 compiled segment with worldZ = 0", () => {
    const t = track({
      segments: [
        seg({ len: 6 }),
        seg({ len: 6 }),
        seg({ len: 6 }),
        seg({ len: 6 }),
      ],
      lengthMeters: 24,
    });
    const compiled = compileTrack(t);
    expect(compiled.totalCompiledSegments).toBe(4);
    expect(compiled.segments[0]!.worldZ).toBe(0);
  });

  it("accepts authored tunnel fields in TrackSchema and full-track compilation", () => {
    const t = track({
      segments: [
        seg({
          len: 60,
          inTunnel: true,
          tunnelMaterial: "iron-borough/riveted-steel",
        }),
        seg({ len: 60 }),
        seg({ len: 60 }),
        seg({ len: 60 }),
      ],
      lengthMeters: 240,
    });
    const parsed = TrackSchema.safeParse(t);
    expect(parsed.success).toBe(true);
    const compiled = compileTrack(t);
    expect(compiled.segments[0]!.inTunnel).toBe(true);
    expect(compiled.segments[0]!.tunnelMaterialId).toBe("iron-borough/riveted-steel");
  });

  it("compiles a 13 m authored segment to 3 compiled segments (ceil(13/6))", () => {
    const t = track({
      segments: [seg({ len: 13 }), seg({ len: 13 })],
      lengthMeters: 26,
    });
    const compiled = compileTrack(t);
    // First authored = 3 compiled (13 / 6 = 2.16 -> 3).
    expect(compiled.segments[0]!.authoredIndex).toBe(0);
    expect(compiled.segments[2]!.authoredIndex).toBe(0);
    expect(compiled.segments[3]!.authoredIndex).toBe(1);
    expect(compiled.totalCompiledSegments).toBe(6);
  });

  it("compiles two authored segments back-to-back with monotonically increasing worldZ", () => {
    const t = track({
      segments: [seg({ len: 12 }), seg({ len: 12 })],
      lengthMeters: 24,
    });
    const compiled = compileTrack(t);
    let prev = -Infinity;
    for (const s of compiled.segments) {
      expect(s.worldZ).toBeGreaterThan(prev);
      prev = s.worldZ;
    }
  });

  it("maps authored checkpoint indices to correct compiled indices", () => {
    const t = track({
      segments: [
        seg({ len: 18 }), // 3 compiled
        seg({ len: 12 }), // 2 compiled, starts at compiled idx 3
        seg({ len: 6 }), // 1 compiled, starts at compiled idx 5
      ],
      lengthMeters: 36,
      checkpoints: [
        { segmentIndex: 0, label: "start" },
        { segmentIndex: 1, label: "sector-1" },
        { segmentIndex: 2, label: "sector-2" },
      ],
    });
    const compiled = compileTrack(t);
    expect(compiled.checkpoints[0]!.compiledStart).toBe(0);
    expect(compiled.checkpoints[1]!.compiledStart).toBe(3);
    expect(compiled.checkpoints[2]!.compiledStart).toBe(5);
  });

  it("propagates curve and grade pre-scaled per the projector contract", () => {
    const t = track({
      segments: [
        seg({ len: 6, curve: 0.5, grade: 0.1 }),
        seg({ len: 6 }),
        seg({ len: 6 }),
        seg({ len: 6 }),
      ],
      lengthMeters: 24,
    });
    const compiled = compileTrack(t);
    expect(compiled.segments[0]!.curve).toBeCloseTo(0.5 / CURVATURE_SCALE, 12);
    expect(compiled.segments[0]!.grade).toBeCloseTo(0.1 * SEGMENT_LENGTH, 6);
  });

  it("treats len === 0 as 1 compiled segment", () => {
    // The TrackSegment schema requires len > 0, so we bypass it via the
    // lower-level compileSegments helper which is the realistic path for a
    // pathological zero-length authored row leaking through somehow.
    const compiled = compileSegments([{ ...seg(), len: 0 }]);
    expect(compiled.segments).toHaveLength(1);
  });

  it("throws TrackCompileError when no checkpoints exist", () => {
    const t = track({ checkpoints: [] });
    try {
      compileTrack(t);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackCompileError);
      expect((e as TrackCompileError).code).toBe("no-checkpoints");
    }
  });

  it("throws TrackCompileError when no start checkpoint exists", () => {
    const t = track({ checkpoints: [{ segmentIndex: 0, label: "sector-1" }] });
    try {
      compileTrack(t);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackCompileError);
      expect((e as TrackCompileError).code).toBe("missing-start-checkpoint");
    }
  });

  it("throws TrackCompileError when start checkpoint segmentIndex !== 0", () => {
    const t = track({
      checkpoints: [{ segmentIndex: 1, label: "start" }],
    });
    try {
      compileTrack(t);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackCompileError);
      expect((e as TrackCompileError).code).toBe("start-checkpoint-not-at-zero");
    }
  });

  it("throws TrackCompileError when a checkpoint segmentIndex is out of bounds", () => {
    const t = track({
      checkpoints: [
        { segmentIndex: 0, label: "start" },
        { segmentIndex: 99, label: "sector-1" },
      ],
    });
    try {
      compileTrack(t);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackCompileError);
      expect((e as TrackCompileError).code).toBe("checkpoint-out-of-bounds");
    }
  });

  it("throws TrackCompileError when the compiled track is shorter than the minimum", () => {
    // Three 6 m authored segments compile to 3 compiled segments, below the
    // minimum of 4.
    const t = track({
      segments: [seg({ len: 6 }), seg({ len: 6 }), seg({ len: 6 })],
      lengthMeters: 18,
    });
    try {
      compileTrack(t);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackCompileError);
      expect((e as TrackCompileError).code).toBe("track-too-short");
    }
  });

  it("emits a warning when spawn.gridSlots < 8", () => {
    const t = track({ spawn: { gridSlots: 4 } });
    const compiled = compileTrack(t);
    expect(compiled.warnings.some((w) => w.includes("gridSlots"))).toBe(true);
  });

  it('emits a warning when weatherOptions does not include "clear"', () => {
    const t = track({ weatherOptions: ["heavy_rain"] });
    const compiled = compileTrack(t);
    expect(compiled.warnings.some((w) => w.includes("clear"))).toBe(true);
  });

  it("emits a warning when lengthMeters disagrees with sum(len) by more than 5%", () => {
    const t = track({
      segments: [seg({ len: 60 }), seg({ len: 60 }), seg({ len: 60 }), seg({ len: 60 })],
      // Sum of len is 240; declare 320 to drift well over 5%.
      lengthMeters: 320,
    });
    const compiled = compileTrack(t);
    expect(compiled.warnings.some((w) => w.includes("lengthMeters"))).toBe(true);
  });

  it("does not throw on the §22 example track", () => {
    const parsed = TrackSchema.safeParse(trackExample);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(() => compileTrack(parsed.data)).not.toThrow();
  });

  it("produces hazardIds that are the same array reference as the authored segment", () => {
    const hazards = ["puddle"];
    const t = track({
      segments: [
        seg({ len: 6, hazards }),
        seg({ len: 6 }),
        seg({ len: 6 }),
        seg({ len: 6 }),
      ],
      lengthMeters: 24,
    });
    const compiled = compileTrack(t);
    expect(compiled.segments[0]!.hazardIds).toBe(hazards);
  });

  it("computes minimapPoints from segment headings when no override is supplied", () => {
    const compiled = compileTrack(track());
    expect(compiled.minimapPoints.length).toBe(compiled.totalCompiledSegments);
    for (const p of compiled.minimapPoints) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(1 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("honours an authored minimapPoints override verbatim after fitToBox", () => {
    const t = track({
      minimapPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
    const compiled = compileTrack(t);
    // Override gets fitted into the unit square; with two collinear
    // points the long axis spans 0 to 1 and the short axis collapses to
    // the centre of the box.
    expect(compiled.minimapPoints).toHaveLength(2);
    expect(compiled.minimapPoints[0]!.x).toBeCloseTo(0, 9);
    expect(compiled.minimapPoints[0]!.y).toBeCloseTo(0.5, 9);
    expect(compiled.minimapPoints[1]!.x).toBeCloseTo(1, 9);
    expect(compiled.minimapPoints[1]!.y).toBeCloseTo(0.5, 9);
  });

  it("produces a deeply-frozen output that cannot be mutated", () => {
    const compiled = compileTrack(track());
    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled.segments)).toBe(true);
    expect(Object.isFrozen(compiled.segments[0])).toBe(true);
    expect(Object.isFrozen(compiled.checkpoints)).toBe(true);
    expect(Object.isFrozen(compiled.weatherOptions)).toBe(true);
    expect(Object.isFrozen(compiled.minimapPoints)).toBe(true);
    expect(() => {
      // @ts-expect-error: writing to a readonly field for the test.
      compiled.segments[0].curve = 999;
    }).toThrow();
  });

  it("propagates Track.difficulty into CompiledTrack.difficulty", () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const compiled = compileTrack(track({ difficulty: tier }));
      expect(compiled.difficulty).toBe(tier);
    }
  });
});
