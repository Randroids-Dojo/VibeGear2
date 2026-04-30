import type { AtlasFrame, AtlasMeta } from "@/data/schemas";
import type { CarSpriteSet } from "@/render/carSpriteCompositor";

export const CAR_SPRITE_SET_IDS = [
  "sparrow_gt",
  "breaker_s",
  "vanta_xr",
  "bastion_lm",
  "tempest_r",
  "nova_shade",
] as const;

export type CarSpriteSetId = (typeof CAR_SPRITE_SET_IDS)[number];

const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 32;
const ATLAS_WIDTH = 768;
const ATLAS_HEIGHT = 384;
const DEFAULT_SPRITE_SET_ID: CarSpriteSetId = "sparrow_gt";

function directionalRow(y: number): AtlasFrame[] {
  return Array.from({ length: 12 }, (_, index) => ({
    x: index * FRAME_WIDTH,
    y,
    w: FRAME_WIDTH,
    h: FRAME_HEIGHT,
  }));
}

function oneFrame(x: number, y: number): AtlasFrame[] {
  return [{ x, y, w: FRAME_WIDTH, h: FRAME_HEIGHT }];
}

function spriteSetFor(id: string): CarSpriteSet {
  return Object.freeze({
    clean: `${id}_clean`,
    damage1: `${id}_dented`,
    damage2: `${id}_battered`,
    damage3: `${id}_totaled`,
    brake: `${id}_brake`,
    nitro: `${id}_nitro`,
    wetTrail: `${id}_wet_trail`,
    snowTrail: `${id}_snow_trail`,
  });
}

function atlasMetaFor(id: CarSpriteSetId): AtlasMeta {
  const spriteSet = spriteSetFor(id);
  return {
    image: `art/cars/${id}.svg`,
    width: ATLAS_WIDTH,
    height: ATLAS_HEIGHT,
    sprites: {
      [spriteSet.clean]: directionalRow(0),
      [spriteSet.damage1]: directionalRow(32),
      [spriteSet.damage2]: directionalRow(64),
      [spriteSet.brake]: oneFrame(0, 96),
      [spriteSet.nitro]: oneFrame(64, 96),
      [spriteSet.damage3]: directionalRow(128),
      [spriteSet.wetTrail]: oneFrame(0, 160),
      [spriteSet.snowTrail]: oneFrame(64, 160),
    },
  };
}

export const CAR_SPRITE_SETS: Readonly<Record<CarSpriteSetId, CarSpriteSet>> =
  Object.freeze(
    Object.fromEntries(
      CAR_SPRITE_SET_IDS.map((id) => [id, spriteSetFor(id)]),
    ) as Record<CarSpriteSetId, CarSpriteSet>,
  );

export const CAR_ATLAS_METAS: Readonly<Record<CarSpriteSetId, AtlasMeta>> =
  Object.freeze(
    Object.fromEntries(
      CAR_SPRITE_SET_IDS.map((id) => [id, atlasMetaFor(id)]),
    ) as Record<CarSpriteSetId, AtlasMeta>,
  );

export function isCarSpriteSetId(value: string): value is CarSpriteSetId {
  return CAR_SPRITE_SET_IDS.includes(value as CarSpriteSetId);
}

export function carSpriteSetForVisualProfile(value: string): CarSpriteSet {
  return CAR_SPRITE_SETS[
    isCarSpriteSetId(value) ? value : DEFAULT_SPRITE_SET_ID
  ];
}

export function carAtlasMetaForVisualProfile(value: string): AtlasMeta {
  return CAR_ATLAS_METAS[
    isCarSpriteSetId(value) ? value : DEFAULT_SPRITE_SET_ID
  ];
}
