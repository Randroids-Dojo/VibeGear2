import type { Track } from "@/data/schemas";
import { WEATHER_OPTIONS, replaceMeta, setWeather, updateSpawnGridSlots } from "./trackEditorState";

interface MetaHeaderProps {
  readonly track: Track;
  readonly onChange: (track: Track) => void;
}

const labelStyle = {
  display: "grid",
  gap: "0.25rem",
  fontSize: "0.85rem",
} as const;

const inputStyle = {
  minWidth: 0,
  padding: "0.45rem 0.55rem",
  border: "1px solid #3a4a63",
  background: "#0d1524",
  color: "#f4f7fb",
  font: "inherit",
} as const;

export function MetaHeader({ track, onChange }: MetaHeaderProps) {
  return (
    <section
      aria-labelledby="track-editor-meta-title"
      data-testid="track-editor-meta"
      style={{ minWidth: 0 }}
    >
      <h2 id="track-editor-meta-title">Metadata</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
          gap: "0.75rem",
        }}
      >
        <TextField label="Id" value={track.id} onChange={(id) => onChange(replaceMeta(track, { id }))} />
        <TextField label="Name" value={track.name} onChange={(name) => onChange(replaceMeta(track, { name }))} />
        <TextField label="Tour" value={track.tourId} onChange={(tourId) => onChange(replaceMeta(track, { tourId }))} />
        <TextField label="Author" value={track.author} onChange={(author) => onChange(replaceMeta(track, { author }))} />
        <NumberField label="Version" value={track.version} min={1} step={1} onChange={(version) => onChange(replaceMeta(track, { version }))} />
        <NumberField label="Laps" value={track.laps} min={1} step={1} onChange={(laps) => onChange(replaceMeta(track, { laps }))} />
        <NumberField label="Length m" value={track.lengthMeters} min={1} step={1} onChange={(lengthMeters) => onChange(replaceMeta(track, { lengthMeters }))} />
        <NumberField label="Difficulty" value={track.difficulty} min={1} max={5} step={1} onChange={(difficulty) => onChange(replaceMeta(track, { difficulty }))} />
        <NumberField label="Lanes" value={track.laneCount} min={1} step={1} onChange={(laneCount) => onChange(replaceMeta(track, { laneCount }))} />
        <NumberField label="Grid slots" value={track.spawn.gridSlots} min={1} step={1} onChange={(gridSlots) => onChange(updateSpawnGridSlots(track, gridSlots))} />
      </div>
      <fieldset
        style={{
          margin: "1rem 0 0",
          border: "1px solid #2b3a52",
          padding: "0.75rem",
        }}
      >
        <legend>Weather</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
          {WEATHER_OPTIONS.map((option) => (
            <label key={option} style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={track.weatherOptions.includes(option)}
                onChange={(event) => onChange(setWeather(track, option, event.currentTarget.checked))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      <input style={inputStyle} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max?: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      <input
        style={inputStyle}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}
