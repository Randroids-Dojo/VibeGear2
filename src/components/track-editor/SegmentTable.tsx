import type { Track } from "@/data/schemas";
import { addSegment, hazardsToText, removeSegment, textToHazards, updateSegment } from "./trackEditorState";

interface SegmentTableProps {
  readonly track: Track;
  readonly onChange: (track: Track) => void;
}

const inputStyle = {
  width: "100%",
  minWidth: "4rem",
  boxSizing: "border-box",
  padding: "0.35rem",
  border: "1px solid #33425c",
  background: "#0d1524",
  color: "#f4f7fb",
  font: "inherit",
} as const;

const cellStyle = {
  padding: "0.35rem",
  borderBottom: "1px solid #26344b",
  verticalAlign: "top",
} as const;

export function SegmentTable({ track, onChange }: SegmentTableProps) {
  return (
    <section
      aria-labelledby="track-editor-segments-title"
      data-testid="track-editor-segments"
      style={{ minWidth: 0 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h2 id="track-editor-segments-title">Segments</h2>
        <button type="button" onClick={() => onChange(addSegment(track))}>Add segment</button>
      </header>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "58rem" }}>
          <thead>
            <tr>
              <th style={cellStyle}>#</th>
              <th style={cellStyle}>Len</th>
              <th style={cellStyle}>Curve</th>
              <th style={cellStyle}>Grade</th>
              <th style={cellStyle}>Left prop id</th>
              <th style={cellStyle}>Right prop id</th>
              <th style={cellStyle}>Hazards</th>
              <th style={cellStyle}>Tunnel</th>
              <th style={cellStyle}>Material</th>
              <th style={cellStyle}>Remove</th>
            </tr>
          </thead>
          <tbody>
            {track.segments.map((segment, index) => (
              <tr key={index}>
                <td style={cellStyle}>{index}</td>
                <td style={cellStyle}>
                  <NumberInput value={segment.len} min={1} step={1} onChange={(len) => onChange(updateSegment(track, index, { len }))} />
                </td>
                <td style={cellStyle}>
                  <NumberInput value={segment.curve} min={-1} max={1} step={0.01} onChange={(curve) => onChange(updateSegment(track, index, { curve }))} />
                </td>
                <td style={cellStyle}>
                  <NumberInput value={segment.grade} min={-0.3} max={0.3} step={0.01} onChange={(grade) => onChange(updateSegment(track, index, { grade }))} />
                </td>
                <td style={cellStyle}>
                  <input style={inputStyle} value={segment.roadsideLeft} onChange={(event) => onChange(updateSegment(track, index, { roadsideLeft: event.currentTarget.value }))} />
                </td>
                <td style={cellStyle}>
                  <input style={inputStyle} value={segment.roadsideRight} onChange={(event) => onChange(updateSegment(track, index, { roadsideRight: event.currentTarget.value }))} />
                </td>
                <td style={cellStyle}>
                  <input style={inputStyle} value={hazardsToText(segment.hazards)} onChange={(event) => onChange(updateSegment(track, index, { hazards: textToHazards(event.currentTarget.value) }))} />
                </td>
                <td style={cellStyle}>
                  <input type="checkbox" checked={segment.inTunnel === true} onChange={(event) => onChange(updateSegment(track, index, { inTunnel: event.currentTarget.checked }))} />
                </td>
                <td style={cellStyle}>
                  <input style={inputStyle} value={segment.tunnelMaterial ?? ""} onChange={(event) => onChange(updateSegment(track, index, { tunnelMaterial: event.currentTarget.value || undefined }))} />
                </td>
                <td style={cellStyle}>
                  <button type="button" disabled={track.segments.length <= 4} onClick={() => onChange(removeSegment(track, index))}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly value: number;
  readonly min: number;
  readonly max?: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <input
      style={inputStyle}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) onChange(next);
      }}
    />
  );
}
