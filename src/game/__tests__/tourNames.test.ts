/**
 * Unit tests for the F-097 follow-up tour-name resolver. Pin the
 * authored-name path and the title-cased slug fallback so a future
 * data rename or schema migration cannot silently regress copy
 * surfaces (locked-car tooltip, future prep-card / results banner).
 */

import { describe, expect, it } from "vitest";

import type { Championship } from "@/data/schemas";
import { resolveTourName } from "@/game/tourNames";

function championship(tours: ReadonlyArray<{ id: string; name?: string }>): Championship {
  return {
    id: "test-championship",
    name: "Test Championship",
    difficultyPreset: "normal",
    tours: tours.map((t) => ({
      id: t.id,
      requiredStanding: 4,
      tracks: ["test/track"],
      ...(t.name !== undefined ? { name: t.name } : {}),
    })),
  } as Championship;
}

describe("resolveTourName", () => {
  it("returns the authored name when present", () => {
    const c = championship([{ id: "iron-borough", name: "Iron Borough" }]);
    expect(resolveTourName(c, "iron-borough")).toBe("Iron Borough");
  });

  it("falls back to title-casing the slug when the tour has no name", () => {
    const c = championship([{ id: "ember-steppe" }]);
    expect(resolveTourName(c, "ember-steppe")).toBe("Ember Steppe");
  });

  it("falls back to title-casing the slug when the tour is unknown", () => {
    const c = championship([{ id: "iron-borough", name: "Iron Borough" }]);
    expect(resolveTourName(c, "ghost-tour")).toBe("Ghost Tour");
  });

  it("falls back to title-casing when the championship is undefined", () => {
    expect(resolveTourName(undefined, "crown-circuit")).toBe("Crown Circuit");
  });

  it("returns 'the next tour' for an empty slug", () => {
    expect(resolveTourName(undefined, "")).toBe("the next tour");
  });
});
