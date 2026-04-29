import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkAudioManifest,
  formatAudioManifestIssue,
  type AudioManifestEntry,
} from "../check-audio-manifest";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(path.join(tmpdir(), "audio-manifest-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function write(relPath: string, contents: string): void {
  const abs = path.join(repoRoot, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, contents, "utf8");
}

function manifest(entries: AudioManifestEntry[]): void {
  write("public/audio/manifest.json", JSON.stringify(entries));
}

function entry(overrides: Partial<AudioManifestEntry> = {}): AudioManifestEntry {
  return {
    id: "audio:fixture",
    src: "/audio/sfx/fixture.opus",
    path: "audio/sfx/fixture.opus",
    kind: "audio",
    license: "CC0",
    source: "test fixture",
    originality: "original test fixture",
    date: "2026-04-29",
    durationSeconds: 0.5,
    sampleRate: 48_000,
    ...overrides,
  };
}

describe("checkAudioManifest", () => {
  it("passes when every audio file has manifest metadata", () => {
    write("public/audio/sfx/fixture.opus", "OggS");
    manifest([entry()]);
    expect(checkAudioManifest(repoRoot)).toEqual([]);
  });

  it("flags audio files missing from the manifest", () => {
    write("public/audio/sfx/fixture.opus", "OggS");
    manifest([]);
    expect(checkAudioManifest(repoRoot)).toEqual([
      {
        path: "audio/sfx/fixture.opus",
        rule: "unlisted-audio-asset",
        detail: "audio file is missing from public/audio/manifest.json",
      },
    ]);
  });

  it("uses repo-relative paths for missing and invalid manifests", () => {
    expect(checkAudioManifest(repoRoot)).toEqual([
      {
        path: "public/audio/manifest.json",
        rule: "missing-manifest",
        detail: "public audio manifest does not exist",
      },
    ]);

    write("public/audio/manifest.json", "{}");
    expect(checkAudioManifest(repoRoot)).toEqual([
      {
        path: "public/audio/manifest.json",
        rule: "invalid-manifest",
        detail: "public audio manifest must be an array",
      },
    ]);
  });

  it("flags duplicate ids and manifest entries whose files are missing", () => {
    write("public/audio/sfx/fixture.opus", "OggS");
    manifest([
      entry(),
      entry({
        src: "/audio/sfx/missing.opus",
        path: "audio/sfx/missing.opus",
      }),
    ]);
    const issues = checkAudioManifest(repoRoot);
    expect(issues).toContainEqual({
      path: "audio/sfx/missing.opus",
      rule: "duplicate-id",
      detail: "duplicate id audio:fixture",
    });
    expect(issues).toContainEqual({
      path: "audio/sfx/missing.opus",
      rule: "missing-file",
      detail: "manifest entry references a file that is not under public/audio",
    });
  });

  it("flags invalid kind, metadata, duration, and sample rate", () => {
    write("public/audio/sfx/fixture.opus", "OggS");
    manifest([
      entry({
        kind: "image",
        license: "",
        source: "",
        originality: "",
        date: "",
        durationSeconds: 0,
        sampleRate: 44_100,
      }),
    ]);
    const rules = checkAudioManifest(repoRoot).map((issue) => issue.rule);
    expect(rules).toContain("invalid-kind");
    expect(rules).toContain("invalid-license");
    expect(rules).toContain("missing-source");
    expect(rules).toContain("missing-originality");
    expect(rules).toContain("missing-date");
    expect(rules).toContain("invalid-duration");
    expect(rules).toContain("invalid-sample-rate");
  });

  it("formats issues on one line", () => {
    expect(
      formatAudioManifestIssue({
        path: "audio/example.opus",
        rule: "missing-source",
        detail: "manifest entry has no source",
      }),
    ).toBe("audio/example.opus: missing-source: manifest entry has no source");
  });
});
