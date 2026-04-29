"use client";

/**
 * Fixed-position banner that tells a long-lived browser tab a fresh
 * build has been deployed and offers a one-click reload.
 *
 * Detection: the client bundle freezes `BUILD_ID` (a git short SHA) at
 * compile time via `next.config.mjs`. After mount we wait 30s then
 * poll `/api/version` once a minute. The handler reports the SHA the
 * server was built with; once those two strings disagree, the banner
 * appears. See `checkRemoteVersion` for the pure compare helper.
 *
 * Behaviour pinned by the slice spec:
 *   - Initial 30s delay so a fresh page load is not slowed by an
 *     extra request.
 *   - 60s poll interval thereafter, scheduled as a chained
 *     `setTimeout` so we can stop polling the moment a `"stale"`
 *     result lands. Once the banner is up the answer cannot change
 *     back to fresh, so further polls would only generate idle
 *     traffic on a tab the player has likely walked away from.
 *   - Network errors swallowed silently (a transient backend hiccup
 *     must not surface to the player).
 *   - The only action is a `RELOAD` button. There is intentionally no
 *     dismiss control: once the build is stale the user must reload to
 *     pick up bug fixes.
 *   - Skipped entirely when `BUILD_ID` is the dev sentinel ("dev"), so
 *     `next dev` never flashes the banner during local development.
 *
 * Style is a single thin row anchored to the top of the viewport with
 * a high z-index so it sits above the canvas-based race UI without
 * covering gameplay.
 */

import { useEffect, useState } from "react";

import { BUILD_ID, isDevBuild } from "@/app/buildInfo";

import { checkRemoteVersion } from "./checkRemoteVersion";

const INITIAL_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 60_000;

export function UpdateBanner(): React.JSX.Element | null {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (isDevBuild) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function clearScheduled(): void {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function schedule(delayMs: number): void {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        void check();
      }, delayMs);
    }

    async function check(): Promise<void> {
      const result = await checkRemoteVersion({ currentVersion: BUILD_ID });
      if (cancelled) return;
      if (result === "stale") {
        setIsStale(true);
        return;
      }
      schedule(POLL_INTERVAL_MS);
    }

    schedule(INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearScheduled();
    };
  }, []);

  if (!isStale) return null;

  return (
    <div
      data-testid="update-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "7px 16px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--accent)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        letterSpacing: "0.08em",
        color: "var(--muted)",
      }}
    >
      <span>NEW VERSION AVAILABLE</span>
      <button
        type="button"
        data-testid="update-banner-reload"
        onClick={() => window.location.reload()}
        style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          padding: "3px 12px",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          cursor: "pointer",
          borderRadius: 4,
        }}
      >
        RELOAD
      </button>
    </div>
  );
}

export default UpdateBanner;
