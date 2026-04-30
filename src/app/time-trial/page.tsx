"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import {
  TRACK_RAW,
  TrackSchema,
  getChampionship,
  type SaveGame,
  type Track,
  type WeatherOption,
} from "@/data";
import { buildTimeTrialView } from "@/game/modes/timeTrialTargets";
import { formatLapTime } from "@/render/hudSplits";
import { defaultSave, loadSave } from "@/persistence";

const CHAMPIONSHIP_ID = "world-tour-standard";
const TRACKS_BY_ID = buildTrackMap();

export default function TimeTrialPage(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded.kind === "loaded" ? loaded.save : defaultSave());
  }, []);

  const view = useMemo(() => {
    if (!save) return null;
    return buildTimeTrialView({
      save,
      championship: getChampionship(CHAMPIONSHIP_ID),
      tracksById: TRACKS_BY_ID,
    });
  }, [save]);

  return (
    <main data-testid="time-trial-page" style={pageStyle}>
      <section style={shellStyle} aria-labelledby="time-trial-title">
        <header style={headerStyle}>
          <p style={eyebrowStyle}>Time Trial</p>
          <h1 id="time-trial-title" style={titleStyle}>
            Ghost chase
          </h1>
          <p style={subtitleStyle}>
            Run unlocked tracks against your saved personal best and the
            official benchmark target.
          </p>
        </header>

        {!view ? (
          <p data-testid="time-trial-loading">Loading Time Trial tracks.</p>
        ) : (
          <div style={trackListStyle}>
            {view.tracks.map((track) => (
              <article
                key={track.id}
                data-testid={`time-trial-track-${track.id}`}
                style={trackRowStyle}
              >
                <div style={trackHeaderStyle}>
                  <div>
                    <h2 style={trackTitleStyle}>{track.name}</h2>
                    <p style={trackMetaStyle}>{track.id}</p>
                  </div>
                  <Link
                    href={track.startHref}
                    data-testid={`time-trial-start-${track.id}`}
                    style={startStyle}
                  >
                    Start
                  </Link>
                </div>

                <dl style={statsStyle}>
                  <div style={statStyle}>
                    <dt style={statLabelStyle}>Personal best</dt>
                    <dd
                      data-testid={`time-trial-pb-${track.id}`}
                      style={statValueStyle}
                    >
                      {formatOptionalTime(track.personalBestLapMs)}
                    </dd>
                  </div>
                  <div style={statStyle}>
                    <dt style={statLabelStyle}>Benchmark</dt>
                    <dd
                      data-testid={`time-trial-benchmark-${track.id}`}
                      style={statValueStyle}
                    >
                      {formatOptionalTime(track.developerBenchmarkMs)}
                    </dd>
                  </div>
                  <div style={statStyle}>
                    <dt style={statLabelStyle}>Default weather</dt>
                    <dd
                      data-testid={`time-trial-weather-${track.id}`}
                      style={statValueStyle}
                    >
                      {formatWeather(track.weatherOptions[0] ?? "clear")}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}

        <Link href="/" data-testid="time-trial-back" style={backStyle}>
          Back to title
        </Link>
      </section>
    </main>
  );
}

function buildTrackMap(): ReadonlyMap<string, Track> {
  const entries = Object.values(TRACK_RAW).map((raw) => {
    const track = TrackSchema.parse(raw);
    return [track.id, track] as const;
  });
  return new Map(entries);
}

function formatOptionalTime(ms: number | null): string {
  return ms === null ? "No time" : formatLapTime(ms);
}

function formatWeather(weather: WeatherOption): string {
  return weather
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0b0e14",
  color: "#e6e8eb",
  fontFamily: "system-ui, sans-serif",
  padding: "48px 20px",
};

const shellStyle: CSSProperties = {
  width: "min(960px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: "22px",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#93c5fd",
  fontSize: "0.86rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(2rem, 7vw, 4.5rem)",
  lineHeight: 0.95,
};

const subtitleStyle: CSSProperties = {
  maxWidth: "64ch",
  margin: 0,
  color: "#b8c0cc",
  fontSize: "1.05rem",
  lineHeight: 1.6,
};

const trackListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const trackRowStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  padding: "18px",
  border: "1px solid #28415f",
  borderRadius: "8px",
  background: "#111827",
};

const trackHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: "16px",
};

const trackTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
};

const trackMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#9aa3ad",
};

const statsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
  margin: 0,
};

const statStyle: CSSProperties = {
  minWidth: 0,
  padding: "10px",
  background: "#172033",
};

const statLabelStyle: CSSProperties = {
  marginBottom: "4px",
  color: "#9aa3ad",
  fontSize: "0.76rem",
  textTransform: "uppercase",
};

const statValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 800,
};

const startStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "6px",
  background: "#facc15",
  color: "#111827",
  fontWeight: 800,
  textDecoration: "none",
};

const backStyle: CSSProperties = {
  color: "#9aa3ad",
};
