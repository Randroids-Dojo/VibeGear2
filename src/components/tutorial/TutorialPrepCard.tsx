"use client";

/**
 * First-race tutorial card per F-098 (closes the §4 "high learnability,
 * low dead time" goal). Renders an overlay panel above the prep-page
 * grid the first time the player reaches `/race/prep`. Dismissed by any
 * key, click, or the explicit "Got it" button. The dismissal flips
 * `save.tutorialState.prepCardSeen` to `true` via the parent's
 * `onDismiss` callback so the card never re-appears.
 *
 * Reduced-motion: the card is static. No transitions, no animations.
 * The overlay uses `position: fixed` plus a backdrop so vestibular-
 * sensitive players see exactly the same layout as everyone else.
 *
 * Accessibility: focus is trapped on the dismiss button on mount so
 * keyboard users can press Enter or Space to dismiss; screen readers
 * get an `aria-labelledby` + `aria-describedby` pairing pointing at the
 * heading + body text.
 */

import { useCallback, useEffect, useRef, type ReactElement } from "react";

export interface TutorialPrepCardProps {
  readonly onDismiss: () => void;
}

export function TutorialPrepCard({
  onDismiss,
}: TutorialPrepCardProps): ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    buttonRef.current?.focus();
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dismiss();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-prep-card-title"
      aria-describedby="tutorial-prep-card-body"
      data-testid="tutorial-prep-card"
      style={backdropStyle}
      onClick={dismiss}
    >
      <div
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="tutorial-prep-card-title" style={titleStyle}>
          Welcome to VibeGear2
        </h2>
        <div id="tutorial-prep-card-body" style={bodyStyle}>
          <p style={leadStyle}>
            Top Gear 2 style arcade racing. Quick tips:
          </p>
          <ul style={listStyle}>
            <li>
              <strong style={kbdStyle}>Up arrow</strong> throttle. <strong style={kbdStyle}>Down arrow</strong> brake.
            </li>
            <li>
              <strong style={kbdStyle}>Left</strong> and <strong style={kbdStyle}>Right</strong> steer.
            </li>
            <li>
              <strong style={kbdStyle}>Space</strong> fires nitro. Save it for straights.
            </li>
            <li>
              Pick up cash and nitro on the road. Avoid puddles and gravel.
            </li>
            <li>
              Finish in the top 4 to advance the tour.
            </li>
          </ul>
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={dismiss}
          style={primaryButtonStyle}
          data-testid="tutorial-prep-card-dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(8, 12, 22, 0.86)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "1.5rem",
};

const cardStyle = {
  background: "#11151f",
  color: "#e7eaf3",
  borderRadius: "10px",
  border: "1px solid #2a2f3d",
  maxWidth: "32rem",
  width: "100%",
  padding: "1.75rem 2rem",
  boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
  display: "flex",
  flexDirection: "column" as const,
  gap: "1rem",
};

const titleStyle = {
  fontSize: "1.4rem",
  margin: 0,
  letterSpacing: "0.02em",
};

const bodyStyle = {
  fontSize: "0.95rem",
  lineHeight: 1.6,
};

const leadStyle = { margin: "0 0 0.6rem" };

const listStyle = {
  margin: 0,
  padding: "0 0 0 1.1rem",
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.4rem",
};

const kbdStyle = {
  display: "inline-block",
  padding: "0 0.4rem",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.85rem",
  background: "#1d2230",
  border: "1px solid #2f3445",
  borderRadius: "4px",
  color: "#cfd4e2",
};

const primaryButtonStyle = {
  alignSelf: "flex-end" as const,
  padding: "0.55rem 1.4rem",
  background: "#3469ff",
  color: "#fff",
  border: "1px solid #3469ff",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer" as const,
};
