import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CARS } from "@/data/cars";
import { AtlasMetaSchema } from "@/data/schemas";
import {
  CAR_ATLAS_METAS,
  CAR_SPRITE_SET_IDS,
  CAR_SPRITE_SETS,
  carAtlasMetaForVisualProfile,
  carSpriteSetForVisualProfile,
  isCarSpriteSetId,
} from "./carSprites";

const PUBLIC_DIR = path.join(process.cwd(), "public");

describe("per-car sprite atlas metadata", () => {
  it("covers every bundled car visual profile", () => {
    for (const car of CARS) {
      const id = car.visualProfile.spriteSet;
      expect(isCarSpriteSetId(id)).toBe(true);
      if (!isCarSpriteSetId(id)) {
        throw new Error(`unknown car sprite set: ${id}`);
      }

      const meta = carAtlasMetaForVisualProfile(id);
      const spriteSet = carSpriteSetForVisualProfile(id);
      expect(AtlasMetaSchema.safeParse(meta).success).toBe(true);
      expect(meta).toBe(CAR_ATLAS_METAS[id]);
      expect(spriteSet).toBe(CAR_SPRITE_SETS[id]);
      expect(meta.image).toBe(`art/cars/${id}.svg`);
      expect(existsSync(path.join(PUBLIC_DIR, meta.image))).toBe(true);
    }
  });

  it("declares equivalent FX coverage for every car sheet", () => {
    for (const id of CAR_SPRITE_SET_IDS) {
      const spriteSet = CAR_SPRITE_SETS[id];
      const meta = carAtlasMetaForVisualProfile(id);
      expect(meta.sprites[spriteSet.clean]).toHaveLength(12);
      expect(meta.sprites[spriteSet.damage1]).toHaveLength(12);
      expect(meta.sprites[spriteSet.damage2]).toHaveLength(12);
      expect(meta.sprites[spriteSet.damage3]).toHaveLength(12);
      expect(meta.sprites[spriteSet.brake]).toHaveLength(1);
      expect(meta.sprites[spriteSet.nitro]).toHaveLength(1);
      expect(meta.sprites[spriteSet.wetTrail]).toHaveLength(1);
      expect(meta.sprites[spriteSet.snowTrail]).toHaveLength(1);
    }
  });

  it("ships rendered rows for totaled and weather trail frames", () => {
    for (const meta of Object.values(CAR_ATLAS_METAS)) {
      const svg = readFileSync(path.join(PUBLIC_DIR, meta.image), "utf8");
      expect(svg).toContain('id="totaled"');
      expect(svg).toContain('id="wet-trail"');
      expect(svg).toContain('id="snow-trail"');
      expect(svg).toContain('translate(32 144)');
      expect(svg).toContain('translate(32 176)');
      expect(svg).toContain('translate(96 176)');
    }
  });

  it("falls back to the starter atlas for unknown visual profiles", () => {
    expect(carAtlasMetaForVisualProfile("unknown").image).toBe(
      "art/cars/sparrow_gt.svg",
    );
    expect(carSpriteSetForVisualProfile("unknown").clean).toBe(
      "sparrow_gt_clean",
    );
  });
});
