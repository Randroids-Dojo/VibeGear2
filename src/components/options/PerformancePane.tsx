"use client";

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import type { GraphicsSettings, SaveGame } from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  GRAPHICS_DRAW_DISTANCE_OPTIONS,
  GRAPHICS_PIXEL_RATIO_OPTIONS,
  GRAPHICS_SPRITE_DENSITY_OPTIONS,
  PERFORMANCE_PANE_HEADLINE,
  PERFORMANCE_PANE_SUBTITLE,
  applyGraphicsSettings,
  readGraphicsSettings,
  resetGraphicsSettings,
} from "./performancePaneState";

interface PaneStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

export function PerformancePane(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PaneStatus>({ kind: "idle", message: "" });

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

  const persist = useCallback((next: SaveGame, message: string) => {
    const result = saveSave(next);
    if (result.kind === "ok") {
      setSave(result.save);
      setStatus({ kind: "info", message });
      return;
    }

    setSave(next);
    setStatus({
      kind: "error",
      message: `Save failed (${result.reason}); change kept in memory only.`,
    });
  }, []);

  const applyPatch = useCallback(
    (patch: Partial<GraphicsSettings>, message: string) => {
      if (!save) return;
      const result = applyGraphicsSettings(save, patch);
      if (result.kind === "noop") return;
      persist(result.save, message);
    },
    [persist, save],
  );

  const onReset = useCallback(() => {
    if (!save) return;
    persist(resetGraphicsSettings(save), "Performance settings reset to defaults.");
  }, [persist, save]);

  if (!save) {
    return (
      <div data-testid="performance-pane-loading" style={loadingStyle}>
        Loading performance settings.
      </div>
    );
  }

  const graphics = readGraphicsSettings(save);

  return (
    <div data-testid="performance-pane" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>{PERFORMANCE_PANE_HEADLINE}</h2>
        <p style={subtitleStyle}>{PERFORMANCE_PANE_SUBTITLE}</p>
      </header>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Mode</legend>
        <label style={inlineLabelStyle}>
          <input
            type="checkbox"
            checked={graphics.mode === "auto"}
            onChange={(event) =>
              applyPatch(
                { mode: event.currentTarget.checked ? "auto" : "manual" },
                event.currentTarget.checked
                  ? "Automatic performance tuning enabled."
                  : "Manual performance tuning enabled.",
              )
            }
            data-testid="performance-mode-auto"
          />
          Auto tune for this device
        </label>
      </fieldset>

      <label style={selectLabelStyle}>
        <span style={selectTitleStyle}>Draw distance</span>
        <select
          value={graphics.drawDistance}
          disabled={graphics.mode === "auto"}
          onChange={(event) =>
            applyPatch(
              { drawDistance: event.currentTarget.value as GraphicsSettings["drawDistance"] },
              "Draw distance updated.",
            )
          }
          data-testid="performance-draw-distance"
        >
          {GRAPHICS_DRAW_DISTANCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={selectLabelStyle}>
        <span style={selectTitleStyle}>Sprite density</span>
        <select
          value={graphics.spriteDensity}
          disabled={graphics.mode === "auto"}
          onChange={(event) =>
            applyPatch(
              { spriteDensity: Number(event.currentTarget.value) as GraphicsSettings["spriteDensity"] },
              "Sprite density updated.",
            )
          }
          data-testid="performance-sprite-density"
        >
          {GRAPHICS_SPRITE_DENSITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={selectLabelStyle}>
        <span style={selectTitleStyle}>Pixel ratio cap</span>
        <select
          value={graphics.pixelRatioCap}
          disabled={graphics.mode === "auto"}
          onChange={(event) =>
            applyPatch(
              { pixelRatioCap: Number(event.currentTarget.value) as GraphicsSettings["pixelRatioCap"] },
              "Pixel ratio cap updated.",
            )
          }
          data-testid="performance-pixel-ratio"
        >
          {GRAPHICS_PIXEL_RATIO_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" style={buttonStyle} onClick={onReset} data-testid="performance-reset">
        Reset performance settings
      </button>

      {status.kind !== "idle" ? (
        <p style={statusStyle(status.kind)} data-testid="performance-status">
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

const inlineLabelStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  alignItems: "center",
  color: "var(--fg, #ddd)",
};

const selectLabelStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  color: "var(--fg, #ddd)",
};

const selectTitleStyle: CSSProperties = {
  fontWeight: 700,
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  border: "1px solid var(--muted, #555)",
  borderRadius: "6px",
  padding: "0.4rem 0.7rem",
  background: "transparent",
  color: "var(--fg, #ddd)",
  cursor: "pointer",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "var(--danger, #f88)" : "var(--accent, #8cf)",
  };
}
