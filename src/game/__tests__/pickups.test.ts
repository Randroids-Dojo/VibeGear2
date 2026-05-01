import { describe, expect, it } from "vitest";

import { loadTrack } from "@/data";
import { evaluatePickups } from "@/game/pickups";
import { INITIAL_CAR_STATE } from "@/game/physics";

describe("evaluatePickups", () => {
  it("collects a matching pickup once per lap", () => {
    const track = loadTrack("test/straight");
    const first = evaluatePickups({
      car: { ...INITIAL_CAR_STATE, x: 0, z: 0 },
      track,
      lap: 1,
    });
    expect(first.events).toEqual([
      {
        key: "1:test-straight-cash",
        pickupId: "test-straight-cash",
        segmentIndex: 0,
        lap: 1,
        kind: "cash",
        value: 100,
      },
    ]);

    const sameLap = evaluatePickups({
      car: { ...INITIAL_CAR_STATE, x: 0, z: 6 },
      track,
      lap: 1,
      collectedPickups: first.collectedPickups,
    });
    expect(sameLap.events).toHaveLength(0);

    const nextLap = evaluatePickups({
      car: { ...INITIAL_CAR_STATE, x: 0, z: 0 },
      track,
      lap: 2,
      collectedPickups: sameLap.collectedPickups,
    });
    expect(nextLap.events.map((event) => event.key)).toEqual([
      "2:test-straight-cash",
    ]);
  });

  it("uses normalized lane offset against road-space car x", () => {
    const track = loadTrack("test/straight");
    const result = evaluatePickups({
      car: { ...INITIAL_CAR_STATE, x: 1.575, z: 0 },
      track,
      lap: 1,
    });
    expect(result.events.map((event) => event.pickupId)).toEqual([
      "test-straight-nitro",
    ]);
  });
});
