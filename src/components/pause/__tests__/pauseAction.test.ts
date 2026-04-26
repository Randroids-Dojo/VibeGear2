import { describe, expect, it } from "vitest";

import { isPauseEvent, resolvePauseTokens } from "../pauseAction";

describe("resolvePauseTokens", () => {
  it("defaults to the §19 Escape binding", () => {
    expect(resolvePauseTokens()).toContain("Escape");
  });
});

describe("isPauseEvent", () => {
  it("matches the Escape code", () => {
    expect(isPauseEvent({ code: "Escape", key: "Escape", repeat: false })).toBe(true);
  });

  it("matches when only the key is Escape (older browsers / synthetic events)", () => {
    expect(isPauseEvent({ code: "", key: "Escape", repeat: false })).toBe(true);
  });

  it("rejects unrelated keys", () => {
    expect(isPauseEvent({ code: "KeyP", key: "p", repeat: false })).toBe(false);
  });

  it("ignores key-repeat to debounce held keys to a single edge", () => {
    expect(isPauseEvent({ code: "Escape", key: "Escape", repeat: true })).toBe(false);
  });

  it("accepts a custom token list", () => {
    expect(
      isPauseEvent({ code: "KeyP", key: "p", repeat: false }, ["KeyP"]),
    ).toBe(true);
  });
});
