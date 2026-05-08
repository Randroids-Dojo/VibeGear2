import { describe, expect, it } from "vitest";

import { formatRaceShareText } from "../raceShareText";

describe("formatRaceShareText", () => {
  it("formats a finished tour result with track, tour, placement, time, and best lap", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: "Iron Borough",
      placement: 3,
      status: "finished",
      raceTimeMs: 134_318,
      bestLapMs: 42_156,
    });
    expect(text).toBe(
      [
        "VibeGear2 race result",
        "Iron Borough - Foundry Mile",
        "P3, 2:14.318",
        "Best lap 0:42.156",
      ].join("\n"),
    );
  });

  it("omits the best-lap line when no timed lap was set", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: "Iron Borough",
      placement: 3,
      status: "finished",
      raceTimeMs: 134_318,
      bestLapMs: null,
    });
    expect(text.split("\n")).toHaveLength(3);
    expect(text).not.toContain("Best lap");
  });

  it("omits the tour line when no tour is in scope", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: null,
      placement: 1,
      status: "finished",
      raceTimeMs: 100_000,
      bestLapMs: 30_000,
    });
    expect(text).toBe(
      [
        "VibeGear2 race result",
        "Foundry Mile",
        "P1, 1:40.000",
        "Best lap 0:30.000",
      ].join("\n"),
    );
  });

  it("renders a DNF without a placement, race time, or best lap", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: "Iron Borough",
      placement: null,
      status: "dnf",
      raceTimeMs: null,
      bestLapMs: 42_156,
    });
    expect(text).toBe(
      [
        "VibeGear2 race result",
        "Iron Borough - Foundry Mile",
        "DNF",
      ].join("\n"),
    );
  });

  it("uses 'Finished' as the placement label when the placement is unknown but the run finished", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: null,
      placement: null,
      status: "finished",
      raceTimeMs: 100_000,
      bestLapMs: null,
    });
    expect(text).toContain("Finished, 1:40.000");
  });

  it("formats sub-second milliseconds with three-digit padding", () => {
    const text = formatRaceShareText({
      trackName: "X",
      tourName: null,
      placement: 1,
      status: "finished",
      raceTimeMs: 12_007,
      bestLapMs: null,
    });
    expect(text).toContain("0:12.007");
  });

  it("handles long runs by switching to H:MM:SS.mmm", () => {
    const text = formatRaceShareText({
      trackName: "X",
      tourName: null,
      placement: 1,
      status: "finished",
      raceTimeMs: 3_725_000 + 123,
      bestLapMs: null,
    });
    expect(text).toContain("1:02:05.123");
  });

  it("never includes an em-dash in rendered text (project rule)", () => {
    const text = formatRaceShareText({
      trackName: "Foundry Mile",
      tourName: "Iron Borough",
      placement: 3,
      status: "finished",
      raceTimeMs: 134_318,
      bestLapMs: 42_156,
    });
    expect(text).not.toMatch(/[–—]/u);
  });
});
