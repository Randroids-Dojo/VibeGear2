"use client";

/**
 * Damage bar per `docs/gdd/20-hud-and-ui-ux.md` Results screen
 * "damage taken".
 *
 * Renders one row per damage zone: zone label, a horizontal bar showing
 * the post-race damage delta, and a percent label. Zones with zero
 * delta still render so the player can confirm the clean-race chip
 * (each row reads "0%").
 */

import type { CSSProperties, ReactElement } from "react";

import type { DamageDelta } from "@/game/raceResult";

export interface DamageBarProps {
  delta: DamageDelta;
}

interface ZoneRow {
  key: keyof DamageDelta;
  label: string;
}

const ZONES: ReadonlyArray<ZoneRow> = [
  { key: "engine", label: "Engine" },
  { key: "tires", label: "Tires" },
  { key: "body", label: "Body" },
];

export function DamageBar(props: DamageBarProps): ReactElement {
  const { delta } = props;
  return (
    <ul data-testid="results-damage-bars" style={listStyle}>
      {ZONES.map((zone) => {
        const value = delta[zone.key];
        const pct = Math.round(value * 100);
        return (
          <li key={zone.key} data-zone={zone.key} style={rowStyle}>
            <span style={labelStyle}>{zone.label}</span>
            <div
              role="progressbar"
              aria-label={`${zone.label} damage`}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={trackStyle}
              data-testid={`results-damage-${zone.key}-track`}
            >
              <div
                style={{
                  ...fillStyle,
                  width: `${pct}%`,
                  background: pickColour(pct),
                }}
              />
            </div>
            <span
              style={percentStyle}
              data-testid={`results-damage-${zone.key}-percent`}
            >
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function pickColour(percent: number): string {
  if (percent <= 5) return "var(--ok, #4caf50)";
  if (percent <= 25) return "var(--warn, #f5a623)";
  return "var(--danger, #e74c3c)";
}

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "5rem 1fr 3rem",
  alignItems: "center",
  gap: "0.6rem",
};

const labelStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontFamily: "system-ui, sans-serif",
};

const trackStyle: CSSProperties = {
  height: "0.6rem",
  borderRadius: "3px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--muted, #555)",
  overflow: "hidden",
};

const fillStyle: CSSProperties = {
  height: "100%",
  transition: "width 200ms ease-out",
};

const percentStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.85rem",
  textAlign: "right",
};
