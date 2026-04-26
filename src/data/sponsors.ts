/**
 * Sponsor objective registry per `docs/gdd/05-core-gameplay-loop.md`
 * Rewards "Sponsor objective".
 *
 * Browser-safe map of sponsor `id` to a validated `SponsorObjective` plus a
 * `getSponsorObjective(id)` lookup. The static JSON ships in the client
 * bundle, no filesystem I/O at runtime, so the catalogue is compatible
 * with the static export and the Edge runtime (mirrors the cars /
 * championships pattern in `src/data/`).
 *
 * Ordering follows the JSON file. Future sponsor entries append to the
 * JSON; the loader picks them up automatically. The MVP set is a small
 * sample so the §20 results screen has a non-empty bonus chip whenever a
 * race meets a sponsor predicate; the balancing pass owns the final
 * roster and credit values.
 */

import { SponsorObjectiveSchema, type SponsorObjective } from "./schemas";

import sponsorsRaw from "./sponsors.json";

/** Validated sponsor objective list, in the JSON file order. */
export const SPONSOR_OBJECTIVES: ReadonlyArray<SponsorObjective> = Object.freeze(
  (sponsorsRaw as ReadonlyArray<unknown>).map((entry, index) => {
    const parsed = SponsorObjectiveSchema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(
        `sponsors.json[${index}] failed schema validation: ${parsed.error.message}`,
      );
    }
    return Object.freeze(parsed.data);
  }),
);

/** Lookup table keyed by `SponsorObjective.id`. */
export const SPONSOR_OBJECTIVES_BY_ID: ReadonlyMap<string, SponsorObjective> =
  new Map(SPONSOR_OBJECTIVES.map((s) => [s.id, s]));

/**
 * Fetch a sponsor objective by id. Returns `undefined` when the id is not
 * registered so callers can branch on the absent case (the §20 results
 * screen renders nothing when no sponsor is active for the race). Mirrors
 * the `getUpgrade` shape rather than the throwing `getCar` shape because
 * sponsors are optional inputs to the race-bonus pipeline; an absent
 * sponsor is not an error.
 */
export function getSponsorObjective(id: string): SponsorObjective | undefined {
  return SPONSOR_OBJECTIVES_BY_ID.get(id);
}
