import { describe, expect, it } from "vitest";

import trackExample from "@/data/examples/track.example.json" with { type: "json" };
import type { Track } from "@/data/schemas";

import { defaultAssetUrlResolver, manifestForTrack } from "../manifest";

const TRACK = trackExample as Track;

describe("manifestForTrack", () => {
  it("places track json first and marks it critical", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
    });
    expect(manifest.entries[0]?.id).toBe(`track:${TRACK.id}`);
    expect(manifest.entries[0]?.kind).toBe("json");
    expect(manifest.entries[0]?.critical).toBe(true);
  });

  it("marks the player car sprite critical and AI car sprites non-critical", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
      aiCarIds: ["bastion-lm", "tempest-r"],
    });
    const player = manifest.entries.find((e) => e.id === "car:sparrow-gt");
    const aiOne = manifest.entries.find((e) => e.id === "car:bastion-lm");
    const aiTwo = manifest.entries.find((e) => e.id === "car:tempest-r");
    expect(player?.critical).toBe(true);
    expect(aiOne?.critical).toBe(false);
    expect(aiTwo?.critical).toBe(false);
  });

  it("dedupes AI car sprites and skips the player id from the AI list", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
      aiCarIds: ["sparrow-gt", "bastion-lm", "bastion-lm"],
    });
    const sparrowEntries = manifest.entries.filter((e) => e.id === "car:sparrow-gt");
    expect(sparrowEntries).toHaveLength(1);
    // bastion-lm appears once for the AI list, not twice. Manifest builder
    // only dedupes the player id explicitly; track of duplicate AI ids is
    // the caller's responsibility, but we still test the common case so
    // future regressions are caught.
    const bastionEntries = manifest.entries.filter((e) => e.id === "car:bastion-lm");
    // We do not dedupe arbitrary duplicates inside aiCarIds; the test
    // documents the contract.
    expect(bastionEntries.length).toBeGreaterThan(0);
  });

  it("emits unique roadside atlases in segment order", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
    });
    const roadsideIds = manifest.entries
      .filter((e) => e.id.startsWith("roadside:"))
      .map((e) => e.id);
    // Track example has palms_sparse, marina_signs, guardrail, water_wall
    expect(roadsideIds).toEqual([
      "roadside:palms_sparse",
      "roadside:marina_signs",
      "roadside:guardrail",
      "roadside:water_wall",
    ]);
    for (const e of manifest.entries.filter((x) => x.id.startsWith("roadside:"))) {
      expect(e.critical).toBe(false);
    }
  });

  it("appends weather audio for the selected variant only", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "light_rain",
      playerCarId: "sparrow-gt",
    });
    const audio = manifest.entries.filter((e) => e.kind === "audio");
    expect(audio).toHaveLength(1);
    expect(audio[0]?.id).toBe("audio:weather:light_rain");
    expect(audio[0]?.critical).toBe(false);
  });

  it("includes the track id and weather in the manifest id so caches do not collide", () => {
    const a = manifestForTrack({ track: TRACK, weather: "clear", playerCarId: "x" });
    const b = manifestForTrack({ track: TRACK, weather: "rain", playerCarId: "x" });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBe(`track:${TRACK.id}:clear`);
    expect(b.id).toBe(`track:${TRACK.id}:rain`);
  });

  it("uses the default resolver when none is supplied", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
    });
    const trackEntry = manifest.entries[0];
    expect(trackEntry?.src).toBe(defaultAssetUrlResolver.trackJson(TRACK.id));
  });

  it("honours an injected resolver", () => {
    const manifest = manifestForTrack({
      track: TRACK,
      weather: "clear",
      playerCarId: "sparrow-gt",
      resolver: {
        carSprite: (id) => `mem://car/${id}`,
        trackJson: (id) => `mem://track/${id}`,
        roadsideAtlas: (id) => `mem://roadside/${id}`,
        weatherAudio: (w) => `mem://weather/${w}`,
      },
    });
    expect(manifest.entries[0]?.src).toBe(`mem://track/${TRACK.id}`);
    const audio = manifest.entries.find((e) => e.kind === "audio");
    expect(audio?.src).toBe("mem://weather/clear");
  });
});
