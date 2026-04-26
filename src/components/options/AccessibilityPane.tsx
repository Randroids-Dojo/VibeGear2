"use client";

/**
 * Accessibility assists pane for /options (GDD §19, §20). Surfaces the
 * six §19 assists as labelled toggles, persists each change to
 * `SaveGameSettings.assists` via the existing localStorage save module,
 * and wires per-row data-testids the matching Playwright spec asserts
 * against.
 *
 * The pure model lives in `./accessibilityPaneState.ts` so the §19
 * catalogue and the toggle-mutation logic stay unit-testable under the
 * default node Vitest environment without RTL or jsdom. This file is
 * the thin React shell that hydrates from `loadSave()` after mount and
 * commits each change synchronously via `saveSave()`. Pattern matches
 * `DifficultyPane.tsx`.
 */

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import type { AssistFieldKey, SaveGame } from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  ASSISTS,
  PANE_HEADLINE,
  PANE_SUBTITLE,
  applyAssistToggle,
  isAssistActive,
} from "./accessibilityPaneState";

interface PaneStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

export function AccessibilityPane(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PaneStatus>({ kind: "idle", message: "" });

  // Hydrate after mount so SSG never touches localStorage.
  useEffect(() => {
    const outcome = loadSave();
    if (outcome.kind === "loaded") {
      setSave(outcome.save);
    } else {
      setSave(defaultSave());
      if (outcome.reason !== "missing" && outcome.reason !== "no-storage") {
        setStatus({
          kind: "info",
          message: `Loaded default save (reason: ${outcome.reason}).`,
        });
      }
    }
  }, []);

  const onToggle = useCallback(
    (key: AssistFieldKey, value: boolean) => {
      if (!save) return;
      const result = applyAssistToggle(save, key, value);
      if (result.kind === "noop") return;
      setSave(result.save);
      const writeResult = saveSave(result.save);
      const label = ASSISTS.find((a) => a.key === key)?.label ?? key;
      if (writeResult.kind === "ok") {
        setStatus({
          kind: "info",
          message: `${label} ${value ? "enabled" : "disabled"}.`,
        });
      } else {
        setStatus({
          kind: "error",
          message: `Save failed (${writeResult.reason}); change kept in memory only.`,
        });
      }
    },
    [save],
  );

  if (!save) {
    return (
      <div data-testid="accessibility-pane-loading" style={loadingStyle}>
        Loading accessibility settings.
      </div>
    );
  }

  return (
    <div data-testid="accessibility-pane" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>{PANE_HEADLINE}</h2>
        <p style={subtitleStyle}>{PANE_SUBTITLE}</p>
      </header>

      <fieldset
        style={fieldsetStyle}
        aria-label="Accessibility assists"
        data-testid="accessibility-toggles"
      >
        <legend style={legendStyle}>Assists</legend>
        <ul style={listStyle}>
          {ASSISTS.map((assist) => {
            const active = isAssistActive(save, assist.key);
            const inputId = `accessibility-toggle-${assist.key}`;
            return (
              <li
                key={assist.key}
                style={itemStyle(active)}
                data-testid={`accessibility-row-${assist.key}`}
                data-active={active ? "true" : "false"}
              >
                <label htmlFor={inputId} style={labelStyle}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={active}
                    onChange={(e) => onToggle(assist.key, e.target.checked)}
                    data-testid={`accessibility-toggle-${assist.key}`}
                  />
                  <span style={textStyle}>
                    <span style={titleStyle}>{assist.label}</span>
                    <span
                      style={descStyle}
                      data-testid={`accessibility-description-${assist.key}`}
                    >
                      {assist.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {status.kind !== "idle" ? (
        <p
          data-testid="accessibility-status"
          style={statusStyle(status.kind)}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

const paneStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const loadingStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  color: "var(--fg, #ddd)",
  fontSize: "1.05rem",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted, #aaa)",
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "6px",
  padding: "0.75rem 1rem 1rem",
  margin: 0,
};

const legendStyle: CSSProperties = {
  padding: "0 0.5rem",
  color: "var(--accent, #8cf)",
  fontSize: "0.95rem",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

function itemStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${
      active ? "var(--accent, #8cf)" : "var(--muted, #444)"
    }`,
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    background: active ? "rgba(140, 200, 255, 0.06)" : "transparent",
  };
}

const labelStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
  cursor: "pointer",
};

const textStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  color: "var(--fg, #ddd)",
};

const descStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
  fontSize: "0.85rem",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "#f88" : "var(--accent, #8cf)",
    fontSize: "0.9rem",
  };
}
