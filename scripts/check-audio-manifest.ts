import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface AudioManifestEntry {
  id: string;
  src: string;
  path: string;
  kind: string;
  license: string;
  source: string;
  originality: string;
  date: string;
  durationSeconds: number;
  sampleRate: number;
}

export interface AudioManifestIssue {
  path: string;
  rule: string;
  detail: string;
}

const AUDIO_EXTENSIONS = new Set([".opus", ".ogg", ".wav", ".mp3"]);
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

function isAudioAsset(absPath: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(absPath).toLowerCase());
}

function normalizePublicPath(value: string): string {
  const stripped = value.replace(/^\/+/, "");
  return stripped.startsWith("audio/") ? stripped : `audio/${stripped}`;
}

function readManifest(manifestPath: string, repoRoot: string): {
  entries: AudioManifestEntry[];
  issues: AudioManifestIssue[];
} {
  const relManifestPath = path.relative(repoRoot, manifestPath).split(path.sep).join("/");
  if (!existsSync(manifestPath)) {
    return {
      entries: [],
      issues: [
        {
          path: relManifestPath,
          rule: "missing-manifest",
          detail: "public audio manifest does not exist",
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
          detail: "public audio manifest must be an array",
        },
      ],
    };
  }
  return { entries: parsed as AudioManifestEntry[], issues: [] };
}

export function checkAudioManifest(repoRoot: string): AudioManifestIssue[] {
  const publicDir = path.join(repoRoot, "public");
  const audioDir = path.join(publicDir, "audio");
  const manifestPath = path.join(audioDir, "manifest.json");
  const { entries, issues } = readManifest(manifestPath, repoRoot);
  const assetPaths = new Set(
    walkFiles(audioDir)
      .filter(isAudioAsset)
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
        detail: "manifest entry references a file that is not under public/audio",
      });
    }
    if (entry.kind !== "audio") {
      issues.push({ path: relPath, rule: "invalid-kind", detail: "audio manifest kind must be audio" });
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
    if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) {
      issues.push({
        path: relPath,
        rule: "invalid-duration",
        detail: "manifest entry durationSeconds must be positive",
      });
    }
    if (entry.sampleRate !== 48_000) {
      issues.push({
        path: relPath,
        rule: "invalid-sample-rate",
        detail: "manifest entry sampleRate must be 48000",
      });
    }
  }

  for (const relPath of assetPaths) {
    if (!entryPaths.has(relPath) && !seenSrcs.has(relPath)) {
      issues.push({
        path: relPath,
        rule: "unlisted-audio-asset",
        detail: "audio file is missing from public/audio/manifest.json",
      });
    }
  }

  return issues.sort((a, b) => `${a.path}:${a.rule}`.localeCompare(`${b.path}:${b.rule}`));
}

export function formatAudioManifestIssue(issue: AudioManifestIssue): string {
  return `${issue.path}: ${issue.rule}: ${issue.detail}`;
}

if (require.main === module) {
  const issues = checkAudioManifest(process.cwd());
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(formatAudioManifestIssue(issue));
    }
    process.exitCode = 1;
  }
}
