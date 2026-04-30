import breakwaterIsles from "./breakwater-isles.json";
import crownCircuit from "./crown-circuit.json";
import emberSteppe from "./ember-steppe.json";
import glassRidge from "./glass-ridge.json";
import ironBorough from "./iron-borough.json";
import mossFrontier from "./moss-frontier.json";
import neonMeridian from "./neon-meridian.json";
import velvetCoast from "./velvet-coast.json";
import { RegionThemeSchema, type RegionTheme } from "../schemas";

export const REGIONS: readonly RegionTheme[] = Object.freeze(
  [
    velvetCoast,
    ironBorough,
    emberSteppe,
    breakwaterIsles,
    glassRidge,
    neonMeridian,
    mossFrontier,
    crownCircuit,
  ].map((region) => Object.freeze(RegionThemeSchema.parse(region))),
);

export const REGIONS_BY_ID = Object.freeze(
  Object.fromEntries(REGIONS.map((region) => [region.id, region])),
) as Readonly<Record<string, RegionTheme>>;

export const REGION_IDS: readonly string[] = Object.freeze(
  REGIONS.map((region) => region.id),
);

export function loadRegion(id: string): RegionTheme {
  const region = REGIONS_BY_ID[id];
  if (region === undefined) {
    throw new Error(
      `loadRegion: unknown region id "${id}". Known ids: ${REGION_IDS.join(", ")}`,
    );
  }
  return region;
}
