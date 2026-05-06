/**
 * Pure bridge between the race-session audio-event stream and the
 * `VfxState` reducer. Iter-8 found that `src/render/vfx.ts` shipped
 * `fireFlash` / `fireShake` end-to-end with `drawRoad` plumbing, but
 * no caller in the race page ever fired them: the module shipped as
 * dead code in production. This bridge wires the existing audio-event
 * stream (already routed for SFX, music ducking, story moments, etc.)
 * into the VFX state so impacts shake the camera and lap rollovers
 * flash the screen per §16 "light camera shake on impact" + "HUD
 * flash on lap complete".
 *
 * The function is pure: same input events plus same prior state plus
 * same tick produce the same output state. Reduced-motion gating lives
 * inside `fireShake`; flashes are not gated because the lap-complete /
 * race-finish flash is a navigation cue per the §19 reduced-motion
 * spec.
 */

import type {
  RaceSessionAudioEvent,
  RaceSessionImpactAudioEvent,
} from "@/game/raceSession";
import type { HitKind } from "@/game/damage";
import {
  fireFlash,
  fireShake,
  type VfxState,
} from "@/render/vfx";

interface ImpactStyle {
  readonly flashIntensity: number;
  readonly flashColor: string;
  readonly flashDurationMs: number;
  readonly shakeAmplitudePx: number;
  readonly shakeDurationMs: number;
  readonly shakeFrequencyHz: number;
}

const IMPACT_STYLES: Record<HitKind, ImpactStyle> = {
  wallHit: {
    flashIntensity: 0.45,
    flashColor: "#ffffff",
    flashDurationMs: 220,
    shakeAmplitudePx: 14,
    shakeDurationMs: 280,
    shakeFrequencyHz: 30,
  },
  carHit: {
    flashIntensity: 0.32,
    flashColor: "#ffffff",
    flashDurationMs: 220,
    shakeAmplitudePx: 9,
    shakeDurationMs: 280,
    shakeFrequencyHz: 30,
  },
  rub: {
    flashIntensity: 0.18,
    flashColor: "#ffaa00",
    flashDurationMs: 220,
    shakeAmplitudePx: 4,
    shakeDurationMs: 280,
    shakeFrequencyHz: 30,
  },
  // Off-road kinds reuse the rub style: low-intensity rumble that reads
  // as "the car is bumping over rough terrain" rather than a hard hit.
  offRoadObject: {
    flashIntensity: 0.18,
    flashColor: "#ffaa00",
    flashDurationMs: 220,
    shakeAmplitudePx: 4,
    shakeDurationMs: 280,
    shakeFrequencyHz: 30,
  },
  offRoadPersistent: {
    flashIntensity: 0.0,
    flashColor: "#ffaa00",
    flashDurationMs: 0,
    shakeAmplitudePx: 0,
    shakeDurationMs: 0,
    shakeFrequencyHz: 30,
  },
};

const LAP_COMPLETE_FLASH = {
  intensity: 0.55,
  color: "#ffd700",
  durationMs: 360,
};

const RACE_FINISH_FLASH = {
  intensity: 0.7,
  color: "#ffd700",
  durationMs: 600,
};

/**
 * Stable hash of a `HitKind` string. Combined with the session tick the
 * caller passes in, this produces a deterministic seed for the shake's
 * per-frame jitter so two runs at the same tick reproduce the same
 * pixel offsets.
 */
function hitKindHash(kind: HitKind): number {
  switch (kind) {
    case "wallHit":
      return 0x9e3779b1;
    case "carHit":
      return 0x517cc1b7;
    case "rub":
      return 0x27d4eb2f;
    case "offRoadObject":
      return 0x165667b1;
    case "offRoadPersistent":
      return 0x33334411;
    default:
      return 0;
  }
}

/**
 * Reduce one audio event into the VFX state. Non-VFX audio kinds
 * (nitroEngage, gearShift, brakeScrub, tireSqueal, surfaceHush,
 * pickupCollected, damageWarning) return the input state unchanged
 * because they do not have a §16 visual partner.
 */
export function applyAudioEventToVfx(
  state: VfxState,
  event: RaceSessionAudioEvent,
  options: { tick: number; carIsPlayer: (carId: string) => boolean },
): VfxState {
  if (!options.carIsPlayer(eventCarId(event))) return state;
  switch (event.kind) {
    case "impact":
      return applyImpactEvent(state, event, options.tick);
    case "lapComplete":
      return fireFlash(state, LAP_COMPLETE_FLASH);
    case "raceFinish":
      return fireFlash(state, RACE_FINISH_FLASH);
    default:
      return state;
  }
}

/**
 * Reduce a stream of audio events into the VFX state. Order is
 * preserved so two events of the same kind in the same tick produce
 * two stack entries.
 */
export function applyAudioEventsToVfx(
  state: VfxState,
  events: ReadonlyArray<RaceSessionAudioEvent>,
  options: { tick: number; carIsPlayer: (carId: string) => boolean },
): VfxState {
  let next = state;
  for (const event of events) {
    next = applyAudioEventToVfx(next, event, options);
  }
  return next;
}

function applyImpactEvent(
  state: VfxState,
  event: RaceSessionImpactAudioEvent,
  tick: number,
): VfxState {
  const style = IMPACT_STYLES[event.hitKind];
  if (!style) return state;
  let next = state;
  if (style.flashDurationMs > 0 && style.flashIntensity > 0) {
    next = fireFlash(next, {
      intensity: style.flashIntensity,
      color: style.flashColor,
      durationMs: style.flashDurationMs,
    });
  }
  if (style.shakeDurationMs > 0 && style.shakeAmplitudePx > 0) {
    next = fireShake(next, {
      amplitudePx: style.shakeAmplitudePx,
      durationMs: style.shakeDurationMs,
      seed: (tick >>> 0) ^ hitKindHash(event.hitKind),
      frequencyHz: style.shakeFrequencyHz,
    });
  }
  return next;
}

function eventCarId(event: RaceSessionAudioEvent): string {
  return "carId" in event ? event.carId : "";
}
