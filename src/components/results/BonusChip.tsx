"use client";

/**
 * Bonus chip per `docs/gdd/20-hud-and-ui-ux.md` Results screen "bonuses".
 *
 * Renders a single bonus as a pill: label on the left, cash value on the
 * right. The chip kind is exposed as a data attribute so Playwright can
 * assert presence by kind without re-deriving from the visible text.
 */

import type { CSSProperties, ReactElement } from "react";

import type { RaceBonus } from "@/game/raceResult";

export interface BonusChipProps {
  bonus: RaceBonus;
}

export function BonusChip(props: BonusChipProps): ReactElement {
  const { bonus } = props;
  return (
    <span
      data-testid={`results-bonus-${bonus.kind}`}
      data-kind={bonus.kind}
      style={chipStyle}
    >
      <span style={labelStyle}>{bonus.label}</span>
      <span style={valueStyle}>+{bonus.cashCredits.toLocaleString("en-US")}</span>
    </span>
  );
}

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.3rem 0.7rem",
  borderRadius: "999px",
  border: "1px solid var(--muted, #888)",
  background: "rgba(255,255,255,0.04)",
  fontSize: "0.85rem",
  fontFamily: "system-ui, sans-serif",
};

const labelStyle: CSSProperties = {
  fontWeight: 500,
};

const valueStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "var(--accent, #6cf)",
};
