/**
 * Unit tests for the transmission state machine.
 *
 * Covers the dot's verify list:
 *
 *   - Gear count by upgrade tier (Stock 5, Street 5, Sport 6, Factory 6,
 *     Extreme 7).
 *   - Auto upshift fires above `AUTO_UPSHIFT_RPM`; auto downshift fires
 *     below `AUTO_DOWNSHIFT_RPM` and on brake.
 *   - Auto mode ignores `shiftUp` / `shiftDown` inputs (does not toggle
 *     into manual).
 *   - Manual `shiftUp` past max gear: ignored, gear unchanged.
 *   - Redline limiter: RPM clamps at 1.0; accel multiplier penalises the
 *     band 0.95..1.0.
 *   - Manual mode advantage: peak torque < 5% greater than auto peak.
 *   - Determinism: identical input sequence produces deep-equal state.
 */

import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_MAX_GEAR,
  AUTO_DOWNSHIFT_RPM,
  AUTO_PEAK_TORQUE_MULTIPLIER,
  AUTO_UPSHIFT_RPM,
  DEFAULT_TRANSMISSION_CONTEXT,
  INITIAL_TRANSMISSION_STATE,
  MANUAL_PEAK_TORQUE_MULTIPLIER,
  MAX_GEAR_BY_GEARBOX_UPGRADE,
  REDLINE_HARD_LIMIT_RPM,
  REDLINE_PENALTY_MULTIPLIER,
  REDLINE_SOFT_LIMIT_RPM,
  STOCK_MAX_GEAR,
  TORQUE_CURVE_BOTTOM_RPM,
  TORQUE_CURVE_FLOOR,
  gearAccelMultiplier,
  maxGearForGearboxUpgrade,
  maxGearForUpgrades,
  rpmForSpeedAndGear,
  stepTransmission,
  type TransmissionState,
  type TransmissionStepContext,
} from "@/game/transmission";

function ctx(overrides: Partial<TransmissionStepContext> = {}): TransmissionStepContext {
  return { ...DEFAULT_TRANSMISSION_CONTEXT, ...overrides };
}

function fresh(overrides: Partial<TransmissionState> = {}): TransmissionState {
  return { ...INITIAL_TRANSMISSION_STATE, ...overrides };
}

describe("maxGearForGearboxUpgrade", () => {
  it("matches the §12 ladder: Stock 5, Street 5, Sport 6, Factory 6, Extreme 7", () => {
    expect(maxGearForGearboxUpgrade(0)).toBe(5);
    expect(maxGearForGearboxUpgrade(1)).toBe(5);
    expect(maxGearForGearboxUpgrade(2)).toBe(6);
    expect(maxGearForGearboxUpgrade(3)).toBe(6);
    expect(maxGearForGearboxUpgrade(4)).toBe(7);
  });

  it("clamps out-of-range tiers to the table edges", () => {
    expect(maxGearForGearboxUpgrade(-1)).toBe(5);
    expect(maxGearForGearboxUpgrade(99)).toBe(7);
    expect(maxGearForGearboxUpgrade(NaN)).toBe(STOCK_MAX_GEAR);
  });

  it("never exceeds the absolute ceiling", () => {
    for (const value of MAX_GEAR_BY_GEARBOX_UPGRADE) {
      expect(value).toBeLessThanOrEqual(ABSOLUTE_MAX_GEAR);
      expect(value).toBeGreaterThanOrEqual(STOCK_MAX_GEAR);
    }
  });
});

describe("maxGearForUpgrades", () => {
  it("reads the gearbox tier from an installed-upgrades object", () => {
    expect(maxGearForUpgrades({ gearbox: 4 })).toBe(7);
    expect(maxGearForUpgrades({ gearbox: 0 })).toBe(5);
  });

  it("defaults to stock when the field is missing", () => {
    expect(maxGearForUpgrades(null)).toBe(STOCK_MAX_GEAR);
    expect(maxGearForUpgrades(undefined)).toBe(STOCK_MAX_GEAR);
    expect(maxGearForUpgrades({})).toBe(STOCK_MAX_GEAR);
  });
});

describe("rpmForSpeedAndGear", () => {
  it("maps speed within a gear's band to [0, 1]", () => {
    // 5-gear box, top speed 60. Gear 1 covers [0, 12]; gear 3 covers [24, 36].
    expect(rpmForSpeedAndGear(0, 1, 60, 5)).toBe(0);
    expect(rpmForSpeedAndGear(12, 1, 60, 5)).toBe(1);
    expect(rpmForSpeedAndGear(30, 3, 60, 5)).toBeCloseTo(0.5, 6);
    expect(rpmForSpeedAndGear(36, 3, 60, 5)).toBe(1);
  });

  it("clamps below zero and above the redline hard ceiling", () => {
    expect(rpmForSpeedAndGear(-100, 1, 60, 5)).toBe(0);
    expect(rpmForSpeedAndGear(9999, 1, 60, 5)).toBe(REDLINE_HARD_LIMIT_RPM);
  });

  it("returns 0 for degenerate inputs", () => {
    expect(rpmForSpeedAndGear(50, 1, 0, 5)).toBe(0);
    expect(rpmForSpeedAndGear(50, 1, 60, 0)).toBe(0);
  });
});

describe("stepTransmission (auto mode)", () => {
  it("upshifts when prior RPM exceeds AUTO_UPSHIFT_RPM and a higher gear exists", () => {
    // 5-gear box, top speed 60: gear 1 band is [0, 12]. Speed 11.5 -> RPM
    // 0.958, well above the 0.85 threshold.
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 1 }),
      ctx({ throttle: 1, speed: 11.5, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(2);
  });

  it("downshifts when prior RPM falls below AUTO_DOWNSHIFT_RPM", () => {
    // Gear 3 band [24, 36]. Speed 25 -> RPM 0.083, well below 0.4.
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 3 }),
      ctx({ throttle: 0.2, speed: 25, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(2);
  });

  it("downshifts on brake even if RPM is in band", () => {
    // Gear 3 band [24, 36]. Speed 30 -> RPM 0.5 (in band), but brake fires
    // a downshift anyway.
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 3 }),
      ctx({ brake: 1, speed: 30, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(2);
  });

  it("does not upshift past the configured max gear", () => {
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 5 }),
      ctx({ throttle: 1, speed: 59.5, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(5);
  });

  it("does not downshift below first gear", () => {
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 1 }),
      ctx({ throttle: 0, brake: 1, speed: 0, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(1);
  });

  it("ignores shiftUp / shiftDown inputs (does not toggle to manual)", () => {
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 2 }),
      ctx({
        throttle: 0.5,
        speed: 18,
        topSpeed: 60,
        maxGear: 5,
        shiftUp: true,
        shiftDown: true,
      }),
    );
    expect(next.mode).toBe("auto");
    // RPM at gear 2 / speed 18 = (18 - 12) / 12 = 0.5 (in band, no auto shift).
    expect(next.gear).toBe(2);
  });

  it("recomputes RPM after the post-shift gear", () => {
    // Upshift from 1 to 2 at speed 11.5: gear 2 band [12, 24], so RPM
    // becomes (11.5 - 12) / 12 -> clamped to 0.
    const next = stepTransmission(
      fresh({ mode: "auto", gear: 1 }),
      ctx({ throttle: 1, speed: 11.5, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(2);
    expect(next.rpm).toBe(0);
  });
});

describe("stepTransmission (manual mode)", () => {
  it("advances one gear on shiftUp when a higher gear exists", () => {
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 2 }),
      ctx({ shiftUp: true, speed: 18, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(3);
  });

  it("retreats one gear on shiftDown when a lower gear exists", () => {
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 3 }),
      ctx({ shiftDown: true, speed: 18, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(2);
  });

  it("ignores shiftUp at max gear (limit case)", () => {
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 7 }),
      ctx({ shiftUp: true, speed: 60, topSpeed: 60, maxGear: 7 }),
    );
    expect(next.gear).toBe(7);
  });

  it("ignores shiftDown at first gear (limit case)", () => {
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 1 }),
      ctx({ shiftDown: true, speed: 5, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(1);
  });

  it("never auto-upshifts at high RPM", () => {
    // Gear 1 band [0, 12]. Speed 11.5 -> RPM 0.958, above auto threshold,
    // but manual mode never auto-shifts.
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 1 }),
      ctx({ throttle: 1, speed: 11.5, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBe(1);
    expect(next.rpm).toBeGreaterThan(AUTO_UPSHIFT_RPM);
  });

  it("clamps gear into [1, maxGear] if state is poisoned by a stale upgrade", () => {
    // Loaded save with gear 7 from when Extreme was unlocked, but the
    // active car now has Stock gearbox (max gear 5). Step must clamp.
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 7 }),
      ctx({ speed: 30, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.gear).toBeLessThanOrEqual(5);
  });
});

describe("redline limiter", () => {
  it("clamps RPM at REDLINE_HARD_LIMIT_RPM", () => {
    const next = stepTransmission(
      fresh({ mode: "manual", gear: 5 }),
      ctx({ throttle: 1, speed: 9999, topSpeed: 60, maxGear: 5 }),
    );
    expect(next.rpm).toBe(REDLINE_HARD_LIMIT_RPM);
  });

  it("applies an accel penalty above the soft limit", () => {
    const peak = gearAccelMultiplier({
      mode: "auto",
      gear: 1,
      rpm: REDLINE_SOFT_LIMIT_RPM,
    });
    const redlined = gearAccelMultiplier({
      mode: "auto",
      gear: 1,
      rpm: REDLINE_HARD_LIMIT_RPM,
    });
    expect(redlined).toBeLessThan(peak);
    expect(redlined).toBeCloseTo(peak * REDLINE_PENALTY_MULTIPLIER, 6);
  });
});

describe("gearAccelMultiplier (torque curve)", () => {
  it("returns the floor at very low RPM", () => {
    const m = gearAccelMultiplier({ mode: "auto", gear: 1, rpm: 0 });
    expect(m).toBeCloseTo(TORQUE_CURVE_FLOOR, 6);
  });

  it("ramps to the auto peak at the soft limit", () => {
    const m = gearAccelMultiplier({
      mode: "auto",
      gear: 1,
      rpm: REDLINE_SOFT_LIMIT_RPM,
    });
    expect(m).toBeCloseTo(AUTO_PEAK_TORQUE_MULTIPLIER, 6);
  });

  it("ramps to the manual peak at the soft limit", () => {
    const m = gearAccelMultiplier({
      mode: "manual",
      gear: 1,
      rpm: REDLINE_SOFT_LIMIT_RPM,
    });
    expect(m).toBeCloseTo(MANUAL_PEAK_TORQUE_MULTIPLIER, 6);
  });

  it("monotonically increases from bottom to soft limit", () => {
    let prev = gearAccelMultiplier({
      mode: "manual",
      gear: 1,
      rpm: TORQUE_CURVE_BOTTOM_RPM,
    });
    for (let i = 0; i <= 100; i += 1) {
      const rpm =
        TORQUE_CURVE_BOTTOM_RPM +
        (REDLINE_SOFT_LIMIT_RPM - TORQUE_CURVE_BOTTOM_RPM) * (i / 100);
      const m = gearAccelMultiplier({ mode: "manual", gear: 1, rpm });
      expect(m).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = m;
    }
  });

  it("clamps RPM into [0, hard limit] defensively", () => {
    const low = gearAccelMultiplier({ mode: "auto", gear: 1, rpm: -5 });
    const high = gearAccelMultiplier({ mode: "auto", gear: 1, rpm: 5 });
    expect(low).toBeCloseTo(TORQUE_CURVE_FLOOR, 6);
    // High clamps to hard limit -> penalty band fully applied.
    const expectedHigh = AUTO_PEAK_TORQUE_MULTIPLIER * REDLINE_PENALTY_MULTIPLIER;
    expect(high).toBeCloseTo(expectedHigh, 6);
  });
});

describe("manual expert advantage", () => {
  it("peak manual torque is larger than auto by under 5%", () => {
    const ratio = MANUAL_PEAK_TORQUE_MULTIPLIER / AUTO_PEAK_TORQUE_MULTIPLIER;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio - 1).toBeLessThan(0.05);
  });

  it("at the same speed, an optimally-shifted manual driver beats auto by the same small margin", () => {
    // Pin both at gear 3, speed 30 in a 5-gear / 60 m/s box: RPM = 0.5,
    // mid-band, identical curve position. Manual peak > auto peak.
    const baseState: Omit<TransmissionState, "mode"> = { gear: 3, rpm: 0.5 };
    const auto = gearAccelMultiplier({ ...baseState, mode: "auto" });
    const manual = gearAccelMultiplier({ ...baseState, mode: "manual" });
    expect(manual).toBeGreaterThan(auto);
    expect(manual / auto - 1).toBeLessThan(0.05);
  });
});

describe("determinism", () => {
  it("identical input sequences produce deep-equal states", () => {
    const inputs: TransmissionStepContext[] = [];
    for (let i = 0; i < 200; i += 1) {
      inputs.push(
        ctx({
          throttle: i < 150 ? 1 : 0.2,
          brake: i >= 180 ? 1 : 0,
          shiftUp: i === 50 || i === 100,
          shiftDown: i === 190,
          // Sweep speed up then down to traverse all the gears.
          speed: i < 150 ? (i / 150) * 60 : 60 - ((i - 150) / 50) * 30,
          topSpeed: 60,
          maxGear: 7,
        }),
      );
    }

    const runOnce = (): TransmissionState => {
      let s: TransmissionState = fresh({ mode: "manual" });
      for (const c of inputs) s = stepTransmission(s, c);
      return s;
    };

    const a = runOnce();
    const b = runOnce();
    expect(a).toEqual(b);
  });

  it("does not mutate the input state", () => {
    const initial: TransmissionState = Object.freeze(fresh({ mode: "auto", gear: 2 }));
    const next = stepTransmission(initial, ctx({ throttle: 1, speed: 18, topSpeed: 60, maxGear: 5 }));
    expect(initial.gear).toBe(2);
    expect(next).not.toBe(initial);
  });
});

describe("auto-shift threshold constants are documented", () => {
  it("upshift is strictly above downshift", () => {
    expect(AUTO_UPSHIFT_RPM).toBeGreaterThan(AUTO_DOWNSHIFT_RPM);
  });

  it("soft limit sits above the upshift threshold", () => {
    expect(REDLINE_SOFT_LIMIT_RPM).toBeGreaterThan(AUTO_UPSHIFT_RPM);
  });
});
