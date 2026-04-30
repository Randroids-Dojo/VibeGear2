import { describe, expect, it } from "vitest";

import {
  REGION_PALETTES,
  REGION_PALETTE_SLOTS,
  RESERVED_SYSTEM_COLORS,
  RegionPaletteSchema,
  findReservedColorCollisions,
} from "../index";

describe("RegionPaletteSchema", () => {
  it("accepts every shipped region palette", () => {
    expect(REGION_PALETTES).toHaveLength(8);
    for (const palette of REGION_PALETTES) {
      expect(RegionPaletteSchema.safeParse(palette).success).toBe(true);
      expect(Object.keys(palette.slots).sort()).toEqual([...REGION_PALETTE_SLOTS].sort());
    }
  });

  it("rejects palettes that overlap reserved systemic colors", () => {
    const palette = {
      id: "bad",
      name: "Bad",
      slots: {
        sky: "#102030",
        midHorizon: "#304050",
        nearTerrain: "#405030",
        propPrimary: RESERVED_SYSTEM_COLORS.severeDamageRed,
        propSecondary: "#607070",
        propAccent: "#806060",
        roadEdge: "#d0d0d0",
        roadSurface: "#555555",
        fogTint: "#90a0a0",
      },
    };

    const parsed = RegionPaletteSchema.safeParse(palette);
    expect(parsed.success).toBe(false);
    expect(findReservedColorCollisions(palette)).toContainEqual(
      expect.objectContaining({
        slot: "propPrimary",
        reserved: "severeDamageRed",
      }),
    );
  });

  it("rejects missing slots", () => {
    const palette = {
      id: "missing",
      name: "Missing",
      slots: {
        sky: "#102030",
      },
    };

    expect(RegionPaletteSchema.safeParse(palette).success).toBe(false);
  });
});
