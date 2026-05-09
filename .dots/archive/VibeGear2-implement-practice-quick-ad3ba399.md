---
title: "implement: practice + quick-race modes per §6"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:57:36.462090-05:00\\\"\""
closed-at: "2026-04-29T12:09:46.828491-05:00"
close-reason: "Implemented Quick Race in PR #93 and Practice mode in PR #94, both merged and deployed."
---

## Description

Implement two modes from GDD §6 that no other dot covers: **Practice** and **Quick Race**.

- **Practice**: a no-stakes test session with restart, checkpoint reset, visible grip telemetry, and instant weather swap. No countdown, no AI, no economy.
- **Quick Race**: pick any unlocked track + weather variant + owned car. AI present per the track's grid size. No campaign economy (no credits earned, no damage persisted).

Both modes share the runtime core (race rules, physics, AI) with Championship; they differ only in their session-shape and the screens that wrap them.

## Context

Phase 5 task per `docs/IMPLEMENTATION_PLAN.md`. GDD §6 lists Practice, Quick Race, Time Trial, Daily Challenge, and Community Challenge as the modes alongside the Championship centerpiece. `implement-time-trial-5d65280a` covers Time Trial + Daily Challenge. Championship is implemented through `implement-tour-region-d9ca9a4d` + `implement-race-rules-b30656ae` + `implement-economy-upgrade-ff73b279`. Community Challenge is explicitly post-v1.0 per §6.

That leaves Practice and Quick Race uncovered. Both are first-class menu options that ship with v1.0 even though their value is "tier-2" relative to Championship. Without them, the player has no way to test handling on a track outside the campaign loop, and modders have no way to load their own tracks for solo verification.

Both modes wrap the existing `raceSession` runtime. Practice adds two extra commands (`restart`, `resetToCheckpoint`) and a telemetry overlay. Quick Race adds a track / weather / car picker UI but otherwise behaves like a single Championship race with the economy disabled.

Depends on `implement-race-rules-b30656ae` (the race lifecycle exists) and `implement-tour-region-d9ca9a4d` (the unlocked-tracks list is queryable from save state). Does not block any release-gating dot.

## Affected Files

- `src/game/modes/practice.ts` (new): pure session state for Practice with `restart`, `resetToCheckpoint`, `swapWeather` actions. No countdown timer.
- `src/game/modes/quickRace.ts` (new): pure session state for Quick Race; wraps `raceRules` with `economyDisabled: true`.
- `src/app/practice/page.tsx` (new): track picker + practice runtime; shows a telemetry overlay (grip multiplier, surface flag, lateral g, current weather).
- `src/app/quick-race/page.tsx` (new): three-step picker (track, weather, car), then mounts `<RaceCanvas>` with the selected config.
- `src/components/quick-race/Picker.tsx` (new): shared list-and-detail picker UI.
- `src/game/__tests__/practice.test.ts` (new): `restart` returns the session to t=0 with the same track and weather; `resetToCheckpoint` rewinds to the last passed checkpoint.
- `src/game/__tests__/quickRace.test.ts` (new): finishing a Quick Race does not write to `garage.credits` or `progress.completedTours`; only persisted change is `records[trackId].bestLapMs` if a PB is set.
- `e2e/practice.spec.ts` (new): load `/practice?track=test-straight`, press `R` to restart, lap timer resets, press `T` to cycle weather, overlay updates.
- `e2e/quick-race.spec.ts` (new): load `/quick-race`, pick track / weather / car, race for 5 s, finish, assert no credits awarded.

## Edge Cases

- Practice on a track that lists only `clear` weather: cycle wraps to the same `clear` state; no error.
- Quick Race with the only unlocked track: picker still works (single track in list); cannot pick locked tracks even if their JSON exists in `src/data/tracks/`.
- Quick Race with no owned cars: picker shows "Pick a starter car first" and links to `/garage`.
- Practice "reset to last checkpoint" on lap 1 before the first checkpoint is passed: rewinds to the start line.
- Practice telemetry overlay is a developer-style overlay with a toggle (default on in Practice, off everywhere else); never drawn on top of the regular HUD.
- Saving a Time Trial PB inside Practice: not allowed; PBs only count from Time Trial mode (per §6).

## Verify

- [ ] `practice.restart(session)` returns a session with `tick = 0`, `lap = 1`, `damage = 0`, same `track` and `weather`; never mutates input.
- [ ] `practice.resetToCheckpoint(session)` rewinds tick and lap to the last `checkpoints[]` entry the player passed; weather state preserved.
- [ ] `practice.swapWeather(session, weatherId)` returns a session with the new weather; rejects if `weatherId` not in `track.weatherOptions`.
- [ ] `quickRace.finish(session)` returns a result object with `creditsAwarded === 0`, `damagePersisted === false`. Spy on `save.write` records no `garage.credits` mutation.
- [ ] `quickRace.finish(session)` updates `records[trackId].bestLapMs` only when the lap is faster than the prior PB (shared logic with Time Trial PB).
- [ ] Playwright e2e (`e2e/practice.spec.ts`): load `/practice?track=test-straight`, press `R`, lap timer shows `0:00.000`; press `T`, weather overlay text changes.
- [ ] Playwright e2e (`e2e/quick-race.spec.ts`): load `/quick-race`, pick track / weather / car, finish a 1-lap race, results overlay shows time but no "credits earned" line; reload the save and `garage.credits` is unchanged.
- [ ] Practice telemetry overlay visible at top-right with grip multiplier, surface flag, lateral g, weather; toggleable with the configured key (default backtick).
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/modes/practice.ts src/game/modes/quickRace.ts src/app/practice src/app/quick-race e2e/practice.spec.ts e2e/quick-race.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/06-game-modes.md` (Practice and Quick Race entries).
- `docs/gdd/07-race-rules-and-structure.md` (race lifecycle reused).
- `.dots/VibeGear2-implement-time-trial-5d65280a.md` (sibling mode dot, shares PB logic).

## Spec stress-test (iteration 15, researcher pass)

This dot is well-shaped at the prose level but has a few load-bearing assumptions baked into the verify steps that the codebase does not yet support. An implementer would discover these mid-PR and have to refactor.

Concrete decisions to add to this dot:

1. **`raceSession` does not exist yet.** The dot says "Both modes wrap the existing `raceSession` runtime." But `src/game/` has only `raceState.ts` (`{phase, elapsed, lap, totalLaps}`), not a session abstraction. The actual race lifecycle lives in `race-rules-b30656ae` (the dot listed in the front-matter `blocks:` list does not exist; verify with `dot show VibeGear2-implement-race-rules-b30656ae`). Pin: this dot is **strictly downstream** of `race-rules-b30656ae`, `tour-region-d9ca9a4d`, and the Phase 1 vertical-slice integration dot. Front-matter should list:
   ```yaml
   blocks:
     - VibeGear2-implement-race-rules-b30656ae
     - VibeGear2-implement-tour-region-d9ca9a4d
     - VibeGear2-implement-phase-1-7aef013d
   ```
   (`blocks:` in this CLI's vocabulary means "this dot is blocked by", per the dot CLI conventions used elsewhere in `.dots/`.)

2. **`practice.resetToCheckpoint` requires checkpoint-pass tracking that does not exist.** `RaceState` carries `{phase, elapsed, lap, totalLaps}` only. There is no `lastCheckpointIndex` or `lastCheckpointTick`. The Track schema has `checkpoints[]` (`src/data/schemas.ts:67`) with `{segmentIndex, label}`, but nothing reads them at runtime. Pin a minimal extension:
   ```ts
   // race-rules-b30656ae must add this; practice consumes it.
   interface RaceState {
     // ... existing fields
     lastCheckpoint: { tick: number; index: number; carState: CarState } | null;
   }
   ```
   Without this, "rewinds to the last passed checkpoint" is unimplementable. Practice cannot ship before race-rules.

3. **`practice.swapWeather` cannot work without the weather state machine.** Weather is owned by `weather-38d61fc2` (which itself is unfinished, see iter-15 stress-test on that dot). Pin: practice depends on `weather.ts` exposing a `setWeather(state, target)` mutation that respects `track.weatherOptions`. If weather is not yet wired, the practice "instant weather swap" verify step can be marked `skip("weather slice not landed")`. Document the dependency.

4. **`quickRace.finish` "spy on save.write records no garage.credits mutation" is brittle.** `src/persistence/save.ts` `saveSave(save)` writes the entire SaveGame at once; a spy cannot tell whether `credits` specifically was mutated, only whether `saveSave` was called. Pin a stronger contract:
   - `quickRace.finish` returns `{ creditsAwarded: 0, damagePersisted: false, recordsUpdated: { trackId?: { bestLapMs: number } } }`.
   - The caller (the page component) is responsible for merging `recordsUpdated` into the save and calling `saveSave`. The mode itself does no IO.
   - Test asserts `result.creditsAwarded === 0` and inspects `result.recordsUpdated`. No need to spy on `save.write`.

5. **Practice telemetry overlay needs a new component path.** The dot's Affected Files list `src/app/practice/page.tsx` but not `src/components/practice/TelemetryOverlay.tsx`. Add:
   - `src/components/practice/TelemetryOverlay.tsx` (new): grip multiplier, surface flag, lateral g, weather; toggleable; `pointer-events: none`.
   - `src/components/practice/usePracticeKeys.ts` (new): hooks for `R` (restart), `T` (cycle weather), and the configured backtick toggle for the overlay. Pattern matches `src/components/pause/usePauseToggle.ts`.

6. **Backtick is a terrible default toggle key.** Backtick + Cmd is browser-reserved (DevTools cycle). Pin a conflict-free default like `F2` or `\`. Document on the dot: "telemetry-overlay toggle key default is `F2`; configurable via DEFAULT_KEY_BINDINGS once F-014 lands."

7. **Quick Race's "no owned cars" edge case is unreachable.** The save's `defaultSave()` always grants Sparrow GT (`src/persistence/save.ts`), and there is no UI to sell cars. Either:
   - Drop the "no owned cars" verify step as unreachable.
   - Or test it via a fixture save where `garage.ownedCars = []` (which would fail Zod validation under the current schema, since `defaultSave()` ensures at least one).
   The simpler fix: drop the edge case from the verify list. If a future garage slice introduces selling, re-add it then.

8. **Quick Race's weather picker requires the weather state machine to support deterministic forced-weather races.** Today, `weather.next` (per the iter-15 stress-test on `weather-38d61fc2`) rolls states stochastically. A Quick Race with a player-picked weather must lock the weather for the duration of the race (no `weather.next` calls). Pin a `lockedWeather: WeatherOption | null` field on the session config.

9. **Time Trial PB exclusion needs a flag, not a mode-name string.** "PBs only count from Time Trial mode (per §6)" is right, but how does `records[trackId].bestLapMs` know it was set in Time Trial vs Practice? Pin: the session config carries a `recordPBs: boolean` flag. Practice sets `false`, Time Trial and Quick Race set `true`. The page passes the flag into the lap-completion handler.

10. **Telemetry overlay variables need a source.** "Grip multiplier" and "lateral g" are not surfaced from `physics.ts` `step()`; the function returns `CarState` only. Pin a debug companion:
    ```ts
    // physics.ts (update):
    export function stepWithDebug(state, input, stats, ctx, dt): { next: CarState; debug: PhysicsDebug };
    interface PhysicsDebug {
      gripScalar: number;
      surfaceFlag: "road" | "grass" | "rumble";
      lateralAccelG: number;
    }
    ```
    `stepWithDebug` is the practice-only call; race / time-trial use the existing `step()` to keep the hot path narrow. Add this to Affected Files.

11. **Verify steps reference dev-page `/dev/road` patterns; production routes do not exist yet.** `src/app/practice/page.tsx` and `src/app/quick-race/page.tsx` are net-new routes, but the page composition (loop + canvas + HUD + input wiring) is not yet abstracted into a reusable `<RaceCanvas>` component. The dot's Affected Files mention `<RaceCanvas>` but there is no such component in the tree. Either:
    - Add `src/components/race/RaceCanvas.tsx` (new) to Affected Files; this is the Phase 1 integration boundary that lives in `phase-1-7aef013d`.
    - Or inline the composition in each page (worse; duplicates wiring).
    Pin: this dot is gated on `phase-1-7aef013d` shipping `<RaceCanvas>`. Add to `blocks:`.

12. **Test count realism.** Verify list has 9 bullets. Reasonable test count: ~25 cases.
    - `practice.test.ts`: 8 (restart purity, restart preserves track/weather, resetToCheckpoint at lap 1 pre-checkpoint, mid-lap, multiple checkpoints, swapWeather valid, swapWeather rejected, weather options match track).
    - `quickRace.test.ts`: 7 (finish credits 0, damage not persisted, PB updated when faster, PB not updated when slower, no PB pre-existing, picker config validation, locked weather respected).
    - Two e2e specs (deferred to F-NNN if Playwright harness missing, mirrors F-016 / F-017 pattern).

13. **The dot's `created-at` is `2026-04-26T01:57:36...` which is later than most other dots.** Verify ordering: this dot was filed after the iter-13 backlog seeding, so it's correctly slotted as Phase 5 work but the dependency declaration is missing. Adding the `blocks:` list above (decision 1, 2, 11) addresses this.
