"use client";

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import type { AudioSettings, SaveGame } from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  AUDIO_CONTROLS,
  AUDIO_PANE_HEADLINE,
  AUDIO_PANE_SUBTITLE,
  applyAudioLevel,
  formatAudioPercent,
  readAudioSettings,
  type AudioLevelKey,
} from "./audioPaneState";

interface PaneStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

export function AudioPane(): ReactElement {
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

  const onSlider = useCallback(
    (key: AudioLevelKey, rawValue: string) => {
      if (!save) return;
      const result = applyAudioLevel(save, key, Number(rawValue));
      if (result.kind === "noop") return;
      const nextAudio = readAudioSettings(result.save);
      const control = AUDIO_CONTROLS.find((c) => c.key === key);
      persist(
        result.save,
        `${control?.label ?? key} set to ${formatAudioPercent(nextAudio[key])}.`,
      );
    },
    [persist, save],
  );

  if (!save) {
    return (
      <div data-testid="audio-pane-loading" style={loadingStyle}>
        Loading audio settings.
      </div>
    );
  }

  const audio = readAudioSettings(save);

  return (
    <div data-testid="audio-pane" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>{AUDIO_PANE_HEADLINE}</h2>
        <p style={subtitleStyle}>{AUDIO_PANE_SUBTITLE}</p>
      </header>

      <fieldset style={fieldsetStyle} aria-label="Audio mix">
        <legend style={legendStyle}>Mix levels</legend>
        <ul style={listStyle}>
          {AUDIO_CONTROLS.map((control) => (
            <AudioSlider
              key={control.key}
              control={control}
              audio={audio}
              onSlider={onSlider}
            />
          ))}
        </ul>
      </fieldset>

      {status.kind !== "idle" ? (
        <p data-testid="audio-status" style={statusStyle(status.kind)}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

interface AudioSliderProps {
  readonly control: (typeof AUDIO_CONTROLS)[number];
  readonly audio: AudioSettings;
  readonly onSlider: (key: AudioLevelKey, value: string) => void;
}

function AudioSlider({
  control,
  audio,
  onSlider,
}: AudioSliderProps): ReactElement {
  const id = `audio-slider-${control.key}`;
  const value = audio[control.key];

  return (
    <li style={itemStyle} data-testid={`audio-row-${control.key}`}>
      <label htmlFor={id} style={labelStyle}>
        <span style={labelTextStyle}>
          <span style={titleStyle}>{control.label}</span>
          <span style={descStyle}>{control.description}</span>
        </span>
        <span style={valueStyle} data-testid={`audio-value-${control.key}`}>
          {formatAudioPercent(value)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onSlider(control.key, e.currentTarget.value)}
        data-testid={`audio-slider-${control.key}`}
        style={sliderStyle}
      />
    </li>
  );
}

const paneStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const loadingStyle: CSSProperties = {
  color: "#e8eef7",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: "44rem",
  color: "#b8c4d6",
  lineHeight: 1.45,
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid rgba(162, 198, 255, 0.35)",
  borderRadius: "8px",
  padding: "1rem",
};

const legendStyle: CSSProperties = {
  padding: "0 0.4rem",
  color: "#e8eef7",
  fontWeight: 700,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const itemStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "start",
};

const labelTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
};

const titleStyle: CSSProperties = {
  color: "#f8fbff",
  fontWeight: 700,
};

const descStyle: CSSProperties = {
  color: "#b8c4d6",
  lineHeight: 1.35,
};

const valueStyle: CSSProperties = {
  color: "#f8fbff",
  fontVariantNumeric: "tabular-nums",
  minWidth: "3rem",
  textAlign: "right",
};

const sliderStyle: CSSProperties = {
  width: "100%",
};

const statusStyle = (kind: PaneStatus["kind"]): CSSProperties => ({
  margin: 0,
  color: kind === "error" ? "#ffb4b4" : "#c7f5d1",
});
