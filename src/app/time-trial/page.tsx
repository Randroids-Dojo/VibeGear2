"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import {
  TRACK_RAW,
  GhostReplaySchema,
  TrackSchema,
  getChampionship,
  type SaveGame,
  type Track,
  type WeatherOption,
} from "@/data";
import {
  acceptDownloadedGhost,
  buildTimeTrialView,
} from "@/game/modes/timeTrialTargets";
import { formatLapTime } from "@/render/hudSplits";
import { defaultSave, loadSave, saveSave } from "@/persistence";

const CHAMPIONSHIP_ID = "world-tour-standard";
const TRACKS_BY_ID = buildTrackMap();

export default function TimeTrialPage(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");

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

  const importDownloadedGhost = useCallback(
    async (
      track: { readonly id: string; readonly name: string; readonly version: number },
      file: File | null,
    ): Promise<void> => {
      if (!file || !save) return;
      setImportStatus(`Importing ${file.name}.`);
      let payload: unknown;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        setImportStatus("Ghost import failed: file is not valid JSON.");
        return;
      }
      const parsed = GhostReplaySchema.safeParse(payload);
      if (!parsed.success) {
        setImportStatus("Ghost import failed: replay schema is invalid.");
        return;
      }
      if (
        !acceptDownloadedGhost({
          trackId: track.id,
          trackVersion: track.version,
          ghost: parsed.data,
        })
      ) {
        setImportStatus(`Ghost import failed: replay is not for ${track.name}.`);
        return;
      }
      const nextSave: SaveGame = {
        ...save,
        downloadedGhosts: {
          ...(save.downloadedGhosts ?? {}),
          [track.id]: parsed.data,
        },
      };
      const write = saveSave(nextSave);
      if (write.kind !== "ok") {
        setImportStatus("Ghost import failed: save could not be written.");
        return;
      }
      setSave(nextSave);
      setImportStatus(`Imported downloaded ghost for ${track.name}.`);
    },
    [save],
  );

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
            {importStatus ? (
              <p data-testid="time-trial-ghost-import-status" style={statusStyle}>
                {importStatus}
              </p>
            ) : null}
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
                  <div style={statStyle}>
                    <dt style={statLabelStyle}>Downloaded ghost</dt>
                    <dd
                      data-testid={`time-trial-downloaded-ghost-${track.id}`}
                      style={statValueStyle}
                    >
                      {formatOptionalTime(track.downloadedGhostTimeMs)}
                    </dd>
                  </div>
                </dl>

                <div style={ghostActionStyle}>
                  <label style={ghostImportStyle}>
                    <span>Import ghost</span>
                    <input
                      data-testid={`time-trial-import-ghost-${track.id}`}
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        void importDownloadedGhost(
                          track,
                          event.currentTarget.files?.[0] ?? null,
                        );
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {track.startDownloadedGhostHref ? (
                    <Link
                      href={track.startDownloadedGhostHref}
                      data-testid={`time-trial-start-downloaded-ghost-${track.id}`}
                      style={ghostStartStyle}
                    >
                      Start downloaded ghost
                    </Link>
                  ) : null}
                </div>
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

const statusStyle: CSSProperties = {
  margin: 0,
  color: "#d7e5f7",
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

const ghostActionStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const ghostImportStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  color: "#cbd5e1",
};

const ghostStartStyle: CSSProperties = {
  color: "#93c5fd",
  fontWeight: 700,
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
