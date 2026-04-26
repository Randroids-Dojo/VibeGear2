"use client";

/**
 * Dev-only verification page for the arcade physics step.
 *
 * Visit `/dev/physics` and drive a car along a straight road. Verify:
 *
 * - Throttle (Up / W) accelerates; release coasts down via drag.
 * - Brake (Down / S) decelerates and never inverts past zero.
 * - Steer (Left/Right or A/D) shifts lateral position; faster speed
 *   produces less per-frame yaw.
 * - Driving past the rumble strip onto grass triggers the off-road cap
 *   and extra drag (speed pegs at OFF_ROAD_CAP_M_PER_S).
 *
 * The page reuses the pseudo-3D road renderer and the deterministic
 * input layer so the same code paths the real race uses are exercised.
 */

import { useEffect, useRef, useState } from "react";

import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  ROAD_WIDTH,
  compileSegments,
  project,
  type Camera,
} from "@/road";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  NEUTRAL_INPUT,
  OFF_ROAD_CAP_M_PER_S,
  createInputManager,
  startLoop,
  step,
  type CarState,
  type Input,
  type InputManager,
  type LoopHandle,
} from "@/game";
import { CARS_BY_ID, STARTER_CAR_ID } from "@/data/cars";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;

/** A long straight test track so the camera does not fall off the end. */
const TEST_TRACK = compileSegments([
  {
    len: 12000,
    curve: 0,
    grade: 0,
    roadsideLeft: "default",
    roadsideRight: "default",
    hazards: [],
  },
]);

const STARTER_CAR = CARS_BY_ID.get(STARTER_CAR_ID);
if (!STARTER_CAR) {
  throw new Error(`physics dev page: starter car '${STARTER_CAR_ID}' not in registry`);
}
const STARTER_STATS = STARTER_CAR.baseStats;

interface PhysicsDevMetrics {
  speed: number;
  x: number;
  z: number;
  throttle: number;
  brake: number;
  steer: number;
  offRoad: boolean;
  fps: number;
}

const INITIAL: PhysicsDevMetrics = {
  speed: 0,
  x: 0,
  z: 0,
  throttle: 0,
  brake: 0,
  steer: 0,
  offRoad: false,
  fps: 0,
};

export default function PhysicsDevPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<LoopHandle | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const [metrics, setMetrics] = useState<PhysicsDevMetrics>(INITIAL);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mgr = createInputManager();
    inputRef.current = mgr;
    if (typeof window !== "undefined") window.focus();

    let car: CarState = { ...INITIAL_CAR_STATE };
    let lastInput: Input = { ...NEUTRAL_INPUT };

    const camera: Camera = {
      x: 0,
      y: CAMERA_HEIGHT,
      z: 0,
      depth: CAMERA_DEPTH,
    };
    const viewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };

    let fpsWindowStart = performance.now();
    let fpsWindowFrames = 0;
    let lastFps = 0;
    let lastPushAt = 0;

    loopRef.current = startLoop({
      simulate: (dt) => {
        lastInput = mgr.sample();
        car = step(car, lastInput, STARTER_STATS, DEFAULT_TRACK_CONTEXT, dt);
        // Camera trails the car directly. Lateral smoothing lives in the
        // render layer (future slice); for the dev page we copy 1:1.
        camera.x = car.x;
        camera.z = car.z;
        const totalLen = TEST_TRACK.totalLength;
        if (totalLen > 0 && camera.z > totalLen) {
          camera.z -= totalLen;
          car.z -= totalLen;
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
        }
        if (now - lastPushAt < 100) return;
        lastPushAt = now;
        setMetrics({
          speed: car.speed,
          x: car.x,
          z: car.z,
          throttle: lastInput.throttle,
          brake: lastInput.brake,
          steer: lastInput.steer,
          offRoad: Math.abs(car.x) > ROAD_WIDTH,
          fps: lastFps,
        });
      },
    });

    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
      inputRef.current?.dispose();
      inputRef.current = null;
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
      <h1>Physics dev page</h1>
      <p>
        Drive the starter car along a 12 km straight. Up / W accelerates,
        Down / S brakes, Left / Right (or A / D) steer. Cross the rumble
        onto the grass to see the off-road cap kick in (capped at{" "}
        {OFF_ROAD_CAP_M_PER_S} m/s).
      </p>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        data-testid="physics-canvas"
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
        <dt>Speed (m/s):</dt>
        <dd data-testid="physics-speed">{metrics.speed.toFixed(2)}</dd>
        <dt>Speed (km/h):</dt>
        <dd data-testid="physics-speed-kph">{(metrics.speed * 3.6).toFixed(1)}</dd>
        <dt>Lateral x (m):</dt>
        <dd data-testid="physics-x">{metrics.x.toFixed(2)}</dd>
        <dt>Forward z (m):</dt>
        <dd data-testid="physics-z">{metrics.z.toFixed(1)}</dd>
        <dt>Off-road:</dt>
        <dd data-testid="physics-offroad">{metrics.offRoad ? "yes" : "no"}</dd>
        <dt>Throttle:</dt>
        <dd data-testid="physics-throttle">{metrics.throttle.toFixed(2)}</dd>
        <dt>Brake:</dt>
        <dd data-testid="physics-brake">{metrics.brake.toFixed(2)}</dd>
        <dt>Steer:</dt>
        <dd data-testid="physics-steer">{metrics.steer.toFixed(2)}</dd>
        <dt>Render fps:</dt>
        <dd data-testid="physics-fps">{metrics.fps.toFixed(1)}</dd>
      </dl>
    </main>
  );
}
