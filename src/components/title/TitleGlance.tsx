"use client";

/**
 * Title-page season glance per F-099. Reads the persisted save on
 * mount and renders a small read-only card naming credits, tours
 * completed, cars owned, and (when applicable) a "Continue tour"
 * deep link.
 *
 * Hydration-safe: SSR pass renders an empty placeholder, the
 * client-only effect populates the glance after `loadSave()` runs.
 * No animation; the card is static so the surface respects
 * vestibular sensitivity per §19.
 *
 * Out of scope (F-099 polish, deferred):
 * - Per-track leaderboard rank glance (needs LeaderboardPanel
 *   adapter wiring; ships as F-104 once a third call site exists).
 * - Last-race summary block (needs the §20 records map to grow a
 *   "most recent" cursor; not on the v1.0 critical path).
 */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { getChampionship } from "@/data";
import { loadSave } from "@/persistence/save";
import {
  buildTitleGlance,
  type TitleGlance as TitleGlanceData,
} from "./titleGlanceState";

const CHAMPIONSHIP_ID = "world-tour-standard";

export function TitleGlance(): ReactElement | null {
  const championship = useMemo(() => getChampionship(CHAMPIONSHIP_ID), []);
  const [glance, setGlance] = useState<TitleGlanceData | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const outcome = loadSave();
    if (outcome.kind === "loaded") {
      setGlance(buildTitleGlance(outcome.save, championship));
    }
    setHydrated(true);
  }, [championship]);

  if (!hydrated) {
    return (
      <section
        data-testid="title-glance"
        data-state="hydrating"
        style={panelStyle}
        aria-label="Season glance"
      />
    );
  }

  if (!glance) {
    return (
      <section
        data-testid="title-glance"
        data-state="empty"
        style={panelStyle}
        aria-label="Season glance"
      />
    );
  }

  const continueHref = glance.continueTour
    ? `/race/prep?track=${encodeURIComponent(glance.continueTour.nextTrackId)}&tour=${encodeURIComponent(
        glance.continueTour.tourId,
      )}&raceIndex=${glance.continueTour.nextRaceIndex}`
    : null;

  return (
    <section
      data-testid="title-glance"
      data-state="ready"
      style={panelStyle}
      aria-label="Season glance"
    >
      <dl style={dlStyle}>
        <div style={rowStyle}>
          <dt style={dtStyle}>Credits</dt>
          <dd style={ddStyle} data-testid="title-glance-credits">
            {glance.credits.toLocaleString("en-US")} cr
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>Tours</dt>
          <dd style={ddStyle} data-testid="title-glance-tours">
            {glance.toursCompleted} / {glance.toursTotal}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>Cars owned</dt>
          <dd style={ddStyle} data-testid="title-glance-cars">
            {glance.ownedCarCount}
          </dd>
        </div>
      </dl>
      {continueHref && glance.continueTour ? (
        <Link
          href={continueHref}
          data-testid="title-glance-continue"
          style={continueLinkStyle}
        >
          Continue {glance.continueTour.tourName}
        </Link>
      ) : null}
    </section>
  );
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
  padding: "0.85rem 1.1rem",
  background: "rgba(17, 21, 31, 0.65)",
  border: "1px solid #2a2f3d",
  borderRadius: "8px",
  minWidth: "16rem",
  color: "#cfd4e2",
  fontSize: "0.92rem",
};

const dlStyle: CSSProperties = {
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const dtStyle: CSSProperties = {
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontSize: "0.7rem",
  color: "#8d94a6",
};

const ddStyle: CSSProperties = {
  margin: 0,
  fontWeight: 600,
};

const continueLinkStyle: CSSProperties = {
  alignSelf: "flex-end",
  padding: "0.45rem 1rem",
  background: "#3469ff",
  color: "#fff",
  border: "1px solid #3469ff",
  borderRadius: "6px",
  fontWeight: 600,
  fontSize: "0.85rem",
  textDecoration: "none",
};
