"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import {
  buildGarageUpgradeView,
  upgradeFailureMessage,
} from "@/components/garage/garageUpgradeState";
import { purchaseAndInstall } from "@/game/economy";
import { defaultSave, loadSave, saveSave } from "@/persistence";

interface PageStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

export default function GarageUpgradePage() {
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
    () => (save ? buildGarageUpgradeView(save) : null),
    [save],
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

  const buyUpgrade = useCallback(
    (upgradeId: string, upgradeName: string) => {
      if (!save || !view?.activeCar) return;
      const result = purchaseAndInstall(save, upgradeId, view.activeCar.id);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message: upgradeFailureMessage(result.failure),
        });
        return;
      }
      persist(result.state, `Installed ${upgradeName}.`);
    },
    [persist, save, view?.activeCar],
  );

  if (!save || !view) {
    return (
      <main style={pageStyle} data-testid="garage-upgrade-page">
        <h1>Garage. Upgrades</h1>
        <p data-testid="garage-loading">Loading upgrades</p>
      </main>
    );
  }

  return (
    <main style={pageStyle} data-testid="garage-upgrade-page">
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Garage. Upgrades</h1>
          <p style={mutedTextStyle}>
            Active car:{" "}
            <strong data-testid="garage-upgrade-active-car">
              {view.activeCar?.name ?? view.activeCarId}
            </strong>
            . Credits:{" "}
            <strong data-testid="garage-upgrade-credits">{view.credits}</strong>.
          </p>
        </div>
        <nav style={navStyle} aria-label="Garage upgrade actions">
          <Link href="/garage" style={linkStyle} data-testid="garage-upgrade-back">
            Back to garage
          </Link>
          <Link href="/garage/cars" style={linkStyle} data-testid="garage-upgrade-cars">
            Cars
          </Link>
        </nav>
      </header>

      {status.kind !== "idle" ? (
        <p
          data-testid="garage-upgrade-status"
          style={{
            ...statusStyle,
            color: status.kind === "error" ? "#ff9a9a" : "#9bd2ff",
          }}
        >
          {status.message}
        </p>
      ) : null}

      {!view.canUseShop ? (
        <section style={panelStyle} data-testid="garage-upgrade-blocked">
          <h2 style={sectionTitleStyle}>Choose an owned car</h2>
          <p style={mutedTextStyle}>
            The active car is missing from your garage. Pick a starter or
            select an owned car before buying upgrades.
          </p>
          <Link href="/garage" style={primaryLinkStyle}>
            Return to garage
          </Link>
        </section>
      ) : (
        <ul style={listStyle} data-testid="garage-upgrade-list">
          {view.rows.map((row) => (
            <li
              key={row.category}
              style={cardStyle}
              data-testid={`garage-upgrade-row-${row.category}`}
            >
              <div>
                <h2 style={sectionTitleStyle}>{row.label}</h2>
                <dl style={summaryGridStyle}>
                  <div style={summaryRowStyle}>
                    <dt>Current</dt>
                    <dd data-testid={`garage-upgrade-current-${row.category}`}>
                      {row.currentLabel} (tier {row.currentTier})
                    </dd>
                  </div>
                  <div style={summaryRowStyle}>
                    <dt>Next</dt>
                    <dd data-testid={`garage-upgrade-next-${row.category}`}>
                      {row.nextLabel}
                    </dd>
                  </div>
                  <div style={summaryRowStyle}>
                    <dt>Cap</dt>
                    <dd data-testid={`garage-upgrade-cap-${row.category}`}>
                      Tier {row.cap}
                    </dd>
                  </div>
                </dl>
                <p style={mutedTextStyle}>{row.effectsLabel}</p>
                {row.disabledReason ? (
                  <p
                    style={reasonStyle}
                    data-testid={`garage-upgrade-reason-${row.category}`}
                  >
                    {row.disabledReason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!row.canPurchase || !row.nextUpgrade}
                title={row.disabledReason}
                style={buttonStyle(row.canPurchase)}
                data-testid={`buy-upgrade-${row.category}`}
                onClick={() => {
                  if (row.nextUpgrade) {
                    buyUpgrade(row.nextUpgrade.id, row.nextUpgrade.name);
                  }
                }}
              >
                {row.nextUpgrade ? `Buy ${row.nextUpgrade.name}` : "Max installed"}
              </button>
            </li>
          ))}
        </ul>
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

const mutedTextStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
  margin: "0.35rem 0",
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
  display: "inline-block",
  marginTop: "0.75rem",
  borderColor: "var(--accent, #8cf)",
  color: "var(--accent, #8cf)",
};

const statusStyle: CSSProperties = {
  margin: "0 0 1rem",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  maxWidth: "42rem",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
  gap: "1rem",
  padding: 0,
  margin: 0,
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  display: "grid",
  gap: "1rem",
  alignContent: "space-between",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  margin: "0.75rem 0",
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const reasonStyle: CSSProperties = {
  color: "#f5c37a",
  margin: "0.35rem 0 0",
};

function buttonStyle(enabled: boolean): CSSProperties {
  return {
    justifySelf: "start",
    border: `1px solid ${enabled ? "var(--accent, #8cf)" : "var(--muted, #555)"}`,
    borderRadius: "6px",
    color: enabled ? "var(--accent, #8cf)" : "var(--muted, #888)",
    background: "transparent",
    padding: "0.55rem 0.75rem",
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
