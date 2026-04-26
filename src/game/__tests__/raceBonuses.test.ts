/**
 * Unit tests for `src/game/raceBonuses.ts` per the §5 rewards layer.
 *
 * Coverage map:
 *
 *   - Per-bonus predicates: podium (places 1, 2, 3, 4 boundary),
 *     fastestLap (player-only), cleanRace (epsilon equality), underdog
 *     (improved on grid, equal on grid, missing grid).
 *   - DNF policy: zero bonuses when the player did not finish.
 *   - Order: chips appear in (podium, fastestLap, cleanRace, underdog)
 *     order so the §20 chip strip stays stable across runs.
 *   - Tour-completion bonus: 0.15 of the rewards sum on a passed tour;
 *     null on a failed tour, on an empty rewards list, or on all-zero
 *     rewards.
 *   - Sponsor bonus: every kind in `SponsorObjectiveKindSchema` cell-by-
 *     cell. Silent failure on missed predicate, on missing sponsor, on
 *     DNF, and on missing telemetry.
 *   - Purity: frozen inputs do not throw; same inputs produce
 *     deep-equal output.
 *   - No `Math.random` / `Date.now`: covered by the project-wide
 *     `no-math-random.test.ts`; this suite double-checks determinism
 *     directly.
 */

import { describe, expect, it } from "vitest";

import type { SponsorObjective } from "@/data/schemas";

import {
  CLEAN_RACE_BONUS_CREDITS,
  FASTEST_LAP_BONUS_CREDITS,
  PODIUM_BONUS_CREDITS,
  TOUR_COMPLETION_BONUS_RATE,
  UNDERDOG_BONUS_CREDITS,
  buildBonusReceipt,
  computeBonuses,
  evaluateSponsorObjective,
  sponsorBonus,
  sumBonusCredits,
  tourCompletionBonus,
  type ComputeBonusesInput,
  type SponsorEvaluationContext,
} from "../raceBonuses";
import type { FinalCarRecord, FinalRaceState } from "../raceRules";

const PLAYER_ID = "player";
const RIVAL_ID = "ai-1";

function makeFinalState(overrides: Partial<FinalRaceState> = {}): FinalRaceState {
  const order: ReadonlyArray<FinalCarRecord> = [
    { carId: PLAYER_ID, status: "finished", raceTimeMs: 90_000, bestLapMs: 30_000 },
    { carId: RIVAL_ID, status: "finished", raceTimeMs: 95_000, bestLapMs: 31_000 },
  ];
  return {
    trackId: "test-circuit",
    totalLaps: 3,
    finishingOrder: order,
    perLapTimes: {
      [PLAYER_ID]: [30_000, 30_500, 30_000],
      [RIVAL_ID]: [31_000, 31_500, 32_500],
    },
    fastestLap: { carId: PLAYER_ID, lapMs: 30_000, lapNumber: 1 },
    ...overrides,
  };
}

function makeInput(overrides: Partial<ComputeBonusesInput> = {}): ComputeBonusesInput {
  return {
    finalState: makeFinalState(),
    playerCarId: PLAYER_ID,
    playerStartPosition: 7,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<SponsorEvaluationContext> = {},
): SponsorEvaluationContext {
  return {
    playerTopSpeed: 65,
    playerNitroFired: false,
    weatherAtFinish: "clear",
    ...overrides,
  };
}

// ---- computeBonuses --------------------------------------------------------

describe("computeBonuses: podium", () => {
  for (const place of [1, 2, 3] as const) {
    it(`awards podium on place ${place}`, () => {
      const order: FinalCarRecord[] = [];
      for (let i = 0; i < place - 1; i += 1) {
        order.push({
          carId: `pad-${i}`,
          status: "finished",
          raceTimeMs: 80_000 + i,
          bestLapMs: 25_000,
        });
      }
      order.push({
        carId: PLAYER_ID,
        status: "finished",
        raceTimeMs: 90_000,
        bestLapMs: 30_000,
      });
      const bonuses = computeBonuses(
        makeInput({
          finalState: makeFinalState({
            finishingOrder: order,
            perLapTimes: { [PLAYER_ID]: [30_000] },
            fastestLap: null,
          }),
          playerStartPosition: place,
        }),
      );
      expect(bonuses.find((b) => b.kind === "podium")?.cashCredits).toBe(
        PODIUM_BONUS_CREDITS,
      );
    });
  }

  it("does not award podium on place 4", () => {
    const order: FinalCarRecord[] = [];
    for (let i = 0; i < 3; i += 1) {
      order.push({
        carId: `pad-${i}`,
        status: "finished",
        raceTimeMs: 80_000 + i,
        bestLapMs: 25_000,
      });
    }
    order.push({
      carId: PLAYER_ID,
      status: "finished",
      raceTimeMs: 90_000,
      bestLapMs: 30_000,
    });
    const bonuses = computeBonuses(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: order,
          perLapTimes: { [PLAYER_ID]: [30_000] },
          fastestLap: null,
        }),
        playerStartPosition: 4,
      }),
    );
    expect(bonuses.find((b) => b.kind === "podium")).toBeUndefined();
  });
});

describe("computeBonuses: fastest lap", () => {
  it("awards fastest-lap when player owns it", () => {
    const bonuses = computeBonuses(makeInput());
    const fastest = bonuses.find((b) => b.kind === "fastestLap");
    expect(fastest?.cashCredits).toBe(FASTEST_LAP_BONUS_CREDITS);
  });

  it("does not award fastest-lap when AI owns it", () => {
    const bonuses = computeBonuses(
      makeInput({
        finalState: makeFinalState({
          fastestLap: { carId: RIVAL_ID, lapMs: 28_000, lapNumber: 2 },
        }),
      }),
    );
    expect(bonuses.find((b) => b.kind === "fastestLap")).toBeUndefined();
  });

  it("does not award fastest-lap when no laps were completed (no fastest lap)", () => {
    const bonuses = computeBonuses(
      makeInput({
        finalState: makeFinalState({ fastestLap: null }),
      }),
    );
    expect(bonuses.find((b) => b.kind === "fastestLap")).toBeUndefined();
  });
});

describe("computeBonuses: clean race", () => {
  it("awards clean-race when no damage was taken", () => {
    const bonuses = computeBonuses(makeInput());
    const clean = bonuses.find((b) => b.kind === "cleanRace");
    expect(clean?.cashCredits).toBe(CLEAN_RACE_BONUS_CREDITS);
  });

  it("does not award clean-race on any positive damage delta", () => {
    const bonuses = computeBonuses(
      makeInput({
        damageBefore: { engine: 0, tires: 0, body: 0 },
        damageAfter: { engine: 0, tires: 0.05, body: 0 },
      }),
    );
    expect(bonuses.find((b) => b.kind === "cleanRace")).toBeUndefined();
  });

  it("awards clean-race when damage stayed equal across before/after", () => {
    const bonuses = computeBonuses(
      makeInput({
        damageBefore: { engine: 0.4, tires: 0.4, body: 0.4 },
        damageAfter: { engine: 0.4, tires: 0.4, body: 0.4 },
      }),
    );
    expect(bonuses.find((b) => b.kind === "cleanRace")).toBeDefined();
  });
});

describe("computeBonuses: underdog", () => {
  it("awards underdog when player improves on grid", () => {
    const bonuses = computeBonuses(makeInput({ playerStartPosition: 7 }));
    const underdog = bonuses.find((b) => b.kind === "underdog");
    expect(underdog?.cashCredits).toBe(UNDERDOG_BONUS_CREDITS);
  });

  it("does not award underdog on equal grid placement", () => {
    const bonuses = computeBonuses(makeInput({ playerStartPosition: 1 }));
    expect(bonuses.find((b) => b.kind === "underdog")).toBeUndefined();
  });

  it("does not award underdog when start position is null (Practice)", () => {
    const bonuses = computeBonuses(makeInput({ playerStartPosition: null }));
    expect(bonuses.find((b) => b.kind === "underdog")).toBeUndefined();
  });
});

describe("computeBonuses: DNF policy", () => {
  it("returns no bonuses when the player DNF'd", () => {
    const bonuses = computeBonuses(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: [
            { carId: RIVAL_ID, status: "finished", raceTimeMs: 90_000, bestLapMs: 30_000 },
            { carId: PLAYER_ID, status: "dnf", raceTimeMs: null, bestLapMs: null },
          ],
          fastestLap: { carId: RIVAL_ID, lapMs: 30_000, lapNumber: 1 },
        }),
      }),
    );
    expect(bonuses).toEqual([]);
  });

  it("returns no bonuses when player not in finishing order", () => {
    const bonuses = computeBonuses(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: [
            { carId: RIVAL_ID, status: "finished", raceTimeMs: 90_000, bestLapMs: 30_000 },
          ],
        }),
      }),
    );
    expect(bonuses).toEqual([]);
  });
});

describe("computeBonuses: order and totals", () => {
  it("emits chips in podium / fastestLap / cleanRace / underdog order", () => {
    const bonuses = computeBonuses(makeInput({ playerStartPosition: 7 }));
    expect(bonuses.map((b) => b.kind)).toEqual([
      "podium",
      "fastestLap",
      "cleanRace",
      "underdog",
    ]);
  });

  it("sumBonusCredits adds every cashCredits non-negatively", () => {
    const total = sumBonusCredits([
      { kind: "podium", label: "Podium finish", cashCredits: 100 },
      { kind: "fastestLap", label: "Fastest lap", cashCredits: 50 },
      { kind: "cleanRace", label: "Clean race", cashCredits: 75 },
    ]);
    expect(total).toBe(225);
  });

  it("sumBonusCredits clamps negative entries to zero", () => {
    const total = sumBonusCredits([
      { kind: "podium", label: "Podium finish", cashCredits: -100 },
      { kind: "fastestLap", label: "Fastest lap", cashCredits: 200 },
    ]);
    expect(total).toBe(200);
  });

  it("buildBonusReceipt returns the same array and the matching total", () => {
    const list = computeBonuses(makeInput());
    const receipt = buildBonusReceipt(list);
    expect(receipt.bonuses).toBe(list);
    expect(receipt.total).toBe(sumBonusCredits(list));
  });
});

describe("computeBonuses: purity", () => {
  it("does not throw on frozen inputs", () => {
    const finalState = Object.freeze(makeFinalState());
    expect(() =>
      computeBonuses({
        finalState,
        playerCarId: PLAYER_ID,
        playerStartPosition: 7,
        damageBefore: Object.freeze({ engine: 0, tires: 0, body: 0 }),
        damageAfter: Object.freeze({ engine: 0, tires: 0, body: 0 }),
      }),
    ).not.toThrow();
  });

  it("two runs from same input produce deep-equal output", () => {
    const a = computeBonuses(makeInput());
    const b = computeBonuses(makeInput());
    expect(a).toEqual(b);
  });
});

// ---- tourCompletionBonus --------------------------------------------------

describe("tourCompletionBonus", () => {
  it("returns the §12 0.15 of the rewards sum on a passed tour", () => {
    const bonus = tourCompletionBonus({
      raceRewards: [1000, 800, 600, 400],
      tourPassed: true,
    });
    expect(bonus?.kind).toBe("tourComplete");
    expect(bonus?.cashCredits).toBe(
      Math.round((1000 + 800 + 600 + 400) * TOUR_COMPLETION_BONUS_RATE),
    );
  });

  it("returns null when tour is failed", () => {
    expect(
      tourCompletionBonus({
        raceRewards: [1000, 800, 600, 400],
        tourPassed: false,
      }),
    ).toBe(null);
  });

  it("returns null on empty rewards", () => {
    expect(
      tourCompletionBonus({
        raceRewards: [],
        tourPassed: true,
      }),
    ).toBe(null);
  });

  it("returns null when all rewards are zero", () => {
    expect(
      tourCompletionBonus({
        raceRewards: [0, 0, 0, 0],
        tourPassed: true,
      }),
    ).toBe(null);
  });

  it("clamps negative reward entries to zero before summing", () => {
    const bonus = tourCompletionBonus({
      raceRewards: [1000, -500, 500, 0],
      tourPassed: true,
    });
    // sum is clamped to (1000 + 0 + 500 + 0) = 1500.
    expect(bonus?.cashCredits).toBe(
      Math.round(1500 * TOUR_COMPLETION_BONUS_RATE),
    );
  });
});

// ---- sponsorBonus + evaluateSponsorObjective -----------------------------

function makeSponsor(overrides: Partial<SponsorObjective>): SponsorObjective {
  return {
    id: "test-sponsor",
    sponsorName: "Test Sponsor",
    description: "Test",
    kind: "finish_at_or_above",
    value: 3,
    cashCredits: 100,
    ...overrides,
  };
}

describe("sponsorBonus: returns null when no sponsor active", () => {
  it("no sponsor", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext(),
      sponsor: null,
    });
    expect(result).toBe(null);
  });

  it("DNF player with sponsor active", () => {
    const result = sponsorBonus({
      finalState: makeFinalState({
        finishingOrder: [
          { carId: RIVAL_ID, status: "finished", raceTimeMs: 90_000, bestLapMs: 30_000 },
          { carId: PLAYER_ID, status: "dnf", raceTimeMs: null, bestLapMs: null },
        ],
      }),
      playerCarId: PLAYER_ID,
      context: makeContext(),
      sponsor: makeSponsor({ kind: "clean_race" }),
    });
    expect(result).toBe(null);
  });
});

describe("sponsorBonus: predicate cells", () => {
  it("top_speed_at_least passes when player top speed >= value", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ playerTopSpeed: 75 }),
      sponsor: makeSponsor({ kind: "top_speed_at_least", value: 70 }),
    });
    expect(result?.kind).toBe("sponsor");
    expect(result?.cashCredits).toBe(100);
  });

  it("top_speed_at_least fails when player top speed < value", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ playerTopSpeed: 60 }),
      sponsor: makeSponsor({ kind: "top_speed_at_least", value: 70 }),
    });
    expect(result).toBe(null);
  });

  it("finish_at_or_above passes on placement <= value", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext(),
      sponsor: makeSponsor({ kind: "finish_at_or_above", value: 3 }),
    });
    expect(result).not.toBe(null);
  });

  it("finish_at_or_above fails on placement > value", () => {
    const order: FinalCarRecord[] = [];
    for (let i = 0; i < 4; i += 1) {
      order.push({
        carId: `pad-${i}`,
        status: "finished",
        raceTimeMs: 80_000 + i,
        bestLapMs: 25_000,
      });
    }
    order.push({
      carId: PLAYER_ID,
      status: "finished",
      raceTimeMs: 90_000,
      bestLapMs: 30_000,
    });
    const result = sponsorBonus({
      finalState: makeFinalState({
        finishingOrder: order,
        perLapTimes: { [PLAYER_ID]: [30_000] },
        fastestLap: null,
      }),
      playerCarId: PLAYER_ID,
      context: makeContext(),
      sponsor: makeSponsor({ kind: "finish_at_or_above", value: 3 }),
    });
    expect(result).toBe(null);
  });

  it("clean_race passes when no damage delta", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext(),
      sponsor: makeSponsor({ kind: "clean_race" }),
    });
    expect(result).not.toBe(null);
  });

  it("clean_race fails on positive damage delta", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      damageBefore: { engine: 0, tires: 0, body: 0 },
      damageAfter: { engine: 0.1, tires: 0, body: 0 },
      context: makeContext(),
      sponsor: makeSponsor({ kind: "clean_race" }),
    });
    expect(result).toBe(null);
  });

  it("no_nitro passes when player nitro flag is false", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ playerNitroFired: false }),
      sponsor: makeSponsor({ kind: "no_nitro" }),
    });
    expect(result).not.toBe(null);
  });

  it("no_nitro fails when player nitro flag is true", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ playerNitroFired: true }),
      sponsor: makeSponsor({ kind: "no_nitro" }),
    });
    expect(result).toBe(null);
  });

  it("no_nitro fails closed when telemetry is null", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ playerNitroFired: null }),
      sponsor: makeSponsor({ kind: "no_nitro" }),
    });
    expect(result).toBe(null);
  });

  it("weather_finish_top_n passes when weather and placement match", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ weatherAtFinish: "rain" }),
      sponsor: makeSponsor({
        kind: "weather_finish_top_n",
        value: 3,
        weather: ["rain", "heavy_rain"],
      }),
    });
    expect(result).not.toBe(null);
  });

  it("weather_finish_top_n fails when weather not in list", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ weatherAtFinish: "clear" }),
      sponsor: makeSponsor({
        kind: "weather_finish_top_n",
        value: 3,
        weather: ["rain", "heavy_rain"],
      }),
    });
    expect(result).toBe(null);
  });

  it("weather_finish_top_n fails when telemetry is null", () => {
    const result = sponsorBonus({
      finalState: makeFinalState(),
      playerCarId: PLAYER_ID,
      context: makeContext({ weatherAtFinish: null }),
      sponsor: makeSponsor({
        kind: "weather_finish_top_n",
        value: 3,
        weather: ["rain"],
      }),
    });
    expect(result).toBe(null);
  });
});

describe("evaluateSponsorObjective: pure predicate", () => {
  it("evaluates without throwing for every shipped predicate kind", () => {
    const kinds = [
      "top_speed_at_least",
      "finish_at_or_above",
      "clean_race",
      "no_nitro",
      "weather_finish_top_n",
    ] as const;
    for (const kind of kinds) {
      expect(() =>
        evaluateSponsorObjective({
          objective: makeSponsor({ kind, value: 1, weather: ["clear"] }),
          placement: 1,
          damageBefore: { engine: 0, tires: 0, body: 0 },
          damageAfter: { engine: 0, tires: 0, body: 0 },
          context: makeContext(),
        }),
      ).not.toThrow();
    }
  });
});
