/**
 * Unit tests for the F-092 slice 1 rival picker. Pin the deterministic
 * choice (highest paceScalar, ties broken by id ascending) and the
 * empty-grid early return so callers can branch on `null` without a
 * length check.
 */

import { describe, expect, it } from "vitest";

import type { AIDriver } from "@/data/schemas";
import { pickRival } from "@/game/rival";

function driver(
  id: string,
  displayName: string,
  paceScalar: number,
): AIDriver {
  return {
    id,
    displayName,
    archetype: "clean_line",
    paceScalar,
    mistakeRate: 0.1,
    aggression: 0.5,
    weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
    nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.5 },
  };
}

describe("pickRival", () => {
  it("returns null for an empty grid", () => {
    expect(pickRival({ drivers: [] })).toBeNull();
  });

  it("picks the driver with the highest paceScalar", () => {
    const ref = pickRival({
      drivers: [
        driver("ai_a", "A. One", 0.95),
        driver("ai_b", "B. Two", 1.05),
        driver("ai_c", "C. Three", 1.0),
      ],
    });
    expect(ref).toEqual({
      driverId: "ai_b",
      displayName: "B. Two",
      carId: "ai-1",
    });
  });

  it("breaks paceScalar ties on id ascending", () => {
    const ref = pickRival({
      drivers: [
        driver("ai_zeta", "Z", 1.0),
        driver("ai_alpha", "A", 1.0),
        driver("ai_mike", "M", 1.0),
      ],
    });
    expect(ref?.driverId).toBe("ai_alpha");
    expect(ref?.carId).toBe("ai-1");
  });

  it("threads the grid index into the carId", () => {
    const ref = pickRival({
      drivers: [
        driver("ai_a", "A", 1.0),
        driver("ai_b", "B", 1.0),
        driver("ai_c", "C", 1.1),
        driver("ai_d", "D", 0.9),
      ],
    });
    expect(ref?.carId).toBe("ai-2");
  });

  it("still returns a rival when the grid has a single driver", () => {
    const ref = pickRival({ drivers: [driver("ai_solo", "Solo", 1.0)] });
    expect(ref).toEqual({
      driverId: "ai_solo",
      displayName: "Solo",
      carId: "ai-0",
    });
  });
});
