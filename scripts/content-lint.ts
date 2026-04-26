/**
 * Content lint.
 *
 * Source of truth: `docs/LEGAL_SAFETY.md` section 9 ("Enforcement: content
 * lint"). The repository is a spiritual successor to a 1990s racer per GDD
 * sections 1 and 2; the IP perimeter rules in `LEGAL_SAFETY.md` section 2
 * forbid shipping content that names real circuits, real car
 * manufacturers, or the original-game trademarks. This script is the
 * automated enforcement of that perimeter, run as part of `npm run verify`.
 *
 * Rules enforced (each maps to a `LintHit.rule`):
 *
 * 1. `binary-without-manifest`: Every binary file under `public/` (image,
 *    audio, font extension) must be referenced by an asset manifest entry.
 *    The manifest source today is the union of every `manifestForTrack`
 *    invocation across the runtime (see `src/asset/manifest.ts`) plus any
 *    `*.manifest.json` listing dropped under `public/`. Today `public/`
 *    does not exist, so the check no-ops; once the asset pipeline ships
 *    its first binary, every entry must be declared somewhere.
 * 2. `track-real-circuit-name`: Any track JSON under `src/data/tracks/`
 *    or `public/` whose serialised content contains a real-circuit name
 *    from the denylist (Nurburgring, Spa, Suzuka, Monza, Silverstone,
 *    Imola, Estoril, Le Mans, Monaco, Daytona, Indianapolis). Matched as
 *    a whole-word, case-insensitive token so generic prose ("spa day")
 *    is not a false positive. The denylist is appendable here.
 * 3. `car-manufacturer-name`: Any car JSON under `src/data/cars/` whose
 *    serialised content contains a manufacturer name from the denylist
 *    (Skyline, Mustang, Civic, Camaro, Supra, Lancer). Whole-word
 *    case-insensitive match for the same reason.
 * 4. `topgear-text`: Any shipped data JSON whose content matches a Top
 *    Gear denylist (`Top Gear`, `topgear`, `Kemco`, `Snowblind`). Scoped
 *    to data JSON only because the README, the page title, and source
 *    comments legitimately describe the project as a spiritual successor
 *    to Top Gear 2 per `docs/gdd/01-title-and-high-concept.md`.
 *
 * Exit code:
 * - 0 when no hits.
 * - 1 when any hit is found. Each hit is printed on its own line in the
 *   form `path: rule: detail` so a pre-push hook can grep the output.
 *
 * Run via `npm run content-lint`. The denylist constants below are the
 * authoritative copy; the doc text in `LEGAL_SAFETY.md` is illustrative
 * per the "authoritative list lives in the lint script when it lands"
 * clause in section 9.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";

// Denylists -----------------------------------------------------------------

/**
 * Real circuits whose names cannot ship in track JSON. Whole-word match,
 * case-insensitive. New entries appended here take effect on the next
 * `npm run verify`. `Le Mans` carries a space, handled by the matcher.
 */
export const TRACK_REAL_CIRCUIT_DENYLIST: readonly string[] = [
  "Nurburgring",
  "Spa",
  "Suzuka",
  "Monza",
  "Silverstone",
  "Imola",
  "Estoril",
  "Le Mans",
  "Monaco",
  "Daytona",
  "Indianapolis",
];

/**
 * Real car manufacturer model names whose names cannot ship in car JSON.
 * Whole-word case-insensitive. The catalogue in `src/data/cars/` uses
 * original names like "Sparrow GT" and "Bastion LM"; this guard catches
 * regressions during modding or accidental rename.
 */
export const CAR_MANUFACTURER_DENYLIST: readonly string[] = [
  "Skyline",
  "Mustang",
  "Civic",
  "Camaro",
  "Supra",
  "Lancer",
];

/**
 * Top Gear / publisher denylist. Scoped to data JSON only so the
 * README / page tagline / source comments can legitimately describe the
 * project as a spiritual successor without tripping the lint.
 */
export const TOPGEAR_TEXT_DENYLIST: readonly string[] = [
  "Top Gear",
  "topgear",
  "Kemco",
  "Snowblind",
];

/**
 * File extensions treated as binary assets when scanning `public/`. The
 * asset preloader recognises these via `AssetKind` (`image`, `audio`,
 * plus fonts).
 */
export const BINARY_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".bmp",
  ".ogg",
  ".mp3",
  ".wav",
  ".flac",
  ".m4a",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];

// Pure matchers (exported for unit tests) -----------------------------------

export interface LintHit {
  path: string;
  rule:
    | "binary-without-manifest"
    | "track-real-circuit-name"
    | "car-manufacturer-name"
    | "topgear-text";
  detail: string;
}

/**
 * Build a regex that matches `term` as a whole token, case-insensitively.
 * Tokens may contain ASCII letters, digits, or single internal spaces
 * (for "Le Mans"). Uses lookarounds so the boundaries are characters, not
 * just `\b` (which would split on the internal space of "Le Mans" and
 * miss the multi-word match).
 */
export function buildDenylistRegex(term: string): RegExp {
  // Escape regex metachars in case a future term carries one.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Boundaries: not preceded or followed by an alphanumeric character.
  // The `u` flag keeps Unicode-safe semantics even though our denylist is
  // ASCII today.
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "iu");
}

/**
 * Scan a single file's text content for any term in `denylist`. Returns
 * the first hit so callers can early-exit per file; ordering follows
 * `denylist` so adding terms at the head surfaces them first.
 */
export function findDenylistHit(
  text: string,
  denylist: readonly string[],
): string | null {
  for (const term of denylist) {
    if (buildDenylistRegex(term).test(text)) {
      return term;
    }
  }
  return null;
}

/**
 * Walk a directory recursively and yield absolute paths of every file
 * matching `predicate`. Symlinks are not followed. Hidden directories
 * (leading dot) are skipped because they hold tooling state, not content.
 */
export function* walkFiles(
  root: string,
  predicate: (absPath: string) => boolean,
): Generator<string> {
  if (!existsSync(root)) return;
  const entries = readdirSync(root);
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
 * True when `abs` is one of the binary kinds we expect to live behind
 * an asset manifest entry (image, audio, font).
 */
export function isBinaryAssetPath(abs: string): boolean {
  return BINARY_EXTENSIONS.includes(extname(abs).toLowerCase());
}

// Lint passes (exported so the test suite can drive each in isolation) -----

export interface LintInput {
  /** Repo root. The four passes resolve their scan dirs from here. */
  repoRoot: string;
  /**
   * Optional manifest entry list. When omitted the manifest pass scans
   * any `*.manifest.json` under `public/` for asset URLs. Tests inject
   * a synthetic list to drive every branch without writing files.
   */
  manifestEntries?: readonly string[];
}

/**
 * Pass 1: every binary under `public/` must appear in the union manifest.
 * The union manifest is `manifestEntries` when supplied, otherwise the
 * concatenation of every `*.manifest.json` file under `public/` (read as
 * an array of `{ src: string }` entries or an array of strings). Returns
 * one hit per orphan binary.
 */
export function lintBinaryManifest(input: LintInput): LintHit[] {
  const publicDir = resolve(input.repoRoot, "public");
  if (!existsSync(publicDir)) {
    return [];
  }

  const manifestEntries = input.manifestEntries
    ? new Set(input.manifestEntries.map(normaliseManifestEntry))
    : collectPublicManifestEntries(publicDir);

  const hits: LintHit[] = [];
  for (const abs of walkFiles(publicDir, isBinaryAssetPath)) {
    const rel = `/${relative(publicDir, abs).split(/[\\/]/).join("/")}`;
    if (!manifestEntries.has(rel)) {
      hits.push({
        path: relative(input.repoRoot, abs),
        rule: "binary-without-manifest",
        detail: `no asset manifest entry references ${rel}`,
      });
    }
  }
  return hits;
}

/**
 * Read every `*.manifest.json` under `public/` and collect the asset
 * paths each declares. Each manifest is either an array of strings
 * (`["assets/cars/sparrow-gt.png"]`) or an array of `{ src: string }`
 * entries (matching `AssetEntry` from `src/asset/preload.ts`). Returns
 * a Set of paths normalised to leading-slash form.
 */
function collectPublicManifestEntries(publicDir: string): Set<string> {
  const entries = new Set<string>();
  for (const abs of walkFiles(publicDir, (p) =>
    p.endsWith(".manifest.json"),
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (typeof entry === "string") {
        entries.add(normaliseManifestEntry(entry));
      } else if (entry && typeof entry === "object" && "src" in entry) {
        const src = (entry as { src: unknown }).src;
        if (typeof src === "string") {
          entries.add(normaliseManifestEntry(src));
        }
      }
    }
  }
  return entries;
}

function normaliseManifestEntry(entry: string): string {
  // Strip query / fragment so a future bundler-cache-busting suffix does
  // not desync the lint from the actual file on disk.
  const noQuery = entry.split("?")[0]?.split("#")[0] ?? entry;
  // Coerce to leading-slash absolute form to match the on-disk relpath.
  return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
}

/**
 * Pass 2: track JSON with real-circuit names. Scans `src/data/tracks/`
 * and `public/` (any track JSON dropped there by the asset pipeline).
 */
export function lintTrackNames(input: LintInput): LintHit[] {
  const hits: LintHit[] = [];
  const roots = [
    resolve(input.repoRoot, "src/data/tracks"),
    resolve(input.repoRoot, "public"),
  ];
  for (const root of roots) {
    for (const abs of walkFiles(root, (p) => p.endsWith(".json"))) {
      // Only scan files that look like track JSON: contain `"segments"`
      // and `"laps"` keys. This avoids the manifest passes and the
      // championship JSON tripping the rule on accidental matches.
      const text = safeRead(abs);
      if (!text || !looksLikeTrackJson(text)) continue;
      const hit = findDenylistHit(text, TRACK_REAL_CIRCUIT_DENYLIST);
      if (hit) {
        hits.push({
          path: relative(input.repoRoot, abs),
          rule: "track-real-circuit-name",
          detail: `track references real-circuit name "${hit}"`,
        });
      }
    }
  }
  return hits;
}

/**
 * Pass 3: car JSON with manufacturer names. Scans `src/data/cars/`.
 */
export function lintCarNames(input: LintInput): LintHit[] {
  const hits: LintHit[] = [];
  const root = resolve(input.repoRoot, "src/data/cars");
  for (const abs of walkFiles(root, (p) => p.endsWith(".json"))) {
    const text = safeRead(abs);
    if (!text) continue;
    const hit = findDenylistHit(text, CAR_MANUFACTURER_DENYLIST);
    if (hit) {
      hits.push({
        path: relative(input.repoRoot, abs),
        rule: "car-manufacturer-name",
        detail: `car references manufacturer name "${hit}"`,
      });
    }
  }
  return hits;
}

/**
 * Pass 4: shipped data JSON with Top Gear / publisher text. Scans the
 * `src/data/` tree and `public/`. Source code, README, and docs are
 * intentionally excluded because they legitimately describe the project
 * as a spiritual successor per `docs/gdd/01-title-and-high-concept.md`.
 */
export function lintTopGearText(input: LintInput): LintHit[] {
  const hits: LintHit[] = [];
  const roots = [
    resolve(input.repoRoot, "src/data"),
    resolve(input.repoRoot, "public"),
  ];
  for (const root of roots) {
    for (const abs of walkFiles(root, (p) => p.endsWith(".json"))) {
      const text = safeRead(abs);
      if (!text) continue;
      const hit = findDenylistHit(text, TOPGEAR_TEXT_DENYLIST);
      if (hit) {
        hits.push({
          path: relative(input.repoRoot, abs),
          rule: "topgear-text",
          detail: `data file contains denied text "${hit}"`,
        });
      }
    }
  }
  return hits;
}

/**
 * True when the JSON text shape resembles a track. We probe by key name
 * rather than parsing because a future track JSON may carry comments
 * (json5) and we want a robust signal that does not depend on schema
 * conformance. Conservative: requires both `segments` and `laps` so a
 * championship or sponsor JSON does not trip the rule.
 */
function looksLikeTrackJson(text: string): boolean {
  return /"segments"\s*:/.test(text) && /"laps"\s*:/.test(text);
}

function safeRead(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Run every pass and return the concatenated hit list. Order is stable:
 * binary-without-manifest first, then track / car / topgear. Tests rely
 * on this ordering for assertion stability.
 */
export function runContentLint(input: LintInput): LintHit[] {
  return [
    ...lintBinaryManifest(input),
    ...lintTrackNames(input),
    ...lintCarNames(input),
    ...lintTopGearText(input),
  ];
}

// CLI entry -----------------------------------------------------------------

/**
 * Format a single hit as a one-line string the CLI prints. Pre-push hooks
 * can grep this format; tests assert on it directly.
 */
export function formatHit(hit: LintHit): string {
  return `${hit.path}: ${hit.rule}: ${hit.detail}`;
}

/**
 * `vite-node --script scripts/content-lint.ts` enters here. Resolves the
 * repo root from `process.cwd()` so `npm run content-lint` invoked from
 * the repo root scans the right tree. Prints each hit on its own line
 * and exits non-zero on any hit.
 */
function main(): void {
  const repoRoot = process.cwd();
  const hits = runContentLint({ repoRoot });
  if (hits.length === 0) {
    process.stdout.write("content-lint: clean\n");
    process.exit(0);
  }
  for (const hit of hits) {
    process.stdout.write(`${formatHit(hit)}\n`);
  }
  process.stdout.write(
    `content-lint: ${hits.length} hit${hits.length === 1 ? "" : "s"}\n`,
  );
  process.exit(1);
}

// Entry guard: only run main() when invoked directly (vite-node --script
// or node loaders), never on a `import { ... } from "scripts/content-lint"`
// from a test. `process.argv[1]` ends with this file's basename when run
// as a script.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  /content-lint\.ts$/u.test(process.argv[1]);

if (invokedDirectly) {
  main();
}
