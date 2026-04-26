/**
 * Sector-split timer: pure state for the §20 ghost-delta HUD widget.
 *
 * Source of truth: `docs/gdd/20-hud-and-ui-ux.md` Race HUD ("lap timer",
 * "best lap") and the wireframe ("Top-right: best lap / ghost delta").
 *
 * The race-checkpoint detector (sibling slice
 * `implement-race-checkpoint-81d86518`) is the producer of per-tick
 * checkpoint-pass events. This module is the consumer: it accumulates the
 * sector boundaries each lap and emits per-sector splits for delta math.
 *
 * Pure functions only: no `Math.random`, no `Date.now`. All timing comes
 * from the simulation `tick` counter so two runs from the same seed produce
 * identical splits.
 *
 * Sign convention: `sectorDeltaMs(current, ghost)` returns a positive
 * number when the current run is SLOWER than the ghost (current took
 * longer; bad), and a negative number when the current run is FASTER. The
 * §20 widget paints positive in red and negative in green per the dot.
 *
 * Sector model:
 *
 * - A track with N checkpoints (including the `start` checkpoint) defines
 *   N sectors. Sector i runs from checkpoint i to checkpoint (i + 1) % N
 *   along the lap. Sector 0 starts at the start line, sector N-1 closes at
 *   the start line again.
 * - A track with zero checkpoints defines exactly one whole-lap sector.
 *   The widget reverts to lap-timer-only mode in that case (no per-sector
 *   delta is meaningful).
 * - A track with one checkpoint (start line only) also defines exactly one
 *   whole-lap sector. The widget compares against `bestLapMs`, not against
 *   per-sector splits.
 */

import type { SaveGame, TrackCheckpoint } from "@/data/schemas";
import type { CompiledCheckpoint } from "@/road/types";

/**
 * Minimal checkpoint shape consumed here. Accepts both authored
 * `TrackCheckpoint` and compiled `CompiledCheckpoint` so callers can pass
 * either without an adapter. The pair share `label` + a positional index;
 * we only need the label for sector identification.
 */
export type SectorCheckpointInput =
  | TrackCheckpoint
  | CompiledCheckpoint
  | { label: string };

/** One sector's lifecycle inside a single lap. */
export interface SectorEntry {
  /** Stable sector label, derived from the entry checkpoint. */
  label: string;
  /**
   * Sim tick at which the player entered this sector (i.e. crossed the
   * checkpoint at the start of the sector). Tick 0 for the first sector
   * of the first lap.
   */
  tickEntered: number;
  /**
   * Sim tick at which the player exited this sector (crossed the next
   * checkpoint). `null` while the sector is in progress.
   */
  tickExited: number | null;
}

export interface SectorState {
  /** Ordered sectors for the current lap. Length is `max(1, checkpoints.length)`. */
  sectors: ReadonlyArray<SectorEntry>;
  /** Index of the sector currently being driven. Always in `[0, sectors.length - 1]`. */
  currentSectorIdx: number;
}

/**
 * Build the initial sector state at race start.
 *
 * The first sector starts at tick 0 with `tickEntered = 0` so the lap
 * timer reads the same monotonic clock as the rest of the sim. Empty
 * checkpoint arrays produce a single whole-lap sector labelled `"lap"`.
 */
export function createSectorState(
  checkpoints: readonly SectorCheckpointInput[],
): SectorState {
  if (checkpoints.length === 0) {
    return {
      sectors: [
        { label: "lap", tickEntered: 0, tickExited: null },
      ],
      currentSectorIdx: 0,
    };
  }
  const sectors: SectorEntry[] = checkpoints.map((cp, i) => ({
    label: cp.label,
    tickEntered: i === 0 ? 0 : -1,
    tickExited: null,
  }));
  return { sectors, currentSectorIdx: 0 };
}

/**
 * Apply a checkpoint-pass event. Pure: returns a fresh state (or the same
 * reference when the event is a no-op).
 *
 * The event passes when the player crosses the checkpoint that begins the
 * NEXT sector. The current sector closes (`tickExited = tick`) and the
 * next sector opens (`tickEntered = tick`).
 *
 * No-op cases (state returned unchanged):
 * - The state has only one sector (zero- or one-checkpoint track): there
 *   is nothing to advance to inside the lap.
 * - The label does not match the next-sector label. This keeps the
 *   sector chain in lockstep with the §7 anti-shortcut guard which is
 *   the source of truth for "did the player skip a checkpoint". The
 *   widget never decides correctness.
 */
export function onCheckpointPass(
  state: SectorState,
  checkpoint: SectorCheckpointInput,
  tick: number,
): SectorState {
  if (state.sectors.length <= 1) {
    return state;
  }
  const nextIdx = state.currentSectorIdx + 1;
  if (nextIdx >= state.sectors.length) {
    // Crossing the start line again is a lap event handled by `startNewLap`.
    return state;
  }
  const nextSector = state.sectors[nextIdx]!;
  if (nextSector.label !== checkpoint.label) {
    return state;
  }
  const sectors = state.sectors.map((s, i) => {
    if (i === state.currentSectorIdx) {
      return { ...s, tickExited: tick };
    }
    if (i === nextIdx) {
      return { ...s, tickEntered: tick };
    }
    return s;
  });
  return { sectors, currentSectorIdx: nextIdx };
}

/**
 * Reset sector state for a new lap. Closes the final sector at `tick`
 * (the start-line crossing) and re-opens the first sector at the same
 * tick so lap-N+1's first sector starts at the lap boundary, not at zero.
 *
 * The dot pins: "After the player crosses the start line for a new lap,
 * the displayed sector is the FIRST sector and the delta is null until
 * the first checkpoint pass of the new lap." The null-delta behaviour
 * lives in the renderer; this function only resets the state.
 */
export function startNewLap(state: SectorState, tick: number): SectorState {
  const sectors = state.sectors.map((s, i) => ({
    label: s.label,
    tickEntered: i === 0 ? tick : -1,
    tickExited: null,
  }));
  return { sectors, currentSectorIdx: 0 };
}

/**
 * Convert sim ticks to milliseconds using a fixed-step dt.
 *
 * `dt` is the simulation step in seconds (typically `1 / 60`). Pure:
 * given `dt = 1 / 60` and `ticks = 60`, returns 1000.
 */
export function ticksToMs(ticks: number, dtSeconds: number): number {
  if (!Number.isFinite(ticks) || !Number.isFinite(dtSeconds)) return 0;
  return Math.round(ticks * dtSeconds * 1000);
}

/**
 * Cumulative split times in milliseconds for the completed sectors of
 * the current lap.
 *
 * `splitsForLap(state, dt)` returns one entry per sector that has both
 * `tickEntered` and `tickExited` set. Each entry is the cumulative ms
 * from lap start to the sector's exit; sector 0's value is the time the
 * player took to reach checkpoint 1, sector 1's value is the time to
 * reach checkpoint 2, and so on.
 *
 * The final value (for the start-line crossing) is appended by the
 * caller using the lap-time, not by this function: when the lap closes
 * the §7 layer records the new lap time and only at that point do we
 * know the cumulative time for the final sector.
 */
export function splitsForLap(
  state: SectorState,
  dtSeconds: number,
): readonly number[] {
  const lapStart = state.sectors[0]?.tickEntered ?? 0;
  const out: number[] = [];
  for (const sector of state.sectors) {
    if (sector.tickExited === null) break;
    out.push(ticksToMs(sector.tickExited - lapStart, dtSeconds));
  }
  return out;
}

/**
 * Per-sector signed delta in milliseconds, current vs ghost.
 *
 * Positive return = current is SLOWER (current took more ms; bad).
 * Negative return = current is FASTER. Length matches the SHORTER of
 * the two arrays, so a partial current lap returns only the entries it
 * has finished.
 */
export function sectorDeltaMs(
  currentSplitsMs: readonly number[],
  ghostSplitsMs: readonly number[],
): number[] {
  const len = Math.min(currentSplitsMs.length, ghostSplitsMs.length);
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(currentSplitsMs[i]! - ghostSplitsMs[i]!);
  }
  return out;
}

/**
 * Read the per-sector best splits for a track from the save. Returns
 * `null` when the track has no record yet, or when the record predates
 * this field (v1 saves). Pure given the input save.
 */
export function bestSplitsForTrack(
  save: SaveGame,
  trackId: string,
): readonly number[] | null {
  const record = save.records[trackId];
  if (!record) return null;
  if (!record.bestSplitsMs || record.bestSplitsMs.length === 0) return null;
  return record.bestSplitsMs;
}

/**
 * Decide whether a freshly-finished lap should overwrite the stored
 * `bestSplitsMs` for a track. Per the dot: "only after a lap improves
 * the OVERALL bestLap; never write per-sector regressions". The overall
 * gate keeps the widget honest (a slower lap with one fast sector does
 * not poison the per-sector targets) and matches how time-trial owners
 * already write `bestLapMs`.
 */
export function shouldWriteBestSplits(
  newLapMs: number,
  previousBestLapMs: number | null,
): boolean {
  if (!Number.isFinite(newLapMs) || newLapMs <= 0) return false;
  if (previousBestLapMs === null) return true;
  return newLapMs < previousBestLapMs;
}

/**
 * Renderer-agnostic projection of the sector timer used by the §20 splits
 * widget. Structurally compatible with `SplitsState` from
 * `src/render/hudSplits.ts`; we keep this shape on the game side so the
 * runtime never imports back into the renderer.
 */
export interface SplitsView {
  /** Cumulative lap-time in ms since the green light. */
  lapTimerMs: number;
  /** Index of the sector currently being driven. */
  currentSectorIdx: number;
  /** Sector label (e.g. "split-a"). Drawn below the timer. */
  sectorLabel: string;
  /**
   * Signed delta in ms vs the baseline split. Positive = current is slower
   * (red); negative = current is faster (green); `null` = no comparable
   * baseline yet (first run on the track, or no completed sector this lap).
   */
  sectorDeltaMs: number | null;
}

/**
 * Advance the sector timer by one simulation tick.
 *
 * The producer for sector boundaries is the player's monotonically-increasing
 * world-z. Lap rollover resets the sector chain at `tick`; any checkpoints
 * crossed during this tick are then consumed in order. Multi-checkpoint
 * crossings within a single tick (rare with `dt = 1 / 60`, but possible if a
 * future slice raises dt) collapse to one `onCheckpointPass` call each, all
 * stamped with the same tick value so the lap timer reads the same
 * monotonic clock as the rest of the sim.
 *
 * Pure: returns a fresh state (or the same reference when nothing changes).
 *
 * Parameters:
 * - `state`: previous sector state.
 * - `prevLap`, `nextLap`: lap counters from `RaceState.lap` before and after
 *   this tick. A roll calls `startNewLap` first.
 * - `nextLapPosMeters`: player's lap-local z, in `[0, trackLengthMeters)`.
 *   Computed by the caller as `((player.car.z mod L) + L) mod L`.
 * - `checkpoints`: ordered compiled checkpoints. Index 0 is the start line.
 * - `segmentLengthMeters`: compiled-segment length used to convert a
 *   checkpoint's `compiledStart` index to a z position in meters.
 * - `tick`: current sim tick to stamp on any boundary events.
 */
export function tickSectorTimer(
  state: SectorState,
  prevLap: number,
  nextLap: number,
  nextLapPosMeters: number,
  checkpoints: readonly CompiledCheckpoint[],
  segmentLengthMeters: number,
  tick: number,
): SectorState {
  let s = state;
  if (nextLap > prevLap) {
    s = startNewLap(s, tick);
  }
  if (s.sectors.length <= 1) return s;
  // Walk forward through any checkpoints whose compiled-z the player has
  // reached this tick. The loop terminates because `currentSectorIdx`
  // strictly increases on each successful pass.
  while (s.currentSectorIdx + 1 < s.sectors.length) {
    const nextIdx = s.currentSectorIdx + 1;
    const cp = checkpoints[nextIdx];
    if (!cp) break;
    const cpZ = cp.compiledStart * segmentLengthMeters;
    if (nextLapPosMeters >= cpZ) {
      s = onCheckpointPass(s, { label: cp.label }, tick);
    } else {
      break;
    }
  }
  return s;
}

/**
 * Project the sector state plus a baseline into the renderer-facing
 * `SplitsView` shape. Pure.
 *
 * Delta semantics: the most recently completed sector this lap is compared
 * against the same sector index in `baselineSplitsMs`. While the first
 * sector of the lap is still in progress and no sector has finished, the
 * delta is `null` so the widget hides the +/- chip. When `baselineSplitsMs`
 * is `null` (first time on the track, no recorded best, no previous lap to
 * compare against) the delta is also `null`. The widget's internal
 * `Number.isFinite` guard then skips the third drawcall.
 */
export function deriveSplitsState(
  sectorState: SectorState,
  lapTimerMs: number,
  baselineSplitsMs: readonly number[] | null,
  dtSeconds: number,
): SplitsView {
  const idx = sectorState.currentSectorIdx;
  const currentSector = sectorState.sectors[idx];
  const sectorLabel = currentSector?.label ?? "lap";
  const splits = splitsForLap(sectorState, dtSeconds);
  let delta: number | null = null;
  if (baselineSplitsMs !== null && splits.length > 0) {
    const lastIdx = splits.length - 1;
    if (lastIdx < baselineSplitsMs.length) {
      delta = splits[lastIdx]! - baselineSplitsMs[lastIdx]!;
    }
  }
  return {
    lapTimerMs,
    currentSectorIdx: idx,
    sectorLabel,
    sectorDeltaMs: delta,
  };
}
