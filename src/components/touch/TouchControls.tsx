"use client";

/**
 * Visual overlay for the touch input source (closes F-013).
 *
 * Renders a translucent SVG over the canvas: a left-side virtual stick
 * (anchor circle plus a knob that follows the most recent steer pointer),
 * a right-side accelerator and brake button, plus thumb-zone nitro and
 * pause buttons. Layout matches `DEFAULT_TOUCH_LAYOUT` in
 * `src/game/inputTouch.ts` so the overlay and the input source agree
 * out of the box.
 *
 * The component is purely cosmetic. It does not own any input state;
 * the underlying source is `createTouchInputSource` (or the touchTarget
 * option on `createInputManager`). The overlay subscribes to the same
 * pointer events only to draw the knob in its current position.
 *
 * Visibility gates on `pointer:coarse` so desktop users with a mouse
 * never see the overlay. The gate is opt-out via `forceVisible` for
 * tests and the dev page.
 *
 * Reduced-motion accessibility: when `reducedMotion` is true the knob
 * snap-tracks the finger (no CSS transition). The actual input value
 * is unchanged either way.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";

import { DEFAULT_TOUCH_LAYOUT, type TouchLayout } from "@/game/inputTouch";

export interface TouchControlsProps {
  /**
   * Layout used to size the overlay. Must match the layout the touch
   * input source uses (the source defaults to the same constant).
   */
  layout?: TouchLayout;
  /**
   * Force the overlay to render regardless of the `pointer:coarse`
   * media query. Used by tests and the dev page; production callers
   * should leave this unset.
   */
  forceVisible?: boolean;
  /**
   * When true the steer-knob does not animate to the current finger
   * position; it snaps. Mirrors the §19 reduced-motion accessibility
   * pref. Defaults to false.
   */
  reducedMotion?: boolean;
  /**
   * Optional className applied to the root `<svg>` for caller-side
   * positioning over the canvas.
   */
  className?: string;
  /**
   * Optional style merged into the root `<svg>`. The overlay defaults
   * to absolute positioning that fills its parent so a relative-position
   * race container is enough to anchor it correctly.
   */
  style?: CSSProperties;
}

interface KnobState {
  pointerId: number | null;
  x: number;
  y: number;
  originX: number;
  originY: number;
}

const NEUTRAL_KNOB: KnobState = {
  pointerId: null,
  x: 0,
  y: 0,
  originX: 0,
  originY: 0,
};

/**
 * Resolve `pointer:coarse` once on mount. SSR safe: returns `false`
 * when `window.matchMedia` is unavailable. We do not subscribe to
 * `change` because the form factor of the device does not change
 * mid-session in practice; the overlay's `forceVisible` escape hatch
 * is the supported override.
 */
function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    setCoarse(mql.matches);
    const handler = (ev: MediaQueryListEvent): void => setCoarse(ev.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    return undefined;
  }, []);
  return coarse;
}

export function TouchControls(props: TouchControlsProps): ReactElement | null {
  const layout = props.layout ?? DEFAULT_TOUCH_LAYOUT;
  const reducedMotion = props.reducedMotion ?? false;
  const coarse = usePointerCoarse();
  const visible = props.forceVisible || coarse;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [knob, setKnob] = useState<KnobState>(NEUTRAL_KNOB);

  // Subscribe to pointer events on the SVG so the knob can mirror the
  // underlying input source visually. The actual input is read by the
  // touch input source; this listener only drives the visual knob.
  useEffect(() => {
    if (!visible) return;
    const el = svgRef.current;
    if (!el) return;

    const onDown = (ev: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      // Only track steering pointers in the left zone for the knob.
      if (x >= layout.width * layout.steerZoneRatio) return;
      setKnob({ pointerId: ev.pointerId, originX: x, originY: y, x, y });
    };
    const onMove = (ev: PointerEvent): void => {
      setKnob((prev) => {
        if (prev.pointerId !== ev.pointerId) return prev;
        const rect = el.getBoundingClientRect();
        return { ...prev, x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      });
    };
    const onRelease = (ev: PointerEvent): void => {
      setKnob((prev) => (prev.pointerId === ev.pointerId ? NEUTRAL_KNOB : prev));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onRelease);
    el.addEventListener("pointercancel", onRelease);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onRelease);
      el.removeEventListener("pointercancel", onRelease);
    };
  }, [visible, layout.width, layout.steerZoneRatio]);

  const knobOffset = useMemo(() => {
    if (knob.pointerId === null) return { dx: 0, dy: 0 };
    const dx = clamp(knob.x - knob.originX, -layout.stickMaxRadius, layout.stickMaxRadius);
    return { dx, dy: 0 };
  }, [knob, layout.stickMaxRadius]);

  if (!visible) return null;

  const stickAnchorX = layout.width * 0.18;
  const stickAnchorY = layout.height * 0.7;
  const stickRadius = layout.stickMaxRadius;
  const knobX = knob.pointerId !== null ? knob.originX : stickAnchorX;
  const knobY = knob.pointerId !== null ? knob.originY : stickAnchorY;
  const knobDrawnX = knobX + knobOffset.dx;
  const knobDrawnY = knobY + knobOffset.dy;

  const accelX = layout.width - layout.width * 0.15;
  const accelY = layout.height * 0.4;
  const brakeX = accelX;
  const brakeY = layout.height - layout.height * 0.18;
  const nitroX = layout.width - layout.nitroCornerSize / 2;
  const nitroY = layout.nitroCornerSize / 2;
  const pauseX = layout.width - layout.nitroCornerSize - layout.pauseCornerSize / 2;
  const pauseY = layout.pauseCornerSize / 2;

  const transitionStyle: CSSProperties = reducedMotion
    ? {}
    : { transition: "cx 0.05s linear, cy 0.05s linear" };

  return (
    <svg
      ref={svgRef}
      data-testid="touch-controls"
      role="presentation"
      aria-hidden="true"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="none"
      className={props.className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        touchAction: "none",
        ...props.style,
      }}
    >
      {/* Stick anchor (the dimmer outer ring shows the rest position). */}
      <circle
        cx={stickAnchorX}
        cy={stickAnchorY}
        r={stickRadius}
        fill="rgba(255, 255, 255, 0.05)"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth={2}
      />
      {/* Knob (the brighter inner disc; tracks the dragged finger). */}
      <circle
        data-testid="touch-stick-knob"
        cx={knobDrawnX}
        cy={knobDrawnY}
        r={stickRadius * 0.45}
        fill="rgba(255, 255, 255, 0.35)"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth={2}
        style={transitionStyle}
      />
      {/* Accelerator. */}
      <g data-testid="touch-accelerate">
        <circle
          cx={accelX}
          cy={accelY}
          r={layout.width * 0.08}
          fill="rgba(80, 220, 120, 0.2)"
          stroke="rgba(80, 220, 120, 0.6)"
          strokeWidth={2}
        />
        <text
          x={accelX}
          y={accelY + 6}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={20}
          fill="rgba(255, 255, 255, 0.85)"
        >
          GAS
        </text>
      </g>
      {/* Brake. */}
      <g data-testid="touch-brake">
        <circle
          cx={brakeX}
          cy={brakeY}
          r={layout.width * 0.07}
          fill="rgba(220, 90, 90, 0.2)"
          stroke="rgba(220, 90, 90, 0.6)"
          strokeWidth={2}
        />
        <text
          x={brakeX}
          y={brakeY + 6}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={18}
          fill="rgba(255, 255, 255, 0.85)"
        >
          BRK
        </text>
      </g>
      {/* Nitro corner. */}
      <g data-testid="touch-nitro">
        <rect
          x={layout.width - layout.nitroCornerSize}
          y={0}
          width={layout.nitroCornerSize}
          height={layout.nitroCornerSize}
          fill="rgba(80, 140, 220, 0.15)"
          stroke="rgba(80, 140, 220, 0.5)"
          strokeWidth={2}
        />
        <text
          x={nitroX}
          y={nitroY + 6}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={18}
          fill="rgba(255, 255, 255, 0.85)"
        >
          NOS
        </text>
      </g>
      {/* Pause corner. */}
      <g data-testid="touch-pause">
        <rect
          x={layout.width - layout.nitroCornerSize - layout.pauseCornerSize}
          y={0}
          width={layout.pauseCornerSize}
          height={layout.pauseCornerSize}
          fill="rgba(200, 200, 200, 0.1)"
          stroke="rgba(200, 200, 200, 0.4)"
          strokeWidth={2}
        />
        <text
          x={pauseX}
          y={pauseY + 6}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={16}
          fill="rgba(255, 255, 255, 0.85)"
        >
          ||
        </text>
      </g>
    </svg>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
