import rawHazards from "./hazards.json";
import { HazardRegistryEntrySchema, type HazardRegistryEntry } from "./schemas";

export const HAZARDS: readonly HazardRegistryEntry[] = Object.freeze(
  rawHazards.map((entry) =>
    Object.freeze(HazardRegistryEntrySchema.parse(entry)),
  ),
);

export const HAZARDS_BY_ID: ReadonlyMap<string, HazardRegistryEntry> =
  new Map(HAZARDS.map((entry) => [entry.id, entry]));

export function getHazard(id: string): HazardRegistryEntry | undefined {
  return HAZARDS_BY_ID.get(id);
}
