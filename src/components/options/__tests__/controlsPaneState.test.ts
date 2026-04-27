import { describe, expect, it } from "vitest";

import { defaultSave } from "@/persistence";

import {
  applyPrimaryKeyBinding,
  defaultKeyBindings,
  formatKeyToken,
  primaryBindingLabel,
  readKeyBindings,
  resetKeyBindings,
  tokenFromKeyboardEvent,
} from "../controlsPaneState";

describe("controlsPaneState", () => {
  it("reads default key bindings from a fresh save", () => {
    const bindings = readKeyBindings(defaultSave());

    expect(bindings.accelerate).toEqual(["ArrowUp", "KeyW"]);
    expect(bindings.nitro).toEqual(["Space"]);
  });

  it("applies a primary key binding without mutating the input save", () => {
    const save = defaultSave();
    const before = JSON.stringify(save);

    const result = applyPrimaryKeyBinding(save, "nitro", "KeyN");

    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.save.settings.keyBindings?.nitro).toEqual(["KeyN"]);
      expect(primaryBindingLabel(readKeyBindings(result.save), "nitro")).toBe("N");
    }
    expect(JSON.stringify(save)).toBe(before);
  });

  it("rejects a token already bound to another action", () => {
    const result = applyPrimaryKeyBinding(defaultSave(), "nitro", "KeyW");

    expect(result).toEqual({
      kind: "error",
      reason: "conflict",
      conflictingAction: "accelerate",
    });
  });

  it("returns noop when assigning the same single binding", () => {
    const changed = applyPrimaryKeyBinding(defaultSave(), "nitro", "KeyN");
    expect(changed.kind).toBe("applied");
    if (changed.kind !== "applied") return;

    expect(applyPrimaryKeyBinding(changed.save, "nitro", "KeyN")).toEqual({
      kind: "noop",
      reason: "same-binding",
    });
  });

  it("resets key bindings to defaults", () => {
    const changed = applyPrimaryKeyBinding(defaultSave(), "handbrake", "KeyH");
    expect(changed.kind).toBe("applied");
    if (changed.kind !== "applied") return;

    expect(resetKeyBindings(changed.save).settings.keyBindings).toEqual(
      defaultKeyBindings(),
    );
  });

  it("formats common keyboard event tokens for display", () => {
    expect(formatKeyToken("KeyA")).toBe("A");
    expect(formatKeyToken("Digit7")).toBe("7");
    expect(formatKeyToken("ArrowLeft")).toBe("Left");
    expect(formatKeyToken("Escape")).toBe("Esc");
    expect(formatKeyToken("ShiftRight")).toBe("Right Shift");
    expect(formatKeyToken("Space")).toBe("Space");
  });

  it("prefers KeyboardEvent.code over key for layout-independent bindings", () => {
    expect(tokenFromKeyboardEvent({ code: "KeyZ", key: "z" })).toBe("KeyZ");
    expect(tokenFromKeyboardEvent({ code: "", key: "?" })).toBe("?");
  });
});
