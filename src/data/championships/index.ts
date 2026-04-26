/**
 * Championship registry.
 *
 * Browser-safe map of championship `id` to validated `Championship` JSON,
 * plus a `getChampionship(id)` lookup. Static JSON imports mean the
 * championship structure ships in the client bundle without filesystem I/O,
 * which keeps it compatible with static export and the Edge runtime.
 *
 * The canonical championship is `world-tour-standard` per
 * `docs/gdd/24-content-plan.md` "Suggested region and track list":
 * 8 tours by 4 tracks. Tour ids and track ids follow the slug convention
 * from `docs/gdd/22-data-schemas.md` (lowercase, hyphenated, slash-separated
 * for nested track ids).
 *
 * Placeholder track ids (MVP window):
 * The full 32-track set is being authored in sibling slices. Until those
 * track JSONs ship, every track id in `world-tour-standard.json` resolves
 * via the cross-reference test only when the env var
 * `ALLOW_UNRESOLVED_CHAMPIONSHIP_TRACKS=1` is set, which the content test
 * checks. The list of placeholder ids is the literal contents of the JSON
 * minus those currently registered in `TRACK_RAW`. Remove the env-var
 * guard from the test once the full track set lands.
 *
 * Add a new championship by dropping a JSON next to the others, importing
 * it below, and registering it in `CHAMPIONSHIPS`. Run the
 * `championship-content` test to confirm it parses and that every
 * referenced track id resolves (or is documented as a placeholder).
 */

import type { Championship } from "@/data/schemas";
import { ChampionshipSchema } from "@/data/schemas";

import worldTourStandard from "./world-tour-standard.json";

/**
 * Ordered championship list for UI presentation. Currently the only
 * championship is the canonical World Tour. Future entries (challenge
 * playlists, community tours) append here.
 */
export const CHAMPIONSHIPS: readonly Championship[] = [
  worldTourStandard as Championship,
];

/** Lookup table keyed by `Championship.id`. */
export const CHAMPIONSHIPS_BY_ID: ReadonlyMap<string, Championship> = new Map(
  CHAMPIONSHIPS.map((c) => [c.id, c]),
);

/**
 * Fetch and validate a championship by id. Returns the parsed
 * `Championship` object on success. Throws on unknown id or schema
 * validation failure so callers fail-fast at the load site (per
 * AGENTS.md "fail loudly"). Mirrors the `loadTrack` shape in
 * `src/data/index.ts`.
 */
export function getChampionship(id: string): Championship {
  const raw = CHAMPIONSHIPS_BY_ID.get(id);
  if (raw === undefined) {
    throw new Error(
      `getChampionship: unknown championship id "${id}". Known ids: ${[...CHAMPIONSHIPS_BY_ID.keys()].sort().join(", ")}`,
    );
  }
  const parsed = ChampionshipSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `getChampionship: championship "${id}" failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
