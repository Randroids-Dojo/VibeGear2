/**
 * HUD state derivation.
 *
 * Source of truth: `docs/gdd/20-hud-and-ui-ux.md`. The required minimal
 * HUD fields are speed, current lap / total laps, and current position
 * (1st of N). Additional §20 widgets are optional fields derived only
 * when callers provide the matching runtime snapshots, including timers,
 * splits, minimap, assists, damage, weather, gear, and nitro.
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
import type { WeatherOption } from "@/data/schemas";
import type { AssistBadge } from "./assists";
import type { DamageState, DamageZone } from "./damage";
import {
  BASE_NITRO_DURATION_SEC,
  DEFAULT_NITRO_CHARGES,
  type NitroState,
} from "./nitro";
import type { RaceState } from "./raceState";
import type { TransmissionState } from "./transmission";

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
  /**
   * Optional current-lap elapsed time in milliseconds. Surfaced by
   * the §20 polish slice; absent for pre-polish callers so the
   * existing minimal HUD wiring continues to type-check. Negative
   * and non-finite values are tolerated by the formatter (see
   * `formatLapTime`); the renderer still draws the row so layout is
   * stable across sub-second pre-countdown ticks.
   */
  currentLapElapsedMs?: number;
  /**
   * Optional best lap time in milliseconds. Sourced from the save
   * record on race start; surfaced by the §20 polish slice. Pass
   * `null` or omit when no best is available so the HUD knows to
   * skip the BEST row entirely.
   */
  bestLapMs?: number | null;
  /** Optional live §13 damage snapshot for the §20 bottom-left HUD cluster. */
  damage?: Readonly<DamageState>;
  /** Optional active §14 weather state for the §20 weather icon. */
  weather?: WeatherOption;
  /**
   * Optional effective player grip scalar after weather and tire choice.
   * Used only for the §20 grip hint. Omit to hide the hint.
   */
  weatherGripScalar?: number;
  /** Optional live §10 nitro snapshot for the §20 bottom-center meter. */
  nitro?: Readonly<NitroState>;
  /**
   * Race-start maximum nitro charges. Defaults to the stock §10 value.
   * Used only to size the meter.
   */
  nitroMaxCharges?: number;
  /**
   * Full burn duration for one active charge. Defaults to the stock §10
   * duration so callers can omit it until upgrade-aware HUD sizing lands.
   */
  nitroChargeDurationSec?: number;
  /** Optional live §10 transmission snapshot for the §20 gear label. */
  transmission?: Readonly<TransmissionState>;
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
   *
   * `null` is also accepted on input (e.g. when the save record exists but
   * has no best yet). The HUD-state derivation collapses both `null` and
   * `undefined` to "no row drawn" via the renderer's per-field guard.
   */
  bestLapMs?: number | null;
  /**
   * Optional current-lap elapsed time in milliseconds, mirrored from
   * `HudStateInput`. The renderer draws the timer row only when this
   * field is present so the existing minimal HUD layout is preserved
   * for callers that do not yet wire the §20 polish data.
   */
  currentLapElapsedMs?: number;
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
  /** Optional §20 damage HUD summary. */
  damage?: HudDamageSummary;
  /** Optional §20 weather HUD summary. */
  weather?: HudWeatherSummary;
  /** Optional §20 nitro HUD summary. */
  nitro?: HudNitroSummary;
  /** Optional §20 gear HUD summary. */
  gear?: HudGearSummary;
}

export interface HudDamageSummary {
  totalPercent: number;
  zones: Readonly<Record<DamageZone, number>>;
}

export type HudWeatherIcon = "clear" | "rain" | "fog" | "snow" | "night" | "overcast";
export type HudGripHint = "dry" | "wet" | "slick" | "snow" | "low-vis" | "night";

export interface HudWeatherSummary {
  icon: HudWeatherIcon;
  label: string;
  gripHint?: HudGripHint;
  gripPercent?: number;
}

export interface HudNitroSummary {
  current: number;
  max: number;
  active: boolean;
  percent: number;
}

export interface HudGearSummary {
  gear: number;
  rpmPercent: number;
  mode: "auto" | "manual";
}

/** Conversion factors. SI base is m/s. */
const KPH_PER_MPS = 3.6;
const MPH_PER_MPS = 2.2369362920544025;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function percentFromUnit(value: number): number {
  return Math.round(clampUnit(value) * 100);
}

export function summarizeHudDamage(damage: Readonly<DamageState>): HudDamageSummary {
  return {
    totalPercent: percentFromUnit(damage.total),
    zones: {
      engine: percentFromUnit(damage.zones.engine),
      tires: percentFromUnit(damage.zones.tires),
      body: percentFromUnit(damage.zones.body),
    },
  };
}

export function weatherIconForHud(weather: WeatherOption): HudWeatherIcon {
  switch (weather) {
    case "light_rain":
    case "rain":
    case "heavy_rain":
      return "rain";
    case "fog":
      return "fog";
    case "snow":
      return "snow";
    case "dusk":
    case "night":
      return "night";
    case "overcast":
      return "overcast";
    case "clear":
      return "clear";
  }
}

export function weatherLabelForHud(weather: WeatherOption): string {
  return weather.replaceAll("_", " ").toUpperCase();
}

export function gripHintForHud(
  weather: WeatherOption,
  weatherGripScalar: number | undefined,
): HudGripHint | undefined {
  if (weatherGripScalar === undefined || !Number.isFinite(weatherGripScalar)) {
    return undefined;
  }
  if (weather === "snow") return "snow";
  if (weather === "fog") return "low-vis";
  if (weather === "night" || weather === "dusk") return "night";
  if (
    weather === "light_rain" ||
    weather === "rain" ||
    weather === "heavy_rain"
  ) {
    return weatherGripScalar < 0.82 ? "slick" : "wet";
  }
  return weatherGripScalar < 0.95 ? "wet" : "dry";
}

export function summarizeHudWeather(
  weather: WeatherOption,
  weatherGripScalar?: number,
): HudWeatherSummary {
  const gripPercent =
    weatherGripScalar !== undefined && Number.isFinite(weatherGripScalar)
      ? percentFromUnit(weatherGripScalar)
      : undefined;
  const gripHint = gripHintForHud(weather, weatherGripScalar);
  return {
    icon: weatherIconForHud(weather),
    label: weatherLabelForHud(weather),
    ...(gripHint !== undefined ? { gripHint } : {}),
    ...(gripPercent !== undefined ? { gripPercent } : {}),
  };
}

export function summarizeHudNitro(
  nitro: Readonly<NitroState>,
  maxCharges: number = DEFAULT_NITRO_CHARGES,
  chargeDurationSec: number = BASE_NITRO_DURATION_SEC,
): HudNitroSummary {
  const max = Math.max(1, Math.round(maxCharges));
  const activeFraction =
    chargeDurationSec > 0
      ? clampUnit(nitro.activeRemainingSec / chargeDurationSec)
      : 0;
  const current = Math.max(
    0,
    Math.min(max, nitro.charges + activeFraction),
  );
  return {
    current,
    max,
    active: activeFraction > 0,
    percent: percentFromUnit(current / max),
  };
}

export function summarizeHudGear(
  transmission: Readonly<TransmissionState>,
): HudGearSummary {
  const gear = Number.isFinite(transmission.gear)
    ? Math.max(1, Math.trunc(transmission.gear))
    : 1;
  return {
    gear,
    rpmPercent: percentFromUnit(transmission.rpm),
    mode: transmission.mode,
  };
}

/**
 * Format a lap time in milliseconds as `MM:SS.mmm` for the §20 lap-timer
 * widget.
 *
 * Contract:
 * - Non-finite input (NaN, Infinity) collapses to `"--:--.---"` so the HUD
 *   can render a "no time" placeholder without the caller branching.
 * - Negative input collapses to `"00:00.000"`. Negative durations have no
 *   physical meaning for a lap timer; the HUD must never paint a sign.
 * - Inputs that overflow the 99-minute mark keep counting (e.g. 60 min
 *   renders as `"60:00.000"`); §20 lap times never approach an hour but
 *   the formatter does not rollover so a stuck timer reads honestly.
 *
 * Pure: same input always produces the same output. No locale awareness;
 * the §20 monospace stack is ASCII-only.
 */
export function formatLapTime(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--.---";
  const clamped = ms < 0 ? 0 : ms;
  // Round down so the displayed timer never jumps ahead of the
  // sim-reported elapsed; sub-millisecond precision is not part of the
  // HUD contract. Math.trunc keeps the ms count integer-safe.
  const totalMs = Math.trunc(clamped);
  const minutes = Math.trunc(totalMs / 60_000);
  const seconds = Math.trunc((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${mm}:${ss}.${mmm}`;
}

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
  // Surface lap-timer fields only when the caller supplied them so the
  // existing minimal HUD layout (no timer row) keeps its existing
  // snapshot shape. The renderer guards on `!= null`, so passing
  // `bestLapMs: null` here suppresses the BEST row while keeping the
  // current-lap timer visible (covers the "no PB yet" state).
  if (input.currentLapElapsedMs !== undefined) {
    result.currentLapElapsedMs = input.currentLapElapsedMs;
  }
  if (input.bestLapMs !== undefined) {
    result.bestLapMs = input.bestLapMs;
  }
  if (input.damage !== undefined) {
    result.damage = summarizeHudDamage(input.damage);
  }
  if (input.weather !== undefined) {
    result.weather = summarizeHudWeather(input.weather, input.weatherGripScalar);
  }
  if (input.nitro !== undefined) {
    result.nitro = summarizeHudNitro(
      input.nitro,
      input.nitroMaxCharges,
      input.nitroChargeDurationSec,
    );
  }
  if (input.transmission !== undefined) {
    result.gear = summarizeHudGear(input.transmission);
  }
  return result;
}
