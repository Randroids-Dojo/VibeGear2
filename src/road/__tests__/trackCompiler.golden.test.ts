/**
 * Golden-master tests for `compileTrack`.
 *
 * Five hand-authored fixtures (`fixtures/*.json`) compile to expected
 * snapshots stored in `__snapshots__/trackCompiler.snapshots.json`. Update
 * the snapshot with `UPDATE_SNAPSHOTS=1 vitest run --no-coverage src/road`.
 *
 * Each fixture is also re-validated against `TrackSchema` in setup so that
 * an invalid fixture fails loudly before the snapshot comparison runs. This
 * prevents a stealthy "snapshot pinned but the input is malformed" failure.
 */

import { describe, expect, it } from "vitest";
import { TrackSchema, type Track } from "@/data/schemas";
import { compileTrack } from "../trackCompiler";
import { matchSnapshot } from "./snapshotHelpers";

import boundaryFixture from "./fixtures/boundary.json";
import crestFixture from "./fixtures/crest.json";
import gentleCurveFixture from "./fixtures/gentle-curve.json";
import mvpVsFixture from "./fixtures/mvp-vs.json";
import straightFixture from "./fixtures/straight.json";

const FIXTURES: ReadonlyArray<{ name: string; raw: unknown }> = [
  { name: "straight", raw: straightFixture },
  { name: "gentle-curve", raw: gentleCurveFixture },
  { name: "crest", raw: crestFixture },
  { name: "mvp-vs", raw: mvpVsFixture },
  { name: "boundary", raw: boundaryFixture },
];

function parseFixtureOrThrow(name: string, raw: unknown): Track {
  const parsed = TrackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `fixture "${name}" failed TrackSchema.safeParse: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

describe("trackCompiler golden-master", () => {
  for (const { name, raw } of FIXTURES) {
    describe(name, () => {
      const track = parseFixtureOrThrow(name, raw);

      it("compiles to the expected snapshot shape", () => {
        const compiled = compileTrack(track);
        const result = matchSnapshot(name, compiled);
        if (!result.ok) {
          throw new Error(
            `snapshot mismatch for "${name}":\nexpected:\n${result.expected}\n\nactual:\n${result.actual}`,
          );
        }
      });

      it("is deterministic across two compile calls (deep equal)", () => {
        const a = compileTrack(track);
        const b = compileTrack(track);
        // Bit-exact: pure function over identical input. No tolerance.
        expect(b).toEqual(a);
      });

      it("returns a deeply-frozen output that cannot be mutated", () => {
        const compiled = compileTrack(track);
        expect(Object.isFrozen(compiled)).toBe(true);
        expect(Object.isFrozen(compiled.segments)).toBe(true);
        expect(Object.isFrozen(compiled.checkpoints)).toBe(true);
        if (compiled.segments.length > 0) {
          expect(Object.isFrozen(compiled.segments[0])).toBe(true);
        }
      });
    });
  }
});
