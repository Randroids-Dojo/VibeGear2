import { beforeEach, describe, expect, it, vi } from "vitest";

import saveExample from "@/data/examples/saveGame.example.json" with { type: "json" };
import v1DefaultSave from "./migrations/__fixtures__/v1-default-save.json" with { type: "json" };
import v2DefaultSave from "./migrations/__fixtures__/v2-default-save.json" with { type: "json" };
import {
  CURRENT_SAVE_VERSION,
  backupKey,
  defaultSave,
  loadSave,
  reloadIfNewer,
  saveSave,
  storageKey,
  subscribeToSaveChanges,
  type SaveEventTarget,
  type SaveLogger,
  type StorageEventLike,
} from "./save";

/**
 * Minimal in-memory Storage shim. Configurable to throw a quota error or
 * return a hostile getItem so each failure path can be exercised
 * deterministically.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  throwOnSet: ((key: string, value: string) => Error | null) | null = null;
  throwOnGet: ((key: string) => Error | null) | null = null;

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      const err = this.throwOnGet(key);
      if (err) throw err;
    }
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      const err = this.throwOnSet(key, value);
      if (err) throw err;
    }
    this.map.set(key, value);
  }
}

function silentLogger(): SaveLogger {
  return { warn: vi.fn() };
}

describe("storage keys", () => {
  it("namespaces keys by current schema version", () => {
    expect(storageKey(CURRENT_SAVE_VERSION)).toBe(`vibegear2:save:v${CURRENT_SAVE_VERSION}`);
    expect(backupKey(CURRENT_SAVE_VERSION)).toBe(`vibegear2:save:v${CURRENT_SAVE_VERSION}:backup`);
  });
});

describe("defaultSave", () => {
  it("validates against the SaveGame schema", async () => {
    const { SaveGameSchema } = await import("@/data/schemas");
    expect(SaveGameSchema.safeParse(defaultSave()).success).toBe(true);
  });

  it("seeds separate PB and downloaded ghost maps", () => {
    const save = defaultSave();
    expect(save.ghosts).toEqual({});
    expect(save.downloadedGhosts).toEqual({});
  });
});

describe("loadSave", () => {
  let storage: MemoryStorage;
  let logger: SaveLogger;

  beforeEach(() => {
    storage = new MemoryStorage();
    logger = silentLogger();
  });

  it("returns the default save when storage is unavailable", () => {
    const result = loadSave({ storage: null, logger });
    expect(result).toEqual({ kind: "default", reason: "no-storage" });
  });

  it("returns the default save when no key exists", () => {
    const result = loadSave({ storage, logger });
    expect(result).toEqual({ kind: "default", reason: "missing" });
  });

  it("loads and validates an existing save", () => {
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), JSON.stringify(saveExample));
    const result = loadSave({ storage, logger });
    expect(result.kind).toBe("loaded");
    if (result.kind === "loaded") {
      expect(result.save.profileName).toBe(saveExample.profileName);
      expect(result.save.garage.credits).toBe(saveExample.garage.credits);
    }
  });

  it("falls back to a v2 key, migrates, and writes the current key", () => {
    storage.setItem(storageKey(2), JSON.stringify(v2DefaultSave));
    const result = loadSave({ storage, logger });
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.save.ghosts).toEqual({});
    expect(storage.getItem(storageKey(CURRENT_SAVE_VERSION))).not.toBeNull();
  });

  it("falls back through v2 to a v1 key when no newer save exists", () => {
    storage.setItem(storageKey(1), JSON.stringify(v1DefaultSave));
    const result = loadSave({ storage, logger });
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.save.settings.audio).toEqual({
      master: 1,
      music: 0.8,
      sfx: 0.9,
    });
    expect(result.save.ghosts).toEqual({});
    expect(storage.getItem(storageKey(CURRENT_SAVE_VERSION))).not.toBeNull();
  });

  it("falls back to default and preserves a backup when JSON is corrupted", () => {
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), "{not json");
    const result = loadSave({ storage, logger });
    expect(result).toEqual({ kind: "default", reason: "corrupted-json" });
    expect(storage.getItem(backupKey(CURRENT_SAVE_VERSION))).toBe("{not json");
  });

  it("falls back to default and preserves a backup when schema validation fails", () => {
    const broken = { ...saveExample, version: saveExample.version, garage: { ...saveExample.garage, credits: -5 } };
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), JSON.stringify(broken));
    const result = loadSave({ storage, logger });
    expect(result).toEqual({ kind: "default", reason: "schema-invalid" });
    expect(storage.getItem(backupKey(CURRENT_SAVE_VERSION))).not.toBeNull();
  });

  it("falls back when getItem itself throws (locked storage)", () => {
    storage.throwOnGet = () => new Error("locked");
    const result = loadSave({ storage, logger });
    expect(result).toEqual({ kind: "default", reason: "no-storage" });
  });

  it("refuses a future-major save and preserves it", () => {
    const future = { ...saveExample, version: CURRENT_SAVE_VERSION + 1 };
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), JSON.stringify(future));
    const result = loadSave({ storage, logger });
    expect(result).toEqual({ kind: "default", reason: "migration-failed" });
    expect(storage.getItem(backupKey(CURRENT_SAVE_VERSION))).not.toBeNull();
  });
});

describe("saveSave", () => {
  let storage: MemoryStorage;
  let logger: SaveLogger;

  beforeEach(() => {
    storage = new MemoryStorage();
    logger = silentLogger();
  });

  it("writes the validated save to the versioned key", () => {
    const state = defaultSave();
    const result = saveSave(state, { storage, logger });
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" ? result.save.writeCounter : null).toBe(1);

    const raw = storage.getItem(storageKey(CURRENT_SAVE_VERSION));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).profileName).toBe(state.profileName);
  });

  it("refuses to persist an invalid save", () => {
    const state = { ...defaultSave(), garage: { ...defaultSave().garage, credits: -1 } };
    const result = saveSave(state, { storage, logger });
    expect(result).toEqual({ kind: "error", reason: "serialization-failed" });
    expect(storage.getItem(storageKey(CURRENT_SAVE_VERSION))).toBeNull();
  });

  it("returns no-storage when localStorage is unavailable", () => {
    const result = saveSave(defaultSave(), { storage: null, logger });
    expect(result).toEqual({ kind: "error", reason: "no-storage" });
  });

  it("surfaces quota-exceeded as a typed error", () => {
    const quota = new Error("quota");
    quota.name = "QuotaExceededError";
    storage.throwOnSet = () => quota;
    const result = saveSave(defaultSave(), { storage, logger });
    expect(result).toEqual({ kind: "error", reason: "quota-exceeded" });
  });

  it("treats unknown setItem errors as no-storage", () => {
    storage.throwOnSet = () => new Error("permission denied");
    const result = saveSave(defaultSave(), { storage, logger });
    expect(result).toEqual({ kind: "error", reason: "no-storage" });
  });
});

describe("round-trip", () => {
  it("survives saveSave then loadSave", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    const original = defaultSave();
    expect(saveSave(original, { storage, logger }).kind).toBe("ok");

    const loaded = loadSave({ storage, logger });
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind === "loaded") {
      // saveSave increments the cross-tab writeCounter on persist, so the
      // round-tripped value is one tick ahead of the in-memory original.
      // Every other field is identical.
      const { writeCounter: _ignored, ...originalRest } = original;
      const { writeCounter: loadedCounter, ...loadedRest } = loaded.save;
      expect(loadedRest).toEqual(originalRest);
      expect(loadedCounter).toBe((original.writeCounter ?? 0) + 1);
    }
  });
});

describe("writeCounter", () => {
  it("seeds defaultSave at 0", () => {
    expect(defaultSave().writeCounter).toBe(0);
  });

  it("increments on every saveSave", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();

    saveSave(defaultSave(), { storage, logger });
    const first = loadSave({ storage, logger });
    expect(first.kind).toBe("loaded");
    if (first.kind !== "loaded") return;
    expect(first.save.writeCounter).toBe(1);

    saveSave(first.save, { storage, logger });
    const second = loadSave({ storage, logger });
    expect(second.kind).toBe("loaded");
    if (second.kind !== "loaded") return;
    expect(second.save.writeCounter).toBe(2);
  });

  it("treats a missing writeCounter as 0 and seeds it on the first write", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    const noCounter = { ...defaultSave() };
    delete (noCounter as { writeCounter?: unknown }).writeCounter;

    saveSave(noCounter as ReturnType<typeof defaultSave>, { storage, logger });
    const result = loadSave({ storage, logger });
    expect(result.kind).toBe("loaded");
    if (result.kind === "loaded") {
      expect(result.save.writeCounter).toBe(1);
    }
  });

  it("last-write-wins across two writers sharing one storage backing", () => {
    // Two MemoryStorage shims sharing a backing map model two browser tabs
    // pointed at the same origin. A late writer's persist always wins; the
    // earlier write's writeCounter is overwritten by the later one. The
    // counter strictly increases across the two writes.
    const backing = new Map<string, string>();
    class SharedStorage extends MemoryStorage {
      override getItem(key: string): string | null {
        return backing.has(key) ? (backing.get(key) as string) : null;
      }
      override setItem(key: string, value: string): void {
        backing.set(key, value);
      }
      override removeItem(key: string): void {
        backing.delete(key);
      }
    }
    const tabA = new SharedStorage();
    const tabB = new SharedStorage();
    const logger = silentLogger();

    saveSave(defaultSave(), { storage: tabA, logger });
    const tabAReadAfterFirst = loadSave({ storage: tabA, logger });
    expect(tabAReadAfterFirst.kind).toBe("loaded");
    if (tabAReadAfterFirst.kind !== "loaded") return;
    expect(tabAReadAfterFirst.save.writeCounter).toBe(1);

    // Tab B persists its own write next: counter goes 1 -> 2.
    saveSave(tabAReadAfterFirst.save, { storage: tabB, logger });
    const finalRead = loadSave({ storage: tabA, logger });
    expect(finalRead.kind).toBe("loaded");
    if (finalRead.kind !== "loaded") return;
    expect(finalRead.save.writeCounter).toBe(2);
  });
});

class StorageEventBus implements SaveEventTarget {
  private handlers = new Set<(event: StorageEventLike) => void>();
  addEventListener(
    type: "storage",
    handler: (event: StorageEventLike) => void,
  ): void {
    if (type !== "storage") return;
    this.handlers.add(handler);
  }
  removeEventListener(
    type: "storage",
    handler: (event: StorageEventLike) => void,
  ): void {
    if (type !== "storage") return;
    this.handlers.delete(handler);
  }
  emit(event: StorageEventLike): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
  get listenerCount(): number {
    return this.handlers.size;
  }
}

describe("subscribeToSaveChanges", () => {
  it("invokes the callback when a foreign tab writes the save key", () => {
    const bus = new StorageEventBus();
    const logger = silentLogger();
    const callback = vi.fn();
    const unsubscribe = subscribeToSaveChanges(callback, {
      target: bus,
      logger,
    });

    const next = { ...defaultSave(), writeCounter: 5 };
    bus.emit({
      key: storageKey(CURRENT_SAVE_VERSION),
      newValue: JSON.stringify(next),
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0].writeCounter).toBe(5);
    unsubscribe();
  });

  it("ignores events for unrelated keys (backup, mods, leaderboards)", () => {
    const bus = new StorageEventBus();
    const callback = vi.fn();
    subscribeToSaveChanges(callback, {
      target: bus,
      logger: silentLogger(),
    });

    bus.emit({
      key: backupKey(CURRENT_SAVE_VERSION),
      newValue: JSON.stringify({ ...defaultSave(), writeCounter: 9 }),
    });
    bus.emit({
      key: "vibegear2:mods:index",
      newValue: "{}",
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores events whose newValue is null (clear / removeItem)", () => {
    const bus = new StorageEventBus();
    const callback = vi.fn();
    subscribeToSaveChanges(callback, {
      target: bus,
      logger: silentLogger(),
    });
    bus.emit({ key: storageKey(CURRENT_SAVE_VERSION), newValue: null });
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not invoke the callback when the foreign payload fails schema validation", () => {
    const bus = new StorageEventBus();
    const callback = vi.fn();
    subscribeToSaveChanges(callback, {
      target: bus,
      logger: silentLogger(),
    });

    bus.emit({
      key: storageKey(CURRENT_SAVE_VERSION),
      newValue: JSON.stringify({ version: 2, garbage: true }),
    });
    bus.emit({
      key: storageKey(CURRENT_SAVE_VERSION),
      newValue: "{not json",
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("returns a no-op unsubscribe when no event target is available", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToSaveChanges(callback, {
      target: null,
      logger: silentLogger(),
    });
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("removes the listener when unsubscribe is called", () => {
    const bus = new StorageEventBus();
    const callback = vi.fn();
    const unsubscribe = subscribeToSaveChanges(callback, {
      target: bus,
      logger: silentLogger(),
    });
    expect(bus.listenerCount).toBe(1);
    unsubscribe();
    expect(bus.listenerCount).toBe(0);
    // Calling unsubscribe a second time is a no-op.
    expect(() => unsubscribe()).not.toThrow();
    expect(bus.listenerCount).toBe(0);
  });
});

describe("reloadIfNewer", () => {
  it("returns null when the on-disk writeCounter is equal to in-memory", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    saveSave(defaultSave(), { storage, logger });
    const inMemory = loadSave({ storage, logger });
    expect(inMemory.kind).toBe("loaded");
    if (inMemory.kind !== "loaded") return;

    expect(reloadIfNewer(inMemory.save, { storage, logger })).toBeNull();
  });

  it("returns the on-disk save when its writeCounter is strictly greater", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    saveSave(defaultSave(), { storage, logger });
    const stale = loadSave({ storage, logger });
    expect(stale.kind).toBe("loaded");
    if (stale.kind !== "loaded") return;

    // Simulate another tab persisting a newer save.
    saveSave(stale.save, { storage, logger });

    const fresh = reloadIfNewer(stale.save, { storage, logger });
    expect(fresh).not.toBeNull();
    expect(fresh?.writeCounter).toBe(2);
  });

  it("returns null when the on-disk save is corrupt", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), "{not json");
    const baseline = defaultSave();
    expect(reloadIfNewer(baseline, { storage, logger })).toBeNull();
  });

  it("treats a missing in-memory writeCounter as 0", () => {
    const storage = new MemoryStorage();
    const logger = silentLogger();
    saveSave(defaultSave(), { storage, logger });
    const noCounter = { ...defaultSave() };
    delete (noCounter as { writeCounter?: unknown }).writeCounter;

    const fresh = reloadIfNewer(
      noCounter as ReturnType<typeof defaultSave>,
      { storage, logger },
    );
    expect(fresh).not.toBeNull();
    expect(fresh?.writeCounter).toBe(1);
  });
});
