import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";

import {
  DISPLAY_SPEED_UNIT_OPTIONS,
  applyDisplaySpeedUnit,
  readDisplaySpeedUnit,
} from "../displayPaneState";

describe("displayPaneState", () => {
  it("reads the default speed unit from the save settings", () => {
    expect(readDisplaySpeedUnit(defaultSave())).toBe("kph");
  });

  it("applies a speed unit without mutating the input save", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);

    const result = applyDisplaySpeedUnit(save, "mph");

    expect(result.kind).toBe("applied");
    expect(JSON.stringify(save)).toBe(before);
    if (result.kind === "applied") {
      expect(result.save.settings.displaySpeedUnit).toBe("mph");
      expect(result.save.settings.audio).toBe(save.settings.audio);
      expect(result.save.profileName).toBe(save.profileName);
    }
  });

  it("returns noop when applying the active unit", () => {
    expect(applyDisplaySpeedUnit(defaultSave(), "kph")).toEqual({
      kind: "noop",
      reason: "same-value",
    });
  });

  it("defines the two schema-backed speed unit options", () => {
    expect(DISPLAY_SPEED_UNIT_OPTIONS.map((option) => option.value)).toEqual([
      "kph",
      "mph",
    ]);
  });
});
