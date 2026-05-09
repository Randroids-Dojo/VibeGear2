/**
 * F-097 follow-up. Pure helper for resolving a tour slug to its
 * player-facing name. Reads the optional `name` field on
 * `ChampionshipTour` and falls back to title-casing the slug so
 * existing fixtures, modder-authored championships, and the unit
 * test stubs without an authored `name` still render readable
 * copy.
 *
 * Centralised here so the garage cars page, future prep-card
 * sub-headers, and the results-screen banner all read the same
 * source. The function is dependency-injected (the caller passes
 * the championship) so the helper has no global state and tests
 * pin both branches without mounting React.
 */

import type { Championship } from "@/data/schemas";

export function resolveTourName(
  championship: Championship | undefined,
  tourId: string,
): string {
  if (tourId === "") return "the next tour";
  const tour = championship?.tours.find((entry) => entry.id === tourId);
  if (tour?.name !== undefined && tour.name.length > 0) {
    return tour.name;
  }
  return tourId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
