import { ROAD_WIDTH } from "@/road/constants";
import type { CompiledTrack } from "@/road/types";

import type { CarState } from "./physics";
import { segmentAt } from "./hazards";

export interface PickupCollectedEvent {
  readonly key: string;
  readonly pickupId: string;
  readonly segmentIndex: number;
  readonly lap: number;
  readonly kind: "cash" | "nitro";
  readonly value: number;
}

export interface EvaluatePickupsInput {
  readonly car: Readonly<CarState>;
  readonly track: Readonly<CompiledTrack>;
  readonly lap: number;
  readonly collectedPickups?: ReadonlySet<string>;
}

export interface PickupTickEffect {
  readonly events: readonly PickupCollectedEvent[];
  readonly collectedPickups: ReadonlySet<string>;
}

const PICKUP_OVERLAP_WIDTH_M = 1.4;
const EMPTY_EVENTS: readonly PickupCollectedEvent[] = [];
const EMPTY_COLLECTED: ReadonlySet<string> = new Set<string>();

export function evaluatePickups(input: EvaluatePickupsInput): PickupTickEffect {
  const segment = segmentAt(input.track, input.car.z);
  if (segment === null || segment.pickupIds.length === 0) {
    return noPickupEffect(input.collectedPickups);
  }

  let nextCollected = input.collectedPickups ?? EMPTY_COLLECTED;
  let writableCollected: Set<string> | null = null;
  let events: PickupCollectedEvent[] | null = null;
  const lap = Math.max(1, Math.floor(input.lap));

  for (const pickupId of segment.pickupIds) {
    const pickup = input.track.pickupsById[pickupId];
    if (pickup === undefined) continue;
    const key = `${lap}:${pickup.id}`;
    if (nextCollected.has(key)) continue;
    if (!overlapsPickup(input.car.x, pickup.laneOffset)) continue;
    writableCollected ??= new Set(nextCollected);
    writableCollected.add(key);
    nextCollected = writableCollected;
    events ??= [];
    events.push({
      key,
      pickupId: pickup.id,
      segmentIndex: segment.index,
      lap,
      kind: pickup.kind,
      value: pickup.value,
    });
  }

  return {
    events: events ?? EMPTY_EVENTS,
    collectedPickups: nextCollected,
  };
}

function overlapsPickup(carX: number, laneOffset: number): boolean {
  const center = laneOffset * ROAD_WIDTH;
  return Math.abs(carX - center) <= PICKUP_OVERLAP_WIDTH_M / 2;
}

function noPickupEffect(
  collectedPickups: ReadonlySet<string> | undefined,
): PickupTickEffect {
  return {
    events: EMPTY_EVENTS,
    collectedPickups: collectedPickups ?? EMPTY_COLLECTED,
  };
}
