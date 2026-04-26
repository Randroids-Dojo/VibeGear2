/**
 * Explicit JSON snapshot helper for the track compiler golden-master tests.
 *
 * Pinned by `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md`
 * Findings: explicit JSON snapshots beat Vitest's auto-managed `.snap` files
 * because they are PR-reviewable, survive Vitest version upgrades cleanly,
 * and document the contract better than a `.snap` file would.
 *
 * Usage:
 *
 *   expectMatchesSnapshot("straight", compiled);
 *
 * Reads `__snapshots__/trackCompiler.snapshots.json[name]` and deep-compares
 * with the supplied value. When `UPDATE_SNAPSHOTS=1` is set, writes the new
 * value back atomically (write to tmp + rename).
 *
 * First-time miss without `UPDATE_SNAPSHOTS=1` fails with a clear hint.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompiledCheckpoint, CompiledSegment, CompiledTrack } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, "__snapshots__/trackCompiler.snapshots.json");

/** After this many compiled segments, sample every Nth instead of all. */
export const SNAPSHOT_FULL_PREFIX = 30;

/** Stride for the sampled tail beyond `SNAPSHOT_FULL_PREFIX`. */
export const SNAPSHOT_SAMPLE_STRIDE = 25;

interface SnapshotSegment {
  index: number;
  worldZ: number;
  curve: number;
  grade: number;
  authoredIndex: number;
  roadsideLeftId: string;
  roadsideRightId: string;
  hazardIds: readonly string[];
}

export interface CompiledTrackSnapshot {
  trackId: string;
  totalLengthMeters: number;
  totalCompiledSegments: number;
  laps: number;
  laneCount: number;
  weatherOptions: readonly string[];
  spawn: { gridSlots: number };
  warnings: readonly string[];
  segmentsFull: readonly SnapshotSegment[];
  segmentsSampled: readonly SnapshotSegment[];
  checkpoints: readonly CompiledCheckpoint[];
}

function projectSegment(s: CompiledSegment): SnapshotSegment {
  return {
    index: s.index,
    worldZ: s.worldZ,
    curve: s.curve,
    grade: s.grade,
    authoredIndex: s.authoredIndex,
    roadsideLeftId: s.roadsideLeftId,
    roadsideRightId: s.roadsideRightId,
    hazardIds: [...s.hazardIds],
  };
}

/**
 * Build a deterministic, size-bounded snapshot view of a `CompiledTrack`.
 * The first `SNAPSHOT_FULL_PREFIX` segments land in `segmentsFull` so that
 * any per-segment math change shows up immediately. Beyond the prefix, only
 * every `SNAPSHOT_SAMPLE_STRIDE`-th segment lands in `segmentsSampled` so
 * the snapshot stays reviewable for long tracks.
 */
export function buildSnapshot(compiled: CompiledTrack): CompiledTrackSnapshot {
  const segmentsFull: SnapshotSegment[] = [];
  const segmentsSampled: SnapshotSegment[] = [];
  for (let i = 0; i < compiled.segments.length; i++) {
    const s = compiled.segments[i]!;
    if (i < SNAPSHOT_FULL_PREFIX) {
      segmentsFull.push(projectSegment(s));
    } else if (i % SNAPSHOT_SAMPLE_STRIDE === 0) {
      segmentsSampled.push(projectSegment(s));
    }
  }
  return {
    trackId: compiled.trackId,
    totalLengthMeters: compiled.totalLengthMeters,
    totalCompiledSegments: compiled.totalCompiledSegments,
    laps: compiled.laps,
    laneCount: compiled.laneCount,
    weatherOptions: [...compiled.weatherOptions],
    spawn: { gridSlots: compiled.spawn.gridSlots },
    warnings: [...compiled.warnings],
    segmentsFull,
    segmentsSampled,
    checkpoints: compiled.checkpoints.map((c) => ({
      authoredIndex: c.authoredIndex,
      compiledStart: c.compiledStart,
      label: c.label,
    })),
  };
}

function loadSnapshotFile(): Record<string, CompiledTrackSnapshot> {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  const raw = readFileSync(SNAPSHOT_PATH, "utf8");
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw) as Record<string, CompiledTrackSnapshot>;
}

/**
 * Stable JSON serialisation: object keys sorted recursively so diff output
 * stays meaningful across runs.
 */
function stableStringify(value: unknown): string {
  function sort(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = sort((v as Record<string, unknown>)[key]);
      }
      return out;
    }
    return v;
  }
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function writeSnapshotFile(all: Record<string, CompiledTrackSnapshot>): void {
  const tmpPath = `${SNAPSHOT_PATH}.tmp`;
  writeFileSync(tmpPath, stableStringify(all), "utf8");
  renameSync(tmpPath, SNAPSHOT_PATH);
}

export interface SnapshotMatchResult {
  ok: boolean;
  /** When `ok` is false, a stable JSON diff hint for the failure message. */
  expected?: string;
  actual?: string;
  /** True when the entry was written for the first time under UPDATE_SNAPSHOTS. */
  written?: boolean;
}

/**
 * Compare a compiled track against the stored snapshot keyed by `name`.
 * On miss with `UPDATE_SNAPSHOTS=1` set, writes the new entry and returns
 * `{ ok: true, written: true }`. On miss without the env var, returns
 * `{ ok: false, expected: "<not found>" }` so the caller can fail.
 */
export function matchSnapshot(name: string, compiled: CompiledTrack): SnapshotMatchResult {
  const all = loadSnapshotFile();
  const snapshot = buildSnapshot(compiled);
  const update = process.env.UPDATE_SNAPSHOTS === "1";

  if (!(name in all)) {
    if (update) {
      all[name] = snapshot;
      writeSnapshotFile(all);
      return { ok: true, written: true };
    }
    return {
      ok: false,
      expected: `<no snapshot for "${name}"; rerun with UPDATE_SNAPSHOTS=1>`,
      actual: stableStringify(snapshot),
    };
  }

  const expected = stableStringify(all[name]);
  const actual = stableStringify(snapshot);
  if (expected === actual) {
    return { ok: true };
  }
  if (update) {
    all[name] = snapshot;
    writeSnapshotFile(all);
    return { ok: true, written: true };
  }
  return { ok: false, expected, actual };
}
