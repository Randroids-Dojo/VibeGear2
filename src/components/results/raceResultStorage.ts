/**
 * Results-screen handoff store.
 *
 * The race route (`/race`) hands a finished `RaceResult` to the results
 * route (`/race/results`) via `sessionStorage`. Browser navigation
 * survives the hop; closing the tab clears it (matches the §20 design
 * intent that results are ephemeral until the player chooses Continue).
 *
 * Why session storage rather than a URL param? The results object
 * contains nested arrays (finishingOrder, bonuses, perLapTimes) that
 * would dwarf the URL length budget when the field grows to 12 cars.
 * Session storage carries the full payload without serialisation
 * concerns and is automatically cleared when the tab closes.
 *
 * The stored payload is the canonical `RaceResult` JSON, written under a
 * versioned key so a future shape change can fail-soft (read returns
 * `null` if the version mismatches and the page falls back to the
 * "no session result" warning).
 *
 * Pure read / write surface; no React, no hooks.
 */

import type { RaceResult } from "@/game/raceResult";

const STORAGE_KEY = "vibegear2:race-result:v1";

/**
 * Persist a `RaceResult` to the session-storage handoff slot. Returns
 * `true` when the write succeeds, `false` when storage is unavailable
 * (SSR, privacy mode) or the payload cannot be serialised. Callers
 * should branch on the boolean and surface a "results unavailable"
 * fallback when it returns `false`.
 */
export function saveRaceResult(result: RaceResult): boolean {
  if (typeof globalThis === "undefined") return false;
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(result));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the persisted `RaceResult`, or `null` when none exists / the
 * payload is unreadable. The shape is trusted (the writer is the same
 * codebase, same version); a future major change must bump
 * `STORAGE_KEY` to force a clean read.
 */
export function loadRaceResult(): RaceResult | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as RaceResult;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.trackId !== "string") return null;
    if (!Array.isArray(parsed.finishingOrder)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Clear the handoff slot. Called after the player navigates away. */
export function clearRaceResult(): void {
  if (typeof globalThis === "undefined") return;
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return;
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Swallow: clear is best-effort.
  }
}

export const RACE_RESULT_STORAGE_KEY = STORAGE_KEY;
