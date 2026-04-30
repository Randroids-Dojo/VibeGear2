import { describe, expect, it } from "vitest";

import { REGION_IDS, REGIONS, REGIONS_BY_ID, TRACK_RAW, loadRegion } from "@/data";
import { RegionThemeSchema, TrackSchema } from "@/data/schemas";
import { parseHexColor } from "@/data/palettes";

const EXPECTED_REGION_IDS = [
  "breakwater-isles",
  "crown-circuit",
  "ember-steppe",
  "glass-ridge",
  "iron-borough",
  "moss-frontier",
  "neon-meridian",
  "velvet-coast",
];

const REQUIRED_REGION_WEATHER: Readonly<Record<string, readonly string[]>> = {
  "velvet-coast": ["clear", "dusk", "light_rain"],
  "iron-borough": ["overcast", "fog"],
  "ember-steppe": ["clear"],
  "breakwater-isles": ["rain", "heavy_rain"],
  "glass-ridge": ["snow", "fog", "dusk"],
  "neon-meridian": ["night", "rain"],
  "moss-frontier": ["heavy_rain", "fog"],
  "crown-circuit": ["clear", "rain", "fog", "snow"],
};

describe("region art theme registry", () => {
  it("registers the eight World Tour regions", () => {
    expect([...REGION_IDS].sort()).toEqual(EXPECTED_REGION_IDS);
  });

  it("validates every shipped region theme", () => {
    expect(REGIONS).toHaveLength(8);
    for (const region of REGIONS) {
      const parsed = RegionThemeSchema.safeParse(region);
      if (!parsed.success) {
        throw new Error(
          `RegionThemeSchema rejected ${region.id}: ${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }
      expect(REGIONS_BY_ID[region.id]).toBe(region);
    }
  });

  it("loads deterministic region objects", () => {
    const first = loadRegion("velvet-coast");
    const second = loadRegion("velvet-coast");
    expect(first.palette.sky).toBe("#16304f");
    expect(first).toEqual(second);
    expect(first).toBe(second);
  });

  it("includes the GDD weather profile for each region", () => {
    for (const [regionId, requiredWeather] of Object.entries(REQUIRED_REGION_WEATHER)) {
      const region = loadRegion(regionId);
      for (const weather of requiredWeather) {
        expect(region.weatherPresets).toContain(weather);
      }
    }
  });

  it("allows every bundled track weather option through its region theme", () => {
    for (const [id, raw] of Object.entries(TRACK_RAW)) {
      const parsed = TrackSchema.parse(raw);
      if (id.startsWith("test/")) continue;
      const region = loadRegion(parsed.tourId);
      for (const weather of parsed.weatherOptions) {
        expect(region.weatherPresets, `${id} ${weather}`).toContain(weather);
      }
    }
  });

  it("gives every UI accent readable contrast against the shoulder color", () => {
    for (const region of REGIONS) {
      expect(
        contrastRatio(region.uiAccent, region.palette.shoulder),
        region.id,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  return (
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b)
  );
}

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
