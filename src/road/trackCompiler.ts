/**
 * Authored Track to compiled-segment compiler.
 *
 * Authored segments (per `docs/gdd/22-data-schemas.md` `TrackSegmentSchema`)
 * are variable length in meters. The renderer wants a flat array of fixed
 * `SEGMENT_LENGTH`-meter blocks so it can iterate by index without per
 * segment length math. This module bridges the two.
 *
 * Compilation rules pinned in
 * `.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md`:
 *
 *   for each authored segment a:
 *     count = ceil(a.len / SEGMENT_LENGTH)
 *     for i in 0..count-1:
 *       push compiled segment with curve, grade, worldZ
 *
 * Curve and grade are normalized into compiled-segment units here so the
 * projector can sum them directly:
 *
 *   compiled.curve = authored.curve / CURVATURE_SCALE
 *   compiled.grade = authored.grade * SEGMENT_LENGTH
 *
 * Edge cases:
 * - Empty `segments` array yields an empty compiled list. Callers that
 *   rely on a non-empty ring must validate upstream.
 * - NaN or Infinity in `curve` or `grade` is logged once per compile and
 *   replaced with 0. The Zod schema already rejects out-of-range finite
 *   values; this guard catches downstream corruption.
 */

import type { Track, TrackSegment } from "@/data/schemas";
import { CURVATURE_SCALE, SEGMENT_LENGTH } from "./constants";
import type { CompiledSegment } from "./types";

function sanitize(value: number, label: string, warned: { current: boolean }): number {
  if (Number.isFinite(value)) return value;
  if (!warned.current) {
    // One warning per compile, not per segment.
    // eslint-disable-next-line no-console
    console.warn(`trackCompiler: non-finite ${label} encountered; treating as 0`);
    warned.current = true;
  }
  return 0;
}

export interface CompiledTrack {
  segments: CompiledSegment[];
  /** Total length of the compiled track in meters. */
  totalLength: number;
}

export function compileTrack(track: Track): CompiledTrack {
  return compileSegments(track.segments);
}

/**
 * Lower-level entry point for tests and the dev page that want to compile a
 * raw `TrackSegment[]` without building a full `Track` object.
 */
export function compileSegments(authored: readonly TrackSegment[]): CompiledTrack {
  const compiled: CompiledSegment[] = [];
  const warned = { current: false };
  let cumulativeIndex = 0;

  for (let a = 0; a < authored.length; a++) {
    const seg = authored[a];
    if (!seg) continue;
    const count = Math.max(1, Math.ceil(seg.len / SEGMENT_LENGTH));
    const curve = sanitize(seg.curve, "curve", warned) / CURVATURE_SCALE;
    const grade = sanitize(seg.grade, "grade", warned) * SEGMENT_LENGTH;
    for (let i = 0; i < count; i++) {
      compiled.push({
        index: cumulativeIndex,
        worldZ: cumulativeIndex * SEGMENT_LENGTH,
        curve,
        grade,
        authoredRef: a,
      });
      cumulativeIndex += 1;
    }
  }

  return {
    segments: compiled,
    totalLength: compiled.length * SEGMENT_LENGTH,
  };
}
