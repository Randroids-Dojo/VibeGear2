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
import type { Track } from "@/data/schemas";

import {
  buildRaceResult,
  CLEAN_RACE_BONUS_CREDITS,
  DEFAULT_BASE_TRACK_REWARD,
  FASTEST_LAP_BONUS_CREDITS,
  PLACEMENT_POINTS,
  PODIUM_BONUS_CREDITS,
  UNDERDOG_BONUS_CREDITS,
  type BuildRaceResultInput,
} from "../raceResult";
import { computeRaceReward, DNF_PARTICIPATION_CREDITS } from "../economy";
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
    expect(fastest?.cashCredits).toBe(FASTEST_LAP_BONUS_CREDITS);
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
    expect(clean?.cashCredits).toBe(CLEAN_RACE_BONUS_CREDITS);
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
    const result = buildRaceResult(makeInput({ playerStartPosition: 7 }));
    const underdog = result.bonuses.find((b) => b.kind === "underdog");
    expect(underdog).toBeDefined();
    expect(underdog?.cashCredits).toBe(UNDERDOG_BONUS_CREDITS);
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
    const result = buildRaceResult(makeInput({ playerStartPosition: 7 }));
    const expectedBonusCash =
      PODIUM_BONUS_CREDITS +
      FASTEST_LAP_BONUS_CREDITS +
      CLEAN_RACE_BONUS_CREDITS +
      UNDERDOG_BONUS_CREDITS;
    expect(result.cashEarned).toBe(result.cashBaseEarned + expectedBonusCash);
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
