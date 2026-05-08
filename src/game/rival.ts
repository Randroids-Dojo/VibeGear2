/**
 * F-092 slice 1. Pure rival-driver picker.
 *
 * Designates one AI driver per race as the player's rival so the
 * existing rivalry HUD signal can name them ("Korsak, 18 m back")
 * instead of the generic "Rival close". The choice is deterministic:
 * the driver with the highest `paceScalar` is the natural foil because
 * they are the AI most likely to occupy the same lap-time band as a
 * skilled player. Ties break on `id` ascending so the choice is stable
 * across runs without consuming any RNG.
 *
 * Out of scope this slice (filed under F-092):
 *   - Cross-race head-to-head score persisted on the save.
 *   - Tour-pinned rival so the same name recurs across all 4 races.
 *   - Prep-card and results-screen surfaces.
 *
 * Returns `null` for grids with no AI (practice / time-trial) so
 * callers can branch on absence without an explicit length check.
 */

import type { AIDriver } from "@/data/schemas";

export interface RivalRef {
  /** AI driver id from `aiDriverRoster` (e.g. `"ai_bully_01"`). */
  readonly driverId: string;
  /** Player-facing short name (`"D. Korsak"`). */
  readonly displayName: string;
  /**
   * Race-scoped car id matching the `ai-${index}` shape that the race
   * page uses for `RankedCar.id`. Stored alongside the driver fields
   * so HUD code can match against the in-race car id without re-deriving
   * the index.
   */
  readonly carId: string;
}

export interface PickRivalInput {
  readonly drivers: readonly AIDriver[];
}

export function pickRival(input: PickRivalInput): RivalRef | null {
  if (input.drivers.length === 0) return null;
  let bestIndex = 0;
  for (let i = 1; i < input.drivers.length; i++) {
    const candidate = input.drivers[i]!;
    const incumbent = input.drivers[bestIndex]!;
    if (candidate.paceScalar > incumbent.paceScalar) {
      bestIndex = i;
      continue;
    }
    if (
      candidate.paceScalar === incumbent.paceScalar &&
      candidate.id < incumbent.id
    ) {
      bestIndex = i;
    }
  }
  const winner = input.drivers[bestIndex]!;
  return {
    driverId: winner.id,
    displayName: winner.displayName,
    carId: `ai-${bestIndex}`,
  };
}
