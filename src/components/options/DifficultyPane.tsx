"use client";

/**
 * Difficulty preset selection pane for /options (GDD §15 'Difficulty tiers',
 * §20 Settings). Renders a radio-group of the four §15 tiers (Easy, Normal,
 * Hard, Master), persists the selection to `SaveGameSettings.difficultyPreset`
 * via the existing localStorage save module, and shows the §15 detail row
 * for the active preset (AI pace, rubber-banding, mistakes, economy
 * pressure).
 *
 * The pure model lives in `./difficultyPaneState.ts` so the §15 table,
 * unlock predicate, and selection mutation are unit-testable under the
 * default node Vitest environment without RTL or jsdom. This file is the
 * thin React shell that hydrates from `loadSave()` after mount and commits
 * each change synchronously via `saveSave()`. Pattern matches
 * `src/app/garage/cars/page.tsx`.
 *
 * Per the dot edge cases:
 * - Default is Normal on a fresh save (set in `defaultSave()` and treated
 *   as the fallback when the optional save field is undefined).
 * - Master is unlock-gated. The locked tile cannot be selected and its
 *   `title` tooltip surfaces the §15 unlock condition wording.
 * - Mid-tour difficulty change: the active championship's preset is
 *   captured at tour-enter time, so changing the UI preset only affects
 *   future tours. The pane shows this as a note above the radio group.
 */

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PlayerDifficultyPreset,
  SaveGame,
} from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  PRESETS,
  MASTER_UNLOCK_HINT,
  MID_TOUR_NOTE,
  applyPresetSelection,
  getPresetSpec,
  isMasterUnlocked,
  readPreset,
} from "./difficultyPaneState";

interface PaneStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

export function DifficultyPane(): ReactElement {
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

  const masterUnlocked = useMemo(
    () => (save ? isMasterUnlocked(save) : false),
    [save],
  );

  const activePreset: PlayerDifficultyPreset = save
    ? readPreset(save)
    : "normal";
  const activeSpec = getPresetSpec(activePreset);

  const onSelect = useCallback(
    (preset: PlayerDifficultyPreset) => {
      if (!save) return;
      const result = applyPresetSelection(save, preset);
      if (result.kind === "noop") return;
      setSave(result.save);
      const writeResult = saveSave(result.save);
      const label = getPresetSpec(preset).label;
      if (writeResult.kind === "ok") {
        setStatus({
          kind: "info",
          message: `Difficulty preset set to ${label}.`,
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
      <div data-testid="difficulty-pane-loading" style={loadingStyle}>
        Loading difficulty settings.
      </div>
    );
  }

  return (
    <div data-testid="difficulty-pane" style={paneStyle}>
      <fieldset
        style={fieldsetStyle}
        role="radiogroup"
        aria-label="Difficulty preset"
        data-testid="difficulty-presets"
      >
        <legend style={legendStyle}>Difficulty preset</legend>
        <p style={noteStyle} data-testid="difficulty-mid-tour-note">
          <small>{MID_TOUR_NOTE}</small>
        </p>
        <ul style={listStyle}>
          {PRESETS.map((preset) => {
            const selected = preset.id === activePreset;
            const locked = preset.id === "master" && !masterUnlocked;
            const tooltip = locked ? MASTER_UNLOCK_HINT : "";
            return (
              <li key={preset.id} style={itemStyle(selected, locked)}>
                <label
                  style={labelStyle(locked)}
                  data-testid={`difficulty-preset-${preset.id}`}
                  data-locked={locked ? "true" : "false"}
                  data-selected={selected ? "true" : "false"}
                  title={tooltip}
                >
                  <input
                    type="radio"
                    name="difficulty-preset"
                    value={preset.id}
                    checked={selected}
                    disabled={locked}
                    aria-disabled={locked || undefined}
                    onChange={() => onSelect(preset.id)}
                    data-testid={`difficulty-preset-${preset.id}-input`}
                  />
                  <span style={presetLabelStyle}>{preset.label}</span>
                  {locked ? (
                    <span
                      style={lockedBadgeStyle}
                      data-testid="difficulty-preset-master-locked"
                    >
                      Locked
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <section
        style={detailStyle}
        aria-label="Preset detail"
        data-testid="difficulty-detail"
        data-active-preset={activeSpec.id}
      >
        <h3 style={detailTitleStyle}>{activeSpec.label}</h3>
        <p style={summaryStyle} data-testid="difficulty-detail-summary">
          {activeSpec.summary}
        </p>
        <dl style={detailGridStyle}>
          <dt style={dtStyle}>AI pace</dt>
          <dd style={ddStyle} data-testid="difficulty-detail-ai-pace">
            {activeSpec.aiPace}
          </dd>
          <dt style={dtStyle}>Rubber banding</dt>
          <dd style={ddStyle} data-testid="difficulty-detail-rubber-banding">
            {activeSpec.rubberBanding}
          </dd>
          <dt style={dtStyle}>Mistakes</dt>
          <dd style={ddStyle} data-testid="difficulty-detail-mistakes">
            {activeSpec.mistakes}
          </dd>
          <dt style={dtStyle}>Economy pressure</dt>
          <dd style={ddStyle} data-testid="difficulty-detail-economy">
            {activeSpec.economyPressure}
          </dd>
        </dl>
      </section>

      {status.kind !== "idle" ? (
        <p
          data-testid="difficulty-status"
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

const noteStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--muted, #aaa)",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
  gap: "0.5rem",
};

function itemStyle(selected: boolean, locked: boolean): CSSProperties {
  return {
    border: `1px solid ${
      selected ? "var(--accent, #8cf)" : "var(--muted, #444)"
    }`,
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    background: selected ? "rgba(140, 200, 255, 0.06)" : "transparent",
    opacity: locked ? 0.6 : 1,
  };
}

function labelStyle(locked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: locked ? "not-allowed" : "pointer",
  };
}

const presetLabelStyle: CSSProperties = {
  flex: 1,
};

const lockedBadgeStyle: CSSProperties = {
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted, #888)",
  border: "1px solid var(--muted, #888)",
  borderRadius: "4px",
  padding: "0.05rem 0.35rem",
};

const detailStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "6px",
  padding: "0.75rem 1rem 1rem",
  background: "rgba(255, 255, 255, 0.02)",
};

const detailTitleStyle: CSSProperties = {
  margin: "0 0 0.25rem",
  color: "var(--fg, #ddd)",
  fontSize: "1.05rem",
};

const summaryStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--muted, #aaa)",
  lineHeight: 1.45,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  rowGap: "0.2rem",
  columnGap: "1rem",
  margin: 0,
};

const dtStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
};

const ddStyle: CSSProperties = {
  margin: 0,
  textAlign: "right",
  color: "var(--fg, #ddd)",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "#f88" : "var(--accent, #8cf)",
    fontSize: "0.9rem",
  };
}
