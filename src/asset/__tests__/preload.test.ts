import { describe, expect, it, vi } from "vitest";

import {
  hasCriticalFailure,
  preloadAll,
  PreloadAbortedError,
  type AssetEntry,
  type AssetFetcher,
  type AssetManifest,
  type DecodedAsset,
} from "../preload";

function entry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: "e",
    kind: "image",
    src: "/e.png",
    critical: true,
    license: "CC-BY-4.0",
    ...overrides,
  };
}

function imageAsset(): DecodedAsset {
  return { kind: "image", data: {} as HTMLImageElement };
}

function audioAsset(): DecodedAsset {
  return { kind: "audio", data: {} as AudioBuffer };
}

function jsonAsset(data: unknown = { ok: true }): DecodedAsset {
  return { kind: "json", data };
}

function staticFetcher(map: Record<string, () => Promise<DecodedAsset>>): AssetFetcher {
  return {
    fetch(e) {
      const factory = map[e.id];
      if (!factory) {
        return Promise.reject(new Error(`no fixture for ${e.id}`));
      }
      return factory();
    },
  };
}

describe("preloadAll", () => {
  it("returns an empty result for an empty manifest", async () => {
    const manifest: AssetManifest = { id: "empty", entries: [] };
    const fetcher = staticFetcher({});
    const result = await preloadAll(manifest, { fetcher });
    expect(result.assets.size).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it("resolves three images plus two audio plus one json deterministically", async () => {
    const manifest: AssetManifest = {
      id: "happy",
      entries: [
        entry({ id: "img-a", kind: "image", src: "/a.png" }),
        entry({ id: "img-b", kind: "image", src: "/b.png" }),
        entry({ id: "img-c", kind: "image", src: "/c.png" }),
        entry({ id: "snd-a", kind: "audio", src: "/a.ogg" }),
        entry({ id: "snd-b", kind: "audio", src: "/b.ogg" }),
        entry({ id: "json-a", kind: "json", src: "/a.json" }),
      ],
    };
    const fetcher = staticFetcher({
      "img-a": () => Promise.resolve(imageAsset()),
      "img-b": () => Promise.resolve(imageAsset()),
      "img-c": () => Promise.resolve(imageAsset()),
      "snd-a": () => Promise.resolve(audioAsset()),
      "snd-b": () => Promise.resolve(audioAsset()),
      "json-a": () => Promise.resolve(jsonAsset({ ok: true })),
    });
    const result = await preloadAll(manifest, { fetcher });
    expect(Array.from(result.assets.keys())).toEqual([
      "img-a",
      "img-b",
      "img-c",
      "snd-a",
      "snd-b",
      "json-a",
    ]);
    expect(result.failures).toEqual([]);
  });

  it("preserves manifest order even when entries resolve out of order", async () => {
    const manifest: AssetManifest = {
      id: "ordered",
      entries: [
        entry({ id: "first", kind: "image" }),
        entry({ id: "second", kind: "image" }),
        entry({ id: "third", kind: "image" }),
      ],
    };
    let resolveFirst: (value: DecodedAsset) => void = () => undefined;
    const fetcher: AssetFetcher = {
      fetch(e) {
        if (e.id === "first") {
          // Hold the first one open until last.
          return new Promise<DecodedAsset>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(imageAsset());
      },
    };
    const pending = preloadAll(manifest, { fetcher });
    // Yield the microtask queue so second / third settle first.
    await Promise.resolve();
    await Promise.resolve();
    resolveFirst(imageAsset());
    const result = await pending;
    expect(Array.from(result.assets.keys())).toEqual(["first", "second", "third"]);
  });

  it("returns the partial map plus a typed failure when one entry rejects", async () => {
    const manifest: AssetManifest = {
      id: "partial",
      entries: [
        entry({ id: "ok", kind: "image", critical: false }),
        entry({ id: "broken", kind: "image", critical: false }),
      ],
    };
    const fetcher = staticFetcher({
      ok: () => Promise.resolve(imageAsset()),
      broken: () => Promise.reject(new Error("not found")),
    });
    const result = await preloadAll(manifest, { fetcher });
    expect(Array.from(result.assets.keys())).toEqual(["ok"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.id).toBe("broken");
    expect(result.failures[0]?.critical).toBe(false);
    expect((result.failures[0]?.error as Error).message).toBe("not found");
  });

  it("treats a kind mismatch as a failure rather than a poisoned asset map", async () => {
    const manifest: AssetManifest = {
      id: "mismatch",
      entries: [entry({ id: "x", kind: "image" })],
    };
    const fetcher = staticFetcher({
      x: () => Promise.resolve(audioAsset()),
    });
    const result = await preloadAll(manifest, { fetcher });
    expect(result.assets.size).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect((result.failures[0]?.error as Error).message).toMatch(/declared as image/);
  });

  it("emits onProgress after each settled entry with running totals", async () => {
    const manifest: AssetManifest = {
      id: "progress",
      entries: [
        entry({ id: "a", kind: "image" }),
        entry({ id: "b", kind: "image", critical: false }),
        entry({ id: "c", kind: "image" }),
      ],
    };
    const fetcher = staticFetcher({
      a: () => Promise.resolve(imageAsset()),
      b: () => Promise.reject(new Error("nope")),
      c: () => Promise.resolve(imageAsset()),
    });
    const events: { id: string; outcome: string; completed: number; failed: number }[] = [];
    await preloadAll(manifest, {
      fetcher,
      onProgress: (event) => {
        events.push({
          id: event.entry.id,
          outcome: event.outcome,
          completed: event.completed,
          failed: event.failed,
        });
      },
    });
    expect(events).toHaveLength(3);
    // Last event must report the final running totals.
    expect(events.at(-1)?.completed).toBe(2);
    expect(events.at(-1)?.failed).toBe(1);
    // Every entry id appears once.
    expect(new Set(events.map((e) => e.id))).toEqual(new Set(["a", "b", "c"]));
  });

  it("aborts in-flight loads when the signal fires; subsequent calls do not log", async () => {
    const controller = new AbortController();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const manifest: AssetManifest = {
      id: "abort",
      entries: [entry({ id: "slow", kind: "image" })],
    };
    const fetcher: AssetFetcher = {
      fetch(_, signal) {
        return new Promise<DecodedAsset>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new PreloadAbortedError());
          });
        });
      },
    };
    const pending = preloadAll(manifest, { fetcher, signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.assets.size).toBe(0);
    // Aborted entries are dropped, not surfaced as failures.
    expect(result.failures).toEqual([]);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("treats AbortError name as cancellation regardless of error subclass", async () => {
    const controller = new AbortController();
    const manifest: AssetManifest = {
      id: "abort-name",
      entries: [entry({ id: "x", kind: "image" })],
    };
    const fetcher: AssetFetcher = {
      fetch() {
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      },
    };
    controller.abort();
    const result = await preloadAll(manifest, { fetcher, signal: controller.signal });
    expect(result.failures).toEqual([]);
  });
});

describe("hasCriticalFailure", () => {
  it("true when at least one failure is critical", () => {
    expect(
      hasCriticalFailure({
        assets: new Map(),
        failures: [
          { id: "a", kind: "image", critical: false, error: new Error("a") },
          { id: "b", kind: "image", critical: true, error: new Error("b") },
        ],
      }),
    ).toBe(true);
  });

  it("false when every failure is non-critical", () => {
    expect(
      hasCriticalFailure({
        assets: new Map(),
        failures: [{ id: "a", kind: "image", critical: false, error: new Error("a") }],
      }),
    ).toBe(false);
  });

  it("false when there are no failures", () => {
    expect(hasCriticalFailure({ assets: new Map(), failures: [] })).toBe(false);
  });
});
