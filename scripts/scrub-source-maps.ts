/**
 * Source-map workspace path scrubber.
 *
 * Source of truth: `docs/FOLLOWUPS.md` F-031. The
 * `feat/build-version-stamping` slice enabled
 * `productionBrowserSourceMaps: true` in `next.config.mjs` so the future
 * opt-in error reporter can map minified frames back to source. The
 * verify step `grep -E '/Users/|/home/' .next/static/chunks/*.js.map`
 * flagged the framework maps for shipping the developer's absolute
 * workspace prefix in `sources` / `sourcesContent`.
 *
 * This script implements F-031 fix path (a): a post-build pass over the
 * generated `.js.map` files that rewrites every absolute occurrence of
 * the workspace root with a stable sentinel so two builds from two
 * different workspaces produce byte-identical maps and no shipped
 * artefact carries a developer's filesystem layout. The scrub runs
 * after `next build` via the `postbuild` npm script, so the developer
 * does not have to remember to invoke it.
 *
 * Behaviour:
 * - Walks `.next/static/chunks` recursively for `*.js.map` files (the
 *   browser-facing maps that ride along with shipped JS bundles). The
 *   scan is conservative: server-side maps under `.next/server/` are
 *   not included because they never reach the client.
 * - For each map, parses the JSON, rewrites every entry of `sources`
 *   and `sourcesContent` by replacing the absolute workspace prefix
 *   with `vibegear2://`. The rewrite is idempotent: a second run is a
 *   no-op because the sentinel never matches the workspace prefix.
 * - Writes the file back only when the scrubbed JSON differs from the
 *   original so file mtimes stay stable for unchanged maps.
 * - Skips files that fail to parse as JSON (defensive: a malformed map
 *   is a build problem the scrubber should surface, not mask).
 *
 * Exit code:
 * - 0 on success (any number of files scrubbed, including zero).
 * - 1 if `.next/static/chunks` does not exist (build was not run).
 * - 1 if any file failed to parse or write.
 *
 * The scrubber is exported as pure functions so the unit tests in
 * `scripts/__tests__/scrub-source-maps.test.ts` can exercise every
 * branch without writing files. The CLI entry guard mirrors the
 * pattern in `scripts/content-lint.ts`.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The sentinel that replaces the workspace root in shipped source maps.
 * Chosen to be a clearly synthetic URL scheme so a future error reporter
 * (or a developer reading a stack trace) can recognise the rewrite at a
 * glance and map it back to the source tree relative to the repo root.
 */
export const WORKSPACE_SENTINEL = "vibegear2://";

/**
 * The minimal slice of the source-map v3 shape we touch. Any other
 * fields are preserved as-is by reading the JSON into a record and
 * rewriting only the two fields known to leak workspace paths.
 */
export interface SourceMapJson {
  version?: number;
  file?: string;
  sources?: unknown;
  sourcesContent?: unknown;
  [key: string]: unknown;
}

/**
 * Replace every absolute occurrence of `workspaceRoot` in `text` with
 * `WORKSPACE_SENTINEL`. The replace is global and case-sensitive: the
 * filesystem on macOS is case-insensitive in lookup but the build
 * pipeline (webpack, swc, next) writes the prefix in canonical form,
 * so a case-sensitive replace is sufficient and avoids touching paths
 * that happen to share a case-folded prefix.
 *
 * Empty / missing roots are passed through unchanged so a CI environment
 * without a workspace prefix (e.g. tarball install at `/`) does not
 * accidentally scrub the leading slash.
 */
export function scrubWorkspaceFromString(text: string, workspaceRoot: string): string {
  if (typeof text !== "string" || workspaceRoot.length === 0) {
    return text;
  }
  // Plain split / join is the fastest way to do a global literal replace
  // without re-escaping for a regex. The sentinel is a short literal so
  // the join cost stays negligible even for the largest source-map
  // entries we ship (the framework maps are ~500 KB).
  return text.split(workspaceRoot).join(WORKSPACE_SENTINEL);
}

/**
 * Scrub a parsed source-map JSON in place by rewriting every entry of
 * `sources` and `sourcesContent`. Returns the same object reference so
 * callers can chain or detect identity equality. Other fields are left
 * untouched so the rewrite preserves source-map v3 semantics.
 *
 * Defensive against non-array `sources` / `sourcesContent` (the shape
 * is enforced by source-map v3 but a malformed input should pass
 * through unchanged rather than crash the post-build step).
 */
export function scrubSourceMapJson(
  map: SourceMapJson,
  workspaceRoot: string,
): SourceMapJson {
  if (Array.isArray(map.sources)) {
    map.sources = map.sources.map((entry) =>
      typeof entry === "string"
        ? scrubWorkspaceFromString(entry, workspaceRoot)
        : entry,
    );
  }
  if (Array.isArray(map.sourcesContent)) {
    map.sourcesContent = map.sourcesContent.map((entry) =>
      typeof entry === "string"
        ? scrubWorkspaceFromString(entry, workspaceRoot)
        : entry,
    );
  }
  return map;
}

/**
 * Scrub the file at `absPath`, writing only if the scrubbed contents
 * differ. Returns a status describing what happened so the CLI can
 * print a one-line summary per file.
 */
export type ScrubFileResult =
  | { kind: "scrubbed"; path: string; bytesBefore: number; bytesAfter: number }
  | { kind: "unchanged"; path: string }
  | { kind: "skipped"; path: string; reason: string };

export function scrubSourceMapFile(
  absPath: string,
  workspaceRoot: string,
): ScrubFileResult {
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch (error) {
    return { kind: "skipped", path: absPath, reason: `read failed: ${(error as Error).message}` };
  }

  let parsed: SourceMapJson;
  try {
    parsed = JSON.parse(raw) as SourceMapJson;
  } catch (error) {
    return { kind: "skipped", path: absPath, reason: `json parse failed: ${(error as Error).message}` };
  }

  scrubSourceMapJson(parsed, workspaceRoot);
  const scrubbed = JSON.stringify(parsed);
  if (scrubbed === raw) {
    return { kind: "unchanged", path: absPath };
  }

  try {
    writeFileSync(absPath, scrubbed, "utf8");
  } catch (error) {
    return { kind: "skipped", path: absPath, reason: `write failed: ${(error as Error).message}` };
  }
  return {
    kind: "scrubbed",
    path: absPath,
    bytesBefore: raw.length,
    bytesAfter: scrubbed.length,
  };
}

/**
 * Recursively walk `root` and yield absolute paths matching `predicate`.
 * Hidden directories (leading dot, e.g. nested `.git`) are skipped; the
 * top-level `.next` directory is reached because the caller passes its
 * absolute path directly rather than walking from the repo root.
 */
export function* walkFiles(
  root: string,
  predicate: (absPath: string) => boolean,
): Generator<string> {
  if (!existsSync(root)) return;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const abs = join(root, entry);
    let stats;
    try {
      stats = statSync(abs);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      yield* walkFiles(abs, predicate);
    } else if (stats.isFile() && predicate(abs)) {
      yield abs;
    }
  }
}

/**
 * Scrub every `*.js.map` file under `chunksDir`. Returns one result per
 * file in walk order. Callers compose this into a CLI summary or assert
 * on the per-file outcomes in tests.
 */
export interface ScrubRunInput {
  chunksDir: string;
  workspaceRoot: string;
}

export function scrubChunksDir(input: ScrubRunInput): ScrubFileResult[] {
  const results: ScrubFileResult[] = [];
  for (const abs of walkFiles(input.chunksDir, (p) => p.endsWith(".js.map"))) {
    results.push(scrubSourceMapFile(abs, input.workspaceRoot));
  }
  return results;
}

/**
 * Build a one-line CLI summary from the per-file results: total files
 * scrubbed, unchanged, skipped, plus the byte delta. Keeps the
 * post-build noise to a single line in the common case.
 */
export function summariseResults(results: readonly ScrubFileResult[]): string {
  let scrubbed = 0;
  let unchanged = 0;
  let skipped = 0;
  let bytesDelta = 0;
  for (const result of results) {
    if (result.kind === "scrubbed") {
      scrubbed += 1;
      bytesDelta += result.bytesAfter - result.bytesBefore;
    } else if (result.kind === "unchanged") {
      unchanged += 1;
    } else {
      skipped += 1;
    }
  }
  const parts = [
    `scrubbed=${scrubbed}`,
    `unchanged=${unchanged}`,
    `skipped=${skipped}`,
    `bytesDelta=${bytesDelta}`,
  ];
  return `scrub-source-maps: ${parts.join(" ")}`;
}

// CLI entry -----------------------------------------------------------------

/**
 * `vite-node --script scripts/scrub-source-maps.ts` enters here. Resolves
 * the workspace root from `process.cwd()` (the npm `postbuild` hook runs
 * with the repo root as cwd) and scans `.next/static/chunks` for
 * source-map files. Exits non-zero when the chunks directory is missing
 * (the script was invoked without a prior build) or when any file
 * failed to read / parse / write.
 */
function main(): void {
  const workspaceRoot = process.cwd();
  const chunksDir = resolve(workspaceRoot, ".next/static/chunks");
  if (!existsSync(chunksDir)) {
    process.stdout.write(
      `scrub-source-maps: ${relative(workspaceRoot, chunksDir)} not found, run 'next build' first\n`,
    );
    process.exit(1);
  }

  const results = scrubChunksDir({ chunksDir, workspaceRoot });
  process.stdout.write(`${summariseResults(results)}\n`);

  const skipped = results.filter((r) => r.kind === "skipped");
  if (skipped.length > 0) {
    for (const result of skipped) {
      if (result.kind === "skipped") {
        process.stdout.write(
          `scrub-source-maps: skip ${relative(workspaceRoot, result.path)}: ${result.reason}\n`,
        );
      }
    }
    process.exit(1);
  }
  process.exit(0);
}

// Entry guard mirrors `scripts/content-lint.ts`: only run main() when
// invoked directly (vite-node --script), never on an import from a test.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  /scrub-source-maps\.ts$/u.test(process.argv[1]);

if (invokedDirectly) {
  main();
}
