/**
 * Deterministic physics-feel benchmarks.
 *
 * Source of truth: docs/gdd/27-risks-and-mitigations.md names
 * "replayable benchmark tracks" as the mitigation for physics-feel risk.
 * These tracks are dev tooling, not user-facing content.
 *
 * The suite replays compact scripted inputs through the ghost replay
 * pipeline, advances the same pure physics step used by the live car, and
 * checks lap time against committed expectations. The default tolerance is
 * deliberately loose at 5 percent so ordinary refactors do not block CI.
 * Intentional physics tuning changes should run:
 *
 *   UPDATE_BENCHMARK=1 npx vitest run src/game/__tests__/physics-feel.bench.test.ts
 *
 * Review and commit the expected JSON diffs in the same PR as the tuning
 * change, with a progress-log note explaining why the new baseline is
 * correct.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import brakeAndRecoverRaw from "@/data/tracks/_benchmark/brake-and-recover.json";
import brakeAndRecoverExpectedRaw from "@/data/tracks/_benchmark/expected/brake-and-recover.json";
import straightAccelExpectedRaw from "@/data/tracks/_benchmark/expected/straight-accel.json";
import sweepingCurveExpectedRaw from "@/data/tracks/_benchmark/expected/sweeping-curve.json";
import brakeAndRecoverInputsRaw from "@/data/tracks/_benchmark/inputs/brake-and-recover.json";
import straightAccelInputsRaw from "@/data/tracks/_benchmark/inputs/straight-accel.json";
import sweepingCurveInputsRaw from "@/data/tracks/_benchmark/inputs/sweeping-curve.json";
import straightAccelRaw from "@/data/tracks/_benchmark/straight-accel.json";
import sweepingCurveRaw from "@/data/tracks/_benchmark/sweeping-curve.json";
import { getCar, TRACK_IDS } from "@/data";
import { TrackSchema, type CarBaseStats, type Track } from "@/data/schemas";
import { createPlayer, createRecorder } from "@/game/ghost";
import { NEUTRAL_INPUT, type Input } from "@/game/input";
import { FIXED_STEP_MS, FIXED_STEP_SECONDS } from "@/game/loop";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
  type CarState,
} from "@/game/physics";
import { compileTrack } from "@/road/trackCompiler";

const BENCHMARK_TOLERANCE = 0.05;
const MAX_FRAMES = 60 * 60;
const SAMPLE_FRAMES = [60, 120, 240] as const;
const EXPECTED_DIR = "src/data/tracks/_benchmark/expected";

interface ScriptedInputFrame {
  frame: number;
  input: Input;
}

interface BenchmarkSample {
  speed: number;
  x: number;
  z: number;
}

type SampleFrame = (typeof SAMPLE_FRAMES)[number];

interface BenchmarkResult {
  trackId: string;
  referenceLapTimeMs: number;
  samples: Record<`${SampleFrame}`, BenchmarkSample>;
}

interface BenchmarkCase {
  name: string;
  track: Track;
  inputs: ScriptedInputFrame[];
  expected: BenchmarkResult;
  expectedFile: string;
}

const CASES: BenchmarkCase[] = [
  {
    name: "straight acceleration",
    track: TrackSchema.parse(straightAccelRaw),
    inputs: parseScript(straightAccelInputsRaw),
    expected: straightAccelExpectedRaw as BenchmarkResult,
    expectedFile: "straight-accel.json",
  },
  {
    name: "sweeping curve grip",
    track: TrackSchema.parse(sweepingCurveRaw),
    inputs: parseScript(sweepingCurveInputsRaw),
    expected: sweepingCurveExpectedRaw as BenchmarkResult,
    expectedFile: "sweeping-curve.json",
  },
  {
    name: "brake and recovery",
    track: TrackSchema.parse(brakeAndRecoverRaw),
    inputs: parseScript(brakeAndRecoverInputsRaw),
    expected: brakeAndRecoverExpectedRaw as BenchmarkResult,
    expectedFile: "brake-and-recover.json",
  },
];

describe("physics-feel benchmark tracks", () => {
  it.each(CASES.map((entry) => [entry.name, entry] as const))(
    "%s compiles and is not user-facing content",
    (_name, entry) => {
      const compiled = compileTrack(entry.track);
      expect(compiled.trackId).toBe(entry.track.id);
      expect(compiled.totalLengthMeters).toBeGreaterThan(0);
      expect(TRACK_IDS).not.toContain(entry.track.id);
    },
  );
});

describe("physics-feel ghost replay regression", () => {
  it.each(CASES.map((entry) => [entry.name, entry] as const))(
    "%s stays within the reference lap-time tolerance",
    (_name, entry) => {
      const actual = runBenchmark(entry);

      if (process.env.UPDATE_BENCHMARK === "1") {
        writeExpected(entry.expectedFile, actual);
        expect(actual.referenceLapTimeMs).toBeGreaterThan(0);
        return;
      }

      assertWithinTolerance(entry.expected, actual);
    },
  );

  it("is exactly deterministic across 100 invocations", () => {
    for (const entry of CASES) {
      const first = JSON.stringify(runBenchmark(entry));
      for (let i = 0; i < 100; i += 1) {
        expect(JSON.stringify(runBenchmark(entry))).toBe(first);
      }
    }
  });

  it("would fail on a lap-time drift larger than the tolerance", () => {
    const actual = runBenchmark(CASES[0]!);
    const staleExpected = {
      ...actual,
      referenceLapTimeMs: actual.referenceLapTimeMs * 0.9,
    };
    expect(() => assertWithinTolerance(staleExpected, actual)).toThrow(
      /outside tolerance/u,
    );
  });
});

function parseScript(raw: unknown): ScriptedInputFrame[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("benchmark input script must be an array");
  }

  return raw.map((entry) => {
    if (entry === null || typeof entry !== "object") {
      throw new TypeError("benchmark input entry must be an object");
    }
    const record = entry as { frame?: unknown; input?: unknown };
    if (
      typeof record.frame !== "number" ||
      !Number.isInteger(record.frame) ||
      record.frame < 0
    ) {
      throw new TypeError("benchmark input frame must be a non-negative integer");
    }
    return {
      frame: record.frame,
      input: parseInput(record.input),
    };
  }).sort((a, b) => a.frame - b.frame);
}

function parseInput(raw: unknown): Input {
  const candidate = raw as Partial<Input> | null;
  if (candidate === null || typeof candidate !== "object") {
    throw new TypeError("benchmark input payload must be an object");
  }
  return {
    steer: finiteNumber(candidate.steer),
    throttle: finiteNumber(candidate.throttle),
    brake: finiteNumber(candidate.brake),
    nitro: candidate.nitro === true,
    handbrake: candidate.handbrake === true,
    pause: candidate.pause === true,
    shiftUp: candidate.shiftUp === true,
    shiftDown: candidate.shiftDown === true,
  };
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function inputAt(script: readonly ScriptedInputFrame[], frame: number): Input {
  let current: Input = { ...NEUTRAL_INPUT };
  for (const entry of script) {
    if (entry.frame > frame) break;
    current = entry.input;
  }
  return current;
}

function runBenchmark(entry: BenchmarkCase): BenchmarkResult {
  const car = getCar("sparrow-gt");
  if (car === undefined) {
    throw new Error("sparrow-gt benchmark car is missing");
  }

  const compiled = compileTrack(entry.track);
  const replay = recordReplay(entry, car.baseStats);
  const player = createPlayer(replay);
  if (player.mismatchReason !== null) {
    throw new Error(
      `${entry.track.id} benchmark replay rejected: ${player.mismatchReason}`,
    );
  }

  let carState: CarState = { ...INITIAL_CAR_STATE };
  const samples: BenchmarkResult["samples"] = {
    "60": sampleOf(carState),
    "120": sampleOf(carState),
    "240": sampleOf(carState),
  };

  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const replayInput = player.readNext(frame);
    if (replayInput === null) {
      throw new Error(`${entry.track.id} benchmark replay unexpectedly returned null`);
    }
    carState = step(
      carState,
      replayInput,
      car.baseStats,
      DEFAULT_TRACK_CONTEXT,
      FIXED_STEP_SECONDS,
    );

    if (isSampleFrame(frame + 1)) {
      const sampleKey = `${frame + 1}` as `${SampleFrame}`;
      samples[sampleKey] = sampleOf(carState);
    }

    if (carState.z >= compiled.totalLengthMeters) {
      return {
        trackId: entry.track.id,
        referenceLapTimeMs: roundMs((frame + 1) * FIXED_STEP_MS),
        samples,
      };
    }
  }

  throw new Error(
    `${entry.track.id} did not finish within ${MAX_FRAMES} benchmark frames`,
  );
}

function recordReplay(
  entry: BenchmarkCase,
  stats: Readonly<CarBaseStats>,
) {
  const compiled = compileTrack(entry.track);
  const recorder = createRecorder({
    trackId: entry.track.id,
    trackVersion: entry.track.version,
    carId: "sparrow-gt",
    seed: 0,
  });

  let carState: CarState = { ...INITIAL_CAR_STATE };
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const scriptedInput = inputAt(entry.inputs, frame);
    recorder.record(scriptedInput, frame);
    carState = step(
      carState,
      scriptedInput,
      stats,
      DEFAULT_TRACK_CONTEXT,
      FIXED_STEP_SECONDS,
    );
    if (carState.z >= compiled.totalLengthMeters) break;
  }

  return recorder.finalize();
}

function isSampleFrame(frame: number): frame is SampleFrame {
  return SAMPLE_FRAMES.includes(frame as SampleFrame);
}

function sampleOf(state: Readonly<CarState>): BenchmarkSample {
  return {
    speed: roundMetric(state.speed),
    x: roundMetric(state.x),
    z: roundMetric(state.z),
  };
}

function assertWithinTolerance(
  expected: BenchmarkResult,
  actual: BenchmarkResult,
): void {
  expect(actual.trackId).toBe(expected.trackId);
  const toleranceMs = expected.referenceLapTimeMs * BENCHMARK_TOLERANCE;
  const drift = Math.abs(actual.referenceLapTimeMs - expected.referenceLapTimeMs);
  if (drift > toleranceMs) {
    throw new Error(
      `${actual.trackId} lap time ${actual.referenceLapTimeMs}ms drifted ${drift}ms from ${expected.referenceLapTimeMs}ms, outside tolerance ${toleranceMs}ms`,
    );
  }

  for (const frame of SAMPLE_FRAMES) {
    const key = `${frame}` as const;
    expect(actual.samples[key]).toEqual(expected.samples[key]);
  }
}

function writeExpected(fileName: string, result: BenchmarkResult): void {
  const target = path.join(process.cwd(), EXPECTED_DIR, fileName);
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function roundMs(value: number): number {
  return Number(value.toFixed(3));
}
