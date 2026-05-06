"use client";

/**
 * Floating feedback button that opens a panel and POSTs the player's
 * note to `/api/feedback`. The route turns the post into a labelled
 * GitHub issue. Q-012 option (b).
 *
 * Capture surface:
 *   - The current canvas, downscaled to <=320px wide and JPEG-encoded
 *     so the issue body stays under the GitHub size limit.
 *   - Recent uncaught errors and unhandled rejections from the global
 *     error capture buffer (the same buffer that powers the hidden
 *     `?errors=1` panel).
 *   - URL path, viewport, user agent, and ISO timestamp.
 *
 * The FAB and the hidden dev `?errors=1` panel can coexist: both render
 * at bottom-right but the FAB sits at the corner and the dev panel
 * stacks above it without overlap that obstructs either control.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

import {
  ensureGlobalErrorCapture,
  type CapturedError,
} from "@/app/errorCapture";

type View = "closed" | "open";
type SubmitState = "idle" | "sending" | "success" | "error";

const MAX_SCREENSHOT_WIDTH = 320;
const SCREENSHOT_QUALITY = 0.5;

function captureScreenshot(): string | null {
  try {
    const canvas = document.querySelector("canvas");
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;

    const scale = Math.min(1, MAX_SCREENSHOT_WIDTH / canvas.width);
    const w = Math.round(canvas.width * scale);
    const h = Math.round(canvas.height * scale);

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(canvas, 0, 0, w, h);
    return tmp.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
  } catch {
    return null;
  }
}

const MAX_MESSAGE_LENGTH = 4000;

export function FeedbackFab(): ReactElement | null {
  const [view, setView] = useState<View>("closed");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (view !== "open") return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [view]);

  useEffect(() => {
    if (view === "closed") return;
    function onClickOutside(e: MouseEvent): void {
      const t = e.target as Node;
      if (
        !fabRef.current?.contains(t) &&
        !panelRef.current?.contains(t)
      ) {
        setView("closed");
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setView("closed");
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [view]);

  function toggle(): void {
    setView((v) => (v === "closed" ? "open" : "closed"));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const text = message.trim();
    if (text.length === 0) return;

    const screenshot = captureScreenshot();
    const capturedErrors = serializeCapturedErrors(
      ensureGlobalErrorCapture().getRecent(),
    );

    setSubmitState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deriveTitle(text),
          body: text,
          context: {
            urlPath: window.location.pathname,
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString(),
            screenshot,
            capturedErrors: capturedErrors.length > 0 ? capturedErrors : null,
          },
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSubmitState("success");
      setMessage("");
      window.setTimeout(() => {
        setView("closed");
        window.setTimeout(() => setSubmitState("idle"), 350);
      }, 1800);
    } catch {
      setSubmitState("error");
      window.setTimeout(() => setSubmitState("idle"), 3000);
    }
  }

  const isOpen = view === "open";
  const messageLength = message.trim().length;

  const content = (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={toggle}
        data-testid="feedback-fab-toggle"
        aria-label={isOpen ? "Close feedback" : "Send feedback"}
        aria-expanded={isOpen}
        style={{
          ...fabStyle,
          background: isOpen ? "rgba(20, 24, 32, 0.95)" : "var(--accent)",
          borderColor: isOpen ? "rgba(255,255,255,0.2)" : "#ff9b75",
        }}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Send feedback"
          data-testid="feedback-fab-panel"
          style={panelStyle}
        >
          <div style={panelHeader}>
            <div>
              <div style={eyebrowStyle}>GitHub issue</div>
              <div style={panelTitle}>Feedback</div>
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setView("closed")}
              style={panelClose}
            >
              Close
            </button>
          </div>

          {submitState !== "success" ? (
            <form onSubmit={handleSubmit} style={formStyle}>
              <p style={panelIntro}>
                Tell us what happened. We attach the route, a small canvas
                screenshot, and any recent client errors.
              </p>
              <label style={fieldLabel} htmlFor="feedback-message">
                Message
              </label>
              <textarea
                id="feedback-message"
                ref={textareaRef}
                placeholder="What's on your mind?"
                rows={4}
                required
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={textareaStyle}
                data-testid="feedback-fab-textarea"
              />
              <div style={metaRow}>
                <span>{messageLength > 0 ? `${messageLength} chars` : "Ready"}</span>
                <span style={capturePills}>
                  <span style={capturePill}>Screenshot</span>
                  <span style={capturePill}>Errors</span>
                </span>
              </div>
              <button
                type="submit"
                disabled={submitState === "sending" || messageLength === 0}
                data-testid="feedback-fab-submit"
                style={{
                  ...submitBtn,
                  background:
                    submitState === "error"
                      ? "#b84a3a"
                      : submitState === "sending"
                        ? "#555"
                        : "var(--accent)",
                  cursor: submitState === "sending" ? "wait" : "pointer",
                  opacity: messageLength === 0 ? 0.55 : 1,
                }}
              >
                {submitState === "sending"
                  ? "Sending..."
                  : submitState === "error"
                    ? "Failed, try again"
                    : "Send feedback"}
              </button>
              <span style={hintStyle} aria-live="polite">
                {submitState === "error"
                  ? "Submission failed. Your message is still here."
                  : "Posted as a GitHub issue with the feedback label."}
              </span>
            </form>
          ) : (
            <div style={successStyle} data-testid="feedback-fab-success">
              <div style={successMark}>OK</div>
              <p style={{ margin: "6px 0 0", fontWeight: 700 }}>Thanks!</p>
              <p style={{ margin: "2px 0 0", opacity: 0.7, fontSize: 13 }}>
                Your message has been submitted.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function deriveTitle(text: string): string {
  const firstLine = text.split("\n", 1)[0]?.trim() ?? "";
  const summary = firstLine.length > 0 ? firstLine : text;
  const trimmed = summary.length > 80 ? `${summary.slice(0, 80)}...` : summary;
  return `[feedback] ${trimmed}`;
}

function serializeCapturedErrors(
  errors: readonly CapturedError[],
): ReadonlyArray<{
  id: string;
  message: string;
  stackPrefix: string;
  timestamp: number;
  count: number;
  buildId: string;
  buildVersion: string;
  userAgent: string;
}> {
  return errors.map((err) => ({
    id: err.id,
    message: err.message,
    stackPrefix: err.stackPrefix,
    timestamp: err.timestamp,
    count: err.count,
    buildId: err.buildId,
    buildVersion: err.buildVersion,
    userAgent: err.userAgent,
  }));
}

function ChatIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const fabStyle: CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "1px solid",
  color: "white",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 14px 34px rgba(0,0,0,0.42)",
  zIndex: 1001,
};
const panelStyle: CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 84,
  width: 360,
  maxWidth: "calc(100vw - 40px)",
  background: "rgba(11, 14, 20, 0.97)",
  color: "var(--fg)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  zIndex: 1001,
  border: "1px solid rgba(255,255,255,0.12)",
  boxSizing: "border-box",
};
const panelHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 12,
};
const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};
const panelTitle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: 1.2,
  marginTop: 2,
};
const panelClose: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "transparent",
  color: "#cfcfcf",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  padding: "7px 10px",
  textTransform: "uppercase",
};
const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  margin: 0,
};
const panelIntro: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.45,
  margin: 0,
};
const fieldLabel: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};
const textareaStyle: CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  color: "var(--fg)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  padding: 11,
  fontFamily: "inherit",
  fontSize: 14,
  lineHeight: 1.45,
  minHeight: 104,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};
const metaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--muted)",
  fontSize: 11,
};
const capturePills: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
const capturePill: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 999,
  padding: "3px 7px",
  color: "var(--muted)",
};
const submitBtn: CSSProperties = {
  color: "#0b0e14",
  border: "none",
  borderRadius: 8,
  padding: "11px 14px",
  fontWeight: 800,
  fontSize: 14,
  fontFamily: "inherit",
  minHeight: 42,
};
const hintStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.35,
};
const successStyle: CSSProperties = {
  textAlign: "center",
  padding: "14px 0 8px",
};
const successMark: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "rgba(95,224,138,0.13)",
  color: "#5fe08a",
  fontSize: 20,
  fontWeight: 800,
};
