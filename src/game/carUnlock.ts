/**
 * F-097 follow-up. Pure helper for the optional tour-completion gate
 * on car purchases. The garage car selector calls this once per car
 * card to decide whether the Buy affordance should be locked.
 *
 * A car with no `requiresTour` is always unlocked (starter and
 * mid-pack catalogue). A car with `requiresTour` is unlocked once
 * that tour id appears in `save.progress.completedTours`. The helper
 * does not look at credits; the existing `purchasePrice` check stays
 * as a separate disabled-on-affordability gate so the player sees
 * "Win <Tour> to unlock" before "Save up <N> credits".
 */

import type { Car } from "@/data/schemas";

export function isCarUnlocked(
  car: Car,
  completedTours: readonly string[],
): boolean {
  if (car.requiresTour === undefined) return true;
  return completedTours.includes(car.requiresTour);
}
