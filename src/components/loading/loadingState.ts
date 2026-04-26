/**
 * Pure state machine for the loading screen.
 *
 * Source of truth for the gating behaviour:
 * `docs/gdd/21-technical-design-for-web-implementation.md` (Renderer + Audio
 * preload). Source of truth for the on-screen affordances:
 * `docs/gdd/20-hud-and-ui-ux.md` (loading screen accessibility).
 *
 * The component layer subscribes to a `LoadingState` snapshot and renders
 * progress text + a bar. The state itself is derived from raw counts so the
 * same module can be unit-tested without mounting React.
 *
 * Phases:
 * - `idle`: nothing to load (manifest empty), the gate skips itself.
 * - `loading`: at least one entry is still in flight.
 * - `failed-critical`: at least one critical entry failed; the gate must
 *   surface a typed error and let the player retry.
 * - `ready`: every entry settled and no critical failures remain.
 */

export type LoadingPhase = "idle" | "loading" | "failed-critical" | "ready";

export interface LoadingSnapshot {
  manifestId: string;
  phase: LoadingPhase;
  total: number;
  completed: number;
  failed: number;
  /** ids of failed non-critical entries. Surface as a warning toast. */
  warnings: readonly string[];
  /** ids of failed critical entries. Block the gate. */
  criticalFailures: readonly string[];
}

export const EMPTY_SNAPSHOT: LoadingSnapshot = {
  manifestId: "",
  phase: "idle",
  total: 0,
  completed: 0,
  failed: 0,
  warnings: [],
  criticalFailures: [],
};

export interface ProgressEvent {
  manifestId: string;
  total: number;
  completed: number;
  failed: number;
  outcome: "success" | "failure";
  entryId: string;
  critical: boolean;
}

/**
 * Fold a single progress event into the snapshot. Pure: same event applied
 * to the same input snapshot returns the same output snapshot.
 */
export function applyProgress(prev: LoadingSnapshot, event: ProgressEvent): LoadingSnapshot {
  const warnings =
    event.outcome === "failure" &&
    !event.critical &&
    !prev.warnings.includes(event.entryId)
      ? [...prev.warnings, event.entryId]
      : prev.warnings;
  const criticalFailures =
    event.outcome === "failure" &&
    event.critical &&
    !prev.criticalFailures.includes(event.entryId)
      ? [...prev.criticalFailures, event.entryId]
      : prev.criticalFailures;
  const settled = event.completed + event.failed;
  let phase: LoadingPhase;
  if (event.total === 0) {
    phase = "idle";
  } else if (criticalFailures.length > 0) {
    phase = "failed-critical";
  } else if (settled >= event.total) {
    phase = "ready";
  } else {
    phase = "loading";
  }
  return {
    manifestId: event.manifestId,
    phase,
    total: event.total,
    completed: event.completed,
    failed: event.failed,
    warnings,
    criticalFailures,
  };
}

/**
 * Build the initial snapshot for a manifest of `total` entries. `idle` when
 * `total === 0`, otherwise `loading` so the screen displays from the first
 * frame even before the first event lands.
 */
export function startLoading(manifestId: string, total: number): LoadingSnapshot {
  if (total === 0) {
    return { ...EMPTY_SNAPSHOT, manifestId };
  }
  return {
    manifestId,
    phase: "loading",
    total,
    completed: 0,
    failed: 0,
    warnings: [],
    criticalFailures: [],
  };
}

/**
 * Format the loading text for screen readers and the visible label. Reads
 * "Loading X of Y" by default, "Loading complete" when ready, and surfaces
 * the failed count when at least one entry failed.
 */
export function formatLoadingText(snapshot: LoadingSnapshot): string {
  if (snapshot.phase === "idle") {
    return "Nothing to load";
  }
  if (snapshot.phase === "ready") {
    if (snapshot.warnings.length > 0) {
      return `Loaded ${snapshot.completed} of ${snapshot.total}, ${snapshot.warnings.length} optional asset${snapshot.warnings.length === 1 ? "" : "s"} skipped`;
    }
    return `Loaded ${snapshot.completed} of ${snapshot.total}`;
  }
  if (snapshot.phase === "failed-critical") {
    return `Loading failed: ${snapshot.criticalFailures.length} required asset${snapshot.criticalFailures.length === 1 ? "" : "s"} unavailable`;
  }
  const settled = snapshot.completed + snapshot.failed;
  return `Loading ${settled} of ${snapshot.total}`;
}

/**
 * Progress fraction in `[0, 1]`. Counts both successful and failed entries
 * as settled so a partial-failure manifest still drives the bar to 100 %.
 */
export function progressFraction(snapshot: LoadingSnapshot): number {
  if (snapshot.total === 0) return 1;
  const settled = snapshot.completed + snapshot.failed;
  if (settled <= 0) return 0;
  if (settled >= snapshot.total) return 1;
  return settled / snapshot.total;
}
