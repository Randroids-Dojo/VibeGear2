import breakwaterIsles from "./breakwater-isles.json";
import crownCircuit from "./crown-circuit.json";
import emberSteppe from "./ember-steppe.json";
import glassRidge from "./glass-ridge.json";
import ironBorough from "./iron-borough.json";
import mossFrontier from "./moss-frontier.json";
import neonMeridian from "./neon-meridian.json";
import velvetCoast from "./velvet-coast.json";
import { RegionPaletteSchema, type RegionPalette } from "./_schema";

export {
  HexColorSchema,
  REGION_PALETTE_SLOTS,
  RESERVED_COLOR_DISTANCE,
  RESERVED_SYSTEM_COLORS,
  RegionPaletteSchema,
  RegionPaletteSlotSchema,
  colorDistance,
  findReservedColorCollisions,
  parseHexColor,
  type RegionPalette,
  type RegionPaletteSlot,
  type ReservedColorCollision,
  type ReservedSystemColor,
} from "./_schema";

export const REGION_PALETTES: readonly RegionPalette[] = Object.freeze(
  [
    velvetCoast,
    ironBorough,
    emberSteppe,
    breakwaterIsles,
    glassRidge,
    neonMeridian,
    mossFrontier,
    crownCircuit,
  ].map((palette) => RegionPaletteSchema.parse(palette)),
);

export const REGION_PALETTES_BY_ID = Object.freeze(
  Object.fromEntries(REGION_PALETTES.map((palette) => [palette.id, palette])),
) as Readonly<Record<string, RegionPalette>>;
