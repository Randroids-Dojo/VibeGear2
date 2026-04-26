/**
 * Content tests for `src/data/sponsors.json`.
 *
 * Every shipped sponsor objective must:
 * - validate against `SponsorObjectiveSchema`,
 * - resolve to a unique id when looked up via the registry,
 * - be evaluable from a fixture race state without throwing
 *   (`evaluateSponsorObjective` returns `boolean`, never throws).
 *
 * Mirrors the `upgrades-content` / `cars-content` content-test pattern.
 */

import { describe, expect, it } from "vitest";

import {
  SPONSOR_OBJECTIVES,
  SPONSOR_OBJECTIVES_BY_ID,
  getSponsorObjective,
} from "@/data/sponsors";
import { SponsorObjectiveSchema } from "@/data/schemas";

import { evaluateSponsorObjective } from "@/game/raceBonuses";

describe("sponsor catalogue", () => {
  it("ships at least one sponsor objective", () => {
    expect(SPONSOR_OBJECTIVES.length).toBeGreaterThan(0);
  });

  it("indexes every objective uniquely by id", () => {
    expect(SPONSOR_OBJECTIVES_BY_ID.size).toBe(SPONSOR_OBJECTIVES.length);
    for (const obj of SPONSOR_OBJECTIVES) {
      expect(getSponsorObjective(obj.id)).toBe(obj);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(getSponsorObjective("definitely-not-a-sponsor")).toBeUndefined();
  });
});

describe.each(SPONSOR_OBJECTIVES.map((s) => [s.id, s] as const))(
  "sponsor objective: %s",
  (_id, obj) => {
    it("validates against SponsorObjectiveSchema", () => {
      const result = SponsorObjectiveSchema.safeParse(obj);
      if (!result.success) {
        throw new Error(
          `SponsorObjectiveSchema rejected ${obj.id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });

    it("is evaluable from a baseline RaceState without throwing", () => {
      expect(() =>
        evaluateSponsorObjective({
          objective: obj,
          placement: 1,
          damageBefore: { engine: 0, tires: 0, body: 0 },
          damageAfter: { engine: 0, tires: 0, body: 0 },
          context: {
            playerTopSpeed: 80,
            playerNitroFired: false,
            weatherAtFinish: "clear",
          },
        }),
      ).not.toThrow();
    });

    it("declares a non-negative cashCredits payout", () => {
      expect(obj.cashCredits).toBeGreaterThanOrEqual(0);
    });
  },
);
