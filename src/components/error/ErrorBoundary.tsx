"use client";

/**
 * App-shell error boundary per
 * `docs/gdd/21-technical-design-for-web-implementation.md` ("App shell
 * catches runtime errors").
 *
 * React class component because hooks cannot implement
 * `componentDidCatch`. Wraps the entire app in `src/app/layout.tsx` so
 * any thrown render error inside the tree falls back to a recovery UI
 * instead of leaving the page blank.
 *
 * The fallback exposes:
 * - a "Reload" button that reloads the page (cheapest way to recover)
 * - a "Copy error" button that writes a `formatErrorReport` string to
 *   the clipboard so the player can paste it into a bug report
 * - the error message inline (truncated) so the user can identify the
 *   shape of the failure at a glance
 *
 * No telemetry is sent. The project privacy posture rules out automatic
 * error reporting at this stage.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

import { getGlobalErrorCapture, formatCapturedErrors } from "@/app/errorCapture";

import { formatErrorReport } from "./formatErrorReport";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional override for the fallback. Receives the captured error and
   * the formatted report. Defaults to the in-file fallback below.
   */
  fallback?: (error: unknown, report: string, reset: () => void) => ReactNode;
  /**
   * Optional sink invoked once per caught error. Tests use this to assert
   * a render error was observed without going through the console.
   */
  onCaught?: (error: unknown, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  componentStack: string | null;
}

const INITIAL_STATE: ErrorBoundaryState = {
  hasError: false,
  error: null,
  componentStack: null,
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    getGlobalErrorCapture().capture(error);
    // Mirror the error to the console so devtools still surfaces it.
    // The boundary is the sole consumer that matters for the user; this
    // log exists only for the developer's own debugging.
    console.error("[error-boundary]", error, info);
    this.props.onCaught?.(error, info);
  }

  reset = (): void => {
    this.setState(INITIAL_STATE);
  };

  override render(): ReactNode {
    const { hasError, error, componentStack } = this.state;
    if (!hasError) {
      return this.props.children;
    }
    const recent = getGlobalErrorCapture().getRecent();
    const report = formatErrorReport({
      error,
      componentStack,
      recentClientErrors: recent.length > 0 ? formatCapturedErrors(recent) : null,
    });
    if (this.props.fallback) {
      return this.props.fallback(error, report, this.reset);
    }
    return <DefaultFallback error={error} report={report} />;
  }
}

interface DefaultFallbackProps {
  error: unknown;
  report: string;
}

function DefaultFallback({ error, report }: DefaultFallbackProps): ReactNode {
  const message = error instanceof Error ? error.message : String(error);

  const onCopy = (): void => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    copyErrorReportToClipboard(navigator.clipboard, report);
  };

  const onReload = (): void => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  return (
    <main
      role="alert"
      data-testid="error-boundary-fallback"
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        color: "var(--fg, #ddd)",
        background: "var(--bg, #111)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Something broke. Reload?</h1>
      <p
        data-testid="error-boundary-message"
        style={{ maxWidth: "32rem", textAlign: "center", color: "#f88" }}
      >
        {message || "An unknown error occurred while rendering."}
      </p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={onReload}
          data-testid="error-boundary-reload"
          style={fallbackButton}
        >
          Reload
        </button>
        <button
          type="button"
          onClick={onCopy}
          data-testid="error-boundary-copy"
          style={fallbackButton}
        >
          Copy error
        </button>
      </div>
    </main>
  );
}

export function copyErrorReportToClipboard(
  clipboard: Pick<Clipboard, "writeText">,
  report: string,
): void {
  void clipboard.writeText(report).catch(() => {});
}

const fallbackButton = {
  background: "transparent",
  color: "var(--fg, #ddd)",
  border: "1px solid var(--muted, #888)",
  borderRadius: "6px",
  padding: "0.6rem 1rem",
  cursor: "pointer",
  fontSize: "1rem",
} as const;
