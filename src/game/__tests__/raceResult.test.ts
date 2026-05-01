/**
 * Unit tests for the pure results builder in `src/game/raceResult.ts`.
 *
 * Coverage map:
 *
 *   - Placement points: every cell of the §7 top-8 ladder.
 *   - Cash base: matches `computeRaceReward` (cross-checked against
 *     the same fixture so a future change to the formula trips tests
 *     in both modules).
 *   - DNF path: zero points, participation cash, no podium / fastest /
 *     clean / underdog bonuses.
 *   - Bonuses: cell-by-cell. Podium (places 1, 2, 3, 4 boundary).
 *     Fastest lap (player owns vs other car owns). Clean race (no
 *     damage delta vs any positive delta). Underdog (improved vs
 *     equal vs worsened vs no grid position).
 *   - Damage delta: per-zone clamp to `[0, 1]`, NaN safe.
 *   - Next race card: tour mid-race vs final-race vs no championship
 *     vs missing tour.
 *   - Records patch: PB beats prior, ties do not write, missing prior
 *     writes, mode without `recordPBs` returns null.
 *   - Purity: `Object.freeze` the input, builder still completes.
 *   - Determinism: two runs from the same input return deep-equal
 *     outputs.
 */

import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence/save";
import type { SponsorObjective, Track } from "@/data/schemas";

import {
  applyRaceResultRecords,
  buildRaceResult,
  CLEAN_RACE_BONUS_RATE,
  DEFAULT_BASE_TRACK_REWARD,
  FASTEST_LAP_BONUS_RATE,
  PLACEMENT_POINTS,
  PODIUM_BONUS_RATES,
  UNDERDOG_BONUS_RATE_PER_RANK,
  pickSponsorForTourRace,
  type BuildRaceResultInput,
  type SponsorEvaluationContext,
} from "../raceResult";
import {
  awardCredits,
  computeRaceReward,
  DNF_PARTICIPATION_CREDITS,
} from "../economy";
import type { FinalCarRecord, FinalRaceState } from "../raceRules";

const PLAYER_ID = "player";
const RIVAL_ID = "ai-1";

function makeTrack(): Track {
  return {
    id: "test-circuit",
    name: "Test Circuit",
    tourId: "test-tour",
    author: "test",
    version: 1,
    lengthMeters: 1000,
    laps: 3,
    laneCount: 2,
    weatherOptions: ["clear"],
    difficulty: 1,
    segments: [
      {
        len: 1000,
        curve: 0,
        grade: 0,
        roadsideLeft: "kerb",
        roadsideRight: "kerb",
        hazards: [],
      },
    ],
    checkpoints: [],
    spawn: { gridSlots: 12 },
  };
}

function makeFinalState(overrides: Partial<FinalRaceState> = {}): FinalRaceState {
  const order: ReadonlyArray<FinalCarRecord> = [
    {
      carId: PLAYER_ID,
      status: "finished",
      raceTimeMs: 90_000,
      bestLapMs: 30_000,
    },
    {
      carId: RIVAL_ID,
      status: "finished",
      raceTimeMs: 95_000,
      bestLapMs: 31_000,
    },
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

function makeInput(
  overrides: Partial<BuildRaceResultInput> = {},
): BuildRaceResultInput {
  return {
    finalState: makeFinalState(),
    save: defaultSave(),
    track: makeTrack(),
    playerCarId: PLAYER_ID,
    playerStartPosition: 7,
    recordPBs: true,
    ...overrides,
  };
}

describe("buildRaceResult: placement and points", () => {
  it("reports 1st place + 25 points for the player when they finish first", () => {
    const result = buildRaceResult(makeInput());
    expect(result.playerPlacement).toBe(1);
    expect(result.pointsEarned).toBe(PLACEMENT_POINTS[1]);
  });

  it("matches every cell of the §7 top-8 points ladder", () => {
    for (let place = 1; place <= 8; place += 1) {
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
      const result = buildRaceResult(
        makeInput({
          finalState: makeFinalState({
            finishingOrder: order,
            perLapTimes: { [PLAYER_ID]: [30_000] },
            fastestLap: null,
          }),
          // Avoid podium bonus polluting the points-only assertion by
          // pushing the player out of grid improvement here.
          playerStartPosition: place,
        }),
      );
      expect(result.playerPlacement).toBe(place);
      expect(result.pointsEarned).toBe(PLACEMENT_POINTS[place]);
    }
  });

  it("scores zero points outside the top 8", () => {
    const order: FinalCarRecord[] = [];
    for (let i = 0; i < 8; i += 1) {
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
    const result = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: order,
          perLapTimes: { [PLAYER_ID]: [30_000] },
          fastestLap: null,
        }),
        playerStartPosition: 9,
      }),
    );
    expect(result.playerPlacement).toBe(9);
    expect(result.pointsEarned).toBe(0);
  });

  it("returns null placement when player car not in finishing order", () => {
    const result = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: RIVAL_ID,
              status: "finished",
              raceTimeMs: 90_000,
              bestLapMs: 30_000,
            },
          ],
        }),
      }),
    );
    expect(result.playerPlacement).toBe(null);
    expect(result.pointsEarned).toBe(0);
  });
});

describe("buildRaceResult: cash base", () => {
  it("matches computeRaceReward for the player's place using the §23 tier-1 reward", () => {
    // Fixture track has `difficulty: 1`, so the §23 lookup resolves to
    // `BASE_REWARDS_BY_TRACK_DIFFICULTY[1]` which equals
    // `DEFAULT_BASE_TRACK_REWARD` by construction.
    const result = buildRaceResult(makeInput());
    const expected = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: DEFAULT_BASE_TRACK_REWARD,
      difficulty: "normal",
    });
    expect(result.cashBaseEarned).toBe(expected);
  });

  it("honours the caller-supplied baseTrackReward", () => {
    const result = buildRaceResult(makeInput({ baseTrackReward: 2500 }));
    const expected = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 2500,
      difficulty: "normal",
    });
    expect(result.cashBaseEarned).toBe(expected);
  });

  it("honours difficulty override", () => {
    const result = buildRaceResult(
      makeInput({ baseTrackReward: 1000, difficulty: "hard" }),
    );
    const expected = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "hard",
    });
    expect(result.cashBaseEarned).toBe(expected);
  });

  it("derives the default baseTrackReward from track.difficulty per §23", () => {
    // Tier 3 track without an explicit `baseTrackReward`. The builder
    // should reach into `BASE_REWARDS_BY_TRACK_DIFFICULTY[3] === 1750`
    // and feed that into `computeRaceReward`.
    const tier3Track = { ...makeTrack(), difficulty: 3 };
    const result = buildRaceResult(makeInput({ track: tier3Track }));
    const expected = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 1750,
      difficulty: "normal",
    });
    expect(result.cashBaseEarned).toBe(expected);
  });

  it("scales every §23 difficulty tier through the default lookup", () => {
    const tierTable: ReadonlyArray<readonly [1 | 2 | 3 | 4 | 5, number]> = [
      [1, 1000],
      [2, 1350],
      [3, 1750],
      [4, 2250],
      [5, 2900],
    ];
    for (const [difficulty, base] of tierTable) {
      const trackForTier = { ...makeTrack(), difficulty };
      const result = buildRaceResult(makeInput({ track: trackForTier }));
      const expected = computeRaceReward({
        place: 1,
        status: "finished",
        baseTrackReward: base,
        difficulty: "normal",
      });
      expect(result.cashBaseEarned).toBe(expected);
    }
  });

  it("explicit baseTrackReward wins over the track.difficulty lookup", () => {
    // Tier 5 track but the caller passes a per-tour override; the
    // override should take precedence.
    const tier5Track = { ...makeTrack(), difficulty: 5 };
    const result = buildRaceResult(
      makeInput({ track: tier5Track, baseTrackReward: 500 }),
    );
    const expected = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward: 500,
      difficulty: "normal",
    });
    expect(result.cashBaseEarned).toBe(expected);
  });
});

describe("buildRaceResult: bonuses", () => {
  it("awards podium bonus on places 1, 2, 3 and not on 4", () => {
    for (const place of [1, 2, 3]) {
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
      const result = buildRaceResult(
        makeInput({
          finalState: makeFinalState({
            finishingOrder: order,
            perLapTimes: { [PLAYER_ID]: [30_000] },
            fastestLap: null,
          }),
          playerStartPosition: place,
        }),
      );
      expect(result.bonuses.find((b) => b.kind === "podium")).toBeDefined();
    }

    // 4th place: no podium.
    const order4: FinalCarRecord[] = [];
    for (let i = 0; i < 3; i += 1) {
      order4.push({
        carId: `pad-${i}`,
        status: "finished",
        raceTimeMs: 80_000 + i,
        bestLapMs: 25_000,
      });
    }
    order4.push({
      carId: PLAYER_ID,
      status: "finished",
      raceTimeMs: 90_000,
      bestLapMs: 30_000,
    });
    const result4 = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: order4,
          perLapTimes: { [PLAYER_ID]: [30_000] },
          fastestLap: null,
        }),
        playerStartPosition: 4,
      }),
    );
    expect(result4.bonuses.find((b) => b.kind === "podium")).toBeUndefined();
  });

  it("awards fastest-lap bonus when player owns it", () => {
    const result = buildRaceResult(makeInput());
    const fastest = result.bonuses.find((b) => b.kind === "fastestLap");
    expect(fastest).toBeDefined();
    expect(fastest?.cashCredits).toBe(
      Math.round(DEFAULT_BASE_TRACK_REWARD * FASTEST_LAP_BONUS_RATE),
    );
  });

  it("does not award fastest-lap bonus when another car owns it", () => {
    const result = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          fastestLap: { carId: RIVAL_ID, lapMs: 28_000, lapNumber: 2 },
        }),
      }),
    );
    expect(result.bonuses.find((b) => b.kind === "fastestLap")).toBeUndefined();
  });

  it("awards clean-race bonus when no damage was taken", () => {
    const result = buildRaceResult(makeInput());
    const clean = result.bonuses.find((b) => b.kind === "cleanRace");
    expect(clean).toBeDefined();
    expect(clean?.cashCredits).toBe(
      Math.round(DEFAULT_BASE_TRACK_REWARD * CLEAN_RACE_BONUS_RATE),
    );
  });

  it("does not award clean-race bonus on any positive damage delta", () => {
    const result = buildRaceResult(
      makeInput({
        damageBefore: { engine: 0.0, tires: 0.0, body: 0.0 },
        damageAfter: { engine: 0.0, tires: 0.05, body: 0.0 },
      }),
    );
    expect(result.bonuses.find((b) => b.kind === "cleanRace")).toBeUndefined();
  });

  it("awards underdog bonus when the player improves on grid", () => {
    // Fixture: 1st from grid 7 -> six ranks improved.
    const result = buildRaceResult(makeInput({ playerStartPosition: 7 }));
    const underdog = result.bonuses.find((b) => b.kind === "underdog");
    expect(underdog).toBeDefined();
    expect(underdog?.cashCredits).toBe(
      Math.round(DEFAULT_BASE_TRACK_REWARD * UNDERDOG_BONUS_RATE_PER_RANK * 6),
    );
  });

  it("does not award underdog bonus on equal grid placement", () => {
    const result = buildRaceResult(makeInput({ playerStartPosition: 1 }));
    expect(result.bonuses.find((b) => b.kind === "underdog")).toBeUndefined();
  });

  it("does not award underdog bonus when no grid position supplied (Practice)", () => {
    const result = buildRaceResult(makeInput({ playerStartPosition: null }));
    expect(result.bonuses.find((b) => b.kind === "underdog")).toBeUndefined();
  });

  it("sums all bonuses into cashEarned", () => {
    // Fixture: P1 from grid 7 -> six ranks improved.
    const result = buildRaceResult(makeInput({ playerStartPosition: 7 }));
    const expectedBonusCash =
      Math.round(DEFAULT_BASE_TRACK_REWARD * (PODIUM_BONUS_RATES[1] ?? 0)) +
      Math.round(DEFAULT_BASE_TRACK_REWARD * FASTEST_LAP_BONUS_RATE) +
      Math.round(DEFAULT_BASE_TRACK_REWARD * CLEAN_RACE_BONUS_RATE) +
      Math.round(DEFAULT_BASE_TRACK_REWARD * UNDERDOG_BONUS_RATE_PER_RANK * 6);
    expect(result.cashEarned).toBe(result.cashBaseEarned + expectedBonusCash);
  });

  it("adds pickup cash as a results bonus and wallet-credit input", () => {
    const result = buildRaceResult(
      makeInput({ playerStartPosition: 1, pickupCashEarned: 175 }),
    );
    const pickup = result.bonuses.find((b) => b.kind === "pickupCash");
    expect(pickup).toEqual({
      kind: "pickupCash",
      label: "Track pickups",
      cashCredits: 175,
    });
    expect(result.cashEarned).toBe(
      result.cashBaseEarned +
        result.bonuses.reduce((acc, bonus) => acc + bonus.cashCredits, 0),
    );
  });
});

describe("buildRaceResult: DNF path", () => {
  it("DNF player gets participation cash, zero points, no bonuses", () => {
    const result = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: RIVAL_ID,
              status: "finished",
              raceTimeMs: 90_000,
              bestLapMs: 30_000,
            },
            {
              carId: PLAYER_ID,
              status: "dnf",
              raceTimeMs: null,
              bestLapMs: null,
            },
          ],
          perLapTimes: { [PLAYER_ID]: [], [RIVAL_ID]: [30_000, 30_000, 30_000] },
          fastestLap: { carId: RIVAL_ID, lapMs: 30_000, lapNumber: 1 },
        }),
      }),
    );
    expect(result.cashBaseEarned).toBe(DNF_PARTICIPATION_CREDITS);
    expect(result.pointsEarned).toBe(0);
    expect(result.bonuses).toEqual([]);
    expect(result.cashEarned).toBe(DNF_PARTICIPATION_CREDITS);
  });
});

describe("buildRaceResult: damage delta", () => {
  it("clamps each zone delta to [0, 1]", () => {
    const result = buildRaceResult(
      makeInput({
        damageBefore: { engine: 0.1, tires: 0.2, body: 0.3 },
        damageAfter: { engine: 0.4, tires: 0.2, body: 1.5 },
      }),
    );
    expect(result.damageTaken.engine).toBeCloseTo(0.3, 6);
    expect(result.damageTaken.tires).toBe(0);
    expect(result.damageTaken.body).toBe(1);
  });

  it("treats negative delta as zero (a heal between samples cannot show)", () => {
    const result = buildRaceResult(
      makeInput({
        damageBefore: { engine: 0.5, tires: 0.5, body: 0.5 },
        damageAfter: { engine: 0.4, tires: 0.5, body: 0.5 },
      }),
    );
    expect(result.damageTaken.engine).toBe(0);
  });

  it("NaN-safe: non-finite zones collapse to zero", () => {
    const result = buildRaceResult(
      makeInput({
        damageBefore: { engine: 0, tires: 0, body: 0 },
        damageAfter: { engine: Number.NaN, tires: 0, body: 0 },
      }),
    );
    expect(result.damageTaken.engine).toBe(0);
  });
});

describe("buildRaceResult: next race card", () => {
  const championship = {
    tours: [
      { id: "t1", tracks: ["test-circuit", "next-circuit", "final-circuit"] },
    ],
  };

  it("returns null when no championship supplied", () => {
    const result = buildRaceResult(makeInput());
    expect(result.nextRace).toBe(null);
  });

  it("returns the next track id when there is one in the tour", () => {
    const result = buildRaceResult(
      makeInput({ championship, tourId: "t1", currentTrackIndex: 0 }),
    );
    expect(result.nextRace?.trackId).toBe("next-circuit");
    expect(result.tourProgress).toMatchObject({
      tourId: "t1",
      raceIndex: 0,
      nextRaceIndex: 1,
      completed: false,
    });
  });

  it("falls back to indexOf when currentTrackIndex omitted", () => {
    const result = buildRaceResult(
      makeInput({ championship, tourId: "t1" }),
    );
    expect(result.nextRace?.trackId).toBe("next-circuit");
  });

  it("returns null on the final race in a tour", () => {
    const result = buildRaceResult(
      makeInput({ championship, tourId: "t1", currentTrackIndex: 2 }),
    );
    expect(result.nextRace).toBe(null);
    expect(result.tourProgress).toMatchObject({
      tourId: "t1",
      raceIndex: 2,
      nextRaceIndex: null,
      completed: true,
    });
  });

  it("returns null when the tour id is not in the championship", () => {
    const result = buildRaceResult(
      makeInput({ championship, tourId: "missing" }),
    );
    expect(result.nextRace).toBe(null);
  });
});

describe("buildRaceResult: records patch", () => {
  it("emits a patch when the player beats the prior best lap", () => {
    const save = defaultSave();
    save.records["test-circuit"] = { bestLapMs: 32_000, bestRaceMs: 100_000 };
    const result = buildRaceResult(makeInput({ save }));
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });
  });

  it("does not emit a patch when the player ties the prior best", () => {
    const save = defaultSave();
    save.records["test-circuit"] = { bestLapMs: 30_000, bestRaceMs: 100_000 };
    const result = buildRaceResult(makeInput({ save }));
    expect(result.recordsUpdated).toBe(null);
  });

  it("does not emit a patch when slower than prior best", () => {
    const save = defaultSave();
    save.records["test-circuit"] = { bestLapMs: 28_000, bestRaceMs: 100_000 };
    const result = buildRaceResult(makeInput({ save }));
    expect(result.recordsUpdated).toBe(null);
  });

  it("emits a patch when no prior record exists", () => {
    const result = buildRaceResult(makeInput());
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });
  });

  it("returns null when recordPBs is false (Practice mode)", () => {
    const result = buildRaceResult(makeInput({ recordPBs: false }));
    expect(result.recordsUpdated).toBe(null);
  });

  it("returns null when player completed no laps", () => {
    const result = buildRaceResult(
      makeInput({
        finalState: makeFinalState({
          perLapTimes: { [PLAYER_ID]: [], [RIVAL_ID]: [30_000] },
        }),
      }),
    );
    expect(result.recordsUpdated).toBe(null);
  });
});

describe("buildRaceResult: Daily Challenge marker", () => {
  it("carries the Daily Challenge marker without changing records logic", () => {
    const dailyChallenge = {
      dateKey: "2026-04-30",
      seed: 123456,
      trackId: "test-circuit",
      weather: "rain" as const,
      carClass: "balance" as const,
    };
    const result = buildRaceResult(makeInput({ dailyChallenge }));

    expect(result.dailyChallenge).toEqual(dailyChallenge);
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });
  });
});

describe("buildRaceResult: purity and determinism", () => {
  it("does not mutate frozen inputs", () => {
    const final = Object.freeze(makeFinalState());
    const save = Object.freeze(defaultSave());
    const track = Object.freeze(makeTrack());
    expect(() =>
      buildRaceResult({
        finalState: final,
        save,
        track,
        playerCarId: PLAYER_ID,
        playerStartPosition: 7,
        recordPBs: true,
      }),
    ).not.toThrow();
  });

  it("two runs from the same input produce deep-equal output", () => {
    const a = buildRaceResult(makeInput());
    const b = buildRaceResult(makeInput());
    expect(a).toEqual(b);
  });
});

/**
 * F-034 wallet-commit contract. The race-finish wiring in
 * `src/app/race/page.tsx` calls `buildRaceResult` then `awardCredits`
 * with the same numbers the receipt rendered, persists the merged save,
 * and overwrites `RaceResult.creditsAwarded` with the wallet delta. The
 * tests below pin that sequence at the boundary the page consumes so a
 * future caller can copy the contract verbatim.
 */
describe("buildRaceResult + awardCredits: F-034 race-finish wiring", () => {
  it("default builder result carries creditsAwarded === 0", () => {
    const result = buildRaceResult(makeInput());
    expect(result.creditsAwarded).toBe(0);
  });

  it("P1 finish + base 1000 credits + Hard difficulty credits the wallet by the formula result", () => {
    const baseTrackReward = 1000;
    const difficulty = "hard";
    const result = buildRaceResult(
      makeInput({
        baseTrackReward,
        difficulty,
        playerStartPosition: 1,
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: PLAYER_ID,
              status: "finished",
              raceTimeMs: 90_000,
              bestLapMs: 30_000,
            },
          ],
          // Drop fastestLap so the bonus pipeline does not award one.
          fastestLap: null,
        }),
      }),
    );

    const expectedBase = computeRaceReward({
      place: 1,
      status: "finished",
      baseTrackReward,
      difficulty,
    });
    expect(result.cashBaseEarned).toBe(expectedBase);
    // P1 with the default fixture still earns the podium + clean-race
    // bonuses; the receipt total is `cashBaseEarned + sum(bonuses)`.
    const expectedReceipt =
      expectedBase + result.bonuses.reduce((acc, b) => acc + b.cashCredits, 0);
    expect(result.cashEarned).toBe(expectedReceipt);

    // F-034 wallet-commit contract: the page calls `awardCredits` with
    // the same bonus list the receipt rendered, so the wallet delta and
    // the receipt total stay in lockstep.
    const save = defaultSave();
    const award = awardCredits(save, {
      placement: 1,
      status: "finished",
      baseTrackReward,
      difficulty,
      bonuses: result.bonuses,
    });
    expect(award.ok).toBe(true);
    if (!award.ok) return;
    expect(award.state.garage.credits).toBe(
      save.garage.credits + expectedReceipt,
    );
    expect(award.cashEarned).toBe(expectedReceipt);
  });

  it("DNF status credits the §12 participation cash and skips bonuses", () => {
    const baseTrackReward = 1000;
    const difficulty = "normal";
    const result = buildRaceResult(
      makeInput({
        baseTrackReward,
        difficulty,
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: PLAYER_ID,
              status: "dnf",
              raceTimeMs: null,
              bestLapMs: null,
            },
          ],
          perLapTimes: { [PLAYER_ID]: [] },
          fastestLap: null,
        }),
      }),
    );

    expect(result.cashBaseEarned).toBe(DNF_PARTICIPATION_CREDITS);
    expect(result.bonuses).toEqual([]);

    const save = defaultSave();
    const award = awardCredits(save, {
      placement: 1,
      status: "dnf",
      baseTrackReward,
      difficulty,
      bonuses: result.bonuses,
    });
    expect(award.ok).toBe(true);
    if (!award.ok) return;
    expect(award.state.garage.credits).toBe(
      save.garage.credits + DNF_PARTICIPATION_CREDITS,
    );
    expect(award.cashEarned).toBe(DNF_PARTICIPATION_CREDITS);
  });

  it("bonuses ride the wallet delta so `creditsAwarded` equals `cashEarned` on the receipt", () => {
    // P1 finish on the default fixture has podium + fastest-lap +
    // clean-race bonuses; the wallet must receive the same number the
    // receipt shows so the player never sees a row mismatch.
    const result = buildRaceResult(makeInput({ baseTrackReward: 1000 }));
    expect(result.bonuses.length).toBeGreaterThan(0);

    const save = defaultSave();
    const award = awardCredits(save, {
      placement: result.playerPlacement ?? 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "normal",
      bonuses: result.bonuses,
    });
    expect(award.ok).toBe(true);
    if (!award.ok) return;
    expect(award.cashEarned).toBe(result.cashEarned);
    expect(award.state.garage.credits).toBe(
      save.garage.credits + result.cashEarned,
    );
  });

  it("merges a PB patch into the credited save before persistence", () => {
    const save = defaultSave();
    save.records["test-circuit"] = { bestLapMs: 32_000, bestRaceMs: 100_000 };
    const result = buildRaceResult(
      makeInput({
        save,
        baseTrackReward: 1000,
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: PLAYER_ID,
              status: "finished",
              raceTimeMs: 90_000,
              bestLapMs: 30_000,
            },
          ],
          perLapTimes: { [PLAYER_ID]: [30_000, 30_000, 30_000] },
        }),
      }),
    );
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });

    const award = awardCredits(save, {
      placement: result.playerPlacement ?? 1,
      status: "finished",
      baseTrackReward: 1000,
      difficulty: "normal",
      bonuses: result.bonuses,
    });
    expect(award.ok).toBe(true);
    if (!award.ok) return;

    const committed = applyRaceResultRecords(award.state, result);
    expect(committed.garage.credits).toBe(
      save.garage.credits + result.cashEarned,
    );
    expect(committed.records["test-circuit"]).toEqual({
      bestLapMs: 30_000,
      bestRaceMs: 90_000,
    });
  });

  it("creates a valid record when the first PB lands on a fresh track", () => {
    const save = defaultSave();
    const result = buildRaceResult(makeInput({ save }));
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });

    const committed = applyRaceResultRecords(save, result);
    expect(committed.records["test-circuit"]).toEqual({
      bestLapMs: 30_000,
      bestRaceMs: 90_000,
    });
  });

  it("preserves an existing faster lap when a stale PB patch is merged", () => {
    const save = {
      ...defaultSave(),
      records: {
        "test-circuit": {
          bestLapMs: 25_000,
          bestRaceMs: 88_000,
          bestSplitsMs: [12_000, 18_000],
        },
      },
    };
    const result = buildRaceResult(
      makeInput({
        save: defaultSave(),
      }),
    );
    expect(result.recordsUpdated).toEqual({
      trackId: "test-circuit",
      bestLapMs: 30_000,
    });

    const committed = applyRaceResultRecords(save, result);
    expect(committed.records["test-circuit"]).toEqual({
      bestLapMs: 25_000,
      bestRaceMs: 88_000,
      bestSplitsMs: [12_000, 18_000],
    });
  });
});

/**
 * F-040 sponsor objective wiring. The race-finish flow inside the
 * tour-region surface picks an active sponsor via
 * `pickSponsorForTourRace`, builds a `SponsorEvaluationContext` from the
 * live RaceState, and threads both into `buildRaceResult`. The tests
 * below pin that contract:
 *
 *   - A met objective appends a `sponsor`-kind chip with the sponsor's
 *     `cashCredits` value; the receipt total includes it.
 *   - A missed objective is silent (no chip, no negative credit).
 *   - A null sponsor (no roster, Practice / Time Trial) leaves the chip
 *     list at the per-race four-chip baseline.
 *   - The tour roster picker rotates deterministically across races and
 *     wraps when the race count exceeds the roster size.
 */
describe("buildRaceResult: F-040 sponsor objective wiring", () => {
  function makeSponsor(
    overrides: Partial<SponsorObjective> = {},
  ): SponsorObjective {
    return {
      id: "test-sponsor",
      sponsorName: "Test Sponsor",
      description: "Finish in the top 3.",
      kind: "finish_at_or_above",
      value: 3,
      cashCredits: 250,
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

  it("appends a sponsor chip when the objective is met", () => {
    const sponsor = makeSponsor();
    const result = buildRaceResult(
      makeInput({
        sponsor,
        sponsorContext: makeContext(),
      }),
    );
    const chip = result.bonuses.find((b) => b.kind === "sponsor");
    expect(chip).toBeDefined();
    expect(chip?.cashCredits).toBe(sponsor.cashCredits);
    expect(chip?.label).toBe(sponsor.sponsorName);
  });

  it("appends no sponsor chip when the objective is missed", () => {
    const sponsor = makeSponsor({
      kind: "top_speed_at_least",
      value: 999,
    });
    const result = buildRaceResult(
      makeInput({
        sponsor,
        sponsorContext: makeContext({ playerTopSpeed: 50 }),
      }),
    );
    expect(result.bonuses.find((b) => b.kind === "sponsor")).toBeUndefined();
  });

  it("appends no sponsor chip when sponsor is null (no tour roster)", () => {
    const result = buildRaceResult(
      makeInput({ sponsor: null, sponsorContext: makeContext() }),
    );
    expect(result.bonuses.find((b) => b.kind === "sponsor")).toBeUndefined();
  });

  it("appends no sponsor chip when sponsor is omitted entirely", () => {
    const result = buildRaceResult(makeInput());
    expect(result.bonuses.find((b) => b.kind === "sponsor")).toBeUndefined();
  });

  it("appends no sponsor chip when sponsorContext is null", () => {
    const result = buildRaceResult(
      makeInput({ sponsor: makeSponsor(), sponsorContext: null }),
    );
    expect(result.bonuses.find((b) => b.kind === "sponsor")).toBeUndefined();
  });

  it("rolls the sponsor cashCredits into cashEarned receipt total", () => {
    const sponsor = makeSponsor({ cashCredits: 250 });
    const without = buildRaceResult(makeInput());
    const withSponsor = buildRaceResult(
      makeInput({ sponsor, sponsorContext: makeContext() }),
    );
    expect(withSponsor.cashEarned).toBe(without.cashEarned + sponsor.cashCredits);
  });

  it("orders sponsor after the per-race bonuses on the chip strip", () => {
    const sponsor = makeSponsor();
    const result = buildRaceResult(
      makeInput({
        sponsor,
        sponsorContext: makeContext(),
        playerStartPosition: 7,
      }),
    );
    // Per the §20 chip-selector pin: per-race bonuses come first
    // (podium / fastestLap / cleanRace / underdog), sponsor last.
    const kinds = result.bonuses.map((b) => b.kind);
    expect(kinds[kinds.length - 1]).toBe("sponsor");
  });

  it("DNF player skips the sponsor bonus", () => {
    const sponsor = makeSponsor({ kind: "clean_race" });
    const result = buildRaceResult(
      makeInput({
        sponsor,
        sponsorContext: makeContext(),
        finalState: makeFinalState({
          finishingOrder: [
            {
              carId: RIVAL_ID,
              status: "finished",
              raceTimeMs: 90_000,
              bestLapMs: 30_000,
            },
            {
              carId: PLAYER_ID,
              status: "dnf",
              raceTimeMs: null,
              bestLapMs: null,
            },
          ],
          perLapTimes: { [PLAYER_ID]: [], [RIVAL_ID]: [30_000, 30_000, 30_000] },
          fastestLap: { carId: RIVAL_ID, lapMs: 30_000, lapNumber: 1 },
        }),
      }),
    );
    expect(result.bonuses.find((b) => b.kind === "sponsor")).toBeUndefined();
  });
});

describe("pickSponsorForTourRace: deterministic rotation", () => {
  const sponsorA: SponsorObjective = {
    id: "sponsor-a",
    sponsorName: "A",
    description: "test A",
    kind: "clean_race",
    cashCredits: 100,
  };
  const sponsorB: SponsorObjective = {
    id: "sponsor-b",
    sponsorName: "B",
    description: "test B",
    kind: "clean_race",
    cashCredits: 200,
  };
  const registry: ReadonlyMap<string, SponsorObjective> = new Map([
    [sponsorA.id, sponsorA],
    [sponsorB.id, sponsorB],
  ]);
  const lookup = (id: string): SponsorObjective | undefined => registry.get(id);

  it("returns null when the tour has no sponsors field", () => {
    expect(pickSponsorForTourRace({ tour: {}, raceIndex: 0, lookup })).toBe(
      null,
    );
  });

  it("returns null on an empty roster", () => {
    expect(
      pickSponsorForTourRace({ tour: { sponsors: [] }, raceIndex: 0, lookup }),
    ).toBe(null);
  });

  it("rotates through the roster by raceIndex (no wrap)", () => {
    const tour = { sponsors: [sponsorA.id, sponsorB.id] };
    expect(
      pickSponsorForTourRace({ tour, raceIndex: 0, lookup })?.id,
    ).toBe(sponsorA.id);
    expect(
      pickSponsorForTourRace({ tour, raceIndex: 1, lookup })?.id,
    ).toBe(sponsorB.id);
  });

  it("wraps when raceIndex exceeds roster length", () => {
    const tour = { sponsors: [sponsorA.id, sponsorB.id] };
    // Tour with 2 sponsors and a 4-race index should wrap:
    // race 0 -> A, race 1 -> B, race 2 -> A, race 3 -> B.
    expect(
      pickSponsorForTourRace({ tour, raceIndex: 2, lookup })?.id,
    ).toBe(sponsorA.id);
    expect(
      pickSponsorForTourRace({ tour, raceIndex: 3, lookup })?.id,
    ).toBe(sponsorB.id);
  });

  it("returns null on an unresolved sponsor id (silently)", () => {
    const tour = { sponsors: ["does-not-exist"] };
    expect(pickSponsorForTourRace({ tour, raceIndex: 0, lookup })).toBe(null);
  });

  it("clamps negative or non-integer indices to zero", () => {
    const tour = { sponsors: [sponsorA.id, sponsorB.id] };
    expect(
      pickSponsorForTourRace({ tour, raceIndex: -1, lookup })?.id,
    ).toBe(sponsorA.id);
    expect(
      pickSponsorForTourRace({ tour, raceIndex: Number.NaN, lookup })?.id,
    ).toBe(sponsorA.id);
  });

  it("two calls with the same input return the same sponsor (determinism)", () => {
    const tour = { sponsors: [sponsorA.id, sponsorB.id] };
    const a = pickSponsorForTourRace({ tour, raceIndex: 1, lookup });
    const b = pickSponsorForTourRace({ tour, raceIndex: 1, lookup });
    expect(a).toEqual(b);
  });
});
