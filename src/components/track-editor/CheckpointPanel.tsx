import type { Track } from "@/data/schemas";
import { addCheckpoint, removeCheckpoint, updateCheckpoint } from "./trackEditorState";

interface CheckpointPanelProps {
  readonly track: Track;
  readonly onChange: (track: Track) => void;
}

const inputStyle = {
  padding: "0.4rem",
  border: "1px solid #33425c",
  background: "#0d1524",
  color: "#f4f7fb",
  font: "inherit",
} as const;

export function CheckpointPanel({ track, onChange }: CheckpointPanelProps) {
  return (
    <section
      aria-labelledby="track-editor-checkpoints-title"
      data-testid="track-editor-checkpoints"
      style={{ minWidth: 0 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h2 id="track-editor-checkpoints-title">Checkpoints</h2>
        <button type="button" onClick={() => onChange(addCheckpoint(track))}>Add checkpoint</button>
      </header>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {track.checkpoints.map((checkpoint, index) => {
          const locked = checkpoint.label === "start";
          return (
            <div key={`${checkpoint.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "8rem 1fr auto", gap: "0.5rem", alignItems: "center" }}>
              <input
                style={inputStyle}
                type="number"
                value={checkpoint.segmentIndex}
                min={0}
                max={Math.max(0, track.segments.length - 1)}
                disabled={locked}
                onChange={(event) => {
                  const segmentIndex = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(segmentIndex)) {
                    onChange(updateCheckpoint(track, index, { segmentIndex }));
                  }
                }}
              />
              <input
                style={inputStyle}
                value={checkpoint.label}
                disabled={locked}
                onChange={(event) => onChange(updateCheckpoint(track, index, { label: event.currentTarget.value }))}
              />
              <button type="button" disabled={locked} onClick={() => onChange(removeCheckpoint(track, index))}>Remove</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
