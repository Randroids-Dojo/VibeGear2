import { describe, expect, it } from "vitest";

import { REGION_PALETTES } from "@/data/palettes";
import { PaletteCache } from "../paletteCache";
import {
  DEFAULT_PALETTE_INDEX_MAP,
  paletteCacheKey,
  recolourImageData,
  type ImageDataLike,
} from "../paletteRecolour";

const palette = REGION_PALETTES[0]!;

describe("recolourImageData", () => {
  it("maps indexed grayscale pixels to palette slots", () => {
    const source: ImageDataLike = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([
        32, 32, 32, 255,
        64, 64, 64, 255,
        1, 2, 3, 255,
      ]),
    };

    const recoloured = recolourImageData(source, palette, DEFAULT_PALETTE_INDEX_MAP);

    expect(Array.from(recoloured.data)).toEqual([
      232, 209, 95, 255,
      215, 216, 201, 255,
      1, 2, 3, 255,
    ]);
    expect(Array.from(source.data)).toEqual([
      32, 32, 32, 255,
      64, 64, 64, 255,
      1, 2, 3, 255,
    ]);
  });

  it("leaves transparent pixels unchanged", () => {
    const source: ImageDataLike = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([32, 32, 32, 0]),
    };

    expect(Array.from(recolourImageData(source, palette).data)).toEqual([32, 32, 32, 0]);
  });

  it("rejects mismatched image buffers", () => {
    const source: ImageDataLike = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([32, 32, 32, 255]),
    };

    expect(() => recolourImageData(source, palette)).toThrow(RangeError);
  });
});

describe("PaletteCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new PaletteCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("builds stable sprite and palette cache keys", () => {
    expect(paletteCacheKey("sign_marker", 2, "velvet-coast")).toBe(
      "sign_marker:2:velvet-coast",
    );
  });
});
