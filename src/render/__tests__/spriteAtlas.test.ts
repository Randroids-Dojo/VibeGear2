import { describe, expect, it, vi } from "vitest";

import carsFixture from "@/data/atlas/cars.json";
import roadsideFixture from "@/data/atlas/roadside.json";
import { AtlasMetaSchema, type AtlasMeta } from "@/data/schemas";
import {
  FALLBACK_FRAME,
  frame,
  loadAtlas,
  type LoadedAtlas,
} from "../spriteAtlas";

/**
 * Image shim that lets tests drive `onload` / `onerror` synchronously.
 * Mirrors the strategy in `src/asset/__tests__/preload.test.ts` so the
 * loader can be exercised without jsdom's real Image element.
 */
function makeImageCtor(behaviour: "load" | "error"): {
  ctor: { new (): HTMLImageElement };
  lastSrc: () => string;
} {
  let lastSrc = "";
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    get src(): string {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      lastSrc = value;
      // Fire on next microtask so the loader's `Promise` constructor has
      // returned before resolution. This keeps the contract identical to
      // the real browser behaviour where `onload` is async.
      queueMicrotask(() => {
        if (behaviour === "load") {
          this.onload?.();
        } else {
          this.onerror?.();
        }
      });
    }
  }
  return {
    ctor: StubImage as unknown as { new (): HTMLImageElement },
    lastSrc: () => lastSrc,
  };
}

describe("AtlasMetaSchema", () => {
  it("accepts the cars.json fixture", () => {
    expect(AtlasMetaSchema.safeParse(carsFixture).success).toBe(true);
  });

  it("accepts the roadside.json fixture", () => {
    expect(AtlasMetaSchema.safeParse(roadsideFixture).success).toBe(true);
  });

  it("rejects an empty frames array", () => {
    const broken = {
      image: "art/cars/sparrow.svg",
      width: 64,
      height: 64,
      sprites: { sparrow: [] },
    };
    expect(AtlasMetaSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an empty sprites map", () => {
    const broken = {
      image: "art/cars/sparrow.svg",
      width: 64,
      height: 64,
      sprites: {},
    };
    expect(AtlasMetaSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a non-positive frame width", () => {
    const broken = {
      image: "art/cars/sparrow.svg",
      width: 64,
      height: 64,
      sprites: { sparrow: [{ x: 0, y: 0, w: 0, h: 32 }] },
    };
    expect(AtlasMetaSchema.safeParse(broken).success).toBe(false);
  });
});

describe("loadAtlas", () => {
  it("resolves with the loaded image on success", async () => {
    const meta = AtlasMetaSchema.parse(carsFixture);
    const { ctor, lastSrc } = makeImageCtor("load");
    const result = await loadAtlas(meta, { ImageCtor: ctor });
    expect(result.fallback).toBe(false);
    expect(result.image).not.toBeNull();
    expect(result.meta).toBe(meta);
    expect(lastSrc()).toBe("/art/cars/sparrow.svg");
  });

  it("resolves with fallback when the image errors and logs once", async () => {
    const meta = AtlasMetaSchema.parse(carsFixture);
    const { ctor } = makeImageCtor("error");
    const errorSpy = vi.fn();
    const result = await loadAtlas(meta, {
      ImageCtor: ctor,
      logger: { error: errorSpy },
    });
    expect(result.fallback).toBe(true);
    expect(result.image).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[atlas]", "/art/cars/sparrow.svg");
  });

  it("normalises a leading-slash image path", async () => {
    const meta: AtlasMeta = {
      image: "/art/cars/sparrow.svg",
      width: 64,
      height: 64,
      sprites: { sparrow: [{ x: 0, y: 0, w: 64, h: 64 }] },
    };
    const { ctor, lastSrc } = makeImageCtor("load");
    await loadAtlas(meta, { ImageCtor: ctor });
    expect(lastSrc()).toBe("/art/cars/sparrow.svg");
  });

  it("falls back when no Image constructor is available", async () => {
    const meta = AtlasMetaSchema.parse(carsFixture);
    const errorSpy = vi.fn();
    const result = await loadAtlas(meta, {
      ImageCtor: undefined,
      logger: { error: errorSpy },
    });
    expect(result.fallback).toBe(true);
    expect(result.image).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("frame", () => {
  function loadedAtlas(meta: AtlasMeta, fallback = false): LoadedAtlas {
    return { meta, image: fallback ? null : ({} as HTMLImageElement), fallback };
  }

  const carsMeta = AtlasMetaSchema.parse(carsFixture);

  it("returns the requested frame for an in-range index", () => {
    const atlas = loadedAtlas(carsMeta);
    const f = frame(atlas, "sparrow_clean", 5);
    expect(f).toEqual({ x: 320, y: 0, w: 64, h: 32 });
  });

  it("wraps an out-of-range index with modulo", () => {
    const atlas = loadedAtlas(carsMeta);
    // 12 frames; index 17 wraps to 5.
    const f = frame(atlas, "sparrow_clean", 17);
    expect(f).toEqual({ x: 320, y: 0, w: 64, h: 32 });
  });

  it("wraps a negative index with modulo", () => {
    const atlas = loadedAtlas(carsMeta);
    // 12 frames; index -1 wraps to 11.
    const f = frame(atlas, "sparrow_clean", -1);
    expect(f).toEqual({ x: 704, y: 0, w: 64, h: 32 });
  });

  it("throws RangeError for an unknown sprite id", () => {
    const atlas = loadedAtlas(carsMeta);
    expect(() => frame(atlas, "unknown", 0)).toThrow(RangeError);
  });

  it("returns FALLBACK_FRAME when the atlas is in fallback mode", () => {
    const atlas = loadedAtlas(carsMeta, true);
    const f = frame(atlas, "sparrow_clean", 0);
    expect(f).toBe(FALLBACK_FRAME);
  });

  it("still throws RangeError for unknown sprite even in fallback mode", () => {
    const atlas = loadedAtlas(carsMeta, true);
    expect(() => frame(atlas, "unknown", 0)).toThrow(RangeError);
  });

  it("is deterministic: same input returns the same frame reference", () => {
    const atlas = loadedAtlas(carsMeta);
    const a = frame(atlas, "sparrow_clean", 3);
    const b = frame(atlas, "sparrow_clean", 3);
    expect(a).toBe(b);
  });
});
