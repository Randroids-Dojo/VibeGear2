import { describe, expect, it } from "vitest";

import { DEFAULT_TRACK } from "../defaultTrack";
import { exportTrack, importTrack, validateAndCompile } from "../io";

describe("track editor io", () => {
  it("validates and compiles the default track", () => {
    const result = validateAndCompile(DEFAULT_TRACK);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.compiled.trackId).toBe("dev-untitled");
      expect(result.compiled.totalCompiledSegments).toBe(4);
    }
  });

  it("returns a validation error without throwing", () => {
    const result = validateAndCompile({ ...DEFAULT_TRACK, segments: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Array must contain at least 1 element");
    }
  });

  it("exports newline-terminated JSON", async () => {
    const blob = exportTrack(DEFAULT_TRACK);
    const text = await blob.text();
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text).id).toBe(DEFAULT_TRACK.id);
  });

  it("imports valid JSON through schema and compiler", async () => {
    const result = await importTrack({
      text: async () => JSON.stringify(DEFAULT_TRACK),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON without mutating callers", async () => {
    const result = await importTrack({
      text: async () => "{",
    });
    expect(result.ok).toBe(false);
  });
});
