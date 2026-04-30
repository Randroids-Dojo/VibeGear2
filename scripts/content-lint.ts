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
 * 5. `mod-manifest`: Any public data mod under `public/mods/<mod-id>/`
 *    must ship a valid manifest, match its folder id, and reference
 *    schema-valid data files without executable plugin paths.
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
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import {
  AIDriverSchema,
  CarSchema,
  ChampionshipSchema,
  ModManifestSchema,
  RegionPaletteSchema,
  TrackSchema,
  UpgradeSchema,
} from "../src/data/schemas";

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
    | "topgear-text"
    | "mod-manifest"
    | "gdd-coverage-ledger"
    | "progress-log-coverage";
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

// Public mod manifests ------------------------------------------------------

function parseJson(abs: string): unknown | Error {
  const text = safeRead(abs);
  if (text === null) return new Error("file cannot be read");
  try {
    return JSON.parse(text);
  } catch (error) {
    return error as Error;
  }
}

type SchemaLike = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: unknown } | { success: false; error: Error };
};

function lintReferencedModFiles(
  input: LintInput,
  hits: LintHit[],
  manifestAbs: string,
  modDir: string,
  refs: readonly string[] | undefined,
  label: string,
  schema: SchemaLike,
): void {
  for (const ref of refs ?? []) {
    const abs = resolve(modDir, ref);
    const relFromMod = relative(modDir, abs);
    const firstRelSegment = relFromMod.split(/[\\/]/, 1)[0];
    if (
      relFromMod === ".." ||
      firstRelSegment === ".." ||
      isAbsolute(relFromMod)
    ) {
      hits.push({
        path: relative(input.repoRoot, manifestAbs),
        rule: "mod-manifest",
        detail: `${label} ref escapes mod folder: ${ref}`,
      });
      continue;
    }
    if (!existsSync(abs)) {
      hits.push({
        path: relative(input.repoRoot, manifestAbs),
        rule: "mod-manifest",
        detail: `${label} ref does not exist: ${ref}`,
      });
      continue;
    }
    const raw = parseJson(abs);
    if (raw instanceof Error) {
      hits.push({
        path: relative(input.repoRoot, abs),
        rule: "mod-manifest",
        detail: `${label} JSON parse failed: ${raw.message}`,
      });
      continue;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      hits.push({
        path: relative(input.repoRoot, abs),
        rule: "mod-manifest",
        detail: `${label} schema validation failed: ${parsed.error.message}`,
      });
    }
  }
}

/**
 * Validate public data-only mods. Each `public/mods/<mod-id>/manifest.json`
 * must match the mod manifest schema, match its folder id, and every
 * referenced data file must exist and validate against the matching content
 * schema. Binary asset provenance still runs through the existing manifest
 * pass; this pass owns the data-pack contract.
 */
export function lintPublicModManifests(input: LintInput): LintHit[] {
  const modsDir = resolve(input.repoRoot, "public/mods");
  if (!existsSync(modsDir)) return [];

  const hits: LintHit[] = [];
  for (const manifestAbs of walkFiles(modsDir, (p) =>
    basename(p) === MOD_MANIFEST_FILENAME,
  )) {
    const modDir = dirname(manifestAbs);
    const raw = parseJson(manifestAbs);
    if (raw instanceof Error) {
      hits.push({
        path: relative(input.repoRoot, manifestAbs),
        rule: "mod-manifest",
        detail: `manifest JSON parse failed: ${raw.message}`,
      });
      continue;
    }
    const parsed = ModManifestSchema.safeParse(raw);
    if (!parsed.success) {
      hits.push({
        path: relative(input.repoRoot, manifestAbs),
        rule: "mod-manifest",
        detail: `manifest schema validation failed: ${parsed.error.message}`,
      });
      continue;
    }
    const expectedId = basename(modDir);
    if (parsed.data.id !== expectedId) {
      hits.push({
        path: relative(input.repoRoot, manifestAbs),
        rule: "mod-manifest",
        detail: `manifest id "${parsed.data.id}" does not match folder "${expectedId}"`,
      });
    }

    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.tracks,
      "track",
      TrackSchema,
    );
    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.cars,
      "car",
      CarSchema,
    );
    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.upgrades,
      "upgrade",
      UpgradeSchema,
    );
    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.aiDrivers,
      "AI driver",
      AIDriverSchema,
    );
    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.championships,
      "championship",
      ChampionshipSchema,
    );
    lintReferencedModFiles(
      input,
      hits,
      manifestAbs,
      modDir,
      parsed.data.data.palettes,
      "palette",
      RegionPaletteSchema,
    );
  }
  return hits;
}

const MOD_MANIFEST_FILENAME = "manifest.json";

// GDD coverage ledger -------------------------------------------------------

const GDD_COVERAGE_PATH = "docs/GDD_COVERAGE.json";

const COVERAGE_KINDS = [
  "implemented-code",
  "automated-test",
  "open-followup",
  "open-question",
] as const;

type CoverageKind = (typeof COVERAGE_KINDS)[number];

const COVERAGE_KIND_SET = new Set<string>(COVERAGE_KINDS);

interface CoverageLedgerEntry {
  id: string;
  gddSections: string[];
  requirement: string;
  coverage: CoverageKind[];
  implementationRefs?: string[];
  testRefs?: string[];
  followupRefs?: string[];
  questionRefs?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return null;
  }
  return value;
}

function parseStatusEntries(markdown: string, prefix: "F" | "Q"): Map<string, string> {
  const statuses = new Map<string, string>();
  const re = new RegExp(
    `^## (${prefix}-\\d+):[\\s\\S]*?^\\*\\*Status:\\*\\* ([^\\n]+)`,
    "gmu",
  );
  for (const match of markdown.matchAll(re)) {
    const id = match[1];
    const status = match[2];
    if (id && status) {
      statuses.set(id, status.trim().toLowerCase());
    }
  }
  return statuses;
}

function refPathExists(repoRoot: string, ref: string): boolean {
  const pathOnly = ref.split("#")[0] ?? ref;
  const abs = resolve(repoRoot, pathOnly);
  return existsSync(abs);
}

function parseCoverageEntry(raw: unknown): CoverageLedgerEntry | string {
  if (!isRecord(raw)) return "entry must be an object";
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!/^GDD-\d{2}-[A-Z0-9-]+$/u.test(id)) {
    return "entry id must match GDD-NN-SLUG";
  }

  const gddSections = stringArray(raw.gddSections);
  if (!gddSections || gddSections.length === 0) {
    return `${id}: gddSections must be a non-empty string array`;
  }

  const requirement =
    typeof raw.requirement === "string" ? raw.requirement.trim() : "";
  if (requirement.length === 0) {
    return `${id}: requirement must be a non-empty string`;
  }

  const coverageRaw = stringArray(raw.coverage);
  if (!coverageRaw || coverageRaw.length === 0) {
    return `${id}: coverage must be a non-empty string array`;
  }
  const coverage: CoverageKind[] = [];
  for (const item of coverageRaw) {
    if (!COVERAGE_KIND_SET.has(item)) {
      return `${id}: unknown coverage kind "${item}"`;
    }
    coverage.push(item as CoverageKind);
  }

  const parsed: CoverageLedgerEntry = {
    id,
    gddSections,
    requirement,
    coverage,
  };
  for (const key of [
    "implementationRefs",
    "testRefs",
    "followupRefs",
    "questionRefs",
  ] as const) {
    const value = raw[key];
    if (value !== undefined) {
      const parsedValue = stringArray(value);
      if (!parsedValue) return `${id}: ${key} must be a string array`;
      parsed[key] = parsedValue;
    }
  }
  return parsed;
}

/**
 * Validate the machine-checkable GDD coverage ledger. The ledger maps
 * concrete requirements to code, tests, open followups, or open questions.
 */
export function lintGddCoverageLedger(input: LintInput): LintHit[] {
  const docsDir = resolve(input.repoRoot, "docs");
  if (!existsSync(docsDir)) return [];

  const ledgerAbs = resolve(input.repoRoot, GDD_COVERAGE_PATH);
  if (!existsSync(ledgerAbs)) {
    return [
      {
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: "missing GDD coverage ledger",
      },
    ];
  }

  const text = safeRead(ledgerAbs);
  if (!text) {
    return [
      {
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: "ledger cannot be read",
      },
    ];
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return [
      {
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: `ledger JSON parse failed: ${(error as Error).message}`,
      },
    ];
  }

  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.requirements)) {
    return [
      {
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: "ledger must contain version 1 and a requirements array",
      },
    ];
  }

  const followupStatuses = parseStatusEntries(
    safeRead(resolve(input.repoRoot, "docs/FOLLOWUPS.md")) ?? "",
    "F",
  );
  const questionStatuses = parseStatusEntries(
    safeRead(resolve(input.repoRoot, "docs/OPEN_QUESTIONS.md")) ?? "",
    "Q",
  );

  const hits: LintHit[] = [];
  const seen = new Set<string>();
  for (const rawEntry of raw.requirements) {
    const parsed = parseCoverageEntry(rawEntry);
    if (typeof parsed === "string") {
      hits.push({
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: parsed,
      });
      continue;
    }

    if (seen.has(parsed.id)) {
      hits.push({
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: `${parsed.id}: duplicate requirement id`,
      });
    }
    seen.add(parsed.id);

    for (const ref of parsed.gddSections) {
      if (!refPathExists(input.repoRoot, ref)) {
        hits.push({
          path: GDD_COVERAGE_PATH,
          rule: "gdd-coverage-ledger",
          detail: `${parsed.id}: missing GDD section ref ${ref}`,
        });
      }
    }

    if (parsed.coverage.includes("implemented-code")) {
      validatePathRefs(input, hits, parsed.id, "implementationRefs", parsed.implementationRefs);
    }
    if (parsed.coverage.includes("automated-test")) {
      validatePathRefs(input, hits, parsed.id, "testRefs", parsed.testRefs);
    }
    if (parsed.coverage.includes("open-followup")) {
      validateStatusRefs(hits, parsed.id, "followupRefs", parsed.followupRefs, followupStatuses, [
        "open",
        "in-progress",
      ]);
    }
    if (parsed.coverage.includes("open-question")) {
      validateStatusRefs(hits, parsed.id, "questionRefs", parsed.questionRefs, questionStatuses, [
        "open",
      ]);
    }
  }
  return hits;
}

function validatePathRefs(
  input: LintInput,
  hits: LintHit[],
  id: string,
  key: "implementationRefs" | "testRefs",
  refs: string[] | undefined,
): void {
  if (!refs || refs.length === 0) {
    hits.push({
      path: GDD_COVERAGE_PATH,
      rule: "gdd-coverage-ledger",
      detail: `${id}: ${key} is required`,
    });
    return;
  }
  for (const ref of refs) {
    if (!refPathExists(input.repoRoot, ref)) {
      hits.push({
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: `${id}: ${key} ref does not exist: ${ref}`,
      });
    }
  }
}

function validateStatusRefs(
  hits: LintHit[],
  id: string,
  key: "followupRefs" | "questionRefs",
  refs: string[] | undefined,
  statuses: Map<string, string>,
  allowedPrefixes: readonly string[],
): void {
  if (!refs || refs.length === 0) {
    hits.push({
      path: GDD_COVERAGE_PATH,
      rule: "gdd-coverage-ledger",
      detail: `${id}: ${key} is required`,
    });
    return;
  }
  for (const ref of refs) {
    const status = statuses.get(ref);
    if (!status) {
      hits.push({
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: `${id}: ${key} ref not found: ${ref}`,
      });
      continue;
    }
    if (!allowedPrefixes.some((prefix) => status.startsWith(prefix))) {
      hits.push({
        path: GDD_COVERAGE_PATH,
        rule: "gdd-coverage-ledger",
        detail: `${id}: ${ref} status is not open (${status})`,
      });
    }
  }
}

/**
 * Require the newest progress-log entry to name coverage ledger ids when
 * it claims GDD coverage. This keeps the append-only log tied to the
 * machine-checkable ledger without rewriting historical entries.
 */
export function lintLatestProgressLogCoverage(input: LintInput): LintHit[] {
  const progressAbs = resolve(input.repoRoot, "docs/PROGRESS_LOG.md");
  if (!existsSync(progressAbs)) return [];
  const text = safeRead(progressAbs);
  if (!text) return [];

  const match = /^## \d{4}-\d{2}-\d{2}: Slice: .+$/mu.exec(text);
  if (!match || match.index === undefined) return [];
  const start = match.index;
  const next = text.indexOf("\n## ", start + 1);
  const block = next >= 0 ? text.slice(start, next) : text.slice(start);
  if (!block.includes("**GDD sections touched:**")) return [];

  const hits: LintHit[] = [];
  const path = relative(input.repoRoot, progressAbs);
  if (!block.includes("### Coverage ledger")) {
    hits.push({
      path,
      rule: "progress-log-coverage",
      detail: "latest GDD-touching entry must include a Coverage ledger section",
    });
  }
  if (!/GDD-\d{2}-[A-Z0-9-]+/u.test(block)) {
    hits.push({
      path,
      rule: "progress-log-coverage",
      detail: "latest GDD-touching entry must cite at least one coverage ledger id",
    });
  }
  if (!/Uncovered adjacent requirements:/u.test(block)) {
    hits.push({
      path,
      rule: "progress-log-coverage",
      detail: "latest GDD-touching entry must list uncovered adjacent requirements",
    });
  }
  return hits;
}

/**
 * Run every pass and return the concatenated hit list. Order is stable:
 * binary-without-manifest first, then track / car / topgear / mod
 * manifest checks. Tests rely on this ordering for assertion stability.
 */
export function runContentLint(input: LintInput): LintHit[] {
  return [
    ...lintBinaryManifest(input),
    ...lintTrackNames(input),
    ...lintCarNames(input),
    ...lintTopGearText(input),
    ...lintPublicModManifests(input),
    ...lintGddCoverageLedger(input),
    ...lintLatestProgressLogCoverage(input),
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
