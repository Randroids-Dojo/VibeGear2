/**
 * Unit tests for `scripts/content-lint.ts`.
 *
 * The script is the automated enforcement of `docs/LEGAL_SAFETY.md`
 * section 9. These tests cover the four rules that live in the script
 * (binary-without-manifest, track-real-circuit-name,
 * car-manufacturer-name, topgear-text) plus the pure helpers
 * (`buildDenylistRegex`, `findDenylistHit`, `formatHit`,
 * `isBinaryAssetPath`) so adding a future rule does not have to relearn
 * the matcher semantics.
 *
 * Strategy: each lint pass writes a synthetic repo tree under a temp
 * directory and asserts the returned hits. The tree mirrors the
 * production layout (`src/data/cars`, `src/data/tracks`, `public/`) so
 * the production code path is exercised end-to-end without mocking the
 * filesystem.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BINARY_EXTENSIONS,
  CAR_MANUFACTURER_DENYLIST,
  TOPGEAR_TEXT_DENYLIST,
  TRACK_REAL_CIRCUIT_DENYLIST,
  buildDenylistRegex,
  findDenylistHit,
  formatHit,
  isBinaryAssetPath,
  lintBinaryManifest,
  lintCarNames,
  lintTopGearText,
  lintTrackNames,
  runContentLint,
} from "../content-lint";

// Helpers -------------------------------------------------------------------

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "content-lint-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function writeFile(relPath: string, contents: string): void {
  const abs = join(repoRoot, relPath);
  const dir = abs.substring(0, abs.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(abs, contents, "utf8");
}

const TRACK_BODY_FRAGMENT = `"laps": 1, "segments": [{}]`;

// Pure matchers -------------------------------------------------------------

describe("buildDenylistRegex", () => {
  it("matches the term as a whole word case-insensitively", () => {
    const re = buildDenylistRegex("Spa");
    expect(re.test("Spa Francorchamps")).toBe(true);
    expect(re.test("spa")).toBe(true);
    expect(re.test("SPA")).toBe(true);
  });

  it("does not match when the term is part of another word", () => {
    const re = buildDenylistRegex("Spa");
    expect(re.test("space")).toBe(false);
    expect(re.test("respawn")).toBe(false);
    expect(re.test("dayspa")).toBe(false);
  });

  it("matches multi-word terms with internal spaces", () => {
    const re = buildDenylistRegex("Le Mans");
    expect(re.test("the Le Mans circuit")).toBe(true);
    expect(re.test("le mans 24 hours")).toBe(true);
    // Adjacent letters must not extend the match boundary.
    expect(re.test("ALe Mans")).toBe(false);
    expect(re.test("Le Manse")).toBe(false);
  });

  it("escapes regex metachars in the term", () => {
    const re = buildDenylistRegex("a.b");
    expect(re.test("a.b")).toBe(true);
    expect(re.test("axb")).toBe(false);
  });
});

describe("findDenylistHit", () => {
  it("returns the first matching term in denylist order", () => {
    const hit = findDenylistHit("Mustang and Civic on the track", [
      "Skyline",
      "Mustang",
      "Civic",
    ]);
    expect(hit).toBe("Mustang");
  });

  it("returns null when nothing matches", () => {
    const hit = findDenylistHit("Sparrow GT and Bastion LM", CAR_MANUFACTURER_DENYLIST);
    expect(hit).toBeNull();
  });

  it("scans the entire text not just the first line", () => {
    const text = "line one\nline two\nthe Imola corner";
    const hit = findDenylistHit(text, TRACK_REAL_CIRCUIT_DENYLIST);
    expect(hit).toBe("Imola");
  });
});

describe("formatHit", () => {
  it("renders path, rule, and detail on one line", () => {
    const out = formatHit({
      path: "src/data/cars/example.json",
      rule: "car-manufacturer-name",
      detail: 'car references manufacturer name "Mustang"',
    });
    expect(out).toBe(
      'src/data/cars/example.json: car-manufacturer-name: car references manufacturer name "Mustang"',
    );
  });
});

describe("isBinaryAssetPath", () => {
  it("recognises every BINARY_EXTENSIONS entry", () => {
    for (const ext of BINARY_EXTENSIONS) {
      expect(isBinaryAssetPath(`/some/file${ext}`)).toBe(true);
      expect(isBinaryAssetPath(`/some/file${ext.toUpperCase()}`)).toBe(true);
    }
  });

  it("rejects non-binary kinds", () => {
    expect(isBinaryAssetPath("/data/track.json")).toBe(false);
    expect(isBinaryAssetPath("/code/file.ts")).toBe(false);
    expect(isBinaryAssetPath("/README.md")).toBe(false);
  });
});

// lintBinaryManifest --------------------------------------------------------

describe("lintBinaryManifest", () => {
  it("returns no hits when public/ does not exist", () => {
    expect(lintBinaryManifest({ repoRoot })).toEqual([]);
  });

  it("returns no hits when public/ has no binaries", () => {
    writeFile("public/README.txt", "no binaries here");
    expect(lintBinaryManifest({ repoRoot })).toEqual([]);
  });

  it("flags an orphan binary missing from the manifest", () => {
    writeFile("public/assets/cars/sparrow-gt.png", "PNGDATA");
    const hits = lintBinaryManifest({ repoRoot, manifestEntries: [] });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.rule).toBe("binary-without-manifest");
    expect(hits[0]?.detail).toContain("/assets/cars/sparrow-gt.png");
  });

  it("passes a binary that the manifest references", () => {
    writeFile("public/assets/cars/sparrow-gt.png", "PNGDATA");
    const hits = lintBinaryManifest({
      repoRoot,
      manifestEntries: ["/assets/cars/sparrow-gt.png"],
    });
    expect(hits).toEqual([]);
  });

  it("normalises manifest entries that omit the leading slash", () => {
    writeFile("public/assets/audio/clear.ogg", "OGGDATA");
    const hits = lintBinaryManifest({
      repoRoot,
      manifestEntries: ["assets/audio/clear.ogg"],
    });
    expect(hits).toEqual([]);
  });

  it("strips query and fragment when normalising manifest entries", () => {
    writeFile("public/assets/fonts/roboto.woff2", "FONTDATA");
    const hits = lintBinaryManifest({
      repoRoot,
      manifestEntries: ["/assets/fonts/roboto.woff2?v=2"],
    });
    expect(hits).toEqual([]);
  });

  it("reads *.manifest.json files under public/ when no entries are injected", () => {
    writeFile("public/assets/cars/sparrow-gt.png", "PNGDATA");
    writeFile(
      "public/cars.manifest.json",
      JSON.stringify([{ src: "/assets/cars/sparrow-gt.png" }]),
    );
    expect(lintBinaryManifest({ repoRoot })).toEqual([]);
  });

  it("accepts a manifest authored as an array of strings", () => {
    writeFile("public/assets/audio/rain.ogg", "OGGDATA");
    writeFile(
      "public/audio.manifest.json",
      JSON.stringify(["/assets/audio/rain.ogg"]),
    );
    expect(lintBinaryManifest({ repoRoot })).toEqual([]);
  });

  it("flags every orphan binary with a stable order", () => {
    writeFile("public/a.png", "x");
    writeFile("public/sub/b.ogg", "x");
    const hits = lintBinaryManifest({ repoRoot, manifestEntries: [] });
    expect(hits.map((h) => h.path).sort()).toEqual(
      ["public/a.png", "public/sub/b.ogg"].sort(),
    );
  });

  it("ignores hidden directories like .DS_Store side-folders", () => {
    writeFile("public/.cache/skip.png", "x");
    expect(lintBinaryManifest({ repoRoot, manifestEntries: [] })).toEqual([]);
  });
});

// lintTrackNames ------------------------------------------------------------

describe("lintTrackNames", () => {
  it("returns no hits when src/data/tracks/ contains only safe names", () => {
    writeFile(
      "src/data/tracks/coast-road.json",
      JSON.stringify({
        id: "coast-road",
        name: "Coast Road",
        laps: 1,
        segments: [{}],
      }),
    );
    expect(lintTrackNames({ repoRoot })).toEqual([]);
  });

  it("flags a track JSON whose name matches a real-circuit token", () => {
    writeFile(
      "src/data/tracks/north-loop.json",
      JSON.stringify({
        id: "north-loop",
        name: "Nurburgring North Loop",
        laps: 1,
        segments: [{}],
      }),
    );
    const hits = lintTrackNames({ repoRoot });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.rule).toBe("track-real-circuit-name");
    expect(hits[0]?.detail).toContain("Nurburgring");
  });

  it("flags a track that uses Le Mans even with intervening words", () => {
    writeFile(
      "src/data/tracks/endurance.json",
      JSON.stringify({
        id: "endurance",
        name: "the Le Mans 24",
        laps: 1,
        segments: [{}],
      }),
    );
    const hits = lintTrackNames({ repoRoot });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.detail).toContain("Le Mans");
  });

  it("does not flag generic words that share a substring with a denylist term", () => {
    writeFile(
      "src/data/tracks/spaceport.json",
      JSON.stringify({
        id: "spaceport",
        name: "Spaceport Run",
        laps: 1,
        segments: [{}],
      }),
    );
    expect(lintTrackNames({ repoRoot })).toEqual([]);
  });

  it("skips JSON files that do not look like a track", () => {
    writeFile(
      "src/data/tracks/sponsor-list.json",
      JSON.stringify({ name: "Monaco Sponsors" }),
    );
    // No `laps` / `segments` fields, so the rule does not apply.
    expect(lintTrackNames({ repoRoot })).toEqual([]);
  });

  it("scans track JSON dropped under public/ as well", () => {
    writeFile(
      "public/assets/tracks/silverstone.json",
      JSON.stringify({
        id: "silverstone",
        name: "Silverstone",
        laps: 1,
        segments: [{}],
      }),
    );
    const hits = lintTrackNames({ repoRoot });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toContain("public/assets/tracks/silverstone.json");
  });
});

// lintCarNames --------------------------------------------------------------

describe("lintCarNames", () => {
  it("returns no hits when src/data/cars/ contains only safe names", () => {
    writeFile(
      "src/data/cars/sparrow-gt.json",
      JSON.stringify({ id: "sparrow-gt", name: "Sparrow GT" }),
    );
    expect(lintCarNames({ repoRoot })).toEqual([]);
  });

  it.each(CAR_MANUFACTURER_DENYLIST)(
    "flags a car JSON containing %s",
    (term) => {
      writeFile(
        "src/data/cars/sample.json",
        JSON.stringify({ id: "sample", name: `${term} Tribute` }),
      );
      const hits = lintCarNames({ repoRoot });
      expect(hits).toHaveLength(1);
      expect(hits[0]?.rule).toBe("car-manufacturer-name");
      expect(hits[0]?.detail).toContain(term);
    },
  );

  it("does not flag generic English words that share a substring", () => {
    writeFile(
      "src/data/cars/freebird.json",
      JSON.stringify({ id: "freebird", name: "Freebird Custom" }),
    );
    expect(lintCarNames({ repoRoot })).toEqual([]);
  });

  it("ignores files outside src/data/cars/", () => {
    writeFile(
      "src/game/notes.json",
      JSON.stringify({ note: "Skyline reference for prior art" }),
    );
    expect(lintCarNames({ repoRoot })).toEqual([]);
  });
});

// lintTopGearText -----------------------------------------------------------

describe("lintTopGearText", () => {
  it("returns no hits when no data file mentions the trademark text", () => {
    writeFile(
      "src/data/sponsors.json",
      JSON.stringify([{ id: "s1", sponsorName: "Cleanline" }]),
    );
    expect(lintTopGearText({ repoRoot })).toEqual([]);
  });

  it.each(TOPGEAR_TEXT_DENYLIST)("flags data containing %s", (term) => {
    writeFile(
      "src/data/notes.json",
      JSON.stringify({ note: `inspired by ${term}` }),
    );
    const hits = lintTopGearText({ repoRoot });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.rule).toBe("topgear-text");
    expect(hits[0]?.detail).toContain(term);
  });

  it("scopes the scan to data JSON, not source code", () => {
    writeFile(
      "src/app/page.tsx",
      `export const tagline = "Spiritual successor to Top Gear 2.";`,
    );
    expect(lintTopGearText({ repoRoot })).toEqual([]);
  });

  it("scans data JSON dropped under public/ as well", () => {
    writeFile(
      "public/data/intro.json",
      JSON.stringify({ note: "Snowblind era racer" }),
    );
    const hits = lintTopGearText({ repoRoot });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.detail).toContain("Snowblind");
  });
});

// runContentLint ------------------------------------------------------------

describe("runContentLint", () => {
  it("returns hits from every pass in stable order", () => {
    writeFile("public/assets/cars/orphan.png", "x");
    writeFile(
      "src/data/tracks/monza.json",
      JSON.stringify({
        id: "monza",
        name: "Monza",
        laps: 1,
        segments: [{}],
      }),
    );
    writeFile(
      "src/data/cars/sample.json",
      JSON.stringify({ id: "sample", name: "Mustang Special" }),
    );
    writeFile(
      "src/data/notes.json",
      JSON.stringify({ note: "Kemco brand" }),
    );

    const hits = runContentLint({ repoRoot, manifestEntries: [] });
    const rules = hits.map((h) => h.rule);
    expect(rules).toEqual([
      "binary-without-manifest",
      "track-real-circuit-name",
      "car-manufacturer-name",
      "topgear-text",
    ]);
  });

  it("returns an empty list when every pass is clean", () => {
    writeFile(
      "src/data/cars/sparrow-gt.json",
      JSON.stringify({ id: "sparrow-gt", name: "Sparrow GT" }),
    );
    writeFile(
      "src/data/tracks/coast-road.json",
      JSON.stringify({
        id: "coast-road",
        name: "Coast Road",
        laps: 1,
        segments: [{}],
      }),
    );
    expect(runContentLint({ repoRoot })).toEqual([]);
  });
});

// Smoke check on production data --------------------------------------------

describe("repository data is clean", () => {
  it("runs the lint against the real repo and returns no hits", () => {
    // Resolve the repo root from the current working directory by walking
    // up until we find package.json. Vitest runs from the repo root so
    // process.cwd() should already be correct, but the walk is harmless.
    let cwd = process.cwd();
    while (cwd !== "/" && !existsSync(join(cwd, "package.json"))) {
      cwd = join(cwd, "..");
    }
    const hits = runContentLint({ repoRoot: cwd });
    if (hits.length > 0) {
      throw new Error(
        `repository content-lint failed:\n${hits.map(formatHit).join("\n")}`,
      );
    }
    // Sanity: TRACK_BODY_FRAGMENT is a documented constant referenced by
    // the test file so future refactors that drop the helper still get a
    // compile-time signal.
    expect(TRACK_BODY_FRAGMENT.length).toBeGreaterThan(0);
  });
});

