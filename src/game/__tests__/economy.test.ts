/**
 * Unit tests for the economy primitives in `src/game/economy.ts`.
 *
 * Coverage targets the iter-19 stress-test verify list: every credit
 * award, purchase, and install path, plus all named failure codes.
 * Every test asserts purity (input never mutated, deep-equal post-call
 * for failure paths) and determinism (same inputs always produce the
 * same outputs) where applicable.
 */

import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence/save";
import { UPGRADES_BY_ID } from "@/data/upgrades";

import {
  awardCredits,
  computeRaceReward,
  DIFFICULTY_MULTIPLIERS,
  DNF_PARTICIPATION_CREDITS,
  FINISH_MULTIPLIERS,
  getUpgradePrice,
  installUpgrade,
  purchaseAndInstall,
  purchaseUpgrade,
  tourBonus,
  TOUR_BONUS_RATE,
  type EconomyFailure,
  type EconomyResult,
} from "../economy";

const STARTER_CAR = "sparrow-gt";

function freshSave() {
  // SaveGame fields are nested; clone explicitly so an accidental
  // mutation cannot leak through reference sharing.
  const base = defaultSave();
  return JSON.parse(JSON.stringify(base)) as ReturnType<typeof defaultSave>;
}

function assertOk<T>(
  result: EconomyResult<T>,
): asserts result is { ok: true; state: T; cashEarned?: number } {
  if (!result.ok) {
    throw new Error(
      `expected ok result, got failure: ${JSON.stringify(result.failure)}`,
    );
  }
}

function assertFail(
  result: EconomyResult,
): asserts result is { ok: false; failure: EconomyFailure } {
  if (result.ok) {
    throw new Error(`expected failure, got ok`);
  }
}

describe("computeRaceReward", () => {
  it("matches the §12 finish-multiplier table for each place at base 1000 / normal", () => {
    for (let place = 1; place <= 12; place += 1) {
      const reward = computeRaceReward({
        place,
        status: "finished",
        baseTrackReward: 1000,
        difficulty: "normal",
      });
      const expected = Math.round(1000 * (FINISH_MULTIPLIERS[place] ?? 0.14) * 1.0);
      expect(reward).toBe(expected);
    }
  });

  it("clamps placements above 12 to the trailing 0.14 floor", () => {
    const reward = computeRaceReward({
      place: 99,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "normal",
    });
    expect(reward).toBe(140);
  });

  it("clamps placements at or below 0 to the trailing 0.14 floor", () => {
    expect(
      computeRaceReward({
        place: 0,
        status: "finished",
        baseTrackReward: 1000,
        difficulty: "normal",
      }),
    ).toBe(140);
    expect(
      computeRaceReward({
        place: -3,
        status: "finished",
        baseTrackReward: 1000,
        difficulty: "normal",
      }),
    ).toBe(140);
  });

  it("scales by difficulty multiplier when a finished car wins", () => {
    const easy = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "easy",
    });
    const hard = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "hard",
    });
    const extreme = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "extreme",
    });
    expect(easy).toBe(Math.round(1000 * (DIFFICULTY_MULTIPLIERS.easy ?? 1.0)));
    expect(hard).toBe(Math.round(1000 * (DIFFICULTY_MULTIPLIERS.hard ?? 1.0)));
    expect(extreme).toBe(
      Math.round(1000 * (DIFFICULTY_MULTIPLIERS.extreme ?? 1.0)),
    );
  });

  it("falls back to 1.0x when difficulty key is unknown", () => {
    const reward = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "ludicrous",
    });
    expect(reward).toBe(1000);
  });

  it("DNF status pays the flat participation rate regardless of placement", () => {
    expect(
      computeRaceReward({
        place: 1,
        status: "dnf",
        baseTrackReward: 1000,
        difficulty: "extreme",
      }),
    ).toBe(DNF_PARTICIPATION_CREDITS);
    expect(
      computeRaceReward({
        place: 12,
        status: "dnf",
        baseTrackReward: 1000,
        difficulty: "easy",
      }),
    ).toBe(DNF_PARTICIPATION_CREDITS);
  });

  it("rounds with Math.round so last place at base 1000 banks 140", () => {
    const reward = computeRaceReward({
      place: 12,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "normal",
    });
    expect(reward).toBe(140);
  });
});

describe("awardCredits", () => {
  it("credits the player's wallet by the computed reward", () => {
    const before = freshSave();
    before.garage.credits = 500;
    const result = awardCredits(before, {
      placement: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "normal",
    });
    assertOk(result);
    expect(result.state.garage.credits).toBe(1500);
    expect(result.cashEarned).toBe(1000);
  });

  it("never mutates the input save", () => {
    const before = freshSave();
    const snapshot = JSON.parse(JSON.stringify(before));
    awardCredits(before, {
      placement: 4,
      status: "finished",
      baseTrackReward: 2000,
      difficulty: "hard",
    });
    expect(before).toEqual(snapshot);
  });

  it("returns a deep-equal save apart from the credits delta", () => {
    const before = freshSave();
    const result = awardCredits(before, {
      placement: 3,
      status: "finished",
      baseTrackReward: 1500,
      difficulty: "normal",
    });
    assertOk(result);
    const expectedAward = Math.round(1500 * 0.7);
    expect(result.state.garage.credits).toBe(before.garage.credits + expectedAward);
    expect(result.state.profileName).toBe(before.profileName);
    expect(result.state.progress).toEqual(before.progress);
    expect(result.state.records).toEqual(before.records);
    expect(result.state.garage.ownedCars).toEqual(before.garage.ownedCars);
  });

  it("DNF input pays the participation flat rate", () => {
    const before = freshSave();
    const result = awardCredits(before, {
      placement: 1,
      status: "dnf",
      baseTrackReward: 5000,
      difficulty: "extreme",
    });
    assertOk(result);
    expect(result.cashEarned).toBe(DNF_PARTICIPATION_CREDITS);
    expect(result.state.garage.credits).toBe(
      before.garage.credits + DNF_PARTICIPATION_CREDITS,
    );
  });

  it("is deterministic across repeated calls", () => {
    const before = freshSave();
    const a = awardCredits(before, {
      placement: 2,
      status: "finished",
      baseTrackReward: 1234,
      difficulty: "hard",
    });
    const b = awardCredits(before, {
      placement: 2,
      status: "finished",
      baseTrackReward: 1234,
      difficulty: "hard",
    });
    assertOk(a);
    assertOk(b);
    expect(a.cashEarned).toBe(b.cashEarned);
    expect(a.state).toEqual(b.state);
  });
});

describe("tourBonus", () => {
  it("returns 0 for an empty rewards list", () => {
    expect(tourBonus([])).toBe(0);
  });

  it("multiplies the summed rewards by TOUR_BONUS_RATE and rounds once", () => {
    const rewards = [1000, 820, 700, 580];
    const sum = rewards.reduce((a, b) => a + b, 0);
    expect(tourBonus(rewards)).toBe(Math.round(sum * TOUR_BONUS_RATE));
  });

  it("ignores negative rewards rather than clawing back the bonus", () => {
    const rewards = [1000, -500, 700];
    expect(tourBonus(rewards)).toBe(Math.round((1000 + 700) * TOUR_BONUS_RATE));
  });
});

describe("getUpgradePrice", () => {
  it("returns the §12 catalogue price for each known upgrade", () => {
    expect(getUpgradePrice("engine-street")).toBe(3000);
    expect(getUpgradePrice("engine-extreme")).toBe(18000);
    expect(getUpgradePrice("aero-street")).toBe(1600);
  });

  it("throws on an unknown upgrade id", () => {
    expect(() => getUpgradePrice("not-a-real-upgrade")).toThrow(
      /unknown upgrade id/,
    );
  });
});

describe("purchaseUpgrade", () => {
  it("credits-positive happy path advances the tier and deducts cost", () => {
    const before = freshSave();
    before.garage.credits = 5000;
    const result = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    assertOk(result);
    expect(result.state.garage.credits).toBe(2000);
    expect(result.state.garage.installedUpgrades[STARTER_CAR]?.engine).toBe(1);
  });

  it("never mutates the input save (failure path)", () => {
    const before = freshSave();
    const snapshot = JSON.parse(JSON.stringify(before));
    const result = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    assertFail(result);
    expect(result.failure.code).toBe("insufficient_credits");
    expect(before).toEqual(snapshot);
  });

  it("never mutates the input save (success path)", () => {
    const before = freshSave();
    before.garage.credits = 5000;
    const snapshot = JSON.parse(JSON.stringify(before));
    purchaseUpgrade(before, "engine-street", STARTER_CAR);
    expect(before).toEqual(snapshot);
  });

  it("rejects with insufficient_credits when wallet is one credit short", () => {
    const before = freshSave();
    const cost = getUpgradePrice("engine-street");
    before.garage.credits = cost - 1;
    const result = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    assertFail(result);
    expect(result.failure).toEqual({
      code: "insufficient_credits",
      required: cost,
      available: cost - 1,
    });
  });

  it("rejects unknown_upgrade for a missing catalogue id", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const result = purchaseUpgrade(before, "nope-zero", STARTER_CAR);
    assertFail(result);
    expect(result.failure.code).toBe("unknown_upgrade");
  });

  it("rejects unknown_car for a non-catalogue car id", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const result = purchaseUpgrade(before, "engine-street", "ghost-car");
    assertFail(result);
    expect(result.failure.code).toBe("unknown_car");
  });

  it("rejects car_not_owned when targeting an unowned car", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    // breaker-s is in the catalogue but not in the default ownedCars list.
    const result = purchaseUpgrade(before, "engine-street", "breaker-s");
    assertFail(result);
    expect(result.failure.code).toBe("car_not_owned");
  });

  it("rejects tier_skip when buying tier 3 with nothing installed", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const result = purchaseUpgrade(before, "engine-factory", STARTER_CAR);
    assertFail(result);
    expect(result.failure).toEqual({
      code: "tier_skip",
      category: "engine",
      required: 1,
      attempted: 3,
    });
  });

  it("rejects tier_skip when buying tier 3 with tier 1 installed", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const installed = before.garage.installedUpgrades[STARTER_CAR];
    if (installed) {
      installed.engine = 1;
    }
    const result = purchaseUpgrade(before, "engine-factory", STARTER_CAR);
    assertFail(result);
    expect(result.failure).toEqual({
      code: "tier_skip",
      category: "engine",
      required: 2,
      attempted: 3,
    });
  });

  it("rejects upgrade_at_cap when the next tier exceeds the car's cap", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    // Sparrow GT aero cap is 3 per its JSON. Pretend tier 3 is already
    // installed; attempting tier 4 (aero-extreme) should be rejected
    // for cap reasons rather than tier-skip (sequential is satisfied).
    const installed = before.garage.installedUpgrades[STARTER_CAR];
    if (installed) {
      installed.aero = 3;
    }
    const result = purchaseUpgrade(before, "aero-extreme", STARTER_CAR);
    assertFail(result);
    expect(result.failure).toEqual({
      code: "upgrade_at_cap",
      category: "aero",
      cap: 3,
    });
  });

  it("succeeds when tier 4 install matches a cap of 4 exactly", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const installed = before.garage.installedUpgrades[STARTER_CAR];
    if (installed) {
      installed.engine = 3;
    }
    const result = purchaseUpgrade(before, "engine-extreme", STARTER_CAR);
    assertOk(result);
    expect(result.state.garage.installedUpgrades[STARTER_CAR]?.engine).toBe(4);
  });

  it("preserves other categories' installed tiers when one category advances", () => {
    const before = freshSave();
    before.garage.credits = 99999;
    const installed = before.garage.installedUpgrades[STARTER_CAR];
    if (installed) {
      installed.engine = 1;
      installed.gearbox = 2;
      installed.dryTires = 1;
    }
    const result = purchaseUpgrade(before, "engine-sport", STARTER_CAR);
    assertOk(result);
    const next = result.state.garage.installedUpgrades[STARTER_CAR];
    expect(next?.engine).toBe(2);
    expect(next?.gearbox).toBe(2);
    expect(next?.dryTires).toBe(1);
    expect(next?.nitro).toBe(0);
  });

  it("is deterministic across repeated calls", () => {
    const before = freshSave();
    before.garage.credits = 5000;
    const a = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    const b = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    assertOk(a);
    assertOk(b);
    expect(a.state).toEqual(b.state);
  });
});

describe("installUpgrade and purchaseAndInstall", () => {
  it("installUpgrade is currently a purchase alias (MVP fold)", () => {
    const before = freshSave();
    before.garage.credits = 5000;
    const a = installUpgrade(before, "engine-street", STARTER_CAR);
    const b = purchaseUpgrade(before, "engine-street", STARTER_CAR);
    assertOk(a);
    assertOk(b);
    expect(a.state).toEqual(b.state);
  });

  it("purchaseAndInstall is the canonical garage call", () => {
    const before = freshSave();
    before.garage.credits = 5000;
    const result = purchaseAndInstall(before, "engine-street", STARTER_CAR);
    assertOk(result);
    expect(result.state.garage.credits).toBe(2000);
    expect(result.state.garage.installedUpgrades[STARTER_CAR]?.engine).toBe(1);
  });
});

describe("catalogue invariants", () => {
  it("every upgrade tier is at most the maximum sparrow-gt cap (4 or 3 for aero)", () => {
    // Sanity-check: the §12 four-tier ladder fits within every starter
    // car's cap (no upgrade requires a cap higher than 4).
    for (const upgrade of UPGRADES_BY_ID.values()) {
      expect(upgrade.tier).toBeGreaterThanOrEqual(1);
      expect(upgrade.tier).toBeLessThanOrEqual(4);
    }
  });
});
