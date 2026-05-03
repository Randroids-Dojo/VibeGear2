import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { AudioManifestEntry } from "../check-audio-manifest";

const REPO_ROOT = process.cwd();
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const MANIFEST_PATH = path.join(PUBLIC_DIR, "audio", "manifest.json");

const MUSIC_IDS = [
  "title",
  "velvet-coast",
  "iron-borough",
  "ember-steppe",
  "breakwater-isles",
  "glass-ridge",
  "neon-meridian",
  "moss-frontier",
  "crown-circuit",
] as const;

const RACE_MUSIC_IDS = MUSIC_IDS.filter((id) => id !== "title");

const MUSIC_INTENSITY_LAYERS = ["drive", "lead"] as const;

const SFX_IDS = [
  "ui-hover",
  "ui-confirm",
  "ui-back",
  "countdown-3",
  "countdown-2",
  "countdown-1",
  "countdown-go",
  "impact-light",
  "impact-heavy",
  "nitro-on",
  "nitro-off",
  "gear-up",
  "gear-down",
  "puddle-splash",
  "grass-skid",
  "brake-screech",
  "collision-crunch",
  "horn",
  "checkpoint",
  "finish",
  "damage-warn",
  "record-set",
] as const;

const WEATHER_IDS = ["rain-loop", "fog-wind-loop", "snow-loop", "heavy-rain-loop"] as const;

function readManifest(): AudioManifestEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as AudioManifestEntry[];
}

function expectProductionProvenance(entry: AudioManifestEntry | undefined): void {
  expect(entry?.license).toBe("CC-BY-4.0");
  expect(entry?.source).toBeTruthy();
  expect(entry?.originality).toBeTruthy();
  expect(entry?.source).not.toContain("placeholder");
  expect(entry?.originality).not.toContain("placeholder");
}

describe("production procedural audio bank", () => {
  it("ships title and race theme production cues", () => {
    const manifest = readManifest();
    for (const id of MUSIC_IDS) {
      const entry = manifest.find((item) => item.id === `music:${id}`);
      expect(entry?.path).toBe(`audio/music/${id}.opus`);
      expect(existsSync(path.join(PUBLIC_DIR, `audio/music/${id}.opus`))).toBe(true);
      expectProductionProvenance(entry);
    }
  });

  it("ships race music intensity production stems", () => {
    const manifest = readManifest();
    for (const id of RACE_MUSIC_IDS) {
      for (const layer of MUSIC_INTENSITY_LAYERS) {
        const entry = manifest.find(
          (item) => item.id === `music-layer:${id}:${layer}`,
        );
        expect(entry?.path).toBe(`audio/music/stems/${id}-${layer}.opus`);
        expect(
          existsSync(path.join(PUBLIC_DIR, `audio/music/stems/${id}-${layer}.opus`)),
        ).toBe(true);
        expectProductionProvenance(entry);
        expect(entry?.durationSeconds).toBe(4);
      }
    }
  });


  it("ships the GDD SFX volume and UI set", () => {
    const manifest = readManifest();
    const sfxEntries = manifest.filter((entry) => entry.id.startsWith("sfx:"));
    expect(sfxEntries.length).toBeGreaterThanOrEqual(20);
    expect(sfxEntries.length).toBeLessThanOrEqual(30);
    for (const id of SFX_IDS) {
      const entry = manifest.find((item) => item.id === `sfx:${id}`);
      expect(entry?.path).toBe(`audio/sfx/${id}.opus`);
      expect(existsSync(path.join(PUBLIC_DIR, `audio/sfx/${id}.opus`))).toBe(true);
      expectProductionProvenance(entry);
    }
  });

  it("ships weather loop production cues and keeps the bank small", () => {
    const manifest = readManifest();
    for (const id of WEATHER_IDS) {
      const entry = manifest.find((item) => item.id === `weather:${id}`);
      expect(entry?.path).toBe(`audio/weather/${id}.opus`);
      expect(existsSync(path.join(PUBLIC_DIR, `audio/weather/${id}.opus`))).toBe(true);
      expect(entry?.sampleRate).toBe(48_000);
      expectProductionProvenance(entry);
    }
    const totalBytes = manifest.reduce(
      (sum, entry) => sum + statSync(path.join(PUBLIC_DIR, entry.path)).size,
      0,
    );
    expect(totalBytes).toBeLessThan(2 * 1024 * 1024);
  });
});
