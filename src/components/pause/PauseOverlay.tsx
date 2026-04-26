"use client";

/**
 * Pause overlay per `docs/gdd/20-hud-and-ui-ux.md` Pause menu.
 *
 * Controlled component. The race scene owns whether the overlay is open
 * (toggled via `usePauseToggle` on the configured pause action key) and
 * pauses the underlying simulation loop separately via `LoopHandle.pause()`.
 * Keeping the open state, the loop pause, and the menu rendering as three
 * independent concerns lets the same overlay reuse from the title-screen
 * preview and the title-screen "settings" hop later.
 *
 * Phase 2+ scope: only resume / restart / retire / settings / leaderboard /
 * exit are listed here. The settings and leaderboard buttons are inert in
 * this slice (their target pages do not exist yet) and report through the
 * status callback so the parent can decide what to render.
 *
 * Manual verification: this slice does not ship a Playwright runner, so
 * the rendered tree is exercised via the dev road page at `/dev/road`
 * (Escape opens the menu, click resume to dismiss). A future slice that
 * stands up Playwright will add the regression spec listed in the dot.
 */

import type { CSSProperties, ReactElement } from "react";
import { useEffect, useRef } from "react";

export interface PauseOverlayActions {
  /** Resume the race. Required. */
  onResume: () => void;
  /** Restart from the start of the current race. */
  onRestart?: () => void;
  /** Retire the race and return to the results screen. */
  onRetire?: () => void;
  /** Open settings. Inert until the settings page lands. */
  onSettings?: () => void;
  /** Open leaderboard. Inert until the leaderboard page lands. */
  onLeaderboard?: () => void;
  /** Exit to the title screen. */
  onExitToTitle?: () => void;
}

export interface PauseOverlayProps extends PauseOverlayActions {
  open: boolean;
}

interface MenuEntry {
  id: string;
  label: string;
  handler?: () => void;
}

export function PauseOverlay(props: PauseOverlayProps): ReactElement | null {
  const { open, onResume, onRestart, onRetire, onSettings, onLeaderboard, onExitToTitle } = props;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const resumeRef = useRef<HTMLButtonElement | null>(null);

  // Move focus to the resume button when the overlay opens so keyboard
  // users can dismiss with Enter without hunting for focus. Restore focus
  // to the previously-focused element on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = typeof document !== "undefined" ? document.activeElement : null;
    resumeRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const entries: MenuEntry[] = [
    { id: "resume", label: "Resume", handler: onResume },
    { id: "restart", label: "Restart race", handler: onRestart },
    { id: "retire", label: "Retire race", handler: onRetire },
    { id: "settings", label: "Settings", handler: onSettings },
    { id: "leaderboard", label: "Leaderboard", handler: onLeaderboard },
    { id: "exit", label: "Exit to title", handler: onExitToTitle },
  ];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pause menu"
      data-testid="pause-overlay"
      style={overlayStyle}
    >
      <div style={panelStyle}>
        <h2 style={titleStyle}>Paused</h2>
        <ul style={listStyle}>
          {entries.map((entry, idx) => (
            <li key={entry.id} style={listItemStyle}>
              <button
                type="button"
                ref={idx === 0 ? resumeRef : null}
                onClick={entry.handler}
                disabled={entry.handler === undefined}
                data-testid={`pause-${entry.id}`}
                style={buttonStyle(entry.handler === undefined)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
};

const panelStyle: CSSProperties = {
  background: "var(--bg, #111)",
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1.5rem 2rem",
  minWidth: "18rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const listItemStyle: CSSProperties = {
  display: "flex",
};

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    flex: 1,
    background: "transparent",
    color: "var(--fg, #ddd)",
    border: "1px solid var(--muted, #888)",
    borderRadius: "6px",
    padding: "0.6rem 0.9rem",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: "1rem",
    textAlign: "left",
  };
}
