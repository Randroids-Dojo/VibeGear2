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
import { DEFAULT_KEY_BINDINGS } from "@/game/input";

import { CURRENT_SAVE_VERSION, migrate } from "./migrations";
import {
  V2_ACCESSIBILITY_DEFAULTS,
  V2_AUDIO_DEFAULTS,
} from "./migrations/v1ToV2";

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
 * Deep-clone `DEFAULT_KEY_BINDINGS` into a plain mutable object so the
 * persisted save shape stays JSON-serialisable and the runtime frozen
 * defaults are not aliased into save state. Mirrors the equivalent helper
 * inside `migrations/v1ToV2.ts` so the fresh-save and migrated-save shapes
 * are byte-identical.
 */
function cloneDefaultKeyBindings(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [action, keys] of Object.entries(DEFAULT_KEY_BINDINGS)) {
    out[action] = [...keys];
  }
  return out;
}

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
        // §19 Accessibility controls. All assists default off so the
        // out-of-the-box experience matches the GDD baseline; the
        // accessibility pane is the opt-in surface.
        steeringAssist: false,
        autoNitro: false,
        weatherVisualReduction: false,
        autoAccelerate: false,
        brakeAssist: false,
        steeringSmoothing: false,
        nitroToggleMode: false,
        reducedSimultaneousInput: false,
      },
      // GDD §15 'Normal' is the baseline tier and the §28 default.
      difficultyPreset: "normal",
      // GDD §10 'Gear shifting' default: automatic. Manual is opt-in.
      transmissionMode: "auto",
      // §20 audio mix defaults; same constants used by the v1 -> v2 migrator
      // so a fresh save and a migrated v1 save observe identical defaults.
      audio: { ...V2_AUDIO_DEFAULTS },
      // §20 accessibility defaults; screenShakeScale 1.0 keeps the v1
      // shake intensity unchanged.
      accessibility: { ...V2_ACCESSIBILITY_DEFAULTS },
      // §19 key bindings: clone the runtime defaults into a plain object
      // so the persisted shape stays mutable and JSON-serialisable.
      keyBindings: cloneDefaultKeyBindings(),
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
      pendingDamage: {},
      lastRaceCashEarned: 0,
    },
    progress: {
      unlockedTours: [],
      completedTours: [],
    },
    records: {},
    // §6 Time Trial PB ghost slot. Seeded empty; populated as the player
    // sets PBs via `bestGhostFor` in `src/game/ghost.ts`. The v2 -> v3
    // migrator seeds the same shape so a fresh save and a migrated save
    // are byte-identical at this slot.
    ghosts: {},
    // Cross-tab last-write-wins counter. Seeds at 0; `saveSave` increments
    // before every persist so two tabs can compare which write came last.
    writeCounter: 0,
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

  const found = readNewestAvailableSave(storage, logger);
  if (found.kind === "no-storage") {
    return { kind: "default", reason: "no-storage" };
  }
  if (found.kind === "missing") {
    return { kind: "default", reason: "missing" };
  }

  const { raw, version: sourceVersion } = found;

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

  if (sourceVersion !== CURRENT_SAVE_VERSION) {
    persistMigratedSave(storage, result.data, logger);
  }

  return { kind: "loaded", save: result.data };
}

/**
 * Persist the save. Validates against the schema before write so callers
 * cannot poison storage with unstructured state. Increments the
 * `writeCounter` on the persisted shape so other tabs can detect a newer
 * write via `subscribeToSaveChanges` / `reloadIfNewer` per
 * `docs/gdd/21-technical-design-for-web-implementation.md` "Cross-tab
 * consistency".
 */
export function saveSave(state: SaveGame, io: SaveIO = {}): SaveWriteOutcome {
  const storage = resolveStorage(io.storage);
  const logger = io.logger ?? defaultLogger;

  if (!storage) {
    logger.warn("no localStorage; save dropped");
    return { kind: "error", reason: "no-storage" };
  }

  // Tick the cross-tab counter advisory. A missing counter (legacy or
  // pre-counter v2 save) is treated as 0; the first write after that
  // becomes 1 so a freshly migrated save is strictly newer than the
  // pre-write copy any other tab still holds in memory.
  const next: SaveGame = {
    ...state,
    writeCounter: (state.writeCounter ?? 0) + 1,
  };

  const validated = SaveGameSchema.safeParse(next);
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

/**
 * Cross-tab event surface. The `storage` event is the simplest way to learn
 * that another tab persisted a save. The browser does not deliver the event
 * to the originating tab, so the listener only ever fires for foreign-tab
 * writes (the documented behaviour `subscribeToSaveChanges` relies on).
 *
 * Two listeners hook here: the title / garage screens hot-reload the
 * displayed save when a foreign tab writes, and any long-lived in-memory
 * save reference revalidates on `focus` / `visibilitychange` via
 * `reloadIfNewer`. Race state is intentionally excluded; mid-race we never
 * touch the persisted save until the race ends, so a foreign-tab write
 * cannot corrupt live race state.
 */
export type SaveChangeListener = (next: SaveGame) => void;

export interface SubscribeOptions {
  /**
   * Source of `storage` events. Browsers fire the event on the `window`;
   * tests inject a mock. Falls back to `globalThis.window` when omitted; if
   * that is unavailable the subscription is a no-op and the returned
   * unsubscribe is a no-op.
   */
  target?: SaveEventTarget | null;
  logger?: SaveLogger;
}

/**
 * Minimal `EventTarget` surface so tests can drive `storage` events without
 * dragging the full `Window` type in. Real browsers satisfy this through
 * `window`; jsdom satisfies it through its `Window` shim.
 */
export interface SaveEventTarget {
  addEventListener(
    type: "storage",
    handler: (event: StorageEventLike) => void,
  ): void;
  removeEventListener(
    type: "storage",
    handler: (event: StorageEventLike) => void,
  ): void;
}

/**
 * Subset of `StorageEvent` we read. The platform `StorageEvent` is wider;
 * narrowing here keeps the test shim light and pins exactly what the
 * cross-tab protocol consumes.
 */
export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
  storageArea?: Storage | null;
}

function resolveEventTarget(
  candidate: SaveEventTarget | null | undefined,
): SaveEventTarget | null {
  if (candidate !== undefined) {
    return candidate;
  }
  if (typeof globalThis === "undefined") {
    return null;
  }
  const win = (globalThis as { window?: SaveEventTarget }).window;
  return win ?? null;
}

/**
 * Subscribe to cross-tab save writes. The callback fires whenever another
 * tab persists a valid save under the current schema's storage key. Same-
 * tab writes do not fire (the `storage` event semantic). Returns an
 * unsubscribe; calling the unsubscribe twice is safe.
 *
 * Failure modes (event target unavailable, foreign payload corrupt, key
 * mismatch) are silent: the listener simply does not invoke the callback.
 * Callers that need to revalidate on focus should pair this with
 * `reloadIfNewer`.
 */
export function subscribeToSaveChanges(
  callback: SaveChangeListener,
  options: SubscribeOptions = {},
): () => void {
  const target = resolveEventTarget(options.target);
  const logger = options.logger ?? defaultLogger;
  if (!target) {
    return () => {};
  }

  const expectedKey = storageKey(CURRENT_SAVE_VERSION);

  const handler = (event: StorageEventLike): void => {
    if (event.key !== expectedKey) {
      // Not our save (could be backup, leaderboard cache, mod settings).
      return;
    }
    if (event.newValue === null) {
      // The other tab cleared the save. Surfacing a "save was deleted"
      // event is out of scope; drop silently and let `reloadIfNewer`
      // handle it on the next focus.
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.newValue);
    } catch (error) {
      logger.warn("foreign-tab save event payload was not JSON", error);
      return;
    }
    const migrated = safeMigrate(parsed, logger);
    if (migrated === undefined) {
      return;
    }
    const result = SaveGameSchema.safeParse(migrated);
    if (!result.success) {
      logger.warn(
        "foreign-tab save event failed schema validation",
        result.error.issues,
      );
      return;
    }
    callback(result.data);
  };

  target.addEventListener("storage", handler);
  let unsubscribed = false;
  return () => {
    if (unsubscribed) {
      return;
    }
    unsubscribed = true;
    target.removeEventListener("storage", handler);
  };
}

/**
 * Compare the in-memory save's `writeCounter` against the on-disk save and
 * return the on-disk save when it is strictly newer; otherwise return null.
 * Designed for `focus` / `visibilitychange` revalidation: the title and
 * garage screens call this before any UI mutation to avoid clobbering a
 * concurrent tab's write. Race state is independent of `SaveGame` until
 * the race ends, so this helper is not called mid-race.
 *
 * Treats a missing counter as 0. The on-disk save is read with the same
 * load pipeline as `loadSave`, including schema validation; a corrupt
 * on-disk save returns null (the in-memory copy stays authoritative until
 * the next successful write).
 */
export function reloadIfNewer(
  currentInMemory: SaveGame,
  io: SaveIO = {},
): SaveGame | null {
  const outcome = loadSave(io);
  if (outcome.kind !== "loaded") {
    return null;
  }
  const onDiskCounter = outcome.save.writeCounter ?? 0;
  const inMemoryCounter = currentInMemory.writeCounter ?? 0;
  if (onDiskCounter <= inMemoryCounter) {
    return null;
  }
  return outcome.save;
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

type SaveReadResult =
  | { kind: "found"; version: number; raw: string }
  | { kind: "missing" }
  | { kind: "no-storage" };

function readNewestAvailableSave(
  storage: Storage,
  logger: SaveLogger,
): SaveReadResult {
  for (let version = CURRENT_SAVE_VERSION; version >= 1; version -= 1) {
    let raw: string | null;
    try {
      raw = storage.getItem(storageKey(version));
    } catch (error) {
      logger.warn("getItem threw; treating as no-storage", error);
      return { kind: "no-storage" };
    }
    if (raw !== null) {
      return { kind: "found", version, raw };
    }
  }
  return { kind: "missing" };
}

function persistMigratedSave(
  storage: Storage,
  save: SaveGame,
  logger: SaveLogger,
): void {
  try {
    storage.setItem(storageKey(CURRENT_SAVE_VERSION), JSON.stringify(save));
  } catch (error) {
    logger.warn("failed to persist migrated save", error);
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
