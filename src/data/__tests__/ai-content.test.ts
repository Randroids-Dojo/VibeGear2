/**
 * Content tests for the AI driver registry.
 *
 * Each AI driver JSON under `src/data/ai/` must:
 * - validate against `AIDriverSchema` from `docs/gdd/22-data-schemas.md`,
 * - resolve to a unique id and a unique displayName when looked up via
 *   the registry,
 * - declare an archetype drawn from §22's `AIArchetypeSchema` enum,
 * - declare every required `weatherSkill` key (clear, rain, fog, snow),
 * - keep `paceScalar` inside the lightly-rubber-banded balancing window
 *   (§15 "Difficulty tiers": Master tops out at +9%, easiest CPUs sit
 *   around -8%, so a 0.9..1.1 envelope covers the expected MVP spread
 *   even before ai-grid mixes in difficulty modifiers).
 *
 * The §24 content plan calls for 20 AI driver profiles. The archetype
 * spread (4 nitro_burst, 4 clean_line, 3 aggressive, 3 defender,
 * 3 wet_specialist, 3 endurance) is documented at the head of
 * `src/data/ai/index.ts` and pinned by the structural test below.
 *
 * Adding a driver: drop a JSON next to the others, register it in
 * `src/data/ai/index.ts`, and update the expected `ARCHETYPE_DISTRIBUTION`
 * if the spread changes.
 */

import { describe, expect, it } from "vitest";

import {
  AI_DRIVERS,
  AI_DRIVERS_BY_ID,
  getAIDriver,
} from "@/data/ai";
import {
  AIArchetypeSchema,
  AIDriverSchema,
  type AIArchetype,
} from "@/data/schemas";

const EXPECTED_DRIVER_COUNT = 20;

const ARCHETYPE_DISTRIBUTION: Record<AIArchetype, number> = {
  nitro_burst: 4,
  clean_line: 4,
  aggressive: 3,
  defender: 3,
  wet_specialist: 3,
  endurance: 3,
};

const PACE_SCALAR_MIN = 0.9;
const PACE_SCALAR_MAX = 1.1;

// Hard-coded expected weatherSkill keys so the test fails if the schema
// drops one silently. The authoritative type is `AIWeatherSkill` from
// `@/data/schemas`.
const EXPECTED_WEATHER_KEYS = ["clear", "rain", "fog", "snow"] as const;

describe("AI driver catalogue", () => {
  it("exposes the full 20-driver roster from §24", () => {
    expect(AI_DRIVERS.length).toBe(EXPECTED_DRIVER_COUNT);
  });

  it("indexes every driver uniquely by id", () => {
    expect(AI_DRIVERS_BY_ID.size).toBe(AI_DRIVERS.length);
    for (const driver of AI_DRIVERS) {
      expect(getAIDriver(driver.id)).toBe(driver);
    }
  });

  it("uses unique displayNames across the roster", () => {
    const names = AI_DRIVERS.map((d) => d.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("matches the documented archetype distribution", () => {
    const counts: Record<AIArchetype, number> = {
      clean_line: 0,
      aggressive: 0,
      defender: 0,
      wet_specialist: 0,
      nitro_burst: 0,
      endurance: 0,
    };
    for (const driver of AI_DRIVERS) {
      counts[driver.archetype] += 1;
    }
    expect(counts).toEqual(ARCHETYPE_DISTRIBUTION);
  });

  it("returns undefined for unknown driver ids", () => {
    expect(getAIDriver("ai_nonexistent_99")).toBeUndefined();
  });
});

describe.each(AI_DRIVERS.map((driver) => [driver.id, driver] as const))(
  "AI driver JSON: %s",
  (_id, driver) => {
    it("validates against AIDriverSchema", () => {
      const result = AIDriverSchema.safeParse(driver);
      if (!result.success) {
        throw new Error(
          `AIDriverSchema rejected ${driver.id}: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
    });

    it("declares a known archetype", () => {
      const result = AIArchetypeSchema.safeParse(driver.archetype);
      expect(result.success).toBe(true);
    });

    it("declares all four weatherSkill keys", () => {
      for (const key of EXPECTED_WEATHER_KEYS) {
        expect(driver.weatherSkill[key]).toBeGreaterThan(0);
      }
      // Guard against extra/typo keys silently slipping in alongside the
      // four required ones.
      expect(Object.keys(driver.weatherSkill).sort()).toEqual(
        [...EXPECTED_WEATHER_KEYS].sort(),
      );
    });

    it("keeps paceScalar inside the §15-aware balancing envelope", () => {
      expect(driver.paceScalar).toBeGreaterThanOrEqual(PACE_SCALAR_MIN);
      expect(driver.paceScalar).toBeLessThanOrEqual(PACE_SCALAR_MAX);
    });

    it("declares mistakeRate, aggression, and nitroUsage biases in [0, 1]", () => {
      expect(driver.mistakeRate).toBeGreaterThanOrEqual(0);
      expect(driver.mistakeRate).toBeLessThanOrEqual(1);
      expect(driver.aggression).toBeGreaterThanOrEqual(0);
      expect(driver.aggression).toBeLessThanOrEqual(1);
      expect(driver.nitroUsage.launchBias).toBeGreaterThanOrEqual(0);
      expect(driver.nitroUsage.launchBias).toBeLessThanOrEqual(1);
      expect(driver.nitroUsage.straightBias).toBeGreaterThanOrEqual(0);
      expect(driver.nitroUsage.straightBias).toBeLessThanOrEqual(1);
      expect(driver.nitroUsage.panicBias).toBeGreaterThanOrEqual(0);
      expect(driver.nitroUsage.panicBias).toBeLessThanOrEqual(1);
    });
  },
);
