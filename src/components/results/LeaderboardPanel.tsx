"use client";

/**
 * §21 leaderboard panel rendered on the §20 race results screen.
 *
 * Consumes the producer client adapter (`src/leaderboard/client.ts`) per
 * the F-032 dot. On mount the panel:
 *
 *   1. Reads `isLeaderboardEnabled()` from the env. If false the entire
 *      panel is hidden so the §20 receipt stays visually clean for the
 *      bundled MVP build (the leaderboard is an opt-in service per
 *      AGENTS.md RULE 7).
 *   2. When the player finished cleanly, fires `submitLap` exactly once
 *      with the canonical lap fields. The signature is left as a
 *      placeholder hex blob: the server holds the
 *      `LEADERBOARD_SIGNING_KEY` and the client never sees the secret,
 *      so a noop / unconfigured deployment surfaces a `rejected`
 *      `bad-signature` or `server-misconfigured` sentinel which the
 *      panel renders as a non-blocking pill. A future slice (the
 *      raceToken-issuance route owned by F-030) will wire a real signed
 *      submission; this slice unblocks the consumer wiring without
 *      reaching into the signing surface.
 *   3. In parallel, fires `getTop(trackId)` to render the top-N list
 *      below the player's pill.
 *
 * DNF rows (`status === "dnf"`) skip the network call entirely and
 * render the `dnf` short-circuit so the receipt is honest about why the
 * leaderboard row is absent.
 *
 * The pure state model lives in `./leaderboardPanelState.ts`; this file
 * is the thin React shell and the env-gated render guard.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from "react";

import {
  getTop,
  isLeaderboardEnabled,
  submitLap,
  type GetTopResult,
  type SubmitLapResult,
} from "@/leaderboard/client";
import type { LapSubmission } from "@/leaderboard/types";

import {
  buildLeaderboardPanelView,
  type LeaderboardPanelView,
} from "./leaderboardPanelState";

export interface LeaderboardPanelProps {
  /** Track slug. Forwarded to `submitLap` and `getTop`. */
  trackId: string;
  /** Player car slug. Forwarded to `submitLap`. */
  carId: string;
  /**
   * Player's best lap in milliseconds. `null` when the player did not
   * complete a single timed lap (DNF on lap 1 with no sector splits).
   * The panel falls through to the `dnf` pill in that case.
   */
  bestLapMs: number | null;
  /**
   * `true` when the player car finished the race (`status === "finished"`).
   * Required so DNF runs do not submit a row.
   */
  playerFinished: boolean;
  /**
   * Optional override for the env-flag read. Defaults to the runtime
   * `process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED` parse. Only the SSR
   * snapshot test passes a value here; production callers omit it.
   */
  enabledOverride?: boolean;
}

/** Canonical raceToken placeholder. Real token issuance lands with F-030. */
const PLACEHOLDER_RACE_TOKEN = "results-screen-placeholder";

/** Canonical signature placeholder (64 hex chars). Same rationale. */
const PLACEHOLDER_SIGNATURE = "0".repeat(64);

/** Top-N row count rendered below the status pill. */
const TOP_LIMIT = 10;

export function LeaderboardPanel(props: LeaderboardPanelProps): ReactElement | null {
  const { trackId, carId, bestLapMs, playerFinished, enabledOverride } = props;

  // Resolve the env flag once on mount so SSR and the first client render
  // agree on whether the panel exists in the DOM. The override exists for
  // the SSR snapshot test; production callers always read the env.
  const [enabled] = useState<boolean>(() =>
    enabledOverride ?? isLeaderboardEnabled(),
  );

  const [submitResult, setSubmitResult] = useState<SubmitLapResult | null>(
    null,
  );
  const [topResult, setTopResult] = useState<GetTopResult | null>(null);

  // Single-shot effect: fire submitLap + getTop exactly once on mount.
  // The dep array is intentionally narrow so React Strict Mode's double
  // invoke in dev still only sends one logical request per session.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (playerFinished && bestLapMs !== null && bestLapMs > 0) {
      const submission: LapSubmission = {
        trackId,
        carId,
        lapMs: Math.trunc(bestLapMs),
        raceToken: PLACEHOLDER_RACE_TOKEN,
        signature: PLACEHOLDER_SIGNATURE,
      };
      void submitLap(submission).then((result) => {
        if (!cancelled) setSubmitResult(result);
      });
    }
    void getTop(trackId, TOP_LIMIT).then((result) => {
      if (!cancelled) setTopResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, trackId, carId, bestLapMs, playerFinished]);

  if (!enabled) {
    return null;
  }

  const view = buildLeaderboardPanelView({
    submit: submitResult,
    top: topResult,
    playerFinished,
  });

  return <PanelShell view={view} trackId={trackId} />;
}

interface PanelShellProps {
  view: LeaderboardPanelView;
  trackId: string;
}

function PanelShell(props: PanelShellProps): ReactElement {
  const { view, trackId } = props;
  return (
    <section
      data-testid="leaderboard-panel"
      data-status={view.status}
      data-track={trackId}
      style={panelStyle}
    >
      <h3 style={subHeading}>Leaderboard</h3>
      <p
        data-testid="leaderboard-status"
        data-status={view.status}
        data-rejected-code={view.rejectedCode ?? ""}
        style={statusPillStyle(view.status)}
      >
        {view.label}
      </p>
      {view.topHidden ? null : (
        <ol data-testid="leaderboard-top" style={topListStyle}>
          {view.entries.length === 0 ? (
            <li
              data-testid="leaderboard-top-empty"
              style={emptyRowStyle}
            >
              No lap times yet.
            </li>
          ) : (
            view.entries.map((entry, index) => (
              <li
                key={entry.id}
                data-testid={`leaderboard-row-${index + 1}`}
                style={topRowStyle}
              >
                <span style={rankStyle}>{index + 1}.</span>
                <span style={nameStyle}>
                  {entry.playerName ?? "anon"}
                </span>
                <span style={lapStyle}>{formatMs(entry.lapMs)}</span>
              </li>
            ))
          )}
        </ol>
      )}
    </section>
  );
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "--:--.---";
  const total = Math.round(ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function pad3(value: number): string {
  return value.toString().padStart(3, "0");
}

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  background: "rgba(255,255,255,0.02)",
};

const subHeading: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--muted, #aaa)",
};

function statusPillStyle(status: LeaderboardPanelView["status"]): CSSProperties {
  const palette: Record<LeaderboardPanelView["status"], string> = {
    idle: "var(--muted, #888)",
    dnf: "var(--muted, #888)",
    stored: "var(--accent, #6cf)",
    rejected: "var(--warn, #fc6)",
    error: "var(--warn, #fc6)",
    disabled: "var(--muted, #888)",
  };
  return {
    margin: 0,
    padding: "0.3rem 0.6rem",
    borderRadius: "999px",
    border: `1px solid ${palette[status]}`,
    color: palette[status],
    fontSize: "0.85rem",
    alignSelf: "flex-start",
    fontFamily: "system-ui, sans-serif",
  };
}

const topListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
};

const topRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2.5rem 1fr max-content",
  gap: "0.6rem",
  alignItems: "baseline",
  fontSize: "0.9rem",
};

const rankStyle: CSSProperties = {
  color: "var(--muted, #888)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const nameStyle: CSSProperties = {
  fontWeight: 500,
};

const lapStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const emptyRowStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  color: "var(--muted, #888)",
  fontStyle: "italic",
};
