"use client";

/**
 * Dev-only verification page for the pseudo-3D road renderer.
 *
 * Visit /dev/road and watch a straight road animate outward as the camera
 * advances. Used for the manual visual check listed in the dot's Verify
 * section. Not linked from the main menu and excluded from the title-screen
 * smoke test.
 */

import { useEffect, useRef, useState } from "react";
import { PauseOverlay } from "@/components/pause/PauseOverlay";
import { usePauseToggle } from "@/components/pause/usePauseToggle";
import roadsideAtlasFixture from "@/data/atlas/roadside.json";
import { REGION_PALETTES, REGION_PALETTES_BY_ID } from "@/data/palettes";
import { AtlasMetaSchema } from "@/data/schemas";
import { startLoop, type LoopHandle } from "@/game/loop";
import { deriveHudState, type RankedCar } from "@/game/hudState";
import { createRaceState, type RaceState } from "@/game/raceState";
import { PaletteCache } from "@/render/paletteCache";
import { drawRoad } from "@/render/pseudoRoadCanvas";
import { loadAtlas, type LoadedAtlas } from "@/render/spriteAtlas";
import { drawHud } from "@/render/uiRenderer";
import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  SEGMENT_LENGTH,
  compileSegments,
  project,
  type Camera,
} from "@/road";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 480;

/** A 1.2 km straight test track. One authored segment, compiled to 200 strips. */
const TEST_TRACK = compileSegments([
  {
    len: 1200,
    curve: 0,
    grade: 0,
    roadsideLeft: "tree_pine",
    roadsideRight: "sign_marker",
    hazards: [],
  },
]);

/** Camera advance per fixed step. 60 m/s = ~216 kph at 60 Hz. */
const CAMERA_SPEED_M_PER_S = 60;

interface RoadDevMetrics {
  fps: number;
  cameraZ: number;
  visibleStrips: number;
}

const INITIAL: RoadDevMetrics = {
  fps: 0,
  cameraZ: 0,
  visibleStrips: 0,
};

export default function RoadDevPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<LoopHandle | null>(null);
  const paletteCacheRef = useRef(new PaletteCache<CanvasImageSource>(128));
  const [metrics, setMetrics] = useState<RoadDevMetrics>(INITIAL);
  const [paletteId, setPaletteId] = useState(REGION_PALETTES[0]?.id ?? "velvet-coast");
  const [roadsideAtlas, setRoadsideAtlas] = useState<LoadedAtlas | null>(null);
  const pause = usePauseToggle({ loop: () => handleRef.current });
  const selectedPalette =
    REGION_PALETTES_BY_ID[paletteId] ?? REGION_PALETTES[0] ?? null;

  useEffect(() => {
    let active = true;
    const meta = AtlasMetaSchema.parse(roadsideAtlasFixture);
    void loadAtlas(meta).then((atlas) => {
      if (active) setRoadsideAtlas(atlas);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paletteCacheRef.current.clear();

    const camera: Camera = {
      x: 0,
      y: CAMERA_HEIGHT,
      z: 0,
      depth: CAMERA_DEPTH,
    };
    const viewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };

    // Demo race state for the HUD overlay. The dev page is not a real
    // race, so we synthesise lap progress from camera.z and pretend a
    // single ghost AI is running 80 m ahead so the HUD shows P2/2.
    const raceState: RaceState = createRaceState(3);
    raceState.phase = "racing";
    const PLAYER_ID = "demo-player";
    const GHOST_ID = "demo-ghost";

    let fpsWindowStart = performance.now();
    let fpsWindowFrames = 0;
    let lastFps = 0;
    let lastVisible = 0;

    handleRef.current = startLoop({
      simulate: (dt) => {
        camera.z += CAMERA_SPEED_M_PER_S * dt;
        // Wrap to keep numbers small. The projector handles wrap internally
        // too, but bounded values keep the metrics readable.
        const totalLen = TEST_TRACK.totalLength;
        if (totalLen > 0 && camera.z > totalLen) {
          camera.z -= totalLen;
          if (raceState.lap < raceState.totalLaps) {
            raceState.lap += 1;
          }
        }
      },
      render: () => {
        const strips = project(TEST_TRACK.segments, camera, viewport);
        drawRoad(ctx, strips, viewport, {
          roadsideAtlas:
            roadsideAtlas && selectedPalette
              ? {
                  atlas: roadsideAtlas,
                  palette: selectedPalette,
                  cache: paletteCacheRef.current,
                }
              : null,
        });
        lastVisible = strips.reduce((acc, s) => (s.visible ? acc + 1 : acc), 0);

        // HUD overlay. Speed is the constant camera advance; total
        // progress combines lap number and z so the ghost stays one
        // car-length ahead even after a lap rollover.
        const totalLen = TEST_TRACK.totalLength;
        const playerProgress = (raceState.lap - 1) * totalLen + camera.z;
        const cars: RankedCar[] = [
          { id: PLAYER_ID, totalProgress: playerProgress },
          { id: GHOST_ID, totalProgress: playerProgress + 80 },
        ];
        const hud = deriveHudState({
          race: raceState,
          playerSpeedMetersPerSecond: CAMERA_SPEED_M_PER_S,
          playerId: PLAYER_ID,
          cars,
          speedUnit: "kph",
        });
        drawHud(ctx, hud, viewport);

        fpsWindowFrames += 1;
        const now = performance.now();
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 500) {
          lastFps = (fpsWindowFrames * 1000) / elapsed;
          fpsWindowStart = now;
          fpsWindowFrames = 0;
          setMetrics({
            fps: lastFps,
            cameraZ: camera.z,
            visibleStrips: lastVisible,
          });
        }
      },
    });

    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [roadsideAtlas, selectedPalette]);

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
      <h1>Pseudo-3D road dev page</h1>
      <p>
        A 1.2 km straight test track with a forward-moving camera. The
        alternating grass and rumble bands should appear to flow outward as
        speed advances. Track wraps automatically so the visual loops.
      </p>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        data-testid="road-canvas"
        style={{
          display: "block",
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          maxWidth: "100%",
          background: "#000",
          imageRendering: "pixelated",
        }}
      />
      <label
        style={{
          display: "grid",
          gap: "0.35rem",
          width: "min(18rem, 100%)",
          marginTop: "1rem",
        }}
      >
        <span>Region palette</span>
        <select
          value={paletteId}
          onChange={(event) => setPaletteId(event.target.value)}
          style={{ font: "inherit", padding: "0.35rem" }}
        >
          {REGION_PALETTES.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </label>
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
        <dd data-testid="road-fps">{metrics.fps.toFixed(1)}</dd>
        <dt>Camera Z (m):</dt>
        <dd data-testid="road-camera-z">{metrics.cameraZ.toFixed(1)}</dd>
        <dt>Visible strips:</dt>
        <dd data-testid="road-visible-strips">{metrics.visibleStrips}</dd>
        <dt>Step length (m):</dt>
        <dd>{SEGMENT_LENGTH}</dd>
      </dl>
      <p style={{ marginTop: "1rem", color: "var(--muted, #aaa)" }}>
        Press Escape to toggle the pause overlay. While paused the camera
        stops advancing but the canvas keeps repainting.
      </p>
      <PauseOverlay open={pause.open} onResume={pause.closeMenu} />
    </main>
  );
}
