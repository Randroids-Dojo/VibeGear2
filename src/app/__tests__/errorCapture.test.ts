import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCapturedErrors,
  installErrorCapture,
  resetGlobalErrorCaptureForTests,
  type CapturedError,
} from "../errorCapture";

class FakeTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const bucket = this.listeners.get(type) ?? new Set<EventListener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, payload: Record<string, unknown>): void {
    const event = new Event(type);
    Object.assign(event, payload);
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe("installErrorCapture", () => {
  afterEach(() => {
    resetGlobalErrorCaptureForTests();
    vi.restoreAllMocks();
  });

  it("installs as a no-op without a window target", () => {
    const handle = installErrorCapture({ target: null });

    expect(handle.getRecent()).toEqual([]);
    expect(handle.capture(new Error("server-side"))?.message).toBe("server-side");
    expect(handle.getRecent()).toHaveLength(1);
    expect(() => handle.uninstall()).not.toThrow();
  });

  it("captures distinct window error events", () => {
    const target = new FakeTarget();
    const handle = installErrorCapture({
      target,
      now: () => 1000,
      userAgent: "TestBrowser",
      buildId: "abc123",
      buildVersion: "0.1.0",
    });

    target.dispatch("error", { error: new Error("first") });
    target.dispatch("error", { error: new Error("second") });

    expect(handle.getRecent()).toMatchObject([
      { message: "first", buildId: "abc123", buildVersion: "0.1.0", userAgent: "TestBrowser" },
      { message: "second", buildId: "abc123", buildVersion: "0.1.0", userAgent: "TestBrowser" },
    ]);
  });

  it("deduplicates repeated stack prefixes and increments count", () => {
    const target = new FakeTarget();
    const handle = installErrorCapture({ target });
    const error = new Error("loop crash");
    error.stack = "Error: loop crash\n    at tick (game.ts:1:1)\n    at frame (loop.ts:2:1)";

    for (let i = 0; i < 100; i += 1) {
      target.dispatch("error", { error });
    }

    expect(handle.getRecent()).toHaveLength(1);
    expect(handle.getRecent()[0]).toMatchObject({
      message: "loop crash",
      count: 100,
    });
  });

  it("caps the ring buffer and evicts oldest entries", () => {
    const target = new FakeTarget();
    const handle = installErrorCapture({ target, limit: 3 });

    for (let i = 0; i < 5; i += 1) {
      target.dispatch("error", { error: new Error(`error-${i}`) });
    }

    expect(handle.getRecent().map((entry) => entry.message)).toEqual([
      "error-2",
      "error-3",
      "error-4",
    ]);
  });

  it("captures unhandled rejection reasons", () => {
    const target = new FakeTarget();
    const handle = installErrorCapture({ target });

    target.dispatch("unhandledrejection", { reason: "promise boom" });

    expect(handle.getRecent()[0]?.message).toBe("promise boom");
  });

  it("does not call fetch or XHR when no sink is configured", () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("XMLHttpRequest", xhrSpy);
    const target = new FakeTarget();
    const handle = installErrorCapture({ target });

    target.dispatch("error", { error: new Error("offline only") });

    expect(handle.getRecent()).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it("calls a configured sink with the deduplicated payload", async () => {
    const target = new FakeTarget();
    const sink = { report: vi.fn((_: CapturedError) => undefined) };
    const handle = installErrorCapture({ target, sink });

    target.dispatch("error", { error: new Error("send me") });
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.report).toHaveBeenCalledTimes(1);
    expect(sink.report.mock.calls[0]?.[0]).toMatchObject({
      message: "send me",
      count: 1,
    });
    expect(handle.getRecent()).toHaveLength(1);
  });

  it("swallows sink rejections and keeps capture alive", async () => {
    const target = new FakeTarget();
    const warn = vi.fn();
    const sink = { report: vi.fn(() => Promise.reject(new Error("sink down"))) };
    const handle = installErrorCapture({ target, sink, logger: { warn } });

    target.dispatch("error", { error: new Error("still capture") });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handle.getRecent()[0]?.message).toBe("still capture");
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("formatCapturedErrors", () => {
  it("formats the buffer as plain JSON", () => {
    const text = formatCapturedErrors([
      {
        id: "err-1",
        message: "boom",
        stackPrefix: "<no-stack>",
        timestamp: 123,
        count: 1,
        buildId: "abc",
        buildVersion: "0.1.0",
        userAgent: "Browser",
      },
    ]);

    expect(text).toContain('"message": "boom"');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
