/**
 * Unit tests for `scripts/scrub-source-maps.ts`.
 *
 * The script post-processes `.js.map` files that `next build` writes
 * under `.next/static/chunks/` so the developer's absolute workspace
 * prefix is replaced with a stable sentinel before the build artefact
 * leaves the machine. These tests cover:
 *
 * - Pure rewrites: `scrubWorkspaceFromString` and `scrubSourceMapJson`
 *   exercise the `sources` / `sourcesContent` paths plus the defensive
 *   handling of malformed shapes.
 * - File-level: `scrubSourceMapFile` writes synthetic maps under a temp
 *   directory and asserts the on-disk contents change exactly when the
 *   workspace prefix appears.
 * - Idempotence: a second run is a no-op (no further bytes change).
 * - Directory walk: `scrubChunksDir` mirrors the production layout
 *   (`static/chunks/main.js.map`, `static/chunks/app/page.js.map`) and
 *   asserts every nested map is rewritten in walk order.
 * - CLI summary: `summariseResults` rolls up per-file outcomes into the
 *   one-line postbuild log.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  WORKSPACE_SENTINEL,
  scrubChunksDir,
  scrubSourceMapFile,
  scrubSourceMapJson,
  scrubWorkspaceFromString,
  summariseResults,
  walkFiles,
} from "../scrub-source-maps";

// Helpers -------------------------------------------------------------------

let repoRoot: string;
let chunksDir: string;
const WORKSPACE = "/Users/devbox/Documents/Dev/VibeGear2";

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "scrub-source-maps-"));
  chunksDir = join(repoRoot, ".next/static/chunks");
  mkdirSync(chunksDir, { recursive: true });
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function writeMap(relPath: string, body: object): string {
  const abs = join(chunksDir, relPath);
  const dir = abs.substring(0, abs.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(abs, JSON.stringify(body), "utf8");
  return abs;
}

function readMap(abs: string): unknown {
  return JSON.parse(readFileSync(abs, "utf8"));
}

// Pure rewriters ------------------------------------------------------------

describe("scrubWorkspaceFromString", () => {
  it("replaces every occurrence of the workspace root with the sentinel", () => {
    const input = `${WORKSPACE}/node_modules/next/dist/foo.js;${WORKSPACE}/src/bar.ts`;
    const output = scrubWorkspaceFromString(input, WORKSPACE);
    expect(output).toBe(
      `${WORKSPACE_SENTINEL}/node_modules/next/dist/foo.js;${WORKSPACE_SENTINEL}/src/bar.ts`,
    );
  });

  it("returns the input unchanged when the workspace prefix is absent", () => {
    const input = "webpack://_N_E/./src/foo.ts";
    expect(scrubWorkspaceFromString(input, WORKSPACE)).toBe(input);
  });

  it("returns the input unchanged when the workspace root is empty", () => {
    const input = `${WORKSPACE}/src/foo.ts`;
    expect(scrubWorkspaceFromString(input, "")).toBe(input);
  });

  it("returns the input unchanged when the input is not a string", () => {
    expect(scrubWorkspaceFromString(null as unknown as string, WORKSPACE)).toBe(
      null as unknown as string,
    );
  });

  it("is idempotent: a second pass over scrubbed output is a no-op", () => {
    const input = `${WORKSPACE}/src/foo.ts`;
    const once = scrubWorkspaceFromString(input, WORKSPACE);
    const twice = scrubWorkspaceFromString(once, WORKSPACE);
    expect(twice).toBe(once);
  });

  it("is case-sensitive so a same-prefix-different-case path is preserved", () => {
    const input = `${WORKSPACE.toLowerCase()}/src/foo.ts`;
    expect(scrubWorkspaceFromString(input, WORKSPACE)).toBe(input);
  });
});

describe("scrubSourceMapJson", () => {
  it("rewrites every entry of sources and sourcesContent", () => {
    const map = {
      version: 3,
      sources: [
        `${WORKSPACE}/node_modules/next/dist/a.js`,
        "webpack://_N_E/./src/b.ts",
        `${WORKSPACE}/src/c.ts`,
      ],
      sourcesContent: [
        `import("${WORKSPACE}/node_modules/next/dist/a.js");`,
        "/* (ignored) */",
        null,
      ],
      mappings: "AAAA",
    };
    scrubSourceMapJson(map, WORKSPACE);
    expect(map.sources).toEqual([
      `${WORKSPACE_SENTINEL}/node_modules/next/dist/a.js`,
      "webpack://_N_E/./src/b.ts",
      `${WORKSPACE_SENTINEL}/src/c.ts`,
    ]);
    expect(map.sourcesContent).toEqual([
      `import("${WORKSPACE_SENTINEL}/node_modules/next/dist/a.js");`,
      "/* (ignored) */",
      null,
    ]);
  });

  it("preserves unrelated fields (mappings, version, file, names, sourceRoot)", () => {
    const map = {
      version: 3,
      file: "static/chunks/main.js",
      sourceRoot: "",
      sources: [`${WORKSPACE}/src/a.ts`],
      sourcesContent: ["// content"],
      mappings: "AAAA;BBBB",
      names: ["foo", "bar"],
      ignoreList: [0],
    };
    const before = JSON.parse(JSON.stringify(map));
    scrubSourceMapJson(map, WORKSPACE);
    expect(map.version).toBe(before.version);
    expect(map.file).toBe(before.file);
    expect(map.sourceRoot).toBe(before.sourceRoot);
    expect(map.mappings).toBe(before.mappings);
    expect(map.names).toEqual(before.names);
    expect(map.ignoreList).toEqual(before.ignoreList);
  });

  it("returns the same object reference for chaining and identity tests", () => {
    const map = { sources: [], sourcesContent: [] };
    expect(scrubSourceMapJson(map, WORKSPACE)).toBe(map);
  });

  it("passes through when sources and sourcesContent are missing", () => {
    const map: Record<string, unknown> = { version: 3, mappings: "" };
    scrubSourceMapJson(map, WORKSPACE);
    expect(map).toEqual({ version: 3, mappings: "" });
  });

  it("does not crash when sources or sourcesContent are not arrays", () => {
    const map = {
      sources: "not an array",
      sourcesContent: 42 as unknown,
    };
    scrubSourceMapJson(map as Record<string, unknown>, WORKSPACE);
    expect(map.sources).toBe("not an array");
    expect(map.sourcesContent).toBe(42);
  });
});

// File-level ---------------------------------------------------------------

describe("scrubSourceMapFile", () => {
  it("rewrites a map file containing the workspace prefix", () => {
    const abs = writeMap("main.js.map", {
      version: 3,
      sources: [`${WORKSPACE}/src/a.ts`],
      sourcesContent: [`/* ${WORKSPACE} */`],
      mappings: "AAAA",
    });
    const result = scrubSourceMapFile(abs, WORKSPACE);
    expect(result.kind).toBe("scrubbed");
    expect(readMap(abs)).toEqual({
      version: 3,
      sources: [`${WORKSPACE_SENTINEL}/src/a.ts`],
      sourcesContent: [`/* ${WORKSPACE_SENTINEL} */`],
      mappings: "AAAA",
    });
  });

  it("returns 'unchanged' when the map carries no workspace prefix", () => {
    const abs = writeMap("clean.js.map", {
      version: 3,
      sources: ["webpack://_N_E/./src/a.ts"],
      sourcesContent: ["// no leak"],
      mappings: "AAAA",
    });
    const before = readFileSync(abs, "utf8");
    const result = scrubSourceMapFile(abs, WORKSPACE);
    expect(result.kind).toBe("unchanged");
    expect(readFileSync(abs, "utf8")).toBe(before);
  });

  it("is idempotent: a second scrub does nothing", () => {
    const abs = writeMap("idempotent.js.map", {
      version: 3,
      sources: [`${WORKSPACE}/src/a.ts`],
      sourcesContent: [],
      mappings: "AAAA",
    });
    const first = scrubSourceMapFile(abs, WORKSPACE);
    expect(first.kind).toBe("scrubbed");
    const second = scrubSourceMapFile(abs, WORKSPACE);
    expect(second.kind).toBe("unchanged");
  });

  it("returns 'skipped' on a malformed JSON file", () => {
    const abs = join(chunksDir, "broken.js.map");
    writeFileSync(abs, "{not json", "utf8");
    const result = scrubSourceMapFile(abs, WORKSPACE);
    expect(result.kind).toBe("skipped");
    if (result.kind === "skipped") {
      expect(result.reason).toMatch(/json parse failed/);
    }
  });

  it("returns 'skipped' when the file cannot be read", () => {
    const result = scrubSourceMapFile(
      join(chunksDir, "missing.js.map"),
      WORKSPACE,
    );
    expect(result.kind).toBe("skipped");
    if (result.kind === "skipped") {
      expect(result.reason).toMatch(/read failed/);
    }
  });
});

// Walk + run ---------------------------------------------------------------

describe("walkFiles", () => {
  it("yields every file matching the predicate, recursively", () => {
    writeMap("a.js.map", { version: 3, sources: [], sourcesContent: [], mappings: "" });
    writeMap("app/page.js.map", { version: 3, sources: [], sourcesContent: [], mappings: "" });
    writeMap("nested/deep/x.js.map", { version: 3, sources: [], sourcesContent: [], mappings: "" });
    writeFileSync(join(chunksDir, "a.js"), "console.log(1);", "utf8");
    const found = Array.from(
      walkFiles(chunksDir, (p) => p.endsWith(".js.map")),
    ).map((p) => p.replace(`${chunksDir}/`, ""));
    expect(found.sort()).toEqual([
      "a.js.map",
      "app/page.js.map",
      "nested/deep/x.js.map",
    ]);
  });

  it("returns no entries when the root does not exist", () => {
    expect(Array.from(walkFiles(join(repoRoot, "missing"), () => true))).toEqual([]);
  });

  it("skips hidden directories", () => {
    mkdirSync(join(chunksDir, ".cache"), { recursive: true });
    writeFileSync(join(chunksDir, ".cache/secret.js.map"), "{}", "utf8");
    writeMap("visible.js.map", { version: 3, sources: [], sourcesContent: [], mappings: "" });
    const found = Array.from(walkFiles(chunksDir, (p) => p.endsWith(".js.map")));
    expect(found).toHaveLength(1);
    expect(found[0]?.endsWith("visible.js.map")).toBe(true);
  });
});

describe("scrubChunksDir", () => {
  it("scrubs every nested .js.map and reports per-file results", () => {
    const a = writeMap("main.js.map", {
      version: 3,
      sources: [`${WORKSPACE}/src/a.ts`],
      sourcesContent: [],
      mappings: "AAAA",
    });
    const b = writeMap("app/page.js.map", {
      version: 3,
      sources: [`${WORKSPACE}/src/b.ts`],
      sourcesContent: [],
      mappings: "AAAA",
    });
    const c = writeMap("clean.js.map", {
      version: 3,
      sources: ["webpack://_N_E/./src/c.ts"],
      sourcesContent: [],
      mappings: "AAAA",
    });
    const results = scrubChunksDir({ chunksDir, workspaceRoot: WORKSPACE });
    const byPath = new Map(results.map((r) => [r.path, r.kind]));
    expect(byPath.get(a)).toBe("scrubbed");
    expect(byPath.get(b)).toBe("scrubbed");
    expect(byPath.get(c)).toBe("unchanged");
    expect(readMap(a)).toMatchObject({
      sources: [`${WORKSPACE_SENTINEL}/src/a.ts`],
    });
    expect(readMap(b)).toMatchObject({
      sources: [`${WORKSPACE_SENTINEL}/src/b.ts`],
    });
  });

  it("returns an empty list when the chunks dir is empty", () => {
    expect(scrubChunksDir({ chunksDir, workspaceRoot: WORKSPACE })).toEqual([]);
  });

  it("returns an empty list when the chunks dir is missing", () => {
    rmSync(chunksDir, { recursive: true, force: true });
    expect(existsSync(chunksDir)).toBe(false);
    expect(scrubChunksDir({ chunksDir, workspaceRoot: WORKSPACE })).toEqual([]);
  });

  it("ignores files that are not source maps", () => {
    writeFileSync(join(chunksDir, "a.js"), `// ${WORKSPACE}/src/a.ts`, "utf8");
    expect(scrubChunksDir({ chunksDir, workspaceRoot: WORKSPACE })).toEqual([]);
    // The non-map file is untouched even though it carries the prefix.
    expect(readFileSync(join(chunksDir, "a.js"), "utf8")).toBe(
      `// ${WORKSPACE}/src/a.ts`,
    );
  });
});

describe("summariseResults", () => {
  it("counts every kind and accumulates the byte delta", () => {
    const summary = summariseResults([
      { kind: "scrubbed", path: "/a", bytesBefore: 100, bytesAfter: 60 },
      { kind: "scrubbed", path: "/b", bytesBefore: 50, bytesAfter: 30 },
      { kind: "unchanged", path: "/c" },
      { kind: "skipped", path: "/d", reason: "json parse failed" },
    ]);
    expect(summary).toBe(
      "scrub-source-maps: scrubbed=2 unchanged=1 skipped=1 bytesDelta=-60",
    );
  });

  it("renders zeros for an empty result list", () => {
    expect(summariseResults([])).toBe(
      "scrub-source-maps: scrubbed=0 unchanged=0 skipped=0 bytesDelta=0",
    );
  });
});

// Smoke against the live repo ----------------------------------------------

describe("live repo source maps", () => {
  it("contain no workspace-prefix leaks after the postbuild scrub (skipped if no build)", () => {
    // Read-only smoke. The `postbuild` npm script (`vite-node --script
    // scripts/scrub-source-maps.ts`) runs the scrub in place after
    // `next build`; this test asserts the on-disk artefact stays clean
    // without re-invoking the scrubber so a regression in the build
    // pipeline (or in the postbuild wiring) is caught here too.
    const liveChunks = join(process.cwd(), ".next/static/chunks");
    if (!existsSync(liveChunks)) {
      return;
    }
    for (const abs of walkFiles(liveChunks, (p) => p.endsWith(".js.map"))) {
      const text = readFileSync(abs, "utf8");
      expect(text.includes(process.cwd())).toBe(false);
    }
  });
});
