/**
 * HUD state derivation.
 *
 * Source of truth: `docs/gdd/20-hud-and-ui-ux.md`. This is the Phase 1
 * minimal HUD per `docs/IMPLEMENTATION_PLAN.md` Phase 1: speed, current
 * lap / total laps, and current position (1st of N). Polish slice (later
 * dot) handles the full HUD treatment from §20 ("lap timer", "best lap",
 * "nitro meter", "damage", "weather icon", etc).
 *
 * Pure derivation: `deriveHudState(input) -> HudState` is a pure
 * function of the race and car snapshots passed in. The renderer
 * (`src/render/uiRenderer.ts`) is the only module that knows about a
 * Canvas2D context. Splitting the two keeps unit tests headless and
 * matches the shape used by the rest of the runtime core (see
 * `physics.ts`, `loop.ts`).
 *
 * Edge cases handled here (per the dot's "Edge Cases" section):
 * - Lap 0 / pre-countdown: render "1 / N", never "0 / N".
 * - Single car (no opponents): position is "1 / 1".
 * - Reverse / negative speed: HUD shows the absolute value. The MVP
 *   physics layer never produces negative speed but defending against it
 *   keeps the HUD safe for the §10 followup that introduces reverse.
 */

import type { SpeedUnit } from "@/data/schemas";
import type { AssistBadge } from "./assists";
import type { RaceState } from "./raceState";

/** Forward-distance pair used to rank cars on the track. */
export interface RankedCar {
  /** Stable id so ties resolve deterministically. */
  id: string;
  /**
   * Total forward progress in meters. For multi-lap races this is
   * `lap * trackLength + zOnLap` so a leader on lap 3 outranks a
   * follower on lap 2 even with a smaller raw `z`. The HUD does not
   * compute this; the race-state owner does, and passes it in.
   */
  totalProgress: number;
}

/** Inputs to `deriveHudState`. All fields read-only. */
export interface HudStateInput {
  race: Pick<RaceState, "lap" | "totalLaps" | "phase">;
  /** Player car forward speed in m/s. Sign is ignored. */
  playerSpeedMetersPerSecond: number;
  /** Player car id. Must appear in `cars`. */
  playerId: string;
  /**
   * Every car in the field, including the player. Order does not
   * matter; ranking is by `totalProgress` desc with ties broken on `id`
   * lex order so the result is stable across ticks.
   */
  cars: readonly RankedCar[];
  /** Display unit. Defaults to `"kph"` per `defaultSave()`. */
  speedUnit: SpeedUnit;
  /**
   * Optional minimap snapshot. Owners that want a minimap pass a
   * pre-projected polyline plus per-car footprint positions; HUD does
   * no projection itself.
   */
  minimap?: HudMinimapState;
  /**
   * Optional accessibility-assist badge snapshot. When the assist
   * pipeline (`src/game/assists.ts`) reports any active assist, the
   * caller passes its `badge` field through here; the HUD layer
   * surfaces a single corner pip per the §20 "small badge when any
   * assist is active" requirement. Omitted entirely when no assists
   * are active so existing HUD wiring unaffected by the §19 slice
   * stays untouched.
   */
  assistBadge?: AssistBadge;
}

/** Optional minimap snapshot derived from the compiled track + car field. */
export interface HudMinimapState {
  /** Pre-projected track polyline in normalised footprint space. */
  points: readonly { x: number; y: number; segmentIndex: number }[];
  /** Per-car markers in the same normalised footprint space. */
  cars: readonly { x: number; y: number; isPlayer: boolean }[];
}

/** What the renderer draws. All values pre-formatted for display. */
export interface HudState {
  /** Speed magnitude in the player's preferred unit, rounded to int. */
  speed: number;
  speedUnit: SpeedUnit;
  /**
   * Current lap, clamped to `[1, totalLaps]`. Pre-countdown shows lap 1
   * so the HUD never renders "0 / N".
   */
  lap: number;
  totalLaps: number;
  /** 1-indexed finish position. 1 = leader. */
  position: number;
  /** Total cars in the field. >= 1; `position <= total`. */
  totalCars: number;
  /**
   * Minimap snapshot when the caller supplied one. Optional so the
   * existing minimal HUD wiring continues to work without minimap data.
   */
  minimap?: HudMinimapState;
  /**
   * Best lap time in milliseconds. Optional: omitted before the player has
   * completed any lap, or when the §20 best-lap widget is not wired by the
   * caller. The §20 polish slice owns the canonical wiring; downstream
   * consumers must treat `undefined` as "no best yet".
   */
  bestLapMs?: number | null;
  /**
   * Signed sector delta in milliseconds for the current sector, vs the
   * best-known split for that sector on this track. Positive = current is
   * SLOWER (red); negative = current is FASTER (green); `null` = no
   * comparable best yet (first run on the track, or partial sector).
   */
  sectorDeltaMs?: number | null;
  /**
   * Optional accessibility-assist badge mirror per §20. Surfaced only
   * when at least one §19 assist is active for the current tick;
   * absent otherwise so the existing HUD wiring (which never set this
   * field) keeps its existing snapshot shape.
   */
  assistBadge?: AssistBadge;
}

/** Conversion factors. SI base is m/s. */
const KPH_PER_MPS = 3.6;
const MPH_PER_MPS = 2.2369362920544025;

/** Convert m/s into the requested display unit. */
export function speedToDisplayUnit(metersPerSecond: number, unit: SpeedUnit): number {
  // NaN / non-finite collapses to 0 so the HUD never shows "NaN km/h".
  if (!Number.isFinite(metersPerSecond)) return 0;
  const magnitude = Math.abs(metersPerSecond);
  const scaled = unit === "mph" ? magnitude * MPH_PER_MPS : magnitude * KPH_PER_MPS;
  return Math.round(scaled);
}

/**
 * Determine the player's 1-indexed position in the field.
 *
 * Rank by `totalProgress` descending. Ties (same exact progress, e.g.
 * grid start before the countdown) break on `id` lex ascending so the
 * result is deterministic across ticks. This keeps the HUD position
 * from flickering between equal-progress cars on the start line.
 *
 * Throws if the player id is not in the field. The race-state owner is
 * responsible for keeping the field and player id in sync; an unknown
 * id is a programming error worth surfacing loudly.
 */
export function rankPosition(playerId: string, cars: readonly RankedCar[]): number {
  if (cars.length === 0) {
    throw new RangeError("rankPosition requires at least one car in the field");
  }
  // Sort a copy so the caller's array stays put. The HUD runs once per
  // render frame; field sizes are <= the §15 grid count (16 max), so
  // the per-frame sort cost is negligible.
  const sorted = [...cars].sort((a, b) => {
    if (b.totalProgress !== a.totalProgress) return b.totalProgress - a.totalProgress;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const index = sorted.findIndex((c) => c.id === playerId);
  if (index < 0) {
    throw new RangeError(`rankPosition: player id '${playerId}' not in field`);
  }
  return index + 1;
}

/**
 * Derive the renderable HUD state from race + car snapshots. Pure: no
 * mutation of the input; same input always produces the same output.
 */
export function deriveHudState(input: HudStateInput): HudState {
  const totalLaps = Math.max(1, Math.trunc(input.race.totalLaps));
  // Pre-countdown the loop sets lap = 1 already, but defending against
  // 0 / negative lap counts keeps the HUD safe if a future race phase
  // (e.g. "warmup") moves lap-state ownership.
  const rawLap = Math.trunc(input.race.lap);
  const lap = Math.min(totalLaps, Math.max(1, rawLap));

  const totalCars = Math.max(1, input.cars.length);
  const position = rankPosition(input.playerId, input.cars);

  const result: HudState = {
    speed: speedToDisplayUnit(input.playerSpeedMetersPerSecond, input.speedUnit),
    speedUnit: input.speedUnit,
    lap,
    totalLaps,
    position,
    totalCars,
  };
  if (input.minimap !== undefined) {
    result.minimap = input.minimap;
  }
  // Only surface the assist badge when at least one assist is active.
  // The §20 requirement is "show a small badge when any assist is
  // active"; an empty badge would render an invisible pip and confuse
  // the rendering layer.
  if (input.assistBadge !== undefined && input.assistBadge.active) {
    result.assistBadge = input.assistBadge;
  }
  return result;
}
