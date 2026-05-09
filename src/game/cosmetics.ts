/**
 * F-096 slice 1. Cosmetic-unlock ledger.
 *
 * Implements the GDD §8 promise that "challenge medals unlock
 * cosmetics" by minting one cosmetic id per tour completion. Slice 1
 * surfaces the unlocked set as a row of text badges on the title
 * screen. Future slices wire the same ids into a livery
 * `paletteRecolour` overlay on the player car sprite and a
 * soundtrack-remix rotation in the music runtime.
 *
 * Cosmetic ids are deterministic (`livery-${tourId}`), so the
 * championship-side caller never needs a separate lookup table and a
 * future migration that renames a tour can rename the cosmetic by
 * editing the slug, not by re-mapping a hand-authored mapping file.
 *
 * Pure: same input always yields the same output. No globals, no
 * `Date.now()`, no React.
 */

const COSMETIC_PREFIX = "livery-" as const;

/** The cosmetic id awarded for completing a given tour. */
export function cosmeticIdForTour(tourId: string): string {
  return `${COSMETIC_PREFIX}${tourId}`;
}

/**
 * Append `cosmeticId` to `unlockedCosmetics` if absent. Always
 * returns a fresh mutable array so the result fits the
 * zod-inferred `string[]` shape on `SaveGame.unlockedCosmetics`.
 */
export function appendUnlockedCosmetic(
  unlockedCosmetics: readonly string[] | undefined,
  cosmeticId: string,
): string[] {
  const current = unlockedCosmetics ?? [];
  if (current.includes(cosmeticId)) return [...current];
  return [...current, cosmeticId];
}

export interface CosmeticBadge {
  readonly cosmeticId: string;
  readonly tourId: string;
  /** Player-facing badge label (e.g., `"Iron Borough livery"`). */
  readonly label: string;
}

/**
 * Build the per-cosmetic display rows for the title-screen badge row.
 * Cosmetics whose id does not match the `livery-${slug}` shape are
 * skipped so a future slice that adds non-livery cosmetics can extend
 * this without breaking the slice-1 surface.
 */
export function buildCosmeticBadges(
  unlockedCosmetics: readonly string[] | undefined,
): readonly CosmeticBadge[] {
  if (!unlockedCosmetics || unlockedCosmetics.length === 0) return [];
  const badges: CosmeticBadge[] = [];
  for (const cosmeticId of unlockedCosmetics) {
    if (!cosmeticId.startsWith(COSMETIC_PREFIX)) continue;
    const tourId = cosmeticId.slice(COSMETIC_PREFIX.length);
    if (tourId.length === 0) continue;
    badges.push({
      cosmeticId,
      tourId,
      label: `${titleCaseTourId(tourId)} livery`,
    });
  }
  return badges;
}

function titleCaseTourId(tourId: string): string {
  return tourId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
