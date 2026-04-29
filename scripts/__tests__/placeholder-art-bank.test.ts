import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CARS } from "@/data/cars";

interface ManifestEntry {
  id: string;
  src: string;
  path: string;
  license: string;
  originality: string;
}

const REPO_ROOT = process.cwd();
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const MANIFEST_PATH = path.join(PUBLIC_DIR, "art.manifest.json");

function readManifest(): ManifestEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ManifestEntry[];
}

describe("placeholder art bank", () => {
  it("ships a placeholder sprite sheet for every bundled car visual profile", () => {
    const manifest = readManifest();
    const manifestPaths = new Set(manifest.map((entry) => entry.path));
    for (const car of CARS) {
      const relPath = `art/cars/${car.visualProfile.spriteSet}.svg`;
      expect(existsSync(path.join(PUBLIC_DIR, relPath))).toBe(true);
      expect(manifestPaths.has(relPath)).toBe(true);
    }
  });

  it("lists generated car sheets as original placeholder art", () => {
    const carEntries = readManifest().filter((entry) =>
      entry.id.startsWith("car:") && entry.id.endsWith(":sprite-sheet"),
    );
    expect(carEntries).toHaveLength(CARS.length);
    for (const entry of carEntries) {
      expect(entry.license).toBe("CC0");
      expect(entry.originality).toContain("Original geometric placeholder art");
    }
  });
});
