"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import {
  buildGarageSummaryView,
  selectStarterCar,
} from "@/components/garage/garageSummaryState";
import { getChampionship } from "@/data";
import { buildTourPressureSummary } from "@/game/tourPressure";
import { defaultSave, loadSave, saveSave } from "@/persistence";

const CHAMPIONSHIP_ID = "world-tour-standard";

interface PageStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

export default function GaragePage() {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PageStatus>({
    kind: "idle",
    message: "",
  });

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
    () => (save ? buildGarageSummaryView(save) : null),
    [save],
  );
  const championship = useMemo(() => getChampionship(CHAMPIONSHIP_ID), []);
  const tourPressure = useMemo(
    () => (save ? buildTourPressureSummary({ save, championship }) : null),
    [championship, save],
  );

  const persist = useCallback((next: SaveGame, message: string) => {
    const result = saveSave(next);
    if (result.kind === "ok") {
      setSave({
        ...next,
        writeCounter: (next.writeCounter ?? 0) + 1,
      });
      setStatus({ kind: "info", message });
    } else {
      setSave(next);
      setStatus({
        kind: "error",
        message: `Save failed (${result.reason}); change kept in memory only.`,
      });
    }
  }, []);

  const pickStarter = useCallback(
    (carId: string) => {
      if (!save) return;
      const next = selectStarterCar(save, carId);
      if (!next) {
        setStatus({
          kind: "error",
          message: "That car is not available as a starter.",
        });
        return;
      }
      persist(next, "Starter car selected.");
    },
    [persist, save],
  );

  if (!save || !view) {
    return (
      <main style={pageStyle} data-testid="garage-page">
        <h1>Garage</h1>
        <p data-testid="garage-loading">Loading garage</p>
      </main>
    );
  }

  return (
    <main style={pageStyle} data-testid="garage-page">
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Garage</h1>
          <p style={mutedTextStyle}>
            Credits:{" "}
            <strong data-testid="garage-credits">{view.credits}</strong>
          </p>
        </div>
        <nav style={navStyle} aria-label="Garage actions">
          <Link
            href="/garage/cars"
            style={linkStyle}
            data-testid="garage-cars-link"
          >
            Cars
          </Link>
          <Link
            href="/garage/repair"
            style={linkStyle}
            data-testid="garage-repair-link"
          >
            Repairs
          </Link>
          <Link
            href="/garage/upgrade"
            style={linkStyle}
            data-testid="garage-upgrade-link"
          >
            Upgrades
          </Link>
          <Link
            href="/world"
            style={primaryLinkStyle}
            data-testid="garage-next-race-link"
          >
            Next race
          </Link>
        </nav>
      </header>

      {status.kind !== "idle" ? (
        <p
          data-testid="garage-status"
          style={{
            ...statusStyle,
            color: status.kind === "error" ? "#ff9a9a" : "#9bd2ff",
          }}
        >
          {status.message}
        </p>
      ) : null}

      {view.needsStarterPick ? (
        <section style={panelStyle} data-testid="garage-starter-pick">
          <h2 style={sectionTitleStyle}>Pick your starter car</h2>
          <p style={mutedTextStyle}>
            Your save does not point at an owned active car. Choose an available
            starter to continue.
          </p>
          <ul style={cardGridStyle}>
            {view.starterCars.map((car) => (
              <li
                key={car.id}
                style={cardStyle}
                data-testid={`starter-${car.id}`}
              >
                <h3 style={cardTitleStyle}>{car.name}</h3>
                <p style={mutedTextStyle}>Class: {car.class}</p>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => pickStarter(car.id)}
                  data-testid={`pick-starter-${car.id}`}
                >
                  Select starter
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div style={layoutStyle}>
          <section style={panelStyle} data-testid="garage-car-summary">
            <h2 style={sectionTitleStyle}>Car</h2>
            <p style={carNameStyle} data-testid="garage-active-car">
              {view.activeCar?.name ?? view.activeCarId}
            </p>
            <dl style={summaryGridStyle}>
              <div style={summaryRowStyle}>
                <dt>Owned cars</dt>
                <dd data-testid="garage-owned-count">{view.ownedCount}</dd>
              </div>
              <div style={summaryRowStyle}>
                <dt>Repair factor</dt>
                <dd data-testid="garage-repair-factor">
                  {view.activeCar?.repairFactor.toFixed(2) ?? "n/a"}
                </dd>
              </div>
              <div style={summaryRowStyle}>
                <dt>Damage</dt>
                <dd data-testid="garage-damage-summary">
                  {view.damagePercent > 0
                    ? `${view.damagePercent}% pending`
                    : "No race damage pending"}
                </dd>
              </div>
            </dl>
          </section>

          <section style={panelStyle} data-testid="garage-upgrade-summary">
            <h2 style={sectionTitleStyle}>Installed upgrades</h2>
            <dl style={summaryGridStyle}>
              {view.installedTiers.map((row) => (
                <div key={row.category} style={summaryRowStyle}>
                  <dt>{row.label}</dt>
                  <dd data-testid={`garage-upgrade-${row.category}`}>
                    Tier {row.tier}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <aside style={nextRacePanelStyle} data-testid="garage-next-card">
            <h2 style={sectionTitleStyle}>Next race</h2>
            {tourPressure ? (
              <dl style={summaryGridStyle} data-testid="garage-tour-pressure">
                <div style={summaryRowStyle}>
                  <dt>Tour</dt>
                  <dd data-testid="garage-pressure-tour">
                    {tourPressure.tourName}
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Progress</dt>
                  <dd data-testid="garage-pressure-progress">
                    {tourPressure.progressLabel}
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Standing</dt>
                  <dd data-testid="garage-pressure-standing">
                    {tourPressure.standingsLabel}
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Gate</dt>
                  <dd data-testid="garage-pressure-gate">
                    {tourPressure.gateLabel}
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Plan</dt>
                  <dd data-testid="garage-pressure-plan">
                    {tourPressure.pressureLabel}
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Repair room</dt>
                  <dd data-testid="garage-pressure-cash-after-repair">
                    {tourPressure.cashAfterRepair} cr
                  </dd>
                </div>
                <div style={summaryRowStyle}>
                  <dt>Upgrade gap</dt>
                  <dd data-testid="garage-pressure-upgrade-shortfall">
                    {tourPressure.upgradeShortfall} cr
                  </dd>
                </div>
              </dl>
            ) : (
              <p style={nextRaceTextStyle}>
                Pick the next World Tour event, then return here for repairs and
                upgrades between races.
              </p>
            )}
            <Link
              href="/world"
              style={primaryLinkStyle}
              data-testid="garage-open-world-tour-link"
            >
              Open world tour
            </Link>
          </aside>
        </div>
      )}
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
  margin: 0,
  fontSize: "1.1rem",
};

const carNameStyle: CSSProperties = {
  margin: "0.5rem 0 1rem",
  fontSize: "1.5rem",
  fontWeight: 700,
};

const mutedTextStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
  margin: "0.25rem 0",
};

const navStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const linkStyle: CSSProperties = {
  border: "1px solid var(--muted, #666)",
  borderRadius: "6px",
  color: "var(--fg, #ddd)",
  padding: "0.55rem 0.75rem",
  textDecoration: "none",
};

const primaryLinkStyle: CSSProperties = {
  ...linkStyle,
  borderColor: "var(--accent, #8cf)",
  color: "var(--accent, #8cf)",
};

const statusStyle: CSSProperties = {
  margin: "0 0 1rem",
};

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
  gap: "1rem",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  background: "rgba(255, 255, 255, 0.03)",
};

const nextRacePanelStyle: CSSProperties = {
  ...panelStyle,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.85rem",
};

const nextRaceTextStyle: CSSProperties = {
  ...mutedTextStyle,
  margin: 0,
  maxWidth: "28rem",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  margin: 0,
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
  gap: "1rem",
  listStyle: "none",
  padding: 0,
  margin: "1rem 0 0",
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--muted, #555)",
  borderRadius: "8px",
  padding: "1rem",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
};

const buttonStyle: CSSProperties = {
  marginTop: "0.75rem",
  background: "transparent",
  color: "var(--accent, #8cf)",
  border: "1px solid var(--accent, #8cf)",
  borderRadius: "6px",
  padding: "0.55rem 0.75rem",
  cursor: "pointer",
};
