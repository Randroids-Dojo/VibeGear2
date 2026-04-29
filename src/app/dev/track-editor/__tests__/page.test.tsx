import { describe, expect, it } from "vitest";

import { isTrackEditorEnabled } from "../page";

describe("track editor page gate", () => {
  it("is disabled in production even when the public flag is set", () => {
    expect(
      isTrackEditorEnabled(
        { NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR: "1" },
        "production",
      ),
    ).toBe(false);
  });

  it("is enabled outside production when the public flag is set", () => {
    expect(
      isTrackEditorEnabled(
        { NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR: "1" },
        "development",
      ),
    ).toBe(true);
  });

  it("is disabled when the public flag is absent", () => {
    expect(isTrackEditorEnabled({}, "development")).toBe(false);
  });
});
