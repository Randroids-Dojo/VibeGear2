/**
 * F-101 first-race HUD hint trigger module. Closes slice B of the
 * F-098 onboarding pair (slice A was the prep card).
 *
 * Pure: same inputs always produce the same output. No globals, no
 * `Date.now()`, no React. The race page evaluates this once per
 * render frame and feeds the result into a small overlay component.
 *
 * Gating semantics:
 *
 *   - The page passes `enabled: false` when the player already has
 *     a recorded race result (`Object.keys(save.records).length > 0`).
 *     That collapses every hint to `null` for returning players.
 *   - When `enabled: true`, two hints fire mutually-exclusively
 *     based on per-frame race-state predicates:
 *
 *       1. **Brake before corners.** Triggered when an upcoming
 *          curve magnitude exceeds `BRAKE_HINT_CURVE_THRESHOLD`
 *          inside `BRAKE_HINT_LOOKAHEAD_METERS` and the player is
 *          travelling faster than `BRAKE_HINT_MIN_SPEED_MPS`. Hint
 *          stops once the player reduces speed below
 *          `BRAKE_HINT_RESET_SPEED_MPS` so a single hint cycles
 *          per corner approach instead of latching.
 *
 *       2. **Tap nitro.** Triggered on a long straight (curve below
 *          `NITRO_HINT_STRAIGHT_THRESHOLD`) at mid-band speed
 *          (`>= NITRO_HINT_MIN_SPEED_FRACTION * topSpeed`) when
 *          the player still has unspent charges and is not currently
 *          burning. Same one-shot cycle: clears once nitro fires.
 *
 *   - Brake hint takes precedence when both predicates fire; the
 *     race page renders only one hint at a time so a player who
 *     reads the corner hint resolves it before the nitro hint
 *     pings.
 *
 * Out of scope (deferred):
 *   - Top-4 finish hint. The §6 / §7 advancement rule is already
 *     surfaced on the prep card under F-098; the HUD-side cue
 *     would duplicate it. Re-evaluate after a manual playtest.
 *   - Per-tour pacing. Hints fire only on the player's first race
 *     ever (gated by `save.records`). A returning player who
 *     deletes their save and starts fresh sees them again.
 */

export const BRAKE_HINT_CURVE_THRESHOLD = 0.15;
export const BRAKE_HINT_LOOKAHEAD_METERS = 80;
export const BRAKE_HINT_MIN_SPEED_MPS = 30;
export const BRAKE_HINT_RESET_SPEED_MPS = 22;

export const NITRO_HINT_STRAIGHT_THRESHOLD = 0.06;
export const NITRO_HINT_MIN_SPEED_FRACTION = 0.5;

export type TutorialHintId = "brake-before-corner" | "tap-nitro";

export interface TutorialHint {
  readonly id: TutorialHintId;
  readonly text: string;
}

const BRAKE_HINT: TutorialHint = Object.freeze({
  id: "brake-before-corner",
  text: "Brake before corners. Hold Down to slow into the apex.",
});

const NITRO_HINT: TutorialHint = Object.freeze({
  id: "tap-nitro",
  text: "Tap Space for a nitro burst. Save it for straights.",
});

export interface TutorialHintInput {
  readonly enabled: boolean;
  readonly upcomingCurveMagnitude: number;
  readonly playerSpeedMps: number;
  readonly topSpeedMps: number;
  readonly authoredCurveMagnitude: number;
  readonly nitroCharges: number;
  readonly nitroActive: boolean;
}

/**
 * Resolve the active hint for this frame. Returns `null` when no
 * hint should render; the caller treats `null` as "hide overlay".
 */
export function deriveTutorialHint(
  input: TutorialHintInput,
): TutorialHint | null {
  if (!input.enabled) return null;
  if (
    input.upcomingCurveMagnitude > BRAKE_HINT_CURVE_THRESHOLD &&
    input.playerSpeedMps > BRAKE_HINT_MIN_SPEED_MPS
  ) {
    return BRAKE_HINT;
  }
  if (
    input.authoredCurveMagnitude < NITRO_HINT_STRAIGHT_THRESHOLD &&
    input.topSpeedMps > 0 &&
    input.playerSpeedMps >= NITRO_HINT_MIN_SPEED_FRACTION * input.topSpeedMps &&
    input.nitroCharges > 0 &&
    !input.nitroActive
  ) {
    return NITRO_HINT;
  }
  return null;
}
