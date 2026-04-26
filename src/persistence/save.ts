/**
 * Versioned localStorage save/load.
 *
 * Source of truth for the on-disk shape: docs/gdd/22-data-schemas.md
 * (`SaveGame`). Behaviour reference: docs/gdd/21-technical-design-for-web-implementation.md
 * "Save system".
 *
 * Storage layout: a single key per major schema version. When the schema
 * major bumps, copy the prior key, run the matching migration, and write to
 * the new key. The old key stays for one release as a recovery backstop.
 *
 * Failure mode: every failure is non-fatal. If localStorage is unavailable
 * (privacy mode), reads return the default save and writes log + no-op.
 * If the stored payload is corrupted or fails schema validation, the raw
 * value is preserved under the backup key for forensic recovery and the
 * default save is returned.
 *
 * docs/WORKING_AGREEMENT.md §11 requires dev confirmation before dropping
 * or renaming persisted save fields. Migrations therefore must be additive
 * or re-mapped, never destructive without a logged decision.
 */

import { SaveGameSchema, type SaveGame } from "@/data/schemas";

import { CURRENT_SAVE_VERSION, migrate } from "./migrations";

const KEY_PREFIX = "vibegear2:save:v";
const BACKUP_SUFFIX = ":backup";

function storageKey(version: number): string {
  return `${KEY_PREFIX}${version}`;
}

function backupKey(version: number): string {
  return `${storageKey(version)}${BACKUP_SUFFIX}`;
}

export type SaveLoadOutcome =
  | { kind: "loaded"; save: SaveGame }
  | { kind: "default"; reason: SaveLoadFailure };

export type SaveLoadFailure =
  | "no-storage"
  | "missing"
  | "corrupted-json"
  | "schema-invalid"
  | "migration-failed";

export type SaveWriteOutcome =
  | { kind: "ok" }
  | { kind: "error"; reason: "no-storage" | "quota-exceeded" | "serialization-failed" };

/**
 * Logger surface so tests can assert without polluting stdout. Defaults to
 * console.warn at the call site; callers may override per-call.
 */
export interface SaveLogger {
  warn(message: string, detail?: unknown): void;
}

const defaultLogger: SaveLogger = {
  warn(message, detail) {
    if (detail === undefined) {
      console.warn(`[save] ${message}`);
    } else {
      console.warn(`[save] ${message}`, detail);
    }
  },
};

/**
 * The default save handed back when no persisted state exists. A fresh
 * profile, no credits, no owned cars. Phase 2 garage flow will replace
 * this with a "create profile" wizard.
 */
export function defaultSave(): SaveGame {
  return {
    version: CURRENT_SAVE_VERSION,
    profileName: "Player",
    settings: {
      displaySpeedUnit: "kph",
      assists: {
        steeringAssist: false,
        autoNitro: false,
        weatherVisualReduction: false,
      },
    },
    garage: {
      credits: 0,
      ownedCars: ["sparrow-gt"],
      activeCarId: "sparrow-gt",
      installedUpgrades: {
        "sparrow-gt": {
          engine: 0,
          gearbox: 0,
          dryTires: 0,
          wetTires: 0,
          nitro: 0,
          armor: 0,
          cooling: 0,
          aero: 0,
        },
      },
    },
    progress: {
      unlockedTours: [],
      completedTours: [],
    },
    records: {},
  };
}

/**
 * Resolve the localStorage handle. Returns null when the API is unavailable
 * (SSR, privacy mode, mocked-out). Storage exceptions during access are
 * treated as unavailability.
 */
export function resolveStorage(candidate?: Storage | null): Storage | null {
  if (candidate !== undefined) {
    return candidate;
  }
  if (typeof globalThis === "undefined") {
    return null;
  }
  try {
    const raw = (globalThis as { localStorage?: Storage }).localStorage;
    return raw ?? null;
  } catch {
    return null;
  }
}

export interface SaveIO {
  storage?: Storage | null;
  logger?: SaveLogger;
}

/**
 * Read the persisted save, validate, and migrate. Always returns a usable
 * SaveGame; failures fall back to the default save and the reason is
 * surfaced on the outcome tag.
 */
export function loadSave(io: SaveIO = {}): SaveLoadOutcome {
  const storage = resolveStorage(io.storage);
  const logger = io.logger ?? defaultLogger;

  if (!storage) {
    return { kind: "default", reason: "no-storage" };
  }

  const key = storageKey(CURRENT_SAVE_VERSION);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    logger.warn("getItem threw; treating as no-storage", error);
    return { kind: "default", reason: "no-storage" };
  }

  if (raw === null) {
    return { kind: "default", reason: "missing" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.warn("save payload is not valid JSON; preserving backup", error);
    preserveBackup(storage, raw, logger);
    return { kind: "default", reason: "corrupted-json" };
  }

  const migrated = safeMigrate(parsed, logger);
  if (migrated === undefined) {
    preserveBackup(storage, raw, logger);
    return { kind: "default", reason: "migration-failed" };
  }

  const result = SaveGameSchema.safeParse(migrated);
  if (!result.success) {
    logger.warn("save failed schema validation; preserving backup", result.error.issues);
    preserveBackup(storage, raw, logger);
    return { kind: "default", reason: "schema-invalid" };
  }

  return { kind: "loaded", save: result.data };
}

/**
 * Persist the save. Validates against the schema before write so callers
 * cannot poison storage with unstructured state.
 */
export function saveSave(state: SaveGame, io: SaveIO = {}): SaveWriteOutcome {
  const storage = resolveStorage(io.storage);
  const logger = io.logger ?? defaultLogger;

  if (!storage) {
    logger.warn("no localStorage; save dropped");
    return { kind: "error", reason: "no-storage" };
  }

  const validated = SaveGameSchema.safeParse(state);
  if (!validated.success) {
    logger.warn("refusing to persist invalid save", validated.error.issues);
    return { kind: "error", reason: "serialization-failed" };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(validated.data);
  } catch (error) {
    logger.warn("save serialization failed", error);
    return { kind: "error", reason: "serialization-failed" };
  }

  try {
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), serialized);
    return { kind: "ok" };
  } catch (error) {
    if (isQuotaExceeded(error)) {
      logger.warn("localStorage quota exceeded", error);
      return { kind: "error", reason: "quota-exceeded" };
    }
    logger.warn("setItem threw; treating as no-storage", error);
    return { kind: "error", reason: "no-storage" };
  }
}

/** Detect the various flavours of QuotaExceededError across browsers. */
function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = error.name;
  // Standard, Firefox, and old WebKit names. Code checks are a fallback
  // for environments that throw without the named variant.
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return true;
  }
  const code = (error as { code?: number }).code;
  return code === 22 || code === 1014;
}

function preserveBackup(storage: Storage, raw: string, logger: SaveLogger): void {
  try {
    storage.setItem(backupKey(CURRENT_SAVE_VERSION), raw);
  } catch (error) {
    logger.warn("failed to preserve backup of corrupted save", error);
  }
}

function safeMigrate(input: unknown, logger: SaveLogger): unknown {
  try {
    return migrate(input);
  } catch (error) {
    logger.warn("migration threw", error);
    return undefined;
  }
}

export { CURRENT_SAVE_VERSION, storageKey, backupKey };
