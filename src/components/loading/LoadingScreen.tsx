"use client";

/**
 * Loading screen presentation.
 *
 * Source of truth for the layout: `docs/gdd/20-hud-and-ui-ux.md`. The
 * loading screen is the home for accessibility prefs that should be applied
 * before any animation starts: `reducedMotion` disables the bar transition
 * and `colorBlindMode` (a future slice) swaps the palette before the first
 * sprite paints.
 *
 * Pure presentation. The state machine lives in `./loadingState.ts` so
 * this component can be exercised with synthesised snapshots without
 * mounting a fetcher.
 */

import type { CSSProperties, ReactElement } from "react";

import {
  formatLoadingText,
  progressFraction,
  type LoadingSnapshot,
} from "./loadingState";

export interface LoadingScreenProps {
  snapshot: LoadingSnapshot;
  /** Disables the progress bar's CSS transition. Wired from the save's accessibility prefs. */
  reducedMotion?: boolean;
  /** Optional retry handler shown when a critical asset failed. */
  onRetry?: () => void;
}

export function LoadingScreen({
  snapshot,
  reducedMotion = false,
  onRetry,
}: LoadingScreenProps): ReactElement {
  const text = formatLoadingText(snapshot);
  const fraction = progressFraction(snapshot);
  const percent = Math.round(fraction * 100);

  return (
    <main
      role="status"
      aria-live="polite"
      data-testid="loading-screen"
      data-phase={snapshot.phase}
      style={containerStyle}
    >
      <h1 style={titleStyle}>Loading</h1>
      <p
        data-testid="loading-screen-text"
        data-progress={percent}
        style={textStyle}
      >
        {text}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-testid="loading-screen-bar"
        style={barTrackStyle}
      >
        <div
          data-testid="loading-screen-fill"
          style={barFillStyle(percent, reducedMotion)}
        />
      </div>
      {snapshot.phase === "failed-critical" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          data-testid="loading-screen-retry"
          style={retryButtonStyle}
        >
          Retry
        </button>
      ) : null}
    </main>
  );
}

const containerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  padding: "2rem",
  background: "var(--bg, #111)",
  color: "var(--fg, #ddd)",
  fontFamily: "system-ui, sans-serif",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  color: "var(--muted, #aaa)",
};

const barTrackStyle: CSSProperties = {
  width: "min(24rem, 80vw)",
  height: "8px",
  background: "var(--muted, #333)",
  borderRadius: "4px",
  overflow: "hidden",
};

function barFillStyle(percent: number, reducedMotion: boolean): CSSProperties {
  return {
    width: `${percent}%`,
    height: "100%",
    background: "var(--accent, #6cf)",
    transition: reducedMotion ? "none" : "width 120ms ease-out",
  };
}

const retryButtonStyle: CSSProperties = {
  background: "transparent",
  color: "var(--fg, #ddd)",
  border: "1px solid var(--muted, #888)",
  borderRadius: "6px",
  padding: "0.6rem 1rem",
  cursor: "pointer",
  fontSize: "1rem",
};
