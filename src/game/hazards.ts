import type { HazardRegistryEntry } from "@/data/schemas";
import { SEGMENT_LENGTH } from "@/road/constants";
import type { CompiledTrack } from "@/road/types";

import type { HitEvent, HitKind } from "./damage";
import type { CarState } from "./physics";

export interface HazardEvent {
  readonly key: string;
  readonly hazard: Readonly<HazardRegistryEntry>;
  readonly segmentIndex: number;
  readonly gripMultiplier: number;
  readonly hit: HitEvent | null;
  readonly breakable: boolean;
  /**
   * F-095 slice 3. Signed lateral push in m/s per second contributed
   * by this hazard for the current tick. `0` for hazards without a
   * `lateralPushMpsPerSecond` registry field. The runtime applies
   * the per-tick aggregate (`HazardTickEffect.lateralPush`) after
   * the physics step.
   */
  readonly lateralPush: number;
}

export interface EvaluateHazardsInput {
  readonly car: Readonly<CarState>;
  readonly track: Readonly<CompiledTrack>;
  readonly hazardsById: ReadonlyMap<string, Readonly<HazardRegistryEntry>>;
  readonly brokenHazards?: ReadonlySet<string>;
}

export interface HazardTickEffect {
  readonly events: readonly HazardEvent[];
  readonly gripMultiplier: number;
  readonly brokenHazards: ReadonlySet<string>;
  /**
   * F-095 slice 3. Aggregate lateral push (m/s per second) summed
   * across all active hazards on this tick. The runtime applies this
   * to `car.x` once the physics step has integrated input. `0` when
   * no overlapping hazard carries a `lateralPushMpsPerSecond` field.
   */
  readonly lateralPush: number;
}

const EMPTY_EVENTS: readonly HazardEvent[] = [];
const EMPTY_BROKEN_HAZARDS: ReadonlySet<string> = new Set<string>();

export function evaluateHazards(input: EvaluateHazardsInput): HazardTickEffect {
  const segment = segmentAt(input.track, input.car.z);
  if (segment === null || segment.hazardIds.length === 0) {
    return noHazardEffect(input.brokenHazards);
  }

  let nextBroken = input.brokenHazards ?? EMPTY_BROKEN_HAZARDS;
  let writableBroken: Set<string> | null = null;
  let events: HazardEvent[] | null = null;
  let gripMultiplier = 1;
  let lateralPush = 0;

  for (const hazardId of segment.hazardIds) {
    const hazard = input.hazardsById.get(hazardId);
    if (hazard === undefined) continue;
    if (hazard.kind === "tunnel") continue;
    const key = `${segment.index}:${hazard.id}`;
    if (nextBroken.has(key)) continue;
    if (!overlapsLateral(input.car.x, hazard)) continue;
    const event = buildHazardEvent(key, hazard, segment.index, input.car.speed);
    events ??= [];
    events.push(event);
    gripMultiplier *= event.gripMultiplier;
    lateralPush += event.lateralPush;
    if (event.breakable) {
      writableBroken ??= new Set(nextBroken);
      writableBroken.add(key);
      nextBroken = writableBroken;
    }
  }

  return {
    events: events ?? EMPTY_EVENTS,
    gripMultiplier,
    brokenHazards: nextBroken,
    lateralPush,
  };
}

export function segmentAt(
  track: Readonly<CompiledTrack>,
  z: number,
) {
  if (track.segments.length === 0) return null;
  const wrappedZ =
    track.totalLengthMeters > 0
      ? ((z % track.totalLengthMeters) + track.totalLengthMeters) %
        track.totalLengthMeters
      : z;
  const index = Math.floor(wrappedZ / SEGMENT_LENGTH) % track.segments.length;
  return track.segments[index] ?? null;
}

function buildHazardEvent(
  key: string,
  hazard: Readonly<HazardRegistryEntry>,
  segmentIndex: number,
  speed: number,
): HazardEvent {
  return {
    key,
    hazard,
    segmentIndex,
    gripMultiplier: hazard.gripMultiplier ?? 1,
    hit: buildHit(hazard, speed),
    breakable: hazard.breakable,
    lateralPush: hazard.lateralPushMpsPerSecond ?? 0,
  };
}

function buildHit(
  hazard: Readonly<HazardRegistryEntry>,
  speed: number,
): HitEvent | null {
  if (hazard.damageKind === null || hazard.damageKind === undefined) return null;
  if (hazard.damageMagnitude === null || hazard.damageMagnitude === undefined) {
    return null;
  }
  return {
    kind: hazard.damageKind satisfies HitKind,
    baseMagnitude: hazard.damageMagnitude,
    speedFactor: Math.max(0, Math.min(1, speed / 60)),
  };
}

function overlapsLateral(
  carX: number,
  hazard: Readonly<HazardRegistryEntry>,
): boolean {
  const center = hazard.laneOffset ?? 0;
  return Math.abs(carX - center) <= hazard.defaultWidth / 2;
}

function noHazardEffect(
  brokenHazards: ReadonlySet<string> | undefined,
): HazardTickEffect {
  return {
    events: EMPTY_EVENTS,
    gripMultiplier: 1,
    brokenHazards: brokenHazards ?? EMPTY_BROKEN_HAZARDS,
    lateralPush: 0,
  };
}
