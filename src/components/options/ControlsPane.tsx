"use client";

/**
 * Controls remapping pane for /options.
 */

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import type { Action } from "@/game/input";
import { defaultSave, loadSave, saveSave } from "@/persistence";

import {
  CONTROL_ACTIONS,
  applyPrimaryKeyBinding,
  labelForAction,
  primaryBindingLabel,
  readKeyBindings,
  resetKeyBindings,
  tokenFromKeyboardEvent,
} from "./controlsPaneState";

interface PaneStatus {
  readonly kind: "idle" | "info" | "error";
  readonly message: string;
}

export function ControlsPane(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [listeningAction, setListeningAction] = useState<Action | null>(null);
  const [status, setStatus] = useState<PaneStatus>({ kind: "idle", message: "" });

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

  useEffect(() => {
    if (!listeningAction || !save) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const token = tokenFromKeyboardEvent(event);
      const result = applyPrimaryKeyBinding(save, listeningAction, token);
      const label = labelForAction(listeningAction);
      setListeningAction(null);

      if (result.kind === "noop") {
        setStatus({ kind: "info", message: `${label} already uses that key.` });
        return;
      }
      if (result.kind === "error") {
        setStatus({
          kind: "error",
          message: `${token} is already bound to ${labelForAction(result.conflictingAction)}.`,
        });
        return;
      }

      const write = saveSave(result.save);
      if (write.kind === "ok") {
        setSave(write.save);
        setStatus({ kind: "info", message: `${label} binding saved.` });
      } else {
        setSave(result.save);
        setStatus({
          kind: "error",
          message: `Save failed (${write.reason}); change kept in memory only.`,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [listeningAction, save]);

  const onReset = useCallback(() => {
    if (!save) return;
    const next = resetKeyBindings(save);
    setListeningAction(null);
    const write = saveSave(next);
    if (write.kind === "ok") {
      setSave(write.save);
      setStatus({ kind: "info", message: "Key bindings reset to defaults." });
    } else {
      setSave(next);
      setStatus({
        kind: "error",
        message: `Save failed (${write.reason}); defaults kept in memory only.`,
      });
    }
  }, [save]);

  if (!save) {
    return (
      <div data-testid="controls-pane-loading" style={loadingStyle}>
        Loading control bindings.
      </div>
    );
  }

  const bindings = readKeyBindings(save);

  return (
    <div data-testid="controls-pane" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>Control remapping</h2>
        <p style={subtitleStyle}>
          Desktop keyboard bindings persist to your save and apply when a race starts.
        </p>
      </header>

      <ul style={listStyle} data-testid="controls-bindings">
        {CONTROL_ACTIONS.map(({ action, label }) => {
          const listening = listeningAction === action;
          return (
            <li
              key={action}
              style={itemStyle(listening)}
              data-testid={`controls-row-${action}`}
              data-listening={listening ? "true" : "false"}
            >
              <span style={labelStyle}>{label}</span>
              <kbd
                style={keyStyle}
                data-testid={`controls-binding-${action}`}
              >
                {primaryBindingLabel(bindings, action)}
              </kbd>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  setListeningAction(action);
                  setStatus({
                    kind: "info",
                    message: `Press a key for ${label}.`,
                  });
                }}
                data-testid={`controls-remap-${action}`}
              >
                {listening ? "Listening" : "Change"}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        style={resetButtonStyle}
        onClick={onReset}
        data-testid="controls-reset-keybindings"
      >
        Reset key bindings
      </button>

      {status.kind !== "idle" ? (
        <p
          data-testid="controls-status"
          data-status={status.kind}
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

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function itemStyle(listening: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(8rem, 1fr) minmax(6rem, auto) auto",
    gap: "0.75rem",
    alignItems: "center",
    border: `1px solid ${listening ? "var(--accent, #8cf)" : "var(--muted, #444)"}`,
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    background: listening ? "rgba(140, 200, 255, 0.06)" : "transparent",
  };
}

const labelStyle: CSSProperties = {
  color: "var(--fg, #ddd)",
  fontWeight: 600,
};

const keyStyle: CSSProperties = {
  justifySelf: "start",
  minWidth: "4.5rem",
  border: "1px solid var(--muted, #555)",
  borderRadius: "4px",
  padding: "0.25rem 0.45rem",
  color: "var(--accent, #8cf)",
  background: "rgba(255, 255, 255, 0.04)",
  fontFamily: "var(--font-mono, monospace)",
};

const buttonStyle: CSSProperties = {
  border: "1px solid var(--muted, #555)",
  borderRadius: "6px",
  padding: "0.35rem 0.65rem",
  background: "transparent",
  color: "var(--fg, #ddd)",
  cursor: "pointer",
};

const resetButtonStyle: CSSProperties = {
  ...buttonStyle,
  alignSelf: "flex-start",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "#f88" : "var(--accent, #8cf)",
    fontSize: "0.9rem",
  };
}
