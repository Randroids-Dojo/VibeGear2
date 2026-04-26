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
import { useSearchParams } from "next/navigation";

import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { PauseOverlay } from "@/components/pause/PauseOverlay";
import { usePauseToggle } from "@/components/pause/usePauseToggle";
import { TRACK_IDS, loadTrack } from "@/data";
import {
  createInputManager,
  createRaceSession,
  deriveHudState,
  deriveSplitsState,
  startLoop,
  stepRaceSession,
  totalProgress,
  type LoopHandle,
  type RaceSessionConfig,
  type RaceSessionState,
  type RankedCar,
} from "@/game";
import { FIXED_STEP_SECONDS } from "@/game/loop";
import type { AIDriver, CarBaseStats } from "@/data/schemas";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  SEGMENT_LENGTH,
  fitToBox,
  project,
  projectCar,
  type Camera,
  type CompiledTrack,
  type MinimapPoint,
  type Viewport,
} from "@/road";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import { drawMinimap, type MinimapCar } from "@/render/hudMinimap";
import { drawSplitsWidget } from "@/render/hudSplits";
import { drawHud } from "@/render/uiRenderer";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;
const DEFAULT_TRACK_ID = "test/curve";
const PLAYER_ID = "player";

/**
 * §20 minimap layout. The wireframe places the minimap in the bottom-left
 * grip cluster; we anchor a 120x120 box with a 16 px gutter from the
 * viewport edges so it sits clear of the speedometer and lap-timer.
 */
const MINIMAP_PADDING = 16;
const MINIMAP_SIZE = 120;
const MINIMAP_BOX = Object.freeze({
  x: MINIMAP_PADDING,
  y: VIEWPORT_HEIGHT - MINIMAP_PADDING - MINIMAP_SIZE,
  w: MINIMAP_SIZE,
  h: MINIMAP_SIZE,
});

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

/**
 * Demo AI driver. Single clean_line opponent per the dot stress-test §4.
 * Full grid spawning is owned by `implement-ai-grid-02d7e311`.
 */
const DEMO_DRIVER: AIDriver = Object.freeze({
  id: "ai_cleanline_demo",
  displayName: "K. Vale",
  archetype: "clean_line",
  paceScalar: 1.0,
  mistakeRate: 0,
  aggression: 0.3,
  weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
  nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
});

interface ResolvedTrack {
  id: string;
  compiled: CompiledTrack;
}

function resolveTrack(requestedId: string | null): ResolvedTrack {
  const id = requestedId && TRACK_IDS.includes(requestedId) ? requestedId : DEFAULT_TRACK_ID;
  return { id, compiled: loadTrack(id) };
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
  const track = useMemo(() => resolveTrack(requestedId), [requestedId]);
  return <RaceCanvas track={track} />;
}

interface RaceCanvasProps {
  track: ResolvedTrack;
}

function RaceCanvas({ track }: RaceCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<LoopHandle | null>(null);
  const sessionRef = useRef<RaceSessionState | null>(null);

  const [phase, setPhase] = useState<"countdown" | "racing" | "finished">(
    "countdown",
  );
  const [countdownSecondsLeft, setCountdownSecondsLeft] = useState<number>(3);
  const [hudSnapshot, setHudSnapshot] = useState<{
    speed: number;
    lap: number;
    totalLaps: number;
    position: number;
  }>(() => ({ speed: 0, lap: 1, totalLaps: track.compiled.laps, position: 1 }));
  const [resultMs, setResultMs] = useState<number | null>(null);

  const pause = usePauseToggle({ loop: () => handleRef.current });

  const onResume = useCallback(() => {
    pause.closeMenu();
  }, [pause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config: RaceSessionConfig = {
      track: track.compiled,
      player: { stats: STARTER_STATS },
      ai: [{ driver: DEMO_DRIVER, stats: STARTER_STATS }],
      seed: 1,
    };

    sessionRef.current = createRaceSession(config);

    const camera: Camera = {
      x: 0,
      y: CAMERA_HEIGHT,
      z: 0,
      depth: CAMERA_DEPTH,
    };
    const viewport: Viewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };

    // Refit the unit-square minimap polyline into the §20 layout box once
    // per track so the per-frame draw loop only pays for `projectCar`. The
    // compiled polyline is frozen and never changes during a session.
    const minimapPoints: readonly MinimapPoint[] = fitToBox(
      track.compiled.minimapPoints,
      MINIMAP_BOX,
    ) as readonly MinimapPoint[];
    const totalSegments = track.compiled.totalCompiledSegments;
    const totalLength = track.compiled.totalLengthMeters;

    const inputManager = createInputManager({});

    handleRef.current = startLoop({
      simulate: (dt) => {
        const session = sessionRef.current;
        if (!session) return;
        const input = inputManager.sample();
        const next = stepRaceSession(session, input, config, dt);
        sessionRef.current = next;
      },
      render: () => {
        const session = sessionRef.current;
        if (!session) return;
        camera.z = session.player.car.z;
        camera.x = session.player.car.x;

        const strips = project(track.compiled.segments, camera, viewport);
        drawRoad(ctx, strips, viewport);

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
        drawMinimap(ctx, minimapPoints, minimapCars, { box: MINIMAP_BOX });

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
        }
        setHudSnapshot({
          speed: hud.speed,
          lap: hud.lap,
          totalLaps: hud.totalLaps,
          position: hud.position,
        });
      },
    });

    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
      sessionRef.current = null;
      inputManager.dispose();
    };
  }, [track]);

  return (
    <main data-testid="race-canvas" data-track={track.id} style={shellStyle}>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        data-testid="race-canvas-element"
        tabIndex={0}
        style={{
          display: "block",
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          maxWidth: "100%",
          background: "#000",
          imageRendering: "pixelated",
        }}
      />
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
      </dl>
      {phase === "finished" && resultMs !== null ? (
        <div data-testid="race-finished" style={resultStyle}>
          Race finished. Total time: {(resultMs / 1000).toFixed(2)} s
        </div>
      ) : null}
      <PauseOverlay open={pause.open} onResume={onResume} />
    </main>
  );
}

const shellStyle: CSSProperties = {
  padding: "1.5rem",
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
};

const metricsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "0.25rem 2rem",
  maxWidth: "32rem",
  width: "100%",
};

const resultStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  border: "1px solid var(--muted, #888)",
  borderRadius: "6px",
  background: "rgba(255,255,255,0.05)",
};
