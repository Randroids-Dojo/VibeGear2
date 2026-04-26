/**
 * Damage band performance scaling per
 * `docs/gdd/10-driving-model-and-physics.md` ("Damage effects on
 * performance") and `docs/gdd/13-damage-repairs-and-risk.md`.
 *
 * The §10 table reads:
 *
 *   |   Band   | Effect                                                           |
 *   | -------- | ---------------------------------------------------------------- |
 *   | 0 to 24  | Cosmetic sparks and panel vibration only                         |
 *   | 25 to 49 | Slight stability decay, mild nitro inefficiency                  |
 *   | 50 to 74 | More severe wobble, reduced grip, reduced top speed              |
 *   | 75 to 99 | Frequent instability, heavy power loss, high spin risk           |
 *   |   100    | Catastrophic state, either limp mode or retire                   |
 *
 * `damage.ts` owns the per-zone state machine (hits in, weighted total
 * out). This module is the pure math layer that maps a single `damage%`
 * scalar (typically `state.total * 100`) to the multipliers physics
 * consumes each tick. The split keeps `damage.ts` free of physics-shaped
 * tuning knobs and keeps `physics.ts` free of damage-state plumbing.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals. Identical
 * inputs return deep-equal outputs. The function is total over the real
 * line: out-of-range inputs (NaN, < 0, > 100) clamp into `[0, 100]` and
 * never throw, so a stale damage value cannot crash physics.
 *
 * Boundary rule (pinned by the dot's edge case): bands are inclusive at
 * the lower bound. `25.000` lives in the `25..49` band, not the `0..24`
 * band. The implementation uses `damage >= bandLowerBound` for each
 * band check from highest to lowest, which encodes the same rule.
 */

/**
 * Multipliers physics applies each tick. All scalars in `[0, 1]` except
 * `spinRiskMultiplier`, which is a `[0, +inf)` factor a future
 * traction-loss slice can multiply against its base spin probability.
 *
 * - `stability` scales the §10 stability stat (lower = more wobble).
 * - `gripScalar` scales the §10 grip stat (lower = less cornering bite).
 * - `topSpeedScalar` scales the §10 top-speed cap (lower = limp).
 * - `nitroEfficiency` scales the per-charge nitro effect (lower = a tap
 *   covers less ground or a hold drains faster, depending on how the
 *   nitro slice consumes it).
 * - `spinRiskMultiplier` is a probabilistic risk knob the future
 *   traction-loss slice multiplies against its base spin probability. At
 *   1.0 the car has its baseline spin risk; at 4.0 (the catastrophic
 *   band's pinned ceiling) the risk is four times higher.
 */
export interface DamageScalars {
  stability: number;
  gripScalar: number;
  topSpeedScalar: number;
  nitroEfficiency: number;
  spinRiskMultiplier: number;
}

/**
 * Pristine-band scalars: the reference identity. `getDamageScalars(0)`
 * returns deep-equal-to this. Exported so callers (physics, HUD) can
 * cheaply check "are we at the no-penalty band?" without a deep
 * comparison or a magic-number reconstruction.
 */
export const PRISTINE_SCALARS: Readonly<DamageScalars> = Object.freeze({
  stability: 1,
  gripScalar: 1,
  topSpeedScalar: 1,
  nitroEfficiency: 1,
  spinRiskMultiplier: 1,
});

/**
 * Per-band scalar table, mirroring the §10 narrative one row per band.
 * The entries are ordered from lowest to highest band; the lookup walks
 * from the highest band downward and picks the first whose `min`
 * threshold is at most the clamped damage value.
 *
 * Numeric pins:
 *
 * - 0..24 (cosmetic): all scalars at 1.0 / 1.0. The narrative says
 *   "cosmetic sparks and panel vibration only", so physics is unchanged.
 * - 25..49 (slight stability, mild nitro): stability drops to 0.92,
 *   nitroEfficiency to 0.9. The §10 text calls these out explicitly and
 *   pins nothing else.
 * - 50..74 (severe wobble, reduced grip, reduced top speed): stability
 *   0.8, gripScalar 0.85, topSpeedScalar 0.92, nitroEfficiency 0.8,
 *   spinRiskMultiplier 1.5. First band that touches grip and top speed.
 * - 75..99 (frequent instability, heavy power loss, high spin risk):
 *   stability 0.6, gripScalar 0.7, topSpeedScalar 0.78,
 *   nitroEfficiency 0.6, spinRiskMultiplier 2.5. "Heavy" power loss
 *   maps to a topSpeedScalar that is meaningfully below the prior band.
 * - 100 (catastrophic): stability 0.45, gripScalar 0.55,
 *   topSpeedScalar 0.55, nitroEfficiency 0.4, spinRiskMultiplier 4.0
 *   (the pinned ceiling, see `MAX_SPIN_RISK_MULTIPLIER`). The §10
 *   "limp mode or retire" decision is owned by the damage state machine,
 *   not this lookup; this band only describes the limp side. The race
 *   rules engine reads `damage.isWrecked()` to flip the car to DNF.
 *
 * A future balancing pass owns the final values; pinning them in one
 * frozen table keeps the math reviewable.
 */
export const DAMAGE_BANDS: ReadonlyArray<
  Readonly<{ min: number; scalars: Readonly<DamageScalars> }>
> = Object.freeze([
  Object.freeze({
    min: 0,
    scalars: Object.freeze({
      stability: 1,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 1,
      spinRiskMultiplier: 1,
    }),
  }),
  Object.freeze({
    min: 25,
    scalars: Object.freeze({
      stability: 0.92,
      gripScalar: 1,
      topSpeedScalar: 1,
      nitroEfficiency: 0.9,
      spinRiskMultiplier: 1,
    }),
  }),
  Object.freeze({
    min: 50,
    scalars: Object.freeze({
      stability: 0.8,
      gripScalar: 0.85,
      topSpeedScalar: 0.92,
      nitroEfficiency: 0.8,
      spinRiskMultiplier: 1.5,
    }),
  }),
  Object.freeze({
    min: 75,
    scalars: Object.freeze({
      stability: 0.6,
      gripScalar: 0.7,
      topSpeedScalar: 0.78,
      nitroEfficiency: 0.6,
      spinRiskMultiplier: 2.5,
    }),
  }),
  Object.freeze({
    min: 100,
    scalars: Object.freeze({
      stability: 0.45,
      gripScalar: 0.55,
      topSpeedScalar: 0.55,
      nitroEfficiency: 0.4,
      spinRiskMultiplier: 4,
    }),
  }),
]);

/**
 * Spin-risk ceiling. Even at the catastrophic band the multiplier is
 * pinned here so a future tweak to the table cannot accidentally turn
 * the catastrophic band into "instant spin every tick". Exported so the
 * future traction-loss slice can clamp its own consumer side as a
 * defence-in-depth check.
 */
export const MAX_SPIN_RISK_MULTIPLIER = 4;

/**
 * Identifier for the band a given damage value falls into. Useful for
 * HUD widgets that want to render a discrete state (e.g. a coloured
 * damage gauge) without re-deriving the band from the scalars.
 *
 * `pristine` covers 0..24, `light` covers 25..49, `moderate` covers
 * 50..74, `severe` covers 75..99, `catastrophic` covers exactly 100
 * (and any clamped value past 100).
 */
export type DamageBand = "pristine" | "light" | "moderate" | "severe" | "catastrophic";

/**
 * Resolve the named band for a damage percent. Same boundary rule as
 * `getDamageScalars`: `>= 25` is `light`, `>= 50` is `moderate`, etc.
 * Out-of-range values clamp into `[0, 100]`.
 */
export function getDamageBand(damagePercent: number): DamageBand {
  const clamped = clampPercent(damagePercent);
  if (clamped >= 100) return "catastrophic";
  if (clamped >= 75) return "severe";
  if (clamped >= 50) return "moderate";
  if (clamped >= 25) return "light";
  return "pristine";
}

/**
 * Map a `[0, 100]` damage percent to the per-tick `DamageScalars` the
 * physics step consumes. Pure: identical input always returns the same
 * value (deep-equal across calls).
 *
 * Out-of-range and non-finite inputs clamp into `[0, 100]`. The
 * returned object is a fresh, frozen scalar set; mutating it does not
 * affect the table or future calls.
 *
 * Implementation note: the lookup walks `DAMAGE_BANDS` from highest to
 * lowest `min` so the first hit is the band the value belongs to under
 * the inclusive-lower-bound rule.
 */
export function getDamageScalars(damagePercent: number): DamageScalars {
  const clamped = clampPercent(damagePercent);
  for (let i = DAMAGE_BANDS.length - 1; i >= 0; i -= 1) {
    const band = DAMAGE_BANDS[i];
    if (band !== undefined && clamped >= band.min) {
      return cloneScalars(band.scalars);
    }
  }
  // Unreachable: the 0-band's `min` is 0 and `clamped >= 0` always holds
  // after `clampPercent`. Fall back to pristine for total safety.
  return cloneScalars(PRISTINE_SCALARS);
}

// Internal helpers ---------------------------------------------------------

function clampPercent(value: number): number {
  // NaN clamps to 0 (the safest default for a stale damage value that
  // turned into NaN somewhere upstream); +/-Infinity clamps to the
  // appropriate end of the band.
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function cloneScalars(scalars: Readonly<DamageScalars>): DamageScalars {
  return {
    stability: scalars.stability,
    gripScalar: scalars.gripScalar,
    topSpeedScalar: scalars.topSpeedScalar,
    nitroEfficiency: scalars.nitroEfficiency,
    spinRiskMultiplier: scalars.spinRiskMultiplier,
  };
}
