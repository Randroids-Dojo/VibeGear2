/**
 * §23 "Weather modifiers" lookup per
 * `docs/gdd/23-balancing-tables.md`. Pins a frozen per-weather table of
 * `dryTireMod / wetTireMod` keyed by the five §23 rows (Clear, Rain,
 * Heavy rain, Snow, Fog).
 *
 * This module is the authoritative consumer of the §23 row that the
 * balancing-pass slice (`feat/balancing-pass-23`) pinned in
 * `src/data/__tests__/balancing.test.ts` under "deferred to F-043".
 * With this module in place the balancing test imports
 * `WEATHER_TIRE_MODIFIERS` and asserts every cell, so a §23 retune has
 * exactly one place to edit.
 *
 * Scalar semantics. Both fields are additive grip offsets, applied on
 * top of a car's `baseStats.gripDry` or `baseStats.gripWet`. Per §23:
 *
 *   effectiveGripDry = baseStats.gripDry + modifiers.dryTireMod
 *   effectiveGripWet = baseStats.gripWet + modifiers.wetTireMod
 *
 * In Clear weather a dry tire grips +0.08 above its baseline and a wet
 * tire is unchanged (the §23 numbers reward the right tire pick: dry
 * tires are a real edge in clear conditions). In Heavy rain a dry tire
 * loses 0.20 and a wet tire gains 0.16, so a wet-tire pick more than
 * recovers the dry-tire deficit. Fog is grip-neutral on both columns
 * (§14 calls out fog as a visibility hazard, not a grip hazard); the
 * row exists in §23 only as a documentation anchor.
 *
 * The runtime consumers of these modifiers (per the parent dot
 * `VibeGear2-implement-weather-38d61fc2`) have not landed yet:
 *
 *   - `src/game/physics.ts` will read the resolved grip in its lateral
 *     friction term so a heavy-rain track on dry tires demonstrably
 *     under-steers compared to clear.
 *   - The pre-race UI (§14) will surface "current condition / grip
 *     rating" using these numbers as the input to the rating pill.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals.
 * `getWeatherTireModifier(weather)` returns the same frozen object
 * reference every call so callers can lean on identity comparison.
 *
 * Scope. This slice deliberately does **not** add a tire-type concept,
 * a weather state machine, or a physics integration. Per
 * `docs/AGENTS.md` RULE 9 (scope discipline) the table itself is the
 * smallest shippable cell: future work in the parent dot wires the
 * consumers and adds the state-machine on top of this binding. Adding
 * a new §23 weather row, renaming a column, or moving a number
 * requires updating both the table here and the unit pin in
 * `src/game/__tests__/weather.test.ts` (and the §23 cross-check in
 * `src/data/__tests__/balancing.test.ts`).
 *
 * Schema coverage. `WeatherOption` (the `TrackSchema`-validated enum
 * authored in `src/data/schemas.ts`) declares eight weather values:
 * `clear`, `light_rain`, `rain`, `heavy_rain`, `fog`, `snow`, `dusk`,
 * `night`. §23 only specifies five of them. The lookup here is
 * intentionally typed as a `Partial<Record<WeatherOption, ...>>` so a
 * caller asking for `light_rain`, `dusk`, or `night` gets a typed
 * `undefined` rather than a fabricated row. The convention matches
 * `AIWeatherSkillSchema`, which also collapses light / medium rain
 * into a single `rain` key. Filed as `Q-008` to track whether the
 * three uncovered weathers should pin to identity, alias to the §23
 * row that fits, or block the parent weather slice; no decision is
 * needed until a runtime consumer lands.
 */

import type { WeatherOption } from "@/data/schemas";

/**
 * §23 rows that pin a tire-modifier cell. Five entries, exactly the
 * five rows in `docs/gdd/23-balancing-tables.md` "Weather modifiers".
 * Subset of `WeatherOption` (the schema enum has eight entries; §23
 * specifies five). Exported so callers can constrain to the §23 set
 * at their site.
 */
export type WeatherTireModifierKey =
  | "clear"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "fog";

/**
 * §23 "Weather modifiers" cell. Both fields are additive grip
 * offsets layered on top of a car's `baseStats.gripDry` /
 * `baseStats.gripWet`. Negative values reduce grip; positive values
 * increase it. `0` means the cell does not affect that tire type.
 */
export interface WeatherTireModifier {
  /**
   * Additive offset on `baseStats.gripDry`. `+0.08` in Clear,
   * `-0.20` in Heavy rain.
   */
  readonly dryTireMod: number;
  /**
   * Additive offset on `baseStats.gripWet`. `0` in Clear,
   * `+0.16` in Heavy rain.
   */
  readonly wetTireMod: number;
}

/**
 * Frozen scalar table, copied verbatim from §23 "Weather modifiers"
 * in `docs/gdd/23-balancing-tables.md`:
 *
 *     | Weather    | Dry tire modifier | Wet tire modifier |
 *     | ---------- | ----------------- | ----------------- |
 *     | Clear      | +0.08             |  0.00             |
 *     | Rain       | -0.12             | +0.10             |
 *     | Heavy rain | -0.20             | +0.16             |
 *     | Snow       | -0.18             | +0.14             |
 *     | Fog        |  0.00             |  0.00             |
 *
 * Walking the wet-vs-dry intent: dry tires reward Clear, wet tires
 * reward any precipitating row, and Fog neutral-pins because fog is a
 * visibility hazard rather than a grip hazard (§14). Rain and Heavy
 * rain trade dry grip for wet grip on a steeper slope as the rain
 * intensifies, so a wet-tire pick stays the right call from light
 * rain through heavy rain.
 */
export const WEATHER_TIRE_MODIFIERS: Readonly<
  Record<WeatherTireModifierKey, WeatherTireModifier>
> = Object.freeze({
  clear: Object.freeze({ dryTireMod: 0.08, wetTireMod: 0 }),
  rain: Object.freeze({ dryTireMod: -0.12, wetTireMod: 0.1 }),
  heavy_rain: Object.freeze({ dryTireMod: -0.2, wetTireMod: 0.16 }),
  snow: Object.freeze({ dryTireMod: -0.18, wetTireMod: 0.14 }),
  fog: Object.freeze({ dryTireMod: 0, wetTireMod: 0 }),
});

/**
 * Stable iteration order for the §23 rows, in the order they appear
 * in the GDD table. Frozen so callers cannot mutate it.
 */
export const WEATHER_TIRE_MODIFIER_KEYS: ReadonlyArray<WeatherTireModifierKey> =
  Object.freeze(["clear", "rain", "heavy_rain", "snow", "fog"]);

/**
 * Type guard for the §23-row subset of `WeatherOption`. Useful at
 * call sites that have a generic `WeatherOption` and need to branch
 * on whether the §23 lookup applies.
 */
export function isWeatherTireModifierKey(
  weather: WeatherOption,
): weather is WeatherTireModifierKey {
  return (
    weather === "clear" ||
    weather === "rain" ||
    weather === "heavy_rain" ||
    weather === "snow" ||
    weather === "fog"
  );
}

/**
 * Look up the §23 modifiers for the given weather. Returns the same
 * frozen object reference every call so callers can lean on identity
 * comparison without a deep-clone allocation per tick. Returns
 * `undefined` for any `WeatherOption` value that §23 does not pin
 * (currently `light_rain`, `dusk`, `night`); see Q-008. Callers must
 * decide their fallback at the call site rather than have this module
 * fabricate a row that drifts from §23.
 */
export function getWeatherTireModifier(
  weather: WeatherOption,
): WeatherTireModifier | undefined {
  if (!isWeatherTireModifierKey(weather)) return undefined;
  return WEATHER_TIRE_MODIFIERS[weather];
}
