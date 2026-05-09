---
title: "implement: weather + environmental systems per §14"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-26T00:57:31.146379-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-30T10:51:39.783163-05:00"
close-reason: All tracked §14 weather child slices are merged and production-smoked through ea20c42. Coverage ledger has 11 §14 rows for weather options, runtime grip, visibility risk, transitions, accessibility, and visual effects.
blocks:
  - VibeGear2-implement-arcade-physics-2efae8b6
---

## Description

Build `src/game/weather.ts`. Implement weather states (clear, light_rain, heavy_rain, fog, dusk, snow per §14), grip modifiers, visibility modifiers, and the weather-state machine per track. Apply modifiers inside the sim step.

## Context

Phase 4 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/14-weather-and-environmental-systems.md`. Tracks declare supported weather options in their JSON (§22).

## Affected Files

- `src/game/weather.ts` (new): pure modifier functions
- `src/game/__tests__/weather.test.ts` (new): grip multiplier per state, transitions
- `src/game/physics.ts` (update): consume weather modifier
- `src/render/vfx.ts` (new or update): rain particles, fog overlay
- `src/data/tracks/*.json` (update where needed): set `weatherOptions`

## Edge Cases

- Weather change mid-race (if §14 allows): smooth grip transition, no instant jump.
- Track with only `clear` weather: never roll a different state.
- AI weather skill modifier per `docs/gdd/15-cpu-opponents-and-ai.md`: applied here.

## Verify

- [ ] `weather.gripFor(state, baseStats)` returns the §14 grip multipliers within `1e-6` for each of `{ clear, light_rain, heavy_rain, fog, dusk, snow }`. Fixture table maps state to expected multiplier (e.g. `clear` -> `gripDry`, `heavy_rain` -> `gripWet * 0.85`).
- [ ] `weather.visibilityFor(state)` returns `1.0` for clear, `0.65` for fog, `0.75` for heavy_rain (per §14 visibility column); unit test asserts the table.
- [ ] State transitions: `weather.next(current, dt, randSeed)` is deterministic given the seed; same `(current, dt, seed)` produces the same next state across 1000 invocations.
- [ ] Smooth-transition rule: when state changes from `clear` to `heavy_rain`, the grip multiplier interpolates linearly over §14's transition window (default 2 s); the unit test samples 10 mid-transition ticks and asserts monotonic decrease.
- [ ] Track `weatherOptions = ["clear"]`: `weather.next(...)` always returns `clear`; never rolls another state.
- [ ] AI weather skill: `aiWeatherModifier(driver, weather)` reads `driver.weatherSkill[weather]` from the AI driver JSON and returns it directly; `clear` skill of `1.0` and `rain` skill of `1.04` produce the documented pace bias.
- [ ] Physics integration: with `weather.heavy_rain` active, the same scripted input produces a longer braking distance than `weather.clear` by at least 15% (regression test against §14 grip table).
- [ ] VFX: `weather.heavy_rain` triggers rain particles in `vfx.ts` with density per §14; `weather.fog` overlays a fog gradient on the canvas. RTL canvas-spy test asserts the expected draw calls.
- [ ] Playwright smoke (`e2e/weather.spec.ts`): load `/race?track=test-straight&weather=heavy_rain`, drive 3 s, screenshot, assert it differs from the clear-weather baseline (`toMatchSnapshot` with 1% tolerance).
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/weather.ts src/game/__tests__/weather.test.ts e2e/weather.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 15, researcher pass)

The current spec lists verify thresholds (e.g. `0.65` visibility for fog, `gripWet * 0.85` for heavy_rain, "default 2 s" transition window) that **do not appear in `docs/gdd/14-weather-and-environmental-systems.md`**. The GDD lists the weather types and qualitative effects ("rain and snow reduce base grip", "fog does not change grip directly but changes reaction time") but does not pin numbers. Ambiguity must be resolved before implementation begins, otherwise the test thresholds are unverifiable against the source of truth.

Concrete decisions to add to this dot:

1. **Pin a grip multiplier table.** The dot's verify steps reference unspecified numbers. Pin in `src/game/weather.ts`:
   ```ts
   export const WEATHER_GRIP_MULTIPLIERS: Readonly<Record<WeatherOption, number>> = Object.freeze({
     clear:       1.00,
     dusk:        0.98,
     night:       0.97,
     overcast:    0.99,  // present in GDD §14 but missing from WeatherOptionSchema; see decision 7
     light_rain:  0.85,
     rain:        0.78,
     heavy_rain:  0.66,
     fog:         1.00,  // GDD: "fog does not change grip directly"
     snow:        0.55,
   });
   ```
   These numbers are agent-picked defaults; flag in the §14 GDD edits as "added grip table" so design can override.

2. **Pin a visibility table.** Same problem, same fix:
   ```ts
   export const WEATHER_VISIBILITY: Readonly<Record<WeatherOption, number>> = Object.freeze({
     clear: 1.00, overcast: 0.95, dusk: 0.85, night: 0.65,
     light_rain: 0.90, rain: 0.80, heavy_rain: 0.70,
     fog: 0.50, snow: 0.60,
   });
   ```
   Visibility is consumed by the renderer's draw distance and by the AI reaction-time multiplier (§15 weather skill). The exact numbers are agent-picked; document the source.

3. **`overcast` is missing from the schema.** GDD §14 lists "Overcast" but `WeatherOptionSchema` (`src/data/schemas.ts:38-47`) only enumerates `clear, light_rain, rain, heavy_rain, fog, snow, dusk, night`. Two options:
   - (preferred) extend `WeatherOptionSchema` to add `"overcast"`, update fixture coverage, and ship grip 0.99 / visibility 0.95.
   - or note in the §14 GDD edit that overcast is folded into `clear` for v1.0.
   Pick the schema extension; overcast is cheap to add and the schema is the single source of truth.

4. **`AIWeatherSkill` only has 4 keys; weather has 9.** `AIWeatherSkillSchema` (`src/data/schemas.ts:235`) exposes `{clear, rain, fog, snow}`. There is no per-state mapping for `light_rain`, `heavy_rain`, `dusk`, `night`, `overcast`. The dot says `aiWeatherModifier(driver, weather)` reads `driver.weatherSkill[weather]` directly, which does not type-check. Resolve with a mapping function:
   ```ts
   function weatherSkillFor(driver: AIDriver, w: WeatherOption): number {
     switch (w) {
       case "clear": case "overcast": case "dusk": case "night": return driver.weatherSkill.clear;
       case "light_rain": case "rain": case "heavy_rain":         return driver.weatherSkill.rain;
       case "fog":                                                 return driver.weatherSkill.fog;
       case "snow":                                                return driver.weatherSkill.snow;
     }
   }
   ```
   Add a unit test that the function is exhaustive (TS will already enforce, but a runtime test guards against schema additions).

5. **`weather.next(current, dt, randSeed)` signature is wrong for determinism.** A seed alone is not enough; you need a seeded PRNG instance whose state advances. Otherwise `next` is either pure (returns the same state every call, no transitions) or non-deterministic (uses `Math.random`). The seeded RNG dot (`VibeGear2-implement-seeded-deterministic-2ae383f2`) is the right dependency. Update signature:
   ```ts
   weather.next(current: WeatherOption, dt: number, rng: SeededRng, options: WeatherTransitionOptions): WeatherOption
   ```
   Add `blocks: VibeGear2-implement-seeded-deterministic-2ae383f2` (i.e. weather is blocked by RNG landing first).

6. **Smooth transition needs a state shape, not just an enum.** The dot says "grip multiplier interpolates linearly over 2 s when state changes", but `weather.next` returns a `WeatherOption` (an enum). Without a sub-state, callers cannot interpolate. Pin the runtime state as:
   ```ts
   export interface WeatherState {
     current: WeatherOption;
     transitioning: { from: WeatherOption; to: WeatherOption; progress: number } | null;
   }
   ```
   `gripFor(state, baseStats)` then interpolates between `WEATHER_GRIP_MULTIPLIERS[from]` and `WEATHER_GRIP_MULTIPLIERS[to]` by `progress`. The `WeatherTransitionOptions` includes `transitionSeconds` defaulting to 2 s.

7. **Track-only-clear edge case is wrong.** §14 says "Every track supports 1 to 3 approved weather sets". So `weather.next` must take the track's `weatherOptions` and only transition between those. Update signature to include `allowedStates: ReadonlyArray<WeatherOption>` and fail loudly if `current` is not in it.

8. **Physics integration verify is wrong.** "Scripted input produces a longer braking distance than `weather.clear` by at least 15%" assumes `weather.heavy_rain` reduces grip by 15%. But the current `physics.ts step` does **not** read weather (`OFF_ROAD_DRAG_M_PER_S2` and `gripDry` are the only friction sources). The dot's "Affected Files" lists `src/game/physics.ts (update): consume weather modifier`, but does not pin **how**. Pin the integration:
   - Add a `weatherGripMultiplier: number` field to `TrackContext` (default 1.0).
   - `step()` multiplies `gripDry` (or selects `gripWet`) by that field before applying grip-dependent terms (lateral grip in steering, off-road traction).
   - The race scene composes `TrackContext` with the weather multiplier per tick.

9. **VFX integration is loosely specified.** The dot says "weather.heavy_rain triggers rain particles in vfx.ts with density per §14". §14 has no density numbers. Pin: `RAIN_PARTICLE_DENSITY_PER_M2 = 0.4` for rain, `1.0` for heavy_rain, `0` otherwise. `FOG_OVERLAY_ALPHA = 0.45` for fog, `0` otherwise. Document as agent-picked defaults.

10. **Affected Files miss the schema patch.** Add `src/data/schemas.ts (update)` if decision 3 lands (extend `WeatherOptionSchema` to include `overcast`), plus `src/data/__tests__/schemas.test.ts` (update) for the new enum value. Also add `src/render/pseudoRoadCanvas.ts (update)` because the visibility table feeds into draw distance.

11. **Playwright snapshot test is fragile.** "Screenshot, assert it differs from the clear-weather baseline" with 1% tolerance on a Canvas2D scene flakes on font subpixel rendering. Replace with a structural assertion: spy on `fillRect` calls on the offscreen canvas and assert at least N rain particle calls and one fog overlay call. The screenshot can stay as a manual gate; the unit test is the deterministic gate.

12. **FOLLOWUPS impact.** F-015 (persistent off-road damage) was deferred to the §13 damage slice. Weather similarly affects damage risk per §14 ("heavy weather increases collision risk by lowering visibility") but the damage state machine does not exist yet. Add a NOTE in this dot's Description: "Damage tie-in deferred to the §13 damage slice; `weather.ts` exposes the visibility scalar; the damage slice consumes it."

13. **Test count realism.** Reasonable test count for `src/game/__tests__/weather.test.ts`: 30 to 40 cases, similar to `physics.test.ts` (27) and `input.test.ts` (27). Plan: 9 cases per state in the grip / visibility tables, 6 transition cases (start, mid, end, allowed-set guard, NaN dt, negative dt), 4 AI skill mapping cases, 3 physics integration smokes, 4 VFX smokes.
