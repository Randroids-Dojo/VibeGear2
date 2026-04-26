import { describe, expect, it } from "vitest";

import type { AssetManifest } from "@/asset/preload";

import { stableManifestKey } from "../LoadingGate";

function manifest(overrides: Partial<AssetManifest> = {}): AssetManifest {
  return {
    id: "race:test",
    entries: [
      {
        id: "road",
        kind: "image",
        src: "/assets/road.png",
        critical: true,
        license: "CC-BY-4.0",
      },
    ],
    ...overrides,
  };
}

describe("stableManifestKey", () => {
  it("is stable for rebuilt manifest objects with equal content", () => {
    expect(stableManifestKey(manifest())).toBe(stableManifestKey(manifest()));
  });

  it("changes when an entry field changes", () => {
    const base = stableManifestKey(manifest());
    const changed = stableManifestKey(
      manifest({
        entries: [
          {
            id: "road",
            kind: "image",
            src: "/assets/road-v2.png",
            critical: true,
            license: "CC-BY-4.0",
          },
        ],
      }),
    );
    expect(changed).not.toBe(base);
  });
});
