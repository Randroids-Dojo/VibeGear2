/**
 * Nitro / boost state machine per
 * `docs/gdd/10-driving-model-and-physics.md` ("Nitro system"),
 * `docs/gdd/12-upgrade-and-economy-system.md` ("Nitro system" upgrade
 * category and §12 cost ladder), and `docs/gdd/19-controls-and-input.md`
 * (Space on keyboard, X / Square on the gamepad).
 *
 * Design summary from §10 "Nitro system":
 *
 *   - 3 charges per race by default.
 *   - Each charge can be tapped or held.
 *   - Base duration: 1.1 s per charge.
 *   - Upgrades improve thrust and total duration.
 *   - Nitro expands instability under poor traction.
 *   - Nitro use in severe corners is usually a mistake.
 *
 * This module is the pure state machine: input goes in, next state comes
 * out, no globals, no time source, no RNG (AGENTS.md RULE 8). The physics
 * step reads `getNitroAccelMultiplier(state, ctx)` to scale its
 * throttle-driven acceleration while a charge is burning, and the future
 * traction-loss slice reads `getInstabilityMultiplier(state, surface,
 * weather, damageBand)` to scale its base spin probability while a
 * charge is burning under poor traction conditions.
 *
 * State shape:
 *
 *   {
 *     charges: number;           // remaining unused charges (>= 0)
 *     activeRemainingSec: number; // > 0 while a charge is burning, else 0
 *   }
 *
 * The dot's stress-test name `activeUntilMs` is renamed here to
 * `activeRemainingSec` so the field reads in the same units as the
 * `dt` the loop already passes everywhere else (seconds), which keeps
 * the integration math readable. The field is monotonically decremented
 * each tick by `dt`; when it falls to zero the charge ends.
 *
 * Rules the reducer enforces:
 *
 *   - Tap with charge active: ignored. No charge stacking.
 *   - Tap with no charges: ignored, returns `{ ok: false, code: 'no_charges' }`.
 *   - Hold past the duration: charge auto-stops; cannot extend.
 *   - Releasing the key mid-burn: charge keeps burning to its natural end.
 *     A "tap" is just "press for one tick and release"; the burn is owned
 *     by the state, not the input. This matches the §10 "tap or hold" line
 *     where both gestures get the same per-charge contract.
 *
 * Why no `Date.now()` and no ms accumulator? The simulation runs at a
 * fixed 60 Hz tick (see `loop.ts`), and `dt` is the only source of
 * truth for time inside the sim. Folding nitro time into the same dt
 * cadence keeps the §21 replay/ghost system safe; an absolute-ms
 * accumulator would diverge across runs whenever the loop's start
 * timestamp changed.
 *
 * Determinism: same input sequence produces deep-equal state across
 * any number of runs. Frozen initial state. The reducer never mutates
 * its input.
 */

import type { CarBaseStats, UpgradeCategory, WeatherOption } from "@/data/schemas";

import type { DamageBand } from "./damageBands";
import type { Surface } from "./physics";

// State -------------------------------------------------------------------

/**
 * Per-tick nitro snapshot. Shape is intentionally minimal so future
 * slices (HUD widget, replay capture, AI hint) can extend it additively.
 *
 * `charges` is the number of unused charges remaining. Starts at the
 * race's per-car default (3 for stock, more with the Extreme nitro
 * upgrade per the §12 ladder). Always non-negative integer; the reducer
 * clamps writes into the band defensively so a bad save cannot poison
 * the field.
 *
 * `activeRemainingSec` is the seconds remaining on the currently
 * burning charge, or `0` when no charge is active. The reducer
 * decrements this by `dt` each tick; when it reaches `0` the charge
 * ends. Always `>= 0`.
 */
export interface NitroState {
  charges: number;
  activeRemainingSec: number;
}

/**
 * Default starting charges per the §10 "Nitro system" baseline.
 * Per-race overrides (e.g. the Extreme upgrade band) layer on top via
 * `createNitroState({ charges })`.
 */
export const DEFAULT_NITRO_CHARGES = 3;

/**
 * Base burn duration per charge in seconds. §10 "Base duration: 1.1 s
 * per charge." Per-tier upgrades scale this via `nitroDurationForTier`.
 */
export const BASE_NITRO_DURATION_SEC = 1.1;

/**
 * Base accel multiplier while a charge is burning. §10 "Upgrades
 * improve thrust"; the stock thrust is the §10 baseline. Per-tier
 * upgrades scale via `nitroThrustForTier`. Pinned at `1.5` so a stock
 * boost is "noticeable, not dominant" feel-target consistent with the
 * §10 narrative; max at Extreme is `1.85`, well under the
 * `ACCEL_MULTIPLIER_MAX = 2` band the physics step clamps to.
 */
export const BASE_NITRO_THRUST_MULTIPLIER = 1.5;

/**
 * Pristine (race-start) state convenience: `DEFAULT_NITRO_CHARGES`
 * charges, no active burn. Frozen so callers cannot mutate the
 * constant.
 */
export const INITIAL_NITRO_STATE: Readonly<NitroState> = Object.freeze({
  charges: DEFAULT_NITRO_CHARGES,
  activeRemainingSec: 0,
});

/**
 * Maximum supported charge count. Even at the §12 Extreme nitro tier
 * the design pins a small charge bump (4); this ceiling defends the
 * reducer against a future tweak that pushes the table past 6 charges.
 */
export const ABSOLUTE_MAX_CHARGES = 6;

// Upgrade table -----------------------------------------------------------

/**
 * Nitro upgrade tier index. Mirrors the §12 ladder: 0 = Stock, 1 =
 * Street, 2 = Sport, 3 = Factory, 4 = Extreme. Out-of-range values
 * clamp.
 *
 * Each tier scales two knobs:
 *
 *   - `chargesBonus`: extra charges granted per race (added to the
 *     §10 baseline of 3).
 *   - `durationMultiplier`: scales `BASE_NITRO_DURATION_SEC`.
 *   - `thrustMultiplier`: scales `BASE_NITRO_THRUST_MULTIPLIER`.
 *
 * Pins (the §12 narrative says "Raises boost thrust and burn duration"
 * but does not pin the curve; the table below is balanced so the
 * Extreme tier is meaningfully stronger than Stock without crossing
 * the §10 "small expert advantage" budget into a top-speed cheat):
 *
 *   - Stock   (0): +0 charges, x1.00 duration, x1.00 thrust.
 *   - Street  (1): +0 charges, x1.05 duration, x1.05 thrust.
 *   - Sport   (2): +0 charges, x1.10 duration, x1.12 thrust.
 *   - Factory (3): +1 charge,  x1.15 duration, x1.18 thrust.
 *   - Extreme (4): +1 charge,  x1.25 duration, x1.235 thrust.
 *
 * The §10 "thrust scales with upgrade tier" requirement is honoured by
 * the multipliers; the §12 Extreme price point earns the
 * `+1 charge / x1.25 duration / x1.235 thrust` bump (peak combined boost
 * is `1.5 * 1.235 = 1.8525`, comfortably under the
 * `ACCEL_MULTIPLIER_MAX = 2` physics ceiling).
 */
export interface NitroUpgradeTier {
  chargesBonus: number;
  durationMultiplier: number;
  thrustMultiplier: number;
}

export const NITRO_UPGRADE_TIERS: ReadonlyArray<Readonly<NitroUpgradeTier>> =
  Object.freeze([
    Object.freeze({ chargesBonus: 0, durationMultiplier: 1.0, thrustMultiplier: 1.0 }),
    Object.freeze({ chargesBonus: 0, durationMultiplier: 1.05, thrustMultiplier: 1.05 }),
    Object.freeze({ chargesBonus: 0, durationMultiplier: 1.1, thrustMultiplier: 1.12 }),
    Object.freeze({ chargesBonus: 1, durationMultiplier: 1.15, thrustMultiplier: 1.18 }),
    Object.freeze({ chargesBonus: 1, durationMultiplier: 1.25, thrustMultiplier: 1.235 }),
  ]);

/**
 * Resolve the nitro upgrade tier for a given index. Out-of-range
 * inputs (NaN, negative, fractional, too high) clamp into the table.
 */
export function nitroUpgradeTierFor(tier: number): NitroUpgradeTier {
  if (!Number.isFinite(tier)) return { ...NITRO_UPGRADE_TIERS[0]! };
  const idx = Math.max(
    0,
    Math.min(NITRO_UPGRADE_TIERS.length - 1, Math.floor(tier)),
  );
  return { ...NITRO_UPGRADE_TIERS[idx]! };
}

/**
 * Convenience for callers that already have an `installedUpgrades`
 * object on hand. Reads the `nitro` field and forwards to
 * `nitroUpgradeTierFor`. Defaults to the Stock tier when the field is
 * missing.
 */
export function nitroUpgradeTierForUpgrades(
  upgrades: Partial<Record<UpgradeCategory, number>> | null | undefined,
): NitroUpgradeTier {
  if (!upgrades) return { ...NITRO_UPGRADE_TIERS[0]! };
  const tier = upgrades.nitro;
  if (typeof tier !== "number") return { ...NITRO_UPGRADE_TIERS[0]! };
  return nitroUpgradeTierFor(tier);
}

// Init helpers ------------------------------------------------------------

export interface CreateNitroOptions {
  /**
   * Override the starting charge count. Defaults to
   * `DEFAULT_NITRO_CHARGES + tier.chargesBonus` when the upgrade tier
   * is supplied; otherwise just `DEFAULT_NITRO_CHARGES`. The result
   * always clamps into `[0, ABSOLUTE_MAX_CHARGES]`.
   */
  charges?: number;
  /**
   * Optional upgrade tier index (`0..4`). When set and `charges` is
   * not, the per-tier `chargesBonus` adjusts the baseline.
   */
  upgradeTier?: number;
}

/**
 * Build a fresh nitro state. The returned object is frozen so the
 * caller treats it as immutable; the reducer always emits a new object
 * anyway.
 */
export function createNitroState(options: CreateNitroOptions = {}): NitroState {
  let charges: number;
  if (typeof options.charges === "number") {
    charges = options.charges;
  } else if (typeof options.upgradeTier === "number") {
    charges = DEFAULT_NITRO_CHARGES + nitroUpgradeTierFor(options.upgradeTier).chargesBonus;
  } else {
    charges = DEFAULT_NITRO_CHARGES;
  }
  charges = clampInt(charges, 0, ABSOLUTE_MAX_CHARGES);
  return Object.freeze({ charges, activeRemainingSec: 0 });
}

// Reducer -----------------------------------------------------------------

/**
 * Per-tick context the reducer needs from the rest of the sim.
 *
 * `nitroPressed` mirrors the canonical `Input.nitro` boolean: the
 * binding layer (keyboard Space, gamepad Square) sets this to `true`
 * for any tick the player is holding the action. The reducer treats
 * the press as edge-triggered for *starting* a charge (so two presses
 * in two ticks still consumes only one charge while a charge is
 * active), but the burn lifetime is owned by the state, not the
 * input: releasing the key mid-burn does not abort the charge, and
 * holding past the duration does not extend it.
 *
 * `upgradeTier` is the §12 nitro upgrade index (`0..4`). When omitted
 * the Stock tier is used (no thrust / duration scaling). The reducer
 * uses the tier to compute the burn duration when starting a fresh
 * charge; mid-burn changes to the upgrade tier do not retroactively
 * shorten or lengthen the active charge.
 *
 * `wasPressed` is the prior-tick value of `nitroPressed`. The reducer
 * uses `nitroPressed && !wasPressed` to detect a fresh tap; without it
 * a held press would re-fire on every tick. Defaults to `false` for
 * the first call.
 */
export interface NitroStepContext {
  nitroPressed: boolean;
  wasPressed?: boolean;
  upgradeTier?: number;
}

/**
 * Default neutral context; useful as a starting fixture for tests.
 */
export const DEFAULT_NITRO_CONTEXT: Readonly<NitroStepContext> = Object.freeze({
  nitroPressed: false,
  wasPressed: false,
  upgradeTier: 0,
});

/**
 * Result the reducer returns alongside the next state. Lets callers
 * detect whether the press succeeded without re-deriving from the
 * before / after state.
 *
 * `code` is `null` when nothing relevant happened, `"started"` when a
 * fresh charge fired this tick, `"continuing"` when a previously-
 * started charge is still burning, `"ended"` when a charge's burn
 * window expired this tick, or `"no_charges"` when a tap was
 * rejected because the player had no charges remaining.
 */
export type NitroEventCode =
  | null
  | "started"
  | "continuing"
  | "ended"
  | "no_charges";

export interface NitroStepResult {
  state: NitroState;
  code: NitroEventCode;
  /**
   * Whether the burn is currently active in the *returned* state.
   * Convenience for callers (HUD, physics) that just want a boolean.
   */
  isActive: boolean;
}

/**
 * Reducer: advance the nitro state by one tick.
 *
 * Pure: input `state` is never mutated; a fresh object is returned in
 * `result.state` every call.
 *
 * Behaviour summary:
 *
 *   - If a charge is currently burning (`activeRemainingSec > 0`):
 *     decrement by `dt`. If the result is `<= 0`, end the burn (state's
 *     `activeRemainingSec` becomes `0`, code is `"ended"`); otherwise
 *     keep burning (code `"continuing"`). Tap inputs are ignored while a
 *     charge is active (no stacking, the dot's edge case).
 *
 *   - Otherwise (no active burn): if the input was just pressed
 *     (`nitroPressed && !wasPressed`) and `charges > 0`, consume one
 *     charge and start a new burn for `nitroDurationForTier(tier)`
 *     seconds (code `"started"`). If pressed but `charges === 0`, code
 *     is `"no_charges"` and state is unchanged. If not pressed (or
 *     held without an edge), state is unchanged with code `null`.
 */
export function tickNitro(
  state: Readonly<NitroState>,
  ctx: Readonly<NitroStepContext>,
  dt: number,
): NitroStepResult {
  // Defensive: invalid dt never advances the burn but never throws.
  // Returns a clean clone so callers can trust `state` is fresh.
  const safeState = sanitiseState(state);
  if (!Number.isFinite(dt) || dt <= 0) {
    return { state: safeState, code: null, isActive: safeState.activeRemainingSec > 0 };
  }

  const tier = nitroUpgradeTierFor(ctx.upgradeTier ?? 0);

  // Branch 1: a charge is currently burning. Tick it down; ignore tap.
  if (safeState.activeRemainingSec > 0) {
    const remaining = safeState.activeRemainingSec - dt;
    if (remaining <= 0) {
      const next: NitroState = { charges: safeState.charges, activeRemainingSec: 0 };
      return { state: next, code: "ended", isActive: false };
    }
    const next: NitroState = {
      charges: safeState.charges,
      activeRemainingSec: remaining,
    };
    return { state: next, code: "continuing", isActive: true };
  }

  // Branch 2: no active burn. Look for a fresh tap (rising edge).
  const pressed = ctx.nitroPressed === true;
  const wasPressed = ctx.wasPressed === true;
  const justPressed = pressed && !wasPressed;

  if (!justPressed) {
    return { state: safeState, code: null, isActive: false };
  }

  if (safeState.charges <= 0) {
    return { state: safeState, code: "no_charges", isActive: false };
  }

  const duration = nitroDurationForTier(tier);
  const next: NitroState = {
    charges: safeState.charges - 1,
    activeRemainingSec: duration,
  };
  return { state: next, code: "started", isActive: true };
}

/**
 * Burn duration in seconds for a given upgrade tier. Multiplies the
 * §10 base of `1.1 s` by the tier's `durationMultiplier`. Useful for
 * HUD widgets that want to display the per-charge burn time without
 * re-running the reducer.
 */
export function nitroDurationForTier(tier: NitroUpgradeTier): number {
  return BASE_NITRO_DURATION_SEC * tier.durationMultiplier;
}

/**
 * Thrust multiplier for a given upgrade tier. Multiplies the §10 base
 * thrust by the tier's `thrustMultiplier`. The result is the value the
 * physics step's `accelMultiplier` slot sees while a charge is burning;
 * when no charge is burning the accel multiplier is `1.0`.
 */
export function nitroThrustForTier(tier: NitroUpgradeTier): number {
  return BASE_NITRO_THRUST_MULTIPLIER * tier.thrustMultiplier;
}

// Per-tick scalars for physics --------------------------------------------

/**
 * Per-tick context the accel-multiplier helper consumes. Lets the
 * helper take `nitroEfficiency` from the car's stats (§11) and
 * `damage.nitroEfficiency` from the §10 damage band so a damaged
 * engine produces a weaker boost.
 *
 * `damageNitroEfficiency` is the `nitroEfficiency` field from
 * `getDamageScalars(damagePercent)`. Defaults to `1` (pristine).
 *
 * `carNitroEfficiency` is the `nitroEfficiency` field from
 * `CarBaseStats` (§23 balance sheet). Defaults to `1`. Cars
 * tuned for nitro (the §11 power class) earn a small multiplier
 * here.
 *
 * `upgradeTier` is the §12 nitro upgrade index. Defaults to `0`.
 */
export interface NitroAccelContext {
  upgradeTier?: number;
  carNitroEfficiency?: number;
  damageNitroEfficiency?: number;
}

/**
 * Compute the acceleration multiplier the physics step's `accelMultiplier`
 * slot should see when nitro is burning, or `1.0` when it is not.
 *
 * Multiplies `nitroThrustForTier(tier)` by the per-car
 * `nitroEfficiency` (a stat slot reserved for this in `CarBaseStats`)
 * and by the §10 damage band's `nitroEfficiency`. The result is
 * defensively clamped into `[1, ACCEL_MULTIPLIER_MAX]` (where
 * `ACCEL_MULTIPLIER_MAX = 2`, mirrored from `physics.ts`); a buggy
 * stat combination cannot turn a boost into a top-speed cheat.
 *
 * The clamp lower bound is `1` so a heavily damaged engine cannot push
 * the multiplier below the no-boost identity; the §10 damage band
 * reduces the magnitude of the boost, not the baseline acceleration.
 */
export function getNitroAccelMultiplier(
  state: Readonly<NitroState>,
  ctx: Readonly<NitroAccelContext> = {},
): number {
  if (state.activeRemainingSec <= 0) return 1;
  const tier = nitroUpgradeTierFor(ctx.upgradeTier ?? 0);
  const carEff = clampNumber(ctx.carNitroEfficiency ?? 1, 0, 2);
  const dmgEff = clampNumber(ctx.damageNitroEfficiency ?? 1, 0, 1);
  const raw = nitroThrustForTier(tier) * carEff * dmgEff;
  return clampNumber(raw, 1, NITRO_ACCEL_MULTIPLIER_MAX);
}

/**
 * Mirror of `physics.ACCEL_MULTIPLIER_MAX` so this module does not
 * import a value that creates a cycle (physics imports nothing from
 * nitro). Pinned to the same `2` ceiling; keeping the constant in two
 * places is a deliberate one-way contract: changes to the physics
 * ceiling must update this constant too.
 */
export const NITRO_ACCEL_MULTIPLIER_MAX = 2;

// Instability table -------------------------------------------------------

/**
 * Per-§10 "Nitro expands instability under poor traction" risk table.
 * Returns a multiplier the future traction-loss slice multiplies
 * against its base spin probability while a charge is burning.
 *
 * The §10 weather table maps each weather to a "Nitro risk" tier:
 *
 *   - Clear: Low
 *   - Light rain: Medium
 *   - Heavy rain: High
 *   - Fog: Medium
 *   - Snow: High
 *   - Dusk/night: Low
 *
 * The schema's `WeatherOption` enum carries 8 values: `clear`,
 * `light_rain`, `rain`, `heavy_rain`, `fog`, `snow`, `dusk`, `night`.
 * The `rain` enum entry sits between `light_rain` and `heavy_rain`;
 * we map it to "Medium" (closest to `light_rain`'s tier so a moderate
 * rain reads as "Medium" not "High"). `dusk` and `night` both map to
 * the §10 "Dusk/night" Low tier.
 *
 * Each weather tier produces a base instability multiplier:
 *
 *   - Low:    1.0  (no weather penalty)
 *   - Medium: 1.4  (modest penalty)
 *   - High:   1.9  (severe penalty)
 *
 * The surface and damage-band axes layer on top multiplicatively; the
 * final multiplier is `weather * surface * damage`.
 *
 * Surface multipliers (mirroring `physics.Surface`):
 *
 *   - road:   1.0  (no surface penalty)
 *   - rumble: 1.25 (rumble strip reduces grip slightly)
 *   - grass:  1.6  (off-road, severe penalty)
 *
 * Damage band multipliers (per §10 "Nitro use in severe corners is
 * usually a mistake" + §13 damage table; severe / catastrophic bands
 * compound the spin risk):
 *
 *   - pristine:     1.0
 *   - light:        1.05
 *   - moderate:     1.25 (the §10 "50+%" cliff)
 *   - severe:       1.6
 *   - catastrophic: 2.0
 *
 * The total ceiling is bounded by `INSTABILITY_MULTIPLIER_MAX = 8`
 * (defence in depth against a future tweak to the table); the
 * worst-case raw product is `1.9 * 1.6 * 2.0 = 6.08`, comfortably
 * under the cap.
 *
 * Returns `1.0` when the nitro is not currently active so the caller
 * can blindly multiply by the result without first checking the
 * burning state.
 */
export type NitroWeatherRisk = "low" | "medium" | "high";

/**
 * §10 weather to risk-tier mapping. The §22 schema's 8 weather values
 * are mapped onto the §10 narrative's 6 buckets here; `rain` maps to
 * `medium`, `dusk` and `night` both map to the `low` tier.
 */
export const NITRO_WEATHER_RISK: Readonly<Record<WeatherOption, NitroWeatherRisk>> =
  Object.freeze({
    clear: "low",
    light_rain: "medium",
    rain: "medium",
    heavy_rain: "high",
    fog: "medium",
    snow: "high",
    dusk: "low",
    night: "low",
  });

export const NITRO_WEATHER_MULTIPLIER: Readonly<Record<NitroWeatherRisk, number>> =
  Object.freeze({
    low: 1.0,
    medium: 1.4,
    high: 1.9,
  });

export const NITRO_SURFACE_MULTIPLIER: Readonly<Record<Surface, number>> =
  Object.freeze({
    road: 1.0,
    rumble: 1.25,
    grass: 1.6,
  });

export const NITRO_DAMAGE_BAND_MULTIPLIER: Readonly<Record<DamageBand, number>> =
  Object.freeze({
    pristine: 1.0,
    light: 1.05,
    moderate: 1.25,
    severe: 1.6,
    catastrophic: 2.0,
  });

/**
 * Defensive ceiling on the instability multiplier. The worst-case raw
 * product of the three axes is `1.9 * 1.6 * 2.0 = 6.08`; this cap of
 * `8` adds headroom for future balancing without letting a runaway
 * multiplier produce unrecoverable spins.
 */
export const INSTABILITY_MULTIPLIER_MAX = 8;

/**
 * Compute the instability multiplier the future traction-loss slice
 * multiplies against its base spin probability.
 *
 * Returns `1.0` (identity, no instability boost) when the nitro is
 * not currently active, so the caller can blindly multiply by the
 * result without first checking the burning state.
 *
 * When the nitro is active, returns
 * `NITRO_WEATHER_MULTIPLIER[risk] * NITRO_SURFACE_MULTIPLIER[surface]
 * * NITRO_DAMAGE_BAND_MULTIPLIER[damageBand]`, clamped into
 * `[1, INSTABILITY_MULTIPLIER_MAX]`.
 *
 * Pure: no globals, no RNG. Same inputs produce deep-equal outputs.
 * Out-of-range damageBand or surface inputs default to the safest
 * (lowest-multiplier) bucket so a stale state cannot accidentally
 * trip the worst-case spin.
 */
export function getInstabilityMultiplier(
  state: Readonly<NitroState>,
  surface: Surface,
  weather: WeatherOption,
  damageBand: DamageBand,
): number {
  if (state.activeRemainingSec <= 0) return 1;
  const risk = NITRO_WEATHER_RISK[weather] ?? "low";
  const wMul = NITRO_WEATHER_MULTIPLIER[risk] ?? 1;
  const sMul = NITRO_SURFACE_MULTIPLIER[surface] ?? 1;
  const dMul = NITRO_DAMAGE_BAND_MULTIPLIER[damageBand] ?? 1;
  return clampNumber(wMul * sMul * dMul, 1, INSTABILITY_MULTIPLIER_MAX);
}

// Race-start helpers ------------------------------------------------------

/**
 * Build a fresh nitro state for the start of a race using the player's
 * car stats and installed upgrades. Convenience wrapper over
 * `createNitroState` + `nitroUpgradeTierForUpgrades`. The race session
 * calls this when constructing the player's runtime state.
 *
 * The car's `nitroEfficiency` stat does not change the *number* of
 * charges; it scales the per-charge thrust at burn time
 * (`getNitroAccelMultiplier`).
 */
export function createNitroForCar(
  _stats: Readonly<CarBaseStats>,
  upgrades?: Partial<Record<UpgradeCategory, number>> | null,
): NitroState {
  const tier = nitroUpgradeTierForUpgrades(upgrades);
  const charges = clampInt(
    DEFAULT_NITRO_CHARGES + tier.chargesBonus,
    0,
    ABSOLUTE_MAX_CHARGES,
  );
  return Object.freeze({ charges, activeRemainingSec: 0 });
}

// Internal helpers --------------------------------------------------------

function sanitiseState(state: Readonly<NitroState>): NitroState {
  const charges = clampInt(state.charges, 0, ABSOLUTE_MAX_CHARGES);
  const remaining = clampNumber(state.activeRemainingSec, 0, Number.POSITIVE_INFINITY);
  return { charges, activeRemainingSec: remaining };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const truncated = Math.trunc(value);
  if (truncated < min) return min;
  if (truncated > max) return max;
  return truncated;
}
