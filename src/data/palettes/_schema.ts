import { z } from "zod";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const RegionPaletteSlotSchema = z.enum([
  "sky",
  "midHorizon",
  "nearTerrain",
  "propPrimary",
  "propSecondary",
  "propAccent",
  "roadEdge",
  "roadSurface",
  "fogTint",
]);

export type RegionPaletteSlot = z.infer<typeof RegionPaletteSlotSchema>;

export const REGION_PALETTE_SLOTS = RegionPaletteSlotSchema.options;

export const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_RE, "expected a #RRGGBB hex color")
  .transform((value) => value.toLowerCase());

const RegionPaletteSlotsSchema = z.object({
  sky: HexColorSchema,
  midHorizon: HexColorSchema,
  nearTerrain: HexColorSchema,
  propPrimary: HexColorSchema,
  propSecondary: HexColorSchema,
  propAccent: HexColorSchema,
  roadEdge: HexColorSchema,
  roadSurface: HexColorSchema,
  fogTint: HexColorSchema,
});

export const RESERVED_SYSTEM_COLORS = Object.freeze({
  roadEdgeWarningAmber: "#ffb000",
  severeDamageRed: "#ff3030",
  wetGripCyan: "#21d4ff",
  nitroFullMagenta: "#ff2bff",
  nitroFullElectricBlue: "#2f7dff",
  cleanPersonalBestGreen: "#32d25f",
  recordGold: "#ffd34d",
});

export type ReservedSystemColor = keyof typeof RESERVED_SYSTEM_COLORS;

export interface ReservedColorCollision {
  slot: RegionPaletteSlot;
  value: string;
  reserved: ReservedSystemColor;
  reservedValue: string;
  distance: number;
}

export const RESERVED_COLOR_DISTANCE = 20;

export const RegionPaletteSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slots: RegionPaletteSlotsSchema,
  })
  .superRefine((palette, ctx) => {
    for (const collision of findReservedColorCollisions(palette)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", collision.slot],
        message: `${collision.slot} overlaps reserved systemic color ${collision.reserved} (${collision.reservedValue})`,
      });
    }
  });

export type RegionPalette = z.infer<typeof RegionPaletteSchema>;

export function findReservedColorCollisions(
  palette: Pick<RegionPalette, "slots">,
  threshold = RESERVED_COLOR_DISTANCE,
): ReservedColorCollision[] {
  const collisions: ReservedColorCollision[] = [];
  for (const slot of REGION_PALETTE_SLOTS) {
    const value = palette.slots[slot];
    for (const [reserved, reservedValue] of Object.entries(RESERVED_SYSTEM_COLORS) as [
      ReservedSystemColor,
      string,
    ][]) {
      const distance = colorDistance(value, reservedValue);
      if (distance <= threshold) {
        collisions.push({ slot, value, reserved, reservedValue, distance });
      }
    }
  }
  return collisions;
}

export function colorDistance(a: string, b: string): number {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  const dr = ca.r - cb.r;
  const dg = ca.g - cb.g;
  const db = ca.b - cb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  if (!HEX_COLOR_RE.test(hex)) {
    throw new TypeError(`invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}
