/**
 * Canvas2D strip drawer for the pseudo-3D road renderer.
 *
 * Consumes a `Strip[]` produced by `segmentProjector.project` and walks
 * back-to-front, drawing the sky band once, then each visible strip pair
 * (grass, rumble, road, lane markings) as filled trapezoids.
 *
 * Parallax support is opt-in via `DrawRoadOptions.parallax`: when present,
 * the drawer paints the parallax bands instead of the flat sky gradient,
 * preserving the painter's algorithm (background first, road over).
 *
 * Texture-backed sprite atlases land in `spriteAtlas.ts`; this drawer
 * owns the procedural roadside billboard fallback so compiled roadside
 * ids are visible before binary art ships.
 *
 * The drawer is the only module that knows about a Canvas2D context. The
 * projector is pure so unit tests can run without jsdom canvas mocking.
 */

import {
  DEFAULT_COLORS,
  GRASS_STRIPE_LEN,
  LANE_STRIPE_LEN,
  RUMBLE_STRIPE_LEN,
  SEGMENT_LENGTH,
  SPRITE_BASE_SCALE,
} from "@/road/constants";
import type { Camera, Strip, Viewport } from "@/road/types";
import type { WeatherOption } from "@/data/schemas";
import { visibilityForWeather } from "@/game/weather";

import { drawDust, type DustState } from "./dust";
import { drawParallax, type ParallaxLayer } from "./parallax";
import { frame, type LoadedAtlas } from "./spriteAtlas";
import { drawVfx, type VfxState } from "./vfx";

/**
 * Default alpha for the ghost car overlay. Pinned by the F-022 dot
 * stress-test item 9: a translucent second car following the player's
 * recorded path so the live driver can see their best line without the
 * ghost occluding the road. Kept as a named constant so the §6 Time Trial
 * UI can dim or brighten the ghost from a settings toggle without
 * re-pinning the magic number at every call site.
 */
export const GHOST_CAR_DEFAULT_ALPHA = 0.5;

/**
 * Default fill colour for the ghost car placeholder rectangle. The §6
 * Time Trial spec calls out a desaturated / blue tint to differentiate
 * the ghost from the live car; we ship the blue tint as the default so
 * the placeholder reads as "other player" without the §17 sprite atlas
 * being wired in. The atlas-frame variant lands in the same slice that
 * threads `LoadedAtlas` into the renderer (followup F-022 consumer side).
 */
export const GHOST_CAR_DEFAULT_FILL = "#5fb6ff";

/**
 * Default live player-car overlay colours. These are placeholder fills
 * until the §16 / §17 atlas slice wires real directional sprites through
 * the renderer.
 */
export const PLAYER_CAR_DEFAULT_FILL = "#f2c94c";
export const PLAYER_CAR_DEFAULT_SHADOW = "rgba(0, 0, 0, 0.55)";
export const PLAYER_CAR_DEFAULT_WINDSHIELD = "#18243d";
export const PLAYER_CAR_DEFAULT_TIRE = "#10151f";
export const PLAYER_CAR_DEFAULT_TAIL_LIGHT = "#ff3d38";

/**
 * Standard player-car footprint. §16 pins the player car at 16 to 22
 * percent of screen height in the standard camera mode; 0.18 leaves
 * headroom for the HUD and minimap while reading clearly at 800x480.
 */
export const PLAYER_CAR_HEIGHT_FRACTION = 0.18;
export const PLAYER_CAR_WIDTH_TO_HEIGHT = 1.15;
export const PLAYER_CAR_DEFAULT_SPRITE_ID = "sparrow_clean";
export const ROADSIDE_DRAW_PERIOD = 10;
export const ROADSIDE_MAX_HEIGHT_FRACTION = 0.22;
export const WEATHER_EFFECT_REDUCTION_SCALE = 0.35;
const LANE_DASH_CYCLE_METERS = LANE_STRIPE_LEN * SEGMENT_LENGTH;
const LANE_DASH_VISIBLE_METERS = SEGMENT_LENGTH * 2;

export interface RoadColors {
  skyTop: string;
  skyBottom: string;
  grassLight: string;
  grassDark: string;
  rumbleLight: string;
  rumbleDark: string;
  roadLight: string;
  roadDark: string;
  lane: string;
}

export interface DrawRoadOptions {
  colors?: RoadColors;
  /**
   * Optional parallax bands. When present, the drawer renders the bands
   * instead of the flat sky gradient. Pass an empty array to skip the
   * sky entirely (useful for dev pages that test road-only behaviour).
   * The accompanying `camera` is required so the parallax module can
   * scroll horizontally.
   */
  parallax?: {
    layers: readonly ParallaxLayer[];
    camera: Pick<Camera, "x" | "z">;
  };
  /**
   * Camera world-z used for foreground road-marking phase. The live race
   * route gets this from the same camera used for projection. Dev callers
   * can omit it; non-foreground strips still phase from compiled worldZ.
   */
  markingCameraZ?: number;
  /**
   * Optional VFX state. When present, the drawer paints active flashes
   * over the parallax / sky band, then translates the canvas by the
   * summed shake offset before drawing the road strips so the entire
   * road frame shakes as one unit. The flash lands BEHIND the road on
   * purpose: a HUD-style overlay flash belongs in the UI layer, while
   * an in-world impact flash should not occlude the player car.
   */
  vfx?: VfxState;
  /**
   * Optional dust pool. Painted AFTER the road strips so particles sit
   * over the grass / road, matching the §16 "Dust roost" reference (the
   * plume rises above the surface, never under it). Production sites
   * tick the pool from the sim layer with the player's surface flag and
   * pass it in here; the drawer never advances the pool itself.
   */
  dust?: DustState;
  /**
   * Optional screen-space weather effects for §14 / §16. These are
   * visual only: physics weather is handled by `src/game/raceSession.ts`.
   * The accessibility flag reduces particle density and overlay alpha
   * while preserving enough feedback to show the selected weather.
   */
  weatherEffects?: {
    weather: WeatherOption;
    visualReduction?: boolean;
    particleIntensity?: number;
    reducedGlare?: boolean;
    highContrastRoadsideSigns?: boolean;
    fogFloorClamp?: number;
    flashReduction?: boolean;
  };
  /**
   * Optional ghost car overlay per F-022. The §6 Time Trial flow drives
   * a second physics step from the recorded `Player.readNext` inputs to
   * derive the ghost's world position, projects it to the screen with
   * the same camera the live road uses, and passes the resulting
   * placement here. The drawer paints a translucent placeholder rect
   * BEHIND the dust pool (so off-road dust still occludes the ghost) but
   * AFTER the road strips (so the ghost reads as "on the road" rather
   * than driving through it). The atlas-frame draw variant lands when
   * the F-022 consumer slice threads a `LoadedAtlas` reference through
   * the renderer; until then the placeholder rect is the contract.
   *
   * `screenX` / `screenY` are CSS pixels (the render-time coordinates the
   * caller already computed via `segmentProjector.project`); `screenW` is
   * the projected car width in CSS pixels (commonly `strip.screenW *
   * carWidthFraction`); `alpha` defaults to `GHOST_CAR_DEFAULT_ALPHA`
   * when omitted. `null` / `undefined` skips the draw entirely so a fresh
   * Time Trial run with no stored ghost paints nothing extra.
   */
  ghostCar?: {
    screenX: number;
    screenY: number;
    screenW: number;
    alpha?: number;
    fill?: string;
    atlas?: LoadedAtlas | null;
    spriteId?: string;
    frameIndex?: number;
  } | null;
  /**
   * Optional live player car overlay. Pseudo-3D road strips represent the
   * world moving under a chase camera, so the player car is drawn as a
   * fixed bottom-screen overlay after the road and dust layers. The
   * placeholder is intentionally simple until atlas sprites land, but it
   * preserves the §16 standard camera footprint.
   */
  playerCar?: {
    fill?: string;
    shadow?: string;
    tire?: string;
    tailLight?: string;
    windshield?: string;
    weather?: WeatherOption;
    atlas?: LoadedAtlas | null;
    spriteId?: string;
    frameIndex?: number;
  } | null;
}

type RoadsideSpriteKind = "sign" | "tree" | "fence" | "rock" | "pole";

interface RoadsideSpriteStyle {
  kind: RoadsideSpriteKind;
  widthToHeight: number;
  heightRoadFactor: number;
  minHeight: number;
}

const ROADSIDE_SPRITE_STYLES: Record<string, RoadsideSpriteStyle> = {
  sign_marker: { kind: "sign", widthToHeight: 0.45, heightRoadFactor: 0.85, minHeight: 8 },
  tree_pine: { kind: "tree", widthToHeight: 0.58, heightRoadFactor: 1.35, minHeight: 12 },
  fence_post: { kind: "fence", widthToHeight: 0.32, heightRoadFactor: 0.5, minHeight: 5 },
  rock_boulder: { kind: "rock", widthToHeight: 1.2, heightRoadFactor: 0.42, minHeight: 5 },
  light_pole: { kind: "pole", widthToHeight: 0.16, heightRoadFactor: 1.9, minHeight: 14 },
  palms_sparse: { kind: "tree", widthToHeight: 0.58, heightRoadFactor: 1.35, minHeight: 12 },
  marina_signs: { kind: "sign", widthToHeight: 0.45, heightRoadFactor: 0.85, minHeight: 8 },
  guardrail: { kind: "fence", widthToHeight: 0.32, heightRoadFactor: 0.5, minHeight: 5 },
  water_wall: { kind: "rock", widthToHeight: 1.2, heightRoadFactor: 0.42, minHeight: 5 },
};

const FALLBACK_COLORS: RoadColors = {
  skyTop: DEFAULT_COLORS.skyTop,
  skyBottom: DEFAULT_COLORS.skyBottom,
  grassLight: DEFAULT_COLORS.grassLight,
  grassDark: DEFAULT_COLORS.grassDark,
  rumbleLight: DEFAULT_COLORS.rumbleLight,
  rumbleDark: DEFAULT_COLORS.rumbleDark,
  roadLight: DEFAULT_COLORS.roadLight,
  roadDark: DEFAULT_COLORS.roadDark,
  lane: DEFAULT_COLORS.lane,
};

function pickAlternating(index: number, period: number, light: string, dark: string): string {
  return Math.floor(index / period) % 2 === 0 ? light : dark;
}

/** Fill a vertical-axis trapezoid between two centered horizontal segments. */
function drawTrapezoid(
  ctx: CanvasRenderingContext2D,
  color: string,
  nearX: number,
  nearY: number,
  nearHalfW: number,
  farX: number,
  farY: number,
  farHalfW: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(nearX - nearHalfW, nearY);
  ctx.lineTo(nearX + nearHalfW, nearY);
  ctx.lineTo(farX + farHalfW, farY);
  ctx.lineTo(farX - farHalfW, farY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw the sky band as a vertical gradient covering the full viewport.
 * The road strips are drawn over this base.
 */
function drawSky(ctx: CanvasRenderingContext2D, viewport: Viewport, colors: RoadColors): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/**
 * Render the projected road strips into the given Canvas2D context.
 *
 * The strip array is iterated back-to-front so nearer strips paint over
 * farther ones, producing the classic Outrun look without a depth buffer.
 *
 * Empty strip arrays are valid; the drawer renders only the sky band.
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  options: DrawRoadOptions = {},
): void {
  const colors = options.colors ?? FALLBACK_COLORS;

  if (options.parallax) {
    drawParallax(ctx, options.parallax.layers, options.parallax.camera, viewport);
  } else {
    drawSky(ctx, viewport, colors);
  }

  // VFX runs after the sky / parallax pass so the flash overlay sits on
  // top of the static background but BEHIND the road strips. The shake
  // offset, however, has to wrap the road draw so the road translates
  // as one unit. We capture the offset here, then save / translate /
  // restore around the strip loop.
  const shakeOffset = options.vfx ? drawVfx(ctx, options.vfx, viewport) : null;

  if (strips.length >= 2) {
    if (shakeOffset && (shakeOffset.dx !== 0 || shakeOffset.dy !== 0)) {
      ctx.save();
      ctx.translate(shakeOffset.dx, shakeOffset.dy);
      drawStrips(ctx, strips, viewport, colors, markingCameraZFrom(options));
      drawRoadsideSprites(
        ctx,
        strips,
        viewport,
        options.weatherEffects?.highContrastRoadsideSigns === true,
      );
      ctx.restore();
    } else {
      drawStrips(ctx, strips, viewport, colors, markingCameraZFrom(options));
      drawRoadsideSprites(
        ctx,
        strips,
        viewport,
        options.weatherEffects?.highContrastRoadsideSigns === true,
      );
    }
  }

  // Ghost car paints over the road strips so the player sees their best
  // line, but BEFORE the dust pool so off-road dust the live car kicks
  // up still occludes the ghost rather than the ghost showing through
  // the plume. The shake offset is intentionally not applied to the
  // ghost: a §16 impact shake should not drag the recorded path with
  // the live car. Painted unconditionally on a non-empty `ghostCar`
  // prop so an empty strip array (test / dev scenes that draw the sky
  // but no road) still surfaces the ghost overlay.
  if (options.ghostCar) {
    drawGhostCar(ctx, options.ghostCar, viewport);
  }

  // Dust paints over the road / grass strips and under the live car.
  // The pool is owned by the caller; the drawer is read-only on it.
  if (options.dust) {
    drawDust(ctx, options.dust, viewport);
  }

  if (options.weatherEffects) {
    drawWeatherEffects(ctx, viewport, options.weatherEffects);
  }

  if (options.playerCar) {
    drawPlayerCar(ctx, options.playerCar, viewport);
  }
}

function markingCameraZFrom(options: DrawRoadOptions): number | null {
  return options.markingCameraZ ?? options.parallax?.camera.z ?? null;
}

function roadsideStyleFor(id: string): RoadsideSpriteStyle | null {
  if (id === "default") return null;
  return ROADSIDE_SPRITE_STYLES[id] ?? null;
}

function shouldDrawRoadsideSprite(strip: Strip, side: "left" | "right"): boolean {
  const offset = side === "left" ? 0 : Math.floor(ROADSIDE_DRAW_PERIOD / 2);
  return (strip.segment.index + offset) % ROADSIDE_DRAW_PERIOD === 0;
}

function drawRoadsideSprites(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  highContrastSigns = false,
): void {
  for (let i = strips.length - 1; i >= 0; i--) {
    const strip = strips[i];
    if (!strip?.visible) continue;
    drawRoadsideSprite(ctx, strip, viewport, "left", highContrastSigns);
    drawRoadsideSprite(ctx, strip, viewport, "right", highContrastSigns);
  }
}

function drawRoadsideSprite(
  ctx: CanvasRenderingContext2D,
  strip: Strip,
  viewport: Viewport,
  side: "left" | "right",
  highContrastSigns: boolean,
): void {
  if (!shouldDrawRoadsideSprite(strip, side)) return;
  const id =
    side === "left" ? strip.segment.roadsideLeftId : strip.segment.roadsideRightId;
  const style = roadsideStyleFor(id);
  if (!style) return;
  if (viewport.width <= 0 || viewport.height <= 0) return;
  if (!Number.isFinite(strip.screenW) || strip.screenW <= 0) return;
  if (!Number.isFinite(strip.screenX) || !Number.isFinite(strip.screenY)) return;

  const maxHeight = viewport.height * ROADSIDE_MAX_HEIGHT_FRACTION;
  const height = Math.max(
    style.minHeight,
    Math.min(maxHeight, strip.screenW * style.heightRoadFactor * SPRITE_BASE_SCALE),
  );
  const width = height * style.widthToHeight;
  const sideSign = side === "left" ? -1 : 1;
  const baseX = strip.screenX + sideSign * strip.screenW * 1.32;
  const baseY = strip.screenY;

  if (baseY < 0 || baseY - height > viewport.height) return;
  if (baseX + width < 0 || baseX - width > viewport.width) return;

  switch (style.kind) {
    case "tree":
      drawTreeSprite(ctx, baseX, baseY, width, height);
      break;
    case "sign":
      drawSignSprite(ctx, baseX, baseY, width, height, highContrastSigns);
      break;
    case "fence":
      drawFenceSprite(ctx, baseX, baseY, width, height);
      break;
    case "rock":
      drawRockSprite(ctx, baseX, baseY, width, height);
      break;
    case "pole":
      drawPoleSprite(ctx, baseX, baseY, width, height);
      break;
  }
}

function drawTreeSprite(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#1b3a20";
  ctx.fillRect(baseX - width * 0.08, baseY - height * 0.42, width * 0.16, height * 0.42);
  ctx.fillStyle = "#245c2f";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - height);
  ctx.lineTo(baseX + width * 0.55, baseY - height * 0.32);
  ctx.lineTo(baseX - width * 0.55, baseY - height * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2f7a3a";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - height * 0.8);
  ctx.lineTo(baseX + width * 0.45, baseY - height * 0.18);
  ctx.lineTo(baseX - width * 0.45, baseY - height * 0.18);
  ctx.closePath();
  ctx.fill();
}

function drawSignSprite(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
  highContrast = false,
): void {
  ctx.fillStyle = "#d9d7c7";
  ctx.fillRect(baseX - width * 0.08, baseY - height * 0.58, width * 0.16, height * 0.58);
  ctx.fillStyle = highContrast ? "#fff36a" : "#e7d24d";
  ctx.fillRect(baseX - width * 0.5, baseY - height, width, height * 0.38);
  ctx.fillStyle = highContrast ? "#05070d" : "#23304d";
  ctx.fillRect(baseX - width * 0.36, baseY - height * 0.88, width * 0.72, height * 0.08);
  if (highContrast) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(baseX - width * 0.48, baseY - height * 0.99, width * 0.96, height * 0.04);
    ctx.fillRect(baseX - width * 0.48, baseY - height * 0.66, width * 0.96, height * 0.04);
  }
}

function drawFenceSprite(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#d7d4c5";
  ctx.fillRect(baseX - width * 0.5, baseY - height * 0.7, width, height * 0.12);
  ctx.fillRect(baseX - width * 0.5, baseY - height * 0.38, width, height * 0.12);
  ctx.fillStyle = "#8d8a80";
  ctx.fillRect(baseX - width * 0.08, baseY - height, width * 0.16, height);
}

function drawRockSprite(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#767c82";
  ctx.beginPath();
  ctx.moveTo(baseX - width * 0.5, baseY);
  ctx.lineTo(baseX - width * 0.36, baseY - height * 0.7);
  ctx.lineTo(baseX + width * 0.08, baseY - height);
  ctx.lineTo(baseX + width * 0.5, baseY - height * 0.42);
  ctx.lineTo(baseX + width * 0.44, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9aa0a5";
  ctx.fillRect(baseX - width * 0.18, baseY - height * 0.7, width * 0.28, height * 0.12);
}

function drawPoleSprite(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#c9ccd2";
  ctx.fillRect(baseX - width * 0.22, baseY - height, width * 0.44, height);
  ctx.fillStyle = "#f1e36a";
  ctx.fillRect(baseX - width * 1.4, baseY - height, width * 2.8, height * 0.09);
}

function drawWeatherEffects(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  effects: NonNullable<DrawRoadOptions["weatherEffects"]>,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  const settings = resolveWeatherEffectSettings(effects);

  switch (effects.weather) {
    case "light_rain":
    case "rain":
    case "heavy_rain":
      drawRainStreaks(ctx, viewport, effects.weather, settings.particleIntensity);
      return;
    case "snow":
      drawSnowParticles(ctx, viewport, settings.particleIntensity);
      return;
    case "fog":
      drawFogFade(ctx, viewport, settings.alphaScale, settings.fogFloorClamp);
      return;
    case "dusk":
    case "night":
      drawNightBloom(ctx, viewport, effects.weather, settings.bloomScale);
      return;
    case "clear":
    case "overcast":
      return;
  }
}

interface ResolvedWeatherEffectSettings {
  particleIntensity: number;
  alphaScale: number;
  fogFloorClamp: number;
  bloomScale: number;
}

function resolveWeatherEffectSettings(
  effects: NonNullable<DrawRoadOptions["weatherEffects"]>,
): ResolvedWeatherEffectSettings {
  const reductionScale =
    effects.visualReduction === true ? WEATHER_EFFECT_REDUCTION_SCALE : 1;
  const particleIntensity = clampUnit(effects.particleIntensity ?? 1) * reductionScale;
  const alphaScale = reductionScale;
  const glareScale = effects.reducedGlare === true ? 0.55 : 1;
  const flashScale = effects.flashReduction === true ? 0.45 : 1;
  return {
    particleIntensity,
    alphaScale,
    fogFloorClamp: clampUnit(effects.fogFloorClamp ?? 0),
    bloomScale: reductionScale * glareScale * flashScale,
  };
}

function drawRainStreaks(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  weather: Extract<WeatherOption, "light_rain" | "rain" | "heavy_rain">,
  intensity: number,
): void {
  const baseCount = weather === "heavy_rain" ? 92 : weather === "rain" ? 58 : 32;
  const count = Math.round(baseCount * intensity);
  if (count <= 0) return;
  const alpha = (weather === "heavy_rain" ? 0.34 : weather === "rain" ? 0.26 : 0.18) * intensity;
  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#cfefff";
    for (let i = 0; i < count; i++) {
      const x = ((i * 73) % Math.max(1, viewport.width + 80)) - 40;
      const y = (i * 47) % Math.max(1, viewport.height);
      const h = weather === "heavy_rain" ? 18 : 13;
      ctx.fillRect(x, y, 2, h);
    }
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

function drawSnowParticles(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  intensity: number,
): void {
  const count = Math.round(54 * intensity);
  if (count <= 0) return;
  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = 0.72 * intensity;
    ctx.fillStyle = "#f4fbff";
    for (let i = 0; i < count; i++) {
      const size = i % 5 === 0 ? 3 : 2;
      const x = (i * 89) % Math.max(1, viewport.width);
      const y = (i * 53) % Math.max(1, viewport.height);
      ctx.fillRect(x, y, size, size);
    }
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

function drawFogFade(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  intensity: number,
  fogFloorClamp: number,
): void {
  const visibility = Math.max(visibilityForWeather("fog"), fogFloorClamp);
  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = Math.min(0.5, (1 - visibility) * 0.72 * intensity);
    ctx.fillStyle = "#cbd7e1";
    ctx.fillRect(0, 0, viewport.width, viewport.height * 0.72);
    ctx.globalAlpha = Math.min(0.28, (1 - visibility) * 0.4 * intensity);
    ctx.fillRect(0, viewport.height * 0.48, viewport.width, viewport.height * 0.34);
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

function drawNightBloom(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  weather: Extract<WeatherOption, "dusk" | "night">,
  intensity: number,
): void {
  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = (weather === "night" ? 0.34 : 0.22) * intensity;
    ctx.fillStyle = "#f4e779";
    const y = viewport.height * 0.22;
    const w = viewport.width * 0.12;
    const h = viewport.height * 0.035;
    ctx.fillRect(viewport.width * 0.28 - w / 2, y, w, h);
    ctx.fillRect(viewport.width * 0.72 - w / 2, y, w, h);
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Paint the F-022 ghost car overlay as a translucent placeholder rect.
 *
 * The atlas-frame variant (sampling the player car sprite at the same
 * facing the live car uses, optionally desaturated) lands in the F-022
 * consumer slice that wires `LoadedAtlas` through the renderer. Until
 * then the rect is the contract: a `screenW`-wide, half-square-tall
 * box anchored at the projected ground point, painted at 0.5 alpha by
 * default. The aspect choice (1:0.5) keeps the placeholder visually
 * read as a car silhouette without claiming sprite-grade detail.
 *
 * No-op when the projection collapses to zero width (the ghost is past
 * the draw distance / behind the camera) or when the viewport is
 * zero-area, so callers do not need to gate the call themselves.
 *
 * The `globalAlpha` mutation is wrapped in a `try / finally` save and
 * restore equivalent so a thrown rect (vanishingly unlikely on Canvas2D
 * but possible if the host injects a custom context) cannot leak alpha
 * into the next draw call.
 */
function drawGhostCar(
  ctx: CanvasRenderingContext2D,
  ghost: NonNullable<DrawRoadOptions["ghostCar"]>,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  if (!Number.isFinite(ghost.screenW) || ghost.screenW <= 0) return;
  if (!Number.isFinite(ghost.screenX) || !Number.isFinite(ghost.screenY)) return;

  const alpha =
    typeof ghost.alpha === "number" && Number.isFinite(ghost.alpha)
      ? Math.max(0, Math.min(1, ghost.alpha))
      : GHOST_CAR_DEFAULT_ALPHA;
  if (alpha <= 0) return;

  const fill = ghost.fill ?? GHOST_CAR_DEFAULT_FILL;
  if (ghost.atlas?.image) {
    const sprite = frame(
      ghost.atlas,
      ghost.spriteId ?? PLAYER_CAR_DEFAULT_SPRITE_ID,
      ghost.frameIndex ?? 0,
    );
    drawAtlasCarFrame(
      ctx,
      ghost.atlas.image,
      sprite,
      ghost.screenX,
      ghost.screenY,
      ghost.screenW,
      alpha,
    );
    return;
  }

  // 1:0.5 aspect places the rectangle centered on the projected ground
  // point with the silhouette sitting just above it; matches the §17
  // car-silhouette aspect well enough to read as a fallback vehicle.
  const halfW = ghost.screenW / 2;
  const heightPx = ghost.screenW / 2;

  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  try {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(ghost.screenX - halfW, ghost.screenY - heightPx, ghost.screenW, heightPx);
  } finally {
    ctx.globalAlpha = prevAlpha;
    ctx.fillStyle = prevFill;
  }
}

/**
 * Paint the live player car as a centered chase-camera overlay.
 *
 * The shape is a temporary original silhouette, not a substitute for the
 * §17 directional sprite atlas. It gives the runtime view the correct
 * readable player-car anchor at race start and keeps the visual footprint
 * inside the §16 16 to 22 percent height band.
 */
function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  car: NonNullable<DrawRoadOptions["playerCar"]>,
  viewport: Viewport,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;

  const height = viewport.height * PLAYER_CAR_HEIGHT_FRACTION;
  if (!Number.isFinite(height) || height <= 0) return;
  const width = height * PLAYER_CAR_WIDTH_TO_HEIGHT;
  const centerX = viewport.width / 2;
  const bottomY = viewport.height - Math.max(14, viewport.height * 0.035);
  const topY = bottomY - height;
  const halfW = width / 2;

  drawCarWeatherTrail(ctx, centerX, bottomY, width, height, car.weather);

  if (car.atlas?.image) {
    const sprite = frame(
      car.atlas,
      car.spriteId ?? PLAYER_CAR_DEFAULT_SPRITE_ID,
      car.frameIndex ?? 0,
    );
    drawAtlasCarFrame(ctx, car.atlas.image, sprite, centerX, bottomY, width, 1);
    return;
  }

  const prevFill = ctx.fillStyle;
  try {
    ctx.fillStyle = car.tire ?? PLAYER_CAR_DEFAULT_TIRE;
    ctx.beginPath();
    ctx.moveTo(centerX - halfW * 0.68, bottomY - height * 0.12);
    ctx.lineTo(centerX - halfW * 0.54, bottomY - height * 0.12);
    ctx.lineTo(centerX - halfW * 0.48, topY + height * 0.42);
    ctx.lineTo(centerX - halfW * 0.58, topY + height * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(centerX + halfW * 0.54, bottomY - height * 0.12);
    ctx.lineTo(centerX + halfW * 0.68, bottomY - height * 0.12);
    ctx.lineTo(centerX + halfW * 0.58, topY + height * 0.42);
    ctx.lineTo(centerX + halfW * 0.48, topY + height * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.shadow ?? PLAYER_CAR_DEFAULT_SHADOW;
    ctx.beginPath();
    ctx.moveTo(centerX - halfW * 0.82, bottomY);
    ctx.lineTo(centerX + halfW * 0.82, bottomY);
    ctx.lineTo(centerX + halfW * 0.56, topY + height * 0.12);
    ctx.lineTo(centerX - halfW * 0.56, topY + height * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.fill ?? PLAYER_CAR_DEFAULT_FILL;
    ctx.beginPath();
    ctx.moveTo(centerX - halfW * 0.68, bottomY - height * 0.06);
    ctx.lineTo(centerX + halfW * 0.68, bottomY - height * 0.06);
    ctx.lineTo(centerX + halfW * 0.46, topY + height * 0.04);
    ctx.lineTo(centerX + halfW * 0.24, topY);
    ctx.lineTo(centerX - halfW * 0.24, topY);
    ctx.lineTo(centerX - halfW * 0.46, topY + height * 0.04);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.windshield ?? PLAYER_CAR_DEFAULT_WINDSHIELD;
    ctx.beginPath();
    ctx.moveTo(centerX - halfW * 0.28, topY + height * 0.2);
    ctx.lineTo(centerX + halfW * 0.28, topY + height * 0.2);
    ctx.lineTo(centerX + halfW * 0.18, topY + height * 0.48);
    ctx.lineTo(centerX - halfW * 0.18, topY + height * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d7a91e";
    ctx.fillRect(centerX - halfW * 0.32, topY + height * 0.56, width * 0.64, height * 0.07);

    ctx.fillStyle = car.tailLight ?? PLAYER_CAR_DEFAULT_TAIL_LIGHT;
    ctx.fillRect(centerX - halfW * 0.52, bottomY - height * 0.24, width * 0.16, height * 0.08);
    ctx.fillRect(centerX + halfW * 0.36, bottomY - height * 0.24, width * 0.16, height * 0.08);
  } finally {
    ctx.fillStyle = prevFill;
  }
}

function drawCarWeatherTrail(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  bottomY: number,
  width: number,
  height: number,
  weather: WeatherOption | undefined,
): void {
  if (
    !weather ||
    weather === "clear" ||
    weather === "overcast" ||
    weather === "dusk" ||
    weather === "night"
  ) {
    return;
  }

  const prevFill = ctx.fillStyle;
  const prevAlpha = ctx.globalAlpha;
  try {
    if (weather === "snow") {
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "#edf7ff";
      ctx.beginPath();
      ctx.moveTo(centerX - width * 0.36, bottomY - height * 0.12);
      ctx.lineTo(centerX + width * 0.36, bottomY - height * 0.12);
      ctx.lineTo(centerX + width * 0.52, bottomY + height * 0.06);
      ctx.lineTo(centerX - width * 0.52, bottomY + height * 0.06);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (weather !== "light_rain" && weather !== "rain" && weather !== "heavy_rain") {
      return;
    }

    ctx.globalAlpha = weather === "heavy_rain" ? 0.7 : 0.52;
    ctx.fillStyle = "#d8f4ff";
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.56, bottomY - height * 0.08);
    ctx.lineTo(centerX - width * 0.18, bottomY - height * 0.02);
    ctx.lineTo(centerX - width * 0.62, bottomY + height * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(centerX + width * 0.56, bottomY - height * 0.08);
    ctx.lineTo(centerX + width * 0.18, bottomY - height * 0.02);
    ctx.lineTo(centerX + width * 0.62, bottomY + height * 0.14);
    ctx.closePath();
    ctx.fill();
  } finally {
    ctx.fillStyle = prevFill;
    ctx.globalAlpha = prevAlpha;
  }
}

function drawAtlasCarFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sprite: ReturnType<typeof frame>,
  anchorX: number,
  anchorY: number,
  width: number,
  alpha: number,
): void {
  if (!Number.isFinite(width) || width <= 0) return;
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;

  const height = width * (sprite.h / sprite.w);
  const pivotX = sprite.anchor?.x ?? 0.5;
  const pivotY = sprite.anchor?.y ?? 1;
  const dx = anchorX - width * pivotX;
  const dy = anchorY - height * pivotY;

  const prevAlpha = ctx.globalAlpha;
  try {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(image, sprite.x, sprite.y, sprite.w, sprite.h, dx, dy, width, height);
  } finally {
    ctx.globalAlpha = prevAlpha;
  }
}

function drawStrips(
  ctx: CanvasRenderingContext2D,
  strips: readonly Strip[],
  viewport: Viewport,
  colors: RoadColors,
  markingCameraZ: number | null,
): void {
  // Walk far to near so the painter's algorithm covers distant strips with
  // closer ones. We need pairs (near, far); start from the last visible
  // strip and step toward index 0.
  for (let n = strips.length - 1; n >= 1; n--) {
    const far = strips[n];
    const near = strips[n - 1];
    if (!far || !near) continue;
    if (!far.visible || !near.visible) continue;
    drawStripPair(ctx, edgeFromStrip(near), edgeFromStrip(far), viewport, colors);
  }

  const foregroundFar = strips.find((strip) => strip.visible && strip.foreground);
  if (foregroundFar?.foreground) {
    const farEdge = edgeFromStrip(foregroundFar);
    drawStripPair(
      ctx,
      {
        segment: foregroundFar.segment,
        screenX: foregroundFar.foreground.screenX,
        screenY: foregroundFar.foreground.screenY,
        screenW: foregroundFar.foreground.screenW,
        worldZ: markingCameraZ ?? farEdge.worldZ - SEGMENT_LENGTH,
      },
      farEdge,
      viewport,
      colors,
    );
  }
}

interface StripEdge {
  segment: Strip["segment"];
  screenX: number;
  screenY: number;
  screenW: number;
  worldZ: number;
}

function edgeFromStrip(strip: Strip): StripEdge {
  return {
    segment: strip.segment,
    screenX: strip.screenX,
    screenY: strip.screenY,
    screenW: strip.screenW,
    worldZ: strip.segment.worldZ,
  };
}

function drawStripPair(
  ctx: CanvasRenderingContext2D,
  near: StripEdge,
  far: StripEdge,
  viewport: Viewport,
  colors: RoadColors,
): void {
  const segIndex = far.segment.index;
  const worldNear = near.worldZ;
  const worldFar = far.worldZ > worldNear ? far.worldZ : worldNear + SEGMENT_LENGTH;

  const grassColor = pickAlternating(
    segIndex,
    GRASS_STRIPE_LEN,
    colors.grassLight,
    colors.grassDark,
  );
  ctx.fillStyle = grassColor;
  const yTop = far.screenY;
  const yBottom = near.screenY;
  if (yBottom > yTop) {
    ctx.fillRect(0, yTop, viewport.width, yBottom - yTop);
  }

  drawPhasedTrapezoids(
    ctx,
    near,
    far,
    worldNear,
    worldFar,
    1.15,
    RUMBLE_STRIPE_LEN * SEGMENT_LENGTH,
    (worldZ) =>
      pickAlternatingByWorld(worldZ, RUMBLE_STRIPE_LEN * SEGMENT_LENGTH, colors.rumbleLight, colors.rumbleDark),
  );

  drawPhasedTrapezoids(
    ctx,
    near,
    far,
    worldNear,
    worldFar,
    1,
    RUMBLE_STRIPE_LEN * SEGMENT_LENGTH,
    (worldZ) =>
      pickAlternatingByWorld(worldZ, RUMBLE_STRIPE_LEN * SEGMENT_LENGTH, colors.roadLight, colors.roadDark),
  );

  drawDutyCycleTrapezoids(
    ctx,
    near,
    far,
    worldNear,
    worldFar,
    0.03,
    LANE_DASH_CYCLE_METERS,
    LANE_DASH_VISIBLE_METERS,
    (worldZ) =>
      modulo(worldZ, LANE_DASH_CYCLE_METERS) < LANE_DASH_VISIBLE_METERS
        ? colors.lane
        : null,
    { minNearHalfW: 1, minFarHalfW: 0.5 },
  );
}

function pickAlternatingByWorld(
  worldZ: number,
  periodMeters: number,
  light: string,
  dark: string,
): string {
  return Math.floor(worldZ / periodMeters) % 2 === 0 ? light : dark;
}

function nextPhaseBoundary(worldZ: number, periodMeters: number): number {
  return (Math.floor(worldZ / periodMeters) + 1) * periodMeters;
}

function modulo(value: number, period: number): number {
  return ((value % period) + period) % period;
}

function nextDutyBoundary(
  worldZ: number,
  cycleMeters: number,
  visibleMeters: number,
): number {
  const phase = modulo(worldZ, cycleMeters);
  const cycleStart = worldZ - phase;
  if (phase < visibleMeters) return cycleStart + visibleMeters;
  return cycleStart + cycleMeters;
}

function lerpNumber(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function edgeAt(near: StripEdge, far: StripEdge, t: number): Pick<StripEdge, "screenX" | "screenY" | "screenW"> {
  return {
    screenX: lerpNumber(near.screenX, far.screenX, t),
    screenY: lerpNumber(near.screenY, far.screenY, t),
    screenW: lerpNumber(near.screenW, far.screenW, t),
  };
}

function drawPhasedTrapezoids(
  ctx: CanvasRenderingContext2D,
  near: StripEdge,
  far: StripEdge,
  worldNear: number,
  worldFar: number,
  widthScale: number,
  periodMeters: number,
  colorAtWorld: (worldZ: number) => string | null,
  widthOptions: { minNearHalfW?: number; minFarHalfW?: number } = {},
): void {
  const span = worldFar - worldNear;
  if (span <= 0) return;

  let cursor = worldNear;
  let guard = 0;
  while (cursor < worldFar && guard < 16) {
    const next = Math.min(worldFar, nextPhaseBoundary(cursor, periodMeters));
    const mid = (cursor + next) / 2;
    const color = colorAtWorld(mid);
    if (color) {
      const tNear = (cursor - worldNear) / span;
      const tFar = (next - worldNear) / span;
      const nearEdge = edgeAt(near, far, tNear);
      const farEdge = edgeAt(near, far, tFar);
      drawTrapezoid(
        ctx,
        color,
        nearEdge.screenX,
        nearEdge.screenY,
        Math.max(widthOptions.minNearHalfW ?? 0, nearEdge.screenW * widthScale),
        farEdge.screenX,
        farEdge.screenY,
        Math.max(widthOptions.minFarHalfW ?? 0, farEdge.screenW * widthScale),
      );
    }
    cursor = next;
    guard += 1;
  }
}

function drawDutyCycleTrapezoids(
  ctx: CanvasRenderingContext2D,
  near: StripEdge,
  far: StripEdge,
  worldNear: number,
  worldFar: number,
  widthScale: number,
  cycleMeters: number,
  visibleMeters: number,
  colorAtWorld: (worldZ: number) => string | null,
  widthOptions: { minNearHalfW?: number; minFarHalfW?: number } = {},
): void {
  const span = worldFar - worldNear;
  if (span <= 0) return;
  if (cycleMeters <= 0 || visibleMeters <= 0) return;
  if (visibleMeters >= cycleMeters) {
    drawPhasedTrapezoids(
      ctx,
      near,
      far,
      worldNear,
      worldFar,
      widthScale,
      cycleMeters,
      colorAtWorld,
      widthOptions,
    );
    return;
  }

  let cursor = worldNear;
  let guard = 0;
  while (cursor < worldFar && guard < 32) {
    const next = Math.min(worldFar, nextDutyBoundary(cursor, cycleMeters, visibleMeters));
    const mid = (cursor + next) / 2;
    const color = colorAtWorld(mid);
    if (color) {
      const tNear = (cursor - worldNear) / span;
      const tFar = (next - worldNear) / span;
      const nearEdge = edgeAt(near, far, tNear);
      const farEdge = edgeAt(near, far, tFar);
      drawTrapezoid(
        ctx,
        color,
        nearEdge.screenX,
        nearEdge.screenY,
        Math.max(widthOptions.minNearHalfW ?? 0, nearEdge.screenW * widthScale),
        farEdge.screenX,
        farEdge.screenY,
        Math.max(widthOptions.minFarHalfW ?? 0, farEdge.screenW * widthScale),
      );
    }
    cursor = next;
    guard += 1;
  }
}
