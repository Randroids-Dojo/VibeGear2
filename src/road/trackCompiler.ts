/**
 * Authored Track to compiled-segment compiler.
 *
 * Authored segments (per `docs/gdd/22-data-schemas.md` `TrackSegmentSchema`)
 * are variable length in meters. The renderer wants a flat array of fixed
 * `SEGMENT_LENGTH`-meter blocks so it can iterate by index without per
 * segment length math. This module bridges the two.
 *
 * Compilation rules pinned in
 * `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md` "Findings"
 * and `.dots/archive/VibeGear2-research-pseudo-3d-3b818fa6.md`:
 *
 *   for each authored segment a:
 *     count = ceil(a.len / SEGMENT_LENGTH)
 *     for i in 0..count-1:
 *       push compiled segment with curve, grade, worldZ, ids
 *
 * Curve and grade are normalized into compiled-segment units here so the
 * projector can sum them directly:
 *
 *   compiled.curve = authored.curve / CURVATURE_SCALE
 *   compiled.grade = authored.grade * SEGMENT_LENGTH
 *
 * Hard errors throw `TrackCompileError`; soft lints are collected into
 * `CompiledTrack.warnings`. The output is recursively frozen so callers
 * cannot mutate it; see `deepFreeze` below.
 *
 * Edge cases:
 * - Empty `segments` array yields an empty compiled list. Callers that
 *   rely on a non-empty ring must validate upstream. (Schema rejects this.)
 * - NaN or Infinity in `curve` or `grade` is logged once per compile and
 *   replaced with 0. The Zod schema already rejects out-of-range finite
 *   values; this guard catches downstream corruption.
 * - Authored len < SEGMENT_LENGTH still produces 1 compiled segment.
 */

import type { Track, TrackSegment } from "@/data/schemas";
import { CURVATURE_SCALE, SEGMENT_LENGTH } from "./constants";
import { projectTrack } from "./minimap";
import type {
  CompiledCheckpoint,
  CompiledSegment,
  CompiledTrack,
} from "./types";

/** Minimum compiled-segment count for a single-lap track to be renderable. */
const MIN_COMPILED_SEGMENTS = 4;

/** Warning threshold for `lengthMeters` metadata accuracy. */
const LENGTH_METERS_TOLERANCE = 0.05;

/** Warning threshold for `spawn.gridSlots`. */
const MIN_GRID_SLOTS_WARN = 8;

/**
 * Hard-error thrown by `compileTrack` for structural violations the schema
 * cannot express. `code` is a short stable identifier suitable for test
 * assertions; `details` carries arbitrary context for debugging.
 */
export class TrackCompileError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  public constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TrackCompileError";
    this.code = code;
    this.details = details;
  }
}

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

function assertUniquePickupIds(track: Track): void {
  const seen = new Map<string, number>();
  for (let segmentIndex = 0; segmentIndex < track.segments.length; segmentIndex += 1) {
    const pickups = track.segments[segmentIndex]?.pickups ?? [];
    for (const pickup of pickups) {
      const firstSegmentIndex = seen.get(pickup.id);
      if (firstSegmentIndex !== undefined) {
        throw new TrackCompileError(
          "duplicate-pickup-id",
          `track ${track.id}: pickup id "${pickup.id}" appears in multiple segments`,
          {
            trackId: track.id,
            pickupId: pickup.id,
            firstSegmentIndex,
            duplicateSegmentIndex: segmentIndex,
          },
        );
      }
      seen.set(pickup.id, segmentIndex);
    }
  }
}

/**
 * Recursively `Object.freeze` a value and every property it owns. Returns
 * the input for fluent use. Avoids re-freezing already-frozen objects to
 * keep the cost amortised.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Compile a fully validated `Track` to its renderable form. Pure, no I/O,
 * no `Math.random`, no `Date.now`. Throws `TrackCompileError` for hard
 * violations; non-fatal lints land in `CompiledTrack.warnings`.
 */
export function compileTrack(track: Track): CompiledTrack {
  const warned = { current: false };
  const warnings: string[] = [];
  assertUniquePickupIds(track);

  // Compile segments and remember each authored segment's first compiled
  // index so we can map checkpoints below.
  const segments: CompiledSegment[] = [];
  const authoredStartCompiled: number[] = new Array(track.segments.length);
  let cumulativeIndex = 0;

  for (let a = 0; a < track.segments.length; a++) {
    const seg = track.segments[a]!;
    authoredStartCompiled[a] = cumulativeIndex;
    if (seg.len < SEGMENT_LENGTH) {
      warnings.push(
        `authored segment ${a} has len=${seg.len}m below SEGMENT_LENGTH (${SEGMENT_LENGTH}m); rounded up to 1 compiled segment`,
      );
    }
    const rawCount = Math.ceil(seg.len / SEGMENT_LENGTH);
    const count = Math.max(1, Number.isFinite(rawCount) ? rawCount : 1);
    const curve = sanitize(seg.curve, "curve", warned) / CURVATURE_SCALE;
    const grade = sanitize(seg.grade, "grade", warned) * SEGMENT_LENGTH;
    const pickupIds = seg.pickups?.map((pickup) => pickup.id) ?? [];
    for (let i = 0; i < count; i++) {
      segments.push({
        index: cumulativeIndex,
        worldZ: cumulativeIndex * SEGMENT_LENGTH,
        curve,
        grade,
        authoredIndex: a,
        roadsideLeftId: seg.roadsideLeft,
        roadsideRightId: seg.roadsideRight,
        hazardIds: seg.hazards,
        pickupIds,
        inTunnel: seg.inTunnel === true || seg.hazards.includes("tunnel"),
        tunnelMaterialId: seg.tunnelMaterial,
      });
      cumulativeIndex += 1;
    }
  }

  const totalCompiledSegments = cumulativeIndex;
  const totalLengthMeters = totalCompiledSegments * SEGMENT_LENGTH;

  // Hard-error: track too short to render at all.
  if (totalCompiledSegments < MIN_COMPILED_SEGMENTS) {
    throw new TrackCompileError(
      "track-too-short",
      `track ${track.id}: compiled segment count ${totalCompiledSegments} below minimum ${MIN_COMPILED_SEGMENTS}`,
      { trackId: track.id, totalCompiledSegments },
    );
  }

  // Hard-error: missing or misplaced start checkpoint.
  if (track.checkpoints.length === 0) {
    throw new TrackCompileError(
      "no-checkpoints",
      `track ${track.id}: must declare at least one checkpoint with label "start" at segmentIndex 0`,
      { trackId: track.id },
    );
  }
  const start = track.checkpoints.find((cp) => cp.label === "start");
  if (!start) {
    throw new TrackCompileError(
      "missing-start-checkpoint",
      `track ${track.id}: no checkpoint has label "start"`,
      { trackId: track.id },
    );
  }
  if (start.segmentIndex !== 0) {
    throw new TrackCompileError(
      "start-checkpoint-not-at-zero",
      `track ${track.id}: start checkpoint must be at segmentIndex 0 (got ${start.segmentIndex})`,
      { trackId: track.id, segmentIndex: start.segmentIndex },
    );
  }

  // Hard-error: any checkpoint out of bounds.
  for (let i = 0; i < track.checkpoints.length; i++) {
    const cp = track.checkpoints[i]!;
    if (cp.segmentIndex >= track.segments.length) {
      throw new TrackCompileError(
        "checkpoint-out-of-bounds",
        `track ${track.id}: checkpoint ${i} segmentIndex ${cp.segmentIndex} out of authored bounds (length ${track.segments.length})`,
        { trackId: track.id, checkpointIndex: i, segmentIndex: cp.segmentIndex },
      );
    }
  }

  // Map authored checkpoints to compiled positions.
  const checkpoints: CompiledCheckpoint[] = track.checkpoints.map((cp, i) => ({
    authoredIndex: i,
    compiledStart: authoredStartCompiled[cp.segmentIndex]!,
    label: cp.label,
  }));

  // Soft lints --------------------------------------------------------------

  if (track.spawn.gridSlots < MIN_GRID_SLOTS_WARN) {
    warnings.push(
      `spawn.gridSlots ${track.spawn.gridSlots} is below the recommended minimum ${MIN_GRID_SLOTS_WARN}`,
    );
  }

  if (!track.weatherOptions.includes("clear")) {
    warnings.push(
      `weatherOptions does not include "clear"; every track should have a clear baseline`,
    );
  }

  // Authored vs metadata length sanity.
  const authoredSumMeters = track.segments.reduce(
    (acc, s) => acc + s.len,
    0,
  );
  if (authoredSumMeters > 0) {
    const drift = Math.abs(track.lengthMeters - authoredSumMeters) / authoredSumMeters;
    if (drift > LENGTH_METERS_TOLERANCE) {
      warnings.push(
        `lengthMeters metadata ${track.lengthMeters}m differs from sum of authored len ${authoredSumMeters}m by ${(drift * 100).toFixed(1)}% (>${(LENGTH_METERS_TOLERANCE * 100).toFixed(0)}%)`,
      );
    }
  }

  // Duplicate non-start checkpoint labels.
  const seenLabels = new Set<string>();
  for (const cp of track.checkpoints) {
    if (cp.label === "start") continue;
    if (seenLabels.has(cp.label)) {
      warnings.push(`checkpoint label "${cp.label}" is duplicated`);
    }
    seenLabels.add(cp.label);
  }

  // Packed hairpin run heuristic: two consecutive authored segments with
  // |curve| > 0.6 and combined len < 80 m. Helps authors notice unintended
  // pinch points.
  for (let i = 1; i < track.segments.length; i++) {
    const prev = track.segments[i - 1]!;
    const cur = track.segments[i]!;
    if (
      Math.abs(prev.curve) > 0.6 &&
      Math.abs(cur.curve) > 0.6 &&
      prev.len + cur.len < 80
    ) {
      warnings.push(
        `authored segments ${i - 1} and ${i} form a packed hairpin run (combined ${(prev.len + cur.len).toFixed(0)}m < 80m); consider spacing them out`,
      );
    }
  }

  // Minimap polyline. Pre-computed once per track and cached on the
  // compiled output so the HUD never re-runs heading integration at
  // draw time. Honours an authored override when present; otherwise the
  // projector integrates per-segment headings into the unit square.
  const minimapPoints = projectTrack(segments, {
    override: track.minimapPoints,
  }).map((p) => ({ x: p.x, y: p.y, segmentIndex: p.segmentIndex }));

  const compiled: CompiledTrack = {
    trackId: track.id,
    totalLengthMeters,
    totalCompiledSegments,
    segments,
    checkpoints,
    spawn: { gridSlots: track.spawn.gridSlots },
    laps: track.laps,
    laneCount: track.laneCount,
    weatherOptions: [...track.weatherOptions],
    difficulty: track.difficulty,
    minimapPoints,
    warnings,
  };

  return deepFreeze(compiled);
}

/**
 * Lower-level compiler that operates on an authored `TrackSegment[]`
 * without the surrounding `Track` metadata. Used by the dev pages
 * (`/dev/road`, `/dev/physics`) which fabricate a single straight test
 * track inline and never need checkpoints, weather, or laps.
 *
 * Returns only the segment buffer and the total length; callers that need
 * the full `CompiledTrack` shape should construct a real `Track` and call
 * `compileTrack`.
 *
 * Output is NOT deep-frozen so the dev pages can keep their existing
 * mutation patterns (none today, but the API remains permissive).
 */
export interface CompiledSegmentBuffer {
  segments: CompiledSegment[];
  totalLength: number;
}

export function compileSegments(authored: readonly TrackSegment[]): CompiledSegmentBuffer {
  const compiled: CompiledSegment[] = [];
  const warned = { current: false };
  let cumulativeIndex = 0;

  for (let a = 0; a < authored.length; a++) {
    const seg = authored[a];
    if (!seg) continue;
    const rawCount = Math.ceil(seg.len / SEGMENT_LENGTH);
    const count = Math.max(1, Number.isFinite(rawCount) ? rawCount : 1);
    const curve = sanitize(seg.curve, "curve", warned) / CURVATURE_SCALE;
    const grade = sanitize(seg.grade, "grade", warned) * SEGMENT_LENGTH;
    const pickupIds = seg.pickups?.map((pickup) => pickup.id) ?? [];
    for (let i = 0; i < count; i++) {
      compiled.push({
        index: cumulativeIndex,
        worldZ: cumulativeIndex * SEGMENT_LENGTH,
        curve,
        grade,
        authoredIndex: a,
        roadsideLeftId: seg.roadsideLeft,
        roadsideRightId: seg.roadsideRight,
        hazardIds: seg.hazards,
        pickupIds,
        inTunnel: seg.inTunnel === true || seg.hazards.includes("tunnel"),
        tunnelMaterialId: seg.tunnelMaterial,
      });
      cumulativeIndex += 1;
    }
  }

  return {
    segments: compiled,
    totalLength: compiled.length * SEGMENT_LENGTH,
  };
}
