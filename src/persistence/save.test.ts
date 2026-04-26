import { beforeEach, describe, expect, it, vi } from "vitest";

import saveExample from "@/data/examples/saveGame.example.json" with { type: "json" };
import {
  CURRENT_SAVE_VERSION,
  backupKey,
  defaultSave,
  loadSave,
  saveSave,
  storageKey,
  type SaveLogger,
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
      expect(loaded.save).toEqual(original);
    }
  });
});
