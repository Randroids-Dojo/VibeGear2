import { describe, expect, it } from "vitest";

import { HAZARDS_BY_ID } from "@/data";
import { loadTrack } from "@/data";
import { evaluateHazards } from "@/game/hazards";
import type { CarState } from "@/game/physics";

const TRACK = loadTrack("iron-borough/freightline-ring");

function car(overrides: Partial<CarState> = {}): CarState {
  return {
    x: 0,
    z: 245,
    speed: 30,
    surface: "road",
    ...overrides,
  };
}

describe("evaluateHazards", () => {
  it("emits a traffic cone hit on a matching compiled segment", () => {
    const effect = evaluateHazards({
      car: car(),
      track: TRACK,
      hazardsById: HAZARDS_BY_ID,
    });
    expect(effect.events).toHaveLength(1);
    expect(effect.events[0]?.hazard.id).toBe("traffic_cone");
    expect(effect.events[0]?.hit?.kind).toBe("offRoadObject");
    expect(effect.brokenHazards.has("40:traffic_cone")).toBe(true);
  });

  it("skips a broken breakable hazard on the next pass", () => {
    const first = evaluateHazards({
      car: car(),
      track: TRACK,
      hazardsById: HAZARDS_BY_ID,
    });
    const second = evaluateHazards({
      car: car(),
      track: TRACK,
      hazardsById: HAZARDS_BY_ID,
      brokenHazards: first.brokenHazards,
    });
    expect(second.events).toEqual([]);
  });

  it("deduplicates a breakable hazard repeated on one segment", () => {
    const baseSegment = TRACK.segments[0]!;
    const track = {
      ...TRACK,
      totalLengthMeters: 10,
      totalCompiledSegments: 1,
      segments: [
        {
          ...baseSegment,
          index: 0,
          worldZ: 0,
          hazardIds: ["traffic_cone", "traffic_cone"],
        },
      ],
    };
    const effect = evaluateHazards({
      car: car({ z: 5 }),
      track,
      hazardsById: HAZARDS_BY_ID,
    });
    expect(effect.events).toHaveLength(1);
    expect(effect.brokenHazards.has("0:traffic_cone")).toBe(true);
  });

  it("applies puddle grip without damage", () => {
    const track = loadTrack("velvet-coast/harbor-run");
    const effect = evaluateHazards({
      car: car({ z: 660 }),
      track,
      hazardsById: HAZARDS_BY_ID,
    });
    expect(effect.events[0]?.hazard.id).toBe("puddle");
    expect(effect.gripMultiplier).toBeCloseTo(0.65, 6);
    expect(effect.events[0]?.hit).toBeNull();
  });

  it("keeps tunnel metadata non-colliding for hazard physics", () => {
    const track = loadTrack("iron-borough/rivet-tunnel");
    const effect = evaluateHazards({
      car: car({ z: 505 }),
      track,
      hazardsById: HAZARDS_BY_ID,
    });
    expect(effect.events).toEqual([]);
    expect(effect.gripMultiplier).toBe(1);
  });
});
