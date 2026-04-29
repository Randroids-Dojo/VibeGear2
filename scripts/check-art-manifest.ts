import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface ArtManifestEntry {
  id: string;
  src: string;
  path: string;
  kind: string;
  license: string;
  source: string;
  originality: string;
  date: string;
}

export interface ArtManifestIssue {
  path: string;
  rule: string;
  detail: string;
}

const ART_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const ALLOWED_LICENSES = new Set(["CC0", "CC-BY-4.0"]);

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".")) continue;
      const abs = path.join(dir, entry);
      const stats = statSync(abs);
      if (stats.isDirectory()) {
        stack.push(abs);
      } else if (stats.isFile()) {
        out.push(abs);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function isArtAsset(absPath: string): boolean {
  return ART_EXTENSIONS.has(path.extname(absPath).toLowerCase());
}

function normalizePublicPath(value: string): string {
  const stripped = value.replace(/^\/+/, "");
  return stripped.startsWith("art/") ? stripped : `art/${stripped}`;
}

function readManifest(manifestPath: string, repoRoot: string): {
  entries: ArtManifestEntry[];
  issues: ArtManifestIssue[];
} {
  const relManifestPath = path.relative(repoRoot, manifestPath).split(path.sep).join("/");
  if (!existsSync(manifestPath)) {
    return {
      entries: [],
      issues: [
        {
          path: relManifestPath,
          rule: "missing-manifest",
          detail: "public art manifest does not exist",
        },
      ],
    };
  }
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    return {
      entries: [],
      issues: [
        {
          path: relManifestPath,
          rule: "invalid-manifest",
          detail: "public art manifest must be an array",
        },
      ],
    };
  }
  return { entries: parsed as ArtManifestEntry[], issues: [] };
}

export function checkArtManifest(repoRoot: string): ArtManifestIssue[] {
  const publicDir = path.join(repoRoot, "public");
  const artDir = path.join(publicDir, "art");
  const manifestPath = path.join(publicDir, "art.manifest.json");
  const { entries, issues } = readManifest(manifestPath, repoRoot);
  const assetPaths = new Set(
    walkFiles(artDir)
      .filter(isArtAsset)
      .map((abs) => path.relative(publicDir, abs).split(path.sep).join("/")),
  );

  const seenIds = new Set<string>();
  const seenSrcs = new Set<string>();
  const entryPaths = new Set<string>();

  for (const entry of entries) {
    const relPath = normalizePublicPath(entry.path || entry.src || "");
    const srcPath = normalizePublicPath(entry.src || entry.path || "");
    entryPaths.add(relPath);
    seenSrcs.add(srcPath);

    if (!entry.id) {
      issues.push({ path: relPath, rule: "missing-id", detail: "manifest entry has no id" });
    } else if (seenIds.has(entry.id)) {
      issues.push({ path: relPath, rule: "duplicate-id", detail: `duplicate id ${entry.id}` });
    } else {
      seenIds.add(entry.id);
    }

    if (!assetPaths.has(relPath)) {
      issues.push({
        path: relPath,
        rule: "missing-file",
        detail: "manifest entry references a file that is not under public/art",
      });
    }
    if (entry.kind !== "image") {
      issues.push({ path: relPath, rule: "invalid-kind", detail: "art manifest kind must be image" });
    }
    if (!ALLOWED_LICENSES.has(entry.license)) {
      issues.push({
        path: relPath,
        rule: "invalid-license",
        detail: `license must be one of ${Array.from(ALLOWED_LICENSES).join(", ")}`,
      });
    }
    if (!entry.source) {
      issues.push({ path: relPath, rule: "missing-source", detail: "manifest entry has no source" });
    }
    if (!entry.originality) {
      issues.push({
        path: relPath,
        rule: "missing-originality",
        detail: "manifest entry has no originality statement",
      });
    }
    if (!entry.date) {
      issues.push({ path: relPath, rule: "missing-date", detail: "manifest entry has no date" });
    }
  }

  for (const relPath of assetPaths) {
    if (!entryPaths.has(relPath) && !seenSrcs.has(relPath)) {
      issues.push({
        path: relPath,
        rule: "unlisted-art-asset",
        detail: "art file is missing from public/art.manifest.json",
      });
    }
  }

  return issues.sort((a, b) => `${a.path}:${a.rule}`.localeCompare(`${b.path}:${b.rule}`));
}

export function formatArtManifestIssue(issue: ArtManifestIssue): string {
  return `${issue.path}: ${issue.rule}: ${issue.detail}`;
}

if (require.main === module) {
  const issues = checkArtManifest(process.cwd());
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(formatArtManifestIssue(issue));
    }
    process.exitCode = 1;
  }
}
