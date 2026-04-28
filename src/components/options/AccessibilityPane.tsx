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
  FOG_READABILITY_CLAMP_LABEL,
  PANE_HEADLINE,
  PANE_SUBTITLE,
  WEATHER_PARTICLE_INTENSITY_LABEL,
  WEATHER_SETTINGS_HEADLINE,
  WEATHER_SETTINGS_SUBTITLE,
  applyFogReadabilityClamp,
  applyAssistToggle,
  applyWeatherAccessibilityToggle,
  applyWeatherParticleIntensity,
  isAssistActive,
  readWeatherAccessibility,
  type WeatherAccessibilityToggleKey,
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

  const persist = useCallback((next: SaveGame, successMessage: string) => {
    const writeResult = saveSave(next);
    if (writeResult.kind === "ok") {
      setSave({
        ...next,
        writeCounter: (next.writeCounter ?? 0) + 1,
      });
      setStatus({ kind: "info", message: successMessage });
      return;
    }
    setSave(next);
    setStatus({
      kind: "error",
      message: `Save failed (${writeResult.reason}); change kept in memory only.`,
    });
  }, []);

  const onToggle = useCallback(
    (key: AssistFieldKey, value: boolean) => {
      if (!save) return;
      const result = applyAssistToggle(save, key, value);
      if (result.kind === "noop") return;
      const label = ASSISTS.find((a) => a.key === key)?.label ?? key;
      persist(result.save, `${label} ${value ? "enabled" : "disabled"}.`);
    },
    [persist, save],
  );

  const onWeatherToggle = useCallback(
    (key: WeatherAccessibilityToggleKey, value: boolean) => {
      if (!save) return;
      const result = applyWeatherAccessibilityToggle(save, key, value);
      if (result.kind === "noop") return;
      const label =
        key === "reducedWeatherGlare" ? "Reduced glare" : "Flash reduction";
      persist(result.save, `${label} ${value ? "enabled" : "disabled"}.`);
    },
    [persist, save],
  );

  const onWeatherSlider = useCallback(
    (
      kind: "weatherParticleIntensity" | "fogReadabilityClamp",
      rawValue: string,
    ) => {
      if (!save) return;
      const value = Number(rawValue);
      const result =
        kind === "weatherParticleIntensity"
          ? applyWeatherParticleIntensity(save, value)
          : applyFogReadabilityClamp(save, value);
      if (result.kind === "noop") return;
      const label =
        kind === "weatherParticleIntensity"
          ? WEATHER_PARTICLE_INTENSITY_LABEL
          : FOG_READABILITY_CLAMP_LABEL;
      const clamped = readWeatherAccessibility(result.save)[kind];
      persist(result.save, `${label} set to ${formatPercent(clamped)}.`);
    },
    [persist, save],
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

      <WeatherSettings
        save={save}
        onToggle={onWeatherToggle}
        onSlider={onWeatherSlider}
      />

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

interface WeatherSettingsProps {
  save: SaveGame;
  onToggle(key: WeatherAccessibilityToggleKey, value: boolean): void;
  onSlider(
    key: "weatherParticleIntensity" | "fogReadabilityClamp",
    value: string,
  ): void;
}

function WeatherSettings({
  save,
  onToggle,
  onSlider,
}: WeatherSettingsProps): ReactElement {
  const weather = readWeatherAccessibility(save);
  return (
    <fieldset
      style={fieldsetStyle}
      aria-label="Weather visibility"
      data-testid="accessibility-weather-settings"
    >
      <legend style={legendStyle}>{WEATHER_SETTINGS_HEADLINE}</legend>
      <p style={weatherSubtitleStyle}>{WEATHER_SETTINGS_SUBTITLE}</p>

      <label style={sliderLabelStyle} htmlFor="weather-particle-intensity">
        <span style={titleStyle}>{WEATHER_PARTICLE_INTENSITY_LABEL}</span>
        <input
          id="weather-particle-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={weather.weatherParticleIntensity}
          onChange={(e) =>
            onSlider("weatherParticleIntensity", e.currentTarget.value)
          }
          data-testid="accessibility-weather-particle-intensity"
        />
        <span
          style={sliderValueStyle}
          data-testid="accessibility-weather-particle-intensity-value"
        >
          {formatPercent(weather.weatherParticleIntensity)}
        </span>
      </label>

      <label style={sliderLabelStyle} htmlFor="fog-readability-clamp">
        <span style={titleStyle}>{FOG_READABILITY_CLAMP_LABEL}</span>
        <input
          id="fog-readability-clamp"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={weather.fogReadabilityClamp}
          onChange={(e) => onSlider("fogReadabilityClamp", e.currentTarget.value)}
          data-testid="accessibility-fog-readability-clamp"
        />
        <span
          style={sliderValueStyle}
          data-testid="accessibility-fog-readability-clamp-value"
        >
          {formatPercent(weather.fogReadabilityClamp)}
        </span>
      </label>

      <ul style={listStyle}>
        <li
          style={itemStyle(weather.reducedWeatherGlare)}
          data-testid="accessibility-row-reducedWeatherGlare"
          data-active={weather.reducedWeatherGlare ? "true" : "false"}
        >
          <label htmlFor="accessibility-toggle-reducedWeatherGlare" style={labelStyle}>
            <input
              id="accessibility-toggle-reducedWeatherGlare"
              type="checkbox"
              checked={weather.reducedWeatherGlare}
              onChange={(e) =>
                onToggle("reducedWeatherGlare", e.currentTarget.checked)
              }
              data-testid="accessibility-toggle-reducedWeatherGlare"
            />
            <span style={textStyle}>
              <span style={titleStyle}>Reduced glare</span>
              <span style={descStyle}>Dampen dusk and night weather bloom.</span>
            </span>
          </label>
        </li>
        <li
          style={itemStyle(weather.weatherFlashReduction)}
          data-testid="accessibility-row-weatherFlashReduction"
          data-active={weather.weatherFlashReduction ? "true" : "false"}
        >
          <label htmlFor="accessibility-toggle-weatherFlashReduction" style={labelStyle}>
            <input
              id="accessibility-toggle-weatherFlashReduction"
              type="checkbox"
              checked={weather.weatherFlashReduction}
              onChange={(e) =>
                onToggle("weatherFlashReduction", e.currentTarget.checked)
              }
              data-testid="accessibility-toggle-weatherFlashReduction"
            />
            <span style={textStyle}>
              <span style={titleStyle}>Flash reduction</span>
              <span style={descStyle}>Reduce high-contrast weather flashes.</span>
            </span>
          </label>
        </li>
      </ul>
    </fieldset>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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

const weatherSubtitleStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--muted, #aaa)",
  fontSize: "0.85rem",
};

const sliderLabelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(10rem, 1fr) minmax(9rem, 2fr) 3.5rem",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};

const sliderValueStyle: CSSProperties = {
  color: "var(--fg, #ddd)",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "#f88" : "var(--accent, #8cf)",
    fontSize: "0.9rem",
  };
}
