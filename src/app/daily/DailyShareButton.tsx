"use client";

import { useState } from "react";

interface DailyShareButtonProps {
  readonly text: string;
}

export function DailyShareButton({ text }: DailyShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");

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
    <div>
      <button
        type="button"
        onClick={() => void copyShareText()}
        data-testid="daily-share"
      >
        Copy daily share
      </button>
      <textarea
        aria-label="Daily challenge share text"
        data-testid="daily-share-text"
        readOnly
        value={text}
      />
      <p aria-live="polite" data-testid="daily-share-status">
        {status === "copied"
          ? "Copied"
          : status === "fallback"
            ? "Copy the text manually"
            : "Ready"}
      </p>
    </div>
  );
}
