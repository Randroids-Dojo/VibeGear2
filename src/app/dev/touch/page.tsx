"use client";

/**
 * Dev-only verification page for the touch input source and the
 * `<TouchControls />` overlay (closes part of F-017).
 *
 * Visit `/dev/touch` to verify that:
 * - The translucent overlay renders over the canvas (forced visible
 *   here so desktop users with a mouse can still exercise the layout).
 * - Tapping the accelerator zone advances `lastInput.throttle` to 1.
 * - Dragging the steer stick to the right advances `lastInput.steer`
 *   toward 1; dragging left advances toward -1.
 * - Tapping the brake / nitro / pause zones flips the corresponding
 *   `lastInput` field.
 *
 * The page mirrors the canvas-plus-metrics layout used by the existing
 * dev pages (`/dev/road`, `/dev/input`) and reuses `<TouchControls />`
 * with `forceVisible` so the mobile e2e spec (`e2e/touch-input.spec.ts`)
 * has a deterministic surface to drive without depending on the race
 * route having touch wired in production.
 *
 * The route is excluded from the title-screen menu and the title-screen
 * smoke test. It exists so the e2e harness can prove the touch source
 * end to end without standing up a full race.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";

import { TouchControls } from "@/components/touch/TouchControls";
import {
  createInputManager,
  NEUTRAL_INPUT,
  type Input,
  type InputManager,
} from "@/game/input";
import { DEFAULT_TOUCH_LAYOUT, type TouchLayout, type TouchTarget } from "@/game/inputTouch";
import { startLoop, type LoopHandle } from "@/game/loop";

const VIEWPORT_WIDTH = DEFAULT_TOUCH_LAYOUT.width;
const VIEWPORT_HEIGHT = DEFAULT_TOUCH_LAYOUT.height;

interface TouchDevMetrics extends Input {
  ticks: number;
  hasTouch: boolean;
}

const INITIAL: TouchDevMetrics = {
  ...NEUTRAL_INPUT,
  ticks: 0,
  hasTouch: false,
};

export default function TouchDevPage(): ReactElement {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const loopRef = useRef<LoopHandle | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const [metrics, setMetrics] = useState<TouchDevMetrics>(INITIAL);
  const [overlayLayout, setOverlayLayout] = useState<TouchLayout>(() => ({
    ...DEFAULT_TOUCH_LAYOUT,
  }));

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    // Use the live rect for both the input source's classification
    // zones and the overlay's viewBox so the visual hit targets and
    // the input source agree. On mobile viewports the surface is
    // scaled down (the 800-wide layout renders at the device's CSS
    // pixel width); locking both consumers to the rect keeps the
    // pause / nitro / GAS / BRK rectangles where the user sees them.
    const layoutSource = (): TouchLayout => {
      const rect = surface.getBoundingClientRect();
      return {
        ...DEFAULT_TOUCH_LAYOUT,
        width: rect.width > 0 ? rect.width : DEFAULT_TOUCH_LAYOUT.width,
        height: rect.height > 0 ? rect.height : DEFAULT_TOUCH_LAYOUT.height,
      };
    };

    // Mirror the live layout into React state so the overlay re-renders
    // with the same width/height the source classifies against.
    setOverlayLayout(layoutSource());

    const mgr = createInputManager({
      touchTarget: surface as unknown as TouchTarget,
      touchLayout: layoutSource,
    });
    inputRef.current = mgr;

    let ticks = 0;
    let lastSample: Input = { ...NEUTRAL_INPUT };
    let lastPushAt = 0;

    loopRef.current = startLoop({
      simulate: () => {
        lastSample = mgr.sample();
        ticks += 1;
      },
      render: () => {
        const now = performance.now();
        if (now - lastPushAt < 33) return;
        lastPushAt = now;
        setMetrics({
          ...lastSample,
          ticks,
          hasTouch: mgr.hasTouch(),
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
    <main style={pageStyle} data-testid="touch-dev-page">
      <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Touch input dev page</h1>
      <p style={{ margin: 0, color: "var(--muted, #aaa)", maxWidth: "32rem" }}>
        Drag the left-side stick to steer. Tap the right-side GAS / BRK
        circles for throttle and brake. The NOS corner toggles nitro;
        the pause corner triggers the pause flag. Touch + keyboard merge
        per the §19 rules.
      </p>
      <div
        ref={surfaceRef}
        data-testid="touch-surface"
        style={{
          position: "relative",
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          maxWidth: "100%",
          background: "#222",
          touchAction: "none",
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        <TouchControls layout={overlayLayout} forceVisible />
      </div>
      <dl style={metricsStyle}>
        <dt>Steer:</dt>
        <dd data-testid="touch-metric-steer">{metrics.steer.toFixed(3)}</dd>
        <dt>Throttle:</dt>
        <dd data-testid="touch-metric-throttle">{metrics.throttle.toFixed(3)}</dd>
        <dt>Brake:</dt>
        <dd data-testid="touch-metric-brake">{metrics.brake.toFixed(3)}</dd>
        <dt>Nitro:</dt>
        <dd data-testid="touch-metric-nitro">{metrics.nitro ? "1" : "0"}</dd>
        <dt>Pause:</dt>
        <dd data-testid="touch-metric-pause">{metrics.pause ? "1" : "0"}</dd>
        <dt>Active pointers:</dt>
        <dd data-testid="touch-metric-active">{metrics.hasTouch ? "yes" : "no"}</dd>
        <dt>Ticks:</dt>
        <dd data-testid="touch-metric-ticks">{metrics.ticks}</dd>
      </dl>
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: "1.5rem",
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "1rem",
};

const metricsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "0.25rem 2rem",
  maxWidth: "32rem",
  width: "100%",
  margin: 0,
};
