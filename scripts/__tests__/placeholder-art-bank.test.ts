import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CARS } from "@/data/cars";
import type { ArtManifestEntry } from "../check-art-manifest";

const REPO_ROOT = process.cwd();
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const MANIFEST_PATH = path.join(PUBLIC_DIR, "art.manifest.json");
const REGION_IDS = [
  "velvet-coast",
  "iron-borough",
  "ember-steppe",
  "breakwater-isles",
  "glass-ridge",
  "neon-meridian",
  "moss-frontier",
  "crown-circuit",
] as const;
const MENU_BACKGROUND_IDS = [
  "title",
  "world",
  "garage",
  "race-prep",
  "results",
  "daily",
  "options",
  "loading",
] as const;

function readManifest(): ArtManifestEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ArtManifestEntry[];
}

describe("placeholder art bank", () => {
  it("ships a production sprite sheet for every bundled car visual profile", () => {
    const manifest = readManifest();
    const manifestPaths = new Set(manifest.map((entry) => entry.path));
    for (const car of CARS) {
      const relPath = `art/cars/${car.visualProfile.spriteSet}.svg`;
      expect(existsSync(path.join(PUBLIC_DIR, relPath))).toBe(true);
      expect(manifestPaths.has(relPath)).toBe(true);
    }
  });

  it("lists generated car sheets as original production car art", () => {
    const carEntries = readManifest().filter((entry) =>
      entry.id.startsWith("car:") && entry.id.endsWith(":sprite-sheet"),
    );
    expect(carEntries).toHaveLength(CARS.length);
    for (const entry of carEntries) {
      expect(entry.license).toBe("CC-BY-4.0");
      expect(entry.source).toContain("production car sheets");
      expect(entry.originality).toContain("Original stylized car sprite sheets");
      expect(entry.originality).not.toContain("placeholder");

      const svg = readFileSync(path.join(PUBLIC_DIR, entry.path), "utf8");
      expect(svg).not.toContain("PLACEHOLDER");
      expect(svg).not.toContain("placeholder art");
      expect(svg).toContain("production car sprite sheet");
    }
  });

  it("has no placeholder labels in shipped car SVGs", () => {
    const carDir = path.join(PUBLIC_DIR, "art/cars");
    for (const fileName of readdirSync(carDir)) {
      if (!fileName.endsWith(".svg")) continue;

      const svg = readFileSync(path.join(carDir, fileName), "utf8");
      expect(svg).not.toContain("PLACEHOLDER");
      expect(svg).not.toContain("placeholder art");
      expect(svg).toContain("production car sprite sheet");
    }
  });

  it("ships production roadside prop art across every region", () => {
    const propEntries = readManifest().filter((entry) => entry.id.startsWith("roadside:"));
    const regionalProps = propEntries.filter((entry) => entry.path.split("/").length === 4);
    for (const entry of propEntries) {
      expect(entry.license).toBe("CC-BY-4.0");
      expect(entry.source).toContain("production roadside prop set");
      expect(entry.originality).toContain("Original stylized roadside prop art");
      expect(entry.originality).not.toContain("placeholder");

      const svg = readFileSync(path.join(PUBLIC_DIR, entry.path), "utf8");
      expect(svg).not.toContain("PLACEHOLDER");
      expect(svg).not.toContain("placeholder art");
    }

    expect(regionalProps.length).toBeGreaterThanOrEqual(80);
    expect(regionalProps.length).toBeLessThanOrEqual(120);
    for (const regionId of REGION_IDS) {
      const entries = regionalProps.filter((entry) => entry.path.startsWith(`art/roadside/${regionId}/`));
      expect(entries.length).toBeGreaterThanOrEqual(10);
      for (const entry of entries) {
        expect(existsSync(path.join(PUBLIC_DIR, entry.path))).toBe(true);

        const svg = readFileSync(path.join(PUBLIC_DIR, entry.path), "utf8");
        expect(svg).toContain("roadside prop");
      }
    }
  });

  it("ships placeholder backgrounds for the main menu screens", () => {
    const manifest = readManifest();
    for (const menuId of MENU_BACKGROUND_IDS) {
      const entry = manifest.find((item) => item.id === `menu:${menuId}:background`);
      expect(entry).toBeDefined();
      expect(entry?.path).toBe(`art/menu/${menuId}.svg`);
      expect(existsSync(path.join(PUBLIC_DIR, `art/menu/${menuId}.svg`))).toBe(true);
      expect(entry?.license).toBe("CC0");
      expect(entry?.originality).toContain("Original geometric placeholder art");
    }
  });
});
