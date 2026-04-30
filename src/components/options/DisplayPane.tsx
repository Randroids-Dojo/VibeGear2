"use client";

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import type { SaveGame, SpeedUnit } from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  DISPLAY_PANE_HEADLINE,
  DISPLAY_PANE_SUBTITLE,
  DISPLAY_SPEED_UNIT_OPTIONS,
  applyDisplaySpeedUnit,
  readDisplaySpeedUnit,
} from "./displayPaneState";

interface PaneStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

export function DisplayPane(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PaneStatus>({
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

  const persist = useCallback((next: SaveGame, successMessage: string) => {
    const writeResult = saveSave(next);
    if (writeResult.kind === "ok") {
      setSave(writeResult.save);
      setStatus({ kind: "info", message: successMessage });
      return;
    }

    setSave(next);
    setStatus({
      kind: "error",
      message: `Save failed (${writeResult.reason}); change kept in memory only.`,
    });
  }, []);

  const onSpeedUnit = useCallback(
    (unit: SpeedUnit) => {
      if (!save) return;
      const result = applyDisplaySpeedUnit(save, unit);
      if (result.kind === "noop") return;
      const option = DISPLAY_SPEED_UNIT_OPTIONS.find((item) => item.value === unit);
      persist(result.save, `Speed unit set to ${option?.label ?? unit}.`);
    },
    [persist, save],
  );

  if (!save) {
    return (
      <div data-testid="display-pane-loading" style={loadingStyle}>
        Loading display settings.
      </div>
    );
  }

  const speedUnit = readDisplaySpeedUnit(save);

  return (
    <div data-testid="display-pane" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>{DISPLAY_PANE_HEADLINE}</h2>
        <p style={subtitleStyle}>{DISPLAY_PANE_SUBTITLE}</p>
      </header>

      <fieldset style={fieldsetStyle} aria-label="Speed unit">
        <legend style={legendStyle}>Speed unit</legend>
        <ul style={listStyle}>
          {DISPLAY_SPEED_UNIT_OPTIONS.map((option) => {
            const checked = speedUnit === option.value;
            const id = `display-speed-unit-${option.value}`;
            return (
              <li
                key={option.value}
                style={itemStyle(checked)}
                data-testid={`display-speed-unit-row-${option.value}`}
                data-active={checked ? "true" : "false"}
              >
                <label htmlFor={id} style={labelStyle}>
                  <input
                    id={id}
                    type="radio"
                    name="display-speed-unit"
                    value={option.value}
                    checked={checked}
                    onChange={() => onSpeedUnit(option.value)}
                    data-testid={`display-speed-unit-${option.value}`}
                  />
                  <span style={textStyle}>
                    <span style={titleStyle}>{option.label}</span>
                    <span style={descStyle}>{option.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {status.kind !== "idle" ? (
        <p data-testid="display-status" style={statusStyle(status.kind)}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

const paneStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const loadingStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  color: "var(--fg, #ddd)",
  fontSize: "1.2rem",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: "44rem",
  color: "var(--muted, #aaa)",
  lineHeight: 1.45,
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
};

const legendStyle: CSSProperties = {
  padding: "0 0.4rem",
  color: "var(--accent, #8cf)",
  fontWeight: 700,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function itemStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? "var(--accent, #8cf)" : "var(--muted, #444)"}`,
    borderRadius: "8px",
    padding: "0.75rem",
    background: active ? "rgba(111, 170, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
  };
}

const labelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: "0.75rem",
  alignItems: "start",
  cursor: "pointer",
};

const textStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
};

const titleStyle: CSSProperties = {
  color: "var(--fg, #ddd)",
  fontWeight: 700,
};

const descStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
  lineHeight: 1.35,
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "var(--danger, #f88)" : "var(--accent, #8cf)",
  };
}
