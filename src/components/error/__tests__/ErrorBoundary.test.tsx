import { describe, expect, it } from "vitest";

import {
  ErrorBoundary,
  copyErrorReportToClipboard,
} from "../ErrorBoundary";

describe("ErrorBoundary", () => {
  it("tracks thrown null with an explicit hasError flag", () => {
    const state = ErrorBoundary.getDerivedStateFromError(null);
    expect(state).toEqual({ hasError: true, error: null });
  });
});

describe("copyErrorReportToClipboard", () => {
  it("swallows clipboard write rejections", async () => {
    const clipboard = {
      writeText: () => Promise.reject(new Error("denied")),
    };
    expect(() => copyErrorReportToClipboard(clipboard, "report")).not.toThrow();
    await Promise.resolve();
  });
});
