"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import {
  buildGarageRepairView,
  repairFailureMessage,
  repairGarageDamage,
  type GarageRepairKind,
  type GarageRepairQuote,
} from "@/components/garage/garageRepairState";
import { defaultSave, loadSave, saveSave } from "@/persistence";

interface PageStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

export default function GarageRepairPage() {
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
    () => (save ? buildGarageRepairView(save) : null),
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

  const repair = useCallback(
    (kind: GarageRepairKind) => {
      if (!save) return;
      const result = repairGarageDamage(save, kind);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message: repairFailureMessage(result.failure),
        });
        return;
      }
      const label = kind === "essential" ? "Essential repair" : "Full service";
      persist(result.state, `${label} complete (${result.cashSpent ?? 0} credits).`);
    },
    [persist, save],
  );

  if (!save || !view) {
    return (
      <main style={pageStyle} data-testid="garage-repair-page">
        <h1>Garage. Repairs</h1>
        <p data-testid="garage-loading">Loading repairs</p>
      </main>
    );
  }

  return (
    <main style={pageStyle} data-testid="garage-repair-page">
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Garage. Repairs</h1>
          <p style={mutedTextStyle}>
            Active car:{" "}
            <strong data-testid="garage-repair-active-car">
              {view.activeCar?.name ?? view.activeCarId}
            </strong>
            . Credits:{" "}
            <strong data-testid="garage-repair-credits">{view.credits}</strong>.
          </p>
        </div>
        <nav style={navStyle} aria-label="Garage repair actions">
          <Link href="/garage" style={linkStyle} data-testid="garage-repair-back">
            Back to garage
          </Link>
          <Link href="/garage/cars" style={linkStyle}>
            Cars
          </Link>
        </nav>
      </header>

      {status.kind !== "idle" ? (
        <p
          data-testid="garage-repair-status"
          style={{
            ...statusStyle,
            color: status.kind === "error" ? "#ff9a9a" : "#9bd2ff",
          }}
          role="status"
          aria-live={status.kind === "error" ? "assertive" : "polite"}
        >
          {status.message}
        </p>
      ) : null}

      {!view.canUseShop ? (
        <section style={panelStyle} data-testid="garage-repair-blocked">
          <h2 style={sectionTitleStyle}>Choose an owned car</h2>
          <p style={mutedTextStyle}>
            The active car is missing from your garage. Pick a starter or
            select an owned car before repairing damage.
          </p>
          <Link href="/garage" style={primaryLinkStyle}>
            Return to garage
          </Link>
        </section>
      ) : (
        <div style={layoutStyle}>
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Damage</h2>
            <dl style={summaryGridStyle}>
              {view.rows.map((row) => (
                <div key={row.zone} style={summaryRowStyle}>
                  <dt>{row.label}</dt>
                  <dd data-testid={`garage-repair-damage-${row.zone}`}>
                    {row.damagePercent}% damage. Full repair {row.fullCost} credits.
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <RepairCard
            quote={view.full}
            onRepair={() => repair("full")}
            testId="full"
          />
          <RepairCard
            quote={view.essential}
            onRepair={() => repair("essential")}
            testId="essential"
          />
        </div>
      )}
    </main>
  );
}

function RepairCard({
  quote,
  onRepair,
  testId,
}: {
  readonly quote: GarageRepairQuote;
  readonly onRepair: () => void;
  readonly testId: string;
}) {
  const enabled = quote.disabledReason === "";
  return (
    <section style={panelStyle} data-testid={`garage-repair-${testId}`}>
      <h2 style={sectionTitleStyle}>{quote.label}</h2>
      <p style={mutedTextStyle}>
        Cost: <strong data-testid={`garage-repair-cost-${testId}`}>{quote.cost}</strong>
        {quote.saved > 0 ? (
          <span data-testid={`garage-repair-saved-${testId}`}>
            {" "}
            (catch-up cap saved {quote.saved})
          </span>
        ) : null}
      </p>
      <ul style={breakdownStyle}>
        {quote.breakdown.map((entry) => (
          <li key={entry.zone}>
            {entry.zone}: {entry.credits}
          </li>
        ))}
      </ul>
      {quote.disabledReason ? (
        <p style={reasonStyle} data-testid={`garage-repair-reason-${testId}`}>
          {quote.disabledReason}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!enabled}
        title={quote.disabledReason}
        style={buttonStyle(enabled)}
        data-testid={`garage-repair-button-${testId}`}
        onClick={onRepair}
      >
        {quote.label}
      </button>
    </section>
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

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
  gap: "1rem",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  margin: "0.75rem 0",
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const breakdownStyle: CSSProperties = {
  margin: "0.75rem 0",
  paddingLeft: "1.25rem",
};

const reasonStyle: CSSProperties = {
  color: "#f5c37a",
  margin: "0.35rem 0",
};

function buttonStyle(enabled: boolean): CSSProperties {
  return {
    border: `1px solid ${enabled ? "var(--accent, #8cf)" : "var(--muted, #555)"}`,
    borderRadius: "6px",
    color: enabled ? "var(--accent, #8cf)" : "var(--muted, #888)",
    background: "transparent",
    padding: "0.55rem 0.75rem",
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
