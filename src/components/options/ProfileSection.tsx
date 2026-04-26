"use client";

/**
 * Profile pane for /options (GDD §20 Save and load: Manual profile
 * export / import). Renders three buttons:
 *
 * - Export profile: serialises the current save via `exportProfile()`,
 *   wraps it in an object URL, programmatically clicks a hidden anchor
 *   so the browser triggers the file download dialog. The object URL
 *   is revoked on the next animation frame to release the blob.
 * - Import profile: opens a hidden `<input type="file">`. On change,
 *   reads the file as text, runs it through `importProfile()`, and on
 *   success persists via `saveSave()` and re-renders the pane.
 * - Clear save: removes the current-version key (and the backup key
 *   if present) from localStorage after a confirm dialog.
 *
 * The pure parse / serialise functions live in
 * `src/persistence/profileExport.ts` so they can be unit-tested
 * without DOM, Storage, or React. This file is the thin shell that
 * wires the file dialog and the save lifecycle. Pattern follows
 * `AccessibilityPane.tsx` (hydrate after mount, persist on change).
 */

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SaveGame } from "@/data/schemas";
import {
  CURRENT_SAVE_VERSION,
  defaultSave,
  exportProfile,
  importProfile,
  loadSave,
  saveSave,
  storageKey,
  backupKey,
} from "@/persistence";

interface PaneStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

const CONFIRM_CLEAR_MESSAGE =
  "Clear your local save? This removes credits, garage, progress, and records. There is no undo unless you exported first.";

export function ProfileSection(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PaneStatus>({ kind: "idle", message: "" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate after mount so SSG never touches localStorage. Same
  // pattern as AccessibilityPane.
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

  const onExport = useCallback(() => {
    if (!save) return;
    let exported: ReturnType<typeof exportProfile>;
    try {
      exported = exportProfile(save);
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Export failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }

    // Trigger the file dialog by programmatically clicking a hidden
    // anchor whose href is the blob's object URL. The anchor is
    // created in JS so we never have to mount it into the React tree.
    const url = URL.createObjectURL(exported.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exported.filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Defer revoke so the browser has time to start the download.
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });

    setStatus({
      kind: "info",
      message: `Exported profile as ${exported.filename}.`,
    });
  }, [save]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback(
    async (file: File) => {
      let text: string;
      try {
        text = await file.text();
      } catch (error) {
        setStatus({
          kind: "error",
          message: `Could not read file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        return;
      }

      const result = importProfile(text);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message: describeImportError(result.error),
        });
        return;
      }

      const writeResult = saveSave(result.save);
      if (writeResult.kind !== "ok") {
        setStatus({
          kind: "error",
          message: `Imported file parsed but save failed (${writeResult.reason}); change kept in memory only.`,
        });
        setSave(result.save);
        return;
      }
      setSave(result.save);
      setStatus({
        kind: "info",
        message: `Imported profile from ${file.name}.`,
      });
    },
    [],
  );

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input so re-selecting the same file fires onChange.
      event.target.value = "";
      if (!file) return;
      void onImportFile(file);
    },
    [onImportFile],
  );

  const onClear = useCallback(() => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(CONFIRM_CLEAR_MESSAGE);
    if (!confirmed) return;
    try {
      window.localStorage.removeItem(storageKey(CURRENT_SAVE_VERSION));
      window.localStorage.removeItem(backupKey(CURRENT_SAVE_VERSION));
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Clear failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }
    const fresh = defaultSave();
    setSave(fresh);
    setStatus({
      kind: "info",
      message: "Local save cleared. A fresh profile is now active.",
    });
  }, []);

  if (!save) {
    return (
      <div data-testid="profile-section-loading" style={loadingStyle}>
        Loading profile.
      </div>
    );
  }

  return (
    <div data-testid="profile-section" style={paneStyle}>
      <header style={headerStyle}>
        <h2 style={headlineStyle}>Profile backup</h2>
        <p style={subtitleStyle}>
          Export your save as a JSON file or restore from a previous
          export. Importing replaces the current save.
        </p>
      </header>

      <div style={buttonRowStyle}>
        <button
          type="button"
          onClick={onExport}
          data-testid="profile-export-button"
          style={primaryButtonStyle}
        >
          Export profile
        </button>
        <button
          type="button"
          onClick={onImportClick}
          data-testid="profile-import-button"
          style={primaryButtonStyle}
        >
          Import profile
        </button>
        <button
          type="button"
          onClick={onClear}
          data-testid="profile-clear-button"
          style={dangerButtonStyle}
        >
          Clear save
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={onFileChange}
        data-testid="profile-import-input"
        style={hiddenInputStyle}
      />

      <dl style={summaryStyle} data-testid="profile-summary">
        <dt style={summaryDtStyle}>Profile</dt>
        <dd style={summaryDdStyle}>{save.profileName}</dd>
        <dt style={summaryDtStyle}>Credits</dt>
        <dd style={summaryDdStyle} data-testid="profile-summary-credits">
          {save.garage.credits}
        </dd>
        <dt style={summaryDtStyle}>Save version</dt>
        <dd style={summaryDdStyle}>v{save.version}</dd>
      </dl>

      {status.kind !== "idle" ? (
        <p
          data-testid="profile-status"
          data-status={status.kind}
          style={statusStyle(status.kind)}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

function describeImportError(
  error: ReturnType<typeof importProfile> extends infer R
    ? R extends { ok: false; error: infer E }
      ? E
      : never
    : never,
): string {
  switch (error.kind) {
    case "parse":
      return `Could not parse file: ${error.message}`;
    case "schema":
      return `Save file is invalid at "${error.path}": ${error.message}`;
    case "future_version":
      return `This save was created in a newer version (v${error.saveVersion}, runtime is v${error.runtimeVersion}).`;
    case "migration":
      return `Migration failed: ${error.message}`;
    case "too_large":
      return `File too large (${error.bytes} bytes, limit ${error.limit}).`;
  }
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

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const primaryButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--accent, #8cf)",
  color: "var(--accent, #8cf)",
  padding: "0.5rem 0.9rem",
  borderRadius: "6px",
  cursor: "pointer",
  font: "inherit",
};

const dangerButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #f88",
  color: "#f88",
  padding: "0.5rem 0.9rem",
  borderRadius: "6px",
  cursor: "pointer",
  font: "inherit",
};

const hiddenInputStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const summaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  rowGap: "0.25rem",
  columnGap: "1rem",
  margin: 0,
  padding: "0.75rem 1rem",
  border: "1px solid var(--muted, #444)",
  borderRadius: "6px",
};

const summaryDtStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted, #aaa)",
  fontSize: "0.85rem",
};

const summaryDdStyle: CSSProperties = {
  margin: 0,
  color: "var(--fg, #ddd)",
};

function statusStyle(kind: PaneStatus["kind"]): CSSProperties {
  return {
    margin: 0,
    color: kind === "error" ? "#f88" : "var(--accent, #8cf)",
    fontSize: "0.9rem",
  };
}
