/**
 * Damage model per `docs/gdd/13-damage-repairs-and-risk.md` and the §23
 * "Damage formula targets" table.
 *
 * The module is a small set of pure helpers built around an immutable
 * `DamageState` value. It owns:
 *
 * - Hit accumulation: `applyHit(state, hit)` returns a fresh state with
 *   per-zone (`engine`, `tires`, `body`) damage incremented by the §23
 *   ranges, weighted by the per-kind zone distribution and the caller's
 *   `speedFactor`. Per-zone values clamp to `[0, 1]`; over-clamp does not
 *   bleed into other zones (verify item 2).
 * - Performance penalty: `performanceMultiplier(zone, damage)` returns a
 *   linear falloff from `1.0` at zero damage to a per-zone floor at 1.0.
 *   Engine and tires degrade performance; body damage does not directly
 *   alter handling (it only feeds the wreck threshold). The §13 narrative
 *   "engine damage reduces top speed and weaker nitro; side damage adds
 *   rubbing" maps to engine.topSpeed and tires.grip respectively.
 * - Wreck threshold: `isWrecked(state)` is the boolean DNF gate; the
 *   weighted `total` (engine 0.45, body 0.35, tires 0.20) trips at
 *   `WRECK_THRESHOLD = 0.95` so the HUD has a small warning band before
 *   the race-rules engine flips the car to `dnf`.
 * - Off-road persistent damage: `applyOffRoadDamage(state, speed, dt)`
 *   handles the F-015 hand-off. The race session calls this each tick the
 *   player is off-road; nothing in `physics.ts` needs to know about damage.
 * - Repair cost: `repairCostFor(zone, damageFraction)` returns a credit
 *   cost using the per-zone base price. Zero damage returns zero (verify
 *   item: "no UI prompt when undamaged").
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals. Identical
 * inputs return deep-equal outputs (AGENTS.md RULE 8).
 *
 * Open question pinned by the iter-19 stress-test: the §23 ranges (e.g.
 * `rubDamage = 2 to 4`) are not yet picked from a deterministic per-race
 * RNG. Until the seeded-RNG slice lands, the caller (race session) chooses
 * a `baseMagnitude` deterministically. This module does not consume a PRNG
 * itself; a future slice may add a `chooseHitMagnitude(seed, kind)` helper
 * here without touching the public surface below.
 *
 * §28 difficulty wiring: both `applyHit` and `applyOffRoadDamage` accept
 * an optional `assistScalars` parameter that scales the contact-event
 * total by `damageSeverity` (an Easy preset reads `0.75` so a wall hit
 * counts for less; Hard / Master read `> 1.0` so the same hit eats more
 * of the per-zone budget). Omitting the parameter preserves the unscaled
 * pre-binding behaviour exactly. The race session resolves the preset
 * once at session creation and threads the same frozen reference through
 * every per-tick damage call.
 */

import type { AssistScalars } from "./difficultyPresets";

/** Damage zone identifiers per §13 "Damage visualization" / "Mechanical effects". */
export type DamageZone = "engine" | "tires" | "body";

/** Hit-event categories, lifted from §23 "Damage formula targets" plus
 * the off-road persistent path that F-015 owns. */
export type HitKind = "rub" | "carHit" | "wallHit" | "offRoadObject" | "offRoadPersistent";

/**
 * Per-zone damage accumulator and the running weighted total. Sibling of
 * `CarState` (not embedded) so the kinematic step in `physics.ts` does
 * not have to know about damage. `raceSession.ts` owns the per-car damage
 * map and feeds it back into the physics call site as a stat multiplier.
 *
 * `total` is a derived field maintained on every transition so callers
 * (HUD, race-rules) can read a single scalar without recomputing the
 * weighted sum. It always equals `weightedTotal(zones)` after any
 * function in this module returns; tests assert that invariant.
 *
 * `offRoadAccumSeconds` exists so the off-road damage path can rate-limit
 * the body increment to roughly the §13 narrative ("increase damage
 * slightly if the player persists off-road at high speed") rather than
 * trip on a single-frame off-road excursion.
 */
export interface DamageState {
  zones: Readonly<Record<DamageZone, number>>;
  total: number;
  offRoadAccumSeconds: number;
}

/** Pristine (no damage) state. Frozen so callers cannot mutate it. */
export const PRISTINE_DAMAGE_STATE: Readonly<DamageState> = Object.freeze({
  zones: Object.freeze({ engine: 0, tires: 0, body: 0 }) as Readonly<
    Record<DamageZone, number>
  >,
  total: 0,
  offRoadAccumSeconds: 0,
});

/**
 * Hit event the race session passes to `applyHit`. Pure data; the caller
 * picks `baseMagnitude` from the §23 range and `speedFactor` from the
 * follower speed (typically `speed / topSpeed`, clamped to `[0, 1]`).
 *
 * `zoneOverride` lets a caller bias the distribution for a specific
 * encounter. A wall hit on the front bumper might pass
 * `{ engine: 0.5, body: 0.5 }` for example; absent the override the
 * `DEFAULT_ZONE_DISTRIBUTION` table below is used.
 */
export interface HitEvent {
  kind: HitKind;
  /** §23 magnitude before zone weights and speed scaling. Caller-supplied. */
  baseMagnitude: number;
  /** `[0, 1]` scalar; high-speed hits are worse. Clamped on entry. */
  speedFactor: number;
  /** Optional per-event zone bias; defaults to `DEFAULT_ZONE_DISTRIBUTION[kind]`. */
  zoneOverride?: Partial<Readonly<Record<DamageZone, number>>>;
}

/**
 * Default per-kind zone distribution. Sums to 1.0 per row so a hit's
 * total damage equals `baseMagnitude * speedFactor / DAMAGE_UNIT_SCALE`
 * regardless of how it splits across zones. Pinned by the iter-19
 * stress-test (§4 "Default zone distribution"). Balancing pass owns the
 * final values; a future Q-NNN may revise them.
 */
export const DEFAULT_ZONE_DISTRIBUTION: Readonly<Record<HitKind, Readonly<Record<DamageZone, number>>>> =
  Object.freeze({
    rub: Object.freeze({ engine: 0.05, tires: 0.5, body: 0.45 }),
    carHit: Object.freeze({ engine: 0.2, tires: 0.3, body: 0.5 }),
    wallHit: Object.freeze({ engine: 0.3, tires: 0.2, body: 0.5 }),
    offRoadObject: Object.freeze({ engine: 0.25, tires: 0.4, body: 0.35 }),
    offRoadPersistent: Object.freeze({ engine: 0.1, tires: 0.2, body: 0.7 }),
  }) as Readonly<Record<HitKind, Readonly<Record<DamageZone, number>>>>;

/**
 * Conversion from §23 raw magnitudes (units of "damage" in the GDD's
 * informal sense, where a `wallDamage = 24` corresponds to a serious but
 * survivable hit) to the `[0, 1]` zone scale this module uses internally.
 * Pinned so the §23 table reads directly: 100 raw damage = totally trashed
 * zone. A wall hit at `baseMagnitude = 24` and `speedFactor = 1` adds 0.24
 * units of damage spread across zones, which is "noticeable but not
 * catastrophic", matching the §13 design goal.
 */
export const DAMAGE_UNIT_SCALE = 100;

/**
 * §23 "Damage formula targets" `baseMagnitude` ranges keyed by `HitKind`.
 *
 * The table reads:
 *
 *     rubDamage             = 2  to 4
 *     carHitDamage          = 6  to 12
 *     wallDamage            = 12 to 24
 *     offRoadObjectDamage   = 10 to 20
 *
 * `offRoadPersistent` is a continuous accumulator (see
 * `OFF_ROAD_DAMAGE_PER_M` below) rather than a per-event roll, so it is
 * not part of the §23 table.
 *
 * The race session picks a deterministic `baseMagnitude` from the kind's
 * `[min, max]` band when constructing a `HitEvent` (the seeded-RNG slice
 * landed `src/game/rng.ts`; the per-encounter pick lives in the
 * race-session collision handler). This module does not roll any die
 * itself; the table is the contract a caller must respect.
 *
 * Pinned here so a future tweak to the bands stays in lockstep with §23
 * (the `balancing.test.ts` content test asserts the cell values match).
 */
export const HIT_MAGNITUDE_RANGES: Readonly<
  Record<Exclude<HitKind, "offRoadPersistent">, Readonly<{ min: number; max: number }>>
> = Object.freeze({
  rub: Object.freeze({ min: 2, max: 4 }),
  carHit: Object.freeze({ min: 6, max: 12 }),
  wallHit: Object.freeze({ min: 12, max: 24 }),
  offRoadObject: Object.freeze({ min: 10, max: 20 }),
});

/**
 * §23 "Damage formula targets" `nitroWhileSeverelyDamagedBonus = +15%`.
 *
 * The intent: when the player taps nitro on a severely damaged car, the
 * damage taken from any subsequent contact event scales by `1 + bonus`
 * (i.e. 15% extra) for the duration of the burn. The §13 narrative pins
 * "nitro overuse in damaged state" as one of the listed damage sources;
 * §23 puts a number on it.
 *
 * The constant is exported here so the consumer logic can land in a
 * later slice without re-deriving the rate. As of this slice the bonus
 * is a documented pin: the race-session damage path does not yet
 * multiply by `(1 + NITRO_WHILE_SEVERELY_DAMAGED_BONUS)` when the burn
 * is active and the band is `severe` or `catastrophic`. Tracked in
 * `docs/FOLLOWUPS.md` so the wiring slice has a target.
 */
export const NITRO_WHILE_SEVERELY_DAMAGED_BONUS = 0.15;

/**
 * Per-zone performance floor at 100% damage. Linear falloff from `1.0` at
 * zero damage to the floor at full damage. Engine drops to 55% of its
 * peak performance (top speed and accel both multiply by this when the
 * race session reads the multiplier), tires drop to 65% of peak grip,
 * and body damage does not directly degrade performance (the §13
 * narrative covers handling intermediate effects like rubbing penalties
 * via the rub-hit category, not the body damage stat itself).
 *
 * §13 "Mechanical effects" lists qualitative effects per zone but no
 * numeric floors; these are picked to keep a fully-engine-damaged car
 * "limp but finishable" per the §13 "Balancing principle" rather than
 * crawling. A future balancing pass owns the final values.
 */
export const PERFORMANCE_FLOOR: Readonly<Record<DamageZone, number>> = Object.freeze({
  engine: 0.55,
  tires: 0.65,
  body: 1.0,
});

/**
 * Weights for the wreck-threshold total. Engine damage matters most,
 * body next, tires least (you can drive on rims for a lap; a holed
 * engine will not finish). Sum = 1.0 so `total` lives in `[0, 1]` when
 * each per-zone value is in `[0, 1]`.
 */
export const TOTAL_DAMAGE_WEIGHTS: Readonly<Record<DamageZone, number>> = Object.freeze({
  engine: 0.45,
  tires: 0.2,
  body: 0.35,
});

/**
 * Threshold above which `isWrecked(state)` returns true. Set below 1.0
 * so the HUD has a small warning band; the §13 narrative says
 * "catastrophic damage should be rare but possible in hard mode" and
 * crossing 95% leaves room for a "you're about to wreck" UI cue without
 * making 100% mathematically unreachable.
 */
export const WRECK_THRESHOLD = 0.95;

/**
 * Off-road persistent damage tunables. Body damage accumulates while the
 * car is off-road; the rate scales with speed so a slow off-track moment
 * (limping back onto the road) costs almost nothing while a high-speed
 * straight-line through the grass costs real damage.
 *
 * The chosen rate (`OFF_ROAD_DAMAGE_PER_M = 0.000107`) lands the F-015
 * stress-test target ("5 s of off-road at top speed body damage equals
 * one mid-speed carHit on body, within 5%"): at 60 m/s for 5 s, the car
 * covers 300 m off-road and accumulates `0.000107 * 300 = 0.0321` units
 * of total damage, of which the `offRoadPersistent` distribution puts
 * `0.0321 * 0.7 = ~0.02247` on body. A mid-speed carHit
 * (`baseMagnitude = 9`, `speedFactor = 0.5`) deposits
 * `9 * 0.5 / 100 = 0.045` total damage, of which the `carHit`
 * distribution puts `0.045 * 0.5 = 0.0225` on body. The two values
 * agree within 1%. The §13 narrative ("slightly more dangerous to
 * persist off-road at high speed") is satisfied without making the
 * grass a one-touch wreck.
 */
export const OFF_ROAD_DAMAGE_PER_M = 0.000107;

/**
 * Per-zone base repair cost in credits at 100% damage. The race session's
 * "after race" repair flow multiplies these by the current per-zone
 * damage fraction (so a half-damaged engine costs half its base repair
 * price). Numbers are picked to land on the §23 reward formula targets:
 * a tier-3 race pays 1750 credits, so a single carHit's worth of damage
 * (~5% spread across zones) costs around 100 credits to fully repair.
 * A balancing pass owns the final numbers; for now they're documented in
 * one place so the upgrade / economy slice can read them directly.
 */
export const REPAIR_BASE_COST_CREDITS: Readonly<Record<DamageZone, number>> = Object.freeze({
  engine: 1500,
  tires: 600,
  body: 900,
});

/**
 * Build a fresh `DamageState` with the given per-zone values. Convenience
 * for tests and for the save-load slice when restoring a damaged car
 * from disk. Accepts a partial object; missing zones default to zero.
 */
export function createDamageState(
  zones: Partial<Readonly<Record<DamageZone, number>>> = {},
): DamageState {
  const filled: Record<DamageZone, number> = {
    engine: clampUnit(zones.engine ?? 0),
    tires: clampUnit(zones.tires ?? 0),
    body: clampUnit(zones.body ?? 0),
  };
  return {
    zones: Object.freeze(filled),
    total: weightedTotal(filled),
    offRoadAccumSeconds: 0,
  };
}

/**
 * Apply a hit. Returns a fresh `DamageState`; the input is never mutated.
 *
 * Per-zone increments clamp at `1.0` after addition; over-clamp does not
 * bleed into other zones (verify item 2). The `total` field is recomputed
 * from the post-clamp zones so the wreck check reads a coherent value.
 *
 * `speedFactor` is clamped to `[0, 1]` and `baseMagnitude` is clamped to
 * `[0, +inf)`; a negative magnitude returns the input unchanged
 * (defensive, no health regen via the damage path).
 *
 * `assistScalars` (optional) scales the per-event total by §28
 * `damageSeverity` before the per-zone distribution split. Omitting the
 * parameter (or passing `undefined`) preserves the unscaled pre-binding
 * behaviour bit-for-bit; the existing test fixtures and the §23 numeric
 * pins read the same `totalIncrement`. The scalar is clamped to a
 * conservative `[0, 4]` band so a buggy upstream config cannot turn a
 * single hit into an instant wreck.
 */
export function applyHit(
  state: Readonly<DamageState>,
  hit: Readonly<HitEvent>,
  assistScalars?: Readonly<AssistScalars>,
): DamageState {
  const baseMagnitude = Math.max(0, Number.isFinite(hit.baseMagnitude) ? hit.baseMagnitude : 0);
  const speedFactor = clampUnit(hit.speedFactor);
  if (baseMagnitude === 0 || speedFactor === 0) {
    // Preserve the existing zones reference's frozen identity for the
    // "idle / no-hit tick returns deep-equal state" verify item.
    return cloneState(state);
  }

  const severity = clampSeverity(assistScalars?.damageSeverity);
  const distribution = hit.zoneOverride ?? DEFAULT_ZONE_DISTRIBUTION[hit.kind];
  const totalIncrement = (baseMagnitude * speedFactor * severity) / DAMAGE_UNIT_SCALE;

  const next: Record<DamageZone, number> = {
    engine: clampUnit(state.zones.engine + totalIncrement * (distribution.engine ?? 0)),
    tires: clampUnit(state.zones.tires + totalIncrement * (distribution.tires ?? 0)),
    body: clampUnit(state.zones.body + totalIncrement * (distribution.body ?? 0)),
  };

  return {
    zones: Object.freeze(next),
    total: weightedTotal(next),
    offRoadAccumSeconds: state.offRoadAccumSeconds,
  };
}

/**
 * Per-tick off-road damage accumulator. Returns a fresh state. Pure: the
 * input is never mutated. The race session calls this every tick the
 * player car is off the drivable surface (`isOffRoad(x)` from physics).
 *
 * The body zone increments by `OFF_ROAD_DAMAGE_PER_M * speed * dt` minus
 * the off-road persistent distribution split (so the engine and tires
 * also pick up a smaller share). The `offRoadAccumSeconds` field tracks
 * cumulative off-road time so a future "persistent off-road" UI cue can
 * read it without re-deriving from elapsed race time.
 *
 * Negative or non-finite `dt` / `speed` are no-ops.
 */
export function applyOffRoadDamage(
  state: Readonly<DamageState>,
  speedMps: number,
  dt: number,
  assistScalars?: Readonly<AssistScalars>,
): DamageState {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(speedMps) || speedMps <= 0) {
    return cloneState(state);
  }
  const severity = clampSeverity(assistScalars?.damageSeverity);
  const distance = speedMps * dt;
  const totalIncrement = OFF_ROAD_DAMAGE_PER_M * distance * severity;
  const distribution = DEFAULT_ZONE_DISTRIBUTION.offRoadPersistent;
  const next: Record<DamageZone, number> = {
    engine: clampUnit(state.zones.engine + totalIncrement * distribution.engine),
    tires: clampUnit(state.zones.tires + totalIncrement * distribution.tires),
    body: clampUnit(state.zones.body + totalIncrement * distribution.body),
  };
  return {
    zones: Object.freeze(next),
    total: weightedTotal(next),
    offRoadAccumSeconds: state.offRoadAccumSeconds + dt,
  };
}

/**
 * Linear performance falloff: `1 - damage * (1 - floor)`. Returns `1.0`
 * at zero damage and `PERFORMANCE_FLOOR[zone]` at 100% damage.
 *
 * `damage` is clamped to `[0, 1]` defensively; values outside that
 * shouldn't be possible if state came from `applyHit` but a caller might
 * pass a hand-constructed state during testing.
 *
 * Body damage returns `1.0` for all inputs because §13 routes body
 * damage through the rubbing-penalty hit category (`rub`), not through a
 * direct performance multiplier. The race session never reads this for
 * body in production; the function is total over `DamageZone` for shape
 * consistency.
 */
export function performanceMultiplier(zone: DamageZone, damage: number): number {
  const clamped = clampUnit(damage);
  const floor = PERFORMANCE_FLOOR[zone];
  return 1 - clamped * (1 - floor);
}

/** Returns true when `state.total >= WRECK_THRESHOLD`. */
export function isWrecked(state: Readonly<DamageState>): boolean {
  return state.total >= WRECK_THRESHOLD;
}

/**
 * Repair cost in credits for a single zone at the given damage fraction.
 * Returns 0 when `damage <= 0` so the post-race UI can suppress the
 * repair prompt for an undamaged car (verify item: "no UI prompt when
 * undamaged").
 *
 * `damage` is clamped to `[0, 1]`. The cost is linear in damage; a
 * future progression slice may add a tour-tier multiplier here without
 * changing the call surface (additional optional arg).
 */
export function repairCostFor(zone: DamageZone, damage: number): number {
  const clamped = clampUnit(damage);
  if (clamped <= 0) return 0;
  return Math.round(clamped * REPAIR_BASE_COST_CREDITS[zone]);
}

/**
 * Total repair cost across all zones. Convenience for the post-race UI
 * which presents a single number ("repair: 850 credits") and for the
 * "skip repairs" branch which compares it to the player's wallet.
 */
export function totalRepairCost(state: Readonly<DamageState>): number {
  return (
    repairCostFor("engine", state.zones.engine) +
    repairCostFor("tires", state.zones.tires) +
    repairCostFor("body", state.zones.body)
  );
}

// Internal helpers ---------------------------------------------------------

/**
 * Clamp the §28 `damageSeverity` scalar into a conservative band. The
 * `[0, 4]` ceiling defends against a buggy upstream config (e.g. a
 * future preset row that pinned a `5x` value by mistake) without
 * blocking the §28 documented `0.75 to 1.35` span. `undefined` (no
 * preset wired) collapses to `1.0` so the unscaled identity preserves
 * the pre-binding behaviour.
 */
function clampSeverity(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 4) return 4;
  return value;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function weightedTotal(zones: Readonly<Record<DamageZone, number>>): number {
  return (
    zones.engine * TOTAL_DAMAGE_WEIGHTS.engine +
    zones.tires * TOTAL_DAMAGE_WEIGHTS.tires +
    zones.body * TOTAL_DAMAGE_WEIGHTS.body
  );
}

function cloneState(state: Readonly<DamageState>): DamageState {
  return {
    zones: Object.freeze({
      engine: state.zones.engine,
      tires: state.zones.tires,
      body: state.zones.body,
    }),
    total: state.total,
    offRoadAccumSeconds: state.offRoadAccumSeconds,
  };
}
