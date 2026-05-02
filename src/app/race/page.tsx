"use client";

/**
 * Race route: Phase 1 vertical slice.
 *
 * Mounts a canvas wired to the runtime core: track compiler, fixed-step
 * loop, input manager, race session, road renderer, and HUD overlay. Per
 * the dot stress-test (`VibeGear2-implement-phase-1-7aef013d`):
 * - Reads `?track=<slug>` from the URL; defaults to `test/curve`. Unknown
 *   ids fall back to the default; the resolved id surfaces on the page.
 * - Mounts an 800x480 canvas to match `/dev/road` and `/dev/ai`.
 * - Wraps the entire scene in `<ErrorBoundary>` so a render or step throw
 *   falls through to the recovery UI instead of leaving a blank page.
 * - Holds the loop handle in a `useRef` and stops it on unmount, so the
 *   StrictMode double-mount in dev does not spawn two parallel loops.
 * - Pause overlay sits on top of the canvas: pressing Escape opens the
 *   menu, which calls `loop.pause()`; resume calls `loop.resume()`.
 *
 * Asset preload is deliberately skipped in this slice: the demo only needs
 * the track JSON (statically imported by the tracks barrel) and the road
 * renderer's solid-fill colours. The `LoadingGate` returns once concrete
 * sprite atlases ship under `public/assets/` and the manifest can resolve
 * them without 404 noise; tracked under `F-018`.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { PauseOverlay } from "@/components/pause/PauseOverlay";
import { TouchControls } from "@/components/touch/TouchControls";
import { readKeyBindings } from "@/components/options/controlsPaneState";
import { usePauseActions } from "@/components/pause/usePauseActions";
import { usePauseToggle } from "@/components/pause/usePauseToggle";
import { saveRaceResult } from "@/components/results/raceResultStorage";
import {
  AI_DRIVERS,
  CARS,
  HAZARDS_BY_ID,
  TRACK_IDS,
  TRACK_RAW,
  getAIDriver,
  getCar,
  getChampionship,
  loadTrack,
} from "@/data";
import {
  CAR_SPRITE_SET_IDS,
  type CarSpriteSetId,
  carAtlasMetaForVisualProfile,
  carSpriteSetForVisualProfile,
} from "@/data/atlas/carSprites";
import {
  TrackSchema,
  type AudioSettings,
  type Track,
} from "@/data/schemas";
import {
  applyTimeTrialResult,
  buildFinalCarInputsFromSession,
  buildFinalRaceState,
  buildRaceResult,
  createGhostDriver,
  createInputManager,
  createRaceSession,
  createTimeTrialRecorder,
  damageDeltaFromState,
  deriveHudState,
  deriveSplitsState,
  pendingDamageForActiveCar,
  applyRaceDamageToGarage,
  applyRaceResultRecords,
  applyTourRaceResult,
  rankPosition,
  retireRaceSession,
  resetRaceSessionToLastCheckpoint,
  setRaceSessionWeather,
  OPEN_TUNNEL_STATE,
  segmentAt,
  segmentIsTunnel,
  spawnGrid,
  startLoop,
  stepRaceSession,
  stepTunnelState,
  totalProgress,
  tunnelOcclusion,
  type LoopHandle,
  type RaceSessionAudioEvent,
  type RaceSessionConfig,
  type RaceSessionState,
  type RankedCar,
  type GhostDriver,
  type GhostOverlay,
  type TimeTrialRecorder,
} from "@/game";
import { DEFAULT_TOUCH_LAYOUT, type TouchLayout } from "@/game/inputTouch";
import { FIXED_STEP_SECONDS } from "@/game/loop";
import {
  DEFAULT_NITRO_CHARGES,
  nitroDurationForTier,
  nitroUpgradeTierForUpgrades,
} from "@/game/nitro";
import {
  CarClassSchema,
  WeatherOptionSchema,
  type AIDriver,
  type CarBaseStats,
  type WeatherOption,
} from "@/data/schemas";
import type { DailyChallengeSelection } from "@/game/modes/dailyChallenge";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  SEGMENT_LENGTH,
  fitToBox,
  project,
  projectCar,
  projectGhostCar,
  upcomingCurvature,
  type Camera,
  type CompiledSegment,
  type CompiledTrack,
  type MinimapPoint,
  type Strip,
  type Viewport,
} from "@/road";
import {
  PICKUP_FEEDBACK_TTL_MS,
  drawRoad,
  type DrawRoadOptions,
} from "@/render/pseudoRoadCanvas";
import { projectPickupSprites } from "@/render/pickupSprites";
import { playerCarFrameIndex } from "@/render/carFrame";
import type { CarSpriteSet } from "@/render/carSpriteCompositor";
import {
  clampDevicePixelRatio,
  resolveGraphicsSettings,
} from "@/render/graphicsSettings";
import { loadAtlas, type LoadedAtlas } from "@/render/spriteAtlas";
import { drawMinimap, type MinimapCar } from "@/render/hudMinimap";
import type { ParallaxLayer } from "@/render/parallax";
import { drawSplitsWidget } from "@/render/hudSplits";
import { drawHud } from "@/render/uiRenderer";
import { defaultSave, loadSave, saveSave } from "@/persistence/save";
import {
  awardCredits,
  baseRewardForTrackDifficulty,
  computeRaceReward,
} from "@/game/economy";
import type { SaveGame } from "@/data/schemas";
import type { RaceResult } from "@/game/raceResult";
import { PRISTINE_DAMAGE_STATE, type DamageState } from "@/game/damage";
import {
  activeWeatherForState,
  weatherGripScalarForState,
  type TireKind,
} from "@/game/weather";
import {
  bindAudioVisibilitySuspension,
  getAudioContext,
  resumeAudioContext,
} from "@/audio/context";
import {
  ProceduralEngineRuntime,
  type EngineAudioContextLike,
  type EngineRuntimeInput,
} from "@/audio/engineRuntime";
import {
  ProceduralSfxRuntime,
  type SfxAudioContextLike,
} from "@/audio/sfx";
import {
  MusicRuntime,
  raceMusicCue,
  raceMusicIntensity,
  weatherMusicStem,
} from "@/audio/music";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;
const DEFAULT_TRACK_ID = "test/elevation";
const TOUR_PLACEHOLDER_TRACK_ID = "test/straight";
const WORLD_TOUR_CHAMPIONSHIP_ID = "world-tour-standard";
const PLAYER_ID = "player";
const LAP_MOMENT_MS = 900;
const FINISH_MOMENT_MS = 1250;
const AI_FALLBACK_FILLS = Object.freeze([
  "#ff6b5f",
  "#63d471",
  "#5fb6ff",
  "#f7d154",
  "#d980ff",
  "#ff9f43",
]);
const AI_MIN_PROJECTED_WIDTH_DESKTOP = 20;
const AI_MIN_PROJECTED_WIDTH_MOBILE = 12;
const EMPTY_COLLECTED_PICKUP_SET: ReadonlySet<string> = new Set<string>();

/**
 * §20 minimap layout. The wireframe places the minimap in the bottom-left
 * grip cluster; we anchor a 120x120 box with a 16 px gutter from the
 * viewport edges so it sits clear of the speedometer and lap-timer.
 */
const MINIMAP_PADDING = 16;
const MINIMAP_SIZE = 120;

function minimapBoxFor(viewport: Viewport): { x: number; y: number; w: number; h: number } {
  return {
    x: MINIMAP_PADDING,
    y: Math.max(MINIMAP_PADDING, viewport.height - MINIMAP_PADDING - MINIMAP_SIZE),
    w: MINIMAP_SIZE,
    h: MINIMAP_SIZE,
  };
}

function resizeCanvasBackingStore(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pixelRatioCap = 2,
): Viewport {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || VIEWPORT_WIDTH));
  const height = Math.max(1, Math.round(rect.height || VIEWPORT_HEIGHT));
  const dpr = clampDevicePixelRatio(window.devicePixelRatio || 1, pixelRatioCap);
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { width, height };
}

function touchLayoutFor(viewport: Viewport): TouchLayout {
  return {
    ...DEFAULT_TOUCH_LAYOUT,
    width: viewport.width,
    height: viewport.height,
  };
}

function currentRaceAudioContext(): unknown | null {
  const context = getAudioContext();
  if (
    context === null ||
    !("createOscillator" in context) ||
    !("createGain" in context) ||
    !("currentTime" in context) ||
    !("destination" in context)
  ) {
    return null;
  }
  return context;
}

function currentEngineAudioContext(): EngineAudioContextLike | null {
  const context = currentRaceAudioContext();
  return context === null ? null : (context as EngineAudioContextLike);
}

function currentSfxAudioContext(): SfxAudioContextLike | null {
  const context = currentRaceAudioContext();
  return context === null ? null : (context as SfxAudioContextLike);
}

function playRaceSfxEvents(
  runtime: ProceduralSfxRuntime,
  events: ReadonlyArray<RaceSessionAudioEvent>,
  audio: AudioSettings | undefined,
): void {
  for (const event of events) {
    if (event.kind === "impact") {
      runtime.playImpact({
        hitKind: event.hitKind,
        speedFactor: event.speedFactor,
        audio,
      });
    } else if (event.kind === "nitroEngage") {
      runtime.playNitroEngage({ audio });
    } else if (event.kind === "pickupCollected") {
      runtime.playPickupCollected({
        pickupKind: event.pickupKind,
        audio,
      });
    } else if (event.kind === "gearShift") {
      runtime.playGearShift({
        fromGear: event.fromGear,
        toGear: event.toGear,
        audio,
      });
    } else if (event.kind === "lapComplete") {
      runtime.playLapComplete({ audio });
    } else if (event.kind === "raceFinish") {
      runtime.playResultsStinger({ audio });
    } else if (event.kind === "brakeScrub") {
      runtime.playBrakeScrub({ speedFactor: event.speedFactor, audio });
    } else if (event.kind === "tireSqueal") {
      runtime.playTireSqueal({ speedFactor: event.speedFactor, audio });
    } else if (event.kind === "surfaceHush") {
      runtime.playSurfaceHush({
        surface: event.surface,
        speedFactor: event.speedFactor,
        audio,
      });
    }
  }
}

interface RaceMoment {
  kind: "lap" | "finish";
  title: string;
  detail: string;
}

interface PickupFeedbackSnapshot {
  kind: "cash" | "nitro";
  value: number;
  createdAtMs: number;
}

function playerMomentFromEvents(
  events: ReadonlyArray<RaceSessionAudioEvent>,
  totalLaps: number,
): RaceMoment | null {
  let latest: RaceMoment | null = null;
  for (const event of events) {
    if (event.carId !== PLAYER_ID) continue;
    if (event.kind === "lapComplete") {
      const nextLap = Math.min(totalLaps, event.lap + 1);
      latest = {
        kind: "lap",
        title: `Lap ${event.lap} complete`,
        detail: `Next lap ${nextLap} / ${totalLaps}`,
      };
    } else if (event.kind === "raceFinish") {
      latest = {
        kind: "finish",
        title: "Finish",
        detail: "Saving results",
      };
    }
  }
  return latest;
}

function playerPickupFeedbackFromEvents(
  events: ReadonlyArray<RaceSessionAudioEvent>,
  nowMs: number,
): PickupFeedbackSnapshot | null {
  let latest: PickupFeedbackSnapshot | null = null;
  for (const event of events) {
    if (event.carId !== PLAYER_ID) continue;
    if (event.kind !== "pickupCollected") continue;
    latest = {
      kind: event.pickupKind,
      value: event.value,
      createdAtMs: nowMs,
    };
  }
  return latest;
}

function finishMomentTitle(place: number): string {
  if (place === 1) return "Victory";
  if (place <= 3) return "Podium";
  return "Finished";
}

function createLayerCanvas(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx, width, height);
  return canvas;
}

function createTemperateParallaxLayers(viewport: Viewport): readonly ParallaxLayer[] {
  const sky = createLayerCanvas(512, 256, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0e1730");
    gradient.addColorStop(1, "#4d6f94");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
  const mountains = createLayerCanvas(512, 96, (ctx, width, height) => {
    ctx.fillStyle = "#253a55";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(64, height * 0.08);
    ctx.lineTo(130, height * 0.82);
    ctx.lineTo(210, height * 0.06);
    ctx.lineTo(300, height * 0.74);
    ctx.lineTo(386, height * 0.1);
    ctx.lineTo(width, height * 0.78);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });
  const hills = createLayerCanvas(512, 96, (ctx, width, height) => {
    ctx.fillStyle = "#265c2d";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.quadraticCurveTo(width * 0.18, height * 0.3, width * 0.36, height * 0.7);
    ctx.quadraticCurveTo(width * 0.58, height * 1.05, width * 0.78, height * 0.45);
    ctx.quadraticCurveTo(width * 0.9, height * 0.18, width, height * 0.5);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#43565d";
    for (let x = 28; x < width; x += 74) {
      const blockHeight = 12 + ((x / 2) % 18);
      ctx.fillRect(x, height - blockHeight - 3, 18, blockHeight);
    }
  });

  return [
    { id: "sky", image: sky, scrollX: 0, bandHeight: viewport.height, yAnchor: 0 },
    {
      id: "mountains",
      image: mountains,
      scrollX: 0.22,
      bandHeight: viewport.height * 0.1,
      yAnchor: 0.01,
    },
    {
      id: "hills",
      image: hills,
      scrollX: 0.55,
      bandHeight: viewport.height * 0.09,
      yAnchor: 0.04,
    },
  ];
}

/**
 * Sparrow GT base stats. Mirrors `src/data/cars/sparrow-gt.json`. Inlined
 * to avoid an additional JSON import path; the catalogue is the source of
 * truth for content tests, this constant only feeds the demo.
 */
const STARTER_STATS: CarBaseStats = Object.freeze({
  topSpeed: 61.0,
  accel: 16.0,
  brake: 28.0,
  gripDry: 1.0,
  gripWet: 0.82,
  stability: 1.0,
  durability: 0.95,
  nitroEfficiency: 1.0,
});

interface ResolvedTrack {
  id: string;
  runtimeId: string;
  version: number;
  compiled: CompiledTrack;
}

interface TourRaceContext {
  championship: ReturnType<typeof getChampionship>;
  tourId: string;
  raceIndex: number;
  plannedTrackId: string;
  aiDriverIds: readonly string[];
}

function resolveTourRaceContext(
  tourId: string | null,
  raceIndexRaw: string | null,
): TourRaceContext | null {
  if (!tourId) return null;
  const championship = getChampionship(WORLD_TOUR_CHAMPIONSHIP_ID);
  const tour = championship.tours.find((candidate) => candidate.id === tourId);
  if (!tour) return null;
  const raceIndex =
    raceIndexRaw === null ? 0 : Number.parseInt(raceIndexRaw, 10);
  if (!Number.isInteger(raceIndex) || raceIndex < 0) return null;
  const plannedTrackId = tour.tracks[raceIndex];
  if (!plannedTrackId) return null;
  return {
    championship,
    tourId,
    raceIndex,
    plannedTrackId,
    aiDriverIds: tour.aiDrivers ?? [],
  };
}

function resolveTrack(
  requestedId: string | null,
  tourContext: TourRaceContext | null,
): ResolvedTrack {
  const knownId =
    requestedId && TRACK_IDS.includes(requestedId) ? requestedId : null;
  const useTourPlaceholder =
    knownId === null &&
    requestedId !== null &&
    tourContext !== null &&
    requestedId === tourContext.plannedTrackId;
  const runtimeId = knownId ?? (useTourPlaceholder ? TOUR_PLACEHOLDER_TRACK_ID : DEFAULT_TRACK_ID);
  const id = useTourPlaceholder ? requestedId : runtimeId;
  const parsed = TrackSchema.parse(TRACK_RAW[runtimeId]);
  return { id, runtimeId, version: parsed.version, compiled: loadTrack(runtimeId) };
}

type RaceMode = "race" | "timeTrial" | "quickRace" | "practice";
type TimeTrialGhostSource = "personalBest" | "downloaded";

function resolveRaceMode(raw: string | null): RaceMode {
  if (raw === "practice") return "practice";
  if (raw === "quickRace") return "quickRace";
  return raw === "timeTrial" ? "timeTrial" : "race";
}

function resolveTimeTrialGhostSource(raw: string | null): TimeTrialGhostSource {
  return raw === "downloaded" ? "downloaded" : "personalBest";
}

function resolveRaceWeather(
  raw: string | null,
  track: ResolvedTrack,
): RaceSessionConfig["weather"] {
  const parsed = WeatherOptionSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return track.compiled.weatherOptions.includes(parsed.data) ? parsed.data : undefined;
}

function resolveDailyChallengeMarker(input: {
  mode: RaceMode;
  dateKey: string | null;
  seed: string | null;
  carClass: string | null;
  trackId: string;
  weather: RaceSessionConfig["weather"];
}): DailyChallengeSelection | null {
  if (input.mode !== "timeTrial") return null;
  if (input.weather === undefined) return null;
  if (input.dateKey === null || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) {
    return null;
  }
  if (input.seed === null || !/^\d+$/.test(input.seed.trim())) return null;
  const seed = Number.parseInt(input.seed, 10);
  if (!Number.isSafeInteger(seed) || seed < 0) return null;
  const carClass = CarClassSchema.safeParse(input.carClass);
  if (!carClass.success) return null;
  return {
    dateKey: input.dateKey,
    seed,
    trackId: input.trackId,
    weather: input.weather,
    carClass: carClass.data,
  };
}

function resolvePlayerTire(raw: string | null): TireKind | undefined {
  return raw === "wet" || raw === "dry" ? raw : undefined;
}

function weatherOptionLabel(weather: WeatherOption): string {
  return weather
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveSessionCar(
  save: SaveGame,
  requestedCarId: string | null,
): { id: string; stats: CarBaseStats; spriteSet: string } {
  const fallbackId = save.garage.activeCarId;
  const requestedIsOwned =
    requestedCarId !== null && save.garage.ownedCars.includes(requestedCarId);
  const carId = requestedIsOwned ? requestedCarId : fallbackId;
  const car = getCar(carId) ?? getCar(fallbackId) ?? CARS[0];
  if (car === undefined) {
    return { id: fallbackId, stats: STARTER_STATS, spriteSet: "sparrow_gt" };
  }
  return {
    id: car.id,
    stats: car.baseStats,
    spriteSet: car.visualProfile.spriteSet,
  };
}

/**
 * Parse the optional `?laps=N` URL override. Used by the F-029 e2e to
 * coerce a multi-lap run on the bundled single-lap test tracks without
 * shipping a dedicated multi-lap data file. Returns `null` when the param
 * is missing, non-integer, or outside `[1, 50]`. The upper bound matches
 * the §7 race-rules sanity range so a malformed link cannot DoS the loop.
 * Honoured by `RaceSessionConfig.totalLaps`; the data file's `laps` field
 * remains the default.
 */
function resolveLapsOverride(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) return null;
  return parsed;
}

function resolveRaceAIDrivers(
  tourContext: TourRaceContext | null,
): readonly AIDriver[] {
  if (tourContext === null) return AI_DRIVERS.slice(0, 1);
  const tourRoster =
    tourContext.aiDriverIds
      .map((driverId) => getAIDriver(driverId))
      .filter((driver): driver is AIDriver => driver !== undefined);
  return tourRoster.length > 0 ? tourRoster : AI_DRIVERS.slice(0, 11);
}

/**
 * Convert a car's forward distance into a minimap marker by mapping
 * `car.z` (meters) to a compiled `[segmentIndex, progress]` pair and
 * delegating to `projectCar`. Negative or out-of-range `z` values are
 * wrapped into the ring so a stationary countdown car always projects
 * onto the start point.
 */
function toMinimapCar(
  points: readonly MinimapPoint[],
  carZ: number,
  totalSegments: number,
  totalLength: number,
  isPlayer: boolean,
): MinimapCar {
  const wrappedZ = totalLength > 0 ? ((carZ % totalLength) + totalLength) % totalLength : 0;
  const continuousIndex = wrappedZ / SEGMENT_LENGTH;
  const segmentIndex = Math.floor(continuousIndex) % Math.max(1, totalSegments);
  const progress = continuousIndex - Math.floor(continuousIndex);
  const { x, y } = projectCar(points, segmentIndex, progress);
  return { x, y, isPlayer };
}

function projectOpponentCar(input: {
  carX: number;
  carZ: number;
  camera: Camera;
  segments: readonly CompiledSegment[];
  strips: readonly Strip[];
  viewport: Viewport;
  trackLength: number;
  atlas: LoadedAtlas | null;
  spriteSet: CarSpriteSet;
  fill?: string;
  frameIndex: number;
  braking: boolean;
  nitroActive: boolean;
  speedMetersPerSecond: number;
  damageTotal: number;
}): NonNullable<DrawRoadOptions["aiCars"]>[number] | null {
  const depthMeters = input.carZ - input.camera.z;
  if (!Number.isFinite(depthMeters) || depthMeters < input.camera.depth) return null;
  if (depthMeters > 200) return null;
  if (!Number.isFinite(input.trackLength) || input.trackLength <= 0) return null;

  const projection = projectGhostCar(
    input.segments,
    input.camera,
    input.viewport,
    input.carZ,
    input.carX,
  );
  if (!projection.visible || projection.screenW <= 0) return null;
  const anchorStrip = input.strips[projection.segmentOffset];
  if (!anchorStrip?.visible) return null;

  const projectedScreenW = projection.screenW * 0.3;
  const minProjectedWidth =
    input.viewport.width < 500
      ? AI_MIN_PROJECTED_WIDTH_MOBILE
      : AI_MIN_PROJECTED_WIDTH_DESKTOP;
  if (projectedScreenW < minProjectedWidth) return null;
  const screenW = Math.min(92, projectedScreenW);
  return {
    screenX: projection.screenX,
    screenY: projection.screenY,
    screenW,
    depthMeters,
    atlas: input.atlas,
    spriteSet: input.spriteSet,
    fill: input.fill,
    frameIndex: input.frameIndex,
    braking: input.braking,
    nitroActive: input.nitroActive,
    speedMetersPerSecond: input.speedMetersPerSecond,
    damageTotal: input.damageTotal,
  };
}

interface AiProjectionSnapshot {
  readonly nearestDepthMeters: number;
  readonly nearestScreenX: number;
  readonly nearestScreenW: number;
  readonly nearestWidthDepthProduct: number;
}

function aiProjectionSnapshot(
  cars: readonly NonNullable<DrawRoadOptions["aiCars"]>[number][],
): AiProjectionSnapshot | null {
  let nearest: NonNullable<DrawRoadOptions["aiCars"]>[number] | null = null;
  for (const car of cars) {
    if (nearest === null || car.depthMeters < nearest.depthMeters) {
      nearest = car;
    }
  }
  if (nearest === null) return null;
  return {
    nearestDepthMeters: nearest.depthMeters,
    nearestScreenX: nearest.screenX,
    nearestScreenW: nearest.screenW,
    nearestWidthDepthProduct: nearest.screenW * nearest.depthMeters,
  };
}

interface RoadProjectionSnapshot {
  readonly visibleStrips: number;
  readonly nearCenterX: number;
  readonly nearY: number;
  readonly nearHalfWidth: number;
  readonly horizonY: number;
}

function roadProjectionSnapshot(
  strips: readonly Strip[],
): RoadProjectionSnapshot | null {
  const visible = strips.filter((strip) => strip.visible);
  const near = visible[0];
  const horizon = visible[visible.length - 1];
  if (!near || !horizon) return null;
  const foreground = near.foreground ?? {
    screenX: near.screenX,
    screenY: near.screenY,
    screenW: near.screenW,
  };
  return {
    visibleStrips: visible.length,
    nearCenterX: foreground.screenX,
    nearY: foreground.screenY,
    nearHalfWidth: foreground.screenW,
    horizonY: horizon.screenY,
  };
}

function aiSpriteSetIdForGridIndex(index: number): CarSpriteSetId {
  const offset = index + 1;
  return CAR_SPRITE_SET_IDS[offset % CAR_SPRITE_SET_IDS.length]!;
}

/**
 * Race-finish wallet commit per F-034. Credits the §12 reward (placement
 * payout + §5 bonuses) into the persisted save, persists the new save
 * via `saveSave`, and stamps the actual wallet delta onto a fresh
 * `RaceResult` clone so the §20 results screen renders the cash the
 * player just received.
 *
 * Pure on its inputs; the only side effect is the `saveSave` call. When
 * the persisted save was the synthesised default (no profile yet) the
 * wallet commit still runs so a first-race player walks away with their
 * earnings; the awarded delta exactly mirrors the placement payout the
 * receipt shows. DNF cars receive the §12 participation cash, also
 * mirrored on `creditsAwarded`.
 *
 * The retire and natural-finish branches in the loop effect both call
 * this helper with the same `result` they would otherwise hand straight
 * to `saveRaceResult`, so the wallet commit + receipt mirror stays a
 * single owner regardless of how the race ended.
 */
function commitRaceCredits(input: {
  result: RaceResult;
  save: SaveGame;
  difficulty: string;
  baseTrackReward: number;
  damageAfter?: Readonly<DamageState>;
  activeCarId?: string | null;
  transformCommit?: (save: SaveGame, result: RaceResult) => {
    readonly save: SaveGame;
    readonly result: RaceResult;
  };
}): RaceResult {
  const {
    result,
    save,
    difficulty,
    baseTrackReward,
    damageAfter,
    activeCarId,
    transformCommit,
  } = input;
  const playerRecord = result.finishingOrder.find(
    (record) => record.carId === result.playerCarId,
  );
  if (!playerRecord) {
    return result;
  }

  // 1-indexed placement; defensive fallback to a trailing place so the
  // §12 finish-multiplier table still resolves a non-zero scalar.
  const placement = result.playerPlacement ?? result.finishingOrder.length;

  const award = awardCredits(save, {
    placement,
    status: playerRecord.status,
    baseTrackReward,
    difficulty,
    bonuses: result.bonuses,
  });
  if (!award.ok) {
    // `awardCredits` only fails when the input save is malformed; the
    // race-finish flow always supplies a freshly loaded or synthesised
    // save, so this branch is defensive and surfaces as a no-op.
    return result;
  }

  // Persist the credited save plus any PB patch emitted by the result
  // builder. Storage failure is non-fatal here: the player still sees
  // the receipt, and the next race finish can retry from a loaded save.
  const recordsSave = applyRaceResultRecords(award.state, result);
  const nextSave =
    damageAfter === undefined
      ? recordsSave
      : applyRaceDamageToGarage({
          save: recordsSave,
          carId: activeCarId ?? recordsSave.garage.activeCarId,
          damage: damageAfter,
          lastRaceCashEarned: award.cashEarned ?? 0,
        });
  const creditedResult = {
    ...result,
    creditsAwarded: award.cashEarned ?? 0,
  };
  const transformed =
    transformCommit?.(nextSave, creditedResult) ?? {
      save: nextSave,
      result: creditedResult,
    };
  saveSave(transformed.save);

  return transformed.result;
}

function commitTimeTrialRecords(input: {
  result: RaceResult;
  fallbackSave: SaveGame;
}): { result: RaceResult; save: SaveGame } {
  const result = { ...input.result, creditsAwarded: 0 };
  if (result.recordsUpdated === null) {
    return { result, save: input.fallbackSave };
  }

  const latest = loadSave();
  const baseSave = latest.kind === "loaded" ? latest.save : input.fallbackSave;
  const nextSave = applyRaceResultRecords(baseSave, result);
  const write = saveSave(nextSave);
  return {
    result,
    save:
      write.kind === "ok"
        ? { ...nextSave, writeCounter: (nextSave.writeCounter ?? 0) + 1 }
        : baseSave,
  };
}

export default function RacePage(): ReactElement {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RaceShellLoading />}>
        <RaceShell />
      </Suspense>
    </ErrorBoundary>
  );
}

function RaceShellLoading(): ReactElement {
  return (
    <main data-testid="race-shell-loading" style={shellStyle}>
      Loading race shell...
    </main>
  );
}

function RaceShell(): ReactElement {
  const search = useSearchParams();
  const requestedId = search?.get("track") ?? null;
  const lapsRaw = search?.get("laps") ?? null;
  const modeRaw = search?.get("mode") ?? null;
  const weatherRaw = search?.get("weather") ?? null;
  const tireRaw = search?.get("tire") ?? null;
  const carRaw = search?.get("car") ?? null;
  const ghostRaw = search?.get("ghost") ?? null;
  const dailyDateKeyRaw = search?.get("daily") ?? null;
  const dailySeedRaw = search?.get("dailySeed") ?? null;
  const dailyCarClassRaw = search?.get("carClass") ?? null;
  const tourId = search?.get("tour") ?? null;
  const raceIndexRaw = search?.get("raceIndex") ?? null;
  const tourContext = useMemo(
    () => resolveTourRaceContext(tourId, raceIndexRaw),
    [tourId, raceIndexRaw],
  );
  const track = useMemo(
    () => resolveTrack(requestedId, tourContext),
    [requestedId, tourContext],
  );
  const lapsOverride = useMemo(() => resolveLapsOverride(lapsRaw), [lapsRaw]);
  const mode = useMemo(() => resolveRaceMode(modeRaw), [modeRaw]);
  const weather = useMemo(
    () => resolveRaceWeather(weatherRaw, track),
    [track, weatherRaw],
  );
  const dailyChallenge = useMemo(
    () =>
      resolveDailyChallengeMarker({
        mode,
        dateKey: dailyDateKeyRaw,
        seed: dailySeedRaw,
        carClass: dailyCarClassRaw,
        trackId: track.id,
        weather,
      }),
    [dailyCarClassRaw, dailyDateKeyRaw, dailySeedRaw, mode, track.id, weather],
  );
  const playerTire = useMemo(() => resolvePlayerTire(tireRaw), [tireRaw]);
  const ghostSource = useMemo(
    () => resolveTimeTrialGhostSource(ghostRaw),
    [ghostRaw],
  );
  return (
    <RaceCanvas
      track={track}
      lapsOverride={lapsOverride}
      mode={mode}
      tourContext={tourContext}
      weather={weather}
      playerTire={playerTire}
      selectedCarId={carRaw}
      dailyChallenge={dailyChallenge}
      ghostSource={ghostSource}
    />
  );
}

interface RaceCanvasProps {
  track: ResolvedTrack;
  lapsOverride: number | null;
  mode: RaceMode;
  tourContext: TourRaceContext | null;
  weather: RaceSessionConfig["weather"];
  playerTire: TireKind | undefined;
  selectedCarId: string | null;
  dailyChallenge: DailyChallengeSelection | null;
  ghostSource: TimeTrialGhostSource;
}

function RaceCanvas({
  track,
  lapsOverride,
  mode,
  tourContext,
  weather,
  playerTire,
  selectedCarId,
  dailyChallenge,
  ghostSource,
}: RaceCanvasProps): ReactElement {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<LoopHandle | null>(null);
  const sessionRef = useRef<RaceSessionState | null>(null);
  const ghostDriverRef = useRef<GhostDriver | null>(null);
  const ghostOverlayRef = useRef<GhostOverlay>(null);
  const ghostOverlayTickRef = useRef<number | null>(null);
  const timeTrialRecorderRef = useRef<TimeTrialRecorder | null>(null);
  const lastSteerRef = useRef<number>(0);
  const lastBrakeRef = useRef<number>(0);
  const pauseInputHeldRef = useRef<boolean>(false);
  const carAtlasRef = useRef<LoadedAtlas | null>(null);
  const aiCarAtlasesRef = useRef<Partial<Record<CarSpriteSetId, LoadedAtlas>>>({});
  const carSpriteSetRef = useRef<CarSpriteSet>(
    carSpriteSetForVisualProfile("sparrow_gt"),
  );
  // Imperative pause-menu effects, populated inside the loop effect
  // below so the hook layer can stay decoupled from the loop / session
  // / config refs. The hook reads these getters once per click; mid-
  // race ref swaps are not expected (the page is mounted once per race).
  const restartFnRef = useRef<(() => void) | null>(null);
  const retireFnRef = useRef<(() => void) | null>(null);
  const exitFnRef = useRef<(() => void) | null>(null);
  const settingsFnRef = useRef<(() => void) | null>(null);
  const ghostsFnRef = useRef<(() => void) | null>(null);
  const raceMomentTimeoutRef = useRef<number | null>(null);
  const finishRouteTimeoutRef = useRef<number | null>(null);
  const pickupFeedbackRef = useRef<PickupFeedbackSnapshot | null>(null);
  // Per-mount guard for the natural finish wiring. The render callback
  // fires every frame, so without this latch a `phase === "finished"`
  // tick would call `saveRaceResult` and `router.push` on every frame
  // until the unmount tear-down ran. The latch is reset to `false`
  // whenever a fresh session is created (mount or restart) so a second
  // race after a restart still triggers the natural-finish route once.
  const routedRef = useRef<boolean>(false);

  const [phase, setPhase] = useState<"countdown" | "racing" | "finished">(
    "countdown",
  );
  const [countdownSecondsLeft, setCountdownSecondsLeft] = useState<number>(3);
  const initialTotalLaps = lapsOverride ?? track.compiled.laps;
  const [hudSnapshot, setHudSnapshot] = useState<{
    speed: number;
    lap: number;
    totalLaps: number;
    position: number;
  }>(() => ({ speed: 0, lap: 1, totalLaps: initialTotalLaps, position: 1 }));
  const [inputSnapshot, setInputSnapshot] = useState<{
    steer: number;
    touchActive: boolean;
  }>(() => ({ steer: 0, touchActive: false }));
  const [practiceSnapshot, setPracticeSnapshot] = useState<{
    weather: WeatherOption;
    weatherGripPercent: number;
    tire: TireKind;
    surface: string;
    checkpointLabel: string | null;
    checkpointReady: boolean;
  } | null>(null);
  const [fieldSize, setFieldSize] = useState<number>(1);
  const [aiVisibleCount, setAiVisibleCount] = useState<number>(0);
  const [aiProjection, setAiProjection] =
    useState<AiProjectionSnapshot | null>(null);
  const [roadProjection, setRoadProjection] =
    useState<RoadProjectionSnapshot | null>(null);
  const [visiblePickupCount, setVisiblePickupCount] = useState<number>(0);
  const [collectedPickupCount, setCollectedPickupCount] = useState<number>(0);
  const [playerNitroActive, setPlayerNitroActive] = useState<boolean>(false);
  const [pickupFeedback, setPickupFeedback] =
    useState<PickupFeedbackSnapshot | null>(null);
  const [touchLayout, setTouchLayout] = useState<TouchLayout>(() =>
    touchLayoutFor({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }),
  );
  const [resultMs, setResultMs] = useState<number | null>(null);
  const [raceMoment, setRaceMoment] = useState<RaceMoment | null>(null);

  const clearRaceMomentTimeout = useCallback(() => {
    if (raceMomentTimeoutRef.current === null) return;
    window.clearTimeout(raceMomentTimeoutRef.current);
    raceMomentTimeoutRef.current = null;
  }, []);

  const clearFinishRouteTimeout = useCallback(() => {
    if (finishRouteTimeoutRef.current === null) return;
    window.clearTimeout(finishRouteTimeoutRef.current);
    finishRouteTimeoutRef.current = null;
  }, []);

  const showRaceMoment = useCallback(
    (next: RaceMoment, durationMs: number) => {
      clearRaceMomentTimeout();
      setRaceMoment(next);
      if (durationMs > 0) {
        raceMomentTimeoutRef.current = window.setTimeout(() => {
          raceMomentTimeoutRef.current = null;
          setRaceMoment((current) => (current === next ? null : current));
        }, durationMs);
      }
    },
    [clearRaceMomentTimeout],
  );

  useEffect(() => {
    let active = true;
    const persisted = loadSave();
    const sessionSave =
      persisted.kind === "loaded" ? persisted.save : defaultSave();
    const sessionCar = resolveSessionCar(sessionSave, selectedCarId);
    const spriteSet = carSpriteSetForVisualProfile(sessionCar.spriteSet);
    carSpriteSetRef.current = spriteSet;
    carAtlasRef.current = null;
    void loadAtlas(carAtlasMetaForVisualProfile(sessionCar.spriteSet)).then(
      (atlas) => {
        if (active) carAtlasRef.current = atlas;
      },
    );
    aiCarAtlasesRef.current = {};
    void Promise.all(
      CAR_SPRITE_SET_IDS.map(async (id) => {
        const atlas = await loadAtlas(carAtlasMetaForVisualProfile(id));
        return [id, atlas] as const;
      }),
    ).then((entries) => {
      if (active) aiCarAtlasesRef.current = Object.fromEntries(entries);
    });
    return () => {
      active = false;
    };
  }, [selectedCarId]);

  const pause = usePauseToggle({ loop: () => handleRef.current });
  const { openMenu: openPauseMenu } = pause;

  // §20 pause-menu actions. Each impl is a thin wrapper around the
  // matching ref so the hook always sees stable callbacks; the refs
  // are populated once the loop effect runs. Restart and retire are
  // disabled (`null`) once the race has finished; the §20 results
  // screen owns the post-finish rematch / continue flow instead.
  const onRestartImpl = useCallback(() => {
    restartFnRef.current?.();
  }, []);
  const onRetireImpl = useCallback(() => {
    retireFnRef.current?.();
  }, []);
  const onExitToTitleImpl = useCallback(() => {
    exitFnRef.current?.();
  }, []);
  const onSettingsImpl = useCallback(() => {
    settingsFnRef.current?.();
  }, []);
  const onGhostsImpl = useCallback(() => {
    ghostsFnRef.current?.();
  }, []);
  const onPracticeCheckpointReset = useCallback(() => {
    if (mode !== "practice") return;
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = resetRaceSessionToLastCheckpoint(session);
  }, [mode]);
  const onPracticeWeatherChange = useCallback(
    (nextWeather: WeatherOption) => {
      if (mode !== "practice") return;
      const session = sessionRef.current;
      if (!session) return;
      if (!track.compiled.weatherOptions.includes(nextWeather)) return;
      sessionRef.current = setRaceSessionWeather(
        session,
        nextWeather,
        track.compiled.weatherOptions,
      );
      setPracticeSnapshot((prev) =>
        prev === null
          ? prev
          : {
              ...prev,
              weather: nextWeather,
            },
      );
    },
    [mode, track],
  );

  const pauseActions = usePauseActions({
    closeMenu: pause.closeMenu,
    onRestartImpl: phase === "finished" ? null : onRestartImpl,
    onRetireImpl: phase === "finished" ? null : onRetireImpl,
    onExitToTitleImpl,
    onSettingsImpl,
    onGhostsImpl,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolve persisted §19 accessibility assists and §28 difficulty
    // preset at session start so the toggles in /options/accessibility
    // and /options actually shape the per-tick input + scalars. Sampled
    // once: the runtime does not currently honour mid-race toggles
    // (the pause menu would close, then a fresh race would re-read on
    // next mount). Falls back to the defaults bundle when no save
    // exists or the load failed; the runtime treats every missing flag
    // as `false` already, and an undefined `difficultyPreset` resolves
    // to Balanced via `resolvePresetScalars`.
    const persisted = loadSave();
    const sessionSave =
      persisted.kind === "loaded" ? persisted.save : defaultSave();
    const persistedSettings =
      persisted.kind === "loaded"
        ? persisted.save.settings
        : defaultSave().settings;
    const persistedAssists = persistedSettings.assists;
    const persistedDifficulty = persistedSettings.difficultyPreset;
    const graphics = resolveGraphicsSettings(persistedSettings.graphics);
    const persistedKeyBindings = readKeyBindings(sessionSave);
    const practiceMode = mode === "practice";
    const ghostEnabled = mode === "timeTrial";
    const recordsOnlyMode = mode === "timeTrial" || mode === "quickRace";
    const noCampaignMode = recordsOnlyMode || practiceMode;
    const economyEnabled = mode === "race";
    const sessionCar = resolveSessionCar(sessionSave, selectedCarId);
    carSpriteSetRef.current = carSpriteSetForVisualProfile(sessionCar.spriteSet);
    const playerStats = sessionCar.stats;
    const initialPlayerDamage = noCampaignMode
      ? PRISTINE_DAMAGE_STATE
      : pendingDamageForActiveCar(sessionSave);
    const raceSeed = 1;
    let timeTrialSaveSnapshot = sessionSave;
    const spawnedAi = ghostEnabled || practiceMode
      ? []
      : spawnGrid({
          trackSpawn: track.compiled.spawn,
          laneCount: track.compiled.laneCount,
          aiDrivers: resolveRaceAIDrivers(tourContext).map((driver) => ({
            driver,
            stats: playerStats,
          })),
          seed: raceSeed,
        });

    const config: RaceSessionConfig = {
      track: track.compiled,
      player: {
        stats: playerStats,
        assists: persistedAssists,
        difficultyPreset: persistedDifficulty,
        initialDamage: initialPlayerDamage,
      },
      ai: spawnedAi,
      hazardsById: HAZARDS_BY_ID,
      seed: raceSeed,
      ...(weather ? { weather } : {}),
      ...(playerTire ? { playerTire } : {}),
      ...(practiceMode ? { countdownSec: 0 } : {}),
      ...(lapsOverride !== null ? { totalLaps: lapsOverride } : {}),
    };
    setFieldSize(1 + config.ai.length);

    const resetTimeTrialRuntime = (): void => {
      ghostOverlayRef.current = null;
      ghostOverlayTickRef.current = null;
      if (!ghostEnabled) {
        ghostDriverRef.current = null;
        timeTrialRecorderRef.current = null;
        return;
      }
      const currentGhost =
        ghostSource === "downloaded"
          ? timeTrialSaveSnapshot.downloadedGhosts?.[track.id] ?? null
          : timeTrialSaveSnapshot.ghosts?.[track.id] ?? null;
      const ghostCarStats =
        currentGhost === null
          ? playerStats
          : getCar(currentGhost.carId)?.baseStats;
      ghostDriverRef.current =
        ghostCarStats === undefined
          ? null
          : createGhostDriver({
              replay: currentGhost,
              stats: ghostCarStats,
            });
      timeTrialRecorderRef.current = createTimeTrialRecorder({
        trackId: track.id,
        trackVersion: track.version,
        carId: sessionCar.id,
        seed: raceSeed,
        onFinalize: (replay) => {
          const latest = loadSave();
          const latestSave =
            latest.kind === "loaded" ? latest.save : timeTrialSaveSnapshot;
          const current = latestSave.ghosts?.[track.id] ?? null;
          const best = applyTimeTrialResult(current, replay);
          if (best === null || best === current) return;
          const nextSave: SaveGame = {
            ...latestSave,
            ghosts: {
              ...(latestSave.ghosts ?? {}),
              [track.id]: best,
            },
          };
          const write = saveSave(nextSave);
          if (write.kind === "ok") {
            timeTrialSaveSnapshot = nextSave;
          }
        },
      });
    };

    pickupFeedbackRef.current = null;
    setPickupFeedback(null);
    sessionRef.current = createRaceSession(config);
    resetTimeTrialRuntime();
    // Re-arm the natural-finish guard on every fresh mount. The
    // restart callback below also flips it back so a second race
    // after a restart still routes once when it finishes.
    routedRef.current = false;

    const camera: Camera = {
      x: 0,
      y: CAMERA_HEIGHT,
      z: 0,
      depth: CAMERA_DEPTH,
    };
    let viewport = resizeCanvasBackingStore(canvas, ctx, graphics.pixelRatioCap);
    setTouchLayout(touchLayoutFor(viewport));
    let parallaxLayers = createTemperateParallaxLayers(viewport);

    // Refit the unit-square minimap polyline into the §20 layout box once
    // per track so the per-frame draw loop only pays for `projectCar`. The
    // compiled polyline is frozen and never changes during a session.
    let minimapBox = minimapBoxFor(viewport);
    let minimapPoints: readonly MinimapPoint[] = fitToBox(
      track.compiled.minimapPoints,
      minimapBox,
    ) as readonly MinimapPoint[];
    const totalSegments = track.compiled.totalCompiledSegments;
    const totalLength = track.compiled.totalLengthMeters;

    const resize = (): void => {
      viewport = resizeCanvasBackingStore(canvas, ctx, graphics.pixelRatioCap);
      setTouchLayout(touchLayoutFor(viewport));
      parallaxLayers = createTemperateParallaxLayers(viewport);
      minimapBox = minimapBoxFor(viewport);
      minimapPoints = fitToBox(
        track.compiled.minimapPoints,
        minimapBox,
      ) as readonly MinimapPoint[];
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    const inputManager = createInputManager({
      bindings: persistedKeyBindings,
      touchTarget: canvas,
    });
    const engineAudio = new ProceduralEngineRuntime({
      context: currentEngineAudioContext,
    });
    const raceSfx = new ProceduralSfxRuntime({
      context: currentSfxAudioContext,
    });
    const raceMusic = new MusicRuntime();
    const raceMusicCueForSession = raceMusicCue({
      trackId: track.id,
      tourId: tourContext?.tourId,
      mode: mode === "quickRace" || mode === "practice" ? "race" : mode,
    });
    let latestEngineInput: EngineRuntimeInput = {
      speed: 0,
      topSpeed: playerStats.topSpeed,
      audio: persistedSettings.audio,
    };
    let latestRaceMusicIntensity = raceMusicIntensity({
      speed: 0,
      topSpeed: playerStats.topSpeed,
    });
    let latestWeatherMusicStem = weatherMusicStem(weather);
    let tunnelState = OPEN_TUNNEL_STATE;
    let engineStartPending = false;
    let engineAudioTeardown = false;
    let lastEngineAudioUpdateMs = 0;
    let lastCountdownSfxStep: number | null = null;
    let lastRaceSfxTick: number | null = null;
    let cachedCollectedPickups: ReadonlyArray<string> | null = null;
    let cachedCollectedPickupSet: ReadonlySet<string> = new Set<string>();
    const tryStartEngineAudio = (): void => {
      if (engineAudioTeardown || engineStartPending || engineAudio.isRunning()) {
        return;
      }
      engineStartPending = true;
      void resumeAudioContext()
        .then(() => {
          if (engineAudioTeardown) return;
          engineAudio.start(latestEngineInput);
          raceMusic.play(
            raceMusicCueForSession,
            persistedSettings.audio,
            latestRaceMusicIntensity,
          );
          raceMusic.playWeatherStem(
            latestWeatherMusicStem,
            persistedSettings.audio,
          );
        })
        .finally(() => {
          engineStartPending = false;
        });
    };
    canvas.addEventListener("pointerdown", tryStartEngineAudio);
    window.addEventListener("keydown", tryStartEngineAudio);
    const unbindAudioVisibility = bindAudioVisibilitySuspension();
    let engineAudioBindingsActive = true;
    const unbindEngineAudio = (): void => {
      if (!engineAudioBindingsActive) return;
      engineAudioBindingsActive = false;
      canvas.removeEventListener("pointerdown", tryStartEngineAudio);
      window.removeEventListener("keydown", tryStartEngineAudio);
      unbindAudioVisibility();
    };
    const stopRaceRuntime = ({
      stopSfx = true,
    }: { stopSfx?: boolean } = {}): void => {
      clearFinishRouteTimeout();
      engineAudioTeardown = true;
      unbindEngineAudio();
      handleRef.current?.stop();
      engineAudio.stop();
      if (stopSfx) {
        raceSfx.stopAll();
      }
      raceMusic.stop();
      handleRef.current = null;
      sessionRef.current = null;
      inputManager.dispose();
    };

    // Wire the §20 pause-menu imperative actions. Each callback closes
    // over the local `config`, the persisted save, the input manager,
    // and the live loop / session refs so the hook layer can stay
    // decoupled from the page internals. Restart rebuilds the session
    // from the same config (countdown re-runs from scratch) and
    // resumes the loop. Retire flips the player to DNF and writes the
    // §20 results payload to the session-storage handoff before the
    // route hop. Exit-to-Title disposes the loop before navigating so
    // a torn-down rAF / audio handle cannot leak across the route hop.
    restartFnRef.current = (): void => {
      const handle = handleRef.current;
      if (!handle) return;
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      setRaceMoment(null);
      pickupFeedbackRef.current = null;
      setPickupFeedback(null);
      sessionRef.current = createRaceSession(config);
      resetTimeTrialRuntime();
      tunnelState = OPEN_TUNNEL_STATE;
      // Re-arm the natural-finish guard so the restarted race can
      // route on its own finish. Must precede `handle.resume()` so the
      // first render tick after resume sees the fresh `false` latch.
      routedRef.current = false;
      // Match the post-effect render snapshot to the fresh session so
      // the dl below re-renders the countdown immediately rather than
      // showing the racing phase momentarily until the next render
      // tick fires.
      setPhase((config.countdownSec ?? 3) > 0 ? "countdown" : "racing");
      setCountdownSecondsLeft(Math.ceil(config.countdownSec ?? 3));
      setResultMs(null);
      lastCountdownSfxStep = null;
      lastRaceSfxTick = null;
      setHudSnapshot({
        speed: 0,
        lap: 1,
        totalLaps: initialTotalLaps,
        position: 1,
      });
      handle.resume();
    };

    retireFnRef.current = (): void => {
      const session = sessionRef.current;
      if (!session) return;
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      setRaceMoment(null);
      pickupFeedbackRef.current = null;
      setPickupFeedback(null);
      const retired = retireRaceSession(session);
      sessionRef.current = retired;
      // Build the §20 results payload from the post-retire session
      // shape and write it to the session-storage handoff so the
      // results route renders the DNF row. Mirrors the natural-finish
      // wiring path from the §20 dot.
      const finalState = buildFinalRaceState({
        trackId: track.id,
        totalLaps: retired.race.totalLaps,
        cars: buildFinalCarInputsFromSession(retired),
      });
      const save =
        persisted.kind === "loaded" ? persisted.save : defaultSave();
      // `buildRaceResult` reads `track.id` and `track.difficulty` from
      // the Track shape; pass a minimal stand-in cast to `Track` so we
      // do not have to re-parse the bundled JSON just to satisfy the
      // shape. `difficulty` comes from the compiled output (mirrored
      // from the source Track at compile time) so the §23 reward lookup
      // resolves a real per-track base reward.
      const trackForResult = {
        id: track.id,
        difficulty: track.compiled.difficulty,
      } as Track;
      const result = buildRaceResult({
        finalState,
        save,
        track: trackForResult,
        playerCarId: PLAYER_ID,
        playerStartPosition: 1,
        damageBefore: damageDeltaFromState(initialPlayerDamage),
        damageAfter: damageDeltaFromState(retired.player.damage),
        recordPBs: false,
        championship: tourContext?.championship,
        tourId: tourContext?.tourId,
        currentTrackIndex: tourContext?.raceIndex,
        dailyChallenge,
        pickupCashEarned: retired.player.pickupCashEarned,
      });
      // F-034: credit the wallet (DNF cars receive the §12 participation
      // cash) and mirror the delta onto `RaceResult.creditsAwarded` so
      // the §20 results screen renders the actual wallet change.
      const recordsOnlyCommit = recordsOnlyMode
        ? commitTimeTrialRecords({ result, fallbackSave: save })
        : null;
      if (recordsOnlyCommit !== null) {
        timeTrialSaveSnapshot = recordsOnlyCommit.save;
      }
      const committed = recordsOnlyCommit
        ? recordsOnlyCommit.result
        : practiceMode
          ? { ...result, creditsAwarded: 0 }
          : commitRaceCredits({
              result,
              save,
              // §15 default per `SaveGameSettingsSchema`: a v1 save without
              // a `difficultyPreset` field reads as `'normal'`.
              difficulty: persistedDifficulty ?? "normal",
              baseTrackReward: baseRewardForTrackDifficulty(
                track.compiled.difficulty,
              ),
              damageAfter: retired.player.damage,
              activeCarId: save.garage.activeCarId,
              transformCommit:
                tourContext === null
                  ? undefined
                  : (nextSave, nextResult) =>
                      applyTourRaceResult({
                        save: nextSave,
                        result: nextResult,
                        championship: tourContext.championship,
                        playerCarId: save.garage.activeCarId,
                      }),
            });
      saveRaceResult(committed);
      // Flip the natural-finish guard so the render callback's finish
      // wiring cannot also fire on the next frame (the loop tear-down
      // below stops the rAF, but the latch is the explicit contract).
      routedRef.current = true;
      // Tear down the loop, input, and audio bindings before the route
      // hop so no event handler can restart engine audio in transition.
      stopRaceRuntime();
      router.push("/race/results");
    };

    exitFnRef.current = (): void => {
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      setRaceMoment(null);
      pickupFeedbackRef.current = null;
      setPickupFeedback(null);
      stopRaceRuntime();
      router.push("/");
    };

    settingsFnRef.current = (): void => {
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      setRaceMoment(null);
      pickupFeedbackRef.current = null;
      setPickupFeedback(null);
      stopRaceRuntime();
      router.push("/options");
    };

    ghostsFnRef.current = (): void => {
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      setRaceMoment(null);
      pickupFeedbackRef.current = null;
      setPickupFeedback(null);
      stopRaceRuntime();
      router.push("/time-trial");
    };

    handleRef.current = startLoop({
      simulate: (dt) => {
        const session = sessionRef.current;
        if (!session) return;
        const input = inputManager.sample();
        if (input.pause && !pauseInputHeldRef.current) {
          openPauseMenu();
        }
        pauseInputHeldRef.current = input.pause;
        lastSteerRef.current = input.steer;
        lastBrakeRef.current = input.brake;
        const next = stepRaceSession(session, input, config, dt);
        sessionRef.current = next;
        const playerSegment = segmentAt(track.compiled, next.player.car.z);
        tunnelState = stepTunnelState({
          state: tunnelState,
          dtMs: dt * 1000,
          inTunnel: playerSegment ? segmentIsTunnel(playerSegment) : false,
        });
        timeTrialRecorderRef.current?.observe({
          phase: next.race.phase,
          tick: next.tick,
          input,
        });
      },
      render: () => {
        const session = sessionRef.current;
        if (!session) return;
        camera.z = session.player.car.z;
        camera.x = session.player.car.x;
        latestEngineInput = {
          speed: session.player.car.speed,
          topSpeed: playerStats.topSpeed,
          audio: persistedSettings.audio,
        };
        latestRaceMusicIntensity = raceMusicIntensity({
          speed: session.player.car.speed,
          topSpeed: playerStats.topSpeed,
          nitroActive: session.player.nitro.activeRemainingSec > 0,
          finalLap: session.race.lap >= session.race.totalLaps,
        });
        const renderWeather = activeWeatherForState(session.weather);
        latestWeatherMusicStem = weatherMusicStem(renderWeather);
        const audioUpdateMs = performance.now();
        if (audioUpdateMs - lastEngineAudioUpdateMs >= 50) {
          lastEngineAudioUpdateMs = audioUpdateMs;
          engineAudio.update(latestEngineInput);
          raceMusic.update(persistedSettings.audio, latestRaceMusicIntensity);
          raceMusic.updateWeatherStem(
            latestWeatherMusicStem,
            persistedSettings.audio,
          );
        }
        if (lastRaceSfxTick !== session.tick) {
          lastRaceSfxTick = session.tick;
          playRaceSfxEvents(raceSfx, session.audioEvents, persistedSettings.audio);
          const pickupFeedbackFromTick = playerPickupFeedbackFromEvents(
            session.audioEvents,
            performance.now(),
          );
          if (pickupFeedbackFromTick !== null) {
            pickupFeedbackRef.current = pickupFeedbackFromTick;
            setPickupFeedback(pickupFeedbackFromTick);
          }
          const playerMoment = playerMomentFromEvents(
            session.audioEvents,
            session.race.totalLaps,
          );
          if (playerMoment !== null) {
            showRaceMoment(
              playerMoment,
              playerMoment.kind === "finish" ? 0 : LAP_MOMENT_MS,
            );
          }
        }
        const strips = project(track.compiled.segments, camera, viewport, {
          drawDistance: graphics.drawDistanceSegments,
        });
        setRoadProjection(roadProjectionSnapshot(strips));
        const pickupSprites = projectPickupSprites({
          strips,
          pickupsById: track.compiled.pickupsById,
          lap: session.race.lap,
          collectedPickups: collectedPickupSetForRender(),
        });
        setVisiblePickupCount(pickupSprites.length);
        setCollectedPickupCount(session.collectedPickups.length);
        setPlayerNitroActive(session.player.nitro.activeRemainingSec > 0);
        const pickupFeedbackAgeMs =
          pickupFeedbackRef.current === null
            ? Number.POSITIVE_INFINITY
            : performance.now() - pickupFeedbackRef.current.createdAtMs;
        const playerFrameIndex = playerCarFrameIndex(
          lastSteerRef.current,
          upcomingCurvature(track.compiled.segments, camera.z, SEGMENT_LENGTH * 5),
        );
        const aiCars = session.ai
          .map((entry, index) => {
            const aiSpriteSetId = aiSpriteSetIdForGridIndex(index);
            return projectOpponentCar({
              carX: entry.car.x,
              carZ: entry.car.z,
              camera,
              segments: track.compiled.segments,
              strips,
              viewport,
              trackLength: track.compiled.totalLengthMeters,
              atlas: aiCarAtlasesRef.current[aiSpriteSetId] ?? null,
              spriteSet: carSpriteSetForVisualProfile(aiSpriteSetId),
              fill: AI_FALLBACK_FILLS[index % AI_FALLBACK_FILLS.length],
              frameIndex: playerCarFrameIndex(
                0,
                upcomingCurvature(
                  track.compiled.segments,
                  entry.car.z,
                  SEGMENT_LENGTH * 5,
                ),
              ),
              braking: entry.state.targetSpeed < entry.car.speed - 1,
              nitroActive: entry.nitro.activeRemainingSec > 0,
              speedMetersPerSecond: entry.car.speed,
              damageTotal: entry.damage.total,
            });
          })
          .filter(
            (car): car is NonNullable<DrawRoadOptions["aiCars"]>[number] =>
              car !== null,
          );
        setAiVisibleCount(aiCars.length);
        setAiProjection(aiProjectionSnapshot(aiCars));
        if (
          ghostEnabled &&
          session.race.phase === "racing" &&
          ghostDriverRef.current !== null &&
          ghostOverlayTickRef.current !== session.tick
        ) {
          ghostOverlayRef.current = ghostDriverRef.current.tick({
            tick: session.tick,
            dt: FIXED_STEP_SECONDS,
            camera,
            viewport,
            segments: track.compiled.segments,
          });
          ghostOverlayTickRef.current = session.tick;
        } else if (!ghostEnabled || session.race.phase === "countdown") {
          ghostOverlayRef.current = null;
          ghostOverlayTickRef.current = null;
        }
        drawRoad(ctx, strips, viewport, {
          parallax: { layers: parallaxLayers, camera },
          weatherEffects: {
            weather: renderWeather,
            visualReduction: persistedAssists.weatherVisualReduction,
            particleIntensity:
              persistedSettings.accessibility?.weatherParticleIntensity,
            reducedGlare: persistedSettings.accessibility?.reducedWeatherGlare,
            highContrastRoadsideSigns:
              persistedSettings.accessibility?.highContrastRoadsideSigns,
            fogFloorClamp: persistedSettings.accessibility?.fogReadabilityClamp,
            flashReduction:
              persistedSettings.accessibility?.weatherFlashReduction,
          },
          heatShimmer:
            tourContext?.tourId === "ember-steppe"
              ? { enabled: true, phaseMeters: camera.z }
              : undefined,
          tunnelAdaptation: {
            intensityScale: tunnelOcclusion(tunnelState),
          },
          spriteDensityFactor: graphics.spriteDensityFactor,
          pickupSprites,
          pickupFeedback:
            pickupFeedbackRef.current !== null &&
            pickupFeedbackAgeMs < PICKUP_FEEDBACK_TTL_MS
              ? { kind: pickupFeedbackRef.current.kind, ageMs: pickupFeedbackAgeMs }
              : null,
          aiCars,
          ghostCar: ghostOverlayRef.current
            ? {
                ...ghostOverlayRef.current,
                atlas: carAtlasRef.current,
                spriteId: carSpriteSetRef.current.clean,
                frameIndex: playerFrameIndex,
              }
            : null,
          playerCar: {
            atlas: carAtlasRef.current,
            spriteSet: carSpriteSetRef.current,
            frameIndex: playerFrameIndex,
            weather: renderWeather,
            braking: lastBrakeRef.current > 0,
            nitroActive: session.player.nitro.activeRemainingSec > 0,
            speedMetersPerSecond: session.player.car.speed,
            damageTotal: session.player.damage.total,
          },
        });

        const cars: RankedCar[] = [
          {
            id: PLAYER_ID,
            totalProgress: totalProgress(
              session.player.car.z,
              session.race.lap,
              track.compiled.totalLengthMeters,
            ),
          },
          ...session.ai.map((entry, index) => {
            const aiLap =
              track.compiled.totalLengthMeters > 0
                ? Math.floor(entry.car.z / track.compiled.totalLengthMeters) + 1
                : 1;
            return {
              id: `ai-${index}`,
              totalProgress: totalProgress(
                entry.car.z,
                aiLap,
                track.compiled.totalLengthMeters,
              ),
            };
          }),
        ];

        const nitroUpgradeTier = nitroUpgradeTierForUpgrades(
          config.player.upgrades ?? null,
        );
        const projectedCashDelta = economyEnabled
          ? computeRaceReward({
              place: rankPosition(PLAYER_ID, cars),
              status: "finished",
              baseTrackReward: baseRewardForTrackDifficulty(
                track.compiled.difficulty,
              ),
              difficulty: persistedDifficulty ?? "normal",
            })
          : undefined;
        const hud = deriveHudState({
          race: session.race,
          playerSpeedMetersPerSecond: session.player.car.speed,
          playerId: PLAYER_ID,
          cars,
          speedUnit: persistedSettings.displaySpeedUnit,
          assistBadge: session.player.assistBadge ?? undefined,
          damage: session.player.damage,
          weather: renderWeather,
          weatherGripScalar: weatherGripScalarForState(
            playerStats,
            session.weather,
            config.playerTire ?? "dry",
          ),
          nitro: session.player.nitro,
          nitroMaxCharges:
            DEFAULT_NITRO_CHARGES + nitroUpgradeTier.chargesBonus,
          nitroChargeDurationSec: nitroDurationForTier(nitroUpgradeTier),
          transmission: session.player.transmission,
          cashDelta: projectedCashDelta,
        });
        drawHud(ctx, hud, viewport);

        // §20 minimap overlay. Per-car position derives from forward
        // distance (`car.z`) projected back to a `[segmentIndex, progress]`
        // pair; lateral `car.x` is intentionally not added here because
        // the polyline is a centerline footprint and `Math.abs(car.x)`
        // never exceeds `ROAD_WIDTH`, which is below one minimap pixel
        // at the §20 layout size. AI markers paint first; the player marker
        // draws on top thanks to the drawer's documented order.
        const minimapCars: MinimapCar[] = [];
        if (totalSegments > 0 && totalLength > 0) {
          minimapCars.push(
            toMinimapCar(minimapPoints, session.player.car.z, totalSegments, totalLength, true),
          );
          for (const entry of session.ai) {
            minimapCars.push(
              toMinimapCar(minimapPoints, entry.car.z, totalSegments, totalLength, false),
            );
          }
        }
        drawMinimap(ctx, minimapPoints, minimapCars, { box: minimapBox });

        // §20 splits / ghost-delta widget. Lap-timer derives from `elapsed`
        // (seconds since the green light), so the widget reads the same
        // monotonic clock as the rest of the sim. Baseline is the previous
        // completed lap on this session; first-lap delta stays null until a
        // baseline lap exists.
        const splits = deriveSplitsState(
          session.sectorTimer,
          Math.round(session.race.elapsed * 1000),
          session.baselineSplitsMs,
          FIXED_STEP_SECONDS,
        );
        drawSplitsWidget(ctx, splits, viewport);

        // React state updates run at most once per render-frame; we copy
        // the small numeric snapshots into hooks so the surrounding HTML
        // reflects countdown / phase changes for Playwright.
        setPhase(session.race.phase);
        if (session.race.phase === "countdown") {
          const countdownStep = Math.ceil(session.race.countdownRemainingSec);
          if (countdownStep !== lastCountdownSfxStep) {
            lastCountdownSfxStep = countdownStep;
            raceSfx.playCountdownTick({
              step: countdownStep,
              audio: persistedSettings.audio,
            });
          }
          setCountdownSecondsLeft(countdownStep);
        } else if (session.race.phase === "finished") {
          setResultMs(Math.round(session.race.elapsed * 1000));
          // Natural finish wiring per F-038. The render callback fires
          // every frame, so guard with `routedRef` to ensure
          // `saveRaceResult` and `router.push` each fire exactly once
          // per finish. The retire branch above flips the same latch
          // so a retire-then-natural-finish race never double-routes.
          // PB recording is true only when the player crossed the line
          // naturally; a §7 hard-time-limit DNF skips the records
          // patch (mirrors the retire branch's `recordPBs: false`).
          if (!routedRef.current) {
            routedRef.current = true;
            const finalState = buildFinalRaceState({
              trackId: track.id,
              totalLaps: session.race.totalLaps,
              cars: buildFinalCarInputsFromSession(session),
            });
            const save =
              persisted.kind === "loaded" ? persisted.save : defaultSave();
            // `buildRaceResult` reads `track.id` and `track.difficulty`
            // from the Track shape; the minimal cast avoids re-parsing
            // the bundled JSON at the natural-finish boundary.
            // `difficulty` is mirrored from the source Track on the
            // compiled output so the §23 reward lookup resolves a real
            // per-track base reward.
            const trackForResult = {
              id: track.id,
              difficulty: track.compiled.difficulty,
            } as Track;
            const result = buildRaceResult({
              finalState,
              save,
              track: trackForResult,
              playerCarId: PLAYER_ID,
              playerStartPosition: 1,
              damageBefore: damageDeltaFromState(initialPlayerDamage),
              damageAfter: damageDeltaFromState(session.player.damage),
              recordPBs:
                !practiceMode && session.player.status === "finished",
              championship: tourContext?.championship,
              tourId: tourContext?.tourId,
              currentTrackIndex: tourContext?.raceIndex,
              dailyChallenge,
              pickupCashEarned: session.player.pickupCashEarned,
            });
            // F-034: credit the wallet from the same numbers the
            // results screen will render. The `commitRaceCredits`
            // helper persists the merged save and mirrors the
            // wallet delta onto `RaceResult.creditsAwarded`.
            const recordsOnlyCommit = recordsOnlyMode
              ? commitTimeTrialRecords({ result, fallbackSave: save })
              : null;
            if (recordsOnlyCommit !== null) {
              timeTrialSaveSnapshot = recordsOnlyCommit.save;
            }
            const committed = recordsOnlyCommit
              ? recordsOnlyCommit.result
              : practiceMode
                ? { ...result, creditsAwarded: 0 }
                : commitRaceCredits({
                    result,
                    save,
                    // §15 default per `SaveGameSettingsSchema`: a v1 save
                    // without a `difficultyPreset` reads as `'normal'`.
                    difficulty: persistedDifficulty ?? "normal",
                    baseTrackReward: baseRewardForTrackDifficulty(
                      track.compiled.difficulty,
                    ),
                    damageAfter: session.player.damage,
                    activeCarId: save.garage.activeCarId,
                    transformCommit:
                      tourContext === null
                        ? undefined
                        : (nextSave, nextResult) =>
                            applyTourRaceResult({
                              save: nextSave,
                              result: nextResult,
                              championship: tourContext.championship,
                              playerCarId: save.garage.activeCarId,
                            }),
                  });
            saveRaceResult(committed);
            // Tear down the loop, input, engine, and music before the
            // route hop. Keep one-shot SFX alive during the hold so the
            // finish stinger can land with the moment.
            showRaceMoment(
              {
                kind: "finish",
                title: finishMomentTitle(rankPosition(PLAYER_ID, cars)),
                detail: `Total ${session.race.elapsed.toFixed(2)} s`,
              },
              0,
            );
            stopRaceRuntime({ stopSfx: false });
            finishRouteTimeoutRef.current = window.setTimeout(() => {
              finishRouteTimeoutRef.current = null;
              raceSfx.stopAll();
              router.push("/race/results");
            }, FINISH_MOMENT_MS);
          }
        } else if (lastCountdownSfxStep !== 0) {
          lastCountdownSfxStep = 0;
          raceSfx.playCountdownTick({
            step: 0,
            audio: persistedSettings.audio,
          });
        }
        setHudSnapshot({
          speed: hud.speed,
          lap: hud.lap,
          totalLaps: hud.totalLaps,
          position: hud.position,
        });
        setInputSnapshot({
          steer: lastSteerRef.current,
          touchActive: inputManager.hasTouch(),
        });
        if (practiceMode) {
          setPracticeSnapshot({
            weather: renderWeather,
            weatherGripPercent: Math.round(
              weatherGripScalarForState(
                playerStats,
                session.weather,
                config.playerTire ?? "dry",
              ) * 100,
            ),
            tire: config.playerTire ?? "dry",
            surface: session.player.car.surface,
            checkpointLabel: session.race.lastCheckpoint?.label ?? null,
            checkpointReady: session.race.lastCheckpoint !== null,
          });
        }
      },
    });

    function collectedPickupSetForRender(): ReadonlySet<string> {
      if (sessionRef.current === null) return cachedCollectedPickupSet;
      if (sessionRef.current.collectedPickups === cachedCollectedPickups) {
        return cachedCollectedPickupSet;
      }
      cachedCollectedPickups = sessionRef.current.collectedPickups;
      cachedCollectedPickupSet =
        cachedCollectedPickups.length === 0
          ? EMPTY_COLLECTED_PICKUP_SET
          : new Set(cachedCollectedPickups);
      return cachedCollectedPickupSet;
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      clearRaceMomentTimeout();
      clearFinishRouteTimeout();
      stopRaceRuntime();
    };
  }, [
    track,
    router,
    lapsOverride,
    initialTotalLaps,
    mode,
    tourContext,
    openPauseMenu,
    weather,
    playerTire,
    selectedCarId,
    dailyChallenge,
    ghostSource,
    showRaceMoment,
    clearRaceMomentTimeout,
    clearFinishRouteTimeout,
  ]);

  return (
    <main
      data-testid="race-canvas"
      data-track={track.id}
      data-mode={mode}
      style={shellStyle}
    >
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        data-testid="race-canvas-element"
        tabIndex={0}
        style={canvasStyle}
      />
      <TouchControls layout={touchLayout} />
      {raceMoment !== null ? (
        <div
          data-testid="race-moment"
          data-kind={raceMoment.kind}
          style={raceMomentStyle}
        >
          <strong style={raceMomentTitleStyle}>{raceMoment.title}</strong>
          <span style={raceMomentDetailStyle}>{raceMoment.detail}</span>
        </div>
      ) : null}
      <dl
        style={metricsStyle}
        data-testid="race-metrics"
        data-phase={phase}
      >
        <dt>Phase:</dt>
        <dd data-testid="race-phase">{phase}</dd>
        {phase === "countdown" ? (
          <>
            <dt>Countdown:</dt>
            <dd data-testid="race-countdown">{countdownSecondsLeft}</dd>
          </>
        ) : null}
        <dt>Speed (kph):</dt>
        <dd data-testid="hud-speed">{hudSnapshot.speed}</dd>
        <dt>Lap:</dt>
        <dd data-testid="hud-lap">
          {hudSnapshot.lap} / {hudSnapshot.totalLaps}
        </dd>
        <dt>Position:</dt>
        <dd data-testid="hud-position">{hudSnapshot.position}</dd>
        <dt>Field size:</dt>
        <dd data-testid="race-field-size">{fieldSize}</dd>
        <dt>Visible AI:</dt>
        <dd data-testid="race-visible-ai-count">{aiVisibleCount}</dd>
        <dt>Nearest AI depth:</dt>
        <dd data-testid="race-ai-nearest-depth">
          {aiProjection?.nearestDepthMeters.toFixed(2) ?? "none"}
        </dd>
        <dt>Nearest AI width:</dt>
        <dd data-testid="race-ai-nearest-width">
          {aiProjection?.nearestScreenW.toFixed(2) ?? "none"}
        </dd>
        <dt>Nearest AI x:</dt>
        <dd data-testid="race-ai-nearest-x">
          {aiProjection?.nearestScreenX.toFixed(2) ?? "none"}
        </dd>
        <dt>Nearest AI width-depth:</dt>
        <dd data-testid="race-ai-width-depth-product">
          {aiProjection?.nearestWidthDepthProduct.toFixed(2) ?? "none"}
        </dd>
        <dt>Road strips:</dt>
        <dd data-testid="race-road-visible-strips">
          {roadProjection?.visibleStrips ?? 0}
        </dd>
        <dt>Road near center:</dt>
        <dd data-testid="race-road-near-center-x">
          {roadProjection?.nearCenterX.toFixed(2) ?? "none"}
        </dd>
        <dt>Road near y:</dt>
        <dd data-testid="race-road-near-y">
          {roadProjection?.nearY.toFixed(2) ?? "none"}
        </dd>
        <dt>Road near width:</dt>
        <dd data-testid="race-road-near-half-width">
          {roadProjection?.nearHalfWidth.toFixed(2) ?? "none"}
        </dd>
        <dt>Road horizon y:</dt>
        <dd data-testid="race-road-horizon-y">
          {roadProjection?.horizonY.toFixed(2) ?? "none"}
        </dd>
        <dt>Visible pickups:</dt>
        <dd data-testid="race-visible-pickup-count">{visiblePickupCount}</dd>
        <dt>Collected pickups:</dt>
        <dd data-testid="race-collected-pickup-count">
          {collectedPickupCount}
        </dd>
        <dt>Nitro active:</dt>
        <dd data-testid="race-player-nitro-active">
          {playerNitroActive ? "yes" : "no"}
        </dd>
        <dt>Last pickup:</dt>
        <dd data-testid="race-last-pickup-kind">
          {pickupFeedback?.kind ?? "none"}
        </dd>
        <dt>Touch active:</dt>
        <dd data-testid="race-touch-active">
          {inputSnapshot.touchActive ? "yes" : "no"}
        </dd>
        <dt>Steer:</dt>
        <dd data-testid="race-last-steer">{inputSnapshot.steer.toFixed(3)}</dd>
      </dl>
      {phase === "finished" && resultMs !== null ? (
        <div data-testid="race-finished" style={resultStyle}>
          Race finished. Total time: {(resultMs / 1000).toFixed(2)} s
        </div>
      ) : null}
      {mode === "practice" && practiceSnapshot !== null ? (
        <section
          aria-label="Practice controls"
          data-testid="practice-panel"
          style={practicePanelStyle}
        >
          <div style={practiceToolbarStyle}>
            <button
              type="button"
              data-testid="practice-restart"
              style={practiceButtonStyle}
              onClick={onRestartImpl}
            >
              Restart
            </button>
            <button
              type="button"
              data-testid="practice-checkpoint-reset"
              style={practiceButtonStyle}
              onClick={onPracticeCheckpointReset}
              disabled={!practiceSnapshot.checkpointReady}
            >
              Checkpoint
            </button>
            <label style={practiceSelectLabelStyle}>
              Weather
              <select
                data-testid="practice-weather-select"
                value={practiceSnapshot.weather}
                onChange={(event) => {
                  const parsed = WeatherOptionSchema.safeParse(
                    event.currentTarget.value,
                  );
                  if (parsed.success) onPracticeWeatherChange(parsed.data);
                }}
                style={practiceSelectStyle}
              >
                {track.compiled.weatherOptions.map((option) => (
                  <option key={option} value={option}>
                    {weatherOptionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl style={practiceTelemetryStyle}>
            <dt>Grip</dt>
            <dd data-testid="practice-grip">
              {practiceSnapshot.weatherGripPercent}%
            </dd>
            <dt>Tire</dt>
            <dd data-testid="practice-tire">{practiceSnapshot.tire}</dd>
            <dt>Surface</dt>
            <dd data-testid="practice-surface">{practiceSnapshot.surface}</dd>
            <dt>Checkpoint</dt>
            <dd data-testid="practice-checkpoint">
              {practiceSnapshot.checkpointLabel ?? "none"}
            </dd>
          </dl>
        </section>
      ) : null}
      <PauseOverlay open={pause.open} {...pauseActions} />
    </main>
  );
}

const shellStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "hidden",
  padding: 0,
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  touchAction: "none",
  userSelect: "none",
};

const canvasStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  background: "#000",
  imageRendering: "pixelated",
  touchAction: "none",
};

const metricsStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const resultStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "8rem",
  transform: "translateX(-50%)",
  padding: "0.75rem 1rem",
  border: "1px solid var(--muted, #888)",
  borderRadius: "6px",
  background: "rgba(255,255,255,0.05)",
};

const raceMomentStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  display: "grid",
  justifyItems: "center",
  gap: "0.35rem",
  minWidth: "min(22rem, calc(100vw - 2rem))",
  padding: "0.9rem 1.15rem",
  border: "2px solid rgba(255, 238, 120, 0.92)",
  borderRadius: "6px",
  background: "rgba(8, 13, 24, 0.78)",
  color: "#fff6b0",
  textAlign: "center",
  textShadow: "0 2px 0 rgba(0, 0, 0, 0.8)",
  boxShadow: "0 0 0 3px rgba(0, 0, 0, 0.44)",
  pointerEvents: "none",
};

const raceMomentTitleStyle: CSSProperties = {
  fontSize: "3rem",
  lineHeight: 1,
  textTransform: "uppercase",
};

const raceMomentDetailStyle: CSSProperties = {
  fontSize: "1rem",
  color: "#ffffff",
};

const practicePanelStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "1rem",
  transform: "translateX(-50%)",
  display: "grid",
  gap: "0.5rem",
  minWidth: "min(42rem, calc(100vw - 2rem))",
  padding: "0.75rem",
  border: "1px solid rgba(160, 200, 255, 0.72)",
  borderRadius: "6px",
  background: "rgba(8, 14, 25, 0.86)",
  color: "#f4f7ff",
  pointerEvents: "auto",
};

const practiceToolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  alignItems: "center",
};

const practiceButtonStyle: CSSProperties = {
  minHeight: "2.25rem",
  padding: "0 0.75rem",
  border: "1px solid rgba(240, 245, 255, 0.7)",
  borderRadius: "4px",
  background: "rgba(245, 248, 255, 0.12)",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

const practiceSelectLabelStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
};

const practiceSelectStyle: CSSProperties = {
  minHeight: "2.25rem",
  border: "1px solid rgba(240, 245, 255, 0.7)",
  borderRadius: "4px",
  background: "#0e1727",
  color: "inherit",
  font: "inherit",
};

const practiceTelemetryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, auto)",
  gap: "0.25rem 0.75rem",
  margin: 0,
  fontSize: "0.86rem",
};
