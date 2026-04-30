import {
  REGION_PALETTE_SLOTS,
  parseHexColor,
  type RegionPalette,
  type RegionPaletteSlot,
} from "@/data/palettes";
import type { AtlasFrame } from "@/data/schemas";

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type PaletteIndexMap = Readonly<Record<string, RegionPaletteSlot>>;

export const DEFAULT_PALETTE_INDEX_MAP: PaletteIndexMap = Object.freeze({
  "32,32,32": "propPrimary",
  "64,64,64": "propSecondary",
  "96,96,96": "propAccent",
  "128,128,128": "nearTerrain",
  "160,160,160": "roadSurface",
  "192,192,192": "roadEdge",
  "224,224,224": "midHorizon",
  "240,240,240": "fogTint",
  "255,255,255": "sky",
});

export function paletteCacheKey(spriteId: string, frameIndex: number, paletteId: string): string {
  return `${spriteId}:${frameIndex}:${paletteId}`;
}

export function recolourImageData(
  source: ImageDataLike,
  palette: RegionPalette,
  indexMap: PaletteIndexMap = DEFAULT_PALETTE_INDEX_MAP,
): ImageDataLike {
  if (source.data.length !== source.width * source.height * 4) {
    throw new RangeError("image data length does not match width and height");
  }

  const targets = new Map<RegionPaletteSlot, { r: number; g: number; b: number }>();
  for (const slot of REGION_PALETTE_SLOTS) {
    targets.set(slot, parseHexColor(palette.slots[slot]));
  }

  const data = new Uint8ClampedArray(source.data);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const slot = indexMap[`${data[i]},${data[i + 1]},${data[i + 2]}`];
    if (!slot) continue;
    const target = targets.get(slot);
    if (!target) continue;
    data[i] = target.r;
    data[i + 1] = target.g;
    data[i + 2] = target.b;
  }

  return { width: source.width, height: source.height, data };
}

export function makeRecolourCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === "undefined") {
    throw new Error("palette recolour requires OffscreenCanvas or document");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function recolourFrameToImageBitmap(
  image: CanvasImageSource,
  frame: AtlasFrame,
  palette: RegionPalette,
  indexMap: PaletteIndexMap = DEFAULT_PALETTE_INDEX_MAP,
): Promise<ImageBitmap | HTMLCanvasElement | OffscreenCanvas> {
  const canvas = makeRecolourCanvas(frame.w, frame.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d canvas context unavailable for palette recolour");
  }

  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  const imageData = ctx.getImageData(0, 0, frame.w, frame.h);
  const recoloured = recolourImageData(imageData, palette, indexMap);
  const output = new Uint8ClampedArray(recoloured.data.length);
  output.set(recoloured.data);
  ctx.putImageData(new ImageData(output as ImageDataArray, recoloured.width, recoloured.height), 0, 0);

  if (typeof createImageBitmap === "function") {
    return createImageBitmap(canvas);
  }
  return canvas;
}
