/**
 * Unit tests for the F-096 slice 1 cosmetic-ledger helpers. Pin the
 * deterministic id format and the title-screen badge build so a
 * future slice that adds non-livery cosmetics or renames a tour does
 * not silently break the ledger contract.
 */

import { describe, expect, it } from "vitest";

import {
  appendUnlockedCosmetic,
  buildCosmeticBadges,
  cosmeticIdForTour,
} from "@/game/cosmetics";

describe("cosmeticIdForTour", () => {
  it("derives the livery id from the tour slug", () => {
    expect(cosmeticIdForTour("velvet-coast")).toBe("livery-velvet-coast");
    expect(cosmeticIdForTour("crown-circuit")).toBe("livery-crown-circuit");
  });
});

describe("appendUnlockedCosmetic", () => {
  it("seeds an empty list when the save has no unlockedCosmetics yet", () => {
    expect(appendUnlockedCosmetic(undefined, "livery-velvet-coast")).toEqual([
      "livery-velvet-coast",
    ]);
  });

  it("appends a new id to an existing list", () => {
    expect(
      appendUnlockedCosmetic(["livery-velvet-coast"], "livery-iron-borough"),
    ).toEqual(["livery-velvet-coast", "livery-iron-borough"]);
  });

  it("returns a copy without duplicating an already-present id", () => {
    const list = Object.freeze(["livery-velvet-coast"]);
    const result = appendUnlockedCosmetic(list, "livery-velvet-coast");
    expect(result).toEqual(["livery-velvet-coast"]);
    expect(result).not.toBe(list);
  });
});

describe("buildCosmeticBadges", () => {
  it("returns an empty list for an undefined or empty cosmetics array", () => {
    expect(buildCosmeticBadges(undefined)).toEqual([]);
    expect(buildCosmeticBadges([])).toEqual([]);
  });

  it("converts livery ids to title-cased badge labels", () => {
    expect(
      buildCosmeticBadges(["livery-velvet-coast", "livery-crown-circuit"]),
    ).toEqual([
      {
        cosmeticId: "livery-velvet-coast",
        tourId: "velvet-coast",
        label: "Velvet Coast livery",
      },
      {
        cosmeticId: "livery-crown-circuit",
        tourId: "crown-circuit",
        label: "Crown Circuit livery",
      },
    ]);
  });

  it("skips ids that do not match the livery prefix", () => {
    expect(
      buildCosmeticBadges([
        "livery-velvet-coast",
        "soundtrack-remix-a",
        "badge-podium-1",
      ]),
    ).toEqual([
      {
        cosmeticId: "livery-velvet-coast",
        tourId: "velvet-coast",
        label: "Velvet Coast livery",
      },
    ]);
  });

  it("skips a malformed livery id whose suffix is empty", () => {
    expect(buildCosmeticBadges(["livery-"])).toEqual([]);
  });
});
