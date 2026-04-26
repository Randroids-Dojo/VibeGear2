/**
 * Data layer. Zod schemas + inferred TypeScript types for every JSON contract
 * in docs/gdd/22-data-schemas.md, plus the bundled content registries
 * (cars, tracks) keyed by id for runtime lookup.
 */
export * from "./schemas";
export {
  CARS,
  CARS_BY_ID,
  STARTER_CAR_ID,
  getCar,
} from "./cars";
export { TRACK_IDS, TRACK_RAW } from "./tracks";

import { compileTrack } from "@/road/trackCompiler";
import type { CompiledTrack } from "@/road/types";
import { TrackSchema } from "./schemas";
import { TRACK_RAW } from "./tracks";

/**
 * Load a bundled track by id, validate it against `TrackSchema`, and
 * compile it to its renderable form.
 *
 * Browser-safe: the underlying JSON is statically imported through the
 * barrel `src/data/tracks/index.ts`, so no filesystem I/O happens at
 * runtime. The function throws on unknown id or schema-validation failure
 * so callers can fail-fast at the load site (per AGENTS.md "fail loudly").
 */
export function loadTrack(id: string): CompiledTrack {
  const raw = TRACK_RAW[id];
  if (raw === undefined) {
    throw new Error(
      `loadTrack: unknown track id "${id}". Known ids: ${Object.keys(TRACK_RAW).sort().join(", ")}`,
    );
  }
  const parsed = TrackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `loadTrack: track "${id}" failed schema validation: ${parsed.error.message}`,
    );
  }
  return compileTrack(parsed.data);
}
