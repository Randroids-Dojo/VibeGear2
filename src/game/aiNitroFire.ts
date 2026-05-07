/**
 * AI nitro-firing decision per `docs/gdd/15-cpu-opponents-and-ai.md`
 * "Mistakes" + "Passing behavior" + the §22 `AINitroUsageSchema` bias
 * triple (`launchBias`, `straightBias`, `panicBias`).
 *
 * Closes F-091 (the §15 readability gap where AI ticks always set
 * `nitro: false`, leaving every opponent visibly slow on every
 * straight while the player's nitro is dramatic).
 *
 * Pure: no globals, no `Date.now()`, no shared RNG. The caller threads
 * the per-AI seed in `AIState.seed` so two runs with the same seed
 * produce identical fire decisions, satisfying the §21 replay /
 * ghost determinism requirement.
 *
 * Decision windows per tick (mutually-exclusive; first match wins):
 *
 *   1. **Launch.** Lap 1, fractional progress < `LAUNCH_LAP_FRACTION`.
 *      Probability gate against `nitroUsage.launchBias`. Models the
 *      §15 "Rocket starter" archetype's race-start surge; non-rocket
 *      archetypes still fire here when their per-driver `launchBias`
 *      is high enough (the bully's 0.7 launches sometimes; the
 *      enduro's 0.5 rarely does).
 *
 *   2. **Panic.** Player is close in front (within `PANIC_GAP_METERS`)
 *      and the AI is trailing, OR final lap with > 50% lap fraction.
 *      Probability gate against `nitroUsage.panicBias`. Models the
 *      §15 "Bully defends and rubs more often" + "Chaotic occasionally
 *      brilliant" archetypes' situational nitro use.
 *
 *   3. **Straight.** Current segment is straighter than
 *      `STRAIGHT_CURVE_THRESHOLD` and the AI's speed is in the band
 *      `[SPEED_FLOOR_FRACTION, SPEED_CEILING_FRACTION] * topSpeed`.
 *      Probability gate against `nitroUsage.straightBias`. The
 *      ceiling stops the AI from wasting nitro at near-top-speed; the
 *      floor stops it from firing on a lazy throttle.
 *
 * Hard gates (any one short-circuits to `false`):
 *
 *   - No charges remaining.
 *   - A charge is currently burning (`activeRemainingSec > 0`); the
 *     reducer would ignore the press anyway, but returning `false`
 *     keeps `wasPressed` falling cleanly so the next desired burn
 *     fires on a clean rising edge.
 *   - Mid-corner: `Math.abs(authoredCurve) > MID_CORNER_CURVE`.
 *     Per the §10 narrative ("Nitro use in severe corners is usually
 *     a mistake") and the §15 "Cautious brakes earlier in poor
 *     visibility" guidance. Chaotic gets a small carve-out via its
 *     `mistakeScalar`-driven brilliant-vs-mistake split (handled in
 *     the existing `tickAI` mistake hook, not here).
 *   - Cautious archetype in heavy weather: `defender` never fires
 *     when the §10 nitro-weather risk table is `medium` or `high`.
 *     §15 "Cautious archetypes back out in rain or fog".
 *
 * The decision is one function call per AI per tick. The PRNG draw
 * uses the AI's seed and a per-window salt so the launch / panic /
 * straight draws decorrelate (a driver who failed the launch roll on
 * tick 1 still has a fresh roll for the panic window on tick 2).
 *
 * Out of scope for this slice (deferred to follow-up dots):
 * - Lookahead curvature for "is the next 200 m straight?" pre-fire.
 * - Nitro-on-jump / crest detection (no jumps in v1.0 content).
 * - Coordinated platoon nitro (rocket-burst pack pulling together).
 * - Per-tour nitro policy (saving 1 charge for the final straight
 *   across the whole race, not just the per-tick window).
 */

import type { AIArchetype, AINitroUsage, WeatherOption } from "@/data/schemas";
import { NITRO_WEATHER_RISK, type NitroState } from "./nitro";
import { deserializeRng } from "./rng";

/**
 * Lap-1 fractional progress under which the launch window applies.
 * Roughly the race's first opening straight on a typical 1500 m
 * standard track. The §15 "Rocket starter" archetype's surge is
 * authored to fade after this fraction so the non-rocket archetypes
 * also stop launch-firing at the same point.
 */
export const LAUNCH_LAP_FRACTION = 0.22;

/**
 * Player-gap window in meters under which the panic window applies.
 * Covers the same proximity band as `OVERTAKE_WINDOW_METERS` (28 m)
 * with a small cushion so a defender starts the burn one beat before
 * the inside-line attempt arrives.
 */
export const PANIC_GAP_METERS = 32;

/**
 * Lap fraction within the final lap above which the panic window also
 * fires. The §7 "fastest lap" + §15 "endurance saves nitro for the
 * final straight" intent maps onto a final-half-lap push.
 */
export const FINAL_LAP_PUSH_FRACTION = 0.5;

/**
 * Authored-curve magnitude above which the AI does not fire nitro
 * even if a window opens. The §10 narrative ("Nitro use in severe
 * corners is usually a mistake") sets the threshold; 0.15 corresponds
 * to a meaningful corner without being a sweeper. Below this the
 * straight window predicate uses the tighter
 * `STRAIGHT_CURVE_THRESHOLD`.
 */
export const MID_CORNER_CURVE = 0.15;

/**
 * Authored-curve magnitude below which a segment counts as "straight"
 * for the straight window. Slightly tighter than `MID_CORNER_CURVE`
 * so a gentle drift past 0.08 reads as "still cornering" and stops
 * the straight roll without flipping the mid-corner gate.
 */
export const STRAIGHT_CURVE_THRESHOLD = 0.08;

/**
 * Speed band the straight window honours, expressed as fractions of
 * the AI's chassis top speed. Below the floor the AI is still
 * accelerating on throttle alone (no boost wasted). Above the ceiling
 * the boost would clamp against the chassis top-speed cap (no value).
 */
export const SPEED_FLOOR_FRACTION = 0.5;
export const SPEED_CEILING_FRACTION = 0.95;

/** Per-window PRNG salt so the three rolls decorrelate. */
const LAUNCH_SALT = 0x4c4e_4348;
const PANIC_SALT = 0x504e_4943;
const STRAIGHT_SALT = 0x5354_5254;

export interface DecideFireNitroInput {
  readonly archetype: AIArchetype;
  readonly nitroUsage: Readonly<AINitroUsage>;
  readonly nitro: Readonly<NitroState>;
  readonly seed: number;
  readonly aiSpeed: number;
  readonly topSpeed: number;
  readonly authoredCurve: number;
  readonly lap: number;
  readonly totalLaps: number;
  readonly lapFraction: number;
  /** Signed: positive when the AI is behind the player. */
  readonly playerGapMeters: number;
  readonly weather: WeatherOption | null;
}

/**
 * Decide whether the AI presses nitro this tick. Returns `true` for
 * exactly the ticks the AI wants to start a fresh charge. Returning
 * `true` while a charge is already burning is harmless (the reducer
 * ignores it) but is not necessary; this function returns `false` in
 * that case so the rising edge stays clean.
 */
export function decideFireNitro(input: DecideFireNitroInput): boolean {
  if (input.nitro.charges <= 0) return false;
  if (input.nitro.activeRemainingSec > 0) return false;
  if (Math.abs(input.authoredCurve) > MID_CORNER_CURVE) return false;
  if (input.archetype === "defender" && isHazardousWeather(input.weather)) {
    return false;
  }

  if (
    input.lap === 1 &&
    input.lapFraction < LAUNCH_LAP_FRACTION &&
    rollWindow(input.seed, LAUNCH_SALT, input.nitroUsage.launchBias)
  ) {
    return true;
  }

  if (isPanicWindow(input)) {
    return rollWindow(input.seed, PANIC_SALT, input.nitroUsage.panicBias);
  }

  if (isStraightWindow(input)) {
    return rollWindow(input.seed, STRAIGHT_SALT, input.nitroUsage.straightBias);
  }

  return false;
}

function isHazardousWeather(weather: WeatherOption | null): boolean {
  if (weather === null) return false;
  const risk = NITRO_WEATHER_RISK[weather];
  return risk === "medium" || risk === "high";
}

function isPanicWindow(input: DecideFireNitroInput): boolean {
  if (
    input.playerGapMeters > 0 &&
    input.playerGapMeters < PANIC_GAP_METERS
  ) {
    return true;
  }
  if (
    input.lap === input.totalLaps &&
    input.lapFraction > FINAL_LAP_PUSH_FRACTION
  ) {
    return true;
  }
  return false;
}

function isStraightWindow(input: DecideFireNitroInput): boolean {
  if (Math.abs(input.authoredCurve) > STRAIGHT_CURVE_THRESHOLD) return false;
  if (input.topSpeed <= 0) return false;
  const speedFraction = input.aiSpeed / input.topSpeed;
  if (speedFraction < SPEED_FLOOR_FRACTION) return false;
  if (speedFraction > SPEED_CEILING_FRACTION) return false;
  return true;
}

function rollWindow(seed: number, salt: number, bias: number): boolean {
  if (bias <= 0) return false;
  if (bias >= 1) return true;
  const rng = deserializeRng((seed ^ salt) >>> 0);
  return rng.next() < bias;
}
