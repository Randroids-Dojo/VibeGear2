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
  CARS_BY_ID,
  TRACK_RAW,
  TrackSchema,
  getChampionship,
  type SaveGame,
  type Track,
  type WeatherOption,
} from "@/data";
import { buildQuickRaceView, quickRaceHref } from "@/game/modes/quickRace";
import { defaultSave, loadSave } from "@/persistence";

const CHAMPIONSHIP_ID = "world-tour-standard";
const TRACKS_BY_ID = buildTrackMap();

export default function QuickRacePage(): ReactElement {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [trackId, setTrackId] = useState<string>("");
  const [weather, setWeather] = useState<WeatherOption | "">("");
  const [carId, setCarId] = useState<string>("");

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded.kind === "loaded" ? loaded.save : defaultSave());
  }, []);

  const view = useMemo(() => {
    if (!save) return null;
    return buildQuickRaceView({
      save,
      championship: getChampionship(CHAMPIONSHIP_ID),
      tracksById: TRACKS_BY_ID,
      carsById: CARS_BY_ID,
    });
  }, [save]);

  const selectedTrack =
    view?.tracks.find((option) => option.id === trackId) ?? view?.tracks[0];
  const selectedWeather =
    weather !== "" && selectedTrack?.weatherOptions.includes(weather)
      ? weather
      : selectedTrack?.weatherOptions[0];
  const selectedCar =
    view?.cars.find((option) => option.id === carId) ?? view?.cars[0];

  useEffect(() => {
    if (!view) return;
    const firstTrack = view.tracks[0];
    const firstCar = view.cars[0];
    if (firstTrack && !trackId) {
      setTrackId(firstTrack.id);
      setWeather(firstTrack.weatherOptions[0] ?? "clear");
    }
    if (firstCar && !carId) {
      setCarId(firstCar.id);
    }
  }, [carId, trackId, view]);

  useEffect(() => {
    if (!selectedTrack) return;
    if (selectedWeather === undefined) {
      setWeather(selectedTrack.weatherOptions[0] ?? "clear");
    }
  }, [selectedTrack, selectedWeather]);

  const ready =
    selectedTrack !== undefined &&
    selectedWeather !== undefined &&
    selectedCar !== undefined;
  const href = ready
    ? quickRaceHref({
        trackId: selectedTrack.id,
        weather: selectedWeather,
        carId: selectedCar.id,
      })
    : "/";

  return (
    <main data-testid="quick-race-page" style={pageStyle}>
      <section style={shellStyle}>
        <header>
          <h1 style={titleStyle}>Quick Race</h1>
          <p style={subtitleStyle}>
            Pick an unlocked track, weather, and owned car for a no-economy
            race.
          </p>
        </header>

        {!view ? (
          <p data-testid="quick-race-loading">Loading quick race options.</p>
        ) : (
          <div style={formStyle}>
            <label style={fieldStyle}>
              <span>Track</span>
              <select
                value={selectedTrack?.id ?? ""}
                onChange={(event) => {
                  const nextTrack = view.tracks.find(
                    (option) => option.id === event.target.value,
                  );
                  setTrackId(event.target.value);
                  setWeather(nextTrack?.weatherOptions[0] ?? "clear");
                }}
                data-testid="quick-race-track"
              >
                {view.tracks.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span>Weather</span>
              <select
                value={selectedWeather ?? ""}
                onChange={(event) => setWeather(event.target.value as WeatherOption)}
                data-testid="quick-race-weather"
              >
                {(selectedTrack?.weatherOptions ?? []).map((option) => (
                  <option key={option} value={option}>
                    {formatWeather(option)}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span>Car</span>
              <select
                value={selectedCar?.id ?? ""}
                onChange={(event) => setCarId(event.target.value)}
                data-testid="quick-race-car"
              >
                {view.cars.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <Link
              href={href}
              aria-disabled={!ready}
              data-testid="quick-race-start"
              style={startStyle}
            >
              Start quick race
            </Link>
          </div>
        )}

        <Link href="/" data-testid="quick-race-back" style={backStyle}>
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

function formatWeather(weather: WeatherOption): string {
  return weather
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "var(--bg, #111)",
  color: "var(--fg, #ddd)",
  fontFamily: "system-ui, sans-serif",
  padding: "2rem",
};

const shellStyle: CSSProperties = {
  width: "min(42rem, 100%)",
  display: "grid",
  gap: "1.25rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
};

const subtitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--muted, #aaa)",
  lineHeight: 1.45,
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const startStyle: CSSProperties = {
  justifySelf: "start",
  padding: "0.75rem 1rem",
  border: "1px solid var(--accent, #8cf)",
  borderRadius: "8px",
  color: "var(--fg, #ddd)",
  textDecoration: "none",
};

const backStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
};
