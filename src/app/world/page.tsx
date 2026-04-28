"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import { getChampionship } from "@/data/championships";
import {
  buildWorldTourView,
  enterWorldTour,
} from "@/components/world/worldTourState";
import { defaultSave, loadSave, saveSave } from "@/persistence";

interface PageStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

const CHAMPIONSHIP_ID = "world-tour-standard";

export default function WorldPage() {
  const router = useRouter();
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PageStatus>({
    kind: "idle",
    message: "",
  });

  const championship = useMemo(() => getChampionship(CHAMPIONSHIP_ID), []);

  useEffect(() => {
    const outcome = loadSave();
    if (outcome.kind === "loaded") {
      setSave(outcome.save);
      return;
    }
    setSave(defaultSave());
    if (outcome.reason !== "missing" && outcome.reason !== "no-storage") {
      setStatus({
        kind: "info",
        message: `Loaded default save (reason: ${outcome.reason}).`,
      });
    }
  }, []);

  const view = useMemo(
    () => (save ? buildWorldTourView(save, championship) : null),
    [championship, save],
  );

  const enter = useCallback(
    (tourId: string) => {
      if (!save) return;
      const result = enterWorldTour(save, championship, tourId);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message:
            result.code === "tour_locked"
              ? "That tour is locked."
              : "That tour is not available.",
        });
        return;
      }

      const write = saveSave(result.save);
      const nextSave =
        write.kind === "ok"
          ? { ...result.save, writeCounter: (result.save.writeCounter ?? 0) + 1 }
          : result.save;
      setSave(nextSave);

      if (write.kind === "error") {
        setStatus({
          kind: "error",
          message: `Save failed (${write.reason}); tour kept in memory only.`,
        });
        return;
      }

      router.push(
        `/race?track=${encodeURIComponent(result.firstTrackId)}&tour=${encodeURIComponent(tourId)}&raceIndex=0`,
      );
    },
    [championship, router, save],
  );

  if (!save || !view) {
    return (
      <main style={pageStyle} data-testid="world-page">
        <h1>World Tour</h1>
        <p data-testid="world-loading">Loading world tour</p>
      </main>
    );
  }

  return (
    <main style={pageStyle} data-testid="world-page">
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{view.championshipName}</h1>
          <p style={mutedTextStyle}>
            {view.completedTourIds.length} of {view.cards.length} tours complete
          </p>
        </div>
        <nav style={navStyle} aria-label="World actions">
          <Link href="/garage" style={linkStyle} data-testid="world-garage-link">
            Garage
          </Link>
          <Link href="/" style={linkStyle} data-testid="world-title-link">
            Title
          </Link>
        </nav>
      </header>

      {status.kind !== "idle" ? (
        <p
          data-testid="world-status"
          role="status"
          aria-live="polite"
          style={{
            ...statusStyle,
            color: status.kind === "error" ? "#ff9a9a" : "#9bd2ff",
          }}
        >
          {status.message}
        </p>
      ) : null}

      <ol style={tourGridStyle} data-testid="world-tour-list">
        {view.cards.map((card) => {
          const isLocked = card.state === "locked";
          const statusText =
            card.state === "completed"
              ? "Completed"
              : card.state === "available"
                ? "Available"
                : "Locked";
          return (
            <li key={card.id} style={tourCardStyle} data-testid={`world-tour-${card.id}`}>
              <div style={tourHeaderStyle}>
                <span style={tourIndexStyle}>{card.index + 1}</span>
                <span
                  style={{
                    ...tourStatusStyle,
                    borderColor:
                      card.state === "locked"
                        ? "#6f7788"
                        : card.state === "completed"
                          ? "#82d18f"
                          : "#ffd166",
                  }}
                  data-testid={`world-tour-status-${card.id}`}
                >
                  {statusText}
                </span>
              </div>
              <h2 style={sectionTitleStyle}>{card.name}</h2>
              <dl style={summaryGridStyle}>
                <div style={summaryRowStyle}>
                  <dt>Races</dt>
                  <dd>{card.trackCount}</dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Required standing</dt>
                  <dd>Top {card.requiredStanding}</dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>First race</dt>
                  <dd data-testid={`world-tour-first-track-${card.id}`}>
                    {card.firstTrackName}
                  </dd>
                </div>
              </dl>
              {card.lockedReason ? (
                <p style={lockedReasonStyle} data-testid={`world-tour-lock-${card.id}`}>
                  {card.lockedReason}
                </p>
              ) : null}
              <button
                type="button"
                style={isLocked ? disabledButtonStyle : primaryButtonStyle}
                disabled={isLocked}
                title={card.lockedReason ?? `Enter ${card.name}`}
                onClick={() => enter(card.id)}
                data-testid={`world-tour-enter-${card.id}`}
              >
                Enter tour
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  fontFamily: "system-ui, sans-serif",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  marginBottom: "1.5rem",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0.75rem 0 1rem",
  fontSize: "1.25rem",
};

const mutedTextStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#aab0bd",
};

const navStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const linkStyle: CSSProperties = {
  color: "#dfe8ff",
  border: "1px solid #4f5f7a",
  padding: "0.55rem 0.8rem",
  textDecoration: "none",
  background: "#172133",
};

const tourGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
  padding: 0,
  margin: 0,
  listStyle: "none",
};

const tourCardStyle: CSSProperties = {
  border: "1px solid #2f3b4f",
  background: "#151d2b",
  padding: "1rem",
  minHeight: "260px",
  display: "flex",
  flexDirection: "column",
};

const tourHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
};

const tourIndexStyle: CSSProperties = {
  width: "2rem",
  height: "2rem",
  display: "grid",
  placeItems: "center",
  background: "#26344b",
  fontWeight: 700,
};

const tourStatusStyle: CSSProperties = {
  border: "1px solid",
  padding: "0.2rem 0.45rem",
  fontSize: "0.85rem",
  color: "#e8edf8",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  margin: "0 0 1rem",
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const lockedReasonStyle: CSSProperties = {
  color: "#d1b48f",
  margin: "auto 0 1rem",
};

const primaryButtonStyle: CSSProperties = {
  marginTop: "auto",
  border: "1px solid #f5c84c",
  color: "#10131a",
  background: "#ffd166",
  padding: "0.7rem 0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  borderColor: "#5c6370",
  background: "#353b46",
  color: "#969da8",
  cursor: "not-allowed",
};

const statusStyle: CSSProperties = {
  margin: "0 0 1rem",
};
