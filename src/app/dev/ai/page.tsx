"use client";

/**
 * Dev-only verification page for the clean_line AI controller.
 *
 * Runs a simulated AI car alongside the player camera on the same
 * compiled track the road dev page uses. The AI consumes the §10
 * physics step each tick and the live `tickAI` output drives the next
 * physics step, so the panel below the canvas reflects real closed
 * loop behaviour. Visit /dev/ai and watch the AI accelerate to its
 * target on the straight, brake into the sweeper, and ride the inside
 * line of the curve. Used for the manual visual check listed in the
 * dot's Verify section.
 *
 * Not linked from the main menu and excluded from the title-screen
 * smoke test.
 */

import { useEffect, useRef, useState } from "react";
import { PauseOverlay } from "@/components/pause/PauseOverlay";
import { usePauseToggle } from "@/components/pause/usePauseToggle";
import {
  DEFAULT_AI_TRACK_CONTEXT,
  INITIAL_AI_STATE,
  tickAI,
  type AIState,
} from "@/game/ai";
import { startLoop, type LoopHandle } from "@/game/loop";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
  type CarState,
} from "@/game/physics";
import { createRaceState, type RaceState } from "@/game/raceState";
import type { AIDriver, CarBaseStats } from "@/data/schemas";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  compileSegments,
  project,
  type Camera,
} from "@/road";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;

/**
 * Mixed test track: 600 m straight, 600 m right-handed sweeper, 600 m
 * straight, 600 m left-handed sweeper. Lets us see the AI brake into
 * curves and slide back to the centerline on straights.
 */
const TEST_TRACK = compileSegments([
  { len: 600, curve: 0, grade: 0, roadsideLeft: "default", roadsideRight: "default", hazards: [] },
  { len: 600, curve: 0.5, grade: 0, roadsideLeft: "default", roadsideRight: "default", hazards: [] },
  { len: 600, curve: 0, grade: 0, roadsideLeft: "default", roadsideRight: "default", hazards: [] },
  { len: 600, curve: -0.5, grade: 0, roadsideLeft: "default", roadsideRight: "default", hazards: [] },
]);

/** Sparrow GT base stats. Mirrors `src/data/cars/sparrow-gt.json`. */
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

/** Single AI driver for the dev page. Mirrors `aiDriver.example.json`. */
const TEST_DRIVER: AIDriver = Object.freeze({
  id: "ai_cleanline_dev",
  displayName: "K. Vale",
  archetype: "clean_line",
  paceScalar: 1.0,
  mistakeRate: 0,
  aggression: 0.3,
  weatherSkill: { clear: 1, rain: 1, fog: 1, snow: 1 },
  nitroUsage: { launchBias: 0.5, straightBias: 0.5, panicBias: 0.1 },
});

interface AiDevMetrics {
  fps: number;
  aiSpeed: number;
  aiX: number;
  aiZ: number;
  targetSpeed: number;
  steer: number;
  throttle: number;
  brake: number;
}

const INITIAL_METRICS: AiDevMetrics = {
  fps: 0,
  aiSpeed: 0,
  aiX: 0,
  aiZ: 0,
  targetSpeed: 0,
  steer: 0,
  throttle: 0,
  brake: 0,
};

export default function AIDevPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<LoopHandle | null>(null);
  const [metrics, setMetrics] = useState<AiDevMetrics>(INITIAL_METRICS);
  const pause = usePauseToggle({ loop: () => handleRef.current });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const camera: Camera = {
      x: 0,
      y: CAMERA_HEIGHT,
      z: 0,
      depth: CAMERA_DEPTH,
    };
    const viewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };

    let aiCar: CarState = { ...INITIAL_CAR_STATE };
    let aiState: AIState = { ...INITIAL_AI_STATE };
    const playerCar: CarState = { ...INITIAL_CAR_STATE, z: -50 };

    const raceState: RaceState = createRaceState(3);
    raceState.phase = "racing";

    let fpsWindowStart = performance.now();
    let fpsWindowFrames = 0;
    let lastFps = 0;
    let lastInput: { steer: number; throttle: number; brake: number } = {
      steer: 0,
      throttle: 0,
      brake: 0,
    };

    handleRef.current = startLoop({
      simulate: (dt) => {
        const tick = tickAI(
          TEST_DRIVER,
          aiState,
          aiCar,
          { car: playerCar },
          TEST_TRACK,
          raceState,
          STARTER_STATS,
          DEFAULT_AI_TRACK_CONTEXT,
          dt,
        );
        aiState = tick.nextAiState;
        lastInput = {
          steer: tick.input.steer,
          throttle: tick.input.throttle,
          brake: tick.input.brake,
        };
        aiCar = step(aiCar, tick.input, STARTER_STATS, DEFAULT_TRACK_CONTEXT, dt);
        camera.z = aiCar.z;
        camera.x = aiCar.x;

        const totalLen = TEST_TRACK.totalLength;
        if (totalLen > 0 && aiCar.z > totalLen) {
          aiCar = { ...aiCar, z: aiCar.z - totalLen };
          camera.z = aiCar.z;
          if (raceState.lap < raceState.totalLaps) {
            raceState.lap += 1;
          }
        }
      },
      render: () => {
        const strips = project(TEST_TRACK.segments, camera, viewport);
        drawRoad(ctx, strips, viewport);

        fpsWindowFrames += 1;
        const now = performance.now();
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 500) {
          lastFps = (fpsWindowFrames * 1000) / elapsed;
          fpsWindowStart = now;
          fpsWindowFrames = 0;
          setMetrics({
            fps: lastFps,
            aiSpeed: aiCar.speed,
            aiX: aiCar.x,
            aiZ: aiCar.z,
            targetSpeed: aiState.targetSpeed,
            steer: lastInput.steer,
            throttle: lastInput.throttle,
            brake: lastInput.brake,
          });
        }
      },
    });

    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, []);

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        color: "var(--fg, #ddd)",
        background: "var(--bg, #111)",
        minHeight: "100vh",
      }}
    >
      <h1>Clean-line AI dev page</h1>
      <p>
        A single AI driver runs the §10 physics step on a mixed straight
        / sweeper / straight / sweeper test track. The camera follows
        the AI car. On the curve the AI should brake (target speed
        drops), bias toward the inside, and recover the centerline as
        the next straight begins. Press Escape to toggle pause.
      </p>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        data-testid="ai-canvas"
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
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "0.25rem 2rem",
          maxWidth: "32rem",
          marginTop: "1rem",
        }}
      >
        <dt>Render fps:</dt>
        <dd data-testid="ai-fps">{metrics.fps.toFixed(1)}</dd>
        <dt>AI speed (m/s):</dt>
        <dd data-testid="ai-speed">{metrics.aiSpeed.toFixed(2)}</dd>
        <dt>AI x (m):</dt>
        <dd data-testid="ai-x">{metrics.aiX.toFixed(2)}</dd>
        <dt>AI z (m):</dt>
        <dd data-testid="ai-z">{metrics.aiZ.toFixed(1)}</dd>
        <dt>Target speed (m/s):</dt>
        <dd data-testid="ai-target-speed">{metrics.targetSpeed.toFixed(2)}</dd>
        <dt>Steer:</dt>
        <dd data-testid="ai-steer">{metrics.steer.toFixed(3)}</dd>
        <dt>Throttle:</dt>
        <dd data-testid="ai-throttle">{metrics.throttle.toFixed(2)}</dd>
        <dt>Brake:</dt>
        <dd data-testid="ai-brake">{metrics.brake.toFixed(2)}</dd>
      </dl>
      <PauseOverlay open={pause.open} onResume={pause.closeMenu} />
    </main>
  );
}
