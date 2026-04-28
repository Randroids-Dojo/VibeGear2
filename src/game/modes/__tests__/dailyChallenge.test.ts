import { describe, expect, it } from "vitest";

import type { DailyChallengeTrack } from "../dailyChallenge";
import {
  dailyChallengeRaceHref,
  dailyDateKey,
  dailySeed,
  formatDailyChallengeShareText,
  selectDailyChallenge,
} from "../dailyChallenge";

const TRACKS: readonly DailyChallengeTrack[] = [
  { id: "velvet-coast/harbor-run", weatherOptions: ["clear", "rain", "fog"] },
  { id: "iron-borough/foundry-mile", weatherOptions: ["clear", "rain"] },
  { id: "velvet-coast/sunpier-loop", weatherOptions: ["clear", "rain"] },
];

describe("dailyDateKey", () => {
  it("uses the UTC day rather than local time", () => {
    expect(dailyDateKey(new Date("2026-04-26T03:00:00Z"))).toBe(
      "2026-04-26",
    );
    expect(dailyDateKey(new Date("2026-04-26T22:00:00Z"))).toBe(
      "2026-04-26",
    );
  });
});

describe("dailySeed", () => {
  it("is stable within one UTC day and changes on the next UTC day", () => {
    const early = dailySeed(new Date("2026-04-26T03:00:00Z"));
    const late = dailySeed(new Date("2026-04-26T22:00:00Z"));
    const next = dailySeed(new Date("2026-04-27T01:00:00Z"));
    expect(late).toBe(early);
    expect(next).not.toBe(early);
  });

  it("generates a distinct seed for 30 sequential UTC days", () => {
    const seeds = new Set<number>();
    for (let day = 1; day <= 30; day += 1) {
      const key = `2026-04-${`${day}`.padStart(2, "0")}T12:00:00Z`;
      seeds.add(dailySeed(new Date(key)));
    }
    expect(seeds.size).toBe(30);
  });
});

describe("selectDailyChallenge", () => {
  it("returns the same selection for repeated calls with the same inputs", () => {
    const date = new Date("2026-04-26T03:00:00Z");
    const first = selectDailyChallenge(date, TRACKS, ["balance", "power"]);
    for (let i = 0; i < 1000; i += 1) {
      expect(selectDailyChallenge(date, TRACKS, ["balance", "power"])).toEqual(
        first,
      );
    }
  });

  it("is independent from input track order", () => {
    const date = new Date("2026-04-26T03:00:00Z");
    const shuffled = [TRACKS[2]!, TRACKS[0]!, TRACKS[1]!];
    expect(selectDailyChallenge(date, shuffled, ["balance", "power"])).toEqual(
      selectDailyChallenge(date, TRACKS, ["balance", "power"]),
    );
  });

  it("chooses only authored weather for the selected track", () => {
    const challenge = selectDailyChallenge(
      new Date("2026-04-26T03:00:00Z"),
      TRACKS,
      ["balance", "power"],
    );
    const track = TRACKS.find((item) => item.id === challenge.trackId);
    expect(track?.weatherOptions).toContain(challenge.weather);
  });

  it("filters duplicate car classes into schema order", () => {
    const challenge = selectDailyChallenge(
      new Date("2026-04-26T03:00:00Z"),
      TRACKS,
      ["power", "balance", "power"],
    );
    expect(["balance", "power"]).toContain(challenge.carClass);
  });

  it("rejects empty track and car-class pools", () => {
    expect(() =>
      selectDailyChallenge(new Date("2026-04-26T03:00:00Z"), []),
    ).toThrow("eligible track");
    expect(() =>
      selectDailyChallenge(new Date("2026-04-26T03:00:00Z"), TRACKS, []),
    ).toThrow("car class");
  });
});

describe("dailyChallengeRaceHref", () => {
  it("builds a time-trial race link with fixed track and weather", () => {
    const challenge = selectDailyChallenge(
      new Date("2026-04-26T03:00:00Z"),
      TRACKS,
      ["balance", "power"],
    );
    const href = dailyChallengeRaceHref(challenge);
    expect(href).toContain("/race?");
    expect(href).toContain("mode=timeTrial");
    expect(href).toContain(`track=${encodeURIComponent(challenge.trackId)}`);
    expect(href).toContain(`weather=${challenge.weather}`);
  });
});

describe("formatDailyChallengeShareText", () => {
  it("formats an unfinished challenge with a no-result marker", () => {
    const challenge = selectDailyChallenge(
      new Date("2026-04-26T03:00:00Z"),
      TRACKS,
      ["balance", "power"],
    );
    expect(formatDailyChallengeShareText(challenge)).toContain(
      "VibeGear2 Daily 2026-04-26 no result",
    );
  });

  it("formats a completed challenge time", () => {
    const challenge = selectDailyChallenge(
      new Date("2026-04-26T03:00:00Z"),
      TRACKS,
      ["balance", "power"],
    );
    expect(formatDailyChallengeShareText(challenge, 83_456)).toContain(
      "VibeGear2 Daily 2026-04-26 1:23.456",
    );
  });
});
