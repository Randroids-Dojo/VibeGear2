import type { WeatherOption } from "@/data";

import { frame, type AtlasFrame, type LoadedAtlas } from "./spriteAtlas";

export type CarDamageTier = 0 | 1 | 2 | 3;

export interface CarSpriteSet {
  readonly clean: string;
  readonly damage1: string;
  readonly damage2: string;
  readonly damage3: string;
  readonly brake: string;
  readonly nitro: string;
  readonly wetTrail: string;
  readonly snowTrail: string;
}

export interface CarSpriteRuntimeState {
  readonly frameIndex: number;
  readonly braking: boolean;
  readonly nitroActive: boolean;
  readonly weather?: WeatherOption;
  readonly speedMetersPerSecond: number;
  readonly damageTotal: number;
  readonly spriteSet?: CarSpriteSet;
}

export interface CarFramePlan {
  readonly baseSpriteId: string;
  readonly frameIndex: number;
  readonly damageTier: CarDamageTier;
  readonly trailOverlaySpriteId?: string;
  readonly brakeOverlaySpriteId?: string;
  readonly nitroOverlaySpriteId?: string;
  readonly damageOverlaySpriteId?: string;
}

export interface CarRenderFrames {
  readonly base: AtlasFrame;
  readonly damageTier: CarDamageTier;
  readonly trailOverlay?: AtlasFrame;
  readonly brakeOverlay?: AtlasFrame;
  readonly nitroOverlay?: AtlasFrame;
  readonly damageOverlay?: AtlasFrame;
}

export interface ResolveCarRenderFramesOptions {
  readonly logger?: Pick<Console, "warn">;
  readonly warningCache?: Set<string>;
}

export const DEFAULT_CAR_SPRITE_SET: CarSpriteSet = Object.freeze({
  clean: "sparrow_clean",
  damage1: "sparrow_dented",
  damage2: "sparrow_battered",
  damage3: "sparrow_totaled",
  brake: "sparrow_brake",
  nitro: "sparrow_nitro",
  wetTrail: "sparrow_wet_trail",
  snowTrail: "sparrow_snow_trail",
});

const TRAIL_SPEED_GATE_MPS = 30 / 3.6;
const BRAKE_SPEED_GATE_MPS = 0.5;
const DAMAGE_1_THRESHOLD = 0.25;
const DAMAGE_2_THRESHOLD = 0.5;
const DAMAGE_3_THRESHOLD = 0.85;
const loggedMissingFrames = new Set<string>();

export function selectCarFramePlan(
  runtime: CarSpriteRuntimeState,
): CarFramePlan {
  const spriteSet = runtime.spriteSet ?? DEFAULT_CAR_SPRITE_SET;
  const damageTier = damageTierForTotal(runtime.damageTotal);
  const baseSpriteId = damageTier === 3 ? spriteSet.damage3 : spriteSet.clean;
  const damageOverlaySpriteId =
    damageTier === 1
      ? spriteSet.damage1
      : damageTier === 2
        ? spriteSet.damage2
        : undefined;

  return {
    baseSpriteId,
    frameIndex: runtime.frameIndex,
    damageTier,
    trailOverlaySpriteId: trailSpriteFor(
      runtime.weather,
      runtime.speedMetersPerSecond,
      spriteSet,
    ),
    brakeOverlaySpriteId:
      runtime.braking && runtime.speedMetersPerSecond > BRAKE_SPEED_GATE_MPS
        ? spriteSet.brake
        : undefined,
    nitroOverlaySpriteId: runtime.nitroActive ? spriteSet.nitro : undefined,
    damageOverlaySpriteId,
  };
}

export function resolveCarRenderFrames(
  atlas: LoadedAtlas,
  plan: CarFramePlan,
  options: ResolveCarRenderFramesOptions = {},
): CarRenderFrames | null {
  const cache = options.warningCache ?? loggedMissingFrames;
  const logger = options.logger ?? console;
  const base = resolveFrame(atlas, plan.baseSpriteId, plan.frameIndex, cache, logger);
  if (!base) return null;

  return {
    base,
    damageTier: plan.damageTier,
    trailOverlay: resolveOptionalOverlay(
      atlas,
      plan.trailOverlaySpriteId,
      cache,
      logger,
    ),
    brakeOverlay: resolveOptionalOverlay(
      atlas,
      plan.brakeOverlaySpriteId,
      cache,
      logger,
    ),
    nitroOverlay: resolveOptionalOverlay(
      atlas,
      plan.nitroOverlaySpriteId,
      cache,
      logger,
    ),
    damageOverlay: resolveOptionalOverlay(
      atlas,
      plan.damageOverlaySpriteId,
      cache,
      logger,
      plan.frameIndex,
    ),
  };
}

export function resetCarSpriteCompositorWarnings(): void {
  loggedMissingFrames.clear();
}

function damageTierForTotal(total: number): CarDamageTier {
  if (!Number.isFinite(total)) return 0;
  if (total >= DAMAGE_3_THRESHOLD) return 3;
  if (total >= DAMAGE_2_THRESHOLD) return 2;
  if (total >= DAMAGE_1_THRESHOLD) return 1;
  return 0;
}

function trailSpriteFor(
  weather: WeatherOption | undefined,
  speedMetersPerSecond: number,
  spriteSet: CarSpriteSet,
): string | undefined {
  if (!Number.isFinite(speedMetersPerSecond)) return undefined;
  if (speedMetersPerSecond <= TRAIL_SPEED_GATE_MPS) return undefined;
  if (
    weather === "light_rain" ||
    weather === "rain" ||
    weather === "heavy_rain"
  ) {
    return spriteSet.wetTrail;
  }
  if (weather === "snow") return spriteSet.snowTrail;
  return undefined;
}

function resolveOptionalOverlay(
  atlas: LoadedAtlas,
  spriteId: string | undefined,
  cache: Set<string>,
  logger: Pick<Console, "warn">,
  frameIndex = 0,
): AtlasFrame | undefined {
  if (!spriteId) return undefined;
  return resolveFrame(atlas, spriteId, frameIndex, cache, logger);
}

function resolveFrame(
  atlas: LoadedAtlas,
  spriteId: string,
  frameIndex: number,
  cache: Set<string>,
  logger: Pick<Console, "warn">,
): AtlasFrame | undefined {
  try {
    return frame(atlas, spriteId, frameIndex);
  } catch (error) {
    if (error instanceof RangeError) {
      warnMissingFrame(spriteId, cache, logger);
      return undefined;
    }
    throw error;
  }
}

function warnMissingFrame(
  spriteId: string,
  cache: Set<string>,
  logger: Pick<Console, "warn">,
): void {
  if (cache.has(spriteId)) return;
  cache.add(spriteId);
  logger.warn("[car-sprite]", `missing sprite frame "${spriteId}"`);
}
