import type { Track, TrackSegment } from "@/data/schemas";
import { SEGMENT_LENGTH } from "@/road/constants";

export const DEFAULT_TRACK: Track = {
  id: "dev-untitled",
  name: "Untitled Track",
  tourId: "dev",
  author: "local",
  version: 1,
  laps: 1,
  laneCount: 2,
  lengthMeters: SEGMENT_LENGTH * 4,
  weatherOptions: ["clear"],
  difficulty: 1,
  segments: [
    segment(),
    segment(),
    segment(),
    segment(),
  ],
  checkpoints: [{ segmentIndex: 0, label: "start" }],
  spawn: { gridSlots: 8 },
};

function segment(): TrackSegment {
  return {
    len: SEGMENT_LENGTH,
    curve: 0,
    grade: 0,
    roadsideLeft: "default",
    roadsideRight: "default",
    hazards: [],
  };
}
