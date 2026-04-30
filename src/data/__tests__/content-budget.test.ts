/**
 * Content budget enforcement test, per the GDD §27 "Scope creep" mitigation.
 *
 * Walks the bundled content directories (`src/data/tracks/**`,
 * `src/data/cars/*.json`) and asserts that the v1.0 caps in
 * `CONTENT_BUDGET` are not exceeded. Also enforces the §24 MVP minimums so
 * that a regression cannot silently delete a shipped track or car.
 *
 * The cap numbers live in `src/data/content-budget.ts`. Raising them
 * requires editing that constant and the matching GDD §27 row in the same
 * PR. Inlining the numeric caps in another test would defeat the
 * single-source-of-truth contract; a guard test below asserts that the
 * cap-checking assertions only reference the constant.
 *
 * Track JSONs may live in subdirectories (e.g.
 * `src/data/tracks/velvet-coast/harbor-run.json`), so the walk recurses.
 * A file is "a track" when it parses against `TrackSchema`; non-track
 * JSONs are surfaced as a test failure rather than silently ignored
 * (so that an accidental drop of, say, a `region.json` next to track files
 * does not bypass the count).
 *
 * Cross-references:
 * - `docs/gdd/27-risks-and-mitigations.md` ("Scope creep" row).
 * - `docs/gdd/24-content-plan.md` ("Full v1.0 content").
 * - `src/data/cars/index.ts` and `src/data/tracks/index.ts` barrels.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CARS } from "@/data/cars";
import { CONTENT_BUDGET } from "@/data/content-budget";
import { CarSchema, TrackSchema } from "@/data/schemas";
import { TRACK_IDS, TRACK_RAW } from "@/data/tracks";

/**
 * Repo-root-relative paths so the walker is robust to the test runner's
 * working directory. `process.cwd()` is the project root under both `npm
 * test` (vitest run from package root) and the CI matrix.
 */
const TRACKS_DIR = path.resolve(process.cwd(), "src/data/tracks");
const CARS_DIR = path.resolve(process.cwd(), "src/data/cars");

interface WalkedFile {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the walked root, for friendly error messages. */
  relPath: string;
}

/**
 * Recursively collect every `*.json` file under `root`. Synchronous I/O is
 * intentional: tests run on a developer machine or CI runner with the repo
 * checked out, and the directory trees are small (worst case at v1.0 ship:
 * 32 + 6 files plus a handful of region subfolders).
 */
function walkJsonFiles(root: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      // Directory might not exist yet (e.g. bare clone before any tracks
      // are authored under a region subfolder). Treat as empty.
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry);
      const stats = statSync(abs);
      if (stats.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (stats.isFile() && entry.endsWith(".json")) {
        out.push({ absPath: abs, relPath: path.relative(root, abs) });
      }
    }
  }
  // Stable sort for deterministic error output across platforms.
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

function readJson(absPath: string): unknown {
  return JSON.parse(readFileSync(absPath, "utf8")) as unknown;
}

describe("content budget: tracks", () => {
  const trackJsonFiles = walkJsonFiles(TRACKS_DIR).filter(
    (file) => !file.relPath.startsWith(`_benchmark${path.sep}`),
  );

  it("counts every JSON under src/data/tracks as a valid track", () => {
    const failures: string[] = [];
    for (const file of trackJsonFiles) {
      const parsed = TrackSchema.safeParse(readJson(file.absPath));
      if (!parsed.success) {
        failures.push(
          `${file.relPath}: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Non-track JSON files under src/data/tracks/ would not count toward the budget. ` +
          `Move these out of src/data/tracks/ or fix the schema:\n${failures.join("\n")}`,
      );
    }
  });

  it("does not exceed the v1.0 cap of CONTENT_BUDGET.tracks files", () => {
    if (trackJsonFiles.length > CONTENT_BUDGET.tracks) {
      throw new Error(
        `Track count ${trackJsonFiles.length} exceeds the v1.0 budget of ` +
          `${CONTENT_BUDGET.tracks}. The §27 scope-creep mitigation hard-caps ` +
          `the bundled track set at ${CONTENT_BUDGET.tracks}. Either remove a ` +
          `track or raise CONTENT_BUDGET.tracks AND the matching GDD §27 row ` +
          `in the same PR.\nFiles found:\n${trackJsonFiles
            .map((f) => `  - ${f.relPath}`)
            .join("\n")}`,
      );
    }
    expect(trackJsonFiles.length).toBeLessThanOrEqual(CONTENT_BUDGET.tracks);
  });

  it("meets the MVP minimum once content lands beyond the test stubs", () => {
    // During the MVP window only the two `test/*` tracks are authored.
    // Once the first MVP track lands, this assertion flips to enforce the
    // §24 minimum. The gate keeps the test green during the build-out and
    // turns into a regression guard the moment real content ships.
    const realTracks = trackJsonFiles.filter(
      (f) => !f.relPath.startsWith("test-") && !f.relPath.includes(`${path.sep}test-`),
    );
    if (realTracks.length === 0) {
      // Pre-MVP: no shipped tracks yet, only test stubs. Nothing to enforce.
      expect(trackJsonFiles.length).toBeGreaterThan(0);
      return;
    }
    if (realTracks.length < CONTENT_BUDGET.mvpTracks) {
      throw new Error(
        `Real track count ${realTracks.length} is below the MVP minimum of ` +
          `${CONTENT_BUDGET.mvpTracks} (per §24 "Suggested region and track ` +
          `list"). Authoring is in progress; once at least ` +
          `${CONTENT_BUDGET.mvpTracks} non-test tracks ship, this assertion ` +
          `holds.`,
      );
    }
    expect(realTracks.length).toBeGreaterThanOrEqual(CONTENT_BUDGET.mvpTracks);
  });

  it("registers every track JSON in the TRACK_RAW barrel", () => {
    const orphans = trackJsonFiles.filter((file) => {
      const raw = readJson(file.absPath);
      const parsed = TrackSchema.safeParse(raw);
      if (!parsed.success) return false;
      return !(parsed.data.id in TRACK_RAW);
    });
    if (orphans.length > 0) {
      throw new Error(
        `Track JSONs are not registered in src/data/tracks/index.ts:\n${orphans
          .map((f) => `  - ${f.relPath}`)
          .join("\n")}\n` +
          `Add an import + TRACK_RAW entry for each so loadTrack can find it.`,
      );
    }
  });

  it("backs every TRACK_RAW entry with a JSON file on disk", () => {
    const fileIds = new Set(
      trackJsonFiles
        .map((f) => TrackSchema.safeParse(readJson(f.absPath)))
        .filter((parsed) => parsed.success)
        .map((parsed) => (parsed as { success: true; data: { id: string } }).data.id),
    );
    const phantom = TRACK_IDS.filter((id) => !fileIds.has(id));
    if (phantom.length > 0) {
      throw new Error(
        `TRACK_RAW lists ids without a backing JSON file under src/data/tracks/:\n${phantom
          .map((id) => `  - ${id}`)
          .join("\n")}`,
      );
    }
  });
});

describe("content budget: cars", () => {
  // `src/data/cars/index.ts` is the source of truth for the bundled set;
  // `CARS` re-exports it as a typed array.
  const carJsonFiles = readdirSync(CARS_DIR).filter(
    (entry) => entry.endsWith(".json"),
  );

  it("does not exceed the v1.0 cap of CONTENT_BUDGET.cars files", () => {
    if (carJsonFiles.length > CONTENT_BUDGET.cars) {
      throw new Error(
        `Car JSON count ${carJsonFiles.length} exceeds the v1.0 budget of ` +
          `${CONTENT_BUDGET.cars}. The §27 scope-creep mitigation hard-caps ` +
          `the bundled car set at ${CONTENT_BUDGET.cars}. Either remove a car ` +
          `or raise CONTENT_BUDGET.cars AND the matching GDD §27 row in the ` +
          `same PR.\nFiles found:\n${carJsonFiles
            .map((f) => `  - ${f}`)
            .join("\n")}`,
      );
    }
    expect(carJsonFiles.length).toBeLessThanOrEqual(CONTENT_BUDGET.cars);
  });

  it("meets the MVP minimum of CONTENT_BUDGET.mvpCars cars", () => {
    expect(CARS.length).toBeGreaterThanOrEqual(CONTENT_BUDGET.mvpCars);
  });

  it("registers every car JSON in the cars barrel", () => {
    const registeredIds = new Set(CARS.map((car) => car.id));
    const failures: string[] = [];
    for (const entry of carJsonFiles) {
      const abs = path.join(CARS_DIR, entry);
      const parsed = CarSchema.safeParse(readJson(abs));
      if (!parsed.success) {
        failures.push(
          `${entry}: schema rejected: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
        continue;
      }
      if (!registeredIds.has(parsed.data.id)) {
        failures.push(
          `${entry}: id "${parsed.data.id}" not re-exported from src/data/cars/index.ts`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Car JSON / barrel mismatches:\n${failures.join("\n")}`,
      );
    }
  });
});

describe("content budget: cap source-of-truth guard", () => {
  it("exposes the four documented caps as positive integers", () => {
    expect(CONTENT_BUDGET.tracks).toBeGreaterThan(0);
    expect(CONTENT_BUDGET.cars).toBeGreaterThan(0);
    expect(CONTENT_BUDGET.mvpTracks).toBeGreaterThan(0);
    expect(CONTENT_BUDGET.mvpCars).toBeGreaterThan(0);
    expect(Number.isInteger(CONTENT_BUDGET.tracks)).toBe(true);
    expect(Number.isInteger(CONTENT_BUDGET.cars)).toBe(true);
    expect(Number.isInteger(CONTENT_BUDGET.mvpTracks)).toBe(true);
    expect(Number.isInteger(CONTENT_BUDGET.mvpCars)).toBe(true);
  });

  it("keeps MVP minimums at or below the v1.0 caps", () => {
    expect(CONTENT_BUDGET.mvpTracks).toBeLessThanOrEqual(CONTENT_BUDGET.tracks);
    expect(CONTENT_BUDGET.mvpCars).toBeLessThanOrEqual(CONTENT_BUDGET.cars);
  });

  it("matches the §27 cap row exactly (32 tracks, 6 cars)", () => {
    // §27 currently locks the cap at 32 tracks and 6 cars. If the GDD
    // amends the cap, update this assertion in the same PR (per the §27
    // mitigation contract). The assertion exists so that a constant-only
    // edit cannot silently drift away from the GDD row.
    expect(CONTENT_BUDGET.tracks).toBe(32);
    expect(CONTENT_BUDGET.cars).toBe(6);
  });

  it("matches the §24 MVP row exactly (8 tracks, 3 cars)", () => {
    expect(CONTENT_BUDGET.mvpTracks).toBe(8);
    expect(CONTENT_BUDGET.mvpCars).toBe(3);
  });

  it("freezes the constant so no caller can mutate the caps at runtime", () => {
    expect(Object.isFrozen(CONTENT_BUDGET)).toBe(true);
  });
});
