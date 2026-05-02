import type {
  RaceSessionAudioEvent,
  RaceSessionImpactAudioEvent,
} from "@/game/raceSession";

export interface RaceMusicDucking {
  readonly volumeScale: number;
  readonly holdMs: number;
}

export const NO_RACE_MUSIC_DUCKING: RaceMusicDucking = Object.freeze({
  volumeScale: 1,
  holdMs: 0,
});

export function raceMusicDuckingForCountdownStep(step: number): RaceMusicDucking {
  if (!Number.isFinite(step)) return NO_RACE_MUSIC_DUCKING;
  return step <= 0
    ? { volumeScale: 0.72, holdMs: 360 }
    : { volumeScale: 0.82, holdMs: 220 };
}

export function raceMusicDuckingForAudioEvents(
  events: ReadonlyArray<RaceSessionAudioEvent>,
): RaceMusicDucking {
  let ducking = NO_RACE_MUSIC_DUCKING;
  for (const event of events) {
    ducking = strongestDucking(ducking, raceMusicDuckingForAudioEvent(event));
  }
  return ducking;
}

export function applyRaceMusicDucking(
  volumeScale: number,
  ducking: RaceMusicDucking,
): number {
  return clampVolumeScale(volumeScale * ducking.volumeScale);
}

function raceMusicDuckingForAudioEvent(
  event: RaceSessionAudioEvent,
): RaceMusicDucking {
  switch (event.kind) {
    case "raceFinish":
      return { volumeScale: 0.5, holdMs: 900 };
    case "damageWarning":
      return { volumeScale: 0.52, holdMs: 720 };
    case "impact":
      return { volumeScale: impactDuckingScale(event.hitKind), holdMs: 360 };
    case "nitroEngage":
      return { volumeScale: 0.66, holdMs: 480 };
    case "lapComplete":
      return { volumeScale: 0.7, holdMs: 520 };
    case "pickupCollected":
      return {
        volumeScale: event.pickupKind === "nitro" ? 0.68 : 0.76,
        holdMs: event.pickupKind === "nitro" ? 420 : 300,
      };
    case "surfaceHush":
      return { volumeScale: 0.78, holdMs: 260 };
    case "tireSqueal":
      return { volumeScale: 0.82, holdMs: 220 };
    case "brakeScrub":
      return { volumeScale: 0.88, holdMs: 180 };
    case "gearShift":
      return NO_RACE_MUSIC_DUCKING;
  }
}

function strongestDucking(
  current: RaceMusicDucking,
  next: RaceMusicDucking,
): RaceMusicDucking {
  if (next.volumeScale < current.volumeScale) return next;
  if (next.volumeScale === current.volumeScale && next.holdMs > current.holdMs) {
    return next;
  }
  return current;
}

function impactDuckingScale(hitKind: RaceSessionImpactAudioEvent["hitKind"]): number {
  switch (hitKind) {
    case "wallHit":
      return 0.48;
    case "carHit":
    case "offRoadObject":
      return 0.58;
    case "rub":
    case "offRoadPersistent":
      return 0.84;
  }
}

function clampVolumeScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1.2, value);
}
