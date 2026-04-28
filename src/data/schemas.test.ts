import { describe, expect, it } from "vitest";

import aiDriverExample from "./examples/aiDriver.example.json";
import carExample from "./examples/car.example.json";
import championshipExample from "./examples/championship.example.json";
import saveGameExample from "./examples/saveGame.example.json";
import trackExample from "./examples/track.example.json";
import upgradeExample from "./examples/upgrade.example.json";
import {
  AIDriverSchema,
  CarSchema,
  ChampionshipSchema,
  GhostReplayDeltaSchema,
  GhostReplaySchema,
  SaveGameSchema,
  TrackSchema,
  UpgradeSchema,
} from "./schemas";

/**
 * Each schema gets two checks: the canonical example from
 * docs/gdd/22-data-schemas.md must round-trip cleanly, and at least one
 * deliberately broken variant must be rejected. The broken variants target
 * the edge cases listed on the dot spec.
 */

describe("TrackSchema", () => {
  it("accepts the §22 example", () => {
    const result = TrackSchema.safeParse(trackExample);
    expect(result.success).toBe(true);
  });

  it("rejects an empty segments array", () => {
    const broken = { ...trackExample, segments: [] };
    expect(TrackSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a non-positive lengthMeters", () => {
    const broken = { ...trackExample, lengthMeters: -1 };
    expect(TrackSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an unknown weather option", () => {
    const broken = { ...trackExample, weatherOptions: ["acid_rain"] };
    expect(TrackSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts an authored minimapPoints override of length 2 or more", () => {
    const ok = {
      ...trackExample,
      minimapPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    expect(TrackSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects minimapPoints of length 0 or 1", () => {
    const empty = { ...trackExample, minimapPoints: [] };
    expect(TrackSchema.safeParse(empty).success).toBe(false);
    const single = { ...trackExample, minimapPoints: [{ x: 0, y: 0 }] };
    expect(TrackSchema.safeParse(single).success).toBe(false);
  });

  it("accepts a track without minimapPoints (field optional)", () => {
    const result = TrackSchema.safeParse(trackExample);
    expect(result.success).toBe(true);
  });
});

describe("CarSchema", () => {
  it("accepts the §22 example", () => {
    expect(CarSchema.safeParse(carExample).success).toBe(true);
  });

  it("rejects an unknown class", () => {
    const broken = { ...carExample, class: "hypercar" };
    expect(CarSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects negative purchasePrice", () => {
    const broken = { ...carExample, purchasePrice: -1 };
    expect(CarSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects upgradeCaps with negative tier", () => {
    const broken = {
      ...carExample,
      upgradeCaps: { ...carExample.upgradeCaps, engine: -1 },
    };
    expect(CarSchema.safeParse(broken).success).toBe(false);
  });
});

describe("UpgradeSchema", () => {
  it("accepts the §22 example", () => {
    expect(UpgradeSchema.safeParse(upgradeExample).success).toBe(true);
  });

  it("rejects negative cost", () => {
    const broken = { ...upgradeExample, cost: -100 };
    expect(UpgradeSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects tier of 0", () => {
    const broken = { ...upgradeExample, tier: 0 };
    expect(UpgradeSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects effects with no declared keys", () => {
    const broken = { ...upgradeExample, effects: {} };
    expect(UpgradeSchema.safeParse(broken).success).toBe(false);
  });
});

describe("ChampionshipSchema", () => {
  it("accepts the §22 example", () => {
    expect(ChampionshipSchema.safeParse(championshipExample).success).toBe(true);
  });

  it("rejects an unknown difficulty preset", () => {
    const broken = { ...championshipExample, difficultyPreset: "ludicrous" };
    expect(ChampionshipSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects empty tours array", () => {
    const broken = { ...championshipExample, tours: [] };
    expect(ChampionshipSchema.safeParse(broken).success).toBe(false);
  });
});

describe("AIDriverSchema", () => {
  it("accepts the §22 example", () => {
    expect(AIDriverSchema.safeParse(aiDriverExample).success).toBe(true);
  });

  it("rejects an unknown archetype", () => {
    const broken = { ...aiDriverExample, archetype: "rubber_band" };
    expect(AIDriverSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects mistakeRate above 1", () => {
    const broken = { ...aiDriverExample, mistakeRate: 1.5 };
    expect(AIDriverSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects negative paceScalar", () => {
    const broken = { ...aiDriverExample, paceScalar: -0.5 };
    expect(AIDriverSchema.safeParse(broken).success).toBe(false);
  });
});

describe("SaveGameSchema", () => {
  it("accepts the §22 example", () => {
    expect(SaveGameSchema.safeParse(saveGameExample).success).toBe(true);
  });

  it("rejects when version is missing", () => {
    const { version: _omit, ...broken } = saveGameExample;
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an unknown speed unit", () => {
    const broken = {
      ...saveGameExample,
      settings: {
        ...saveGameExample.settings,
        displaySpeedUnit: "knots",
      },
    };
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects negative credits", () => {
    const broken = {
      ...saveGameExample,
      garage: { ...saveGameExample.garage, credits: -1 },
    };
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts optional garage repair state", () => {
    const withRepairState = {
      ...saveGameExample,
      garage: {
        ...saveGameExample.garage,
        pendingDamage: {
          "sparrow-gt": {
            zones: {
              engine: 0.5,
              tires: 0.25,
              body: 0.5,
            },
            total: 0.45,
            offRoadAccumSeconds: 2,
          },
        },
        lastRaceCashEarned: 2000,
      },
    };

    expect(SaveGameSchema.safeParse(withRepairState).success).toBe(true);
  });

  it("accepts an optional active tour cursor", () => {
    const withActiveTour = {
      ...saveGameExample,
      progress: {
        ...saveGameExample.progress,
        activeTour: {
          tourId: "velvet-coast",
          raceIndex: 2,
          results: [
            {
              trackId: "velvet-coast/harbor-run",
              placement: 1,
              dnf: false,
              cashEarned: 1500,
            },
            {
              trackId: "velvet-coast/sunpier-loop",
              placement: 2,
              dnf: false,
              cashEarned: 1200,
            },
          ],
        },
      },
    };

    expect(SaveGameSchema.safeParse(withActiveTour).success).toBe(true);
  });

  it("rejects garage repair damage outside the unit interval", () => {
    const broken = {
      ...saveGameExample,
      garage: {
        ...saveGameExample.garage,
        pendingDamage: {
          "sparrow-gt": {
            zones: {
              engine: 1.5,
              tires: 0,
              body: 0,
            },
            total: 1.5,
            offRoadAccumSeconds: 0,
          },
        },
      },
    };

    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts a record with optional bestSplitsMs (sector splits)", () => {
    const withSplits = {
      ...saveGameExample,
      records: {
        "velvet-coast/harbor-run": {
          bestLapMs: 60000,
          bestRaceMs: 180000,
          bestSplitsMs: [20000, 40000, 60000],
        },
      },
    };
    expect(SaveGameSchema.safeParse(withSplits).success).toBe(true);
  });

  it("rejects a record with negative bestSplitsMs entries", () => {
    const broken = {
      ...saveGameExample,
      records: {
        "velvet-coast/harbor-run": {
          bestLapMs: 60000,
          bestRaceMs: 180000,
          bestSplitsMs: [20000, -1, 60000],
        },
      },
    };
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts a v1 record without bestSplitsMs (backwards-compatible)", () => {
    const v1Record = {
      ...saveGameExample,
      records: {
        "velvet-coast/harbor-run": {
          bestLapMs: 60000,
          bestRaceMs: 180000,
        },
      },
    };
    expect(SaveGameSchema.safeParse(v1Record).success).toBe(true);
  });

  it("accepts settings with transmissionMode set to 'manual'", () => {
    const withManual = {
      ...saveGameExample,
      settings: {
        ...saveGameExample.settings,
        transmissionMode: "manual",
      },
    };
    expect(SaveGameSchema.safeParse(withManual).success).toBe(true);
  });

  it("accepts settings without transmissionMode (backwards-compatible default)", () => {
    const { settings } = saveGameExample;
    const withoutMode = {
      ...saveGameExample,
      settings: {
        displaySpeedUnit: settings.displaySpeedUnit,
        assists: settings.assists,
        difficultyPreset: settings.difficultyPreset,
      },
    };
    expect(SaveGameSchema.safeParse(withoutMode).success).toBe(true);
  });

  it("rejects an unknown transmissionMode value", () => {
    const broken = {
      ...saveGameExample,
      settings: {
        ...saveGameExample.settings,
        transmissionMode: "semi-auto",
      },
    };
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts a save without a ghosts slot (backwards-compatible default)", () => {
    const { ghosts: _omit, ...withoutGhosts } = saveGameExample as typeof saveGameExample & {
      ghosts?: unknown;
    };
    expect(SaveGameSchema.safeParse(withoutGhosts).success).toBe(true);
  });

  it("accepts a save with a populated ghosts entry", () => {
    const withGhost = {
      ...saveGameExample,
      ghosts: {
        "velvet-coast/harbor-run": {
          formatVersion: 1,
          physicsVersion: 1,
          fixedStepMs: 16.6667,
          trackId: "velvet-coast/harbor-run",
          trackVersion: 1,
          carId: "sparrow-gt",
          seed: 0,
          totalTicks: 600,
          finalTimeMs: 10000,
          truncated: false,
          deltas: [
            { tick: 0, mask: 1, values: [0.5] },
            { tick: 60, mask: 2, values: [1] },
          ],
        },
      },
    };
    expect(SaveGameSchema.safeParse(withGhost).success).toBe(true);
  });

  it("rejects a ghosts entry whose finalTimeMs is negative", () => {
    const broken = {
      ...saveGameExample,
      ghosts: {
        "velvet-coast/harbor-run": {
          formatVersion: 1,
          physicsVersion: 1,
          fixedStepMs: 16.6667,
          trackId: "velvet-coast/harbor-run",
          trackVersion: 1,
          carId: "sparrow-gt",
          seed: 0,
          totalTicks: 0,
          finalTimeMs: -1,
          truncated: false,
          deltas: [],
        },
      },
    };
    expect(SaveGameSchema.safeParse(broken).success).toBe(false);
  });
});

describe("GhostReplayDeltaSchema", () => {
  it("accepts a typical numeric-and-boolean delta", () => {
    expect(
      GhostReplayDeltaSchema.safeParse({
        tick: 7,
        mask: 0b00000011,
        values: [0.42, true],
      }).success,
    ).toBe(true);
  });

  it("rejects mask 0 (no-change deltas are never persisted)", () => {
    expect(
      GhostReplayDeltaSchema.safeParse({ tick: 1, mask: 0, values: [] }).success,
    ).toBe(false);
  });

  it("rejects a mask larger than 8 bits", () => {
    expect(
      GhostReplayDeltaSchema.safeParse({ tick: 1, mask: 0x100, values: [] })
        .success,
    ).toBe(false);
  });

  it("rejects a negative tick", () => {
    expect(
      GhostReplayDeltaSchema.safeParse({ tick: -1, mask: 1, values: [0] })
        .success,
    ).toBe(false);
  });
});

describe("GhostReplaySchema", () => {
  const happy = {
    formatVersion: 1,
    physicsVersion: 1,
    fixedStepMs: 16.6667,
    trackId: "velvet-coast/harbor-run",
    trackVersion: 1,
    carId: "sparrow-gt",
    seed: 0,
    totalTicks: 0,
    finalTimeMs: 0,
    truncated: false,
    deltas: [],
  };

  it("accepts an empty-deltas replay (driver held neutral the whole way)", () => {
    expect(GhostReplaySchema.safeParse(happy).success).toBe(true);
  });

  it("rejects a non-positive formatVersion", () => {
    expect(
      GhostReplaySchema.safeParse({ ...happy, formatVersion: 0 }).success,
    ).toBe(false);
  });

  it("rejects a non-positive fixedStepMs", () => {
    expect(
      GhostReplaySchema.safeParse({ ...happy, fixedStepMs: 0 }).success,
    ).toBe(false);
  });

  it("rejects an invalid trackId slug", () => {
    expect(
      GhostReplaySchema.safeParse({ ...happy, trackId: "Bad Slug!" }).success,
    ).toBe(false);
  });

  it("rejects a negative totalTicks", () => {
    expect(
      GhostReplaySchema.safeParse({ ...happy, totalTicks: -1 }).success,
    ).toBe(false);
  });
});
