/**
 * Manual / automatic transmission state machine per
 * `docs/gdd/10-driving-model-and-physics.md` ("Gear shifting") and
 * `docs/gdd/19-controls-and-input.md` (E / Q for keyboard, RB / LB for
 * gamepad).
 *
 * Design summary from §10 "Gear shifting":
 *
 *   - Automatic transmission is default.
 *   - Manual shifting is optional.
 *   - Gearbox upgrades increase effective top-speed ceiling and torque
 *     smoothness.
 *   - Manual transmission gains a small, not dominant, expert advantage.
 *
 * Stock gearboxes have five gears; the §12 gearbox upgrade ladder unlocks
 * sixth at Sport and seventh at Extreme. The original Top Gear 2 guide
 * staged extra gears through gearbox upgrades [17]; VibeGear2 keeps that
 * cadence while leaving the transmission mode itself behind a Settings
 * toggle.
 *
 * This module is the pure state machine: input goes in, next state comes
 * out, no globals, no time source, no RNG (AGENTS.md RULE 8). The physics
 * step can read `gearAccelMultiplier(state)` to scale its throttle-driven
 * acceleration with a torque curve that peaks in the middle of each gear's
 * RPM band, falls off at low RPM, and tapers above 0.95 RPM as a redline
 * limiter penalty. The shape is deliberately mild: the §10 "small expert
 * advantage" budget is well under five percent, so a confident manual
 * driver out-accelerates auto by a hair, never enough to dominate.
 *
 * Reverse gear is out of scope (covered by physics reverse-from-stop in a
 * later slice). The state's `gear` field is always >= 1 and <= the max gear
 * for the current gearbox upgrade.
 */

import type { CarBaseStats, UpgradeCategory } from "@/data/schemas";

/**
 * Operating mode. `auto` is the §10 default; `manual` is the optional
 * expert mode the player toggles in /options.
 */
export type TransmissionMode = "auto" | "manual";

/**
 * Per-tick transmission snapshot. Shape is intentionally minimal so future
 * slices (gear-shift SFX, HUD widget, replay capture) can extend it
 * additively.
 *
 * `gear` is 1-indexed and capped at the max gear unlocked by the current
 * gearbox upgrade tier (see `maxGearForGearboxUpgrade`).
 *
 * `rpm` is normalised into `[0, 1]`. `0` is idle; `0.85` is the auto-shift
 * upshift threshold; `0.95` is the redline soft-limit point; `1.0` is the
 * absolute ceiling. The state machine clamps writes into the band so a
 * buggy upstream caller cannot poison the value.
 */
export interface TransmissionState {
  mode: TransmissionMode;
  gear: number;
  rpm: number;
}

/**
 * Initial state for a fresh race start: auto mode, first gear, idle RPM.
 * Frozen so consumers cannot accidentally mutate the constant.
 */
export const INITIAL_TRANSMISSION_STATE: Readonly<TransmissionState> = Object.freeze({
  mode: "auto",
  gear: 1,
  rpm: 0,
});

// Tunable constants --------------------------------------------------------

/**
 * Auto upshift threshold. When `rpm` rises past this in auto mode, the
 * gearbox shifts up one gear (if a higher gear is available).
 */
export const AUTO_UPSHIFT_RPM = 0.85;

/**
 * Auto downshift threshold. When `rpm` falls below this in auto mode, the
 * gearbox shifts down one gear (if a lower gear is available).
 */
export const AUTO_DOWNSHIFT_RPM = 0.4;

/**
 * Redline soft-limit point. RPM is allowed to rise past this into the
 * redline band, but a small accel penalty is applied (see
 * `gearAccelMultiplier`). The hard ceiling is 1.0.
 */
export const REDLINE_SOFT_LIMIT_RPM = 0.95;

/**
 * Hard RPM ceiling. Writes to `rpm` clamp at this value so a buggy
 * upstream caller cannot push the transmission into a non-physical state.
 */
export const REDLINE_HARD_LIMIT_RPM = 1.0;

/**
 * Manual mode's expert-advantage envelope. The torque curve peak is set
 * just above 1.0 in manual mode so an optimally-shifted manual driver out
 * accelerates auto by this fraction at peak RPM. §10 "small, not dominant"
 * budget; the dot pins it under 5%.
 */
export const MANUAL_PEAK_TORQUE_MULTIPLIER = 1.04;

/**
 * Auto mode's torque-curve peak. Pinned at 1.0 so the existing `accel`
 * stat continues to be the reference unit; manual mode is the one that
 * earns a small bump for nailing the optimal shift point.
 */
export const AUTO_PEAK_TORQUE_MULTIPLIER = 1.0;

/**
 * Penalty applied above the redline soft limit. Multiplies the post-curve
 * acceleration; the band 0.95..1.0 RPM scales the penalty linearly from
 * `1.0` (no penalty at exactly 0.95) down to this value (full penalty at
 * 1.0). Pinned to 0.85 so a rev-limiter feel is noticeable without being
 * crippling.
 */
export const REDLINE_PENALTY_MULTIPLIER = 0.85;

/**
 * RPM at the bottom of each gear's torque curve. Below this point the
 * gearbox is "lugging" and the multiplier is at its floor; above it the
 * curve ramps up to the gear's peak.
 */
export const TORQUE_CURVE_BOTTOM_RPM = 0.15;

/**
 * Floor of the torque curve. At RPM <= bottom the multiplier is this
 * value; the curve interpolates upward to the gear's peak between bottom
 * and the redline soft limit. 0.55 keeps a lugged gearbox sluggish but not
 * stalled, which matches the §10 "torque smoothness" feel target without
 * letting a wrong-gear driver coast.
 */
export const TORQUE_CURVE_FLOOR = 0.55;

// Gearbox upgrade -> max gear ---------------------------------------------

/**
 * Gearbox upgrade tier index. Mirrors the §12 ladder: 0 = Stock, 1 =
 * Street, 2 = Sport, 3 = Factory, 4 = Extreme. Out-of-range values clamp.
 *
 * Mapping (from the dot's verify list):
 *
 *   - Stock   (0): 5 gears
 *   - Street  (1): 5 gears
 *   - Sport   (2): 6 gears
 *   - Factory (3): 6 gears
 *   - Extreme (4): 7 gears
 */
export const MAX_GEAR_BY_GEARBOX_UPGRADE: ReadonlyArray<number> = Object.freeze([
  5, // Stock
  5, // Street
  6, // Sport
  6, // Factory
  7, // Extreme
]);

/**
 * Stock gear count. Returned when the gearbox upgrade tier is missing or
 * negative, and used by the default transmission context.
 */
export const STOCK_MAX_GEAR = 5;

/**
 * Highest supported gear count. The catastrophic ceiling: even if a future
 * tweak pushes the upgrade table past 7 gears, the state machine clamps
 * here so renderer and HUD widgets can size their gear-indicator strings.
 */
export const ABSOLUTE_MAX_GEAR = 7;

/**
 * Resolve the max gear for the player's current gearbox upgrade tier.
 * Out-of-range inputs (NaN, negatives, fractional, > 4) clamp into the
 * table; the result is always in `[STOCK_MAX_GEAR, ABSOLUTE_MAX_GEAR]`.
 */
export function maxGearForGearboxUpgrade(tier: number): number {
  if (!Number.isFinite(tier)) return STOCK_MAX_GEAR;
  const idx = Math.max(0, Math.min(MAX_GEAR_BY_GEARBOX_UPGRADE.length - 1, Math.floor(tier)));
  const value = MAX_GEAR_BY_GEARBOX_UPGRADE[idx];
  return value ?? STOCK_MAX_GEAR;
}

/**
 * Convenience for callers who already have an `installedUpgrades` object
 * on hand. Reads the `gearbox` field and forwards to
 * `maxGearForGearboxUpgrade`. Defaults to `STOCK_MAX_GEAR` when the field
 * is missing.
 */
export function maxGearForUpgrades(upgrades: Partial<Record<UpgradeCategory, number>> | null | undefined): number {
  if (!upgrades) return STOCK_MAX_GEAR;
  const tier = upgrades.gearbox;
  if (typeof tier !== "number") return STOCK_MAX_GEAR;
  return maxGearForGearboxUpgrade(tier);
}

// Step --------------------------------------------------------------------

/**
 * Per-tick context the state machine needs from the rest of the sim.
 *
 * `throttle` and `brake` mirror the canonical `Input` ranges (`[0, 1]`).
 * `shiftUp` / `shiftDown` are edge-triggered booleans: the caller is
 * responsible for debouncing them so a single button press only reads as
 * `true` for the tick the press happens. The state machine does not own
 * the edge detection because the `Input` shape itself does not expose
 * "just pressed" vs "held" today; the race session debounces.
 *
 * `speed` is the car's forward speed in m/s. The state machine converts
 * speed into RPM via the gear's RPM range; faster speed at the same gear
 * means higher RPM.
 *
 * `topSpeed` is the car's `baseStats.topSpeed`. The RPM normalisation
 * uses this to decide what "max RPM in top gear" means.
 *
 * `maxGear` caps the upper end. Defaults to `STOCK_MAX_GEAR` if omitted.
 */
export interface TransmissionStepContext {
  throttle: number;
  brake: number;
  shiftUp: boolean;
  shiftDown: boolean;
  speed: number;
  topSpeed: number;
  maxGear?: number;
}

/**
 * Default context with neutral inputs; useful as a starting fixture for
 * tests and for the initial frame before any input arrives.
 */
export const DEFAULT_TRANSMISSION_CONTEXT: Readonly<TransmissionStepContext> = Object.freeze({
  throttle: 0,
  brake: 0,
  shiftUp: false,
  shiftDown: false,
  speed: 0,
  topSpeed: 1,
  maxGear: STOCK_MAX_GEAR,
});

/**
 * Compute the per-gear speed band edges. Gear `g` covers
 * `[(g-1) / maxGear, g / maxGear] * topSpeed` of the speed range; RPM
 * within a gear is `(speed - bandLow) / (bandHigh - bandLow)`, clamped to
 * `[0, 1]`.
 *
 * This is a deliberately simple linear band split. The §10 spec leaves the
 * exact gear ratios to balancing; the linear split keeps the state machine
 * reviewable while still producing the qualitative "RPM rises within a
 * gear, falls when you upshift" feel the player expects.
 */
export function rpmForSpeedAndGear(
  speed: number,
  gear: number,
  topSpeed: number,
  maxGear: number,
): number {
  if (maxGear < 1 || topSpeed <= 0) return 0;
  const safeGear = clampInt(gear, 1, maxGear);
  const bandLow = ((safeGear - 1) / maxGear) * topSpeed;
  const bandHigh = (safeGear / maxGear) * topSpeed;
  const span = bandHigh - bandLow;
  if (span <= 0) return 0;
  const raw = (speed - bandLow) / span;
  return clampNumber(raw, 0, REDLINE_HARD_LIMIT_RPM);
}

/**
 * Reducer: advance the transmission state by one tick. Pure: the input
 * `state` is never mutated; a fresh object is always returned.
 *
 * Behaviour summary:
 *
 *   - Mode is preserved across ticks; this reducer never toggles mode.
 *     The Settings UI owns the toggle and writes through to the persisted
 *     `transmissionMode` field on `SaveGameSettings`.
 *   - In `auto` mode, `shiftUp` / `shiftDown` inputs are ignored (per the
 *     dot's edge case: shift inputs do not toggle to manual). Auto upshift
 *     fires when `rpm > AUTO_UPSHIFT_RPM` and a higher gear exists; auto
 *     downshift fires when `rpm < AUTO_DOWNSHIFT_RPM` and a lower gear
 *     exists. Auto downshift also fires unconditionally when the brake is
 *     pressed and we are above first gear (matches the §10 "downshift on
 *     brake" expectation).
 *   - In `manual` mode, `shiftUp` advances by one gear if a higher gear
 *     exists; otherwise it is ignored (the dot's "limit SFX hook" lives in
 *     the SFX slice, not here). `shiftDown` symmetrically.
 *   - RPM is recomputed from the post-shift gear and the new speed every
 *     tick. The state machine never holds a stale RPM across a shift.
 *   - RPM clamps to `[0, REDLINE_HARD_LIMIT_RPM]` so a stale or buggy
 *     speed cannot push the field out of band.
 */
export function stepTransmission(
  state: Readonly<TransmissionState>,
  ctx: Readonly<TransmissionStepContext>,
): TransmissionState {
  const maxGear = clampInt(ctx.maxGear ?? STOCK_MAX_GEAR, 1, ABSOLUTE_MAX_GEAR);
  let nextGear = clampInt(state.gear, 1, maxGear);

  // Apply shift inputs first so the post-shift RPM reflects the new gear.
  if (state.mode === "manual") {
    if (ctx.shiftUp && nextGear < maxGear) {
      nextGear += 1;
    }
    if (ctx.shiftDown && nextGear > 1) {
      nextGear -= 1;
    }
  } else {
    // Auto: apply auto upshift / downshift based on the prior tick's RPM
    // (computed from the prior gear). Shift inputs are intentionally
    // ignored so the player cannot accidentally interact with the gearbox
    // while in auto mode (the dot's edge case).
    const priorRpm = rpmForSpeedAndGear(ctx.speed, state.gear, ctx.topSpeed, maxGear);
    const brakingFromHighGear = ctx.brake > 0 && nextGear > 1;
    if (priorRpm > AUTO_UPSHIFT_RPM && nextGear < maxGear) {
      nextGear += 1;
    } else if (
      (priorRpm < AUTO_DOWNSHIFT_RPM || brakingFromHighGear) &&
      nextGear > 1
    ) {
      nextGear -= 1;
    }
  }

  const nextRpm = rpmForSpeedAndGear(ctx.speed, nextGear, ctx.topSpeed, maxGear);

  return {
    mode: state.mode,
    gear: nextGear,
    rpm: nextRpm,
  };
}

/**
 * Compute the per-tick acceleration multiplier from the current
 * transmission state. Multiply this against the throttle-driven
 * acceleration in `physics.step()` to model the torque curve.
 *
 * Curve shape:
 *
 *   - `rpm <= TORQUE_CURVE_BOTTOM_RPM`: floor. The car is lugging.
 *   - `TORQUE_CURVE_BOTTOM_RPM..REDLINE_SOFT_LIMIT_RPM`: linear ramp from
 *     `TORQUE_CURVE_FLOOR` to the gear's peak.
 *   - `REDLINE_SOFT_LIMIT_RPM..REDLINE_HARD_LIMIT_RPM`: redline penalty
 *     band. Multiplier interpolates from `peak` to
 *     `peak * REDLINE_PENALTY_MULTIPLIER`.
 *   - Above `REDLINE_HARD_LIMIT_RPM`: pinned at the penalty value.
 *
 * Mode picks the peak: `manual` sits at `MANUAL_PEAK_TORQUE_MULTIPLIER`
 * and `auto` at `AUTO_PEAK_TORQUE_MULTIPLIER`. The gap is the §10 "small
 * expert advantage" budget; under 5% by design.
 *
 * Pure. No globals, no RNG. Out-of-range RPM clamps into
 * `[0, REDLINE_HARD_LIMIT_RPM]` defensively.
 */
export function gearAccelMultiplier(state: Readonly<TransmissionState>): number {
  const peak =
    state.mode === "manual"
      ? MANUAL_PEAK_TORQUE_MULTIPLIER
      : AUTO_PEAK_TORQUE_MULTIPLIER;
  const rpm = clampNumber(state.rpm, 0, REDLINE_HARD_LIMIT_RPM);

  if (rpm <= TORQUE_CURVE_BOTTOM_RPM) {
    return TORQUE_CURVE_FLOOR;
  }
  if (rpm <= REDLINE_SOFT_LIMIT_RPM) {
    const span = REDLINE_SOFT_LIMIT_RPM - TORQUE_CURVE_BOTTOM_RPM;
    const t = (rpm - TORQUE_CURVE_BOTTOM_RPM) / span;
    return TORQUE_CURVE_FLOOR + (peak - TORQUE_CURVE_FLOOR) * t;
  }
  // Redline soft limit: linear taper toward `peak * penalty`.
  const span = REDLINE_HARD_LIMIT_RPM - REDLINE_SOFT_LIMIT_RPM;
  const t = (rpm - REDLINE_SOFT_LIMIT_RPM) / span;
  const penalty = peak * REDLINE_PENALTY_MULTIPLIER;
  return peak + (penalty - peak) * t;
}

// Per-car constructor ------------------------------------------------------

/**
 * Options consumed by `createTransmissionForCar` to seed a per-race
 * transmission snapshot. Mirrors the pattern used by
 * `createNitroForCar`: the function reads the per-player settings (mode)
 * plus the active car's installed upgrades (gearbox tier) so the race
 * session does not have to spread the resolution logic across multiple
 * call sites.
 */
export interface CreateTransmissionOptions {
  /**
   * Player-facing mode from `SaveGameSettings.transmissionMode`. When
   * omitted the §10 default of `"auto"` applies, which matches the way
   * loaders treat a missing field on legacy saves (`v1` did not carry
   * the field; the schema marks it optional).
   */
  mode?: TransmissionMode | null | undefined;
  /**
   * Installed upgrade tiers for the car. Read for the `gearbox` field
   * only; other categories are ignored. Defaults to no upgrades when
   * omitted, which yields the stock five-gear box.
   */
  upgrades?: Partial<Record<UpgradeCategory, number>> | null | undefined;
}

/**
 * Build the per-race initial transmission state for a car. Reads the
 * player-facing mode (auto / manual) plus the car's installed gearbox
 * upgrade tier so the per-race state machine starts with the right gear
 * count and the right reducer branch wired up from tick zero.
 *
 * AI cars never opt into manual: callers should either omit `mode` or
 * pass `"auto"` for AI snapshots so a future archetype that flips into
 * manual must do so explicitly. The returned state always starts at
 * `gear = 1, rpm = 0` (idle on the grid); the maximum gear pinned by
 * the gearbox upgrade is enforced by `stepTransmission` once the race
 * begins integrating ticks.
 *
 * `stats` is accepted for shape parity with `createNitroForCar` so the
 * race session can pass per-car bundles uniformly. The current pure
 * state machine does not consume any field on `stats`; future tuning
 * (per-car gear ratio overrides, redline shift) can layer on without a
 * call-site refactor.
 *
 * Result is frozen so a caller cannot mutate the constant; the per-tick
 * reducer always returns a fresh object so the freeze is non-load-bearing
 * inside the sim, but it defends against React renders accidentally
 * sharing the snapshot across components.
 */
export function createTransmissionForCar(
  _stats: Readonly<CarBaseStats>,
  options: Readonly<CreateTransmissionOptions> = {},
): TransmissionState {
  const mode: TransmissionMode = options.mode === "manual" ? "manual" : "auto";
  // The max-gear value is consumed by `stepTransmission`'s clamp; we do
  // not store it on the state shape because the rest of the codebase
  // already plumbs the installed-upgrades object through to the per-tick
  // context. Instead, we make sure the seeded `gear` value cannot be out
  // of band even if a future tweak adds gear seeding.
  const maxGear = maxGearForUpgrades(options.upgrades);
  const gear = Math.max(1, Math.min(1, maxGear)); // always 1 in the v1 slice
  return Object.freeze({ mode, gear, rpm: 0 });
}

/**
 * Race-session-friendly alias for `stepTransmission`. The pattern across
 * the runtime core is `tickX(state, ctx, dt)`; this name lets the race
 * session call the reducer alongside `tickNitro`, `tickAI`, and
 * `tickDraftWindow` without a one-off rename. The semantics are
 * identical: the reducer is pure, never mutates its input, and ignores
 * the `dt` parameter on the surface but maintains the call-shape so a
 * future RPM-decay-over-time tweak (currently RPM is a derived value
 * computed from gear + speed) can introduce dt without a call-site
 * refactor.
 */
export function tickTransmission(
  state: Readonly<TransmissionState>,
  ctx: Readonly<TransmissionStepContext>,
  _dt?: number,
): TransmissionState {
  return stepTransmission(state, ctx);
}

// Helpers ------------------------------------------------------------------

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
