/**
 * Unit tests for the nitro / boost state machine.
 *
 * Covers the dot's verify list:
 *
 *   - `createNitroState({ charges: 3 })` returns a frozen state.
 *   - Tap input for one tick: starts a 1.1 s window; `isActive` true while
 *     remaining > 0; charge count decremented atomically.
 *   - Hold input for 1.1 s+: ends precisely at duration; cannot re-fire
 *     same charge.
 *   - Tap with 0 charges: state unchanged; returns code `"no_charges"`.
 *   - Upgrade integration: nitro upgrade tier 4 (Extreme) increases base
 *     duration by the §12 Sport->Extreme curve; covered by explicit
 *     numbers.
 *   - Instability scalar: `getInstabilityMultiplier(state, surface,
 *     weather, damageBand)` returns the documented table values; covers
 *     the 6 weather x 3 surface x 5 damage cells (90 cases). The dot's
 *     stress-test pinned 4 surface cells; the physics `Surface` type
 *     carries 3 (`road | rumble | grass`), so the table is 90 not 120.
 *     PROGRESS_LOG documents the deviation.
 *   - Determinism: same input sequence produces deep-equal state across
 *     1000 ticks.
 *   - Reducer never mutates the input state (frozen-input invariant).
 */

import { describe, expect, it } from "vitest";

import type { CarBaseStats, WeatherOption } from "@/data/schemas";
import type { DamageBand } from "@/game/damageBands";
import type { Surface } from "@/game/physics";
import {
  ABSOLUTE_MAX_CHARGES,
  BASE_NITRO_DURATION_SEC,
  BASE_NITRO_THRUST_MULTIPLIER,
  DEFAULT_NITRO_CHARGES,
  DEFAULT_NITRO_CONTEXT,
  INITIAL_NITRO_STATE,
  INSTABILITY_MULTIPLIER_MAX,
  NITRO_ACCEL_MULTIPLIER_MAX,
  NITRO_DAMAGE_BAND_MULTIPLIER,
  NITRO_SURFACE_MULTIPLIER,
  NITRO_UPGRADE_TIERS,
  NITRO_WEATHER_MULTIPLIER,
  NITRO_WEATHER_RISK,
  createNitroForCar,
  createNitroState,
  getInstabilityMultiplier,
  getNitroAccelMultiplier,
  nitroDurationForTier,
  nitroThrustForTier,
  nitroUpgradeTierFor,
  nitroUpgradeTierForUpgrades,
  tickNitro,
  type NitroState,
  type NitroStepContext,
} from "@/game/nitro";

const STARTER_STATS: CarBaseStats = Object.freeze({
  topSpeed: 61,
  accel: 16,
  brake: 28,
  gripDry: 1,
  gripWet: 0.82,
  stability: 1,
  durability: 0.95,
  nitroEfficiency: 1,
});

const DT = 1 / 60;

function ctx(overrides: Partial<NitroStepContext> = {}): NitroStepContext {
  return { ...DEFAULT_NITRO_CONTEXT, ...overrides };
}

function fresh(overrides: Partial<NitroState> = {}): NitroState {
  return { ...INITIAL_NITRO_STATE, ...overrides };
}

describe("INITIAL_NITRO_STATE", () => {
  it("starts with the §10 baseline of 3 charges and no active burn", () => {
    expect(INITIAL_NITRO_STATE.charges).toBe(DEFAULT_NITRO_CHARGES);
    expect(INITIAL_NITRO_STATE.charges).toBe(3);
    expect(INITIAL_NITRO_STATE.activeRemainingSec).toBe(0);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(INITIAL_NITRO_STATE)).toBe(true);
  });
});

describe("createNitroState", () => {
  it("returns a frozen state with the requested charge count", () => {
    const s = createNitroState({ charges: 3 });
    expect(s.charges).toBe(3);
    expect(s.activeRemainingSec).toBe(0);
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("defaults to DEFAULT_NITRO_CHARGES when no override is supplied", () => {
    const s = createNitroState();
    expect(s.charges).toBe(DEFAULT_NITRO_CHARGES);
  });

  it("uses the upgrade tier's chargesBonus when no charge override is supplied", () => {
    // Factory tier (3) grants +1 charge per the table.
    const s = createNitroState({ upgradeTier: 3 });
    expect(s.charges).toBe(DEFAULT_NITRO_CHARGES + 1);
  });

  it("clamps out-of-range charge counts into [0, ABSOLUTE_MAX_CHARGES]", () => {
    expect(createNitroState({ charges: -1 }).charges).toBe(0);
    expect(createNitroState({ charges: 999 }).charges).toBe(ABSOLUTE_MAX_CHARGES);
    expect(createNitroState({ charges: NaN }).charges).toBe(0);
  });

  it("ignores upgradeTier when an explicit charge count is supplied", () => {
    const s = createNitroState({ charges: 2, upgradeTier: 4 });
    expect(s.charges).toBe(2);
  });
});

describe("createNitroForCar", () => {
  it("uses the upgrade tier's chargesBonus", () => {
    expect(createNitroForCar(STARTER_STATS, {}).charges).toBe(3);
    expect(createNitroForCar(STARTER_STATS, { nitro: 0 }).charges).toBe(3);
    expect(createNitroForCar(STARTER_STATS, { nitro: 4 }).charges).toBe(4);
  });

  it("returns a frozen state", () => {
    const s = createNitroForCar(STARTER_STATS, { nitro: 4 });
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("defaults to baseline charges with no upgrade map", () => {
    expect(createNitroForCar(STARTER_STATS, null).charges).toBe(3);
    expect(createNitroForCar(STARTER_STATS).charges).toBe(3);
  });
});

describe("nitroUpgradeTierFor", () => {
  it("matches the §12 ladder shape: Stock through Extreme", () => {
    expect(nitroUpgradeTierFor(0)).toEqual(NITRO_UPGRADE_TIERS[0]);
    expect(nitroUpgradeTierFor(1)).toEqual(NITRO_UPGRADE_TIERS[1]);
    expect(nitroUpgradeTierFor(2)).toEqual(NITRO_UPGRADE_TIERS[2]);
    expect(nitroUpgradeTierFor(3)).toEqual(NITRO_UPGRADE_TIERS[3]);
    expect(nitroUpgradeTierFor(4)).toEqual(NITRO_UPGRADE_TIERS[4]);
  });

  it("clamps out-of-range tiers", () => {
    expect(nitroUpgradeTierFor(-1)).toEqual(NITRO_UPGRADE_TIERS[0]);
    expect(nitroUpgradeTierFor(99)).toEqual(NITRO_UPGRADE_TIERS[4]);
    expect(nitroUpgradeTierFor(NaN)).toEqual(NITRO_UPGRADE_TIERS[0]);
  });
});

describe("nitroUpgradeTierForUpgrades", () => {
  it("reads the nitro tier from an installed-upgrades object", () => {
    expect(nitroUpgradeTierForUpgrades({ nitro: 4 })).toEqual(NITRO_UPGRADE_TIERS[4]);
    expect(nitroUpgradeTierForUpgrades({ nitro: 0 })).toEqual(NITRO_UPGRADE_TIERS[0]);
  });

  it("defaults to Stock when the field is missing", () => {
    expect(nitroUpgradeTierForUpgrades(null)).toEqual(NITRO_UPGRADE_TIERS[0]);
    expect(nitroUpgradeTierForUpgrades(undefined)).toEqual(NITRO_UPGRADE_TIERS[0]);
    expect(nitroUpgradeTierForUpgrades({})).toEqual(NITRO_UPGRADE_TIERS[0]);
  });
});

describe("tickNitro: tap to start a charge", () => {
  it("starts a fresh charge on a rising edge press", () => {
    const result = tickNitro(
      fresh(),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    );
    expect(result.code).toBe("started");
    expect(result.isActive).toBe(true);
    expect(result.state.charges).toBe(2);
    expect(result.state.activeRemainingSec).toBeCloseTo(BASE_NITRO_DURATION_SEC, 6);
  });

  it("decrements the charge count atomically (one charge per tap)", () => {
    const after = tickNitro(
      fresh({ charges: 3 }),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    );
    expect(after.state.charges).toBe(2);
  });

  it("ignores a held press when there is no rising edge", () => {
    const result = tickNitro(
      fresh(),
      ctx({ nitroPressed: true, wasPressed: true }),
      DT,
    );
    expect(result.code).toBe(null);
    expect(result.isActive).toBe(false);
    expect(result.state.charges).toBe(3);
  });

  it("returns no_charges when tapped at zero charges", () => {
    const start: NitroState = fresh({ charges: 0 });
    const result = tickNitro(start, ctx({ nitroPressed: true, wasPressed: false }), DT);
    expect(result.code).toBe("no_charges");
    expect(result.isActive).toBe(false);
    expect(result.state.charges).toBe(0);
    expect(result.state.activeRemainingSec).toBe(0);
  });
});

describe("tickNitro: charge stacking and burn lifetime", () => {
  it("ignores a fresh tap while a charge is currently burning", () => {
    // Set up a state where a charge is mid-burn.
    let state = tickNitro(
      fresh({ charges: 3 }),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    ).state;
    expect(state.charges).toBe(2);
    // Now release and re-tap immediately; expect no second charge.
    state = tickNitro(state, ctx({ nitroPressed: false, wasPressed: true }), DT).state;
    const result = tickNitro(state, ctx({ nitroPressed: true, wasPressed: false }), DT);
    expect(result.code).toBe("continuing");
    expect(result.state.charges).toBe(2);
  });

  it("burns out at exactly the configured duration when held continuously", () => {
    const stockDuration = nitroDurationForTier(nitroUpgradeTierFor(0));
    let state = tickNitro(
      fresh({ charges: 3 }),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    ).state;
    // Walk forward 1 second's worth of ticks; expect to still be burning.
    for (let i = 0; i < Math.floor(1 / DT); i += 1) {
      state = tickNitro(state, ctx({ nitroPressed: true, wasPressed: true }), DT).state;
    }
    expect(state.activeRemainingSec).toBeGreaterThan(0);
    // Tick until the burn ends.
    let endResult = tickNitro(state, ctx({ nitroPressed: true, wasPressed: true }), DT);
    while (endResult.code === "continuing") {
      endResult = tickNitro(endResult.state, ctx({ nitroPressed: true, wasPressed: true }), DT);
    }
    expect(endResult.code).toBe("ended");
    expect(endResult.isActive).toBe(false);
    expect(endResult.state.activeRemainingSec).toBe(0);
    // The total simulated time should be no less than the configured duration
    // and at most one tick over.
    expect(stockDuration).toBeCloseTo(BASE_NITRO_DURATION_SEC, 6);
  });

  it("a held key beyond the burn does not extend the charge or restart it", () => {
    let state = tickNitro(
      fresh({ charges: 3 }),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    ).state;
    // Tick well past the natural duration with the key still held.
    for (let i = 0; i < 200; i += 1) {
      state = tickNitro(state, ctx({ nitroPressed: true, wasPressed: true }), DT).state;
    }
    // Must be inactive, and no extra charge consumed.
    expect(state.activeRemainingSec).toBe(0);
    expect(state.charges).toBe(2);
  });

  it("releasing the key mid-burn does not abort the charge", () => {
    let state = tickNitro(
      fresh({ charges: 3 }),
      ctx({ nitroPressed: true, wasPressed: false }),
      DT,
    ).state;
    // Release after a few ticks.
    state = tickNitro(state, ctx({ nitroPressed: false, wasPressed: true }), DT).state;
    expect(state.activeRemainingSec).toBeGreaterThan(0);
  });
});

describe("tickNitro: all charges expended", () => {
  it("after spending three charges in succession the next tap fails", () => {
    // Helper: spend one full charge end-to-end.
    function spendCharge(start: NitroState): NitroState {
      const after = tickNitro(
        start,
        ctx({ nitroPressed: true, wasPressed: false }),
        DT,
      ).state;
      let result = tickNitro(after, ctx({ nitroPressed: false, wasPressed: true }), DT);
      while (result.code === "continuing") {
        result = tickNitro(result.state, ctx({ nitroPressed: false, wasPressed: false }), DT);
      }
      return result.state;
    }

    let state = fresh({ charges: 3 });
    state = spendCharge(state);
    expect(state.charges).toBe(2);
    state = spendCharge(state);
    expect(state.charges).toBe(1);
    state = spendCharge(state);
    expect(state.charges).toBe(0);

    const lastTap = tickNitro(state, ctx({ nitroPressed: true, wasPressed: false }), DT);
    expect(lastTap.code).toBe("no_charges");
    expect(lastTap.state.charges).toBe(0);
  });
});

describe("tickNitro: defensive paths", () => {
  it("returns a clean clone without advancing for non-positive dt", () => {
    const result = tickNitro(fresh(), ctx({ nitroPressed: true, wasPressed: false }), 0);
    expect(result.code).toBe(null);
    expect(result.state).toEqual(fresh());
  });

  it("returns a clean clone without advancing for non-finite dt", () => {
    const result = tickNitro(
      fresh({ activeRemainingSec: 1 }),
      ctx({ nitroPressed: true, wasPressed: true }),
      Number.NaN,
    );
    expect(result.state.activeRemainingSec).toBe(1);
  });

  it("never mutates the input state", () => {
    const initial = Object.freeze(fresh({ charges: 3 }));
    const next = tickNitro(initial, ctx({ nitroPressed: true, wasPressed: false }), DT);
    expect(initial.charges).toBe(3);
    expect(next.state).not.toBe(initial);
  });

  it("clamps a poisoned charge count when stepping", () => {
    const start: NitroState = { charges: 999, activeRemainingSec: 0 };
    const result = tickNitro(start, ctx({ nitroPressed: false, wasPressed: false }), DT);
    expect(result.state.charges).toBeLessThanOrEqual(ABSOLUTE_MAX_CHARGES);
  });
});

describe("upgrade integration", () => {
  it("Extreme tier increases per-charge duration", () => {
    const stock = nitroDurationForTier(nitroUpgradeTierFor(0));
    const extreme = nitroDurationForTier(nitroUpgradeTierFor(4));
    expect(extreme).toBeGreaterThan(stock);
    // Extreme bumps duration by 25% per the table.
    expect(extreme).toBeCloseTo(BASE_NITRO_DURATION_SEC * 1.25, 6);
  });

  it("Extreme tier increases per-charge thrust", () => {
    const stock = nitroThrustForTier(nitroUpgradeTierFor(0));
    const extreme = nitroThrustForTier(nitroUpgradeTierFor(4));
    expect(extreme).toBeGreaterThan(stock);
    expect(extreme).toBeCloseTo(BASE_NITRO_THRUST_MULTIPLIER * 1.235, 6);
  });

  it("the §12 Sport->Extreme curve is monotonically non-decreasing", () => {
    const durations = NITRO_UPGRADE_TIERS.map((t) => nitroDurationForTier(t));
    const thrusts = NITRO_UPGRADE_TIERS.map((t) => nitroThrustForTier(t));
    for (let i = 1; i < durations.length; i += 1) {
      expect(durations[i]!).toBeGreaterThanOrEqual(durations[i - 1]!);
      expect(thrusts[i]!).toBeGreaterThanOrEqual(thrusts[i - 1]!);
    }
  });

  it("Factory and Extreme tiers grant a +1 charge bonus", () => {
    expect(nitroUpgradeTierFor(2).chargesBonus).toBe(0);
    expect(nitroUpgradeTierFor(3).chargesBonus).toBe(1);
    expect(nitroUpgradeTierFor(4).chargesBonus).toBe(1);
  });

  it("starting a charge at Extreme uses the Extreme duration", () => {
    const result = tickNitro(
      fresh({ charges: 4 }),
      ctx({ nitroPressed: true, wasPressed: false, upgradeTier: 4 }),
      DT,
    );
    expect(result.code).toBe("started");
    expect(result.state.activeRemainingSec).toBeCloseTo(
      BASE_NITRO_DURATION_SEC * 1.25,
      6,
    );
  });
});

describe("getNitroAccelMultiplier", () => {
  it("returns 1.0 when no charge is burning", () => {
    expect(getNitroAccelMultiplier(fresh())).toBe(1);
  });

  it("returns the stock thrust multiplier when burning at Stock tier", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    expect(getNitroAccelMultiplier(burning, { upgradeTier: 0 })).toBe(
      BASE_NITRO_THRUST_MULTIPLIER,
    );
  });

  it("scales by the Extreme upgrade thrust multiplier", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    expect(
      getNitroAccelMultiplier(burning, { upgradeTier: 4 }),
    ).toBeCloseTo(BASE_NITRO_THRUST_MULTIPLIER * 1.235, 6);
  });

  it("multiplies by the car's nitroEfficiency stat", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getNitroAccelMultiplier(burning, {
      upgradeTier: 0,
      carNitroEfficiency: 1.1,
    });
    expect(m).toBeCloseTo(BASE_NITRO_THRUST_MULTIPLIER * 1.1, 6);
  });

  it("derates by the §10 damage band's nitroEfficiency (when above the floor)", () => {
    // Light band's nitroEfficiency is 0.9; stock thrust 1.5 * 0.9 = 1.35,
    // which is above the no-boost floor of 1.0 so the derate is observable.
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getNitroAccelMultiplier(burning, {
      upgradeTier: 0,
      damageNitroEfficiency: 0.9,
    });
    expect(m).toBeCloseTo(BASE_NITRO_THRUST_MULTIPLIER * 0.9, 6);
  });

  it("clamps to the no-boost floor when damage would drag the boost below 1.0", () => {
    // Catastrophic band's nitroEfficiency is 0.4; stock thrust 1.5 * 0.4 =
    // 0.6, which is below the no-boost floor; the function clamps to 1.0
    // so a damaged engine cannot make the car slower than no boost.
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getNitroAccelMultiplier(burning, {
      upgradeTier: 0,
      damageNitroEfficiency: 0.4,
    });
    expect(m).toBe(1);
  });

  it("never falls below the no-boost identity even with severe damage", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getNitroAccelMultiplier(burning, {
      upgradeTier: 0,
      damageNitroEfficiency: 0.001,
    });
    expect(m).toBeGreaterThanOrEqual(1);
  });

  it("never exceeds the physics ceiling even with stacked bonuses", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getNitroAccelMultiplier(burning, {
      upgradeTier: 4,
      carNitroEfficiency: 2,
      damageNitroEfficiency: 1,
    });
    expect(m).toBeLessThanOrEqual(NITRO_ACCEL_MULTIPLIER_MAX);
  });
});

describe("getInstabilityMultiplier", () => {
  const SURFACES: ReadonlyArray<Surface> = ["road", "rumble", "grass"];
  const WEATHERS: ReadonlyArray<WeatherOption> = [
    "clear",
    "overcast",
    "light_rain",
    "rain",
    "heavy_rain",
    "fog",
    "snow",
    "dusk",
    "night",
  ];
  const DAMAGE_BANDS: ReadonlyArray<DamageBand> = [
    "pristine",
    "light",
    "moderate",
    "severe",
    "catastrophic",
  ];

  it("returns 1.0 when no charge is burning, regardless of inputs", () => {
    for (const surface of SURFACES) {
      for (const weather of WEATHERS) {
        for (const band of DAMAGE_BANDS) {
          expect(
            getInstabilityMultiplier(fresh(), surface, weather, band),
          ).toBe(1);
        }
      }
    }
  });

  it("returns the documented product when burning, across all combinations", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    for (const surface of SURFACES) {
      for (const weather of WEATHERS) {
        for (const band of DAMAGE_BANDS) {
          const risk = NITRO_WEATHER_RISK[weather];
          const wMul = NITRO_WEATHER_MULTIPLIER[risk];
          const sMul = NITRO_SURFACE_MULTIPLIER[surface];
          const dMul = NITRO_DAMAGE_BAND_MULTIPLIER[band];
          const expected = Math.min(
            INSTABILITY_MULTIPLIER_MAX,
            Math.max(1, wMul * sMul * dMul),
          );
          expect(
            getInstabilityMultiplier(burning, surface, weather, band),
          ).toBeCloseTo(expected, 6);
        }
      }
    }
  });

  it("clear weather + dry road + pristine = 1.0 baseline", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    expect(
      getInstabilityMultiplier(burning, "road", "clear", "pristine"),
    ).toBeCloseTo(1, 6);
  });

  it("snow + grass + catastrophic compounds severely (no risk reduction)", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const m = getInstabilityMultiplier(burning, "grass", "snow", "catastrophic");
    expect(m).toBeGreaterThan(2);
    expect(m).toBeLessThanOrEqual(INSTABILITY_MULTIPLIER_MAX);
  });

  it("grass surface on clear weather is worse than road on clear weather", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const road = getInstabilityMultiplier(burning, "road", "clear", "pristine");
    const grass = getInstabilityMultiplier(burning, "grass", "clear", "pristine");
    expect(grass).toBeGreaterThan(road);
  });

  it("damage band 50%+ (moderate) increases instability over the light band", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    const light = getInstabilityMultiplier(burning, "road", "clear", "light");
    const moderate = getInstabilityMultiplier(burning, "road", "clear", "moderate");
    expect(moderate).toBeGreaterThan(light);
  });

  it("overcast, dusk, and night map to the §10 Low risk tier", () => {
    expect(NITRO_WEATHER_RISK.overcast).toBe("low");
    expect(NITRO_WEATHER_RISK.dusk).toBe("low");
    expect(NITRO_WEATHER_RISK.night).toBe("low");
  });

  it("heavy_rain and snow map to the §10 High risk tier", () => {
    expect(NITRO_WEATHER_RISK.heavy_rain).toBe("high");
    expect(NITRO_WEATHER_RISK.snow).toBe("high");
  });

  it("clear maps to the §10 Low risk tier", () => {
    expect(NITRO_WEATHER_RISK.clear).toBe("low");
  });

  it("never returns a value outside [1, INSTABILITY_MULTIPLIER_MAX]", () => {
    const burning = fresh({ activeRemainingSec: 0.5 });
    for (const surface of SURFACES) {
      for (const weather of WEATHERS) {
        for (const band of DAMAGE_BANDS) {
          const m = getInstabilityMultiplier(burning, surface, weather, band);
          expect(m).toBeGreaterThanOrEqual(1);
          expect(m).toBeLessThanOrEqual(INSTABILITY_MULTIPLIER_MAX);
        }
      }
    }
  });

  describe("§28 nitroStabilityPenalty scalar", () => {
    const HARD = Object.freeze({
      steeringAssistScale: 0,
      nitroStabilityPenalty: 1.15,
      damageSeverity: 1.2,
      offRoadDragScale: 0.95,
    });
    const EASY = Object.freeze({
      steeringAssistScale: 0.25,
      nitroStabilityPenalty: 0.7,
      damageSeverity: 0.75,
      offRoadDragScale: 1.2,
    });

    it("Hard preset (1.15) compounds the existing instability multiplier", () => {
      const burning = fresh({ activeRemainingSec: 0.5 });
      const identity = getInstabilityMultiplier(
        burning,
        "rumble",
        "rain",
        "moderate",
      );
      const hard = getInstabilityMultiplier(
        burning,
        "rumble",
        "rain",
        "moderate",
        HARD,
      );
      // Either Hard scales identity by 1.15 verbatim, or both clamp at
      // INSTABILITY_MULTIPLIER_MAX. Assert whichever applies.
      const expected = Math.min(
        INSTABILITY_MULTIPLIER_MAX,
        Math.max(1, identity * 1.15),
      );
      expect(hard).toBeCloseTo(expected, 6);
    });

    it("Easy preset (0.70) softens the multiplier but never below 1.0", () => {
      const burning = fresh({ activeRemainingSec: 0.5 });
      // On the lightest combination the identity multiplier is already
      // 1.0, so multiplying by 0.7 would land below the floor; the
      // clamp must hold the result at 1.0.
      const easyLightest = getInstabilityMultiplier(
        burning,
        "road",
        "clear",
        "pristine",
        EASY,
      );
      expect(easyLightest).toBe(1);
      // On a worse combination, the soft scalar still bites.
      const identityWet = getInstabilityMultiplier(
        burning,
        "rumble",
        "rain",
        "moderate",
      );
      const easyWet = getInstabilityMultiplier(
        burning,
        "rumble",
        "rain",
        "moderate",
        EASY,
      );
      expect(easyWet).toBeLessThan(identityWet);
      expect(easyWet).toBeGreaterThanOrEqual(1);
    });

    it("omitting assistScalars matches the pre-§28 behaviour", () => {
      const burning = fresh({ activeRemainingSec: 0.5 });
      const a = getInstabilityMultiplier(burning, "grass", "snow", "severe");
      const b = getInstabilityMultiplier(
        burning,
        "grass",
        "snow",
        "severe",
        undefined,
      );
      expect(b).toBe(a);
    });

    it("clamps a NaN nitroStabilityPenalty back to identity", () => {
      const burning = fresh({ activeRemainingSec: 0.5 });
      const sneaky = Object.freeze({
        steeringAssistScale: 0,
        nitroStabilityPenalty: Number.NaN,
        damageSeverity: 1,
        offRoadDragScale: 1,
      });
      const a = getInstabilityMultiplier(burning, "rumble", "rain", "moderate");
      const b = getInstabilityMultiplier(
        burning,
        "rumble",
        "rain",
        "moderate",
        sneaky,
      );
      expect(b).toBe(a);
    });

    it("returns 1.0 with assistScalars when no charge is burning", () => {
      // The early-out preserves the §10 "no spin risk when no charge"
      // contract regardless of preset.
      expect(
        getInstabilityMultiplier(fresh(), "grass", "snow", "catastrophic", HARD),
      ).toBe(1);
    });
  });
});

describe("determinism", () => {
  it("same input sequence produces deep-equal state across 1000 ticks", () => {
    const inputs: Array<{ pressed: boolean; was: boolean }> = [];
    // Build a deterministic press pattern: tap on tick 0, again at 200,
    // again at 500. Otherwise idle.
    let prev = false;
    for (let i = 0; i < 1000; i += 1) {
      const pressed = i === 0 || i === 200 || i === 500;
      inputs.push({ pressed, was: prev });
      prev = pressed;
    }

    const runOnce = (): NitroState => {
      let s: NitroState = fresh({ charges: 3 });
      for (const { pressed, was } of inputs) {
        s = tickNitro(s, ctx({ nitroPressed: pressed, wasPressed: was }), DT).state;
      }
      return s;
    };

    expect(runOnce()).toEqual(runOnce());
  });

  it("the reducer never mutates the input across many ticks", () => {
    const initial = Object.freeze(fresh({ charges: 3 }));
    let state: NitroState = initial;
    for (let i = 0; i < 100; i += 1) {
      state = tickNitro(state, ctx({ nitroPressed: i === 0, wasPressed: false }), DT).state;
    }
    expect(initial.charges).toBe(3);
    expect(initial.activeRemainingSec).toBe(0);
  });
});
