"use client";

/**
 * F-101 first-race HUD hint overlay. Renders a single hint banner
 * during a first-time player's first race. The race page passes the
 * pre-resolved hint text (or null) every render frame. The overlay
 * itself has no internal trigger logic; that lives in
 * `src/game/tutorialHints.ts` and is a pure function so tests pin
 * the entire predicate table without mounting React.
 *
 * Reduced motion: the banner is static. No fade, no transition.
 * Position fixed near the bottom-center of the canvas so it does
 * not occlude the speed gauge or the road horizon.
 */

import type { CSSProperties, ReactElement } from "react";

export interface TutorialHintOverlayProps {
  readonly text: string | null;
}

export function TutorialHintOverlay({
  text,
}: TutorialHintOverlayProps): ReactElement | null {
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="tutorial-hint-overlay"
      style={overlayStyle}
    >
      {text}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "11%",
  transform: "translateX(-50%)",
  padding: "0.55rem 1.1rem",
  background: "rgba(8, 12, 22, 0.78)",
  color: "#e7eaf3",
  border: "1px solid #2a2f3d",
  borderRadius: "999px",
  fontSize: "0.92rem",
  letterSpacing: "0.01em",
  fontWeight: 500,
  pointerEvents: "none",
  whiteSpace: "nowrap",
  zIndex: 10,
};
