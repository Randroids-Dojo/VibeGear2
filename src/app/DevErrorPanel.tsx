"use client";

/**
 * Hidden client-only error panel. It renders only when the current URL has
 * `?errors=1`, reads the in-memory capture buffer, and copies plain JSON
 * to the clipboard for manual bug reports. It does not persist data and it
 * does not send network requests.
 */

import { useEffect, useState, type ReactElement } from "react";

import {
  ensureGlobalErrorCapture,
  formatCapturedErrors,
  type CapturedError,
} from "./errorCapture";

export function DevErrorPanel(): ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<readonly CapturedError[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldShow = params.get("errors") === "1";
    setVisible(shouldShow);
    if (!shouldShow) return;

    const handle = ensureGlobalErrorCapture();
    const refresh = () => setErrors(handle.getRecent());
    refresh();
    const interval = window.setInterval(refresh, 500);
    return () => window.clearInterval(interval);
  }, []);

  if (!visible) return null;

  const onCopy = (): void => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(formatCapturedErrors(errors)).catch(() => {});
  };

  const onClear = (): void => {
    const handle = ensureGlobalErrorCapture();
    handle.clear();
    setErrors([]);
  };

  return (
    <aside
      aria-label="Recent client errors"
      data-testid="dev-error-panel"
      style={panelStyle}
    >
      <header style={headerStyle}>
        <strong>Client errors</strong>
        <span data-testid="dev-error-count">{errors.length}</span>
      </header>
      <div style={buttonRowStyle}>
        <button type="button" onClick={onCopy} data-testid="dev-error-copy" style={buttonStyle}>
          Copy all
        </button>
        <button type="button" onClick={onClear} data-testid="dev-error-clear" style={buttonStyle}>
          Clear
        </button>
      </div>
      <pre data-testid="dev-error-log" style={logStyle}>
        {errors.length === 0 ? "No captured errors." : formatCapturedErrors(errors)}
      </pre>
    </aside>
  );
}

const panelStyle = {
  position: "fixed",
  right: "1rem",
  bottom: "1rem",
  zIndex: 1000,
  width: "min(34rem, calc(100vw - 2rem))",
  maxHeight: "50vh",
  padding: "0.75rem",
  border: "1px solid #8cf",
  borderRadius: "6px",
  background: "rgba(8, 13, 24, 0.96)",
  color: "#e8eefc",
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 1rem 2rem rgba(0, 0, 0, 0.35)",
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  marginBottom: "0.5rem",
} as const;

const buttonRowStyle = {
  display: "flex",
  gap: "0.5rem",
  marginBottom: "0.5rem",
} as const;

const buttonStyle = {
  border: "1px solid #8cf",
  borderRadius: "4px",
  background: "transparent",
  color: "#e8eefc",
  padding: "0.35rem 0.55rem",
  cursor: "pointer",
} as const;

const logStyle = {
  overflow: "auto",
  maxHeight: "36vh",
  margin: 0,
  whiteSpace: "pre-wrap",
  fontSize: "0.78rem",
  lineHeight: 1.35,
} as const;
