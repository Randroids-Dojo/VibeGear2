"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import type { Track } from "@/data/schemas";
import { CheckpointPanel } from "./CheckpointPanel";
import { DEFAULT_TRACK } from "./defaultTrack";
import { exportTrack, importTrack, validateAndCompile } from "./io";
import { MetaHeader } from "./MetaHeader";
import { PreviewPane } from "./PreviewPane";
import { SegmentTable } from "./SegmentTable";
import { WarningsPanel } from "./WarningsPanel";

export function TrackEditor() {
  const [track, setTrack] = useState<Track>(() => cloneTrack(DEFAULT_TRACK));
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const validation = useMemo(() => validateAndCompile(track), [track]);
  const compiled = validation.ok ? validation.compiled : null;
  const error = validation.ok ? importError : validation.message;

  const handleImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const result = await importTrack(file);
    if (result.ok) {
      setTrack(result.track);
      setImportError(null);
    } else {
      setImportError(result.message);
    }
    event.currentTarget.value = "";
  };

  const handleExport = (): void => {
    const blob = exportTrack(track);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${track.id.replaceAll("/", "-")}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });
  };

  return (
    <main
      data-testid="track-editor-page"
      style={{
        minHeight: "100vh",
        background: "#070b12",
        color: "#f4f7fb",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #233049" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Track editor</h1>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(22rem, 0.9fr)",
          gap: "1rem",
          padding: "1rem",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
          <Toolbar onReset={() => setTrack(cloneTrack(DEFAULT_TRACK))} onExport={handleExport} onImportClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImport} style={{ display: "none" }} />
          <MetaHeader track={track} onChange={(next) => { setTrack(next); setImportError(null); }} />
          <SegmentTable track={track} onChange={(next) => { setTrack(next); setImportError(null); }} />
          <CheckpointPanel track={track} onChange={(next) => { setTrack(next); setImportError(null); }} />
        </div>
        <aside style={{ display: "grid", gap: "1rem", position: "sticky", top: "1rem", minWidth: 0 }}>
          <PreviewPane compiled={compiled} />
          <WarningsPanel warnings={compiled?.warnings ?? []} error={error} />
          <TrackStats track={track} compiledSegments={compiled?.totalCompiledSegments ?? null} />
        </aside>
      </div>
    </main>
  );
}

function Toolbar({
  onReset,
  onExport,
  onImportClick,
}: {
  readonly onReset: () => void;
  readonly onExport: () => void;
  readonly onImportClick: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <button type="button" onClick={onImportClick}>Import JSON</button>
      <button type="button" onClick={onExport}>Export JSON</button>
      <button type="button" onClick={onReset}>Reset draft</button>
    </div>
  );
}

function TrackStats({
  track,
  compiledSegments,
}: {
  readonly track: Track;
  readonly compiledSegments: number | null;
}) {
  return (
    <section aria-labelledby="track-editor-stats-title" data-testid="track-editor-stats">
      <h2 id="track-editor-stats-title">Stats</h2>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.25rem 1rem" }}>
        <dt>Segments</dt>
        <dd>{track.segments.length}</dd>
        <dt>Compiled</dt>
        <dd>{compiledSegments ?? "blocked"}</dd>
        <dt>Checkpoints</dt>
        <dd>{track.checkpoints.length}</dd>
      </dl>
    </section>
  );
}

function cloneTrack(track: Track): Track {
  return JSON.parse(JSON.stringify(track)) as Track;
}
