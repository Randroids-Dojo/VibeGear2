"use client";

/**
 * Results-screen finishing-order table per `docs/gdd/20-hud-and-ui-ux.md`
 * Results screen "finishing order" requirement.
 *
 * One row per car. The player row is highlighted via a data attribute so
 * Playwright can target it directly. DNF cars render "DNF" in the
 * position column instead of a numeric place, per the iter-26 stress-test
 * "Did Not Finish label replaces the position".
 */

import type { CSSProperties, ReactElement } from "react";

import type { FinalCarRecord } from "@/game/raceRules";

export interface FinishingOrderTableProps {
  rows: ReadonlyArray<FinalCarRecord>;
  playerCarId: string;
}

export function FinishingOrderTable(props: FinishingOrderTableProps): ReactElement {
  const { rows, playerCarId } = props;
  return (
    <table data-testid="results-finishing-order" style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Pos</th>
          <th style={thStyle}>Car</th>
          <th style={thStyle}>Race time</th>
          <th style={thStyle}>Best lap</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const isPlayer = row.carId === playerCarId;
          const place = row.status === "finished" ? `${idx + 1}` : "DNF";
          return (
            <tr
              key={row.carId}
              data-testid={`results-row-${row.carId}`}
              data-player={isPlayer ? "true" : "false"}
              data-status={row.status}
              style={isPlayer ? playerRowStyle : rowStyle}
            >
              <td style={tdStyle}>{place}</td>
              <td style={tdStyle}>{row.carId}</td>
              <td style={tdStyle}>{formatMs(row.raceTimeMs)}</td>
              <td style={tdStyle}>{formatMs(row.bestLapMs)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "--:--.---";
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

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.95rem",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  borderBottom: "1px solid var(--muted, #555)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontSize: "0.8rem",
};

const tdStyle: CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const rowStyle: CSSProperties = {};

const playerRowStyle: CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  fontWeight: 600,
};
