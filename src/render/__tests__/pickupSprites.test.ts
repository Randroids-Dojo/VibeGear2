import { describe, expect, it } from "vitest";

import type { TrackPickup } from "@/data/schemas";
import type { Strip } from "@/road/types";
import { projectPickupSprites } from "../pickupSprites";

const pickupsById: Readonly<Record<string, TrackPickup>> = {
  cash: { id: "cash", kind: "cash", laneOffset: 0, value: 100 },
  nitro: { id: "nitro", kind: "nitro", laneOffset: 0.5, value: 25 },
};

describe("projectPickupSprites", () => {
  it("projects uncollected pickup ids from visible strips", () => {
    const sprites = projectPickupSprites({
      strips: [
        strip({ index: 0, pickupIds: [] }),
        strip({ index: 1, pickupIds: ["cash", "nitro"], screenW: 100 }),
      ],
      pickupsById,
      lap: 1,
    });

    expect(sprites).toMatchObject([
      {
        key: "1:cash",
        pickupId: "cash",
        kind: "cash",
        value: 100,
        screenX: 400,
        screenY: 240,
        depthMeters: 6,
      },
      {
        key: "1:nitro",
        pickupId: "nitro",
        kind: "nitro",
        value: 25,
        screenX: 450,
        screenY: 240,
        depthMeters: 6,
      },
    ]);
    expect(sprites[0]?.screenW).toBeCloseTo(14, 6);
    expect(sprites[1]?.screenW).toBeCloseTo(14, 6);
  });

  it("skips collected and far pickups", () => {
    const sprites = projectPickupSprites({
      strips: [
        strip({ index: 0, pickupIds: [] }),
        strip({ index: 1, pickupIds: ["cash"] }),
        strip({ index: 40, pickupIds: ["nitro"] }),
      ],
      pickupsById,
      lap: 1,
      collectedPickups: ["1:cash"],
      maxDistanceMeters: 6,
    });

    expect(sprites).toEqual([]);
  });

  it("uses lap 1 for corrupted lap values", () => {
    const sprites = projectPickupSprites({
      strips: [strip({ index: 1, pickupIds: ["cash"] })],
      pickupsById,
      lap: Number.NaN,
    });

    expect(sprites.map((sprite) => sprite.key)).toEqual([]);

    const visibleSprites = projectPickupSprites({
      strips: [
        strip({ index: 0, pickupIds: [] }),
        strip({ index: 1, pickupIds: ["cash"] }),
      ],
      pickupsById,
      lap: Number.NaN,
    });
    expect(visibleSprites.map((sprite) => sprite.key)).toEqual(["1:cash"]);
  });
});

function strip(input: {
  index: number;
  pickupIds: readonly string[];
  screenW?: number;
}): Strip {
  return {
    segment: {
      index: input.index,
      worldZ: input.index * 6,
      curve: 0,
      grade: 0,
      authoredIndex: 0,
      roadsideLeftId: "default",
      roadsideRightId: "default",
      hazardIds: [],
      pickupIds: input.pickupIds,
    },
    visible: true,
    screenX: 400,
    screenY: 240,
    screenW: input.screenW ?? 80,
    scale: 1,
    worldX: 0,
    worldY: 0,
  };
}
