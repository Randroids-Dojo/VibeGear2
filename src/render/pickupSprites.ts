import type { TrackPickup } from "@/data/schemas";
import type { Strip } from "@/road/types";
import { SEGMENT_LENGTH } from "@/road/constants";

export interface ProjectedPickupSprite {
  readonly key: string;
  readonly pickupId: string;
  readonly kind: TrackPickup["kind"];
  readonly value: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly screenW: number;
  readonly depthMeters: number;
}

export interface ProjectPickupSpritesInput {
  readonly strips: readonly Strip[];
  readonly pickupsById: Readonly<Record<string, TrackPickup>>;
  readonly lap: number;
  readonly collectedPickups?: ReadonlySet<string> | readonly string[];
  readonly maxDistanceMeters?: number;
}

const DEFAULT_MAX_PICKUP_DISTANCE_METERS = 180;
const MIN_PICKUP_SCREEN_WIDTH = 8;
const MAX_PICKUP_SCREEN_WIDTH = 34;

export function projectPickupSprites(
  input: ProjectPickupSpritesInput,
): readonly ProjectedPickupSprite[] {
  const maxDistanceMeters =
    Number.isFinite(input.maxDistanceMeters) && input.maxDistanceMeters != null
      ? Math.max(0, input.maxDistanceMeters)
      : DEFAULT_MAX_PICKUP_DISTANCE_METERS;
  if (maxDistanceMeters <= 0) return [];

  const collected = normalizeCollected(input.collectedPickups);
  const lap = sanitizeLap(input.lap);
  const sprites: ProjectedPickupSprite[] = [];

  for (let stripIndex = 0; stripIndex < input.strips.length; stripIndex += 1) {
    const strip = input.strips[stripIndex];
    if (!strip?.visible) continue;
    if (!isFinitePickupProjection(strip.screenX, strip.screenY, strip.screenW)) {
      continue;
    }
    const depthMeters = stripIndex * SEGMENT_LENGTH;
    if (depthMeters <= 0 || depthMeters > maxDistanceMeters) continue;

    for (const pickupId of strip.segment.pickupIds) {
      const pickup = input.pickupsById[pickupId];
      if (!pickup) continue;
      const key = `${lap}:${pickup.id}`;
      if (collected?.has(key)) continue;
      sprites.push({
        key,
        pickupId: pickup.id,
        kind: pickup.kind,
        value: pickup.value,
        screenX: strip.screenX + strip.screenW * pickup.laneOffset,
        screenY: strip.screenY,
        screenW: clamp(
          strip.screenW * 0.14,
          MIN_PICKUP_SCREEN_WIDTH,
          MAX_PICKUP_SCREEN_WIDTH,
        ),
        depthMeters,
      });
    }
  }

  return sprites.sort((a, b) => b.depthMeters - a.depthMeters);
}

function normalizeCollected(
  collected: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> | null {
  if (collected === undefined) return null;
  if ("has" in collected) return collected;
  return new Set(collected);
}

function sanitizeLap(lap: number): number {
  if (!Number.isFinite(lap)) return 1;
  return Math.max(1, Math.floor(lap));
}

function isFinitePickupProjection(
  screenX: number,
  screenY: number,
  screenW: number,
): boolean {
  return (
    Number.isFinite(screenX) &&
    Number.isFinite(screenY) &&
    Number.isFinite(screenW) &&
    screenW > 0
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
