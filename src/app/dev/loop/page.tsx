"use client";

/**
 * Dev-only verification page for the fixed-step simulation loop.
 *
 * Visit /dev/loop and watch the counters. Backgrounding the tab for a few
 * seconds and returning should not stall the page; the accumulator cap
 * prevents the spiral of death.
 *
 * This page is excluded from the title-screen smoke test and is not linked
 * from the main menu. It exists for manual visual verification per the
 * dot's Verify checklist.
 */

import { useEffect, useRef, useState } from "react";
import { startLoop, type LoopHandle } from "@/game/loop";

interface LoopMetrics {
  simTicks: number;
  renderFrames: number;
  fps: number;
  lastAlpha: number;
}

const INITIAL: LoopMetrics = {
  simTicks: 0,
  renderFrames: 0,
  fps: 0,
  lastAlpha: 0,
};

export default function LoopDevPage() {
  const [metrics, setMetrics] = useState<LoopMetrics>(INITIAL);
  const handleRef = useRef<LoopHandle | null>(null);

  useEffect(() => {
    let simTicks = 0;
    let renderFrames = 0;
    let lastAlpha = 0;

    let fpsWindowStart = performance.now();
    let fpsWindowFrames = 0;
    let fps = 0;

    handleRef.current = startLoop({
      simulate: () => {
        simTicks += 1;
      },
      render: (alpha) => {
        renderFrames += 1;
        fpsWindowFrames += 1;
        lastAlpha = alpha;

        const now = performance.now();
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 500) {
          fps = (fpsWindowFrames * 1000) / elapsed;
          fpsWindowStart = now;
          fpsWindowFrames = 0;
          setMetrics({
            simTicks,
            renderFrames,
            fps,
            lastAlpha,
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
      <h1>Fixed-step loop dev page</h1>
      <p>
        The simulation runs at 60 Hz inside a requestAnimationFrame loop.
        Background this tab for several seconds and return to confirm the
        accumulator cap prevents stalling.
      </p>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "0.25rem 2rem",
          maxWidth: "32rem",
        }}
      >
        <dt>Render fps:</dt>
        <dd data-testid="loop-fps">{metrics.fps.toFixed(1)}</dd>
        <dt>Sim ticks total:</dt>
        <dd data-testid="loop-sim-ticks">{metrics.simTicks}</dd>
        <dt>Render frames total:</dt>
        <dd data-testid="loop-render-frames">{metrics.renderFrames}</dd>
        <dt>Last render alpha:</dt>
        <dd data-testid="loop-alpha">{metrics.lastAlpha.toFixed(4)}</dd>
      </dl>
    </main>
  );
}
