/**
 * Sprite atlas loader and frame index math.
 *
 * Source of truth: `docs/gdd/16-rendering-and-visual-design.md` (sprites)
 * and `docs/gdd/17-art-direction.md` (12-16 directional frames + 3 damage
 * variants per car). API contract pinned in stress-test item 2 of the
 * `implement-visual-polish` dot.
 *
 * Contract:
 * - `loadAtlas(meta)` resolves with a `LoadedAtlas`. The image is loaded
 *   via the injected `ImageCtor` (defaults to `globalThis.Image`); if the
 *   load fails or no constructor is available, the loader resolves with
 *   `image: null, fallback: true` and logs once via
 *   `console.error('[atlas]', path)`. The promise never rejects so the
 *   game can mount with placeholder rectangles instead of crashing.
 * - `frame(atlas, spriteId, frameIdx)` returns the `AtlasFrame` for the
 *   requested sprite. Out-of-range `frameIdx` wraps with modulo so an
 *   animated brake-light index can free-run without bounds checks at every
 *   call site. Unknown `spriteId` throws `RangeError` because that is a
 *   programming error, not a runtime condition.
 *
 * Determinism:
 * - `frame(...)` is pure: same `(atlas, spriteId, frameIdx)` always returns
 *   the same `AtlasFrame` reference. The fallback rect is also a stable
 *   object so renderers can compare references when memoising draw calls.
 */

import type { AtlasFrame, AtlasMeta } from "@/data/schemas";

export type { AtlasFrame, AtlasMeta } from "@/data/schemas";

/**
 * Magenta-on-black fallback used when the atlas image fails to load.
 * Shared across atlases so the renderer can detect the placeholder by
 * reference identity (`frame === FALLBACK_FRAME`).
 */
export const FALLBACK_FRAME: AtlasFrame = Object.freeze({
  x: 0,
  y: 0,
  w: 32,
  h: 32,
  anchor: { x: 0.5, y: 1 },
});

/**
 * Hex colour the renderer should use when drawing `FALLBACK_FRAME`.
 * Matches the §16 "magenta or electric blue" Nitro full readout so the
 * placeholder is visually obvious during dev and never confused with a
 * real prop palette.
 */
export const FALLBACK_FILL = "#ff00ff";

export interface LoadedAtlas {
  meta: AtlasMeta;
  /** Loaded HTMLImageElement; null on load failure. */
  image: HTMLImageElement | null;
  /** True when the placeholder fallback is active. */
  fallback: boolean;
}

export interface LoadAtlasOptions {
  /**
   * Image constructor; defaults to `globalThis.Image`. Tests inject a
   * deterministic shim so the loader's promise resolves synchronously.
   */
  ImageCtor?: { new (): HTMLImageElement };
  /**
   * Console sink; defaults to `console`. Tests pass a spy to assert the
   * single error log on failure without polluting the suite output.
   */
  logger?: Pick<Console, "error">;
}

/**
 * Resolve `meta.image` to a runtime URL. `image` paths are stored
 * relative to `public/` per stress-test item 11 so they can be edited in
 * the JSON without leaking the deploy path. We normalise the leading
 * slash here so authors can write either form.
 */
function resolveImagePath(image: string): string {
  return image.startsWith("/") ? image : "/" + image;
}

/**
 * Load the atlas image. Always resolves; failures surface as
 * `{ image: null, fallback: true }` with a single `console.error` so the
 * race route can mount with placeholder rectangles instead of crashing.
 */
export function loadAtlas(
  meta: AtlasMeta,
  options: LoadAtlasOptions = {},
): Promise<LoadedAtlas> {
  const ImageCtor =
    options.ImageCtor ??
    (globalThis as { Image?: { new (): HTMLImageElement } }).Image;
  const logger = options.logger ?? console;
  const path = resolveImagePath(meta.image);

  if (!ImageCtor) {
    logger.error("[atlas]", path);
    return Promise.resolve({ meta, image: null, fallback: true });
  }

  return new Promise<LoadedAtlas>((resolve) => {
    const img = new ImageCtor();
    const cleanup = (): void => {
      img.onload = null;
      img.onerror = null;
    };
    img.onload = (): void => {
      cleanup();
      resolve({ meta, image: img, fallback: false });
    };
    img.onerror = (): void => {
      cleanup();
      logger.error("[atlas]", path);
      resolve({ meta, image: null, fallback: true });
    };
    img.src = path;
  });
}

/**
 * Return the `AtlasFrame` for the requested sprite. Out-of-range
 * `frameIdx` wraps with modulo. Unknown `spriteId` throws `RangeError`.
 *
 * When the atlas is in fallback mode, every lookup returns
 * `FALLBACK_FRAME` so the renderer paints a magenta placeholder without
 * special-casing every draw site. Unknown sprite ids still throw in
 * fallback mode because the bug is in the caller, not the asset.
 */
export function frame(
  atlas: LoadedAtlas,
  spriteId: string,
  frameIdx: number,
): AtlasFrame {
  const frames = atlas.meta.sprites[spriteId];
  if (!frames) {
    throw new RangeError(`unknown sprite id: ${spriteId}`);
  }
  if (atlas.fallback) {
    return FALLBACK_FRAME;
  }
  const wrapped = ((frameIdx % frames.length) + frames.length) % frames.length;
  // The schema enforces frames.length >= 1, so this index is always
  // in-bounds. The `as AtlasFrame` is needed because TypeScript widens
  // tuple element access to `AtlasFrame | undefined` under noUncheckedIndexedAccess.
  return frames[wrapped] as AtlasFrame;
}
