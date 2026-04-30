import { describe, expect, it } from "vitest";

import { TRACK_RAW, TrackSchema, getChampionship } from "@/data";
import { defaultSave } from "@/persistence/save";

import {
  acceptDownloadedGhost,
  buildTimeTrialView,
  developerBenchmarkMs,
  timeTrialRaceHref,
} from "../timeTrialTargets";

const CHAMPIONSHIP_ID = "world-tour-standard";

describe("timeTrialRaceHref", () => {
  it("builds a Time Trial race link with the selected track and weather", () => {
    expect(
      timeTrialRaceHref({
        trackId: "velvet-coast/harbor-run",
        weather: "rain",
      }),
    ).toBe("/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=rain");
  });

  it("adds a downloaded ghost source when requested", () => {
    expect(
      timeTrialRaceHref({
        trackId: "velvet-coast/harbor-run",
        weather: "rain",
        ghost: "downloaded",
      }),
    ).toBe(
      "/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=rain&ghost=downloaded",
    );
  });
});

describe("developerBenchmarkMs", () => {
  it("returns official benchmark targets for bundled Time Trial tracks", () => {
    expect(developerBenchmarkMs("velvet-coast/harbor-run")).toBe(31_500);
    expect(developerBenchmarkMs("iron-borough/outer-exchange")).toBe(48_600);
  });

  it("returns null for tracks without an official target", () => {
    expect(developerBenchmarkMs("test/straight")).toBeNull();
  });
});

describe("buildTimeTrialView", () => {
  it("shows unlocked tracks with PBs, developer benchmarks, and start links", () => {
    const save = defaultSave();
    save.records["velvet-coast/harbor-run"] = {
      bestLapMs: 30_000,
      bestRaceMs: 90_000,
    };
    save.downloadedGhosts = {
      "velvet-coast/harbor-run": replay({
        trackId: "velvet-coast/harbor-run",
        finalTimeMs: 32_000,
      }),
    };
    const view = buildTimeTrialView({
      save,
      championship: getChampionship(CHAMPIONSHIP_ID),
      tracksById: buildTrackMap(),
    });

    const harbor = view.tracks.find(
      (track) => track.id === "velvet-coast/harbor-run",
    );
    expect(harbor).toMatchObject({
      name: "Harbor Run",
      personalBestLapMs: 30_000,
      personalBestRaceMs: 90_000,
      developerBenchmarkMs: 31_500,
      downloadedGhostTimeMs: 32_000,
      startHref:
        "/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=clear",
      startDownloadedGhostHref:
        "/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=clear&ghost=downloaded",
    });
  });

  it("limits the initial list to unlocked tour tracks", () => {
    const view = buildTimeTrialView({
      save: defaultSave(),
      championship: getChampionship(CHAMPIONSHIP_ID),
      tracksById: buildTrackMap(),
    });

    expect(view.tracks.map((track) => track.id)).toEqual([
      "velvet-coast/harbor-run",
      "velvet-coast/sunpier-loop",
      "velvet-coast/cliffline-arc",
      "velvet-coast/lighthouse-fall",
    ]);
  });
});

describe("acceptDownloadedGhost", () => {
  it("accepts a replay for the selected track and track version", () => {
    expect(
      acceptDownloadedGhost({
        trackId: "velvet-coast/harbor-run",
        trackVersion: 1,
        ghost: replay({ trackId: "velvet-coast/harbor-run" }),
      }),
    ).toBe(true);
  });

  it("rejects a replay for another track", () => {
    expect(
      acceptDownloadedGhost({
        trackId: "velvet-coast/harbor-run",
        trackVersion: 1,
        ghost: replay({ trackId: "iron-borough/freightline-ring" }),
      }),
    ).toBe(false);
  });
});

function buildTrackMap() {
  const entries = Object.values(TRACK_RAW).map((raw) => {
    const track = TrackSchema.parse(raw);
    return [track.id, track] as const;
  });
  return new Map(entries);
}

function replay(overrides: Partial<ReturnType<typeof replayBase>> = {}) {
  return { ...replayBase(), ...overrides };
}

function replayBase() {
  return {
    formatVersion: 1,
    physicsVersion: 1,
    fixedStepMs: 16.666666666666668,
    trackId: "velvet-coast/harbor-run",
    trackVersion: 1,
    carId: "sparrow-gt",
    seed: 0,
    totalTicks: 120,
    finalTimeMs: 2_000,
    truncated: false,
    deltas: [],
  };
}
