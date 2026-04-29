"use client";

import { useEffect, useRef } from "react";

import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  project,
  type Camera,
  type CompiledTrack,
  type Viewport,
} from "@/road";
import { drawRoad, type DrawRoadOptions } from "@/render/pseudoRoadCanvas";

export interface RoadCanvasProps {
  readonly compiled: CompiledTrack;
  readonly cameraZ?: number;
  readonly cameraX?: number;
  readonly viewport?: Viewport;
  readonly drawOptions?: Omit<DrawRoadOptions, "markingCameraZ">;
  readonly testId?: string;
}

const DEFAULT_VIEWPORT: Viewport = Object.freeze({ width: 800, height: 480 });

export function RoadCanvas({
  compiled,
  cameraZ = 0,
  cameraX = 0,
  viewport = DEFAULT_VIEWPORT,
  drawOptions,
  testId = "road-canvas",
}: RoadCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const camera: Camera = {
      x: cameraX,
      y: CAMERA_HEIGHT,
      z: cameraZ,
      depth: CAMERA_DEPTH,
    };
    const strips = project(compiled.segments, camera, viewport);
    drawRoad(ctx, strips, viewport, {
      ...drawOptions,
      markingCameraZ: cameraZ,
    });
  }, [cameraX, cameraZ, compiled, drawOptions, viewport]);

  return (
    <canvas
      ref={canvasRef}
      width={viewport.width}
      height={viewport.height}
      data-testid={testId}
      style={{
        width: "100%",
        aspectRatio: `${viewport.width} / ${viewport.height}`,
        maxHeight: "60vh",
        display: "block",
        background: "#000",
        imageRendering: "pixelated",
      }}
    />
  );
}
