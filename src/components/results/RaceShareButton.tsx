"use client";

import { useState, type ReactElement } from "react";

/**
 * Race-share button per F-100. A finished or DNF'd Tour result
 * surfaces a copyable text card the player can paste into chat,
 * Discord, Reddit, etc. Mirrors the daily-share button's
 * Clipboard / fallback flow but uses test-ids scoped to the
 * generic Tour-share surface.
 */
export interface RaceShareButtonProps {
  readonly text: string;
}

export function RaceShareButton({
  text,
}: RaceShareButtonProps): ReactElement {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">(
    "idle",
  );

  async function copyShareText(): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        return;
      } catch {
        setStatus("fallback");
        return;
      }
    }
    setStatus("fallback");
  }

  return (
    <div data-testid="race-share">
      <button
        type="button"
        onClick={() => void copyShareText()}
        data-testid="race-share-copy"
      >
        Copy result
      </button>
      <textarea
        aria-label="Race result share text"
        data-testid="race-share-text"
        readOnly
        value={text}
      />
      <p aria-live="polite" data-testid="race-share-status">
        {status === "copied"
          ? "Copied"
          : status === "fallback"
            ? "Copy the text manually"
            : "Ready"}
      </p>
    </div>
  );
}
