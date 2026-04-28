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
  HAZARDS_BY_ID,
  TRACK_IDS,
  TRACK_RAW,
  getAIDriver,
  getChampionship,
  loadTrack,
} from "@/data";
import carsAtlasFixture from "@/data/atlas/cars.json";
import { AtlasMetaSchema, TrackSchema, type Track } from "@/data/schemas";
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
  retireRaceSession,
  spawnGrid,
  startLoop,
  stepRaceSession,
  totalProgress,
  type LoopHandle,
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
  WeatherOptionSchema,
  type AIDriver,
  type CarBaseStats,
} from "@/data/schemas";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  SEGMENT_LENGTH,
  fitToBox,
  project,
  projectCar,
  upcomingCurvature,
  type Camera,
  type CompiledTrack,
  type MinimapPoint,
  type Viewport,
} from "@/road";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import { playerCarFrameIndex } from "@/render/carFrame";
import { loadAtlas, type LoadedAtlas } from "@/render/spriteAtlas";
import { drawMinimap, type MinimapCar } from "@/render/hudMinimap";
import type { ParallaxLayer } from "@/render/parallax";
import { drawSplitsWidget } from "@/render/hudSplits";
import { drawHud } from "@/render/uiRenderer";
import { defaultSave, loadSave, saveSave } from "@/persistence/save";
import { awardCredits, baseRewardForTrackDifficulty } from "@/game/economy";
import type { SaveGame } from "@/data/schemas";
import type { RaceResult } from "@/game/raceResult";
import { PRISTINE_DAMAGE_STATE, type DamageState } from "@/game/damage";
import type { TireKind } from "@/game/weather";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;
const DEFAULT_TRACK_ID = "test/elevation";
const TOUR_PLACEHOLDER_TRACK_ID = "test/straight";
const WORLD_TOUR_CHAMPIONSHIP_ID = "world-tour-standard";
const PLAYER_ID = "player";
const CARS_ATLAS_META = AtlasMetaSchema.parse(carsAtlasFixture);

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
): Viewport {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || VIEWPORT_WIDTH));
  const height = Math.max(1, Math.round(rect.height || VIEWPORT_HEIGHT));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

type RaceMode = "race" | "timeTrial";

function resolveRaceMode(raw: string | null): RaceMode {
  return raw === "timeTrial" ? "timeTrial" : "race";
}

function resolveRaceWeather(
  raw: string | null,
  track: ResolvedTrack,
): RaceSessionConfig["weather"] {
  const parsed = WeatherOptionSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return track.compiled.weatherOptions.includes(parsed.data) ? parsed.data : undefined;
}

function resolvePlayerTire(raw: string | null): TireKind | undefined {
  return raw === "wet" || raw === "dry" ? raw : undefined;
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
  const playerTire = useMemo(() => resolvePlayerTire(tireRaw), [tireRaw]);
  return (
    <RaceCanvas
      track={track}
      lapsOverride={lapsOverride}
      mode={mode}
      tourContext={tourContext}
      weather={weather}
      playerTire={playerTire}
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
}

function RaceCanvas({
  track,
  lapsOverride,
  mode,
  tourContext,
  weather,
  playerTire,
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
  const pauseInputHeldRef = useRef<boolean>(false);
  const carAtlasRef = useRef<LoadedAtlas | null>(null);
  // Imperative pause-menu effects, populated inside the loop effect
  // below so the hook layer can stay decoupled from the loop / session
  // / config refs. The hook reads these getters once per click; mid-
  // race ref swaps are not expected (the page is mounted once per race).
  const restartFnRef = useRef<(() => void) | null>(null);
  const retireFnRef = useRef<(() => void) | null>(null);
  const exitFnRef = useRef<(() => void) | null>(null);
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
  const [fieldSize, setFieldSize] = useState<number>(1);
  const [touchLayout, setTouchLayout] = useState<TouchLayout>(() =>
    touchLayoutFor({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }),
  );
  const [resultMs, setResultMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void loadAtlas(CARS_ATLAS_META).then((atlas) => {
      if (active) carAtlasRef.current = atlas;
    });
    return () => {
      active = false;
    };
  }, []);

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

  const pauseActions = usePauseActions({
    closeMenu: pause.closeMenu,
    onRestartImpl: phase === "finished" ? null : onRestartImpl,
    onRetireImpl: phase === "finished" ? null : onRetireImpl,
    onExitToTitleImpl,
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
    const persistedKeyBindings = readKeyBindings(sessionSave);
    const timeTrialEnabled = mode === "timeTrial";
    const initialPlayerDamage = timeTrialEnabled
      ? PRISTINE_DAMAGE_STATE
      : pendingDamageForActiveCar(sessionSave);
    const raceSeed = 1;
    let timeTrialSaveSnapshot = sessionSave;
    const spawnedAi = timeTrialEnabled
      ? []
      : spawnGrid({
          trackSpawn: track.compiled.spawn,
          laneCount: track.compiled.laneCount,
          aiDrivers: resolveRaceAIDrivers(tourContext).map((driver) => ({
            driver,
            stats: STARTER_STATS,
          })),
          seed: raceSeed,
        });

    const config: RaceSessionConfig = {
      track: track.compiled,
      player: {
        stats: STARTER_STATS,
        assists: persistedAssists,
        difficultyPreset: persistedDifficulty,
        initialDamage: initialPlayerDamage,
      },
      ai: spawnedAi,
      hazardsById: HAZARDS_BY_ID,
      seed: raceSeed,
      ...(weather ? { weather } : {}),
      ...(playerTire ? { playerTire } : {}),
      ...(lapsOverride !== null ? { totalLaps: lapsOverride } : {}),
    };
    setFieldSize(1 + config.ai.length);
    const activeWeather = config.weather ?? track.compiled.weatherOptions[0] ?? "clear";

    const resetTimeTrialRuntime = (): void => {
      ghostOverlayRef.current = null;
      ghostOverlayTickRef.current = null;
      if (!timeTrialEnabled) {
        ghostDriverRef.current = null;
        timeTrialRecorderRef.current = null;
        return;
      }
      const currentGhost = timeTrialSaveSnapshot.ghosts?.[track.id] ?? null;
      ghostDriverRef.current = createGhostDriver({
        replay: currentGhost,
        stats: STARTER_STATS,
      });
      timeTrialRecorderRef.current = createTimeTrialRecorder({
        trackId: track.id,
        trackVersion: track.version,
        carId: timeTrialSaveSnapshot.garage.activeCarId,
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
    let viewport = resizeCanvasBackingStore(canvas, ctx);
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
      viewport = resizeCanvasBackingStore(canvas, ctx);
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
      sessionRef.current = createRaceSession(config);
      resetTimeTrialRuntime();
      // Re-arm the natural-finish guard so the restarted race can
      // route on its own finish. Must precede `handle.resume()` so the
      // first render tick after resume sees the fresh `false` latch.
      routedRef.current = false;
      // Match the post-effect render snapshot to the fresh session so
      // the dl below re-renders the countdown immediately rather than
      // showing the racing phase momentarily until the next render
      // tick fires.
      setPhase("countdown");
      setCountdownSecondsLeft(Math.ceil(config.countdownSec ?? 3));
      setResultMs(null);
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
      });
      // F-034: credit the wallet (DNF cars receive the §12 participation
      // cash) and mirror the delta onto `RaceResult.creditsAwarded` so
      // the §20 results screen renders the actual wallet change.
      const committed = timeTrialEnabled
        ? { ...result, creditsAwarded: 0 }
        : commitRaceCredits({
            result,
            save,
            // §15 default per `SaveGameSettingsSchema`: a v1 save without
            // a `difficultyPreset` field reads as `'normal'`.
            difficulty: persistedDifficulty ?? "normal",
            baseTrackReward: baseRewardForTrackDifficulty(track.compiled.difficulty),
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
      // Tear down the loop / input before the route hop so the rAF
      // handle and the keydown listener cannot outlive the page.
      handleRef.current?.stop();
      handleRef.current = null;
      sessionRef.current = null;
      inputManager.dispose();
      router.push("/race/results");
    };

    exitFnRef.current = (): void => {
      handleRef.current?.stop();
      handleRef.current = null;
      sessionRef.current = null;
      inputManager.dispose();
      router.push("/");
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
        const next = stepRaceSession(session, input, config, dt);
        sessionRef.current = next;
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

        const strips = project(track.compiled.segments, camera, viewport);
        const playerFrameIndex = playerCarFrameIndex(
          lastSteerRef.current,
          upcomingCurvature(track.compiled.segments, camera.z, SEGMENT_LENGTH * 5),
        );
        if (
          timeTrialEnabled &&
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
        } else if (!timeTrialEnabled || session.race.phase === "countdown") {
          ghostOverlayRef.current = null;
          ghostOverlayTickRef.current = null;
        }
        drawRoad(ctx, strips, viewport, {
          parallax: { layers: parallaxLayers, camera },
          weatherEffects: {
            weather: activeWeather,
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
          ghostCar: ghostOverlayRef.current
            ? {
                ...ghostOverlayRef.current,
                atlas: carAtlasRef.current,
                frameIndex: playerFrameIndex,
              }
            : null,
          playerCar: {
            atlas: carAtlasRef.current,
            frameIndex: playerFrameIndex,
            weather: activeWeather,
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

        const hud = deriveHudState({
          race: session.race,
          playerSpeedMetersPerSecond: session.player.car.speed,
          playerId: PLAYER_ID,
          cars,
          speedUnit: "kph",
          assistBadge: session.player.assistBadge ?? undefined,
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
          setCountdownSecondsLeft(Math.ceil(session.race.countdownRemainingSec));
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
              recordPBs: session.player.status === "finished",
              championship: tourContext?.championship,
              tourId: tourContext?.tourId,
              currentTrackIndex: tourContext?.raceIndex,
            });
            // F-034: credit the wallet from the same numbers the
            // results screen will render. The `commitRaceCredits`
            // helper persists the merged save and mirrors the
            // wallet delta onto `RaceResult.creditsAwarded`.
            const committed = timeTrialEnabled
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
            // Tear down the loop / input before the route hop so the
            // rAF handle and the keydown listener cannot outlive the
            // page. Mirrors the retire branch tear-down ordering.
            handleRef.current?.stop();
            handleRef.current = null;
            sessionRef.current = null;
            inputManager.dispose();
            router.push("/race/results");
          }
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
      },
    });

    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      handleRef.current?.stop();
      handleRef.current = null;
      sessionRef.current = null;
      inputManager.dispose();
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
  padding: "0.75rem 1rem",
  border: "1px solid var(--muted, #888)",
  borderRadius: "6px",
  background: "rgba(255,255,255,0.05)",
};
