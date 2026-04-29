import { describe, expect, it } from "vitest";

import { DEFAULT_TRACK } from "../defaultTrack";
import {
  addCheckpoint,
  addSegment,
  removeCheckpoint,
  removeSegment,
  setWeather,
  textToHazards,
  updateCheckpoint,
  updateSegment,
} from "../trackEditorState";

describe("trackEditorState", () => {
  it("keeps at least one weather selected", () => {
    const next = setWeather(DEFAULT_TRACK, "clear", false);
    expect(next.weatherOptions).toEqual(["clear"]);
  });

  it("updates segment fields without mutating the original track", () => {
    const next = updateSegment(DEFAULT_TRACK, 0, {
      len: 120,
      hazards: textToHazards("puddle, tunnel"),
      inTunnel: true,
    });
    expect(next.segments[0]!.len).toBe(120);
    expect(next.segments[0]!.hazards).toEqual(["puddle", "tunnel"]);
    expect(next.segments[0]!.inTunnel).toBe(true);
    expect(DEFAULT_TRACK.segments[0]!.len).not.toBe(120);
  });

  it("adds and removes segments while preserving the start checkpoint", () => {
    const added = addSegment(DEFAULT_TRACK);
    expect(added.segments).toHaveLength(DEFAULT_TRACK.segments.length + 1);
    expect(added.lengthMeters).toBe(DEFAULT_TRACK.lengthMeters + DEFAULT_TRACK.segments[0]!.len);
    const removed = removeSegment(added, 1);
    expect(removed.segments).toHaveLength(DEFAULT_TRACK.segments.length);
    expect(removed.lengthMeters).toBe(DEFAULT_TRACK.lengthMeters);
    expect(removed.checkpoints[0]).toEqual({ segmentIndex: 0, label: "start" });
  });

  it("locks the start checkpoint against edits and removal", () => {
    const edited = updateCheckpoint(DEFAULT_TRACK, 0, {
      segmentIndex: 3,
      label: "oops",
    });
    expect(edited.checkpoints[0]).toEqual({ segmentIndex: 0, label: "start" });
    expect(removeCheckpoint(edited, 0).checkpoints).toEqual(DEFAULT_TRACK.checkpoints);
  });

  it("adds editable checkpoints", () => {
    const next = addCheckpoint(DEFAULT_TRACK);
    expect(next.checkpoints).toHaveLength(2);
    expect(next.checkpoints[1]!.label).toBe("split-1");
  });
});
