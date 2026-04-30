import { describe, expect, it } from "vitest";

import { ModManifestSchema } from "@/data/schemas";

import {
  isSafeModId,
  isSafeModPath,
  loadModContent,
  loadModManifest,
  modFileUrl,
} from "../manifest";

const track = {
  id: "community/harbor-day",
  name: "Harbor Day",
  tourId: "community",
  author: "modder",
  version: 1,
  lengthMeters: 180,
  laps: 1,
  laneCount: 3,
  weatherOptions: ["clear"],
  difficulty: 1,
  segments: [
    {
      len: 180,
      curve: 0,
      grade: 0,
      roadsideLeft: "grass",
      roadsideRight: "grass",
      hazards: [],
    },
  ],
  checkpoints: [{ segmentIndex: 0, label: "start" }],
  spawn: { gridSlots: 2 },
};

const manifest = {
  id: "community-pack",
  name: "Community Pack",
  version: 1,
  author: "A. Contributor",
  license: "CC-BY-SA-4.0",
  originality: "Original data authored from scratch for this project.",
  data: {
    tracks: ["tracks/harbor-day.json"],
  },
};

const palette = {
  id: "community",
  name: "Community",
  slots: {
    sky: "#102030",
    midHorizon: "#304050",
    nearTerrain: "#405030",
    propPrimary: "#706050",
    propSecondary: "#607070",
    propAccent: "#806060",
    roadEdge: "#d0d0d0",
    roadSurface: "#555555",
    fogTint: "#90a0a0",
  },
};

function fetcher(files: Record<string, unknown>) {
  return async (url: string) => ({
    ok: Object.prototype.hasOwnProperty.call(files, url),
    status: Object.prototype.hasOwnProperty.call(files, url) ? 200 : 404,
    json: async () => files[url],
  });
}

describe("ModManifestSchema", () => {
  it("accepts a data-only manifest with provenance fields", () => {
    expect(ModManifestSchema.parse(manifest).id).toBe("community-pack");
  });

  it("rejects executable data references", () => {
    const result = ModManifestSchema.safeParse({
      ...manifest,
      data: { tracks: ["tracks/evil.js"] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-normal relative data paths", () => {
    const result = ModManifestSchema.safeParse({
      ...manifest,
      data: { tracks: ["tracks/./harbor-day.json"] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects path-like mod ids", () => {
    const result = ModManifestSchema.safeParse({
      ...manifest,
      id: "community/pack",
    });

    expect(result.success).toBe(false);
  });

  it("rejects manifests without content references", () => {
    const result = ModManifestSchema.safeParse({
      ...manifest,
      data: {},
    });

    expect(result.success).toBe(false);
  });
});

describe("mod loader", () => {
  it("rejects path-like mod ids before building a URL", () => {
    expect(isSafeModId("community-pack")).toBe(true);
    expect(isSafeModId("community/pack")).toBe(false);
    expect(() => modFileUrl("/mods", "community/pack", "manifest.json")).toThrow(
      /unsafe mod id/u,
    );
  });

  it("normalizes safe mod file URLs under the mod folder", () => {
    expect(modFileUrl("/mods", "community-pack", "tracks/harbor-day.json")).toBe(
      "/mods/community-pack/tracks/harbor-day.json",
    );
  });

  it.each([
    "../manifest.json",
    "/tracks/a.json",
    "https://x.test/a.json",
    "track\\a.json",
    "run.wasm",
    "tracks/",
    ".",
    "tracks/./a.json",
  ])("rejects unsafe path %s", (path) => {
    expect(isSafeModPath(path)).toBe(false);
    expect(() => modFileUrl("/mods", "community-pack", path)).toThrow(/unsafe/u);
  });

  it("loads manifest and validates referenced track JSON", async () => {
    const loaded = await loadModContent({
      modId: "community-pack",
      fetcher: fetcher({
        "/mods/community-pack/manifest.json": manifest,
        "/mods/community-pack/tracks/harbor-day.json": track,
      }),
    });

    expect(loaded.manifest.id).toBe("community-pack");
    expect(loaded.tracks).toHaveLength(1);
    expect(loaded.tracks[0]?.id).toBe("community/harbor-day");
    expect(loaded.palettes).toEqual([]);
  });

  it("loads and validates referenced palette JSON", async () => {
    const loaded = await loadModContent({
      modId: "community-pack",
      fetcher: fetcher({
        "/mods/community-pack/manifest.json": {
          ...manifest,
          data: { tracks: ["tracks/harbor-day.json"], palettes: ["palettes/community.json"] },
        },
        "/mods/community-pack/tracks/harbor-day.json": track,
        "/mods/community-pack/palettes/community.json": palette,
      }),
    });

    expect(loaded.palettes).toHaveLength(1);
    expect(loaded.palettes[0]?.id).toBe("community");
  });

  it("rejects a manifest id mismatch", async () => {
    await expect(
      loadModManifest({
        modId: "expected-pack",
        fetcher: fetcher({
          "/mods/expected-pack/manifest.json": manifest,
        }),
      }),
    ).rejects.toThrow(/does not match/u);
  });

  it("rejects invalid referenced data", async () => {
    await expect(
      loadModContent({
        modId: "community-pack",
        fetcher: fetcher({
          "/mods/community-pack/manifest.json": manifest,
          "/mods/community-pack/tracks/harbor-day.json": { ...track, segments: [] },
        }),
      }),
    ).rejects.toThrow(/track file/u);
  });
});
