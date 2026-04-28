/**
 * Pure session-action helpers per dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * The §20 pause menu exposes Restart / Retire / Exit-to-Title controls.
 * Restart re-uses `createRaceSession` directly (the existing reducer
 * already produces a fresh state from the same config, which is exactly
 * what restart wants). Retire flips the player to DNF and the race phase
 * to "finished" so a downstream caller (the page wiring) can build the
 * results screen from the same `buildFinalRaceState` boundary the
 * natural-finish path uses. Exit-to-Title is purely a router + loop
 * dispose concern and lives in the React hook layer; this module owns
 * no helper for it because there is nothing pure to test.
 *
 * Determinism: no `Math.random`, no `Date.now`, no globals. Same input
 * always returns the same output.
 *
 * Boundary with sibling modules:
 *
 *   - `raceSession.ts` owns the live reducer. This module returns a
 *     fresh `RaceSessionState`; it never mutates the input.
 *   - `raceRules.ts` owns the `DnfReason` union. We extend it with
 *     `"retired"` so the user-initiated DNF is visually distinct from
 *     the off-track / no-progress timeouts.
 *   - The §20 results screen consumes the resulting session through
 *     `buildFinalRaceState` + `buildRaceResult`; this helper guarantees
 *     the player record carries `status: "dnf"` so the results screen
 *     renders the DNF row.
 */

import type { DnfReason, FinalCarInput } from "./raceRules";
import {
  PLAYER_CAR_ID,
  aiCarId,
  type RaceSessionAICar,
  type RaceSessionPlayerCar,
  type RaceSessionState,
} from "./raceSession";

/**
 * `DnfReason` value pinned for user-initiated retirement. Re-exported here
 * so callers (the pause-actions hook, results-screen widgets) can import
 * the constant without reaching into `raceRules.ts` for the literal.
 */
export const DNF_REASON_RETIRED: Extract<DnfReason, "retired"> = "retired";

/**
 * Flip a live `RaceSessionState` into the post-retire shape:
 *
 *   - The player car's `status` flips to `"dnf"` and `dnfReason` is set
 *     to `"retired"`. Any laps already completed stay on `lapTimes`; the
 *     player's `finishedAtMs` stays `null` because a DNF never crosses
 *     the line. The car snapshot itself (position, speed, etc.) is left
 *     untouched so a future widget could draw the abandoned car at the
 *     point of retirement.
 *
 *   - Every still-racing AI is left racing. The §7 multi-car finish gate
 *     in `stepRaceSession` already promotes the race to `"finished"`
 *     once every car has stopped racing; flipping only the player
 *     mirrors what would happen naturally if the player crashed off-
 *     track. The race phase is forced to `"finished"` here so the
 *     results screen can render immediately rather than waiting for the
 *     AI grid to finish their laps.
 *
 *   - Already-finished or already-DNF cars are returned untouched (the
 *     player included). Calling `retireRaceSession` on a finished
 *     session is a no-op so a button-mash on the pause menu cannot
 *     flip a winner into a retiree.
 *
 * Pure: returns a fresh state every call; the input is never mutated.
 */
export function retireRaceSession(
  state: Readonly<RaceSessionState>,
): RaceSessionState {
  if (state.race.phase === "finished") {
    return clonePure(state);
  }
  // The retire path bypasses the per-tick DNF reducer entirely; it sets
  // the player's status / reason / finishedAtMs directly so the §20
  // results screen reads the same shape it would on a natural DNF.
  const player: RaceSessionPlayerCar =
    state.player.status === "racing"
      ? {
          ...state.player,
          car: { ...state.player.car },
          nitro: { ...state.player.nitro },
          transmission: { ...state.player.transmission },
          assistMemory: { ...state.player.assistMemory },
          dnfTimers: { ...state.player.dnfTimers },
          lapTimes: state.player.lapTimes.slice(),
          status: "dnf",
          dnfReason: DNF_REASON_RETIRED,
          finishedAtMs: null,
        }
      : clonePlayerPure(state.player);

  // AI cars are unchanged on a player retire. Cloning each entry keeps
  // the immutable-shape contract (the caller treats every result as a
  // fresh value).
  const ai: RaceSessionAICar[] = state.ai.map(cloneAiPure);

  return {
    race: { ...state.race, phase: "finished" },
    player,
    ai,
    tick: state.tick,
    sectorTimer: state.sectorTimer,
    baselineSplitsMs: state.baselineSplitsMs,
    draftWindows: state.draftWindows,
    brokenHazards: state.brokenHazards.slice(),
  };
}

/**
 * Project the per-car snapshot the §7 final-state builder consumes from
 * a (possibly mid-race) `RaceSessionState`. The natural-finish path on
 * `stepRaceSession` flips every still-racing car to `"finished"` once
 * the race ends; the user-initiated retire path flips only the player,
 * which leaves AI cars on `"racing"` at the moment retire fires. We
 * coerce both `"racing"` and `"dnf"` to `"dnf"` for the final state so
 * `buildFinalRaceState` produces a deterministic finishing order even
 * when the AI grid was still on the move.
 *
 * Used by the §20 results-screen wiring on a retire transition; pure on
 * the input session, never mutates it.
 */
export function buildFinalCarInputsFromSession(
  state: Readonly<RaceSessionState>,
): ReadonlyArray<FinalCarInput> {
  const cars: FinalCarInput[] = [];
  cars.push({
    carId: PLAYER_CAR_ID,
    status: state.player.status === "finished" ? "finished" : "dnf",
    raceTimeMs: state.player.finishedAtMs,
    lapTimes: state.player.lapTimes.slice(),
  });
  state.ai.forEach((entry, index) => {
    cars.push({
      carId: aiCarId(index),
      status: entry.status === "finished" ? "finished" : "dnf",
      raceTimeMs: entry.finishedAtMs,
      lapTimes: entry.lapTimes.slice(),
    });
  });
  return cars;
}

function clonePure(state: Readonly<RaceSessionState>): RaceSessionState {
  return {
    race: { ...state.race },
    player: clonePlayerPure(state.player),
    ai: state.ai.map(cloneAiPure),
    tick: state.tick,
    sectorTimer: state.sectorTimer,
    baselineSplitsMs: state.baselineSplitsMs,
    draftWindows: state.draftWindows,
    brokenHazards: state.brokenHazards.slice(),
  };
}

function clonePlayerPure(
  player: Readonly<RaceSessionPlayerCar>,
): RaceSessionPlayerCar {
  return {
    ...player,
    car: { ...player.car },
    nitro: { ...player.nitro },
    transmission: { ...player.transmission },
    assistMemory: { ...player.assistMemory },
    dnfTimers: { ...player.dnfTimers },
    lapTimes: player.lapTimes.slice(),
  };
}

function cloneAiPure(entry: Readonly<RaceSessionAICar>): RaceSessionAICar {
  return {
    ...entry,
    car: { ...entry.car },
    state: { ...entry.state },
    nitro: { ...entry.nitro },
    transmission: { ...entry.transmission },
    dnfTimers: { ...entry.dnfTimers },
    lapTimes: entry.lapTimes.slice(),
  };
}
