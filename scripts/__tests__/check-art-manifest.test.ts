import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkArtManifest,
  formatArtManifestIssue,
  type ArtManifestEntry,
} from "../check-art-manifest";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(path.join(tmpdir(), "art-manifest-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function write(relPath: string, contents: string): void {
  const abs = path.join(repoRoot, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, contents, "utf8");
}

function manifest(entries: ArtManifestEntry[]): void {
  write("public/art.manifest.json", JSON.stringify(entries));
}

function entry(overrides: Partial<ArtManifestEntry> = {}): ArtManifestEntry {
  return {
    id: "art:fixture",
    src: "/art/backdrops/fixture/sky.svg",
    path: "art/backdrops/fixture/sky.svg",
    kind: "image",
    license: "CC0",
    source: "test fixture",
    originality: "original test fixture",
    date: "2026-04-29",
    ...overrides,
  };
}

describe("checkArtManifest", () => {
  it("passes when every art file has manifest metadata", () => {
    write("public/art/backdrops/fixture/sky.svg", "<svg />");
    manifest([entry()]);
    expect(checkArtManifest(repoRoot)).toEqual([]);
  });

  it("flags art files missing from the manifest", () => {
    write("public/art/backdrops/fixture/sky.svg", "<svg />");
    manifest([]);
    expect(checkArtManifest(repoRoot)).toEqual([
      {
        path: "art/backdrops/fixture/sky.svg",
        rule: "unlisted-art-asset",
        detail: "art file is missing from public/art.manifest.json",
      },
    ]);
  });

  it("flags missing license and originality metadata", () => {
    write("public/art/backdrops/fixture/sky.svg", "<svg />");
    manifest([entry({ license: "", originality: "" })]);
    const rules = checkArtManifest(repoRoot).map((issue) => issue.rule);
    expect(rules).toContain("invalid-license");
    expect(rules).toContain("missing-originality");
  });

  it("formats issues on one line", () => {
    expect(
      formatArtManifestIssue({
        path: "art/example.svg",
        rule: "missing-source",
        detail: "manifest entry has no source",
      }),
    ).toBe("art/example.svg: missing-source: manifest entry has no source");
  });
});
