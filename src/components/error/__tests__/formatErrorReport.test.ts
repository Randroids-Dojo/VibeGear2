import { describe, expect, it } from "vitest";

import { formatErrorReport } from "../formatErrorReport";

describe("formatErrorReport", () => {
  it("includes name, message, and stack for an Error instance", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\n    at foo (file.ts:1:1)";
    const report = formatErrorReport({
      error,
      componentStack: "\n    in Foo\n    in Bar",
    });
    expect(report).toContain("VibeGear2 error report");
    expect(report).toContain("Name: Error");
    expect(report).toContain("Message: boom");
    expect(report).toContain("at foo (file.ts:1:1)");
    expect(report).toContain("Component stack:");
    expect(report).toContain("in Foo");
    expect(report).toContain("in Bar");
  });

  it("uses the error name from a custom subclass", () => {
    class TimeoutError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "TimeoutError";
      }
    }
    const report = formatErrorReport({ error: new TimeoutError("waited too long") });
    expect(report).toContain("Name: TimeoutError");
    expect(report).toContain("Message: waited too long");
  });

  it("falls back to a stringified value for non-Error throws", () => {
    expect(formatErrorReport({ error: "raw string" })).toContain("Thrown value: raw string");
    expect(formatErrorReport({ error: { code: 42 } })).toContain('Thrown value: {"code":42}');
  });

  it("omits the component stack section when none is provided", () => {
    const report = formatErrorReport({ error: new Error("x") });
    expect(report).not.toContain("Component stack:");
  });

  it("omits the component stack section when empty whitespace is provided", () => {
    const report = formatErrorReport({ error: new Error("x"), componentStack: "   \n  " });
    expect(report).not.toContain("Component stack:");
  });

  it("returns a single string suitable for clipboard write", () => {
    const report = formatErrorReport({ error: new Error("x") });
    expect(typeof report).toBe("string");
    expect(report.split("\n").length).toBeGreaterThan(1);
  });

  it("includes recent client errors when provided", () => {
    const report = formatErrorReport({
      error: new Error("x"),
      recentClientErrors: '[{"message":"captured"}]',
    });
    expect(report).toContain("Recent client errors:");
    expect(report).toContain('"captured"');
  });

  it("survives a value that throws inside JSON.stringify", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const report = formatErrorReport({ error: cyclic });
    expect(report).toContain("Thrown value:");
    expect(report).toContain("[object Object]");
  });
});
